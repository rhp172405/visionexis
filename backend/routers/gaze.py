from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import models
from database import SessionLocal

router = APIRouter(prefix="/gaze-stream", tags=["gaze"])

VALID_EVENT_TYPES = {"raw", "fixation", "saccade"}


@router.websocket("/{session_id}")
async def gaze_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            points = data.get("points") or []
            if not points:
                continue

            db = SessionLocal()
            try:
                for point in points:
                    event_type = point.get("event_type", "raw")
                    if event_type not in VALID_EVENT_TYPES:
                        continue
                    db.add(models.GazeEvent(
                        session_id=session_id,
                        timestamp=point.get("t", 0),
                        x=point.get("x", 0),
                        y=point.get("y", 0),
                        event_type=event_type,
                        duration_ms=point.get("duration_ms"),
                    ))
                db.commit()
            finally:
                db.close()
    except WebSocketDisconnect:
        pass
