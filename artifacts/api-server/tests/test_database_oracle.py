import os
import sys
import unittest
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with patch.dict(os.environ, {"DATABASE_URL": "oracle://", "AUTH_PROVIDER": "clerk"}):
    from fastapi import HTTPException
    from server.database import (
        OracleCursor,
        _oracle_bind_values,
        _oracle_ddl,
        _oracle_sql,
        create_tables,
    )
    from server.routes.music import _database_object_response
    from server.routes.auth import AdminLoginRequest, admin_login
    from server.routes.reading_plans import _openai_http_error
    from server.storage import request_audio_upload, request_profile_photo_upload


class FakeVariable:
    def getvalue(self):
        return Decimal("7")


class FakeCursor:
    def __init__(self):
        self.description = [("ID",), ("IS_ANONYMOUS",), ("CONTENT",)]
        self.executions = []

    def execute(self, statement, params=None):
        self.executions.append((statement, params))

    def var(self, _type):
        return FakeVariable()

    def fetchone(self):
        return (Decimal("7"), "Y", FakeLob("message"))

    def fetchall(self):
        return [self.fetchone()]

    @property
    def rowcount(self):
        return 1

    def close(self):
        pass


class FakeLob:
    def __init__(self, value):
        self.value = value

    def read(self):
        return self.value


class OracleDatabaseTests(unittest.TestCase):
    def test_postgres_storage_returns_database_upload_urls_for_audio_and_photos(self):
        with patch.dict(os.environ, {"STORAGE_BACKEND": "postgres"}):
            audio = request_audio_upload("song.mp3", 100, "audio/mpeg")
            photo = request_profile_photo_upload("photo.png", 100, "image/png")

        self.assertIn("/api/storage/database-uploads/", audio["uploadURL"])
        self.assertTrue(audio["objectPath"].startswith("/objects/uploads/"))
        self.assertIn("/api/storage/database-uploads/", photo["uploadURL"])
        self.assertTrue(photo["objectPath"].startswith("/objects/uploads/"))

    def test_postgres_storage_initializes_binary_object_table(self):
        cursor = unittest.mock.Mock()
        db_context = unittest.mock.MagicMock()
        db_context.__enter__.return_value = cursor
        with (
            patch("server.database.db_cursor", return_value=db_context),
            patch("server.database.IS_ORACLE", False),
            patch("server.database.IS_MYSQL", False),
            patch("server.database.IS_POSTGRES", True),
            patch.dict(os.environ, {"STORAGE_BACKEND": "postgres"}),
        ):
            create_tables()

        statements = "\n".join(call.args[0] for call in cursor.execute.call_args_list)
        self.assertIn("CREATE TABLE IF NOT EXISTS stored_objects", statements)
        self.assertIn("file_data BYTEA NOT NULL", statements)

    def test_postgres_object_responses_support_audio_byte_ranges(self):
        response = _database_object_response(b"0123456789", "audio/mpeg", "bytes=3-6")

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.body, b"3456")
        self.assertEqual(response.headers["content-range"], "bytes 3-6/10")

    def test_admin_login_explains_render_configuration_when_password_missing(self):
        with patch.dict(os.environ, {"ADMIN_PASSWORD": ""}):
            with self.assertRaises(HTTPException) as error:
                admin_login(AdminLoginRequest(password="anything"))

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("Render web service", error.exception.detail)
        self.assertIn("redeploy or restart", error.exception.detail)

    def test_admin_login_uses_password_from_runtime_environment(self):
        with (
            patch.dict(os.environ, {"ADMIN_PASSWORD": "configured-password"}),
            patch("server.routes.auth.sign_token", return_value="admin-token"),
        ):
            result = admin_login(
                AdminLoginRequest(password="configured-password")
            )

        self.assertEqual(result, {"token": "admin-token", "isAdmin": True})

    def test_sql_translation(self):
        self.assertEqual(
            _oracle_sql(
                "SELECT id FROM users WHERE email = %s AND username = %s LIMIT 1"
            ),
            "SELECT id FROM users WHERE email = :p0 AND username = :p1 FETCH FIRST 1 ROWS ONLY",
        )
        self.assertEqual(
            _oracle_sql("UPDATE questions SET answered_at = NOW() WHERE id = %s"),
            "UPDATE questions SET answered_at = CURRENT_TIMESTAMP WHERE id = :p0",
        )

    def test_ddl_translation(self):
        ddl = _oracle_ddl(
            """CREATE TABLE IF NOT EXISTS demo (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                completed BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL
            )"""
        )
        self.assertIn(
            "id NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY PRIMARY KEY",
            ddl,
        )
        self.assertIn("content CLOB NOT NULL", ddl)
        self.assertIn("completed CHAR(1) DEFAULT 'Y' NOT NULL", ddl)
        self.assertIn("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", ddl)
        self.assertNotIn("IF NOT EXISTS", ddl)

    def test_binds_and_rows_are_normalized(self):
        self.assertEqual(
            _oracle_bind_values((5, True, False)),
            {"p0": 5, "p1": "Y", "p2": "N"},
        )
        cursor = OracleCursor(FakeCursor())
        self.assertEqual(
            cursor.execute("SELECT id FROM users WHERE id = %s", (5,))._cursor.executions[0],
            ("SELECT id FROM users WHERE id = :p0", {"p0": 5}),
        )
        row = cursor.fetchone()
        self.assertEqual(row, {"id": 7, "is_anonymous": True, "content": "message"})

    def test_insert_returns_the_created_row(self):
        native_cursor = FakeCursor()
        cursor = OracleCursor(native_cursor)
        row = cursor.insert_returning(
            "users",
            "INSERT INTO users (username) VALUES (%s)",
            ("reader",),
        )
        self.assertEqual(row["id"], 7)
        statement, parameters = native_cursor.executions[0]
        self.assertEqual(
            statement,
            "INSERT INTO users (username) VALUES (:p0) RETURNING id INTO :inserted_id",
        )
        self.assertEqual(parameters["p0"], "reader")
        self.assertIsInstance(parameters["inserted_id"], FakeVariable)

    def test_openai_auth_error_is_actionable_without_echoing_credentials(self):
        error = HTTPError(
            "https://api.openai.com/v1/chat/completions",
            401,
            "Unauthorized",
            {},
            BytesIO(b'{"error":{"message":"Incorrect API key provided","code":"invalid_api_key"}}'),
        )
        detail, code = _openai_http_error(error)
        self.assertIn("OPENAI_API_KEY", detail)
        self.assertEqual(code, "invalid_api_key")
        self.assertNotIn("Incorrect API key", detail)

    def test_openai_quota_and_model_errors_are_specific(self):
        quota_error = HTTPError(
            "https://api.openai.com/v1/chat/completions",
            429,
            "Too Many Requests",
            {},
            BytesIO(b'{"error":{"message":"No quota","code":"insufficient_quota"}}'),
        )
        quota_detail, quota_code = _openai_http_error(quota_error)
        self.assertIn("billing and usage", quota_detail)
        self.assertEqual(quota_code, "insufficient_quota")

        model_error = HTTPError(
            "https://api.openai.com/v1/chat/completions",
            404,
            "Not Found",
            {},
            BytesIO(b'{"error":{"message":"Model not found"}}'),
        )
        model_detail, _ = _openai_http_error(model_error)
        self.assertIn("OPENAI_MODEL", model_detail)


if __name__ == "__main__":
    unittest.main()
