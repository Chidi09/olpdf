import os
import unittest

from fastapi import HTTPException

from apps.api.auth_utils import verify_jwt_token


class AuthUtilsTests(unittest.TestCase):
    def test_missing_token_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            verify_jwt_token("")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_dev_mode_allows_missing_secret(self):
        previous_mode = os.environ.get("OLPDF_DEV_MODE")
        previous_secret = os.environ.get("SUPABASE_JWT_SECRET")
        os.environ["OLPDF_DEV_MODE"] = "true"
        if "SUPABASE_JWT_SECRET" in os.environ:
            del os.environ["SUPABASE_JWT_SECRET"]

        try:
            payload = verify_jwt_token("dev-token")
            self.assertEqual(payload["sub"], "dev-user")
        finally:
            if previous_mode is None:
                os.environ.pop("OLPDF_DEV_MODE", None)
            else:
                os.environ["OLPDF_DEV_MODE"] = previous_mode

            if previous_secret is None:
                os.environ.pop("SUPABASE_JWT_SECRET", None)
            else:
                os.environ["SUPABASE_JWT_SECRET"] = previous_secret


if __name__ == "__main__":
    unittest.main()
