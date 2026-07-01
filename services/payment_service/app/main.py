from fastapi import FastAPI

from . import routes

app = FastAPI(title="Payment Service", description="Handles payment events.", version="1.0.0")
app.include_router(routes.router)


@app.get("/")
def root():
    return {"service": "payment-service", "status": "running"}


@app.get("/health")
def health():
    return {"service": "payment-service", "status": "healthy"}
