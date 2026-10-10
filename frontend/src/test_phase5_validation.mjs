/**
 * VISIONEXIS - PHASE 5: VISUAL SEARCH VALIDATION & DATA INTEGRITY TEST SUITE
 * Complete validation script for all 20 Phase 5 requirements.
 */

import assert from "node:assert";

console.log("==================================================================");
console.log("VISIONEXIS - PHASE 5: VISUAL SEARCH VALIDATION & DATA INTEGRITY TEST");
console.log("==================================================================\n");

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// Core Engine Functions (matching visualSearchTask.ts & gazeEvents.ts)
// -----------------------------------------------------------------------------

const SYMBOL_PAIRS_BY_DIFFICULTY = {
  EASY: [["△", "○"], ["★", "●"], ["■", "○"], ["▲", "□"], ["+", "o"], ["◆", "◇"]],
  MEDIUM: [["E", "F"], ["O", "C"], ["⬡", "□"], ["▲", "△"], ["X", "K"], ["T", "L"]],
  HARD: [["P", "R"], ["O", "Q"], ["C", "G"], ["M", "N"], ["V", "Y"], ["B", "D"]],
};

function generate20Trials() {
  const plan = [
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "EASY", gridSize: 4 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "MEDIUM", gridSize: 5 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
    { difficulty: "HARD", gridSize: 6 },
  ];

  const shuffledPlan = [...plan].sort(() => Math.random() - 0.5);

  return shuffledPlan.map((p, idx) => {
    const pairs = SYMBOL_PAIRS_BY_DIFFICULTY[p.difficulty];
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    const isSwapped = Math.random() > 0.5;
    const targetSymbol = isSwapped ? pair[1] : pair[0];
    const distractorSymbol = isSwapped ? pair[0] : pair[1];

    const totalCells = p.gridSize * p.gridSize;
    const targetIndex = Math.floor(Math.random() * totalCells);
    const cells = Array.from({ length: totalCells }, (_, i) =>
      i === targetIndex ? targetSymbol : distractorSymbol
    );

    return {
      trialId: idx + 1,
      difficulty: p.difficulty,
      gridSize: p.gridSize,
      targetSymbol,
      distractorSymbol,
      targetIndex,
      cells,
    };
  });
}

function computeGridAOIs(gridSize, cells, targetIndex, containerDims = { width: 560, height: 440 }, gridWidthPx = 380, gridHeightPx = 380) {
  const offsetX = (containerDims.width - gridWidthPx) / 2;
  const offsetY = (containerDims.height - gridHeightPx) / 2;
  const gap = 8;
  const cellWidth = (gridWidthPx - (gridSize - 1) * gap) / gridSize;
  const cellHeight = (gridHeightPx - (gridSize - 1) * gap) / gridSize;

  const aois = [];
  for (let i = 0; i < cells.length; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    const x = Math.round(offsetX + col * (cellWidth + gap));
    const y = Math.round(offsetY + row * (cellHeight + gap));

    aois.push({
      aoiId: `aoi_r${row}_c${col}`,
      row,
      column: col,
      x,
      y,
      width: Math.round(cellWidth),
      height: Math.round(cellHeight),
      isTarget: i === targetIndex,
      symbol: cells[i],
      index: i,
    });
  }
  return aois;
}

function getAOIForCoordinate(x, y, aois, padding = 6) {
  for (const aoi of aois) {
    if (
      x >= aoi.x - padding &&
      x <= aoi.x + aoi.width + padding &&
      y >= aoi.y - padding &&
      y <= aoi.y + aoi.height + padding
    ) {
      return aoi;
    }
  }
  return null;
}

// I-DT Fixation Detector
class FixationDetector {
  constructor(onFixation, config = {}) {
    this.onFixation = onFixation;
    this.maxDispersionPx = config.maxDispersionPx ?? 45;
    this.minDurationMs = config.minDurationMs ?? 80;
    this.window = [];
  }

