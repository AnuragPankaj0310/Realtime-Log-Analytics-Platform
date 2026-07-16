from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    status: str = "active"


class LogEvent(BaseModel):
    service: str = Field(default="user-service")
    event: str
    endpoint: str
    method: str
    user_id: Optional[str] = None
    trace_id: str | None = None
    span_id: str | None = None
    parent_span_id: str | None = None
    correlation_id: str | None = None
    request_id: str | None = None
    operation: str | None = None
    status: str = "success"
    status_code: int = 200
    response_time_ms: int = 0
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    pod: Optional[str] = None
    container: Optional[str] = None
    user_agent: Optional[str] = None
    headers: Optional[dict] = None
    request_payload: Optional[str] = None
    response_payload: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)