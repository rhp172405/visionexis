import { useLocation } from "react-router-dom";
import { Camera, MousePointer, Crosshair, Terminal } from "lucide-react";
import { useGazeStore } from "@/stores/gazeStore";
import { globalWebcamManager } from "@/lib/webcam/webcamManager";

const TITLES: Record<string, string> = {
  "/": "Patient Assessment Dashboard",
  "/new-session": "New Patient Intake & Assessment",
  "/calibration": "Gaze Calibration & Validation",
  "/tasks/visual-search": "Visual Search Task (1 of 3)",
  "/tasks/memory-recognition": "Memory & Recognition Task (2 of 3)",
  "/tasks/memory": "Memory & Recognition Task (2 of 3)",
  "/tasks/reading-comprehension": "Reading & Comprehension Task (3 of 3)",
  "/tasks/reading": "Reading & Comprehension Task (3 of 3)",
  "/reports": "Assessment Reports",
  "/assessment": "Assessment Hub",
  "/webcam-test": "Webcam Diagnostics",
  "/settings": "Settings",
};

export function HeaderBar() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "VISIONEXIS";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const {
    gazeSource,
    isCameraActive,
    isCalibrated,
    debugOverlayOpen,
    setDebugOverlayOpen,
    setCalibrationModalOpen,
  } = useGazeStore();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3.5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-400">{today}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Eye Tracker Status Chip */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          {gazeSource === "webcam" ? (
            <button
              type="button"
              onClick={() => {
                if (!isCameraActive) {
                  globalWebcamManager.startCamera();
                }
              }}
              title={isCameraActive ? "Webcam tracking active" : "Click to start camera"}
              className="flex items-center gap-1.5 font-medium hover:text-slate-900 cursor-pointer"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
                }`}
              />
              <Camera className="h-3.5 w-3.5 text-eyecog-teal" />
              Webcam {isCameraActive ? "(Active)" : "(Click to Start)"}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <MousePointer className="h-3.5 w-3.5 text-slate-400" />
              Mouse / Demo
            </span>
          )}

          {gazeSource === "webcam" && (
            <button
              type="button"
              onClick={() => setCalibrationModalOpen(true)}
              className={`ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                isCalibrated
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-200"
              }`}
            >
              <Crosshair className="h-2.5 w-2.5" />
              {isCalibrated ? "Calibrated ✓" : "Calibrate"}
            </button>
          )}
        </div>

        {/* Debug Telemetry Toggle Button */}
        <button
          type="button"
          onClick={() => setDebugOverlayOpen(!debugOverlayOpen)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            debugOverlayOpen
              ? "border-eyecog-teal bg-eyecog-teal/10 text-eyecog-teal"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          title="Toggle real-time developer debug overlay"
        >
          <Terminal className="h-3.5 w-3.5" />
          Debug Panel
        </button>
      </div>
    </header>
  );
}


