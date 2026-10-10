"""
End-to-end Demonstration Workflow and Retake Verification Script.
Simulates the exact full browser/API clinical lifecycle:
1. Register anonymous patient.
2. Initialize Assessment #1.
3. Execute Visual Search task with gaze samples and complete session.
4. Execute Memory & Recognition task with gaze samples and complete session.
5. Execute Reading & Comprehension task with gaze samples, complete session, and finalize assessment.
6. Verify Overall Patient Report (patient code, attempt number, gaze stats, disclaimer, non-zero accuracy).
7. Verify Combined PDF Download (valid bytes, attempt number, research disclaimer, anonymized subject info).
8. Perform Retake Assessment (force_new=True):
   - Keeps same anonymous patient ID.
   - Creates Attempt #2 with separate session IDs.
   - Preserves Attempt #1 completely.
   - Generates and verifies Attempt #2 PDF.
   - Verifies Dashboard grouping: 1 patient entry with 2 attempts (latest attempt #2).
"""

import json
import urllib.request
import urllib.error
import re
import sys

BASE = "http://127.0.0.1:8001/api"

def request_json(url, data=None, method=None):
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    else:
        req = urllib.request.Request(url)
    if method:
        req.method = method
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            if resp.headers.get_content_type() == "application/json":
                return json.loads(content.decode("utf-8"))
            return content
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code} on {url}: {err_body}")
        raise

