from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from . import routes
from .config import settings
from .logger import configure_logging
from .producer import producer
from .http_client import http_client
from .schemas import LoginRequest, SignupRequest
from .routes import (
    login as login_handler,
    logout as logout_handler,
    profile as profile_handler,
    signup as signup_handler,
)
from .failure_middleware import FailureInjectionMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    producer.initialize()
    http_client.initialize()
    app.state.client = http_client
    yield
    await http_client.aclose()
    producer.close()


app = FastAPI(
    title="User Service",
    description="Handles user authentication and profile events.",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(routes.router)
app.add_middleware(FailureInjectionMiddleware)


@app.get("/")
def root():
    return {"service": "user-service", "status": "running"}


@app.post("/login")
async def login(payload: LoginRequest, request: Request):
    return await login_handler(payload, request)


@app.post("/signup")
async def signup(payload: SignupRequest, request: Request):
    return await signup_handler(payload, request)


@app.post("/logout")
async def logout(request: Request):
    return await logout_handler(request)


@app.post("/profile")
async def profile(request: Request):
    return await profile_handler(request)


@app.get("/health")
def health():
    return {"service": "user-service", "status": "healthy", "debug": settings.debug}


@app.get("/users/health")
def users_health():
    return {"service": "user-service", "status": "healthy", "debug": settings.debug}