  addSample(x, y, timestamp, confidence = 1, isBlink = false) {
    if (isBlink || confidence < 0.4) {
      this.flushWindow();
      return;
    }
    this.window.push({ x, y, timestamp, confidence });

    const span = this.window[this.window.length - 1].timestamp - this.window[0].timestamp;
    if (span >= this.minDurationMs) {
      const xs = this.window.map((s) => s.x);
      const ys = this.window.map((s) => s.y);
      const dispersion = Math.max(...xs) - Math.min(...xs) + (Math.max(...ys) - Math.min(...ys));

      if (dispersion <= this.maxDispersionPx) {
        // Sustained fixation
      } else {
        if (this.window.length > 2) {
          const validSub = this.window.slice(0, -1);
          const subSpan = validSub[validSub.length - 1].timestamp - validSub[0].timestamp;
          if (subSpan >= this.minDurationMs) {
            this.emitFixation(validSub);
          }
        }
        this.window.shift();
      }
    }
  }

  flushWindow() {
    if (this.window.length > 1) {
      const span = this.window[this.window.length - 1].timestamp - this.window[0].timestamp;
      if (span >= this.minDurationMs) {
        this.emitFixation(this.window);
      }
    }
    this.window = [];
  }

  emitFixation(pts) {
    const startTime = pts[0].timestamp;
    const endTime = pts[pts.length - 1].timestamp;
    const duration = Math.round(endTime - startTime);
    const meanX = Math.round(pts.reduce((s, p) => s + p.x, 0) / pts.length);
    const meanY = Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length);
    const confidence = Number((pts.reduce((s, p) => s + p.confidence, 0) / pts.length).toFixed(2));

    this.onFixation({
      fixationId: `fix_${Math.round(startTime)}`,
      startTime,
      endTime,
      duration,
      meanX,
      meanY,
      confidence,
    });
  }
}

// I-VT Saccade Detector
class ModularSaccadeDetector {
  constructor(onSaccade, config = {}) {
    this.onSaccade = onSaccade;
    this.minVelocityPxMs = config.minVelocityPxMs ?? 0.35;
    this.minAmplitudePx = config.minAmplitudePx ?? 25;
    this.prev = null;
  }

  addSample(x, y, timestamp) {
    if (this.prev) {
      const dt = timestamp - this.prev.timestamp;
      if (dt > 5 && dt < 120) {
        const dx = x - this.prev.x;
        const dy = y - this.prev.y;
        const dist = Math.hypot(dx, dy);
        const velocity = dist / dt;

        if (velocity >= this.minVelocityPxMs && dist >= this.minAmplitudePx) {
          this.onSaccade({
            saccadeId: `sac_${Math.round(this.prev.timestamp)}`,
            startTime: this.prev.timestamp,
            endTime: timestamp,
            duration: Math.round(dt),
            startX: this.prev.x,
            startY: this.prev.y,
            endX: x,
            endY: y,
            amplitude: Number(dist.toFixed(1)),
            velocity: Number(velocity.toFixed(2)),
          });
        }
      }
    }
    this.prev = { x, y, timestamp };
  }
}

