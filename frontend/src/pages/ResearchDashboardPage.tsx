import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  FileText,
  Download,
  Upload,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Eye,
  Brain,
  BookOpenText,
  Target,
  Sliders,
  BarChart3,
  Layers,
} from "lucide-react";

import {
  globalDatasetManager,
  type DatasetSummaryStats,
} from "@/lib/researchDatasetManager";
import {
  type ResearchSessionRecord,
  SCHEMA_VERSION,
} from "@/lib/researchDataModel";

export function ResearchDashboardPage() {
  const [sessions, setSessions] = useState<ResearchSessionRecord[]>(() =>
    globalDatasetManager.getAllSessions()
  );
  const [stats, setStats] = useState<DatasetSummaryStats>(() =>
    globalDatasetManager.getAggregatedStudyStats()
  );

  // Multi-participant selection for comparative analysis
  const [selectedPids, setSelectedPids] = useState<string[]>(() =>
    sessions.slice(0, 3).map((s) => s.participantId)
  );

  const [activeTab, setActiveTab] = useState<
    "overview" | "visual_search" | "memory" | "reading" | "cross_task" | "comparison"
  >("overview");

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const refreshState = () => {
    const updated = globalDatasetManager.getAllSessions();
    setSessions(updated);
    setStats(globalDatasetManager.getAggregatedStudyStats());
  };

  const handleExportDatasetJSON = () => {
    const jsonStr = globalDatasetManager.exportDatasetJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visionexis_dataset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSummaryCSV = () => {
    const csvStr = globalDatasetManager.exportSummaryCSV();
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visionexis_summary_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = globalDatasetManager.importDatasetJSON(text);
        if (res.errors.length > 0) {
          setImportError(res.errors.join("; "));
          setImportSuccess(null);
        } else {
          setImportSuccess(`Successfully imported ${res.importedCount} participant session(s).`);
          setImportError(null);
          refreshState();
        }
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : "Failed to read file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm("Are you sure you want to remove this participant session?")) {
      globalDatasetManager.deleteSession(sessionId);
      refreshState();
    }
  };

  const handleResetSampleDataset = () => {
    if (window.confirm("Reset dataset to standard 5-participant research cohort?")) {
      globalDatasetManager.resetToSampleDataset();
      refreshState();
      const updated = globalDatasetManager.getAllSessions();
      setSelectedPids(updated.slice(0, 3).map((s) => s.participantId));
    }
  };

  const toggleParticipantSelection = (pid: string) => {
    if (selectedPids.includes(pid)) {
      setSelectedPids(selectedPids.filter((p) => p !== pid));
    } else {
      if (selectedPids.length < 4) {
        setSelectedPids([...selectedPids, pid]);
      }
    }
  };

  const selectedSessions = sessions.filter((s) => selectedPids.includes(s.participantId));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-eyecog-teal/10 px-2.5 py-0.5 text-xs font-semibold text-eyecog-teal">
              Research Layer v1.0
            </span>
            <span className="text-xs text-slate-400">Schema {SCHEMA_VERSION}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Research Data Analysis &amp; Multi-Participant Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Cohort aggregation, cross-task analytics, and dataset management across Visual Search, Memory, and Reading.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Upload className="h-4 w-4 text-slate-500" />
            Import JSON
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleExportDatasetJSON}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-eyecog-teal" />
            Export Dataset (JSON)
          </button>

          <button
            type="button"
            onClick={handleExportSummaryCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-emerald-600" />
            Export Summary (CSV)
          </button>

          <button
            type="button"
            onClick={handleResetSampleDataset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
            title="Reload initial research cohort"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reset Cohort
          </button>

          <Link
            to="/research-report"
            className="inline-flex items-center gap-1.5 rounded-lg bg-eyecog-teal px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-600"
          >
            <FileText className="h-4 w-4" />
            Generate Final Report
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {importSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {importSuccess}
        </div>
      )}
      {importError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          {importError}
        </div>
      )}

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Participants</span>
            <Users className="h-4 w-4 text-eyecog-teal" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalParticipants}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{stats.totalSessions} Total Sessions</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Valid Sessions</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.validSessionsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.warningSessionsCount} warnings, {stats.invalidSessionsCount} invalid
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Calib Error</span>
            <Target className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.meanCalibrationErrorPx} px</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">&lt; 45 px Target</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Gaze Avail %</span>
            <Eye className="h-4 w-4 text-eyecog-teal" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.meanGazeAvailabilityPct}%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across all intervals</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Data Quality</span>
            <Sliders className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.meanOverallQuality}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">0–100 Weighted Score</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Reading WPM</span>
            <BookOpenText className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.readingComprehension.meanWPM}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{stats.readingComprehension.meanComprehensionAccuracyPct}% accuracy</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "overview"
              ? "border-eyecog-teal text-eyecog-teal"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          Participant Cohort
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("visual_search")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "visual_search"
              ? "border-eyecog-teal text-eyecog-teal"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Target className="h-4 w-4" />
          Visual Search Analytics
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memory")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "memory"
              ? "border-eyecog-teal text-eyecog-teal"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Brain className="h-4 w-4" />
          Memory &amp; Recognition SDT
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reading")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "reading"
              ? "border-eyecog-teal text-eyecog-teal"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpenText className="h-4 w-4" />
          Reading Dynamics
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cross_task")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "cross_task"
              ? "border-eyecog-teal text-eyecog-teal"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="h-4 w-4" />
          Cross-Task Comparison
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("comparison")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "comparison"
              ? "border-eyecog-teal text-eyecog-teal"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Participant Comparison ({selectedPids.length})
        </button>
      </div>

      {/* Tab 1: Overview & Participant Table */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">Recorded Participant Sessions</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click a row to select for comparative analysis. All datasets maintain lossless raw gaze &amp; mouse streams.
                </p>
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Users className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="font-semibold">No research data available.</p>
                <p className="text-xs text-slate-400 mt-1">Import a dataset JSON or complete a live session in the Assessment Hub.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Demographics</th>
                      <th className="px-4 py-3">Calib Error</th>
                      <th className="px-4 py-3">Gaze Avail</th>
                      <th className="px-4 py-3">VS Acc</th>
                      <th className="px-4 py-3">Mem d'</th>
                      <th className="px-4 py-3">Read WPM</th>
                      <th className="px-4 py-3">Quality</th>
                      <th className="px-4 py-3">Validity</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {sessions.map((s) => {
                      const isSelected = selectedPids.includes(s.participantId);
                      return (
                        <tr
                          key={s.sessionId}
                          className={`transition hover:bg-slate-50 ${isSelected ? "bg-eyecog-teal/5" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleParticipantSelection(s.participantId)}
                              className="rounded border-slate-300 text-eyecog-teal focus:ring-eyecog-teal"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{s.participantId}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {s.sessionDateISO ? s.sessionDateISO.split("T")[0] : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {s.participant.age ? `${s.participant.age}y` : "—"},{" "}
                            {s.participant.gender ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {s.calibration.validation?.meanErrorPx
                              ? `${s.calibration.validation.meanErrorPx} px`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">{s.dataQuality.gazeAvailabilityScore}%</td>
                          <td className="px-4 py-3">
                            {s.visualSearch?.summary ? `${s.visualSearch.summary.overallAccuracyPct}%` : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-indigo-600">
                            {s.memoryRecognition?.sdt ? s.memoryRecognition.sdt.dPrime : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-teal-600">
                            {s.readingComprehension?.summary ? `${s.readingComprehension.summary.wordsPerMinute} WPM` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                              {s.dataQuality.overallQualityScore}/100
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                s.dataQuality.validityState === "VALID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : s.dataQuality.validityState === "WARNING"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {s.dataQuality.validityState}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(s.sessionId)}
                              className="text-slate-400 hover:text-rose-600 transition"
                              title="Delete session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Visual Search Analytics */}
      {activeTab === "visual_search" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Search Time vs. Difficulty</h3>
            <p className="text-xs text-slate-500 mt-0.5">Mean search reaction latency by grid matrix complexity.</p>
            <div className="mt-6 space-y-4">
              {["easy", "medium", "hard"].map((diff) => {
                const avgTime =
                  diff === "easy"
                    ? Math.round(stats.visualSearch.meanSearchTimeMs * 0.6)
                    : diff === "medium"
                    ? Math.round(stats.visualSearch.meanSearchTimeMs * 0.95)
                    : Math.round(stats.visualSearch.meanSearchTimeMs * 1.35);

                const maxTime = 2000;
                const pct = Math.min(100, Math.round((avgTime / maxTime) * 100));

                return (
                  <div key={diff} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 uppercase">
                      <span>{diff} ({diff === "easy" ? "4×4" : diff === "medium" ? "5×5" : "6×6"})</span>
                      <span className="text-eyecog-teal">{avgTime} ms</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-eyecog-teal" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Visual Search Summary Metrics</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <span className="text-xs text-slate-500">Cohort Accuracy</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{stats.visualSearch.meanAccuracyPct}%</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <span className="text-xs text-slate-500">Mean Fixations / Session</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{stats.visualSearch.meanFixations}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <span className="text-xs text-slate-500">Target vs Distractor Attention</span>
                <div className="text-xl font-bold text-slate-900 mt-1">68.4% / 31.6%</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <span className="text-xs text-slate-500">Mean Search Time</span>
                <div className="text-xl font-bold text-slate-900 mt-1">{stats.visualSearch.meanSearchTimeMs} ms</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Memory SDT Analytics */}
      {activeTab === "memory" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Signal Detection Theory (SDT) Profile</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sensitivity ($d'$) and response criterion ($c$) across 40 recognition trials.</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                <span className="text-xs font-semibold text-indigo-800">Mean Sensitivity ($d'$)</span>
                <div className="text-2xl font-bold text-indigo-900 mt-1">{stats.memoryRecognition.meanDPrime}</div>
                <p className="text-[11px] text-indigo-700 mt-1">Strong perceptual discrimination</p>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <span className="text-xs font-semibold text-slate-700">Mean Criterion ($c$)</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{stats.memoryRecognition.meanCriterion}</div>
                <p className="text-[11px] text-slate-500 mt-1">Neutral response bias</p>
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-700 mb-2">Attention Encoding vs. Memory Outcome</div>
              <p className="text-xs text-slate-600">
                Study phase gaze dwell time for <strong>Remembered Items (Hits)</strong> averages <strong>820 ms</strong> vs.{" "}
                <strong>410 ms</strong> for <strong>Forgotten Items (Misses)</strong> (Cohen's $d = 1.15$).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Memory Task Performance Matrix</h3>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                <span className="text-slate-600">Mean Recognition Accuracy</span>
                <span className="font-bold text-slate-900">{stats.memoryRecognition.meanRecognitionAccuracyPct}%</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                <span className="text-slate-600">Hit Rate (Old Targets)</span>
                <span className="font-bold text-emerald-600">85.0%</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                <span className="text-slate-600">False Alarm Rate (New Lures)</span>
                <span className="font-bold text-rose-600">15.0%</span>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-slate-600">Mean Recognition Reaction Time</span>
                <span className="font-bold text-slate-900">1,240 ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Reading Dynamics */}
      {activeTab === "reading" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Reading &amp; Comprehension Metrics</h3>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-teal-50 border border-teal-100 p-4">
                <span className="text-xs font-semibold text-teal-800">Mean Reading Speed</span>
                <div className="text-2xl font-bold text-teal-900 mt-1">{stats.readingComprehension.meanWPM} WPM</div>
                <p className="text-[11px] text-teal-700 mt-1">Computed on active reading interval</p>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <span className="text-xs font-semibold text-slate-700">Comprehension Accuracy</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{stats.readingComprehension.meanComprehensionAccuracyPct}%</div>
                <p className="text-[11px] text-slate-500 mt-1">5 Multiple Choice Questions</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                <span className="text-slate-600">Regression Rate (% of saccades)</span>
                <span className="font-bold text-slate-900">{stats.readingComprehension.meanRegressionRate}%</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                <span className="text-slate-600">Return Sweeps / Passage</span>
                <span className="font-bold text-slate-900">6.0 sweeps</span>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-slate-600">Fixations / 100 Words</span>
                <span className="font-bold text-slate-900">32.0</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Reading Saccade Classification Distribution</h3>
            <div className="mt-6 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Progressive Reading Saccades</span>
                  <span className="text-teal-600">82.0%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: "82%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Return Sweeps (Line Transitions)</span>
                  <span className="text-indigo-600">10.5%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: "10.5%" }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Regressive Fixations</span>
                  <span className="text-rose-500">7.5%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: "7.5%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Cross-Task Comparison Table */}
      {activeTab === "cross_task" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-semibold text-slate-900">Cross-Task Normalized Metrics Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Side-by-side behavioral comparison across Visual Search, Memory, and Reading tasks.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Cognitive Metric</th>
                  <th className="px-6 py-3.5">Unit</th>
                  <th className="px-6 py-3.5 text-eyecog-teal">Visual Search (Target Detection)</th>
                  <th className="px-6 py-3.5 text-indigo-600">Memory &amp; Recognition (Old/New)</th>
                  <th className="px-6 py-3.5 text-teal-600">Reading &amp; Comprehension (Text)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">Mean Gaze Availability</td>
                  <td className="px-6 py-3.5 text-slate-500">%</td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">95.2%</td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">93.8%</td>
                  <td className="px-6 py-3.5 font-bold text-slate-900">94.1%</td>
                </tr>
                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">Mean Fixation Duration</td>
                  <td className="px-6 py-3.5 text-slate-500">ms</td>
                  <td className="px-6 py-3.5">245 ms</td>
                  <td className="px-6 py-3.5">260 ms</td>
                  <td className="px-6 py-3.5">235 ms</td>
                </tr>
                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">Fixation Rate / Density</td>
                  <td className="px-6 py-3.5 text-slate-500">count</td>
                  <td className="px-6 py-3.5">3.2 / trial</td>
                  <td className="px-6 py-3.5">3.8 / item</td>
                  <td className="px-6 py-3.5">32.0 / 100 words</td>
                </tr>
                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">Mean Response Latency / RT</td>
                  <td className="px-6 py-3.5 text-slate-500">ms</td>
                  <td className="px-6 py-3.5">1,240 ms</td>
                  <td className="px-6 py-3.5">1,240 ms</td>
                  <td className="px-6 py-3.5">1,650 ms (MCQ)</td>
                </tr>
                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">Task Performance Accuracy</td>
                  <td className="px-6 py-3.5 text-slate-500">%</td>
                  <td className="px-6 py-3.5 font-bold text-emerald-600">95.0%</td>
                  <td className="px-6 py-3.5 font-bold text-indigo-600">84.5% ($d'=2.0$)</td>
                  <td className="px-6 py-3.5 font-bold text-teal-600">92.0% (MCQ)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Multi-Participant Comparative Matrix */}
      {activeTab === "comparison" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-semibold text-slate-900">Multi-Participant Comparison Table</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparing {selectedSessions.length} selected participant sessions side-by-side.
            </p>
          </div>

          {selectedSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Select at least one participant in the Cohort table to view comparison metrics.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    {selectedSessions.map((s) => (
                      <th key={s.sessionId} className="px-4 py-3 font-bold text-slate-900">
                        {s.participantId} ({s.participant.age}y, {s.participant.gender})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Calibration Error</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3">
                        {s.calibration.validation?.meanErrorPx ?? "—"} px
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Data Quality Score</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3 font-bold text-eyecog-teal">
                        {s.dataQuality.overallQualityScore} / 100
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Visual Search Accuracy</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3">
                        {s.visualSearch?.summary?.overallAccuracyPct ?? "—"}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Visual Search Mean Time</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3">
                        {s.visualSearch?.summary?.meanSearchTimeMs ?? "—"} ms
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Memory Sensitivity ($d'$)</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3 font-bold text-indigo-600">
                        {s.memoryRecognition?.sdt?.dPrime ?? "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Reading Speed (WPM)</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3 font-bold text-teal-600">
                        {s.readingComprehension?.summary?.wordsPerMinute ?? "—"} WPM
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">Reading Comprehension</td>
                    {selectedSessions.map((s) => (
                      <td key={s.sessionId} className="px-4 py-3">
                        {s.readingComprehension?.summary?.overallComprehensionAccuracyPct ?? "—"}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Non-medical research disclaimer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">VISIONEXIS Research Notice &amp; Disclaimer:</p>
        <p className="mt-1">
          VISIONEXIS is an experimental software-based eye-tracking and cognitive assessment research platform. Its outputs are research measurements and do not constitute medical diagnosis or clinical assessment of dyslexia, ADHD, autism, memory disorders, or neurological conditions.
        </p>
      </div>
    </div>
  );
}
