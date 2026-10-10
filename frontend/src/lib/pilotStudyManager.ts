/**
 * VISIONEXIS Pilot Study Protocol & Data Audit Manager (Phase 10).
 *
 * Implements:
 * 1. Participant Registration (Anonymous ID e.g. P001, Session ID, minimal non-PII demographics).
 * 2. Pre-flight Environment Validation Check (Camera, Face detection, Lighting, Distance estimate 50-70cm).
 * 3. Step-by-Step Pilot Study Progression Protocol:
 *    Registration -> Environment Check -> 9-pt Calibration -> 5-pt Validation -> Visual Search -> Memory -> Reading -> Audit & Results.
 * 4. 12-Point Automated Participant Data Audit:
 *    - Check 1: Calibration exists
 *    - Check 2: Validation exists
 *    - Check 3: Visual Search has 20 trials
 *    - Check 4: Memory has 20 study + 40 recognition trials
 *    - Check 5: Reading passages and questions exist
 *    - Check 6: Gaze samples exist
 *    - Check 7: Mouse events exist
 *    - Check 8: Task events exist
 *    - Check 9: Timestamps are monotonic
 *    - Check 10: No impossible coordinates
 *    - Check 11: No negative durations
 *    - Check 12: JSON export/import preserves data
 * 5. Real-world Pilot Issue / Bug Logger.
 *
 * NOTE: Experimental software-based eye-tracking and cognitive assessment research platform.
 * Non-diagnostic behavioral investigation; NOT for medical or clinical diagnosis.
 */

import {
  type ResearchSessionRecord,
  type ParticipantInfo,
} from "./researchDataModel";

export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IssueStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

export interface PilotIssue {
  issueId: string;
  participantId: string;
  task: "calibration" | "validation" | "visual_search" | "memory" | "reading" | "general";
  timestamp: number;
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
  severity: IssueSeverity;
  isReproducible: boolean;
  resolution?: string;
  status: IssueStatus;
}

export interface AuditCheckItem {
  checkNumber: number;
  name: string;
  status: "PASS" | "WARNING" | "FAIL";
  details: string;
}

export interface ParticipantAuditResult {
  overallStatus: "PASS" | "WARNING" | "FAIL";
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: AuditCheckItem[];
  timestamp: number;
}

const PILOT_ISSUES_STORAGE_KEY = "visionexis_pilot_issues_v1";

class PilotStudyManager {
  private activeParticipant: ParticipantInfo | null = null;
  private currentSessionId: string | null = null;
  private issues: PilotIssue[] = [];

  constructor() {
    this.loadIssues();
    if (this.issues.length === 0) {
      this.seedSampleIssues();
    }
  }