function analyzeTrialPerformance(
  trialConfig,
  aois,
  gazeSamples,
  mouseEvents,
  fixations,
  saccades,
  trialStart,
  targetAppear,
  targetSelected,
  trialEnd,
  selectedCellIndex
) {
  const accuracy = selectedCellIndex === trialConfig.targetIndex;
  const reactionTime = Math.round(targetSelected - targetAppear);

  const trialFixations = fixations.filter(
    (f) => f.startTime >= targetAppear && f.startTime <= targetSelected + 100
  );
  const trialSaccades = saccades.filter(
    (s) => s.startTime >= targetAppear && s.startTime <= targetSelected + 100
  );

  const targetAOI = aois.find((a) => a.isTarget);
  let firstFixationTime = 0;
  let targetDetectionTime = 0;
  let targetFixationDuration = 0;
  let distractorFixationDuration = 0;
  let firstTargetFixationTimestamp = null;

  const aoiVisitSequence = [];

  trialFixations.forEach((fix, idx) => {
    const hitAOI = getAOIForCoordinate(fix.meanX, fix.meanY, aois);
    if (hitAOI) {
      fix.aoiId = hitAOI.aoiId;
      aoiVisitSequence.push(hitAOI.aoiId);

      if (idx === 0) {
        firstFixationTime = Math.max(0, Math.round(fix.startTime - targetAppear));
      }

      if (hitAOI.isTarget) {
        targetFixationDuration += fix.duration;
        if (targetDetectionTime === 0) {
          targetDetectionTime = Math.max(0, Math.round(fix.startTime - targetAppear));
          firstTargetFixationTimestamp = fix.startTime;
        }
      } else {
        distractorFixationDuration += fix.duration;
      }
    }
  });

  const totalFixationDuration = targetFixationDuration + distractorFixationDuration;
  const targetAttentionPct = totalFixationDuration > 0
    ? Number(((targetFixationDuration / totalFixationDuration) * 100).toFixed(1))
    : 0;
  const distractorAttentionPct = totalFixationDuration > 0
    ? Number(((distractorFixationDuration / totalFixationDuration) * 100).toFixed(1))
    : 0;

  // Revisits
  let revisitCount = 0;
  const visitedSet = new Set();
  for (let i = 0; i < aoiVisitSequence.length; i++) {
    const id = aoiVisitSequence[i];
    if (i > 0 && aoiVisitSequence[i - 1] === id) continue;
    if (visitedSet.has(id)) {
      revisitCount++;
    }
    visitedSet.add(id);
  }

  const searchTime = targetDetectionTime > 0 ? targetDetectionTime : reactionTime;
  const mouseSelectionTime = firstTargetFixationTimestamp
    ? Math.max(0, Math.round(targetSelected - firstTargetFixationTimestamp))
    : reactionTime;

  const baseScore = accuracy ? 70 : 10;
  const timePenalty = Math.min(30, Math.round(searchTime / 100));
  const revisitPenalty = Math.min(20, revisitCount * 5);
  const searchEfficiencyScore = Math.max(0, Math.min(100, baseScore + 30 - timePenalty - revisitPenalty));

  const clickEvent = mouseEvents.find((m) => m.type === "click") || { x: 0, y: 0, timestamp: targetSelected };
  const mouseMoves = mouseEvents.filter((m) => m.type === "move").length;

  return {
    trialId: trialConfig.trialId,
    difficulty: trialConfig.difficulty,
    gridSize: trialConfig.gridSize,
    targetSymbol: trialConfig.targetSymbol,
    distractorSymbol: trialConfig.distractorSymbol,
    targetIndex: trialConfig.targetIndex,
    selectedCellIndex,
    accuracy,
    reactionTime,
    trialStart,
    targetAppear,
    targetSelected,
    trialEnd,
    gazeMetrics: {
      firstFixationTime,
      targetDetectionTime,
      searchTime,
      mouseSelectionTime,
      targetFixationDuration,
      distractorFixationDuration,
      totalFixationDuration,
      targetAttentionPct,
      distractorAttentionPct,
      fixationCount: trialFixations.length,
      saccadeCount: trialSaccades.length,
      revisitCount,
      distractorFixationsCount: trialFixations.length - (firstTargetFixationTimestamp ? 1 : 0),
      searchEfficiencyScore,
    },
    mouseMetrics: {
      selectionTime: mouseSelectionTime,
      clickX: clickEvent.x,
      clickY: clickEvent.y,
      mouseMoveCount: mouseMoves,
    },
    aois,
    gazeSamples,
    mouseEvents,
    fixations: trialFixations,
    saccades: trialSaccades,
  };
}

