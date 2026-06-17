from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Tic-Tac-Toe Server")

app.include_router(health.router, prefix="/api/v1", tags=["health"])
