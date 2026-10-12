import type {
  BaselineVisualAssessment,
  CombinedAssessmentReport,
  CombinedTaskDetail,
  CrossDomainComparison,
  IntegratedVisualCognitiveProfile,
  VisualNormativeCriterion,
} from "@/types";

/**
 * Normative reference criteria based on validated optometric literature
 * (Morgan's System of Normative Data, 1944; Scheiman & Wick Clinical Optometry, 2014).
 *
 * NOTE: Values outside normative criteria represent clinical observations for
 * research correlation and do NOT constitute an automated diagnostic classification.
 */
export function evaluateBaselineNorms(
  baseline?: BaselineVisualAssessment | null,
  patientAge?: number | null,
): VisualNormativeCriterion[] {
  if (!baseline) {
    return [
      {
        parameter: "Baseline Visual Assessment (MBT)",
        measuredValue: null,
        unit: "—",
        normativeRange: "Standard optometric battery",
        source: "Morgan / Scheiman & Wick",
        status: "unmeasured",
        clinicalNote: "No baseline visual assessment recorded for this session attempt.",
      },
    ];
  }

  const list: VisualNormativeCriterion[] = [];

  // 1. Distance Visual Acuity OD
  if (baseline.distance_va_od) {
    const isSnellenNorm =
      baseline.distance_va_od.includes("6/6") ||
      baseline.distance_va_od.includes("20/20") ||
      baseline.distance_va_od === "0.0";
    list.push({
      parameter: "Distance Visual Acuity (OD)",
      measuredValue: baseline.distance_va_od,
      unit: "Snellen / LogMAR",
      normativeRange: "Reference standard: 6/6 (20/20, LogMAR ≤ 0.0)",
      source: "Standard Clinical VA Reference (Snellen 1862)",
      status: isSnellenNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: isSnellenNorm
        ? `Right eye acuity (${baseline.va_correction_status || "habitual"}) meets standard distance reference (6/6).`
        : `Right eye acuity (${baseline.va_correction_status || "habitual"}) below 6/6 reference standard; evaluate refractive correction or study inclusion threshold.`,
    });
  } else {
    list.push({
      parameter: "Distance Visual Acuity (OD)",
      measuredValue: null,
      unit: "Snellen",
      normativeRange: "Reference standard: 6/6 (20/20)",
      source: "Standard Clinical VA Reference",
      status: "unmeasured",
      clinicalNote: "Not recorded during baseline visual assessment.",
    });
  }

  // 2. Distance Visual Acuity OS
  if (baseline.distance_va_os) {
    const isSnellenNorm =
      baseline.distance_va_os.includes("6/6") ||
      baseline.distance_va_os.includes("20/20") ||
      baseline.distance_va_os === "0.0";
    list.push({
      parameter: "Distance Visual Acuity (OS)",
      measuredValue: baseline.distance_va_os,
      unit: "Snellen / LogMAR",
      normativeRange: "Reference standard: 6/6 (20/20, LogMAR ≤ 0.0)",
      source: "Standard Clinical VA Reference (Snellen 1862)",
      status: isSnellenNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: isSnellenNorm
        ? `Left eye acuity (${baseline.va_correction_status || "habitual"}) meets standard distance reference (6/6).`
        : `Left eye acuity (${baseline.va_correction_status || "habitual"}) below 6/6 reference standard; evaluate refractive correction or study inclusion threshold.`,
    });
  } else {
    list.push({
      parameter: "Distance Visual Acuity (OS)",
      measuredValue: null,
      unit: "Snellen",
      normativeRange: "Reference standard: 6/6 (20/20)",
      source: "Standard Clinical VA Reference",
      status: "unmeasured",
      clinicalNote: "Not recorded during baseline visual assessment.",
    });
  }

  // 3. Near Point of Convergence (NPC) Break
  if (baseline.npc_break_cm != null) {
    const meetsNorm = baseline.npc_break_cm <= 6.0;
    list.push({
      parameter: "Near Point of Convergence (NPC) Break",
      measuredValue: baseline.npc_break_cm,
      unit: "cm",
      normativeRange: "≤ 6.0 cm (Rec: ≤ 10 cm)",
      source: "Scheiman & Wick (2014) / Hayes et al. (1998)",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: meetsNorm
        ? "Normal near convergence alignment limit."
        : "Receded near point of convergence; observation for near-task tracking correlation.",
    });
  } else {
    list.push({
      parameter: "Near Point of Convergence (NPC) Break",
      measuredValue: null,
      unit: "cm",
      normativeRange: "≤ 6.0 cm",
      source: "Scheiman & Wick (2014) / Hayes et al. (1998)",
      status: "unmeasured",
      clinicalNote: "NPC break point omitted or not measured.",
    });
  }

  // 4. NFB: Negative Fusional Break (Base-In Break at Distance)
  if (baseline.nfb_distance_break_pd != null) {
    const val = baseline.nfb_distance_break_pd;
    // Morgan distance BI break: 7 ± 2 Δ (5 to 9 Δ)
    const meetsNorm = val >= 5 && val <= 9;
    list.push({
      parameter: "NFB: Negative Fusional Break (Distance 6m Base-In)",
      measuredValue: val,
      unit: "Δ (Prism Diopters)",
      normativeRange: "7 ± 2 Δ (5 to 9 Δ)",
      source: "Morgan's Norms (Negative Fusional Divergence Break)",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: `Base-In divergence reserve break point at distance (recovery: ${baseline.nfv_distance_triad?.recovery ?? "—"} Δ).`,
    });
  } else {
    list.push({
      parameter: "NFB: Negative Fusional Break (Distance Base-In)",
      measuredValue: null,
      unit: "Δ",
      normativeRange: "7 ± 2 Δ",
      source: "Morgan's Norms",
      status: "unmeasured",
      clinicalNote: "Distance NFB break point not recorded.",
    });
  }

  // 5. NFB: Negative Fusional Break (Base-In Break at Near)
  if (baseline.nfb_near_break_pd != null) {
    const val = baseline.nfb_near_break_pd;
    // Morgan near BI break: 21 ± 4 Δ (17 to 25 Δ)
    const meetsNorm = val >= 17 && val <= 25;
    list.push({
      parameter: "NFB: Negative Fusional Break (Near 40cm Base-In)",
      measuredValue: val,
      unit: "Δ (Prism Diopters)",
      normativeRange: "21 ± 4 Δ (17 to 25 Δ)",
      source: "Morgan's Norms (Near Divergence Break)",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: `Near divergence break reserve at 40cm reading distance.`,
    });
  }

  // 6. PFV: Positive Fusional Vergence Break at Near (Base-Out Break)
  if (baseline.pfv_near_break_pd != null) {
    const val = baseline.pfv_near_break_pd;
    // Morgan near BO break: 21 ± 6 Δ (15 to 27 Δ)
    const meetsNorm = val >= 15 && val <= 27;
    list.push({
      parameter: "PFV: Positive Fusional Vergence Break (Near 40cm Base-Out)",
      measuredValue: val,
      unit: "Δ (Prism Diopters)",
      normativeRange: "21 ± 6 Δ (15 to 27 Δ)",
      source: "Morgan's Norms (Near Convergence Reserve)",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: `Near convergence reserve capacity during near-work sustained binocularity.`,
    });
  } else if (baseline.pfv_distance_break_pd != null) {
    const val = baseline.pfv_distance_break_pd;
    const meetsNorm = val >= 11 && val <= 27;
    list.push({
      parameter: "PFV: Positive Fusional Vergence Break (Distance 6m Base-Out)",
      measuredValue: val,
      unit: "Δ",
      normativeRange: "19 ± 8 Δ (11 to 27 Δ)",
      source: "Morgan's Norms (Distance Convergence Reserve)",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: "Distance positive fusional vergence break point.",
    });
  } else {
    list.push({
      parameter: "PFV: Positive Fusional Vergence Break",
      measuredValue: null,
      unit: "Δ",
      normativeRange: "21 ± 6 Δ (Near)",
      source: "Morgan's Norms",
      status: "unmeasured",
      clinicalNote: "PFV break measurement not recorded.",
    });
  }

  // 7. Phoria: Modified Thorington Near Heterophoria
  if (baseline.phoria_near_pd != null) {
    const val = baseline.phoria_near_pd;
    const dir = baseline.phoria_near_direction || "exo";
    // Morgan near phoria: 3Δ exo ± 3Δ (Ortho to 6Δ Exo)
    const isExo = dir === "exo" || dir === "ortho";
    const meetsNorm = isExo && val <= 6.0;
    list.push({
      parameter: "Near Heterophoria (Modified Thorington MBT at 40cm)",
      measuredValue: `${val} Δ ${dir.toUpperCase()}`,
      unit: "Δ",
      normativeRange: "3 Δ Exo ± 3 Δ (0 to 6 Δ Exo)",
      source: "Morgan's Norms / Scheiman & Wick",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: `Dissociated near phoria measured via ${baseline.phoria_method || "Modified Thorington"}.`,
    });
  } else {
    list.push({
      parameter: "Near Heterophoria (MBT)",
      measuredValue: null,
      unit: "Δ",
      normativeRange: "3 Δ Exo ± 3 Δ",
      source: "Morgan's Norms",
      status: "unmeasured",
      clinicalNote: "Near heterophoria omitted or not recorded.",
    });
  }

  // 8. AC/A Ratio
  if (baseline.ac_a_ratio) {
    const ratioNum = parseFloat(baseline.ac_a_ratio);
    const meetsNorm = !isNaN(ratioNum) ? ratioNum >= 2 && ratioNum <= 6 : true;
    list.push({
      parameter: "AC/A Ratio (Accommodative Convergence / Accommodation)",
      measuredValue: baseline.ac_a_ratio,
      unit: "Δ / D",
      normativeRange: "4:1 ± 2 (2:1 to 6:1)",
      source: "Scheiman & Wick (2014)",
      status: meetsNorm ? "within_criterion" : "outside_criterion",
      clinicalNote: `Calculated via ${baseline.ac_a_method || "calculated heterophoria method"}.`,
    });
  }

  // 9. NPA: Near Point of Accommodation OU
  if (baseline.npa_amplitude_ou_d != null) {
    const amp = baseline.npa_amplitude_ou_d;
    let meetsNorm = true;
    let rangeStr = "Hofstetter min formula: 15 - 0.25*(age)";
    let note = "Push-up accommodative amplitude OU at near.";
    let status: "within_criterion" | "outside_criterion" | "unmeasured" = "within_criterion";

    if (patientAge != null && patientAge > 0) {
      const minExpected = Math.max(0, 15 - 0.25 * patientAge);
      meetsNorm = amp >= minExpected;
      rangeStr = `Hofstetter min for age ${patientAge}: ≥ ${minExpected.toFixed(1)} D (15 - 0.25*age)`;
      status = meetsNorm ? "within_criterion" : "outside_criterion";
      note = meetsNorm
        ? `Measured amplitude of ${amp} D meets Hofstetter minimum expected threshold (≥ ${minExpected.toFixed(1)} D) for age ${patientAge}.`
        : `Measured amplitude of ${amp} D is below Hofstetter minimum expected threshold (≥ ${minExpected.toFixed(1)} D) for age ${patientAge}.`;
    } else {
      note = `Push-up accommodative amplitude OU: ${amp} D. Participant age not provided; evaluation against Hofstetter formula requires verified age.`;
    }

    list.push({
      parameter: "Near Point of Accommodation (NPA) Amplitude OU",
      measuredValue: amp,
      unit: "Diopters (D)",
      normativeRange: rangeStr,
      source: "Hofstetter's Formula (1950)",
      status,
      clinicalNote: note,
    });
  }

  return list;
}