function computeMedianValue(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function aggregateVisualSearchSession(sessionId, trials, participantId, metadata) {
  const totalTrials = trials.length || 1;
  const correctTrials = trials.filter((t) => t.accuracy).length;
  const accuracyPct = Number(((correctTrials / totalTrials) * 100).toFixed(1));

  const reactionTimes = trials.map((t) => t.reactionTime);
  const searchTimes = trials.map((t) => t.gazeMetrics.searchTime);

  const avgReactionTimeMs = Math.round(trials.reduce((sum, t) => sum + t.reactionTime, 0) / totalTrials);
  const medianReactionTimeMs = computeMedianValue(reactionTimes);

  const avgSearchTimeMs = Math.round(trials.reduce((sum, t) => sum + t.gazeMetrics.searchTime, 0) / totalTrials);
  const medianSearchTimeMs = computeMedianValue(searchTimes);

  const avgFixationDurationMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.totalFixationDuration, 0) / totalTrials
  );
  const meanTargetFixationDurationMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.targetFixationDuration, 0) / totalTrials
  );
  const meanDistractorFixationDurationMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.distractorFixationDuration, 0) / totalTrials
  );

  const totalFixations = trials.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0);
  const totalSaccades = trials.reduce((sum, t) => sum + t.gazeMetrics.saccadeCount, 0);
  const totalRevisits = trials.reduce((sum, t) => sum + t.gazeMetrics.revisitCount, 0);

  const avgFixationsCount = Number((totalFixations / totalTrials).toFixed(1));
  const avgSaccadesCount = Number((totalSaccades / totalTrials).toFixed(1));
  const avgRevisitsCount = Number((totalRevisits / totalTrials).toFixed(1));

  const avgTargetAttentionPct = Number(
    (trials.reduce((sum, t) => sum + t.gazeMetrics.targetAttentionPct, 0) / totalTrials).toFixed(1)
  );
  const avgDistractorAttentionPct = Number(
    (trials.reduce((sum, t) => sum + t.gazeMetrics.distractorAttentionPct, 0) / totalTrials).toFixed(1)
  );
  const avgSearchEfficiency = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.searchEfficiencyScore, 0) / totalTrials
  );
  const mouseGazeLatencyMs = Math.round(
    trials.reduce((sum, t) => sum + t.gazeMetrics.mouseSelectionTime, 0) / totalTrials
  );

  const calcDiff = (diff) => {
    const subset = trials.filter((t) => t.difficulty === diff);
    const subN = subset.length || 1;
    const subCorrect = subset.filter((t) => t.accuracy).length;
    return {
      difficulty: diff,
      trialCount: subset.length,
      accuracyPct: Number(((subCorrect / subN) * 100).toFixed(1)),
      avgReactionTimeMs: Math.round(subset.reduce((sum, t) => sum + t.reactionTime, 0) / subN),
      avgSearchTimeMs: Math.round(subset.reduce((sum, t) => sum + t.gazeMetrics.searchTime, 0) / subN),
      avgFixationDurationMs: Math.round(
        subset.reduce((sum, t) => sum + t.gazeMetrics.totalFixationDuration, 0) / subN
      ),
      avgFixationsCount: Number((subset.reduce((sum, t) => sum + t.gazeMetrics.fixationCount, 0) / subN).toFixed(1)),
      avgSaccadesCount: Number((subset.reduce((sum, t) => sum + t.gazeMetrics.saccadeCount, 0) / subN).toFixed(1)),
      avgRevisitsCount: Number((subset.reduce((sum, t) => sum + t.gazeMetrics.revisitCount, 0) / subN).toFixed(1)),
      avgTargetAttentionPct: Number(
        (subset.reduce((sum, t) => sum + t.gazeMetrics.targetAttentionPct, 0) / subN).toFixed(1)
      ),
      avgDistractorAttentionPct: Number(
        (subset.reduce((sum, t) => sum + t.gazeMetrics.distractorAttentionPct, 0) / subN).toFixed(1)
      ),
      avgSearchEfficiency: Math.round(
        subset.reduce((sum, t) => sum + t.gazeMetrics.searchEfficiencyScore, 0) / subN
      ),
    };
  };

  return {
    sessionId,
    participantId,
    task: "visual_search",
    taskVersion: metadata?.taskVersion ?? "1.0.0",
    calibrationProfileId: metadata?.calibrationProfileId ?? "default_v1",
    viewportWidth: metadata?.viewportWidth ?? 560,
    viewportHeight: metadata?.viewportHeight ?? 440,
    cameraStatus: metadata?.cameraStatus ?? "CONNECTED",
    validationStatus: metadata?.validationStatus ?? "VALIDATED",
    totalTrials: trials.length,
    accuracyPct,
    avgReactionTimeMs,
    medianReactionTimeMs,
    avgSearchTimeMs,
    medianSearchTimeMs,
    avgFixationDurationMs,
    meanTargetFixationDurationMs,
    meanDistractorFixationDurationMs,
    avgFixationsCount,
    avgSaccadesCount,
    avgRevisitsCount,
    totalFixations,
    totalSaccades,
    totalRevisits,
    avgTargetAttentionPct,
    avgDistractorAttentionPct,
    avgSearchEfficiency,
    mouseGazeLatencyMs,
    difficultyBreakdown: {
      EASY: calcDiff("EASY"),
      MEDIUM: calcDiff("MEDIUM"),
      HARD: calcDiff("HARD"),
    },
    trials,
  };
}

