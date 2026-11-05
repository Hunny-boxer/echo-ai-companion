
import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from fastapi import HTTPException

from app.gemini_retry import MAX_GEMINI_RETRIES
from app.main import ChatRequest, generate_with_gemini


class FakeGeminiError(Exception):
    def __init__(self, code: int, message: str = "upstream failure"):
        self.code = code
        super().__init__(f"{code} {message}")


class GeminiRetryTests(unittest.TestCase):

    def create_client(self, generate_content):
        return SimpleNamespace(
            models=SimpleNamespace(
                generate_content=generate_content
            )
        )

    def test_temporary_failure_retries_and_then_succeeds(self):
        generate_content = Mock(
            side_effect=[
                FakeGeminiError(503),
                FakeGeminiError(503),
                SimpleNamespace(text="Memory recalled successfully."),
            ]
        )

        client = self.create_client(generate_content)

        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-only-key"},
            clear=True,
        ), patch(
            "app.main.genai.Client",
            return_value=client,
        ), patch(
            "app.gemini_retry.time.sleep"
        ) as mocked_sleep:

            reply = generate_with_gemini(
                ChatRequest(message="Hello", persona="sage"),
                "Hello",
            )

        self.assertEqual(
            reply,
            "Memory recalled successfully.",
        )

        self.assertEqual(
            generate_content.call_count,
            3,
        )

        self.assertEqual(
            mocked_sleep.call_args_list,
            [call(1), call(2)],
        )

    def test_exhausted_retries_return_http_503(self):
        generate_content = Mock(
            side_effect=[
                FakeGeminiError(503)
                for _ in range(MAX_GEMINI_RETRIES + 1)
            ]
        )

        client = self.create_client(generate_content)

        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-only-key"},
            clear=True,
        ), patch(
            "app.main.genai.Client",
            return_value=client,
        ), patch(
            "app.gemini_retry.time.sleep"
        ) as mocked_sleep:

            with self.assertRaises(HTTPException) as raised:
                generate_with_gemini(
                    ChatRequest(message="Hello"),
                    "Hello",
                )

        self.assertEqual(
            raised.exception.status_code,
            503,
        )

        self.assertIn(
            "temporarily unavailable",
            raised.exception.detail,
        )

        self.assertEqual(
            generate_content.call_count,
            MAX_GEMINI_RETRIES + 1,
        )

        self.assertEqual(
            mocked_sleep.call_args_list,
            [call(1), call(2), call(4)],
        )

    def test_quota_error_is_not_retried(self):
        generate_content = Mock(
            side_effect=FakeGeminiError(
                429,
                "resource_exhausted quota exceeded",
            )
        )

        client = self.create_client(generate_content)

        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-only-key"},
            clear=True,
        ), patch(
            "app.main.genai.Client",
            return_value=client,
        ), patch(
            "app.gemini_retry.time.sleep"
        ) as mocked_sleep:

            with self.assertRaises(HTTPException) as raised:
                generate_with_gemini(
                    ChatRequest(message="Hello"),
                    "Hello",
                )

        self.assertEqual(
            raised.exception.status_code,
            429,
        )

        generate_content.assert_called_once()
        mocked_sleep.assert_not_called()

    def test_non_transient_error_is_not_retried(self):
        generate_content = Mock(
            side_effect=ValueError("invalid request")
        )

        client = self.create_client(generate_content)

        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-only-key"},
            clear=True,
        ), patch(
            "app.main.genai.Client",
            return_value=client,
        ), patch(
            "app.gemini_retry.time.sleep"
        ) as mocked_sleep:

            with self.assertRaises(HTTPException) as raised:
                generate_with_gemini(
                    ChatRequest(message="Hello"),
                    "Hello",
                )

        self.assertEqual(
            raised.exception.status_code,
            502,
        )

        generate_content.assert_called_once()
        mocked_sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
