import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
  GitCompare,
  ShieldAlert,
} from "lucide-react";
import type { IntegratedVisualCognitiveProfile } from "@/types";

interface Props {
  profile: IntegratedVisualCognitiveProfile;
}

export function BaselineVisualFunctionProfileSection({ profile }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 p-6 space-y-4 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-eyecog-teal">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              2. Baseline Visual Function Profile (MBT &amp; Vergence)
            </h3>
            <p className="text-xs text-slate-500">
              Measured visual acuity, Modified Thorington phoria, vergence limits (PFV, NFB), and near point convergence.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Validated Reference Criteria (Morgan / Scheiman &amp; Wick)
        </span>
      </div>

      {/* Normative Reference Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-3">Visual Parameter</th>
              <th className="py-2.5 px-3">Measured Value</th>
              <th className="py-2.5 px-3">Standard Reference Criterion</th>
              <th className="py-2.5 px-3">Criterion Source</th>
              <th className="py-2.5 px-3">Alignment Status</th>
              <th className="py-2.5 px-3">Researcher Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profile.baselineCriteria.map((c, i) => {
              const isMeasured = c.status !== "unmeasured";
              const isNormal = c.status === "within_criterion";

              return (
                <tr key={i} className="hover:bg-slate-50/50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {c.parameter}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {c.measuredValue != null ? `${c.measuredValue} ${c.unit !== "Snellen / LogMAR" && c.unit !== "Snellen" && c.unit !== "Δ" && !String(c.measuredValue).includes(c.unit) ? c.unit : ""}` : (
                      <span className="text-slate-400 italic">Not measured</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {c.normativeRange}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-400">
                    {c.source}
                  </td>
                  <td className="py-2.5 px-3">
                    {!isMeasured ? (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Not Measured
                      </span>
                    ) : isNormal ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Within Criterion
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Info className="h-3 w-3" /> Outside Criterion
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs">
                    {c.clinicalNote || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 italic pt-1">
        Note: Out-of-criterion visual measurements reflect empirical optometric observations for research association and do not independently constitute a clinical diagnosis.
      </p>
    </div>
  );
}

export function IntegratedCrossDomainAnalysisSection({ profile }: Props) {
  return (
    <div className="space-y-6">

      {/* SECTION 7: INTEGRATED VISUAL–COGNITIVE ANALYSIS */}
      <div className="rounded-xl border border-slate-200 p-6 space-y-4 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                7. Integrated Visual–Cognitive Analysis (Cross-Domain Hypotheses)
              </h3>
              <p className="text-xs text-slate-500">
                Transparent cross-domain comparisons linking baseline binocular vision variables with task oculomotor behaviour and cognitive outcomes.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            Research Evaluation Layer
          </span>
        </div>

        {/* Methodology Notice */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-eyecog-teal" />
            Analysis Methodology &amp; Sample Size Integrity Notice
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            For individual patient/participant assessments (n = 1 session), outcomes are displayed as <strong>Individual Descriptive Comparisons</strong>.
            In compliance with research integrity standards, inferential correlation coefficients (Pearson <em>r</em> or Spearman <em>&rho;</em>) and <em>p</em>-values
            are strictly restricted to multi-participant cohort analyses (minimum sample size n &ge; 10 independent participants).
          </p>
        </div>

        {/* Comparison Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.crossDomainComparisons.map((comp) => {
            const hasData = comp.sampleCount > 0;

            return (
              <div
                key={comp.id}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                    {comp.taskName}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      hasData
                        ? "bg-teal-50 text-eyecog-teal border border-teal-100"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {comp.analysisMethod} (n={comp.sampleCount})
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {comp.hypothesis}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Baseline Variable</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{comp.baselineParameter}</p>
                    <p className="font-mono text-xs font-bold text-purple-700 mt-0.5">{comp.baselineValue}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Task Outcome</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{comp.taskOutcome}</p>
                    <p className="font-mono text-xs font-bold text-eyecog-teal mt-0.5">{comp.taskValue}</p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 leading-normal">
                  <span className="font-semibold text-slate-700">Observation: </span>
                  {comp.notesAndLimitations}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 8: RESEARCH INTERPRETATION AND LIMITATIONS */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
          <ShieldAlert className="h-4 w-4 text-eyecog-teal" />
          8. Research Interpretation &amp; Technical Limitations
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {profile.overallResearchInterpretation}
        </p>
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Technical Note:</strong> {profile.limitationsNotice}
          </div>
        </div>
      </div>
    </div>
  );
}
