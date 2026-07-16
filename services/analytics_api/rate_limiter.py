from fastapi import HTTPException, Request

from .redis_client import redis_client  # relative — consistent with rest of package

RATE_LIMIT = 200  # requests per window per IP — a real enforcing value
WINDOW = 60  # seconds


async def rate_limit(request: Request):
    client_ip = request.client.host
    key = f"rate:{client_ip}"

    current = redis_client.incr(key)

    if current == 1:
        redis_client.expire(key, WINDOW)

    if current > RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again in a minute.",
        )
