import json
import asyncio
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import redis.asyncio as aioredis
from .config import settings
import os
import random


class FailureInjectionMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        redis_host = os.getenv("REDIS_HOST", "redis")
        redis_port = os.getenv("REDIS_PORT", "6379")
        self.redis = aioredis.Redis(
            host=redis_host, port=redis_port, decode_responses=True
        )

    async def dispatch(self, request: Request, call_next):
        try:
            config_str = await self.redis.get(f"failure_config:{settings.service_name}")
            if config_str:
                config = json.loads(config_str)
                if config.get("drop_requests"):
                    return JSONResponse(
                        status_code=500,
                        content={"detail": "Request dropped by failure injection"},
                    )

                delay = config.get("delay_ms", 0)
                if delay > 0:
                    await asyncio.sleep(delay / 1000.0)

                if random.random() < config.get("error_rate", 0):
                    return JSONResponse(
                        status_code=500,
                        content={"detail": "Internal Server Error (Injected)"},
                    )
        except Exception:
            pass
        return await call_next(request)
