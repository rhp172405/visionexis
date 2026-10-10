import sqlite3
import json

conn = sqlite3.connect('eyecog.db')
c = conn.cursor()

pid = c.execute("SELECT id FROM patients WHERE patient_code='P-016'").fetchone()
if not pid:
    print("P-016 not found")
    exit()

pid = pid[0]
print(f"Patient ID: {pid}")

rows = c.execute("""
    SELECT s.task_type, s.id, r.accuracy_pct, r.rt_ms, r.scan_path_json, r.comparison_json
    FROM task_results r
    JOIN sessions s ON r.session_id = s.id
    WHERE s.patient_id = ?
""", (pid,)).fetchall()

for row in rows:
    task_type, sess_id, acc, rt, scan_path, comp = row
    print(f"\n--- Task: {task_type} (Session: {sess_id}) ---")
    print(f"Accuracy: {acc}%, RT: {rt}ms")
    if scan_path:
        try:
            sp = json.loads(scan_path)
            print(f"Scan path samples: {len(sp)}")
            if len(sp) > 0:
                print(f"Sample 0: {sp[0]}")
        except Exception as e:
            print(f"Scan path parse error: {e}")
    else:
        print("Scan path: None")

    if comp:
        try:
            cp = json.loads(comp)
            print(f"Comparison keys: {list(cp.keys())}")
            if "totalFixations" in cp:
                print(f"totalFixations: {cp.get('totalFixations')}, totalSaccades: {cp.get('totalSaccades')}")
            if "metrics" in cp:
                m = cp["metrics"]
                print(f"Metrics: correctCount={m.get('correctCount')}, dPrime={m.get('dPrime')}")
            if "derivedMetrics" in cp:
                dm = cp["derivedMetrics"]
                print(f"Derived: WPM={dm.get('wordsPerMinute')}, fixations={dm.get('totalFixationsCount')}")
        except Exception as e:
            print(f"Comparison parse error: {e}")
    else:
        print("Comparison: None")

    # Check gaze_events
    ge_count = c.execute("SELECT count(*) FROM gaze_events WHERE session_id=?", (sess_id,)).fetchone()[0]
    print(f"gaze_events table rows: {ge_count}")
