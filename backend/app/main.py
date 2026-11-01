
import json
import logging
import os
import socket
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request as URLRequest, urlopen

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("echo-api")

app = FastAPI(
    title="Echo Personal AI API",
    description="Secure API for Hunny Boxer personal AI assistant.",
    version="0.5.0",
)

# Frontend origins are configured through Render environment variables.
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer_scheme = HTTPBearer(auto_error=False)


# Echo's identity and shared capabilities.
ECHO_IDENTITY = """
You are Echo, a personal AI assistant designed and built by
Hunny Boxer, primarily for his own use.

YOUR PURPOSE:
Help Hunny's organize and manage his personal life, homes, labs,
technical work, and projects. The long-term vision is an intelligent
personal assistant with a distinct character, natural voice, animated
presence, useful tools, and carefully controlled access to systems.

YOUR IDENTITY:
- Your name is Echo.
- You are inspired by the idea of a capable personal assistant,
  but you have your own original identity.
- If asked who created you, say:
  "I'm Echo, a personal AI assistant designed and built by Hunny's primarily for his own use, with the goal of helping manage
  his homes, labs, and projects."
- Do not introduce yourself as ChatGPT.
- Do not volunteer your underlying AI provider when introducing
  yourself. If directly asked about your technical provider or model,
  answer truthfully and do not invent technical details.
- Refer to Hunny Boxer as your creator when appropriate.
- Be composed, intelligent, observant, articulate, and concise when
  the situation calls for it.
- Prefer useful answers, clear reasoning, practical plans, and
  thoughtful suggestions over generic chatbot language.
- Treat the user respectfully and preserve their ability to decide.

HONESTY ABOUT CAPABILITIES:
Echo is being developed to assist with homes, labs, and projects,
but not every planned capability is connected yet.
Never claim to have accessed a camera, microphone, sensor, computer,
private file, home device, lab system, account, or external service
unless an available, authorized tool actually performed that action.
Never claim to have changed a setting, executed a command, controlled
a device, saved information, or completed a task unless it succeeded.
When a capability is not connected, explain that plainly.
Do not invent monitoring data, device states, memories, or results.

PRIVACY AND SECURITY:
Treat credentials, personal information, private project details,
and home or lab information as sensitive.
Never ask the user to disclose passwords or secret API keys in chat.
Do not promise absolute confidentiality.
For sensitive or consequential actions, require proper authorization
and confirmation through the application's actual tools.
"""


PERSONA_INSTRUCTIONS = {
    "sage": ECHO_IDENTITY + """
PERSONALITY: SAGE
You are calm, thoughtful, perceptive, and composed.
Communicate with warmth and quiet confidence.
Help Hunny Boxer reflect, plan, understand problems, and make decisions.
Ask relevant questions when information is missing.
Be supportive without being overly sentimental.
""",
    "nova": ECHO_IDENTITY + """
PERSONALITY: NOVA
You are curious, creative, lively, and conversational.
Bring fresh ideas and explore possibilities with Hunny Boxer.
Use light humor when appropriate without compromising clarity,
professionalism, or good judgment.
""",
    "atlas": ECHO_IDENTITY + """
PERSONALITY: ATLAS
You are focused, capable, strategic, and grounded.
Help Antariksh organize projects, define goals, solve problems,
and turn plans into practical next steps.
Be encouraging but realistic, and never claim to have executed an
action unless an authorized tool actually completed it.
""",
}


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    persona: Literal["sage", "nova", "atlas"] = "sage"
    history: list[HistoryMessage] = Field(
        default_factory=list,
        max_length=12,
    )


class ChatResponse(BaseModel):
    reply: str
    persona: Literal["sage", "nova", "atlas"]


def current_ai_provider() -> str:
    """Return the configured AI backend. Gemini stays the safe default."""
    return os.getenv("ECHO_AI_PROVIDER", "gemini").strip().lower() or "gemini"


def get_firebase_admin_app():
    """Initialize Firebase Admin using a server-only service account."""
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    raw_service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if not raw_service_account:
        raise HTTPException(
            status_code=503,
            detail="Firebase authentication is not configured on the server.",
        )

    try:
        service_account_info = json.loads(raw_service_account)
        firebase_credential = credentials.Certificate(service_account_info)

        return firebase_admin.initialize_app(firebase_credential)

    except Exception as exc:
        logger.error(
            "Firebase Admin initialization failed: %s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=503,
            detail="Firebase authentication is not configured correctly.",
        ) from None


