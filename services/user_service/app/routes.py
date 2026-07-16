import base64
import hashlib
import os
import secrets
from time import perf_counter

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .producer import producer
from .schemas import LogEvent, LoginRequest, SignupRequest
from .utils import current_timestamp, generate_request_id, get_client_ip

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

users = {}


def publish_event(event: LogEvent) -> bool:
    producer.publish_event(event)
    return True


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return base64.b64encode(salt + digest).decode("utf-8")


def _verify_password(password: str, hashed_password: str) -> bool:
    try:
        payload = base64.b64decode(hashed_password.encode("utf-8"))
    except Exception:
        return False

    if len(payload) < 48:
        return False

    salt, expected_digest = payload[:16], payload[16:]
    actual_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return secrets.compare_digest(actual_digest, expected_digest)


if "user@example.com" not in users:
    users["user@example.com"] = {
        "email": "user@example.com",
        "name": "Demo User",
        "status": "active",
        "password": _hash_password("secret"),
    }


def _emit_event(request: Request, event_name: str, status_code: int, response_time_ms: int, user_id: str | None = None, trace_id: str | None = None, request_payload: str | None = None) -> None:
    if not trace_id:
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
    span_id = str(uuid.uuid4())
    parent_span_id = request.headers.get("x-span-id")
    correlation_id = request.headers.get("x-correlation-id") or trace_id
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    
    event = LogEvent(
        event=event_name,
        operation=event_name,
        endpoint=request.url.path,
        method=request.method,
        user_id=user_id,
        trace_id=trace_id,
        span_id=span_id,
        parent_span_id=parent_span_id,
        request_id=req_id,
        status="success" if status_code < 400 else "error",
        status_code=status_code,
        response_time_ms=response_time_ms,
        ip_address=get_client_ip(request),
        hostname=os.environ.get("HOSTNAME", "unknown"),
        pod=os.environ.get("HOSTNAME", "unknown"),
        container="user-service",
        user_agent=request.headers.get("user-agent"),
        headers=dict(request.headers),
        request_payload=request_payload,
        correlation_id=correlation_id,
        message=f"Handled {event_name}",
        timestamp=current_timestamp(),
    )
    publish_event(event)


@router.post("/login")
async def login(payload: LoginRequest, request: Request):
    started_at = perf_counter()
    status_code = 500

    try:
        stored_user = users.get(payload.email)
        if stored_user is None or not _verify_password(payload.password, stored_user["password"]):
            status_code = 401
            return JSONResponse(
                status_code=status_code,
                content={"detail": "Invalid email or password"},
            )

        status_code = 200
        return {
            "status": "success",
            "message": "Login successful",
            "request_id": generate_request_id(),
        }
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    finally:
        _emit_event(
            request,
            "login",
            status_code,
            int((perf_counter() - started_at) * 1000),
            payload.email,
            None,
            payload.model_dump_json(exclude={"password"})
        )


@router.post("/signup")
async def signup(payload: SignupRequest, request: Request):
    started_at = perf_counter()
    status_code = 500

    try:
        users[payload.email] = {
            "email": payload.email,
            "name": payload.name,
            "status": "active",
            "password": _hash_password(payload.password),
        }
        status_code = 200
        return {
            "status": "success",
            "message": "Signup successful",
            "request_id": generate_request_id(),
            "user": {
                "email": payload.email,
                "name": payload.name,
                "status": "active",
            },
        }
    except Exception:
        raise
    finally:
        _emit_event(
            request,
            "signup",
            status_code,
            int((perf_counter() - started_at) * 1000),
            payload.email,
            None,
            payload.model_dump_json(exclude={"password"})
        )


@router.post("/logout")
async def logout(request: Request):
    started_at = perf_counter()
    try:
        return {"status": "success", "message": "Logout successful", "request_id": generate_request_id()}
    finally:
        _emit_event(request, "logout", 200, int((perf_counter() - started_at) * 1000))


@router.post("/profile")
async def profile(request: Request):
    started_at = perf_counter()
    try:
        return {"status": "success", "message": "Profile fetched", "request_id": generate_request_id()}
    finally:
        _emit_event(request, "profile", 200, int((perf_counter() - started_at) * 1000))


@router.get("/health")
async def health():
    return {
        "service": "user-service",
        "status": "healthy",
    }


@router.get("/{email}")
async def get_user(email: str):
    user = users.get(email)

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Never leak password hashes in API responses
    return {k: v for k, v in user.items() if k != "password"}

import asyncio
import httpx
import uuid
from pydantic import BaseModel

class CheckoutRequest(BaseModel):
    user_id: str
    amount: float

# Protect downstreams with a concurrency limit
checkout_semaphore = asyncio.Semaphore(200)

@router.post("/checkout")
async def checkout(payload: CheckoutRequest, request: Request):
    started_at = perf_counter()
    status_code = 500
    trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
    
    try:
        async with checkout_semaphore:
            order_payload = {
                "order_id": str(uuid.uuid4()),
                "customer_id": payload.user_id,
                "amount": payload.amount
            }
            span_id = str(uuid.uuid4())
            correlation_id = request.headers.get("x-correlation-id") or trace_id
            
            client = request.app.state.client
            resp = await client.post(
                "http://order-service:8000/orders",
                json=order_payload,
                headers={
                    "X-Trace-ID": trace_id,
                    "X-Span-ID": span_id,
                    "X-Correlation-ID": correlation_id
                }
            )
            resp.raise_for_status()
            status_code = resp.status_code
            return resp.json()
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        return JSONResponse(status_code=status_code, content={"detail": f"Order service returned {status_code}"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": str(exc)})
    finally:
        _emit_event(request, "checkout", status_code, int((perf_counter() - started_at) * 1000), payload.user_id, trace_id, payload.model_dump_json())