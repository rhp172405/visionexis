from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import models
import database
from auth import authenticate_websocket

router = APIRouter(prefix="/gaze-stream", tags=["gaze"])

VALID_EVENT_TYPES = {"raw", "fixation", "saccade"}


@router.websocket("/{session_id}")
async def gaze_stream(websocket: WebSocket, session_id: str):
    # 1. Verify target session exists before accepting connection
    db = database.SessionLocal()
    session = None
    try:
        session = db.get(models.TaskSession, session_id)
        session_patient_id = session.patient_id if session else None
    finally:
        db.close()

    if not session:
        # Rejection: session does not exist (Policy Violation)
        await websocket.close(code=1008)
        return

    # 2. Authenticate and authorize connection (via query param token or headers)
    is_allowed, auth_ctx = authenticate_websocket(websocket, session_id, session_patient_id)
    if not is_allowed:
        # Rejection: unauthenticated or unauthorized for this session
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            points = data.get("points") or []
            if not points:
                continue

            db = database.SessionLocal()
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
