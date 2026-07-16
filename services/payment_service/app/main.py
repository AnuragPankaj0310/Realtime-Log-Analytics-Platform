from fastapi import FastAPI

from . import routes
from .failure_middleware import FailureInjectionMiddleware

app = FastAPI(title="Payment Service", description="Handles payment events.", version="1.0.0")
app.include_router(routes.router)
app.add_middleware(FailureInjectionMiddleware)


@app.get("/")
def root():
    return {"service": "payment-service", "status": "running"}


@app.get("/payments/health")
def health():
    return {"service": "payment-service", "status": "healthy"}
