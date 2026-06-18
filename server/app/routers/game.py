from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

rooms: dict[str, dict] = {}


@router.websocket("/ws/{room_code}")
async def game_websocket(websocket: WebSocket, room_code: str):
    await websocket.accept()

    try:
        data = await websocket.receive_json()
    except WebSocketDisconnect:
        return

    msg_type = data.get("type")

    if msg_type not in ("join", "continue"):
        try:
            await websocket.close()
        except Exception:
            pass
        return

    player_name = data.get("name", "Player")
    saved_state = data.get("state") if msg_type == "continue" else None

    if room_code not in rooms:
        rooms[room_code] = {"connections": {}, "state": None}

    room = rooms[room_code]

    if saved_state:
        room["state"] = saved_state

    if "X" not in room["connections"]:
        symbol = "X"
    elif "O" not in room["connections"]:
        symbol = "O"
    else:
        await websocket.send_json({"type": "error", "message": "Room full"})
        await websocket.close()
        return

    room["connections"][symbol] = {"ws": websocket, "name": player_name}
    await websocket.send_json({"type": "assigned", "symbol": symbol})

    if len(room["connections"]) == 2:
        for sym, conn in room["connections"].items():
            opp = "O" if sym == "X" else "X"
            await conn["ws"].send_json({
                "type": "opponent_joined",
                "name": room["connections"][opp]["name"],
            })

        for sym, conn in room["connections"].items():
            opp = "O" if sym == "X" else "X"
            opp_name = room["connections"][opp]["name"]
            payload = {
                "type": "game_start",
                "symbol": sym,
                "opponent": opp_name,
            }
            if room.get("state"):
                payload["state"] = room["state"]
            await conn["ws"].send_json(payload)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "move":
                for sym, conn in room["connections"].items():
                    if conn["ws"] != websocket:
                        await conn["ws"].send_json(data)

            elif msg_type == "save_game":
                for sym, conn in room["connections"].items():
                    try:
                        await conn["ws"].send_json({"type": "save_game"})
                    except Exception:
                        pass

    except WebSocketDisconnect:
        for sym, conn in list(room["connections"].items()):
            if conn["ws"] == websocket:
                del room["connections"][sym]
                break

        for sym, conn in room["connections"].items():
            try:
                await conn["ws"].send_json({"type": "opponent_disconnected"})
            except Exception:
                pass

        if not room["connections"]:
            rooms.pop(room_code, None)
