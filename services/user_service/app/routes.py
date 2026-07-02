from fastapi import APIRouter, Request

from .schemas import LogEvent, LoginRequest, SignupRequest
from .producer import producer
from .utils import current_timestamp, generate_request_id, get_client_ip, random_response_time

router = APIRouter()


def publish_event(event: LogEvent) -> bool:
    producer.publish_event(event)
    return True


@router.post("/login")
async def login(payload: LoginRequest, request: Request):
    event = LogEvent(
        event="login",
        endpoint="/login",
        method=request.method,
        user_id=payload.email,
        response_time_ms=random_response_time(),
        ip_address=get_client_ip(request),
        timestamp=current_timestamp(),
    )
    producer.publish_event(event)
    return {"status": "success", "message": "Login successful", "request_id": generate_request_id()}


@router.post("/signup")
async def signup(payload: SignupRequest, request: Request):
    event = LogEvent(
        event="signup",
        endpoint="/signup",
        method=request.method,
        user_id=payload.email,
        response_time_ms=random_response_time(),
        ip_address=get_client_ip(request),
        timestamp=current_timestamp(),
    )
    producer.publish_event(event)
    return {"status": "success", "message": "Signup successful", "request_id": generate_request_id()}


@router.post("/logout")
async def logout(request: Request):
    event = LogEvent(
        event="logout",
        endpoint="/logout",
        method=request.method,
        response_time_ms=random_response_time(),
        ip_address=get_client_ip(request),
        timestamp=current_timestamp(),
    )
    producer.publish_event(event)
    return {"status": "success", "message": "Logout successful", "request_id": generate_request_id()}


@router.post("/profile")
async def profile(request: Request):
    event = LogEvent(
        event="profile",
        endpoint="/profile",
        method=request.method,
        response_time_ms=random_response_time(),
        ip_address=get_client_ip(request),
        timestamp=current_timestamp(),
    )
    producer.publish_event(event)
    return {"status": "success", "message": "Profile fetched", "request_id": generate_request_id()}