/**
 * VISIONEXIS Research Dataset Manager (Phase 9).
 *
 * Implements:
 * 1. Storage of multi-participant research sessions in browser local storage / memory.
 * 2. Complete JSON Dataset Export & Lossless Round-Trip Import.
 * 3. Summary Table CSV Export.
 * 4. Multi-participant cohort statistics aggregation.
 * 5. Pre-seeded realistic research session generator for immediate demonstration.
 */

import {
  type ResearchSessionRecord,
  SCHEMA_VERSION,
  SOFTWARE_VERSION,
  CALIBRATION_VERSION,
  ANALYSIS_VERSION,
  calculateDataQuality,
  getClientDeviceInfo,
} from "./researchDataModel";
import { calculateDescriptiveStats } from "./researchAnalysisEngine";

const STORAGE_KEY = "visionexis_research_dataset_v1";

export interface DatasetSummaryStats {
  totalParticipants: number;
  totalSessions: number;
  validSessionsCount: number;
  warningSessionsCount: number;
  invalidSessionsCount: number;
  meanOverallQuality: number;
  meanCalibrationErrorPx: number;
  meanGazeAvailabilityPct: number;

  visualSearch: {
    meanSearchTimeMs: number;
    meanAccuracyPct: number;
    meanFixations: number;
  };
  memoryRecognition: {
    meanDPrime: number;
    meanCriterion: number;
    meanRecognitionAccuracyPct: number;
  };
  readingComprehension: {
    meanWPM: number;
    meanComprehensionAccuracyPct: number;
    meanRegressionRate: number;
  };
}

class ResearchDatasetManager {
  private sessions: Map<string, ResearchSessionRecord> = new Map();

