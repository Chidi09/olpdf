import unittest

from apps.api.security_utils import sanitize_document_model


class SecurityUtilsTests(unittest.TestCase):
    def test_sanitize_document_model_strips_script(self):
        payload = {
            "blocks": [
                {"id": "1", "type": "paragraph", "content": "<script>alert(1)</script><b>ok</b>"}
            ]
        }
        cleaned = sanitize_document_model(payload)
        self.assertNotIn("<script>", cleaned["blocks"][0]["content"])


if __name__ == "__main__":
    unittest.main()
