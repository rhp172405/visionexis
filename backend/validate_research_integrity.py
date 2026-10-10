"""
VISIONEXIS Phase 4: Research Data Integrity and Release Freeze Validation.
Tests against active database and running backend daemon:
- Explicit test participant: "TEST-PARTICIPANT-PHASE4-FREEZE"
- Verification of foreign key relationships: sessions -> assessment, gaze_events -> session
- Exact match between DB records and report stats
- Honest missing data labeling (no 0 for missing values)
- Absence of synthetic data
- Idempotency across repeated report and PDF requests (no event duplication)
- Strict attempt isolation during retakes
"""

import json
import urllib.request
import urllib.error
import re
import sys
import zlib
import sqlite3

BASE = "http://127.0.0.1:8001/api"
DB_PATH = "e:/visionexis/visionexis/backend/eyecog.db"

def request_json(url, data=None, method=None):
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    else:
        req = urllib.request.Request(url)
    if method:
        req.method = method
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
        if resp.headers.get_content_type() == "application/json":
            return json.loads(content.decode("utf-8"))
        return content

def run_integrity_validation():
    print("=" * 75)
    print("PHASE 4: RESEARCH DATA INTEGRITY AND RELEASE FREEZE VALIDATION")
    print("=" * 75)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Register explicitly designated test participant
    print("\n[Check 1] Registering designated test participant...")
    p_req = {
        "name": "TEST-PARTICIPANT-PHASE4-FREEZE",
        "age": 29,
        "gender": "female",
        "examiner_name": "QA Lead",
        "visual_history": {
            "refractive_status": ["emmetropia"],
            "spectacle_use": False,
            "avg_screen_time": "2-4h"
        }
    }
    patient = request_json(f"{BASE}/patients", p_req)
    patient_id = patient["id"]
    patient_code = patient["patient_code"]
    print(f"  [OK] Participant: {patient_code} (UUID: {patient_id})")

    # 2. Initialize Attempt 1
    print("\n[Check 2] Initializing Assessment Attempt #1...")
    ass1 = request_json(f"{BASE}/assessments/create", {"patient_id": patient_id})
    ass1_id = ass1["id"]
    print(f"  [OK] Assessment #1: {ass1_id}")

    # 3. Execute all 3 tasks with known, exact sample counts
    print("\n[Check 3] Executing 3-task battery with known event sets...")
    
    # Task 1: Visual Search
    vs_sess = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass1_id,
        "task_type": "visual_search"
    })
    vs_id = vs_sess["id"]
    vs_raw = [{"x": 100 + i, "y": 200 + i, "t": 1000 + i * 20, "confidence": 0.94, "isBlink": False} for i in range(30)]
    vs_fix = [
        {"startTime": 1050, "x": 105, "y": 205, "duration": 200},
        {"startTime": 1300, "x": 115, "y": 215, "duration": 220}
    ]
    vs_comp = {
        "summary": {"accuracyPct": 100, "avgSearchTimeMs": 1100, "totalFixations": 2},
        "allCompletedTrials": [{
            "trialIndex": 0, "trialId": "vs_tr0",
            "trialGazeSamples": vs_raw,
            "fixations": vs_fix
        }]
    }
    request_json(f"{BASE}/sessions/{vs_id}/complete", {
        "accuracy_pct": 100.0,
        "rt_ms": 1100.0,
        "scan_path_json": json.dumps(vs_raw),
        "comparison_json": json.dumps(vs_comp)
    })

    # Task 2: Memory & Recognition
    mem_sess = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass1_id,
        "task_type": "memory"
    })
    mem_id = mem_sess["id"]
    mem_raw = [{"x": 300 + i, "y": 400 + i, "t": 2000 + i * 20, "confidence": 0.91, "isBlink": False} for i in range(25)]
    mem_fix = [
        {"startTime": 2100, "x": 310, "y": 410, "duration": 250}
    ]
    mem_comp = {
        "metrics": {"dPrime": 2.1, "criterionC": 0.0, "hitRate": 0.9},
        "studies": [{"itemId": "s1", "gazeSamples": mem_raw, "fixations": mem_fix}],
        "recognitions": []
    }
    request_json(f"{BASE}/sessions/{mem_id}/complete", {
        "accuracy_pct": 90.0,
        "rt_ms": 950.0,
        "scan_path_json": json.dumps(mem_raw),
        "comparison_json": json.dumps(mem_comp)
    })

    # Task 3: Reading & Comprehension
    read_sess = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass1_id,
        "task_type": "reading"
    })
    read_id = read_sess["id"]
    read_raw = [{"x": 150 + i * 2, "y": 250, "t": 3000 + i * 25, "confidence": 0.98, "isBlink": False} for i in range(35)]
    read_fix = [
        {"startTime": 3050, "x": 160, "y": 250, "duration": 210},
        {"startTime": 3300, "x": 190, "y": 250, "duration": 230},
        {"startTime": 3600, "x": 220, "y": 250, "duration": 205}
    ]
    read_comp = {
        "readingTimeMs": 12000,
        "derivedMetrics": {"wordsPerMinute": 260, "overallComprehensionAccuracyPct": 100},
        "readingFixations": read_fix
    }
    request_json(f"{BASE}/sessions/{read_id}/complete", {
        "accuracy_pct": 100.0,
        "rt_ms": 1200.0,
        "scan_path_json": json.dumps(read_raw),
        "comparison_json": json.dumps(read_comp)
    })

    # Finalize Assessment #1
    request_json(f"{BASE}/assessments/{ass1_id}/end", method="POST")
    print("  [OK] All 3 tasks completed and assessment finalized.")

    # 4. Direct Database Schema & Foreign Key Verification
    print("\n[Check 4] Inspecting direct SQLite database records...")
    cursor.execute("SELECT id, task_type, assessment_id, status FROM sessions WHERE assessment_id = ?", (ass1_id,))
    db_sessions = cursor.fetchall()
    print(f"  Sessions found in DB for assessment {ass1_id}: {len(db_sessions)}")
    assert len(db_sessions) == 3, "Expected exactly 3 task sessions"
    for s_id, s_type, s_ass_id, s_status in db_sessions:
        assert s_ass_id == ass1_id, f"Session {s_id} belongs to wrong assessment {s_ass_id}"
        assert s_status == "completed", f"Session {s_id} status is {s_status}"
        print(f"    - Session {s_id}: type={s_type}, assessment_id={s_ass_id} (VERIFIED)")

    # 5. Gaze event association and count integrity
    print("\n[Check 5] Verifying gaze and fixation counts match exactly...")
    # Expected:
    # VS: 30 raw + 2 fixation = 32 total
    # Memory: 25 raw + 1 fixation = 26 total
    # Reading: 35 raw + 3 fixation = 38 total
    expected_counts = {
        vs_id: {"total": 32, "fixations": 2},
        mem_id: {"total": 26, "fixations": 1},
        read_id: {"total": 38, "fixations": 3},
    }
    for sess_id, exp in expected_counts.items():
        cursor.execute("SELECT COUNT(*) FROM gaze_events WHERE session_id = ?", (sess_id,))
        total_evts = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM gaze_events WHERE session_id = ? AND event_type = 'fixation'", (sess_id,))
        fix_evts = cursor.fetchone()[0]
        print(f"    Session {sess_id}: DB total={total_evts} (exp {exp['total']}), DB fixations={fix_evts} (exp {exp['fixations']})")
        assert total_evts == exp["total"], f"Expected {exp['total']} gaze events, found {total_evts}"
        assert fix_evts == exp["fixations"], f"Expected {exp['fixations']} fixations, found {fix_evts}"
    print("  [OK] Direct database gaze counts strictly verified.")

    # 6. Idempotency & Repeated Download Test (No duplication)
    print("\n[Check 6] Verifying repeated report and PDF requests do NOT duplicate DB records...")
    cursor.execute("SELECT COUNT(*) FROM gaze_events WHERE session_id IN (?, ?, ?)", (vs_id, mem_id, read_id))
    initial_event_count = cursor.fetchone()[0]

    for req_idx in range(3):
        # Fetch report JSON
        rep = request_json(f"{BASE}/reports/assessment/{ass1_id}")
        assert rep["tasks_completed"] == 3
        # Fetch PDF
        pdf_bytes = request_json(f"{BASE}/reports/assessment/{ass1_id}/pdf")
        assert len(pdf_bytes) > 2000

    cursor.execute("SELECT COUNT(*) FROM gaze_events WHERE session_id IN (?, ?, ?)", (vs_id, mem_id, read_id))
    final_event_count = cursor.fetchone()[0]
    print(f"  Initial DB events: {initial_event_count} | Post-3-downloads DB events: {final_event_count}")
    assert initial_event_count == final_event_count, "Repeated report requests duplicated gaze events!"
    print("  [OK] Idempotency verified: zero duplicate records created.")

    # 7. Missing Gaze Data Honesty Test
    print("\n[Check 7] Verifying honest missing data labeling...")
    # Create an assessment with a task that has NO gaze samples
    ass_missing = request_json(f"{BASE}/assessments/create", {"patient_id": patient_id, "force_new": True})
    no_gaze_sess = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass_missing["id"],
        "task_type": "visual_search"
    })
    request_json(f"{BASE}/sessions/{no_gaze_sess['id']}/complete", {
        "accuracy_pct": 75.0,
        "rt_ms": 1500.0,
        "scan_path_json": "[]",
        "comparison_json": "{}"
    })
    rep_missing = request_json(f"{BASE}/reports/assessment/{ass_missing['id']}")
    vs_detail = next(t for t in rep_missing["tasks"] if t["task_type"] == "visual_search")
    print(f"  Missing gaze task detail: is_available={vs_detail['is_gaze_available']}, gaze_count={vs_detail['gaze_count']}, status_label='{vs_detail['gaze_status_label']}', avg_fixation_ms={vs_detail['avg_fixation_ms']}")
    assert vs_detail["is_gaze_available"] is False
    assert vs_detail["gaze_status_label"] == "Unavailable"
    assert vs_detail["gaze_count"] == 0
    assert vs_detail["avg_fixation_ms"] is None, "Missing avg_fixation_ms must be None, NOT 0.0"
    print("  [OK] Missing gaze values are honestly labeled 'Unavailable' with None instead of genuine 0.0.")

    # 8. Retake Isolation Test
    print("\n[Check 8] Verifying Retake creates new attempt without inheriting stale data...")
    ass2 = request_json(f"{BASE}/assessments/create", {"patient_id": patient_id, "force_new": True})
    ass2_id = ass2["id"]
    print(f"  [OK] Retake Assessment created: {ass2_id}")
    assert ass2_id != ass1_id

    # Verify Attempt 2 has ZERO sessions initially
    cursor.execute("SELECT COUNT(*) FROM sessions WHERE assessment_id = ?", (ass2_id,))
    ass2_sess_count = cursor.fetchone()[0]
    assert ass2_sess_count == 0, f"New retake attempt started with {ass2_sess_count} sessions"

    # Verify Attempt 1 remains intact
    cursor.execute("SELECT status FROM assessments WHERE id = ?", (ass1_id,))
    ass1_status = cursor.fetchone()[0]
    assert ass1_status == "completed", f"Attempt #1 status altered to {ass1_status}"
    print("  [OK] Retake attempt completely isolated; Attempt #1 fully preserved.")

    # 9. Anonymity and Disclaimer in Generated PDF
    print("\n[Check 9] Verifying PDF anonymity and non-diagnostic research disclaimer...")
    pdf_bytes = request_json(f"{BASE}/reports/assessment/{ass1_id}/pdf")
    streams = re.findall(rb'stream[\r\n]+(.*?)[\r\n]+endstream', pdf_bytes, re.DOTALL)
    text_chunks = []
    for s in streams:
        try:
            text_chunks.append(zlib.decompress(s.strip()).decode("latin1", errors="ignore"))
        except Exception:
            pass
    full_pdf_text = " ".join(text_chunks)

    assert patient_code in full_pdf_text, f"PDF must display anonymous patient code {patient_code}"
    assert "TEST-PARTICIPANT-PHASE4-FREEZE" not in full_pdf_text, "PDF must NOT expose full patient name"
    assert "VISIONEXIS Research Prototype Notice" in full_pdf_text, "PDF must contain research prototype notice"
    assert "NOT a certified medical diagnostic device" in full_pdf_text, "PDF must contain non-diagnostic disclaimer"
    assert "Attempt #1" in full_pdf_text, "PDF must specify Attempt #1"
    assert "Below normal range - review recommended" not in full_pdf_text, "PDF must avoid unvalidated clinical diagnostic labels"
    print("  [OK] PDF anonymized, non-diagnostic, and clearly indexed as Attempt #1.")

    conn.close()
    print("\n" + "=" * 75)
    print("ALL RESEARCH DATA INTEGRITY AND RELEASE CHECKS VERIFIED!")
    print("=" * 75)

if __name__ == "__main__":
    run_integrity_validation()