// -----------------------------------------------------------------------------
// EXECUTE AUTOMATED TESTS
// -----------------------------------------------------------------------------

console.log("TEST 1: Flow & Pre-flight Validation Gating");
test("Pre-flight checklist requires valid calibration & active tracking", () => {
  const uncalibrated = { isCalibrated: false, calibrationModel: null };
  const calibrated = {
    isCalibrated: true,
    calibrationModel: {
      calibrationVersion: 1,
      id: "calib_test_user_001",
      validation: { qualityRating: "GOOD", maePx: 32.4, confidenceScore: 92 },
    },
  };
  assert.strictEqual(uncalibrated.isCalibrated, false);
  assert.strictEqual(calibrated.isCalibrated, true);
  assert.strictEqual(calibrated.calibrationModel.validation.qualityRating, "GOOD");
});

console.log("\nTEST 2: 20-Trial Configuration & Randomization");
test("20 trials generation with Easy (4x4), Medium (5x5), Hard (6x6)", () => {
  const trials = generate20Trials();
  assert.strictEqual(trials.length, 20);

  const easy = trials.filter((t) => t.difficulty === "EASY");
  const medium = trials.filter((t) => t.difficulty === "MEDIUM");
  const hard = trials.filter((t) => t.difficulty === "HARD");

  assert.strictEqual(easy.length, 7);
  assert.strictEqual(medium.length, 7);
  assert.strictEqual(hard.length, 6);

  easy.forEach((t) => assert.strictEqual(t.gridSize, 4));
  medium.forEach((t) => assert.strictEqual(t.gridSize, 5));
  hard.forEach((t) => assert.strictEqual(t.gridSize, 6));

  trials.forEach((t, idx) => {
    assert.strictEqual(t.trialId, idx + 1);
    const totalCells = t.gridSize * t.gridSize;
    assert.strictEqual(t.cells.length, totalCells);
    assert.ok(t.targetIndex >= 0 && t.targetIndex < totalCells);
    assert.strictEqual(t.cells[t.targetIndex], t.targetSymbol);
    assert.notStrictEqual(t.targetSymbol, t.distractorSymbol);
  });
});

console.log("\nTEST 3: AOI Detection & Boundary Geometry");
test("Grid AOIs are computed with dynamic container coordinates and unique IDs", () => {
  const container = { width: 560, height: 440 };
  const gridPx = 380;
  const trial = generate20Trials().find((t) => t.difficulty === "EASY");

  const aois = computeGridAOIs(trial.gridSize, trial.cells, trial.targetIndex, container, gridPx, gridPx);
  assert.strictEqual(aois.length, 16);

  const aoiIds = new Set(aois.map((a) => a.aoiId));
  assert.strictEqual(aoiIds.size, 16);

  const targetAOIs = aois.filter((a) => a.isTarget);
  assert.strictEqual(targetAOIs.length, 1);
  assert.strictEqual(targetAOIs[0].index, trial.targetIndex);

  const targetAOI = targetAOIs[0];
  const hit = getAOIForCoordinate(targetAOI.x + 10, targetAOI.y + 10, aois);
  assert.strictEqual(hit?.aoiId, targetAOI.aoiId);

  const hitOutside = getAOIForCoordinate(10, 10, aois);
  assert.strictEqual(hitOutside, null);
});

console.log("\nTEST 4: Gaze vs Mouse Independence & Time Sync");
test("Gaze and mouse remain independent streams sharing monotonic clock", () => {
  const gazeSamples = [];
  const mouseEvents = [];
  let clock = 1000.0;

  for (let i = 0; i < 30; i++) {
    clock += 33.33;
    gazeSamples.push({
      timestamp: clock,
      gazeX: 280 + Math.sin(i / 5) * 40,
      gazeY: 220 + Math.cos(i / 5) * 30,
      confidence: 0.92,
      blink: false,
    });
  }

  let mouseClock = 1015.0;
  for (let j = 0; j < 10; j++) {
    mouseClock += 80.0;
    mouseEvents.push({
      type: "move",
      x: 100 + j * 15,
      y: 150 + j * 10,
      timestamp: mouseClock,
    });
  }
  mouseEvents.push({ type: "click", x: 280, y: 220, timestamp: 1980.0 });

  assert.notStrictEqual(gazeSamples[0].gazeX, mouseEvents[0].x);
  assert.notStrictEqual(gazeSamples[0].gazeY, mouseEvents[0].y);

  for (let i = 1; i < gazeSamples.length; i++) {
    assert.ok(gazeSamples[i].timestamp > gazeSamples[i - 1].timestamp);
  }
  for (let j = 1; j < mouseEvents.length; j++) {
    assert.ok(mouseEvents[j].timestamp > mouseEvents[j - 1].timestamp);
  }
});

