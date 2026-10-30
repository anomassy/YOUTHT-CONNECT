import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with patch.dict(
    os.environ,
    {"DATABASE_URL": "oracle://", "AUTH_PROVIDER": "clerk"},
):
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from server.main import web_fallback, web_root
    from server.routes.health import health_check


class StaticFrontendTests(unittest.TestCase):
    def test_root_and_client_routes_return_the_built_frontend(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            web_root_path = Path(temp_directory)
            index_path = web_root_path / "index.html"
            index_path.write_text("<html>frontend</html>", encoding="utf-8")
            with (
                patch("server.main.WEB_DIST", web_root_path),
                patch("server.main.WEB_INDEX", index_path),
            ):
                home = asyncio.run(web_root())
                route = asyncio.run(web_fallback("reading-plans"))

        self.assertIsInstance(home, FileResponse)
        self.assertEqual(Path(home.path), index_path)
        self.assertIsInstance(route, FileResponse)
        self.assertEqual(Path(route.path), index_path)

    def test_api_paths_are_not_rewritten_to_the_frontend(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(web_fallback("api/not-a-route"))

        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(health_check()["status"], "ok")


if __name__ == "__main__":
    unittest.main()
