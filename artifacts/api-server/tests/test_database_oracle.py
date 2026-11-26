import asyncio
import os
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with patch.dict(os.environ, {"DATABASE_URL": "oracle://", "AUTH_PROVIDER": "clerk"}):
    from fastapi import HTTPException
    from starlette.requests import Request
    from starlette.routing import Match
    from server.database import (
        OracleCursor,
        _oracle_bind_values,
        _oracle_ddl,
        _oracle_sql,
        create_tables,
    )
    from server.routes.music import (
        _database_object_response,
        serve_storage_object,
        upload_local_profile_photo,
    )
    from server.routes.auth import AdminLoginRequest, admin_login
    from server.routes.chat import (
        _add_message_metadata,
        _get_message_for_user,
        _message_out,
        list_chat_conversations,
        list_direct_messages,
        send_direct_message,
        router as chat_router,
    )
    from server.routes.chat import SendMessageRequest
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
    def test_direct_message_user_route_precedes_parameterized_chat_room(self):
        for path, endpoint_name in (
            ("/chat/users", "list_chat_users"),
            ("/chat/conversations", "list_chat_conversations"),
            ("/chat/reports", "list_chat_reports"),
        ):
            matching_route = next(
                route
                for route in chat_router.routes
                if route.matches(
                    {
                        "type": "http",
                        "path": path,
                        "root_path": "",
                        "method": "GET",
                        "headers": [],
                    }
                )[0]
                is Match.FULL
            )
            self.assertEqual(matching_route.endpoint.__name__, endpoint_name)

    @patch("server.routes.chat.db_cursor")
    def test_direct_conversation_list_includes_latest_message_preview(self, db_cursor):
        cursor = db_cursor.return_value.__enter__.return_value
        cursor.fetchall.side_effect = [
            [{
                "id": 3,
                "first_name": "Ari",
                "last_name": "Member",
                "username": "ari",
            }],
            [{
                "room": "dm:1:3",
                "user_id": 3,
                "display_name": "Ari",
                "content": "See you soon",
                "created_at": "2026-11-26T09:00:00",
            }],
        ]

        response = list_chat_conversations(user_id=1)

        self.assertEqual(response["users"][0]["id"], 3)
        self.assertEqual(
            response["users"][0]["lastMessage"]["content"],
            "See you soon",
        )
        self.assertIn("ROW_NUMBER()", cursor.execute.call_args_list[1].args[0])

    @patch("server.routes.chat.insert_returning")
    @patch("server.routes.chat.db_cursor")
    def test_direct_message_send_and_receive_use_same_private_room(
        self, db_cursor, insert_returning,
    ):
        cursor = db_cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = {"id": 3}
        insert_returning.return_value = {
            "id": 12,
            "room": "dm:1:3",
            "user_id": 1,
            "display_name": "Member",
            "content": "Hello there",
            "reply_to_id": None,
            "created_at": "2026-11-26T09:00:00",
        }

        sent = send_direct_message(
            3,
            SendMessageRequest(content=" Hello there ", displayName="Member"),
            user_id=1,
        )

        self.assertEqual(sent["message"]["content"], "Hello there")
        self.assertEqual(sent["message"]["room"], "dm:1:3")
        insert_returning.assert_called_once()

        cursor.fetchone.return_value = {"id": 3}
        cursor.fetchall.side_effect = [
            [{
                "id": 12,
                "room": "dm:1:3",
                "user_id": 1,
                "display_name": "Member",
                "content": "Hello there",
                "reply_to_id": None,
                "reply_content": None,
                "reply_display_name": None,
                "created_at": "2026-11-26T09:00:00",
            }],
            [],
            [],
        ]
        received = list_direct_messages(1, user_id=3)

        self.assertEqual(received["messages"][0]["id"], sent["message"]["id"])
        self.assertEqual(received["messages"][0]["content"], "Hello there")

    def test_chat_message_action_lookup_restricts_direct_message_participants(self):
        class MessageCursor:
            def execute(self, _statement, _params):
                pass

            def fetchone(self):
                return {"room": "dm:4:9", "content": "hello", "user_id": 4}

        message = _get_message_for_user(MessageCursor(), 1, 9)
        self.assertEqual(message["room"], "dm:4:9")
        with self.assertRaises(HTTPException) as error:
            _get_message_for_user(MessageCursor(), 1, 12)
        self.assertEqual(error.exception.status_code, 403)

    def test_chat_message_stars_are_private_and_pin_metadata_is_visible(self):
        class MetadataCursor:
            def __init__(self, starred, pins):
                self.results = [starred, pins]

            def execute(self, _statement, _params):
                pass

            def fetchall(self):
                return self.results.pop(0)

        rows = [{"id": 8, "room": "friends"}]
        _add_message_metadata(
            MetadataCursor([{"message_id": 8}], [{"message_id": 8, "pinned_by": 2}]),
            rows,
            2,
            "friends",
        )
        self.assertTrue(rows[0]["is_starred"])
        self.assertTrue(rows[0]["is_pinned"])
        self.assertTrue(rows[0]["is_pinned_by_me"])
        self.assertTrue(_message_out({
            **rows[0],
            "user_id": 1,
            "display_name": "Member",
            "content": "hello",
            "created_at": "now",
        })["isStarred"])

        other_user_rows = [{"id": 8, "room": "friends"}]
        _add_message_metadata(
            MetadataCursor([], [{"message_id": 8, "pinned_by": 2}]),
            other_user_rows,
            3,
            "friends",
        )
        self.assertFalse(other_user_rows[0]["is_starred"])
        self.assertTrue(other_user_rows[0]["is_pinned"])
        self.assertFalse(other_user_rows[0]["is_pinned_by_me"])

    def test_postgres_storage_returns_database_upload_urls_for_audio_and_photos(self):
        with patch.dict(os.environ, {"STORAGE_BACKEND": "postgres"}):
            audio = request_audio_upload("song.mp3", 100, "audio/mpeg")
            photo = request_profile_photo_upload("photo.png", 100, "image/png")

        self.assertIn("/api/storage/database-uploads/", audio["uploadURL"])
        self.assertTrue(audio["objectPath"].startswith("/objects/uploads/"))
        self.assertIn("/api/storage/database-uploads/", photo["uploadURL"])
        self.assertTrue(photo["objectPath"].startswith("/objects/uploads/"))

    def test_local_profile_photo_upload_and_read_use_persistent_file_storage(self):
        image_bytes = b"\x89PNG\r\n\x1a\nprofile-image"
        object_id = f"{uuid4()}.png"

        def image_request():
            messages = [{
                "type": "http.request",
                "body": image_bytes,
                "more_body": False,
            }]

            async def receive():
                return messages.pop(0)

            return Request(
                {
                    "type": "http",
                    "http_version": "1.1",
                    "method": "PUT",
                    "scheme": "http",
                    "path": "/api/storage/local-photo-uploads",
                    "query_string": b"",
                    "headers": [
                        (b"content-type", b"image/png"),
                        (b"content-length", str(len(image_bytes)).encode()),
                    ],
                    "server": ("testserver", 80),
                    "client": ("testclient", 123),
                },
                receive,
            )

        with tempfile.TemporaryDirectory() as storage_dir, patch.dict(
            os.environ,
            {"STORAGE_BACKEND": "local", "LOCAL_STORAGE_DIR": storage_dir},
        ):
            upload = request_profile_photo_upload("photo.png", 100, "image/png")
            self.assertIn("/api/storage/local-photo-uploads/", upload["uploadURL"])
            self.assertTrue(upload["objectPath"].endswith(".png"))

            asyncio.run(upload_local_profile_photo(object_id, image_request()))
            response = serve_storage_object(f"uploads/{object_id}", image_request())

            self.assertEqual(response.media_type, "image/png")
            self.assertEqual(Path(response.path).read_bytes(), image_bytes)

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
        self.assertIn("CREATE TABLE IF NOT EXISTS chat_message_stars", statements)
        self.assertIn("CREATE TABLE IF NOT EXISTS chat_message_pins", statements)
        self.assertIn("CREATE TABLE IF NOT EXISTS chat_message_reports", statements)

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
        self.assertIn("message_content CLOB NOT NULL", _oracle_ddl(
            """CREATE TABLE IF NOT EXISTS chat_message_reports (
                message_content TEXT NOT NULL
            )"""
        ))
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


if __name__ == "__main__":
    unittest.main()