  constructor() {
    this.loadFromStorage();
    if (this.sessions.size === 0) {
      this.seedInitialParticipants();
    }
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: ResearchSessionRecord[] = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.sessions.clear();
          parsed.forEach((s) => this.sessions.set(s.sessionId, s));
        }
      }
    } catch (e) {
      console.warn("Could not load research dataset from localStorage:", e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const list = Array.from(this.sessions.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Could not save research dataset to localStorage:", e);
    }
  }

  public getAllSessions(): ResearchSessionRecord[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.sessionTimestamp - a.sessionTimestamp
    );
  }

  public getSession(sessionId: string): ResearchSessionRecord | null {
    return this.sessions.get(sessionId) || null;
  }

  public getSessionsByParticipant(participantId: string): ResearchSessionRecord[] {
    return this.getAllSessions().filter((s) => s.participantId === participantId);
  }

  public saveSession(session: ResearchSessionRecord): void {
    this.sessions.set(session.sessionId, session);
    this.saveToStorage();
  }

  public deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  public clearDataset(): void {
    this.sessions.clear();
    this.saveToStorage();
  }

  public resetToSampleDataset(): void {
    this.sessions.clear();
    this.seedInitialParticipants();
    this.saveToStorage();
  }

  public exportSessionJSON(sessionId: string): string {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);
    return JSON.stringify(session, null, 2);
  }

  public exportDatasetJSON(): string {
    const payload = {
      exportFormat: "VISIONEXIS_RESEARCH_DATASET",
      exportTimestamp: Date.now(),
      schemaVersion: SCHEMA_VERSION,
      softwareVersion: SOFTWARE_VERSION,
      sessionCount: this.sessions.size,
      sessions: this.getAllSessions(),
    };
    return JSON.stringify(payload, null, 2);
  }

  public importDatasetJSON(jsonString: string): { importedCount: number; errors: string[] } {
    const errors: string[] = [];
    let importedCount = 0;

    try {
      const parsed = JSON.parse(jsonString);
      const sessionList: ResearchSessionRecord[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.sessions)
        ? parsed.sessions
        : [parsed];

      sessionList.forEach((s, idx) => {
        if (!s.sessionId || !s.participantId) {
          errors.push(`Record ${idx} missing sessionId or participantId.`);
          return;
        }
        this.sessions.set(s.sessionId, s);
        importedCount++;
      });

      this.saveToStorage();
    } catch (err: unknown) {
      errors.push(err instanceof Error ? err.message : "Failed to parse JSON.");
    }

    return { importedCount, errors };
  }

  public exportSummaryCSV(): string {
    const sessions = this.getAllSessions();
    const headers = [
      "Participant_ID",
      "Session_ID",
      "Date",
      "Age",
      "Gender",
      "Handedness",
      "Data_Quality_Score",
      "Validity_State",
      "Calibration_Error_Px",
      "VS_Accuracy_Pct",
      "VS_Mean_Search_Time_Ms",
      "VS_Fixation_Count",
      "Mem_D_Prime",
      "Mem_Criterion_C",
      "Mem_Accuracy_Pct",
      "Mem_Mean_RT_Ms",
      "Read_WPM",
      "Read_Comprehension_Pct",
      "Read_Fixation_Duration_Ms",
      "Read_Regression_Rate_Pct",
    ];

    const rows = sessions.map((s) => {
      const vs = s.visualSearch?.summary;
      const mem = s.memoryRecognition;
      const memAcc = mem?.recognitionTrials && mem.recognitionTrials.length > 0
        ? Number(((mem.recognitionTrials.filter((r) => r.isCorrect).length / mem.recognitionTrials.length) * 100).toFixed(1))
        : "";
      const memRT = mem?.recognitionTrials && mem.recognitionTrials.length > 0
        ? Math.round(mem.recognitionTrials.reduce((a, b) => a + b.reactionTimeMs, 0) / mem.recognitionTrials.length)
        : "";
      const rc = s.readingComprehension?.summary;

      return [
        s.participantId,
        s.sessionId,
        s.sessionDateISO ? s.sessionDateISO.split("T")[0] : "",
        s.participant.age ?? "",
        s.participant.gender ?? "",
        s.participant.handedness ?? "",
        s.dataQuality.overallQualityScore,
        s.dataQuality.validityState,
        s.calibration.validation?.meanErrorPx ?? "",
        vs ? vs.overallAccuracyPct : "",
        vs ? vs.meanSearchTimeMs : "",
        vs ? vs.totalFixations : "",
        mem?.sdt ? mem.sdt.dPrime : "",
        mem?.sdt ? mem.sdt.criterion : "",
        memAcc,
        memRT,
        rc ? rc.wordsPerMinute : "",
        rc ? rc.overallComprehensionAccuracyPct : "",
        rc ? rc.meanFixationDurationMs : "",
        rc ? rc.regressionRate : "",
      ].map((v) => `"${v}"`).join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  public exportTaskSummaryCSV(): string {
    const sessions = this.getAllSessions();
    const headers = [
      "Participant_ID",
      "Session_ID",
      "Task_Type",
      "Trial_Or_Item_Index",
      "Condition_Or_Difficulty",
      "Target_Or_Stimulus",
      "Response_Correct",
      "Reaction_Time_Ms",
      "Fixation_Count",
      "Gaze_Availability_Pct",
    ];

    const rows: string[] = [];

    sessions.forEach((s) => {
      // Visual Search trials
      if (s.visualSearch?.trials) {
        s.visualSearch.trials.forEach((t) => {
          rows.push(
            [
              s.participantId,
              s.sessionId,
              "Visual_Search",
              t.trialNumber,
              `Grid_${t.gridSize}x${t.gridSize}`,
              t.targetPresent ? "Target_Present" : "Target_Absent",
              t.userClickedCorrect ? "1" : "0",
              t.searchTimeMs,
              t.fixationCount,
              s.visualSearch?.gazeAvailabilityPct ?? "",
            ]
              .map((v) => `"${v}"`)
              .join(",")
          );
        });
      }

      // Memory recognition trials
      if (s.memoryRecognition?.recognitionTrials) {
        s.memoryRecognition.recognitionTrials.forEach((m) => {
          rows.push(
            [
              s.participantId,
              s.sessionId,
              "Memory_Recognition",
              m.trialNumber,
              m.isOld ? "Old" : "New",
              m.itemId,
              m.isCorrect ? "1" : "0",
              m.reactionTimeMs,
              "",
              s.memoryRecognition?.gazeAvailabilityPct ?? "",
            ]
              .map((v) => `"${v}"`)
              .join(",")
          );
        });
      }

      // Reading summary
      if (s.readingComprehension?.summary) {
        const rc = s.readingComprehension.summary;
        rows.push(
          [
            s.participantId,
            s.sessionId,
            "Reading_Comprehension",
            "Passage_Summary",
            "Standard_Passage",
            `${rc.wordsPerMinute} WPM`,
            rc.overallComprehensionAccuracyPct >= 70 ? "1" : "0",
            rc.meanFixationDurationMs,
            rc.totalFixationCount,
            s.readingComprehension?.gazeAvailabilityPct ?? "",
          ]
            .map((v) => `"${v}"`)
            .join(",")
        );
      }
    });

    return [headers.join(","), ...rows].join("\n");
  }

  public getAggregatedStudyStats(): DatasetSummaryStats {
    const sessions = this.getAllSessions();
    if (sessions.length === 0) {
      return {
        totalParticipants: 0,
        totalSessions: 0,
        validSessionsCount: 0,
        warningSessionsCount: 0,
        invalidSessionsCount: 0,
        meanOverallQuality: 0,
        meanCalibrationErrorPx: 0,
        meanGazeAvailabilityPct: 0,
        visualSearch: { meanSearchTimeMs: 0, meanAccuracyPct: 0, meanFixations: 0 },
        memoryRecognition: { meanDPrime: 0, meanCriterion: 0, meanRecognitionAccuracyPct: 0 },
        readingComprehension: { meanWPM: 0, meanComprehensionAccuracyPct: 0, meanRegressionRate: 0 },
      };
    }

    const uniqueParticipants = new Set(sessions.map((s) => s.participantId)).size;
    const validCount = sessions.filter((s) => s.dataQuality.validityState === "VALID").length;
    const warningCount = sessions.filter((s) => s.dataQuality.validityState === "WARNING").length;
    const invalidCount = sessions.filter((s) => s.dataQuality.validityState === "INVALID").length;

    const qualities = sessions.map((s) => s.dataQuality.overallQualityScore);
    const calibErrors = sessions
      .map((s) => s.calibration.validation?.meanErrorPx)
      .filter((e): e is number => typeof e === "number");
    const gazeAvails = sessions.map((s) => s.dataQuality.gazeAvailabilityScore);

    const vsSearchTimes = sessions
      .map((s) => s.visualSearch?.summary?.meanSearchTimeMs)
      .filter((t): t is number => typeof t === "number");
    const vsAccs = sessions
      .map((s) => s.visualSearch?.summary?.overallAccuracyPct)
      .filter((a): a is number => typeof a === "number");
    const vsFix = sessions
      .map((s) => s.visualSearch?.summary?.totalFixations)
      .filter((f): f is number => typeof f === "number");

    const memDPrimes = sessions
      .map((s) => s.memoryRecognition?.sdt?.dPrime)
      .filter((d): d is number => typeof d === "number");
    const memCriteria = sessions
      .map((s) => s.memoryRecognition?.sdt?.criterion)
      .filter((c): c is number => typeof c === "number");
    const memAccs = sessions
      .map((s) => {
        const tr = s.memoryRecognition?.recognitionTrials;
        return tr && tr.length > 0
          ? (tr.filter((t) => t.isCorrect).length / tr.length) * 100
          : null;
      })
      .filter((a): a is number => typeof a === "number");

    const rcWPMs = sessions
      .map((s) => s.readingComprehension?.summary?.wordsPerMinute)
      .filter((w): w is number => typeof w === "number");
    const rcAccs = sessions
      .map((s) => s.readingComprehension?.summary?.overallComprehensionAccuracyPct)
      .filter((a): a is number => typeof a === "number");
    const rcRegRates = sessions
      .map((s) => s.readingComprehension?.summary?.regressionRate)
      .filter((r): r is number => typeof r === "number");

    return {
      totalParticipants: uniqueParticipants,
      totalSessions: sessions.length,
      validSessionsCount: validCount,
      warningSessionsCount: warningCount,
      invalidSessionsCount: invalidCount,
      meanOverallQuality: calculateDescriptiveStats(qualities).mean,
      meanCalibrationErrorPx: calculateDescriptiveStats(calibErrors).mean,
      meanGazeAvailabilityPct: calculateDescriptiveStats(gazeAvails).mean,
      visualSearch: {
        meanSearchTimeMs: calculateDescriptiveStats(vsSearchTimes).mean,
        meanAccuracyPct: calculateDescriptiveStats(vsAccs).mean,
        meanFixations: calculateDescriptiveStats(vsFix).mean,
      },
      memoryRecognition: {
        meanDPrime: calculateDescriptiveStats(memDPrimes).mean,
        meanCriterion: calculateDescriptiveStats(memCriteria).mean,
        meanRecognitionAccuracyPct: calculateDescriptiveStats(memAccs).mean,
      },
      readingComprehension: {
        meanWPM: calculateDescriptiveStats(rcWPMs).mean,
        meanComprehensionAccuracyPct: calculateDescriptiveStats(rcAccs).mean,
        meanRegressionRate: calculateDescriptiveStats(rcRegRates).mean,
      },
    };
  }

  private seedInitialParticipants(): void {
    const baseDevice = getClientDeviceInfo();
    const now = Date.now();

    const sampleParticipants: {
      pid: string;
      age: number;
      gender: "M" | "F" | "Non-Binary";
      hand: "Right" | "Left";
      calibError: number;
      gazeAvail: number;
      vsAcc: number;
      vsTime: number;
      dPrime: number;
      criterion: number;
      memAcc: number;
      wpm: number;
      readAcc: number;
      regRate: number;
    }[] = [
      { pid: "P001", age: 24, gender: "F", hand: "Right", calibError: 24.2, gazeAvail: 96.5, vsAcc: 100, vsTime: 1080, dPrime: 2.15, criterion: -0.05, memAcc: 87.5, wpm: 215, readAcc: 100, regRate: 7.5 },
      { pid: "P002", age: 29, gender: "M", hand: "Right", calibError: 28.6, gazeAvail: 94.0, vsAcc: 95, vsTime: 1240, dPrime: 1.85, criterion: 0.12, memAcc: 82.5, wpm: 195, readAcc: 80, regRate: 11.2 },
      { pid: "P003", age: 33, gender: "F", hand: "Right", calibError: 31.4, gazeAvail: 91.2, vsAcc: 90, vsTime: 1420, dPrime: 1.62, criterion: 0.08, memAcc: 80.0, wpm: 180, readAcc: 100, regRate: 14.0 },
      { pid: "P004", age: 21, gender: "Non-Binary", hand: "Left", calibError: 21.0, gazeAvail: 98.1, vsAcc: 100, vsTime: 950, dPrime: 2.45, criterion: -0.02, memAcc: 92.5, wpm: 240, readAcc: 100, regRate: 5.8 },
      { pid: "P005", age: 41, gender: "M", hand: "Right", calibError: 38.5, gazeAvail: 88.4, vsAcc: 85, vsTime: 1650, dPrime: 1.40, criterion: 0.22, memAcc: 75.0, wpm: 165, readAcc: 80, regRate: 16.5 },
    ];

    sampleParticipants.forEach((p, index) => {
      const sessionTs = now - (sampleParticipants.length - index) * 3600000 * 24;
      const quality = calculateDataQuality({
        validationMeanErrorPx: p.calibError,
        gazeAvailabilityPct: p.gazeAvail,
        hasMonotonicTimestamps: true,
        tasksCompletedFraction: 1.0,
      });

      const session: ResearchSessionRecord = {
        schemaVersion: SCHEMA_VERSION,
        softwareVersion: SOFTWARE_VERSION,
        calibrationVersion: CALIBRATION_VERSION,
        analysisVersion: ANALYSIS_VERSION,
        sessionId: `sess_${p.pid.toLowerCase()}_${sessionTs}`,
        participantId: p.pid,
        sessionTimestamp: sessionTs,
        sessionDateISO: new Date(sessionTs).toISOString(),
        participant: {
          participantId: p.pid,
          age: p.age,
          gender: p.gender,
          handedness: p.hand,
          createdAt: sessionTs,
        },
        device: baseDevice,
        calibration: {
          profileId: `calib_${p.pid}`,
          pointsCount: 9,
          calibratedAt: sessionTs,
          model: null,
          validation: {
            meanErrorPx: p.calibError,
            medianErrorPx: Math.round(p.calibError * 0.95),
            maxErrorPx: Math.round(p.calibError * 1.6),
            horizontalMaePx: Math.round(p.calibError * 0.55),
            verticalMaePx: Math.round(p.calibError * 0.45),
            validationQuality: p.calibError < 30 ? "EXCELLENT" : "GOOD",
            sampleCount: 150,
          },
        },
        visualSearch: {
          rawGaze: [],
          mouseEvents: [],
          taskEvents: [],
          fixations: [],
          saccades: [],
          trials: [],
          summary: {
            totalTrials: 20,
            overallAccuracyPct: p.vsAcc,
            meanReactionTimeMs: p.vsTime + 280,
            medianReactionTimeMs: p.vsTime + 250,
            meanSearchTimeMs: p.vsTime,
            medianSearchTimeMs: p.vsTime - 50,
            totalFixations: Math.round(p.vsTime / 240 * 20),
            meanFixationDurationMs: 245,
            totalSaccades: Math.round(p.vsTime / 280 * 20),
            meanSaccadeAmplitudePx: 138,
            totalRevisits: 4,
            difficultyBreakdown: {
              easy: { trialCount: 7, accuracyPct: 100, meanReactionTimeMs: p.vsTime * 0.7, meanSearchTimeMs: p.vsTime * 0.6, meanFixationDurationMs: 230, meanTargetAttentionPct: 70, efficiencyScore: 94 },
              medium: { trialCount: 7, accuracyPct: p.vsAcc, meanReactionTimeMs: p.vsTime, meanSearchTimeMs: p.vsTime * 0.9, meanFixationDurationMs: 245, meanTargetAttentionPct: 68, efficiencyScore: 90 },
              hard: { trialCount: 6, accuracyPct: p.vsAcc, meanReactionTimeMs: p.vsTime * 1.4, meanSearchTimeMs: p.vsTime * 1.3, meanFixationDurationMs: 260, meanTargetAttentionPct: 65, efficiencyScore: 84 },
            },
          },
          gazeAvailabilityPct: p.gazeAvail,
        },
        memoryRecognition: {
          rawGaze: [],
          mouseEvents: [],
          taskEvents: [],
          fixations: [],
          saccades: [],
          studyTrials: [],
          recognitionTrials: Array.from({ length: 40 }, (_, i) => ({
            trialNumber: i + 1,
            itemId: `item_${i}`,
            isOld: i < 20,
            presentedAt: sessionTs + i * 2000,
            responseTime: sessionTs + i * 2000 + 1200,
            reactionTimeMs: 1200 + (i % 5) * 60,
            userJudgedOld: i < Math.round(20 * (p.memAcc / 100)),
            isCorrect: (i < 20 && i < Math.round(20 * (p.memAcc / 100))) || (i >= 20 && i >= 20 + Math.round(20 * (1 - p.memAcc / 100))),
          })),
          sdt: {
            hits: Math.round(20 * (p.memAcc / 100)),
            misses: 20 - Math.round(20 * (p.memAcc / 100)),
            falseAlarms: Math.round(20 * (1 - p.memAcc / 100)),
            correctRejections: 20 - Math.round(20 * (1 - p.memAcc / 100)),
            hitRate: p.memAcc / 100,
            faRate: (100 - p.memAcc) / 100,
            dPrime: p.dPrime,
            criterion: p.criterion,
          },
          studyDwellComparison: {
            meanHitStudyDwellMs: 820,
            meanMissStudyDwellMs: 410,
            dwellDifferenceMs: 410,
          },
          gazeAvailabilityPct: p.gazeAvail,
        },
        readingComprehension: {
          rawGaze: [],
          mouseEvents: [],
          taskEvents: [],
          fixations: [],
          saccades: [],
          regressions: [],
          returnSweeps: [],
          lineMetrics: [],
          passage: null,
          wordAOIs: [],
          lineAOIs: [],
          questionResponses: [],
          summary: {
            wordsPerMinute: p.wpm,
            readingCoveragePct: 95.0,
            totalFixationCount: Math.round(150 * (32 / 100)),
            meanFixationDurationMs: 235,
            medianFixationDurationMs: 230,
            maxFixationDurationMs: 390,
            minFixationDurationMs: 120,
            fixationsPer100Words: 32.0,
            totalSaccadeCount: 45,
            progressiveSaccadesCount: 38,
            totalRegressionsCount: Math.round(45 * (p.regRate / 100)),
            regressionsPer100Words: Number(((45 * (p.regRate / 100) / 150) * 100).toFixed(1)),
            regressionRate: p.regRate,
            totalReturnSweepsCount: 6,
            lineTransitionsCount: 6,
            totalRevisits: 3,
            overallComprehensionAccuracyPct: p.readAcc,
            correctQuestionsCount: Math.round(5 * (p.readAcc / 100)),
            incorrectQuestionsCount: 5 - Math.round(5 * (p.readAcc / 100)),
            meanQuestionReactionTimeMs: 1650,
            medianQuestionReactionTimeMs: 1600,
            fastestQuestionReactionTimeMs: 1200,
            slowestQuestionReactionTimeMs: 2100,
            accuracyByQuestionType: {
              factual_recall: { total: 1, correct: 1, accuracyPct: 100 },
              main_idea: { total: 1, correct: 1, accuracyPct: 100 },
              detail: { total: 1, correct: p.readAcc >= 80 ? 1 : 0, accuracyPct: p.readAcc >= 80 ? 100 : 0 },
              simple_inference: { total: 1, correct: 1, accuracyPct: 100 },
              sequence_cause_effect: { total: 1, correct: 1, accuracyPct: 100 },
            },
          },
          gazeAvailabilityPct: p.gazeAvail,
        },
        dataQuality: quality,
        warnings: [],
      };

      this.sessions.set(session.sessionId, session);
    });
  }
}

export const globalDatasetManager = new ResearchDatasetManager();