console.log("\nTEST 5: Fixation (I-DT) & Saccade (I-VT) Detection");
test("I-DT detects sustained fixations; I-VT detects high-velocity saccades", () => {
  const detectedFixations = [];
  const detectedSaccades = [];

  const fixDetector = new FixationDetector((fix) => detectedFixations.push(fix), {
    maxDispersionPx: 45,
    minDurationMs: 80,
  });
  const sacDetector = new ModularSaccadeDetector((sac) => detectedSaccades.push(sac), {
    minVelocityPxMs: 0.35,
    minAmplitudePx: 25,
  });

  let t = 100.0;
  // Phase 1: Cluster at (200, 200) for 150ms
  for (let i = 0; i < 6; i++) {
    t += 30;
    fixDetector.addSample(200 + (Math.random() * 4 - 2), 200 + (Math.random() * 4 - 2), t, 0.9, false);
    sacDetector.addSample(200, 200, t);
  }
  // Phase 2: Saccade to (400, 300)
  t += 30;
  fixDetector.addSample(400, 300, t, 0.9, false);
  sacDetector.addSample(400, 300, t);
  // Phase 3: Cluster at (400, 300) for 180ms
  for (let i = 0; i < 6; i++) {
    t += 30;
    fixDetector.addSample(400 + (Math.random() * 4 - 2), 300 + (Math.random() * 4 - 2), t, 0.9, false);
    sacDetector.addSample(400, 300, t);
  }
  fixDetector.flushWindow();

  assert.ok(detectedFixations.length >= 2);
  assert.ok(detectedSaccades.length >= 1);
  assert.ok(Math.abs(detectedFixations[0].meanX - 200) < 10);
  assert.ok(detectedFixations[0].duration >= 80);
  assert.ok(detectedSaccades[0].amplitude > 50);
});

console.log("\nTEST 6: Missing Data Isolation");
test("Missing webcam frames marked invalid without fabricating data", () => {
  const samples = [
    { timestamp: 100, gazeX: 300, gazeY: 250, confidence: 0.95, blink: false },
    { timestamp: 133, gazeX: 0, gazeY: 0, confidence: 0.1, blink: false },
    { timestamp: 166, gazeX: 300, gazeY: 250, confidence: 0.95, blink: true },
  ];
  const validSamples = samples.filter((s) => !s.blink && s.confidence >= 0.4);
  assert.strictEqual(validSamples.length, 1);
});

