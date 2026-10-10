import urllib.request
import json
import sqlite3

base = "http://127.0.0.1:8001/api"

def main():
    # 1. Create Patient
    req = urllib.request.Request(
        f"{base}/patients",
        data=json.dumps({
            "name": "Live Verification Subject",
            "age": 30,
            "gender": "Female",
        }).encode(),
        headers={"Content-Type": "application/json"},
    )
    patient = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"Created patient: ID={patient['id']} Code={patient['patient_code']}")

    # 2. Create Assessment
    req = urllib.request.Request(
        f"{base}/assessments/create",
        data=json.dumps({"patient_id": patient["id"]}).encode(),
        headers={"Content-Type": "application/json"},
    )
    assessment = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"Created assessment: ID={assessment['id']} Status={assessment['status']}")

    # 3. Create Session for visual_search
    req = urllib.request.Request(
        f"{base}/sessions/create",
        data=json.dumps({
            "patient_id": patient["id"],
            "assessment_id": assessment["id"],
            "task_type": "visual_search",
        }).encode(),
        headers={"Content-Type": "application/json"},
    )
    session_vs = json.loads(urllib.request.urlopen(req).read().decode())
    vs_id = session_vs["id"]
    print(f"Created visual_search session: ID={vs_id} Status={session_vs['status']}")

    # 4. Complete Session with 30 real gaze samples and 3 fixations
    samples = [
        {"x": 400.0 + i * 3, "y": 250.0 + i * 2, "t": 1000.0 + i * 50.0, "confidence": 0.90}
        for i in range(30)
    ]
    comp = {
        "trials": [
            {
                "trialId": 1,
                "fixations": [
                    {"startTime": 1050.0, "duration": 220.0, "meanX": 410.0, "meanY": 255.0},
                    {"startTime": 1400.0, "duration": 310.0, "meanX": 450.0, "meanY": 275.0},
                    {"startTime": 1800.0, "duration": 270.0, "meanX": 480.0, "meanY": 295.0},
                ],
            }
        ]
    }
    req = urllib.request.Request(
        f"{base}/sessions/{vs_id}/complete",
        data=json.dumps({
            "accuracy_pct": 95.0,
            "rt_ms": 1420.0,
            "scan_path_json": json.dumps(samples),
            "comparison_json": json.dumps(comp),
        }).encode(),
        headers={"Content-Type": "application/json"},
    )
    completed_sess = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"Completed visual_search session status: {completed_sess['status']}")

    # 5. Check SQLite database rows directly
    conn = sqlite3.connect("eyecog.db")
    c = conn.cursor()
    ge_count = c.execute("SELECT count(*) FROM gaze_events WHERE session_id = ?", (vs_id,)).fetchone()[0]
    raw_count = c.execute("SELECT count(*) FROM gaze_events WHERE session_id = ? AND event_type='raw'", (vs_id,)).fetchone()[0]
    fix_count = c.execute("SELECT count(*) FROM gaze_events WHERE session_id = ? AND event_type='fixation'", (vs_id,)).fetchone()[0]
    print(f"\nDirect SQLite verification:")
    print(f"  Total gaze_events persisted: {ge_count} (30 raw + 3 fixations = 33 expected)")
    print(f"  Raw sample points count:     {raw_count}")
    print(f"  Fixation events count:       {fix_count}")
    assert ge_count == 33, f"Expected 33 events, got {ge_count}"
    assert raw_count == 30, f"Expected 30 raw, got {raw_count}"
    assert fix_count == 3, f"Expected 3 fix, got {fix_count}"

    # Complete memory task
    req = urllib.request.Request(
        f"{base}/sessions/create",
        data=json.dumps({"patient_id": patient["id"], "assessment_id": assessment["id"], "task_type": "memory"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    s_mem = json.loads(urllib.request.urlopen(req).read().decode())
    mem_samples = [{"x": 350.0 + i*2, "y": 200.0 + i, "t": 2000.0 + i*50.0, "confidence": 0.88} for i in range(20)]
    mem_comp = {
        "studyTrials": [{"fixations": [{"startTime": 2050.0, "duration": 250.0, "meanX": 360.0, "meanY": 210.0}]}],
        "recognitionTrials": [{"fixations": [{"startTime": 2500.0, "duration": 280.0, "meanX": 370.0, "meanY": 220.0}]}],
    }
    req = urllib.request.Request(
        f"{base}/sessions/{s_mem['id']}/complete",
        data=json.dumps({"accuracy_pct": 88.0, "rt_ms": 1100.0, "scan_path_json": json.dumps(mem_samples), "comparison_json": json.dumps(mem_comp)}).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req)

    # Complete reading task
    req = urllib.request.Request(
        f"{base}/sessions/create",
        data=json.dumps({"patient_id": patient["id"], "assessment_id": assessment["id"], "task_type": "reading"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    s_read = json.loads(urllib.request.urlopen(req).read().decode())
    read_samples = [{"x": 300.0 + i*3, "y": 180.0 + i, "t": 3000.0 + i*50.0, "confidence": 0.92} for i in range(25)]
    read_comp = {
        "fixations": [
            {"startTime": 3050.0, "duration": 230.0, "meanX": 310.0, "meanY": 185.0},
            {"startTime": 3500.0, "duration": 290.0, "meanX": 340.0, "meanY": 195.0},
        ]
    }
    req = urllib.request.Request(
        f"{base}/sessions/{s_read['id']}/complete",
        data=json.dumps({"accuracy_pct": 92.0, "rt_ms": 1600.0, "scan_path_json": json.dumps(read_samples), "comparison_json": json.dumps(read_comp)}).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req)

    # 6. Check Combined Assessment Report endpoint
    report_url = f"{base}/reports/assessment/{assessment['id']}"
    report_data = json.loads(urllib.request.urlopen(report_url).read().decode())
    print(f"\nCombined Assessment Report verification:")
    for td in report_data["tasks"]:
        tt = td["task_type"]
        st = td["status"]
        gc = td.get("gaze_count")
        fc = td.get("fixation_count")
        avg = td.get("avg_fixation_ms")
        lbl = td.get("gaze_status_label")
        print(f"  Task: {tt:15} Status: {st:10} Gaze Events: {gc} Fixations: {fc} Avg Fixation: {avg}ms Label: {lbl}")
        assert st == "completed", f"Expected completed for {tt}, got {st}"
        assert gc > 0, f"Expected >0 gaze events for {tt}, got {gc}"
        assert fc > 0, f"Expected >0 fixations for {tt}, got {fc}"
        assert lbl == "Available", f"Expected Available for {tt}, got {lbl}"

    # 7. Check PDF download
    pdf_url = f"{base}/reports/assessment/{assessment['id']}/pdf"
    pdf_bytes = urllib.request.urlopen(pdf_url).read()
    print(f"\nPDF Generation verification:")
    print(f"  Generated PDF size: {len(pdf_bytes)} bytes")
    assert len(pdf_bytes) > 2000, "PDF too small"
    print("  Combined assessment PDF downloaded and verified successfully!")

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