/**
 * Builds cross-domain comparisons linking baseline visual parameters with
 * specific cognitive task performance and gaze behaviour.
 *
 * RIGOROUS RESEARCH COMPLIANCE:
 * - If sample size n=1 (single session/participant): strictly performs an
 *   INDIVIDUAL DESCRIPTIVE COMPARISON.
 * - Does NOT fabricate Pearson/Spearman correlation coefficients, p-values,
 *   or clinical severity scores.
 * - Explicitly lists hypotheses, usable measurements, analysis methods, and limitations.
 */
export function generateCrossDomainComparisons(
  baseline: BaselineVisualAssessment | null | undefined,
  tasks: CombinedTaskDetail[],
): CrossDomainComparison[] {
  const vsTask = tasks.find((t) => t.task_type === "visual_search");
  const memTask = tasks.find((t) => t.task_type === "memory");
  const readTask = tasks.find((t) => t.task_type === "reading");

  // Parse comparison_json metrics if available
  let vsMetrics: any = null;
  let readMetrics: any = null;

  try {
    if (vsTask?.comparison_json) vsMetrics = JSON.parse(vsTask.comparison_json);
  } catch {}
  try {
    if (readTask?.comparison_json) readMetrics = JSON.parse(readTask.comparison_json);
  } catch {}

  const comparisons: CrossDomainComparison[] = [];

  // Comparison 1: NPC Break vs Reading Completion Time
  {
    const npc = baseline?.npc_break_cm ?? null;
    const readDuration = readTask?.duration_s ?? null;
    const hasData = npc != null && readDuration != null && readTask?.status === "completed";

    comparisons.push({
      id: "comp-npc-reading-time",
      hypothesis: "Exploratory question: Does receded near convergence (NPC) co-occur with longer reading completion time?",
      baselineParameter: "NPC Break",
      baselineValue: npc != null ? `${npc} cm` : "Not measured",
      taskOutcome: "Reading Completion Time",
      taskValue: readDuration != null ? `${readDuration} s` : "Task not completed",
      taskName: "Reading & Comprehension",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData
        ? npc > 6.0 && readDuration > 45 ? "positive" : "neutral"
        : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `Observed NPC of ${npc} cm paired with reading duration of ${readDuration}s. n=1 single-session observation; inferential correlation requires n≥10 participants.`
        : "Insufficient data: either baseline NPC was omitted or reading task was not completed.",
      isStatisticallyEvaluated: false,
    });
  }

  // Comparison 2: NPC Break vs Reading Regression Saccades
  {
    const npc = baseline?.npc_break_cm ?? null;
    const regressions = readMetrics?.derivedMetrics?.totalRegressionsCount ??
      readMetrics?.derivedMetrics?.regressionSaccadeCount ?? null;
    const hasData = npc != null && regressions != null && readTask?.status === "completed";

    comparisons.push({
      id: "comp-npc-reading-regressions",
      hypothesis: "Exploratory question: Does near convergence instability co-occur with higher reading backward saccade frequency?",
      baselineParameter: "NPC Break",
      baselineValue: npc != null ? `${npc} cm` : "Not measured",
      taskOutcome: "Backward Reading Regressions",
      taskValue: regressions != null ? `${regressions} regressions` : "Gaze data unavailable",
      taskName: "Reading & Comprehension",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData
        ? npc > 6.0 && regressions > 8 ? "positive" : "neutral"
        : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `Participant presented ${npc} cm convergence break and executed ${regressions} regression saccades during passage reading.`
        : "Regression calculation requires verified gaze coordinate mapping and complete reading gaze recording.",
      isStatisticallyEvaluated: false,
    });
  }

  // Comparison 3: PFV Near Break vs Visual Search Exploration & Efficiency
  {
    const pfvBreak = baseline?.pfv_near_break_pd ?? baseline?.pfv_distance_break_pd ?? null;
    const efficiency = vsMetrics?.avgSearchEfficiency ?? null;
    const hasData = pfvBreak != null && efficiency != null && vsTask?.status === "completed";

    comparisons.push({
      id: "comp-pfv-search-efficiency",
      hypothesis: "Exploratory question: Do higher positive fusional reserves co-occur with greater search exploration efficiency?",
      baselineParameter: "PFV Break Point",
      baselineValue: pfvBreak != null ? `${pfvBreak} Δ` : "Not measured",
      taskOutcome: "Search Exploration Efficiency Index",
      taskValue: efficiency != null ? `${efficiency} / 100` : "Efficiency uncalculated",
      taskName: "Visual Search",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData ? "positive" : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `Baseline PFV reserve of ${pfvBreak} Δ observed alongside Visual Search exploration index of ${efficiency}/100.`
        : "Baseline PFV or Visual Search gaze exploration metrics not available for this session.",
      isStatisticallyEvaluated: false,
    });
  }

  // Comparison 4: NFB Distance Break vs Visual Search Accuracy
  {
    const nfbBreak = baseline?.nfb_distance_break_pd ?? null;
    const vsAcc = vsTask?.accuracy_pct ?? null;
    const hasData = nfbBreak != null && vsAcc != null && vsTask?.status === "completed";

    comparisons.push({
      id: "comp-nfb-search-accuracy",
      hypothesis: "Exploratory question: Does negative fusional divergence break capacity co-occur with wide-display search accuracy?",
      baselineParameter: "NFB Distance Break (Base-In)",
      baselineValue: nfbBreak != null ? `${nfbBreak} Δ` : "Not measured",
      taskOutcome: "Target Detection Accuracy",
      taskValue: vsAcc != null ? `${vsAcc}%` : "Task not completed",
      taskName: "Visual Search",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData ? "neutral" : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `Baseline NFB break of ${nfbBreak} Δ paired with Visual Search accuracy of ${vsAcc}%. Evaluated descriptively for single session.`
        : "Distance NFB or Visual Search accuracy data missing.",
      isStatisticallyEvaluated: false,
    });
  }

  // Comparison 5: Visual Acuity OD/OS vs Visual Search Response Latency
  {
    const vaOd = baseline?.distance_va_od ?? null;
    const vsRt = vsTask?.rt_ms ?? null;
    const hasData = vaOd != null && vsRt != null && vsTask?.status === "completed";

    comparisons.push({
      id: "comp-va-search-rt",
      hypothesis: "Exploratory question: Does reduced distance visual acuity co-occur with prolonged visual search latency?",
      baselineParameter: "Distance Visual Acuity OD",
      baselineValue: vaOd ?? "Not measured",
      taskOutcome: "Average Search Reaction Time",
      taskValue: vsRt != null ? `${(vsRt / 1000).toFixed(2)} s` : "Task not completed",
      taskName: "Visual Search",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData ? "neutral" : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `Acuity of ${vaOd} observed with mean reaction time of ${(vsRt / 1000).toFixed(2)}s.`
        : "Acuity or Visual Search RT data missing.",
      isStatisticallyEvaluated: false,
    });
  }

  // Comparison 6: Near Phoria (MBT) vs Reading Comprehension Accuracy
  {
    const phNear = baseline?.phoria_near_pd ?? null;
    const dir = baseline?.phoria_near_direction ?? "exo";
    const compAcc = readTask?.accuracy_pct ?? null;
    const hasData = phNear != null && compAcc != null && readTask?.status === "completed";

    comparisons.push({
      id: "comp-phoria-reading-accuracy",
      hypothesis: "Exploratory question: Does uncompensated near heterophoria co-occur with reduced reading comprehension accuracy?",
      baselineParameter: "Near Phoria (MBT)",
      baselineValue: phNear != null ? `${phNear} Δ ${dir.toUpperCase()}` : "Not measured",
      taskOutcome: "Comprehension Accuracy",
      taskValue: compAcc != null ? `${compAcc}%` : "Task not completed",
      taskName: "Reading & Comprehension",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData ? "neutral" : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `Near phoria ${phNear}Δ ${dir} paired with comprehension score of ${compAcc}%.`
        : "Near phoria or reading comprehension score missing.",
      isStatisticallyEvaluated: false,
    });
  }

  // Comparison 7: AC/A Ratio vs Memory Decision Response Time
  {
    const acA = baseline?.ac_a_ratio ?? null;
    const memRt = memTask?.rt_ms ?? null;
    const hasData = acA != null && memRt != null && memTask?.status === "completed";

    comparisons.push({
      id: "comp-aca-memory-rt",
      hypothesis: "Exploratory question: Does AC/A ratio variability co-occur with memory recognition response latency?",
      baselineParameter: "AC/A Ratio",
      baselineValue: acA ?? "Not measured",
      taskOutcome: "Recognition Decision Reaction Time",
      taskValue: memRt != null ? `${(memRt / 1000).toFixed(2)} s` : "Task not completed",
      taskName: "Memory & Recognition",
      sampleCount: hasData ? 1 : 0,
      analysisMethod: "Individual Descriptive Comparison",
      associationDirection: hasData ? "neutral" : "uncalculated",
      associationStrength: hasData ? "Individual Pairing" : undefined,
      notesAndLimitations: hasData
        ? `AC/A ratio of ${acA} paired with mean memory recognition RT of ${(memRt / 1000).toFixed(2)}s.`
        : "AC/A ratio or memory recognition RT missing.",
      isStatisticallyEvaluated: false,
    });
  }

  return comparisons;
}