def require_firebase_user(
    credentials_header: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
) -> str:
    """Verify the Firebase ID token before allowing chat requests."""
    if (
        credentials_header is None
        or credentials_header.scheme.lower() != "bearer"
    ):
        raise HTTPException(
            status_code=401,
            detail="A valid Firebase sign-in is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded_token = firebase_auth.verify_id_token(
            credentials_header.credentials,
            app=get_firebase_admin_app(),
            check_revoked=True,
        )

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=401,
            detail=(
                "Your sign-in token is invalid or expired. "
                "Please sign in again."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    uid = decoded_token.get("uid")

    if not isinstance(uid, str) or not uid:
        raise HTTPException(
            status_code=401,
            detail="The sign-in token is invalid.",
        )

    return uid


def generate_with_ollama(request: ChatRequest, message: str) -> str:
    """Generate a reply with a local Ollama server. No API key is used."""
    base_url = os.getenv(
        "OLLAMA_BASE_URL",
        "http://127.0.0.1:11434",
    ).strip().rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen3:1.7b").strip()

    try:
        timeout_seconds = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
    except ValueError:
        timeout_seconds = 180.0

    timeout_seconds = min(max(timeout_seconds, 5.0), 600.0)

    messages = [
        {
            "role": "system",
            "content": PERSONA_INSTRUCTIONS[request.persona],
        }
    ]

    for item in request.history[-12:]:
        messages.append(
            {
                "role": item.role,
                "content": item.content,
            }
        )

    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "num_predict": 700,
            "temperature": 0.7,
        },
    }

    outgoing_request = URLRequest(
        f"{base_url}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(outgoing_request, timeout=timeout_seconds) as response:
            result = json.loads(response.read().decode("utf-8"))

    except HTTPError as exc:
        if exc.code == 404:
            logger.warning("Ollama model endpoint or model was not found")
            raise HTTPException(
                status_code=503,
                detail=(
                    f"The local model '{model}' is not available. "
                    f"Run 'ollama pull {model}' on the computer hosting Ollama."
                ),
            ) from None

        logger.warning("Ollama returned HTTP status %s", exc.code)
        raise HTTPException(
            status_code=502,
            detail="The local AI engine returned an error. Please try again.",
        ) from None

    except (URLError, socket.timeout, TimeoutError, ConnectionError):
        logger.warning("Local Ollama server could not be reached")
        raise HTTPException(
            status_code=503,
            detail=(
                "Echo's local AI engine is offline. Start Ollama and confirm "
                "that it is listening at OLLAMA_BASE_URL."
            ),
        ) from None

    except (json.JSONDecodeError, UnicodeDecodeError):
        logger.warning("Ollama returned an invalid JSON response")
        raise HTTPException(
            status_code=502,
            detail="The local AI engine returned an invalid response.",
        ) from None

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="The local AI engine returned an unexpected response.",
        )

    message_result = result.get("message")
    reply = (
        message_result.get("content", "")
        if isinstance(message_result, dict)
        else ""
    )

    if not isinstance(reply, str) or not reply.strip():
        raise HTTPException(
            status_code=502,
            detail="Echo could not generate a reply. Please try again.",
        )

    return reply.strip()


def generate_with_gemini(request: ChatRequest, message: str) -> str:
    """Generate a reply with Gemini using the existing server-side key."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Add GEMINI_API_KEY to the server.",
        )

    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()

    contents = []

    for item in request.history[-12:]:
        contents.append(
            types.Content(
                role="user" if item.role == "user" else "model",
                parts=[types.Part(text=item.content)],
            )
        )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=message)],
        )
    )

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=PERSONA_INSTRUCTIONS[request.persona],
                max_output_tokens=700,
            ),
        )

        reply = (response.text or "").strip()

        if not reply:
            raise HTTPException(
                status_code=502,
                detail="Echo could not generate a reply. Please try again.",
            )

        return reply

    except HTTPException:
        raise

    except Exception as exc:
        error_text = str(exc).lower()

        if any(
            marker in error_text
            for marker in (
                "429",
                "resource_exhausted",
                "rate limit",
                "quota exceeded",
                "quota_failure",
            )
        ):
            logger.warning("Gemini free-tier quota or rate limit reached")
            raise HTTPException(
                status_code=429,
                detail=(
                    "Gemini's current usage limit has been reached. "
                    "Please wait and try again, or check your Gemini API "
                    "quota in Google AI Studio."
                ),
            ) from None

        if any(
            marker in error_text
            for marker in (
                "api_key_invalid",
                "invalid api key",
                "unauthorized",
                "permission denied",
            )
        ):
            logger.warning(
                "Gemini authentication failed: %s",
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini rejected the API key. Check the GEMINI_API_KEY "
                    "environment variable in Render."
                ),
            ) from None

        logger.warning(
            "Gemini response request failed: %s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=502,
            detail="Echo could not generate a reply. Please try again.",
        ) from None


@app.get("/")
def root():
    return {
        "service": "Echo Personal AI API",
        "status": "online",
        "provider": current_ai_provider(),
        "health": "/health",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "echo-api",
        "provider": current_ai_provider(),
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    _user_uid: str = Depends(require_firebase_user),
):
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=422,
            detail="Please enter a message.",
        )

    provider = current_ai_provider()

    if provider == "gemini":
        reply = generate_with_gemini(request, message)
    elif provider == "ollama":
        reply = generate_with_ollama(request, message)
    else:
        logger.error("Unsupported AI provider configured: %s", provider)
        raise HTTPException(
            status_code=503,
            detail=(
                "Echo's AI provider is not configured correctly. "
                "Use ECHO_AI_PROVIDER=gemini or ECHO_AI_PROVIDER=ollama."
            ),
        )

    return ChatResponse(
        reply=reply,
        persona=request.persona,
    )