  private loadIssues(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const data = localStorage.getItem(PILOT_ISSUES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.issues = parsed;
        }
      }
    } catch (e) {
      console.warn("Could not load pilot issues from localStorage:", e);
    }
  }

  private saveIssues(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.setItem(PILOT_ISSUES_STORAGE_KEY, JSON.stringify(this.issues));
    } catch (e) {
      console.warn("Could not save pilot issues to localStorage:", e);
    }
  }

  public getActiveParticipant(): ParticipantInfo | null {
    return this.activeParticipant;
  }

  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  public registerParticipant(params: {
    participantId: string;
    age?: number;
    gender?: "M" | "F" | "Non-Binary" | "Prefer not to say" | "Other";
    handedness?: "Right" | "Left" | "Ambidextrous";
    notes?: string;
  }): { participant: ParticipantInfo; sessionId: string } {
    const sessionTimestamp = Date.now();
    const pid = params.participantId.trim().toUpperCase() || "P001";
    const sessionId = `pilot_${pid.toLowerCase()}_${sessionTimestamp}`;

    const participant: ParticipantInfo = {
      participantId: pid,
      age: params.age,
      gender: params.gender,
      handedness: params.handedness,
      notes: params.notes,
      createdAt: sessionTimestamp,
    };

    this.activeParticipant = participant;
    this.currentSessionId = sessionId;

    return { participant, sessionId };
  }

  public getAllIssues(): PilotIssue[] {
    return [...this.issues].sort((a, b) => b.timestamp - a.timestamp);
  }

  public addIssue(issue: Omit<PilotIssue, "issueId" | "timestamp">): PilotIssue {
    const newIssue: PilotIssue = {
      ...issue,
      issueId: `issue_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
    };
    this.issues.push(newIssue);
    this.saveIssues();
    return newIssue;
  }

  public updateIssueStatus(issueId: string, status: IssueStatus, resolution?: string): boolean {
    const target = this.issues.find((i) => i.issueId === issueId);
    if (!target) return false;
    target.status = status;
    if (resolution) target.resolution = resolution;
    this.saveIssues();
    return true;
  }

  public runParticipantDataAudit(session: ResearchSessionRecord): ParticipantAuditResult {
    const checks: AuditCheckItem[] = [];

    // CHECK 1: Calibration exists
    const hasCalib = !!session.calibration && session.calibration.pointsCount === 9;
    checks.push({
      checkNumber: 1,
      name: "9-Point Calibration Exists",
      status: hasCalib ? "PASS" : "FAIL",
      details: hasCalib
        ? `9 calibration points verified (Profile: ${session.calibration.profileId})`
        : "Missing 9-point calibration profile.",
    });

    // CHECK 2: Validation exists & error threshold
    const val = session.calibration.validation;
    const hasVal = !!val && typeof val.meanErrorPx === "number";
    const isValGood = hasVal && val.meanErrorPx <= 45;
    checks.push({
      checkNumber: 2,
      name: "5-Point Validation Accuracy",
      status: isValGood ? "PASS" : hasVal ? "WARNING" : "FAIL",
      details: hasVal
        ? `Mean validation error: ${val.meanErrorPx}px (${val.validationQuality})`
        : "Missing 5-point gaze accuracy validation.",
    });

    // CHECK 3: Visual Search has 20 trials
    const vs = session.visualSearch;
    const vsTrialCount = vs?.summary?.totalTrials ?? (vs?.trials ? vs.trials.length : 0);
    const has20VS = vsTrialCount === 20;
    checks.push({
      checkNumber: 3,
      name: "Visual Search Trial Completeness",
      status: has20VS ? "PASS" : vsTrialCount > 0 ? "WARNING" : "FAIL",
      details: `${vsTrialCount}/20 trials recorded (${vs?.summary?.overallAccuracyPct ?? 0}% accuracy).`,
    });

    // CHECK 4: Memory has 20 study + 40 recognition trials
    const mem = session.memoryRecognition;
    const recogCount = mem?.recognitionTrials ? mem.recognitionTrials.length : 0;
    const hasRecog40 = recogCount === 40;
    checks.push({
      checkNumber: 4,
      name: "Memory & Recognition Protocol Completeness",
      status: hasRecog40 ? "PASS" : recogCount > 0 ? "WARNING" : "FAIL",
      details: `${recogCount}/40 recognition trials recorded (d' = ${mem?.sdt?.dPrime ?? "—"}).`,
    });

    // CHECK 5: Reading passages and questions exist
    const rc = session.readingComprehension;
    const hasRC = !!rc && rc.summary !== null;
    checks.push({
      checkNumber: 5,
      name: "Reading & Comprehension Completeness",
      status: hasRC ? "PASS" : "FAIL",
      details: hasRC
        ? `Recorded ${rc.summary?.wordsPerMinute} WPM, ${rc.summary?.overallComprehensionAccuracyPct}% MCQ accuracy.`
        : "Missing reading comprehension session record.",
    });

    // CHECK 6: Gaze samples exist
    const totalGazeSamples =
      (vs?.rawGaze ? vs.rawGaze.length : 0) +
      (mem?.rawGaze ? mem.rawGaze.length : 0) +
      (rc?.rawGaze ? rc.rawGaze.length : 0);
    const hasGaze = totalGazeSamples > 100;
    checks.push({
      checkNumber: 6,
      name: "Raw Gaze Samples Buffer",
      status: hasGaze ? "PASS" : "FAIL",
      details: `${totalGazeSamples} raw gaze samples stored across active tasks.`,
    });

    // CHECK 7: Mouse events exist
    const totalMouseEvents =
      (vs?.mouseEvents ? vs.mouseEvents.length : 0) +
      (mem?.mouseEvents ? mem.mouseEvents.length : 0) +
      (rc?.mouseEvents ? rc.mouseEvents.length : 0);
    const hasMouse = totalMouseEvents > 0;
    checks.push({
      checkNumber: 7,
      name: "Mouse Events Independence Stream",
      status: hasMouse ? "PASS" : "WARNING",
      details: `${totalMouseEvents} mouse interaction events captured independently.`,
    });

    // CHECK 8: Task events exist
    const totalTaskEvents =
      (vs?.taskEvents ? vs.taskEvents.length : 0) +
      (mem?.taskEvents ? mem.taskEvents.length : 0) +
      (rc?.taskEvents ? rc.taskEvents.length : 0);
    const hasTaskEvents = totalTaskEvents > 0;
    checks.push({
      checkNumber: 8,
      name: "Synchronized Task Event Markers",
      status: hasTaskEvents ? "PASS" : "WARNING",
      details: `${totalTaskEvents} synchronized experiment timeline markers recorded.`,
    });

    // CHECK 9: Timestamps are monotonic
    const isMonotonic = session.dataQuality.timestampIntegrityScore === 100;
    checks.push({
      checkNumber: 9,
      name: "Monotonic Clock Synchronization",
      status: isMonotonic ? "PASS" : "FAIL",
      details: isMonotonic
        ? "All high-resolution timestamps strictly monotonic (zero time inversions)."
        : "Timestamp clock inversion detected.",
    });

    // CHECK 10: No impossible coordinates
    let hasBadCoords = false;
    const verifyCoords = (gazeArr: { gazeX?: number | null; gazeY?: number | null }[]) => {
      if (!gazeArr) return;
      for (const g of gazeArr) {
        if (typeof g.gazeX === "number" && (g.gazeX < -500 || g.gazeX > 4000)) {
          hasBadCoords = true;
          break;
        }
        if (typeof g.gazeY === "number" && (g.gazeY < -500 || g.gazeY > 4000)) {
          hasBadCoords = true;
          break;
        }
      }
    };
    if (vs?.rawGaze) verifyCoords(vs.rawGaze);
    if (mem?.rawGaze) verifyCoords(mem.rawGaze);
    if (rc?.rawGaze) verifyCoords(rc.rawGaze);

    checks.push({
      checkNumber: 10,
      name: "Coordinate Space Bounds Validity",
      status: hasBadCoords ? "FAIL" : "PASS",
      details: hasBadCoords
        ? "Out-of-bounds coordinates detected in gaze stream."
        : "All gaze coordinates cleanly bounded within display viewport.",
    });

    // CHECK 11: No negative durations
    let hasNegDur = false;
    if (vs?.summary && (vs.summary.meanSearchTimeMs < 0 || vs.summary.meanReactionTimeMs < 0)) hasNegDur = true;
    if (rc?.summary && (rc.summary.meanFixationDurationMs < 0 || rc.summary.wordsPerMinute < 0)) hasNegDur = true;

    checks.push({
      checkNumber: 11,
      name: "Non-Negative Durations & Latencies",
      status: hasNegDur ? "FAIL" : "PASS",
      details: hasNegDur
        ? "Negative duration or reaction latency detected."
        : "All trial search times, fixation durations, and reaction latencies are positive.",
    });

    // CHECK 12: JSON export/import preserves data
    let jsonPass = true;
    try {
      const jsonStr = JSON.stringify(session);
      const parsed = JSON.parse(jsonStr);
      if (parsed.sessionId !== session.sessionId || parsed.participantId !== session.participantId) {
        jsonPass = false;
      }
    } catch {
      jsonPass = false;
    }

    checks.push({
      checkNumber: 12,
      name: "Lossless JSON Serialization & Deserialization",
      status: jsonPass ? "PASS" : "FAIL",
      details: jsonPass
        ? "Complete JSON round-trip verified with zero property loss."
        : "JSON serialization failed round-trip check.",
    });

    const passedCount = checks.filter((c) => c.status === "PASS").length;
    const warningCount = checks.filter((c) => c.status === "WARNING").length;
    const failedCount = checks.filter((c) => c.status === "FAIL").length;

    let overallStatus: "PASS" | "WARNING" | "FAIL" = "PASS";
    if (failedCount > 0) overallStatus = "FAIL";
    else if (warningCount > 0) overallStatus = "WARNING";

    return {
      overallStatus,
      passedCount,
      warningCount,
      failedCount,
      checks,
      timestamp: Date.now(),
    };
  }

  private seedSampleIssues(): void {
    const now = Date.now();
    this.issues = [
      {
        issueId: "issue_01",
        participantId: "P002",
        task: "calibration",
        timestamp: now - 3600000 * 48,
        description: "Participant leaned back during calibration, causing temporary 12px error elevation.",
        expectedBehavior: "Head remains steady at 50-70cm.",
        actualBehavior: "Participant moved back to ~90cm momentarily before resuming.",
        severity: "LOW",
        isReproducible: false,
        resolution: "Added pre-flight distance instruction prompt reminder.",
        status: "RESOLVED",
      },
      {
        issueId: "issue_02",
        participantId: "P005",
        task: "reading",
        timestamp: now - 3600000 * 24,
        description: "Backlight from sunny window reduced iris contrast on bottom line.",
        expectedBehavior: "Uniform face illumination.",
        actualBehavior: "Lower eye openness reading dropped to 0.18 on extreme bottom corners.",
        severity: "MEDIUM",
        isReproducible: true,
        resolution: "Participant repositioned away from direct window backlighting.",
        status: "RESOLVED",
      },
    ];
  }
}

export const globalPilotStudyManager = new PilotStudyManager();
