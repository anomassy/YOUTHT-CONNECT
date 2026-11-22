import os
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.security import HTTPAuthorizationCredentials

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

with patch.dict(os.environ, {"DATABASE_URL": "oracle://", "AUTH_PROVIDER": "clerk"}):
    from fastapi import HTTPException
    from server.auth import clerk_identity
    from server.quarterly import CURRENT_QUARTERLY
    from server.routes.reading_plans import (
        CreateReadingPlanRequest,
        complete_reading_day,
        create_reading_plan,
        get_quarterly_reading,
    )


class QuarterlyTests(unittest.TestCase):
    def test_quarterly_contains_the_thirteen_source_schedule_lessons(self):
        self.assertEqual(CURRENT_QUARTERLY["quarter"], "Q4 2026")
        self.assertEqual(CURRENT_QUARTERLY["title"], "The Gift of Prophecy")
        self.assertEqual(len(CURRENT_QUARTERLY["lessons"]), 13)
        self.assertEqual(
            [lesson["week"] for lesson in CURRENT_QUARTERLY["lessons"]],
            list(range(1, 14)),
        )
        self.assertEqual(CURRENT_QUARTERLY["lessons"][0]["title"], "The Creator Speaks")
        self.assertEqual(CURRENT_QUARTERLY["lessons"][-1]["page"], 163)

    def test_quarterly_endpoint_returns_schedule_without_lesson_text(self):
        response = get_quarterly_reading(user_id=1)

        self.assertEqual(response["quarterly"]["quarter"], "Q4 2026")
        self.assertEqual(len(response["quarterly"]["lessons"]), 13)
        self.assertEqual(
            set(response["quarterly"]["lessons"][0]),
            {"week", "title", "dateRange", "page"},
        )

    def test_create_reading_plan_rejects_duplicate_day_numbers(self):
        with self.assertRaises(HTTPException) as error:
            create_reading_plan(
                CreateReadingPlanRequest(
                    title="Test plan",
                    days=[
                        {"dayNumber": 1, "passage": "John 1", "reflection": "First"},
                        {"dayNumber": 1, "passage": "John 2", "reflection": "Second"},
                    ],
                ),
                user_id=1,
            )

        self.assertEqual(error.exception.status_code, 400)

    @patch("server.routes.reading_plans.db_cursor")
    def test_complete_reading_day_requires_known_day_id(self, db_cursor):
        cursor = db_cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = None

        with self.assertRaises(HTTPException) as error:
            complete_reading_day(999, user_id=1)

        self.assertEqual(error.exception.status_code, 404)

    def test_clerk_identity_accepts_small_clock_skew(self):
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        issuer = "https://example.clerk.accounts.dev"
        origin = "http://127.0.0.1:5173"
        now = int(time.time())
        token = jwt.encode(
            {
                "sub": "user_123",
                "iss": issuer,
                "azp": origin,
                "iat": now + 30,
                "nbf": now + 30,
            },
            private_key,
            algorithm="RS256",
        )

        with (
            patch.dict(
                os.environ,
                {
                    "CLERK_ISSUER": issuer,
                    "CLERK_JWKS_URL": "https://example.clerk.accounts.dev/.well-known/jwks.json",
                    "CLERK_ALLOWED_ORIGINS": origin,
                },
            ),
            patch("server.auth._clerk_jwks_client") as jwks_client,
        ):
            jwks_client.return_value.get_signing_key_from_jwt.return_value.key = (
                private_key.public_key()
            )
            claims = clerk_identity(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            )

        self.assertEqual(claims["sub"], "user_123")

    def test_clerk_identity_rejects_tokens_outside_clock_skew(self):
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        issuer = "https://example.clerk.accounts.dev"
        origin = "http://127.0.0.1:5173"
        now = int(time.time())
        token = jwt.encode(
            {
                "sub": "user_123",
                "iss": issuer,
                "azp": origin,
                "iat": now + 120,
                "nbf": now + 120,
            },
            private_key,
            algorithm="RS256",
        )

        with (
            patch.dict(
                os.environ,
                {
                    "CLERK_ISSUER": issuer,
                    "CLERK_JWKS_URL": "https://example.clerk.accounts.dev/.well-known/jwks.json",
                    "CLERK_ALLOWED_ORIGINS": origin,
                },
            ),
            patch("server.auth._clerk_jwks_client") as jwks_client,
        ):
            jwks_client.return_value.get_signing_key_from_jwt.return_value.key = (
                private_key.public_key()
            )
            with self.assertRaises(HTTPException) as error:
                clerk_identity(
                    HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
                )

        self.assertEqual(error.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
