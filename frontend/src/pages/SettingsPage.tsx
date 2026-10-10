import { useEffect, useState } from "react";
import { CheckCircle2, Eye, Gauge, HardDrive, Settings, Crosshair } from "lucide-react";
import { useGazeStore } from "@/stores/gazeStore";

const SETTINGS_KEY = "eyecog_settings";

type EyeTracker = "webcam" | "mouse" | "tobii_pro" | "tobii_eyex";
type NormProfile = "adult" | "paediatric" | "research";
type RetentionDays = 30 | 60 | 90 | 180;

interface EyeCogSettings {
  eyeTracker: EyeTracker;
  normProfile: NormProfile;
  retentionDays: RetentionDays;
}

const DEFAULTS: EyeCogSettings = {
  eyeTracker: "webcam",
  normProfile: "adult",
  retentionDays: 90,
};

function loadSettings(): EyeCogSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const EYE_TRACKERS: { value: EyeTracker; label: string; status: "primary" | "active" | "requires_device"; desc: string }[] = [
  { value: "webcam", label: "Laptop Webcam (MediaPipe)", status: "primary", desc: "Real-time face & iris tracking with 9-point calibration. No external hardware required." },
  { value: "mouse", label: "Mouse Proxy / Demo", status: "active", desc: "Uses cursor movement as gaze proxy. Recommended for manual testing or demonstration." },
  { value: "tobii_pro", label: "Tobii Pro Nano", status: "requires_device", desc: "Requires connected USB Tobii Pro hardware." },
  { value: "tobii_eyex", label: "Tobii EyeX", status: "requires_device", desc: "Requires connected Tobii EyeX consumer device." },
];

const NORM_PROFILES: { value: NormProfile; label: string; desc: string }[] = [
  { value: "adult", label: "Adult", desc: "Ages 18–65 · Standard clinical norms" },
  { value: "paediatric", label: "Paediatric", desc: "Ages 6–17 · Adjusted accuracy thresholds" },
  { value: "research", label: "Research", desc: "No normative comparison · Raw metrics only" },
];

const RETENTION_OPTIONS: { value: RetentionDays; label: string }[] = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
];

function StatusBadge({ status }: { status: "primary" | "active" | "requires_device" }) {
  if (status === "primary")
    return <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-eyecog-teal border border-teal-200">Primary</span>;
  if (status === "active")
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Device required</span>;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<EyeCogSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const { setGazeSource, isCalibrated, setCalibrationModalOpen } = useGazeStore();

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const update = <K extends keyof EyeCogSettings>(key: K, value: EyeCogSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "eyeTracker") {
      if (value === "webcam" || value === "mouse") {
        setGazeSource(value);
      }
    }
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (settings.eyeTracker === "webcam" || settings.eyeTracker === "mouse") {
      setGazeSource(settings.eyeTracker);
    }
    setSaved(true);
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
    setGazeSource("webcam");
    localStorage.removeItem(SETTINGS_KEY);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-eyecog-teal" />
        <h1 className="text-lg font-semibold text-slate-800">Settings</h1>
      </div>

      {/* ── Eye Tracker ── */}
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-eyecog-teal" />
            <h2 className="text-sm font-semibold text-slate-700">Eye Tracker Device</h2>
          </div>
          {isCalibrated && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> 9-Point Calibrated
            </span>
          )}
        </div>
        <div className="space-y-2.5">
          {EYE_TRACKERS.map((et) => (
            <label
              key={et.value}
              className={`flex cursor-pointer items-start justify-between rounded-lg border-2 p-4 transition-colors ${
                settings.eyeTracker === et.value
                  ? "border-eyecog-teal bg-eyecog-teal/5"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="eyeTracker"
                  value={et.value}
                  checked={settings.eyeTracker === et.value}
                  onChange={() => update("eyeTracker", et.value)}
                  className="mt-0.5 accent-eyecog-teal"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800">{et.label}</span>
                  <p className="mt-0.5 text-xs text-slate-500">{et.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <StatusBadge status={et.status} />
                {et.value === "webcam" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCalibrationModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-eyecog-teal px-2.5 py-1 text-xs font-semibold text-eyecog-teal hover:bg-eyecog-teal/10"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    {isCalibrated ? "Recalibrate" : "Calibrate"}
                  </button>
                )}
              </div>
            </label>
          ))}
        </div>
      </section>


      {/* ── Normative Profile ── */}
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-eyecog-teal" />
          <h2 className="text-sm font-semibold text-slate-700">Normative Profile</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {NORM_PROFILES.map((np) => (
            <button
              key={np.value}
              type="button"
              onClick={() => update("normProfile", np.value)}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                settings.normProfile === np.value
                  ? "border-eyecog-teal bg-eyecog-teal/5"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-sm font-semibold text-slate-700">{np.label}</p>
              <p className="mt-1 text-xs text-slate-400">{np.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Data Retention ── */}
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-eyecog-teal" />
          <h2 className="text-sm font-semibold text-slate-700">Data Retention</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Sessions and gaze data older than this period will be eligible for deletion.
        </p>
        <div className="flex gap-2">
          {RETENTION_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => update("retentionDays", r.value)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                settings.retentionDays === r.value
                  ? "border-eyecog-teal bg-eyecog-teal/10 text-eyecog-teal"
                  : "border-slate-300 text-slate-600 hover:border-eyecog-teal hover:text-eyecog-teal"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-md bg-eyecog-teal px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600"
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </div>
  );
}