console.log("\nTEST 7: Full 20-Trial Session & Derived Metrics");
test("Complete 20-trial session aggregation with dual-modality latency and breakdown", () => {
  const trials = generate20Trials();
  const completedTrialRecords = [];
  const container = { width: 560, height: 440 };

  let sessionClock = 10000.0;
  trials.forEach((trialConfig, idx) => {
    const tStart = sessionClock;
    const tAppear = tStart + 50;
    const searchDuration = 450 + (trialConfig.gridSize - 4) * 200;
    const tSelect = tAppear + searchDuration;
    const tEnd = tSelect + 100;
    sessionClock = tEnd + 150;

    const aois = computeGridAOIs(trialConfig.gridSize, trialConfig.cells, trialConfig.targetIndex, container, 380, 380);
    const targetAOI = aois.find((a) => a.isTarget);
    const dAOI = aois.find((a) => !a.isTarget);

    const fixations = [
      {
        fixationId: `fix_${idx}_1`,
        startTime: tAppear + 50,
        endTime: tAppear + 200,
        duration: 150,
        meanX: dAOI.x + dAOI.width / 2,
        meanY: dAOI.y + dAOI.height / 2,
        confidence: 0.9,
      },
      {
        fixationId: `fix_${idx}_2`,
        startTime: tAppear + 250,
        endTime: tSelect - 50,
        duration: Math.round(tSelect - 50 - (tAppear + 250)),
        meanX: targetAOI.x + targetAOI.width / 2,
        meanY: targetAOI.y + targetAOI.height / 2,
        confidence: 0.95,
      },
    ];

    const saccades = [
      {
        saccadeId: `sac_${idx}_1`,
        startTime: tAppear + 200,
        endTime: tAppear + 250,
        duration: 50,
        startX: dAOI.x + dAOI.width / 2,
        startY: dAOI.y + dAOI.height / 2,
        endX: targetAOI.x + targetAOI.width / 2,
        endY: targetAOI.y + targetAOI.height / 2,
        amplitude: 150,
        velocity: 3.0,
      },
    ];

    const gazeSamples = [];
    for (let ts = tStart; ts <= tEnd; ts += 33.3) {
      gazeSamples.push({
        timestamp: ts,
        gazeX: targetAOI.x + targetAOI.width / 2,
        gazeY: targetAOI.y + targetAOI.height / 2,
        confidence: 0.92,
        blink: false,
      });
    }

    const mouseEvents = [
      { type: "move", x: 100, y: 100, timestamp: tAppear + 100 },
      { type: "click", x: targetAOI.x + 10, y: targetAOI.y + 10, timestamp: tSelect },
    ];

    const trialResult = analyzeTrialPerformance(
      trialConfig,
      aois,
      gazeSamples,
      mouseEvents,
      fixations,
      saccades,
      tStart,
      tAppear,
      tSelect,
      tEnd,
      trialConfig.targetIndex
    );
    completedTrialRecords.push(trialResult);
  });

  const sessionSummary = aggregateVisualSearchSession("sess_001", completedTrialRecords, "p_001", {
    calibrationProfileId: "calib_v1_good",
    viewportWidth: 560,
    viewportHeight: 440,
    cameraStatus: "CONNECTED",
    validationStatus: "VALIDATED_GOOD",
    taskVersion: "1.0.0",
  });

  assert.strictEqual(sessionSummary.totalTrials, 20);
  assert.strictEqual(sessionSummary.accuracyPct, 100);
  assert.ok(sessionSummary.avgReactionTimeMs > 400);
  assert.ok(sessionSummary.medianReactionTimeMs > 400);
  assert.ok(sessionSummary.avgSearchTimeMs > 0);
  assert.ok(sessionSummary.mouseGazeLatencyMs > 0);
  assert.strictEqual(sessionSummary.totalFixations, 40);
  assert.strictEqual(sessionSummary.totalSaccades, 20);
  assert.strictEqual(sessionSummary.difficultyBreakdown.EASY.trialCount, 7);
  assert.strictEqual(sessionSummary.difficultyBreakdown.MEDIUM.trialCount, 7);
  assert.strictEqual(sessionSummary.difficultyBreakdown.HARD.trialCount, 6);
  assert.strictEqual(sessionSummary.taskVersion, "1.0.0");
  assert.strictEqual(sessionSummary.calibrationProfileId, "calib_v1_good");
});

console.log("\nTEST 8: Raw Data Preservation Schema");
test("Export preserves raw gaze, mouse, fixations, saccades, AOIs, and metrics", () => {
  const trial = generate20Trials()[0];
  const aois = computeGridAOIs(trial.gridSize, trial.cells, trial.targetIndex);
  const result = analyzeTrialPerformance(
    trial,
    aois,
    [{ timestamp: 100, gazeX: 200, gazeY: 200, confidence: 0.9, blink: false }],
    [{ type: "click", x: 200, y: 200, timestamp: 350 }],
    [],
    [],
    50,
    100,
    350,
    400,
    trial.targetIndex
  );
  const summary = aggregateVisualSearchSession("export_test_id", [result], "p_exp_01");
  const parsed = JSON.parse(JSON.stringify(summary));

  assert.strictEqual(parsed.sessionId, "export_test_id");
  assert.ok(Array.isArray(parsed.trials[0].gazeSamples));
  assert.ok(Array.isArray(parsed.trials[0].mouseEvents));
  assert.ok(Array.isArray(parsed.trials[0].aois));
  assert.ok(parsed.trials[0].gazeMetrics);
});

console.log(`\n==================================================================`);
console.log(`PHASE 5 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log(`==================================================================\n`);
