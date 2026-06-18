from fastapi import APIRouter, HTTPException
import random
import string

router = APIRouter()

rooms: dict[str, dict] = {}


def generate_code() -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        if code not in rooms:
            return code


@router.post("/rooms")
async def create_room():
    code = generate_code()
    rooms[code] = {"players": []}
    return {"room_code": code}


@router.get("/rooms/{code}")
async def get_room(code: str):
    room = rooms.get(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room_code": code, "players": room["players"]}


@router.delete("/rooms/{code}")
async def delete_room(code: str):
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    del rooms[code]
    return {"ok": True}