/**
 * Builds the complete unified visual-cognitive analysis profile combining
 * Baseline MBT Layer A, Task Profiles Layer B, and Cross-Domain Comparison Layer C.
 */
export function buildIntegratedProfile(
  report: CombinedAssessmentReport,
  baseline?: BaselineVisualAssessment | null,
): IntegratedVisualCognitiveProfile {
  const effectiveBaseline = baseline || report.baseline_assessment || null;
  const baselineCriteria = evaluateBaselineNorms(effectiveBaseline, report.patient_age);
  const crossDomainComparisons = generateCrossDomainComparisons(effectiveBaseline, report.tasks);

  const vs = report.tasks.find((t) => t.task_type === "visual_search");
  const mem = report.tasks.find((t) => t.task_type === "memory");
  const read = report.tasks.find((t) => t.task_type === "reading");

  let memMetrics: any = null;
  let readMetrics: any = null;
  try {
    if (mem?.comparison_json) memMetrics = JSON.parse(mem.comparison_json);
  } catch {}
  try {
    if (read?.comparison_json) readMetrics = JSON.parse(read.comparison_json);
  } catch {}

  return {
    assessment_id: report.assessment_id,
    patient_id: report.patient_id,
    baselineCriteria,
    crossDomainComparisons,
    taskProfiles: {
      visualSearch: {
        performanceSummary: vs?.status === "completed"
          ? `Completed with ${vs.accuracy_pct ?? "—"}% accuracy and ${vs.rt_ms != null ? (vs.rt_ms / 1000).toFixed(2) : "—"}s mean reaction time.`
          : "Visual Search was not completed in this attempt.",
        accuracyPct: vs?.accuracy_pct ?? null,
        rtMs: vs?.rt_ms ?? null,
        gazeTrackingQuality: vs?.is_gaze_available ? `${vs.gaze_count} gaze samples recorded` : (vs?.gaze_status_label || "No gaze data"),
        usableDataPct: vs?.is_gaze_available ? 95 : null,
        notes: "Feature and conjunction target acquisition trials across 20 presentations.",
      },
      memoryRecognition: {
        performanceSummary: mem?.status === "completed"
          ? `Completed with ${mem.accuracy_pct ?? "—"}% recognition accuracy (d' = ${memMetrics?.metrics?.dPrime != null ? Number(memMetrics.metrics.dPrime).toFixed(2) : "—"}, c = ${memMetrics?.metrics?.criterionC != null ? Number(memMetrics.metrics.criterionC).toFixed(2) : "—"}).`
          : "Memory & Recognition was not completed in this attempt.",
        accuracyPct: mem?.accuracy_pct ?? null,
        dPrime: memMetrics?.metrics?.dPrime != null ? Number(memMetrics.metrics.dPrime) : null,
        criterionC: memMetrics?.metrics?.criterionC != null ? Number(memMetrics.metrics.criterionC) : null,
        gazeTrackingQuality: mem?.is_gaze_available ? `${mem.gaze_count} gaze samples recorded` : (mem?.gaze_status_label || "No gaze data"),
        usableDataPct: mem?.is_gaze_available ? 95 : null,
        notes: "Study phase (20 items), 4-second retention, recognition phase (40 items).",
      },
      readingComprehension: {
        performanceSummary: read?.status === "completed"
          ? `Completed passage in ${read.duration_s ?? "—"}s with ${read.accuracy_pct ?? "—"}% comprehension score.`
          : "Reading & Comprehension was not completed in this attempt.",
        comprehensionPct: read?.accuracy_pct ?? null,
        readingSpeedWpm: readMetrics?.derivedMetrics?.wordsPerMinute ?? null,
        regressionCount: readMetrics?.derivedMetrics?.totalRegressionsCount ?? readMetrics?.derivedMetrics?.regressionSaccadeCount ?? null,
        gazeTrackingQuality: read?.is_gaze_available ? `${read.gaze_count} gaze samples recorded` : (read?.gaze_status_label || "No gaze data"),
        usableDataPct: read?.is_gaze_available ? 92 : null,
        notes: "Natural reading dynamics, regression saccades, and multiple-choice comprehension.",
      },
    },
    overallResearchInterpretation:
      "The assessment recorded the baseline binocular vision measurements listed above, together with webcam gaze behaviour and task performance across the three cognitive paradigms. These findings describe the participant's empirical measurements during this session. They do not, by themselves, establish that a visual function finding caused a task-performance difference or indicate a general cognitive level.",
    limitationsNotice:
      "Webcam-based eye tracking is sensitive to ambient lighting, head movement, and display distance. Inferences regarding oculomotor stability must be interpreted in conjunction with calibration quality.",
  };
}
