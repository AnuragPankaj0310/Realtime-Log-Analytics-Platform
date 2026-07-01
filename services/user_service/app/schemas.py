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
    status: str = "success"
    response_time_ms: int = 0
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)