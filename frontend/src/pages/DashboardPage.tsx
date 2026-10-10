import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  PlusCircle,
  Target,
  Camera,
  MousePointer,
  Crosshair,
  Sparkles,
  Users,
} from "lucide-react";
import { getDashboardSummary } from "@/lib/api";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PatientAssessmentsTable } from "@/components/dashboard/PatientAssessmentsTable";
import { useGazeStore } from "@/stores/gazeStore";

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  const { isCameraActive, isCalibrated, setCalibrationModalOpen } = useGazeStore();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-eyecog-navy to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-eyecog-teal/20 px-2.5 py-0.5 text-xs font-semibold text-eyecog-teal ring-1 ring-eyecog-teal/40">
                <Sparkles className="h-3 w-3" />
                VISIONEXIS v2.0
              </span>
              <span className="text-xs text-slate-400">Research &amp; Assessment System</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Patient Assessment Dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-300">
              Unified visual-cognitive battery combining Visual Search, Memory &amp; Recognition, and Reading &amp; Comprehension with simultaneous webcam gaze and motor tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/new-session"
              className="flex items-center gap-2 rounded-lg bg-eyecog-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              New Patient Assessment
            </Link>
          </div>
        </div>

        {/* Live Hardware Status Indicators */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-700/60 pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-800/60 px-3.5 py-2">
            <Camera className={`h-4 w-4 ${isCameraActive ? "text-emerald-400" : "text-amber-400"}`} />
            <div>
              <p className="text-[11px] font-medium text-slate-400">Webcam Stream</p>
              <p className="text-xs font-semibold text-slate-200">
                {isCameraActive ? "Online (MediaPipe Mesh)" : "Standby (Click Start in Task)"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3.5 py-2">
            <div className="flex items-center gap-2.5">
              <Crosshair className={`h-4 w-4 ${isCalibrated ? "text-emerald-400" : "text-amber-400"}`} />
              <div>
                <p className="text-[11px] font-medium text-slate-400">9-Point Calibration</p>
                <p className="text-xs font-semibold text-slate-200">
                  {isCalibrated ? "Calibrated (Ridge Model)" : "Uncalibrated"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCalibrationModalOpen(true)}
              className="rounded bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-200 hover:bg-slate-600"
            >
              {isCalibrated ? "Recalibrate" : "Calibrate"}
            </button>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg bg-slate-800/60 px-3.5 py-2">
            <MousePointer className="h-4 w-4 text-purple-400" />
            <div>
              <p className="text-[11px] font-medium text-slate-400">Mouse Kinematics</p>
              <p className="text-xs font-semibold text-slate-200">Dual-Stream Synchronized</p>
            </div>
          </div>
        </div>
      </div>

      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load dashboard data. Please verify the backend service is running on port 8001.
        </div>
      )}

      {data && data.kpis.flagged_cases > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          {data.kpis.flagged_cases} session{data.kpis.flagged_cases > 1 ? "s" : ""} recorded
          accuracy below the 70% exploratory research threshold.
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Patients Assessed"
          value={isLoading ? "—" : String(data?.patient_assessments?.length ?? 0)}
          icon={Users}
          accent="blue"
        />
        <KpiCard
          label="Avg Battery Accuracy"
          value={isLoading || data?.kpis.avg_accuracy == null ? "—" : `${data.kpis.avg_accuracy}%`}
          icon={Target}
          accent="green"
        />
        <KpiCard
          label="Flagged Cases"
          value={isLoading ? "—" : String(data?.kpis.flagged_cases ?? 0)}
          icon={AlertTriangle}
          accent="orange"
        />
        <KpiCard
          label="Avg Task RT"
          value={isLoading || data?.kpis.avg_task_time_s == null ? "—" : `${data.kpis.avg_task_time_s}s`}
          icon={Clock}
          accent="teal"
        />
      </div>

      {/* Patient Assessments Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Patient Assessment Records
            </h2>
            <p className="text-xs text-slate-500">
              One row per patient assessment attempt with unified report view, PDF download, and retake actions.
            </p>
          </div>
          <Link
            to="/reports"
            className="text-xs font-semibold text-eyecog-teal hover:underline inline-flex items-center gap-1"
          >
            All Reports &rarr;
          </Link>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            Loading patient assessments&hellip;
          </div>
        ) : (
          <PatientAssessmentsTable
            assessments={data?.patient_assessments ?? []}
            onRefetch={refetch}
          />
        )}
      </div>
    </div>
  );
}

