from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import routes
from .config import settings
from .logger import configure_logging
from .producer import producer


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    producer.initialize()
    yield
    producer.close()


app = FastAPI(
    title="User Service",
    description="Handles user authentication and profile events.",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(routes.router)


@app.get("/")
def root():
    return {"service": "user-service", "status": "running"}


@app.get("/health")
def health():
    return {"service": "user-service", "status": "healthy", "debug": settings.debug}