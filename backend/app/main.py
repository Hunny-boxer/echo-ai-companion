import json
import logging
import os
from typing import Literal

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("echo-api")

app = FastAPI(
    title="Echo AI Companion API",
    description="Authenticated API for Echo conversations.",
    version="0.1.0",
)

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


PERSONA_INSTRUCTIONS = {
    "sage": (
        "You are Sage, a calm, thoughtful AI companion. "
        "Listen carefully, respond warmly, ask useful questions, "
        "and help the user reflect without being judgmental. "
        "Be honest that you are an AI, respect user autonomy, "
        "and never promise absolute confidentiality."
    ),
    "nova": (
        "You are Nova, a playful, curious AI companion. "
        "Be upbeat, creative, engaging, and conversational while "
        "remaining respectful, honest, and attentive to the user's needs. "
        "Be clear that you are an AI and respect user autonomy."
    ),
    "atlas": (
        "You are Atlas, a motivating, grounded AI companion. "
        "Help the user clarify goals, break challenges into manageable "
        "steps, and build realistic momentum. Be encouraging without "
        "shaming or pressuring them. Be honest that you are an AI."
    ),
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


def get_firebase_admin_app():
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
            detail="Your sign-in token is invalid or expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    uid = decoded_token.get("uid")

    if not isinstance(uid, str) or not uid:
        raise HTTPException(
            status_code=401,
            detail="The sign-in token is invalid.",
        )

    return uid


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "echo-api",
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

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="The AI service is not configured on the server yet.",
        )

    conversation_input = [
        {
            "role": item.role,
            "content": item.content,
        }
        for item in request.history
    ]
    conversation_input.append(
        {
            "role": "user",
            "content": message,
        }
    )

    model = os.getenv("OPENAI_MODEL", "gpt-6-luna")

    try:
        client = OpenAI(api_key=api_key)

        response = client.responses.create(
            model=model,
            instructions=PERSONA_INSTRUCTIONS[request.persona],
            input=conversation_input,
            max_output_tokens=500,
        )

        reply = (response.output_text or "").strip()

        if not reply:
            raise HTTPException(
                status_code=502,
                detail="Echo could not generate a reply. Please try again.",
            )

        return ChatResponse(
            reply=reply,
            persona=request.persona,
        )

    except HTTPException:
        raise
    except OpenAIError as exc:
        logger.warning(
            "OpenAI request failed: %s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=502,
            detail="Echo could not reach the AI service. Please try again.",
        ) from None
    except Exception:
        logger.exception("Unexpected error while generating a reply")
        raise HTTPException(
            status_code=502,
            detail="Echo encountered an unexpected error. Please try again.",
        ) from None
