
import logging
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("echo-api")

MAX_GEMINI_RETRIES = 3

RETRYABLE_STATUS_CODES = {500, 502, 503, 504}


def _get_status_code(error: Exception) -> int | None:
    """Extract an HTTP status code from a Gemini SDK exception."""
    response = getattr(error, "response", None)

    candidates = (
        getattr(error, "code", None),
        getattr(error, "status_code", None),
        getattr(response, "status_code", None),
    )

    for candidate in candidates:
        if candidate is None or isinstance(candidate, bool):
            continue

        try:
            return int(candidate)
        except (TypeError, ValueError):
            continue

    return None


def is_retryable_gemini_error(error: Exception) -> bool:
    """Identify temporary upstream Gemini server failures."""
    status_code = _get_status_code(error)

    if status_code is not None:
        return status_code in RETRYABLE_STATUS_CODES

    error_name = type(error).__name__.casefold()
    error_text = str(error).casefold()

    transient_markers = (
        "servererror",
        "internalservererror",
        "serviceunavailable",
        "deadlineexceeded",
        "temporarily unavailable",
        "service unavailable",
        "bad gateway",
        "gateway timeout",
        "internal server error",
        "unavailable",
    )

    return any(
        marker in error_name or marker in error_text
        for marker in transient_markers
    )


def generate_content_with_retries(
    generate_content: Callable[..., Any],
    **kwargs: Any,
) -> Any:
    """
    Retry temporary Gemini server failures.

    Three retries are allowed after the initial request.
    Delays: 1 second, 2 seconds, and 4 seconds.

    Quota, authentication, and other non-transient errors
    are immediately returned to the caller.
    """
    for retry_index in range(MAX_GEMINI_RETRIES + 1):
        try:
            return generate_content(**kwargs)

        except Exception as error:
            if (
                not is_retryable_gemini_error(error)
                or retry_index >= MAX_GEMINI_RETRIES
            ):
                raise

            delay_seconds = min(2 ** retry_index, 4)
            status_code = _get_status_code(error)

            logger.warning(
                "Gemini temporary server failure (%s). "
                "Retry %d/%d in %d second(s).",
                (
                    status_code
                    if status_code is not None
                    else type(error).__name__
                ),
                retry_index + 1,
                MAX_GEMINI_RETRIES,
                delay_seconds,
            )

            time.sleep(delay_seconds)

    raise RuntimeError("Gemini retry loop ended unexpectedly.")
