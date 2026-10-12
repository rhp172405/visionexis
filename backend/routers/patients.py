from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth import get_current_auth, require_operator, enforce_patient_access, AuthContext

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _next_patient_code(db: Session) -> str:
    existing_codes = {code for (code,) in db.query(models.Patient.patient_code).all()}
    num = 1
    while f"P-{num:03d}" in existing_codes:
        num += 1
    return f"P-{num:03d}"


@router.post("", response_model=schemas.PatientRead, status_code=201)
def create_patient(
    payload: schemas.PatientCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    require_operator(auth)
    try:
        code = payload.patient_code.strip() if payload.patient_code and payload.patient_code.strip() else _next_patient_code(db)
        
        # Check if code already exists
        existing = db.query(models.Patient).filter(models.Patient.patient_code == code).first()
        if existing:
            if payload.patient_code:
                raise HTTPException(status_code=400, detail=f"Patient ID {code} already exists.")
            code = _next_patient_code(db)

        patient = models.Patient(
            patient_code=code,
            name=payload.name.strip(),
            age=payload.age,
            gender=payload.gender,
            visual_diagnosis=payload.visual_diagnosis,
        )
        db.add(patient)
        db.flush()

        if payload.visual_history:
            v_data = payload.visual_history.model_dump()
            if any(v is not None and v != [] for v in v_data.values()):
                db.add(models.VisualHistory(
                    patient_id=patient.id,
                    **v_data,
                ))

        if payload.clinical_findings:
            c_data = payload.clinical_findings.model_dump()
            if any(v is not None for v in c_data.values()):
                db.add(models.ClinicalFindings(
                    patient_id=patient.id,
                    **c_data,
                ))

        db.commit()
        db.refresh(patient)
        return patient
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create patient record due to internal error.")


@router.get("", response_model=list[schemas.PatientSummary])
def list_patients(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    require_operator(auth)
    return (
        db.query(models.Patient)
        .order_by(models.Patient.created_at.desc())
        .all()
    )


@router.get("/{patient_id}", response_model=schemas.PatientRead)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    enforce_patient_access(auth, patient_id)
    patient = db.get(models.Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
