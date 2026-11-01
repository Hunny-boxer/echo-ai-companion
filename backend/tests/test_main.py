
import json
import os
import unittest
from io import BytesIO
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from fastapi import HTTPException

from app.main import (
    ChatRequest,
    HistoryMessage,
    chat,
    current_ai_provider,
    generate_with_ollama,
)


class ProviderSelectionTests(unittest.TestCase):

    def test_provider_defaults_to_gemini(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(current_ai_provider(), "gemini")

    def test_provider_can_select_ollama(self):
        with patch.dict(
            os.environ,
            {"ECHO_AI_PROVIDER": " Ollama "},
            clear=True,
        ):
            self.assertEqual(current_ai_provider(), "ollama")

    def test_chat_dispatches_to_gemini(self):
        request = ChatRequest(message="Hello", persona="sage")

        with patch(
            "app.main.current_ai_provider",
            return_value="gemini",
        ), patch(
            "app.main.generate_with_gemini",
            return_value="Hello from Gemini",
        ) as gemini, patch(
            "app.main.generate_with_ollama"
        ) as ollama:
            response = chat(request, _user_uid="test-user")

        gemini.assert_called_once_with(request, "Hello")
        ollama.assert_not_called()

        self.assertEqual(response.reply, "Hello from Gemini")
        self.assertEqual(response.persona, "sage")

    def test_chat_dispatches_to_ollama(self):
        request = ChatRequest(message="Plan this", persona="atlas")

        with patch(
            "app.main.current_ai_provider",
            return_value="ollama",
        ), patch(
            "app.main.generate_with_gemini"
        ) as gemini, patch(
            "app.main.generate_with_ollama",
            return_value="Plan from local model",
        ) as ollama:
            response = chat(request, _user_uid="test-user")

        ollama.assert_called_once_with(request, "Plan this")
        gemini.assert_not_called()

        self.assertEqual(response.reply, "Plan from local model")
        self.assertEqual(response.persona, "atlas")

    def test_unknown_provider_fails_closed(self):
        request = ChatRequest(message="Hello")

        with patch(
            "app.main.current_ai_provider",
            return_value="unknown",
        ):
            with self.assertRaises(HTTPException) as raised:
                chat(request, _user_uid="test-user")

        self.assertEqual(raised.exception.status_code, 503)


class OllamaProviderTests(unittest.TestCase):

    def test_ollama_request_uses_model_and_chat_history(self):
        request = ChatRequest(
            message="Continue the plan",
            persona="nova",
            history=[
                HistoryMessage(
                    role="user",
                    content="I have an idea",
                )
            ],
        )

        response_body = {
            "message": {
                "content": "Let's explore it."
            }
        }

        fake_response = BytesIO(
            json.dumps(response_body).encode("utf-8")
        )

        with patch.dict(
            os.environ,
            {
                "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
                "OLLAMA_MODEL": "qwen3:1.7b",
                "OLLAMA_TIMEOUT_SECONDS": "30",
            },
            clear=True,
        ), patch(
            "app.main.urlopen",
            return_value=fake_response,
        ) as mocked_urlopen:
            reply = generate_with_ollama(
                request,
                "Continue the plan",
            )

        self.assertEqual(reply, "Let's explore it.")

        outgoing_request = mocked_urlopen.call_args.args[0]

        self.assertEqual(
            outgoing_request.full_url,
            "http://127.0.0.1:11434/api/chat",
        )

        payload = json.loads(
            outgoing_request.data.decode("utf-8")
        )

        self.assertEqual(payload["model"], "qwen3:1.7b")
        self.assertFalse(payload["stream"])

        self.assertEqual(
            payload["messages"][0]["role"],
            "system",
        )

        self.assertIn(
            "PERSONALITY: NOVA",
            payload["messages"][0]["content"],
        )

        self.assertEqual(
            payload["messages"][1],
            {"role": "user", "content": "I have an idea"},
        )

        self.assertEqual(
            payload["messages"][2],
            {
                "role": "user",
                "content": "Continue the plan",
            },
        )

    def test_missing_ollama_model_returns_503(self):
        missing_model = HTTPError(
            "http://127.0.0.1:11434/api/chat",
            404,
            "Not Found",
            None,
            None,
        )

        request = ChatRequest(message="Hello")

        with patch(
            "app.main.urlopen",
            side_effect=missing_model,
        ):
            with self.assertRaises(HTTPException) as raised:
                generate_with_ollama(request, "Hello")

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("ollama pull", raised.exception.detail)

    def test_unreachable_ollama_returns_503(self):
        request = ChatRequest(message="Hello")

        with patch(
            "app.main.urlopen",
            side_effect=URLError("connection refused"),
        ):
            with self.assertRaises(HTTPException) as raised:
                generate_with_ollama(request, "Hello")

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("offline", raised.exception.detail)

    def test_invalid_ollama_json_returns_502(self):
        request = ChatRequest(message="Hello")
        fake_response = BytesIO(b"not-json")

        with patch(
            "app.main.urlopen",
            return_value=fake_response,
        ):
            with self.assertRaises(HTTPException) as raised:
                generate_with_ollama(request, "Hello")

        self.assertEqual(raised.exception.status_code, 502)

    def test_empty_ollama_reply_returns_502(self):
        request = ChatRequest(message="Hello")

        fake_response = BytesIO(
            b'{"message":{"content":"  "}}'
        )

        with patch(
            "app.main.urlopen",
            return_value=fake_response,
        ):
            with self.assertRaises(HTTPException) as raised:
                generate_with_ollama(request, "Hello")

        self.assertEqual(raised.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
