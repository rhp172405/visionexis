from datetime import datetime, timedelta

from sqlalchemy.orm import Session

import models

# (name, age, gender, task_type, accuracy_pct, rt_ms)
SAMPLE_SESSIONS = [
    ("Aanya Sharma", 24, "Female", "visual_search", 94, 3200),
    ("Rohan Verma", 31, "Male", "reading", 72, 6100),
    ("Meera Iyer", 19, "Female", "memory", 88, 4400),
    ("Karan Patel", 45, "Male", "visual_search", 61, 8700),
    ("Sneha Reddy", 28, "Female", "reading", 79, 5500),
    ("Arjun Nair", 37, "Male", "memory", 66, 7200),
    ("Priya Menon", 22, "Female", "visual_search", 91, 3500),
    ("Vikram Rao", 52, "Male", "reading", 83, 5000),
    ("Aanya Sharma", 24, "Female", "memory", 95, 2800),
    ("Meera Iyer", 19, "Female", "visual_search", 68, 6800),
    ("Sneha Reddy", 28, "Female", "visual_search", 89, 3700),
    ("Priya Menon", 22, "Female", "reading", 92, 4100),
]


def seed_if_empty(db: Session) -> None:
    if db.query(models.Patient).first() is not None:
        return

    patient_by_name: dict[str, models.Patient] = {}
    now = datetime.utcnow()

    for index, (name, age, gender, task_type, accuracy, rt_ms) in enumerate(SAMPLE_SESSIONS, start=1):
        patient = patient_by_name.get(name)
        if patient is None:
            patient = models.Patient(
                patient_code=f"P-{len(patient_by_name) + 1:03d}",
                name=name,
                age=age,
                gender=gender,
            )
            db.add(patient)
            db.flush()
            patient_by_name[name] = patient

        started_at = now - timedelta(minutes=(len(SAMPLE_SESSIONS) - index) * 7)
        session = models.TaskSession(
            patient_id=patient.id,
            task_type=task_type,
            status="completed",
            started_at=started_at,
            ended_at=started_at + timedelta(milliseconds=rt_ms),
        )
        db.add(session)
        db.flush()

        db.add(models.TaskResult(
            session_id=session.id,
            accuracy_pct=accuracy,
            rt_ms=rt_ms,
            scan_path_json="[]",
        ))

    db.commit()