def test_full_demonstration_and_retake():
    print("=" * 70)
    print("VISIONEXIS PHASE 3: END-TO-END DEMO & RETAKE INTEGRATION TEST")
    print("=" * 70)

    # 1. Register Anonymous Patient
    print("\n[Step 1] Registering anonymous patient...")
    patient_payload = {
        "name": "Anonymous Demo Participant",
        "age": 34,
        "gender": "prefer_not_to_say",
        "examiner_name": "Dr. Investigator",
        "visual_history": {
            "refractive_status": ["emmetropia"],
            "spectacle_use": False,
            "avg_screen_time": "4-6h"
        }
    }
    patient = request_json(f"{BASE}/patients", patient_payload)
    patient_id = patient["id"]
    patient_code = patient["patient_code"]
    print(f"  [OK] Created patient: ID={patient_id}, Code={patient_code}")

    # 2. Create Assessment Attempt 1
    print("\n[Step 2] Creating Assessment Attempt #1...")
    assessment1 = request_json(f"{BASE}/assessments/create", {"patient_id": patient_id})
    ass1_id = assessment1["id"]
    print(f"  [OK] Assessment #1 created: ID={ass1_id}, Status={assessment1['status']}")
    assert assessment1["status"] == "in_progress"

    # 3. Task 1: Visual Search
    print("\n[Step 3] Executing Task 1: Visual Search...")
    vs_session = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass1_id,
        "task_type": "visual_search"
    })
    vs_session_id = vs_session["id"]

    # Ingest trial results and gaze data
    vs_gaze_samples = [
        {"x": 100 + i * 2, "y": 150 + i, "t": 1000 + i * 20, "confidence": 0.95, "isBlink": False}
        for i in range(50)
    ]
    vs_comparison = {
        "summary": {
            "accuracyPct": 95,
            "avgSearchTimeMs": 1420,
            "totalFixations": 18,
            "avgSearchEfficiency": 88,
            "mouseGazeLatencyMs": 145
        },
        "allCompletedTrials": [
            {
                "trialIndex": 0,
                "trialId": "vs_0",
                "targetPresent": True,
                "targetType": "feature",
                "userFound": True,
                "searchDurationMs": 1250,
                "targetFixationTimeMs": 280,
                "trialGazeSamples": vs_gaze_samples[:25],
                "fixations": [
                    {"startTime": 1050, "x": 120, "y": 160, "duration": 220},
                    {"startTime": 1300, "x": 140, "y": 170, "duration": 250}
                ]
            },
            {
                "trialIndex": 1,
                "trialId": "vs_1",
                "targetPresent": True,
                "targetType": "conjunction",
                "userFound": True,
                "searchDurationMs": 1590,
                "targetFixationTimeMs": 310,
                "trialGazeSamples": vs_gaze_samples[25:],
                "fixations": [
                    {"startTime": 1650, "x": 150, "y": 180, "duration": 210}
                ]
            }
        ]
    }
    request_json(f"{BASE}/sessions/{vs_session_id}/complete", {
        "accuracy_pct": 95.0,
        "rt_ms": 1420.0,
        "scan_path_json": json.dumps(vs_gaze_samples),
        "comparison_json": json.dumps(vs_comparison)
    })
    print(f"  [OK] Visual Search completed and persisted (Session {vs_session_id})")

    # 4. Task 2: Memory & Recognition
    print("\n[Step 4] Executing Task 2: Memory & Recognition...")
    mem_session = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass1_id,
        "task_type": "memory"
    })
    mem_session_id = mem_session["id"]

    mem_gaze_samples = [
        {"x": 200 + i, "y": 250 - i, "t": 2000 + i * 20, "confidence": 0.92, "isBlink": False}
        for i in range(40)
    ]
    mem_comparison = {
        "metrics": {
            "dPrime": 1.85,
            "criterionC": -0.12,
            "hitRate": 0.85,
            "falseAlarmRate": 0.15
        },
        "studies": [
            {
                "itemId": "study_1",
                "fixationCount": 4,
                "dwellTimeMs": 950,
                "gazeSamples": mem_gaze_samples[:20],
                "fixations": [
                    {"startTime": 2100, "x": 210, "y": 240, "duration": 280}
                ]
            }
        ],
        "recognitions": [
            {
                "itemId": "rec_1",
                "isTarget": True,
                "userResponse": "old",
                "isCorrect": True,
                "reactionTimeMs": 890,
                "dwellTimeMs": 820,
                "gazeSamples": mem_gaze_samples[20:],
                "fixations": [
                    {"startTime": 2500, "x": 230, "y": 220, "duration": 260}
                ]
            }
        ]
    }
    request_json(f"{BASE}/sessions/{mem_session_id}/complete", {
        "accuracy_pct": 85.0,
        "rt_ms": 890.0,
        "scan_path_json": json.dumps(mem_gaze_samples),
        "comparison_json": json.dumps(mem_comparison)
    })
    print(f"  [OK] Memory & Recognition completed and persisted (Session {mem_session_id})")

    # 5. Task 3: Reading & Comprehension
    print("\n[Step 5] Executing Task 3: Reading & Comprehension...")
    read_session = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass1_id,
        "task_type": "reading"
    })
    read_session_id = read_session["id"]

    read_gaze_samples = [
        {"x": 120 + i * 5, "y": 180, "t": 3000 + i * 25, "confidence": 0.96, "isBlink": False}
        for i in range(60)
    ]
    read_comparison = {
        "readingTimeMs": 14500,
        "derivedMetrics": {
            "wordsPerMinute": 248,
            "overallComprehensionAccuracyPct": 100,
            "totalFixationCount": 45,
            "meanFixationDurationMs": 220,
            "totalRegressionsCount": 3,
            "regressionsPer100Words": 2.1,
            "readingCoveragePct": 92
        },
        "readingFixations": [
            {"x": 150, "y": 180, "durationMs": 230, "lineIndex": 0},
            {"x": 280, "y": 180, "durationMs": 210, "lineIndex": 0},
            {"x": 410, "y": 180, "durationMs": 240, "lineIndex": 1}
        ]
    }
    request_json(f"{BASE}/sessions/{read_session_id}/complete", {
        "accuracy_pct": 100.0,
        "rt_ms": 1150.0,
        "scan_path_json": json.dumps(read_gaze_samples),
        "comparison_json": json.dumps(read_comparison)
    })
    print(f"  [OK] Reading task completed and persisted (Session {read_session_id})")

    # Finalize Assessment #1
    ended_assessment1 = request_json(f"{BASE}/assessments/{ass1_id}/end", method="POST")
    print(f"  [OK] Assessment #1 finalized: Status={ended_assessment1['status']}")
    assert ended_assessment1["status"] == "completed"

    # 6. Verify Combined Overall Report for Attempt 1
    print("\n[Step 6] Verifying Overall Patient Report for Attempt #1...")
    report1 = request_json(f"{BASE}/reports/assessment/{ass1_id}")
    print(f"  Report patient_code: {report1['patient_code']}")
    print(f"  Report attempt_number: {report1['attempt_number']}")
    print(f"  Report tasks_completed: {report1['tasks_completed']}/3")
    print(f"  Report avg_accuracy: {report1['avg_accuracy']}%")

    assert report1["patient_code"] == patient_code
    assert report1["attempt_number"] == 1
    assert report1["tasks_completed"] == 3
    assert report1["status"] == "completed"
    assert report1["avg_accuracy"] is not None and report1["avg_accuracy"] > 0
    assert "Research Prototype Notice" in report1["disclaimer"]

    # Verify per-task gaze availability and data integrity
    for t in report1["tasks"]:
        print(f"  Task {t['task_type']}: accuracy={t['accuracy_pct']}%, gaze_available={t['is_gaze_available']}, gaze_count={t['gaze_count']}, status_label={t['gaze_status_label']}")
        assert t["status"] == "completed"
        assert t["is_gaze_available"] is True
        assert t["gaze_count"] > 0
        assert t["gaze_status_label"] == "Available"
    print("  [OK] All 3 tasks verified with valid gaze events and benchmarks!")

    # 7. Verify Combined PDF Download for Attempt 1
    print("\n[Step 7] Verifying Combined PDF generation for Attempt #1...")
    pdf1_bytes = request_json(f"{BASE}/reports/assessment/{ass1_id}/pdf")
    print(f"  PDF #1 size: {len(pdf1_bytes)} bytes")
    assert len(pdf1_bytes) > 2000, "PDF bytes suspiciously small"

    # Decompress streams and check text
    streams1 = re.findall(rb'stream[\r\n]+(.*?)[\r\n]+endstream', pdf1_bytes, re.DOTALL)
    import zlib
    text_chunks1 = []
    for s in streams1:
        try:
            text_chunks1.append(zlib.decompress(s.strip()).decode("latin1", errors="ignore"))
        except Exception:
            pass
    full_pdf1_text = " ".join(text_chunks1)
    
    assert "Attempt #1" in full_pdf1_text, "PDF #1 must contain 'Attempt #1'"
    assert patient_code in full_pdf1_text, f"PDF #1 must contain patient code {patient_code}"
    assert "Anonymous Demo Participant" not in full_pdf1_text, "PDF must NOT expose patient real name (anonymized)"
    assert "VISIONEXIS Research Prototype Notice" in full_pdf1_text, "PDF must contain research disclaimer"
    print("  [OK] Combined PDF #1 successfully validated: Anonymized, Attempt #1, non-diagnostic disclaimer included!")

    # 8. Retake Assessment (Attempt #2)
    print("\n[Step 8] Testing Retake Assessment Action...")
    retake_assessment = request_json(f"{BASE}/assessments/create", {
        "patient_id": patient_id,
        "force_new": True
    })
    ass2_id = retake_assessment["id"]
    print(f"  [OK] Retake Assessment created: ID={ass2_id}, Status={retake_assessment['status']}")
    assert ass2_id != ass1_id, "Retake must create a NEW assessment ID"
    assert retake_assessment["status"] == "in_progress"

    # Verify Attempt #1 remains intact in database
    refreshed_ass1 = request_json(f"{BASE}/assessments/{ass1_id}")
    assert refreshed_ass1["status"] == "completed"
    assert len(refreshed_ass1["tasks"]) == 3
    print("  [OK] Attempt #1 preserved: Status=completed, Tasks=3/3")

    # Complete a task in Attempt #2
    vs2_session = request_json(f"{BASE}/sessions/create", {
        "patient_id": patient_id,
        "assessment_id": ass2_id,
        "task_type": "visual_search"
    })
    vs2_session_id = vs2_session["id"]
    assert vs2_session_id != vs_session_id, "Retake session ID must be unique"

    request_json(f"{BASE}/sessions/{vs2_session_id}/complete", {
        "accuracy_pct": 100.0,
        "rt_ms": 1100.0,
        "scan_path_json": json.dumps(vs_gaze_samples),
        "comparison_json": json.dumps(vs_comparison)
    })
    print(f"  [OK] Attempt #2 Visual Search session completed: ID={vs2_session_id}")

    # Check Attempt #2 Report
    report2 = request_json(f"{BASE}/reports/assessment/{ass2_id}")
    print(f"  Attempt #2 Report attempt_number: {report2['attempt_number']}")
    assert report2["attempt_number"] == 2, f"Expected attempt_number=2, got {report2['attempt_number']}"
    assert report2["patient_code"] == patient_code
    print("  [OK] Attempt #2 correctly indexed as Attempt #2 under same anonymous patient!")

    # Verify Attempt #2 PDF
    pdf2_bytes = request_json(f"{BASE}/reports/assessment/{ass2_id}/pdf")
    streams2 = re.findall(rb'stream[\r\n]+(.*?)[\r\n]+endstream', pdf2_bytes, re.DOTALL)
    text_chunks2 = []
    for s in streams2:
        try:
            text_chunks2.append(zlib.decompress(s.strip()).decode("latin1", errors="ignore"))
        except Exception:
            pass
    full_pdf2_text = " ".join(text_chunks2)
    assert "Attempt #2" in full_pdf2_text, "PDF #2 must indicate 'Attempt #2'"
    print("  [OK] Attempt #2 PDF verified containing 'Attempt #2'!")

    # 9. Verify Dashboard Patient Grouping
    print("\n[Step 9] Verifying Dashboard Assessment Grouping...")
    dash_summary = request_json(f"{BASE}/dashboard/summary")
    patient_items = [a for a in dash_summary["patient_assessments"] if a["patient_id"] == patient_id]
    print(f"  Total assessment rows for this patient in dashboard: {len(patient_items)}")
    assert len(patient_items) == 2, "Dashboard should list both Attempt 1 and Attempt 2"

    attempt_nums = {item["attempt_number"] for item in patient_items}
    assert attempt_nums == {1, 2}, f"Dashboard attempts should be {{1, 2}}, got {attempt_nums}"

    latest_item = next(item for item in patient_items if item["is_latest"] is True)
    assert latest_item["attempt_number"] == 2, "Latest attempt must be Attempt #2"
    assert latest_item["assessment_id"] == ass2_id
    print("  [OK] Dashboard correctly lists Attempt #2 as latest, with Attempt #1 preserved in history!")

    print("\n" + "=" * 70)
    print("ALL END-TO-END DEMO READINESS & RETAKE VERIFICATIONS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    test_full_demonstration_and_retake()
