import random
import uuid
from datetime import datetime, timezone

from fastapi import Request


def generate_request_id() -> str:
    return str(uuid.uuid4())


def current_timestamp() -> datetime:
    return datetime.now(timezone.utc)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def random_response_time() -> int:
    return random.randint(15, 220)
