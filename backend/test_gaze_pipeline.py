import unittest
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Base
import models
import schemas
from services.gaze_persistence import extract_gaze_events, persist_session_gaze_events
from routers.reports import _gaze_stats, _build_combined_pdf, _build_pdf, _within_norm


class TestGazeDataPipeline(unittest.TestCase):
    def setUp(self):
        # Use isolated in-memory SQLite database
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Create test patient
        self.patient = models.Patient(
            patient_code="TEST-001",
            name="John Doe",
            age=30,
            gender="male",
        )
        self.db.add(self.patient)
        self.db.commit()
        self.db.refresh(self.patient)

        # Create assessment
        self.assessment = models.Assessment(
            patient_id=self.patient.id,
            status="in_progress",
        )
        self.db.add(self.assessment)
        self.db.commit()
        self.db.refresh(self.assessment)

    def tearDown(self):
        self.db.close()

    def test_valid_gaze_events_persistence(self):
        """Verify valid gaze points and fixations are extracted, persisted, and accurately counted."""
        session = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="visual_search",
            status="completed",
            started_at=datetime.utcnow() - timedelta(minutes=1),
            ended_at=datetime.utcnow(),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        # 20 raw samples
        raw_samples = [{"x": 100 + i, "y": 200 + i, "t": 1000 + i * 50, "confidence": 0.9} for i in range(20)]
        # 3 fixations with 200ms, 300ms, 400ms duration (avg 300ms)
        comp_data = {
            "trials": [
                {
                    "trialId": "t1",
                    "fixations": [
                        {"startTime": 1000, "duration": 200, "meanX": 150, "meanY": 250},
                        {"startTime": 1300, "duration": 300, "meanX": 160, "meanY": 260},
                    ]
                },
                {
                    "trialId": "t2",
                    "fixations": [
                        {"startTime": 1700, "duration": 400, "meanX": 170, "meanY": 270},
                    ]
                }
            ]
        }

        task_result = models.TaskResult(
            session_id=session.id,
            accuracy_pct=85.0,
            rt_ms=1500.0,
            scan_path_json=json.dumps(raw_samples),
            comparison_json=json.dumps(comp_data),
        )
        self.db.add(task_result)
        self.db.commit()

        # Persist gaze events
        persisted_count = persist_session_gaze_events(
            db=self.db,
            session_id=session.id,
            task_type=session.task_type,
            scan_path_json=task_result.scan_path_json,
            comparison_json=task_result.comparison_json,
        )

        self.assertEqual(persisted_count, 23)  # 20 raw + 3 fixations

        # Verify _gaze_stats
        gaze_count, fix_count, avg_fix_ms, is_available, status_label = _gaze_stats(self.db, session)
        self.assertEqual(gaze_count, 23)
        self.assertEqual(fix_count, 3)
        self.assertAlmostEqual(avg_fix_ms, 300.0, places=1)
        self.assertTrue(is_available)
        self.assertEqual(status_label, "Available")

    def test_genuinely_empty_tracking_data(self):
        """Verify empty tracking data is identified as Unavailable and does not present 0 as a valid metric."""
        session = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="memory",
            status="completed",
            started_at=datetime.utcnow() - timedelta(minutes=1),
            ended_at=datetime.utcnow(),
        )
        self.db.add(session)
        self.db.commit()

        task_result = models.TaskResult(
            session_id=session.id,
            accuracy_pct=70.0,
            rt_ms=2000.0,
            scan_path_json="[]",
            comparison_json="{}",
        )
        self.db.add(task_result)
        self.db.commit()

        gaze_count, fix_count, avg_fix_ms, is_available, status_label = _gaze_stats(self.db, session)
        self.assertEqual(gaze_count, 0)
        self.assertEqual(fix_count, 0)
        self.assertIsNone(avg_fix_ms)
        self.assertFalse(is_available)
        self.assertEqual(status_label, "Unavailable")

    def test_insufficient_gaze_data(self):
        """Verify sporadic/insufficient tracking (< 10 samples or 0 fixations) is flagged as Insufficient."""
        session = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="reading",
            status="completed",
            started_at=datetime.utcnow() - timedelta(minutes=1),
            ended_at=datetime.utcnow(),
        )
        self.db.add(session)
        self.db.commit()

        # Only 3 samples, 0 fixations
        raw_samples = [{"x": 100, "y": 200, "t": 1000}, {"x": 105, "y": 205, "t": 1050}, {"x": 110, "y": 210, "t": 1100}]
        persist_session_gaze_events(
            db=self.db,
            session_id=session.id,
            task_type="reading",
            scan_path_json=json.dumps(raw_samples),
            comparison_json="{}",
        )

        gaze_count, fix_count, avg_fix_ms, is_available, status_label = _gaze_stats(self.db, session)
        self.assertEqual(gaze_count, 3)
        self.assertEqual(fix_count, 0)
        self.assertFalse(is_available)
        self.assertEqual(status_label, "Insufficient gaze data")

    def test_session_isolation(self):
        """Ensure gaze events for Session A never leak into Session B."""
        session_a = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="visual_search",
            status="completed",
        )
        session_b = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="visual_search",
            status="completed",
        )
        self.db.add_all([session_a, session_b])
        self.db.commit()

        samples_a = [{"x": 10, "y": 20, "t": 100} for _ in range(15)]
        samples_b = [{"x": 30, "y": 40, "t": 200} for _ in range(25)]

        persist_session_gaze_events(self.db, session_a.id, "visual_search", json.dumps(samples_a), "{}")
        persist_session_gaze_events(self.db, session_b.id, "visual_search", json.dumps(samples_b), "{}")

        count_a = self.db.query(models.GazeEvent).filter(models.GazeEvent.session_id == session_a.id).count()
        count_b = self.db.query(models.GazeEvent).filter(models.GazeEvent.session_id == session_b.id).count()

        self.assertEqual(count_a, 15)
        self.assertEqual(count_b, 25)

    def test_combined_report_and_pdf_generation(self):
        """Verify combined PDF generation preserves anonymous ID, real gaze stats, and neutral benchmarks."""
        # Visual Search
        s_vs = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="visual_search",
            status="completed",
            started_at=datetime.utcnow() - timedelta(minutes=3),
            ended_at=datetime.utcnow() - timedelta(minutes=2),
        )
        # Memory
        s_mem = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="memory",
            status="completed",
            started_at=datetime.utcnow() - timedelta(minutes=2),
            ended_at=datetime.utcnow() - timedelta(minutes=1),
        )
        # Reading
        s_read = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="reading",
            status="completed",
            started_at=datetime.utcnow() - timedelta(minutes=1),
            ended_at=datetime.utcnow(),
        )
        self.db.add_all([s_vs, s_mem, s_read])
        self.db.commit()

        task_data = [
            {
                "task_type": "visual_search",
                "session": s_vs,
                "accuracy": 90.0,
                "rt_ms": 1800.0,
                "duration_s": 50.0,
                "gaze_count": 500,
                "fixation_count": 80,
                "avg_fixation_ms": 250.0,
                "is_gaze_available": True,
                "gaze_status_label": "Available",
                "within_norm": True,
            },
            {
                "task_type": "memory",
                "session": s_mem,
                "accuracy": 65.0,
                "rt_ms": 3200.0,
                "duration_s": 60.0,
                "gaze_count": 600,
                "fixation_count": 110,
                "avg_fixation_ms": 230.0,
                "is_gaze_available": True,
                "gaze_status_label": "Available",
                "within_norm": False,
            },
            {
                "task_type": "reading",
                "session": s_read,
                "accuracy": 75.0,
                "rt_ms": 2100.0,
                "duration_s": 45.0,
                "gaze_count": 450,
                "fixation_count": 95,
                "avg_fixation_ms": 220.0,
                "is_gaze_available": True,
                "gaze_status_label": "Available",
                "within_norm": True,
            },
        ]

        pdf_bytes = _build_combined_pdf(self.patient, self.assessment, task_data)
        self.assertGreater(len(pdf_bytes), 1000)

        # Decompress PDF streams to test content
        import zlib, re
        streams = re.findall(rb'stream[\r\n]+(.*?)[\r\n]+endstream', pdf_bytes, re.DOTALL)
        full_text = ""
        for s in streams:
            try:
                full_text += zlib.decompress(s).decode("latin1", errors="ignore") + "\n"
            except Exception:
                pass

        # 1. Anonymous patient code is present
        self.assertIn("TEST-001", full_text)
        # 2. Patient personal name is excluded (no PII)
        self.assertNotIn("John Doe", full_text)
        # 3. Real gaze tracking metrics are displayed
        self.assertIn("500 events", full_text)
        self.assertIn("600 events", full_text)
        self.assertIn("450 events", full_text)
        # 4. Diagnostic/alarmist claims removed
        self.assertNotIn("Below normal range - review recommended", full_text)
        self.assertNotIn("clinical review recommended", full_text.lower())
        # 5. Neutral benchmark and prototype notices present
        self.assertIn("exploratory benchmark", full_text.lower())
        self.assertIn("research prototype notice", full_text.lower())

    def test_persistence_idempotency_no_duplicates(self):
        """Verify that persisting session gaze events multiple times is idempotent and does not duplicate records."""
        session = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="visual_search",
            status="completed",
        )
        self.db.add(session)
        self.db.commit()

        samples = [{"x": 100, "y": 200, "t": 1000 + i * 50} for i in range(15)]
        comp = {
            "trials": [
                {"fixations": [{"startTime": 1000, "duration": 250, "meanX": 100, "meanY": 200}]}
            ]
        }
        task_result = models.TaskResult(
            session_id=session.id,
            accuracy_pct=90.0,
            rt_ms=1200.0,
            scan_path_json=json.dumps(samples),
            comparison_json=json.dumps(comp),
        )
        self.db.add(task_result)
        self.db.commit()

        # Run persistence first time
        c1 = persist_session_gaze_events(self.db, session.id, "visual_search", task_result.scan_path_json, task_result.comparison_json)
        self.assertEqual(c1, 16)  # 15 raw + 1 fix

        # Run persistence second time
        c2 = persist_session_gaze_events(self.db, session.id, "visual_search", task_result.scan_path_json, task_result.comparison_json)
        self.assertEqual(c2, 16)

        # Confirm total rows in DB for this session is exactly 16, not 32
        total_in_db = self.db.query(models.GazeEvent).filter(models.GazeEvent.session_id == session.id).count()
        self.assertEqual(total_in_db, 16)

        # Call _gaze_stats multiple times and verify count remains 16
        g1, f1, avg1, avail1, label1 = _gaze_stats(self.db, session)
        g2, f2, avg2, avail2, label2 = _gaze_stats(self.db, session)
        self.assertEqual(g1, 16)
        self.assertEqual(g2, 16)
        self.assertEqual(f1, 1)
        self.assertEqual(f2, 1)

    def test_seeded_patient_remains_unavailable(self):
        """Verify seeded sessions with scan_path_json='[]' and no events remain honestly labeled Unavailable."""
        seeded_session = models.TaskSession(
            patient_id=self.patient.id,
            assessment_id=self.assessment.id,
            task_type="visual_search",
            status="completed",
        )
        self.db.add(seeded_session)
        self.db.commit()

        # Seeded pattern: empty list scan path, no comparison JSON
        seeded_result = models.TaskResult(
            session_id=seeded_session.id,
            accuracy_pct=94.0,
            rt_ms=3200.0,
            scan_path_json="[]",
            comparison_json=None,
        )
        self.db.add(seeded_result)
        self.db.commit()

        gaze_count, fix_count, avg_fix, is_avail, status_label = _gaze_stats(self.db, seeded_session)
        self.assertEqual(gaze_count, 0)
        self.assertEqual(fix_count, 0)
        self.assertIsNone(avg_fix)
        self.assertFalse(is_avail)
        self.assertEqual(status_label, "Unavailable")

        # Confirm no events were fabricated in DB
        db_events = self.db.query(models.GazeEvent).filter(models.GazeEvent.session_id == seeded_session.id).count()
        self.assertEqual(db_events, 0)

    def test_all_three_task_types_persistence(self):
        """Verify visual_search, memory (study+recognition), and reading extract and store fixations and raw points correctly."""
        # 1. Visual Search
        s_vs = models.TaskSession(patient_id=self.patient.id, assessment_id=self.assessment.id, task_type="visual_search", status="completed")
        # 2. Memory
        s_mem = models.TaskSession(patient_id=self.patient.id, assessment_id=self.assessment.id, task_type="memory", status="completed")
        # 3. Reading
        s_read = models.TaskSession(patient_id=self.patient.id, assessment_id=self.assessment.id, task_type="reading", status="completed")
        self.db.add_all([s_vs, s_mem, s_read])
        self.db.commit()

        # Visual search data
        vs_samples = [{"x": 10, "y": 20, "t": 100 + i * 50} for i in range(12)]
        vs_comp = {"trials": [{"fixations": [{"startTime": 100, "duration": 200, "meanX": 10, "meanY": 20}]}]}
        persist_session_gaze_events(self.db, s_vs.id, "visual_search", json.dumps(vs_samples), json.dumps(vs_comp))

        # Memory data (both study and recognition trials)
        mem_samples = [{"x": 30, "y": 40, "t": 200 + i * 50} for i in range(15)]
        mem_comp = {
            "studyTrials": [{"fixations": [{"startTime": 200, "duration": 220, "meanX": 30, "meanY": 40}]}],
            "recognitionTrials": [{"fixations": [{"startTime": 500, "duration": 260, "meanX": 35, "meanY": 45}]}],
        }
        persist_session_gaze_events(self.db, s_mem.id, "memory", json.dumps(mem_samples), json.dumps(mem_comp))

        # Reading data
        read_samples = [{"x": 50, "y": 60, "t": 300 + i * 50} for i in range(14)]
        read_comp = {"fixations": [{"startTime": 300, "duration": 210, "meanX": 50, "meanY": 60}]}
        persist_session_gaze_events(self.db, s_read.id, "reading", json.dumps(read_samples), json.dumps(read_comp))

        vs_g, vs_f, vs_avg, vs_av, vs_lbl = _gaze_stats(self.db, s_vs)
        mem_g, mem_f, mem_avg, mem_av, mem_lbl = _gaze_stats(self.db, s_mem)
        read_g, read_f, read_avg, read_av, read_lbl = _gaze_stats(self.db, s_read)

        self.assertEqual(vs_g, 13)
        self.assertEqual(vs_f, 1)
        self.assertEqual(vs_lbl, "Available")

        self.assertEqual(mem_g, 17)
        self.assertEqual(mem_f, 2)  # 1 study + 1 recognition
        self.assertEqual(mem_lbl, "Available")

        self.assertEqual(read_g, 15)
        self.assertEqual(read_f, 1)
        self.assertEqual(read_lbl, "Available")


if __name__ == "__main__":
    unittest.main()
