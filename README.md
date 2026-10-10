# VISIONEXIS

**Software-Based Webcam Gaze Analysis & Visual-Cognitive Assessment System**

VISIONEXIS is a research-oriented visual-cognitive assessment platform designed for laptop hardware. It combines real-time webcam-based eye gaze estimation with high-frequency mouse tracking, collecting and synchronizing both data streams simultaneously during cognitive assessments.

```text
                                  VISIONEXIS
                                      │
                     ┌────────────────┴────────────────┐
                     │                                 │
              WEBCAM EYE GAZE                   MOUSE TRACKING
                     │                                 │
             Eye/Iris Features                     Mouse X/Y
            (MediaPipe Mesh)                    (Cursor Position)
                     │                                 │
            Estimated Gaze X/Y                 Cursor Trajectory
            (9-Pt Calibration)                  & Click Events
                     │                                 │
                     └────────────────┬────────────────┘
                                      │
                         Synchronized Data Stream
                                      │
                              Cognitive Tasks
                     ┌────────────────┼────────────────┐
                     │                │                │
               Visual Search       Memory          Reading
                     └────────────────┼────────────────┘
                                      │
                           Comparative Analytics
                      • Gaze-Mouse Spatial Distance
                      • Scanpath vs Trajectory Length
                      • Gaze-to-Click Latency
                      • Fixations & Saccades
                                      │
                                 VISIONEXIS
                            Dashboard & Reports
```

---

## Key Features

1. **Dual Simultaneous Data Streams:**
   - **Source 1 (Webcam Eye Tracking):** Real-time 468/478-point facial landmark and iris tracking via MediaPipe FaceLandmarker, normalized eye openness / EAR, 9-point polynomial ridge regression calibration, adaptive OneEuroFilter smoothing, and velocity-based saccade/fixation detection.
   - **Source 2 (Mouse Kinematics):** Normalized cursor coordinate stream, instantaneous velocity, clicks, pauses, and path length.
   - **Common Timestamping:** Synchronized time indices allow direct sample-by-sample spatial and temporal comparisons.

2. **Three Visual-Cognitive Tasks:**
   - **Visual Search:** Measures search latency, time-to-first-fixation on target, gaze path length vs mouse trajectory, and target acquisition click efficiency.
   - **Memory & Recognition:** Evaluates encoding fixation patterns across study items, distractor hesitations, and retrieval choice reaction times.
   - **Reading & Comprehension:** Analyzes reading scanpaths, word fixations, regression saccades, reading speed (WPM), and comprehension question performance.

3. **Gaze vs. Mouse Comparative Metrics:**
   - **Gaze-Mouse Euclidean Distance:** Real-time and summary distance between gaze point and cursor position.
   - **Trajectory Ratio:** Path length comparison between visual exploration and motor navigation.
   - **Gaze-to-Click Latency:** Temporal delay between visual target identification and motor selection.

4. **Privacy-Preserving Edge Processing:**
   - Camera frames are processed strictly in the browser using WebAssembly/GPU acceleration.
   - Raw video is never stored, recorded, or transmitted to the server.

5. **VISIONEXIS Reporting Engine:**
   - Formatted PDF and CSV exports with dual-modality metrics and research prototype disclaimers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Computer Vision** | `@mediapipe/tasks-vision` (FaceLandmarker, Iris Mesh), Ridge Regression Calibration, One Euro Filter |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Lucide Icons |
| **State & Query** | Zustand, TanStack Query, Axios |
| **Backend API** | Python 3.11+, FastAPI, SQLAlchemy, SQLite |
| **Gaze Stream** | FastAPI WebSockets |
| **PDF Generation** | `fpdf2` |

---

## Project Structure

```text
visionexis/
├── backend/
│   ├── main.py                  # FastAPI server entry point
│   ├── models.py                # SQLAlchemy ORM models (Patients, Sessions, GazeEvents)
│   ├── schemas.py               # Pydantic data schemas
│   ├── database.py              # SQLite database session engine
│   ├── seed.py                  # Demo patient data seeder
│   ├── requirements.txt
│   └── routers/
│       ├── patients.py          # Patient registration & clinical findings
│       ├── sessions.py          # Assessment session lifecycle
│       ├── dashboard.py         # Summary statistics & KPI aggregation
│       ├── gaze.py              # WebSocket synchronized gaze ingestion
│       └── reports.py           # VISIONEXIS PDF & CSV reports
└── frontend/
    ├── src/
    │   ├── lib/webcam/          # MediaPipe FaceLandmarker, Calibration, Eye Features, OneEuroFilter
    │   ├── hooks/               # useWebcamTracker, useTaskGaze, useFixationDetection
    │   ├── components/webcam/   # WebcamStatusPanel, CalibrationModal, GazeDebugDot
    │   ├── components/tasks/    # ScanPathView, GazeMouseComparisonView, Task Grids
    │   ├── pages/               # Dashboard, NewSession, VisualSearch, Memory, Reading, Reports
    │   ├── stores/              # gazeStore, sessionStore
    │   └── types/               # TypeScript interfaces & DualModalityMetrics
    ├── vite.config.ts
    └── package.json
```

---

## Local Setup and Running

### 1. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Start backend server on port 8001
python -m uvicorn main:app --port 8001 --reload
```

Backend API Docs: `http://localhost:8001/docs`

---

### 2. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend application will be live at `http://localhost:5173`.

---

## Calibration Workflow

1. Navigate to any task or click **Calibrate** in the top navigation bar.
2. Ensure good ambient lighting and position face directly in front of the laptop webcam.
3. Follow the 9 calibration targets displayed across the screen (`3x3` grid).
4. Look directly at each target circle while webcam frames collect eye/iris landmark vectors.
5. Polynomial ridge regression fits landmark displacements to screen pixel coordinates with real-time quality verification.

---

## Research Prototype Disclaimer

VISIONEXIS is an academic research and experimental software prototype. Gaze coordinates and motor kinematics are calculated using standard laptop webcams and computer vision heuristics. This system is **not** a certified medical diagnostic device and should not be used as a substitute for professional clinical diagnosis.
