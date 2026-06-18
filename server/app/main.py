from fastapi import FastAPI

from app.routers import health, rooms

app = FastAPI(title="Tic-Tac-Toe Server")

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(rooms.router, prefix="/api/v1", tags=["rooms"])
