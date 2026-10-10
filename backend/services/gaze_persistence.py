import json
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

import models


def extract_gaze_events(
    task_type: str,
    scan_path_json: str | None,
    comparison_json: str | None,
) -> Tuple[List[dict], List[dict]]:
    """
    Extracts raw gaze points and fixation events from scan_path_json and comparison_json.
    Returns (raw_events, fixation_events).
    Preserves exact recorded timestamps, coordinates, and durations.
    """
    raw_events: List[dict] = []
    fixation_events: List[dict] = []

    # 1. Parse raw gaze points from scan_path_json
    if scan_path_json:
        try:
            samples = json.loads(scan_path_json)
            if isinstance(samples, list):
                for s in samples:
                    if isinstance(s, dict):
                        t = float(s.get("t") if s.get("t") is not None else s.get("timestamp") or 0.0)
                        x = float(s.get("x") if s.get("x") is not None else s.get("gazeX") or 0.0)
                        y = float(s.get("y") if s.get("y") is not None else s.get("gazeY") or 0.0)
                        raw_events.append({
                            "timestamp": t,
                            "x": x,
                            "y": y,
                            "event_type": "raw",
                            "duration_ms": None,
                        })
        except Exception as e:
            pass

    # 2. Parse fixation events from comparison_json
    if comparison_json:
        try:
            comp = json.loads(comparison_json)
            if isinstance(comp, dict):
                raw_fix_list: List[dict] = []
                if task_type == "visual_search":
                    trials = comp.get("trials") or comp.get("allCompletedTrials") or []
                    for t in trials:
                        if isinstance(t, dict):
                            raw_fix_list.extend(t.get("fixations", []))
                    if not raw_fix_list and isinstance(comp.get("fixations"), list):
                        raw_fix_list.extend(comp.get("fixations", []))
                elif task_type == "memory":
                    studies = comp.get("studyTrials") or comp.get("studies") or []
                    recs = comp.get("recognitionTrials") or comp.get("recognitions") or []
                    for t in studies:
                        if isinstance(t, dict):
                            raw_fix_list.extend(t.get("fixations", []))
                    for t in recs:
                        if isinstance(t, dict):
                            raw_fix_list.extend(t.get("fixations", []))
                    if not raw_fix_list and isinstance(comp.get("fixations"), list):
                        raw_fix_list.extend(comp.get("fixations", []))
                elif task_type == "reading":
                    reading_fix = comp.get("fixations") or comp.get("readingFixations") or []
                    raw_fix_list.extend(reading_fix)

                for f in raw_fix_list:
                    if isinstance(f, dict):
                        t = float(f.get("startTime") if f.get("startTime") is not None else f.get("fixationStart") or 0.0)
                        x = float(f.get("meanX") if f.get("meanX") is not None else f.get("x") or 0.0)
                        y = float(f.get("meanY") if f.get("meanY") is not None else f.get("y") or 0.0)
                        dur = float(f.get("duration") or 0.0)
                        fixation_events.append({
                            "timestamp": t,
                            "x": x,
                            "y": y,
                            "event_type": "fixation",
                            "duration_ms": dur if dur > 0 else None,
                        })
        except Exception:
            pass

    return raw_events, fixation_events


def persist_session_gaze_events(
    db: Session,
    session_id: str,
    task_type: str,
    scan_path_json: str | None,
    comparison_json: str | None,
) -> int:
    """
    Inserts extracted raw gaze samples and fixation events into the gaze_events table.
    Deletes any preexisting events for this session first to maintain idempotency.
    Returns the total number of inserted events.
    """
    raw_events, fixations = extract_gaze_events(task_type, scan_path_json, comparison_json)
    all_events_data = raw_events + fixations

    if not all_events_data:
        return 0

    # Remove existing events for this session to prevent duplication
    db.query(models.GazeEvent).filter(models.GazeEvent.session_id == session_id).delete()

    event_objs = [
        models.GazeEvent(
            session_id=session_id,
            timestamp=ev["timestamp"],
            x=ev["x"],
            y=ev["y"],
            event_type=ev["event_type"],
            duration_ms=ev["duration_ms"],
        )
        for ev in all_events_data
    ]

    db.add_all(event_objs)
    db.commit()
    return len(event_objs)


def backfill_all_sessions(db: Session) -> int:
    """
    Backfills gaze_events for any completed sessions that have task results
    but no records in gaze_events.
    """
    completed_sessions = (
        db.query(models.TaskSession)
        .join(models.TaskResult, models.TaskSession.id == models.TaskResult.session_id)
        .filter(models.TaskSession.status == "completed")
        .all()
    )

    total_backfilled = 0
    for sess in completed_sessions:
        existing_count = (
            db.query(func.count(models.GazeEvent.id))
            .filter(models.GazeEvent.session_id == sess.id)
            .scalar() or 0
        )
        if existing_count == 0 and sess.result:
            count = persist_session_gaze_events(
                db=db,
                session_id=sess.id,
                task_type=sess.task_type,
                scan_path_json=sess.result.scan_path_json,
                comparison_json=sess.result.comparison_json,
            )
            total_backfilled += count

    return total_backfilled
