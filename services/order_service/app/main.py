from contextlib import asynccontextmanager
from fastapi import FastAPI

from . import routes
from .failure_middleware import FailureInjectionMiddleware
from .producer import producer
from .http_client import http_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    producer.initialize()
    http_client.initialize()
    app.state.client = http_client
    yield
    await http_client.aclose()
    producer.close()

app = FastAPI(
    title="Order Service",
    description="Handles order events.",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(routes.router)
app.add_middleware(FailureInjectionMiddleware)


@app.get("/")
def root():
    return {"service": "order-service", "status": "running"}


@app.get("/orders/health")
def health():
    return {"service": "order-service", "status": "healthy"}
