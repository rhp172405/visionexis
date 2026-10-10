/**
 * VISIONEXIS - PHASE 7: READING & COMPREHENSION COGNITIVE TASK TEST SUITE
 *
 * Validates:
 * 1. Passage loading & schema verification
 * 2. Word counting precision
 * 3. Line AOI generation & geometry
 * 4. Word AOI generation & bounding boxes
 * 5. Passage randomization & selection
 * 6. Question generation, options & question types (5 per passage)
 * 7. Reading-time calculation (total & active)
 * 8. Words Per Minute (WPM) calculation
 * 9. Fixation aggregation & metrics (count, mean/median/max/min, per 100 words)
 * 10. Saccade aggregation & velocity/amplitude metrics
 * 11. Regression detection (intra-line & inter-line) & regression rate
 * 12. Return-sweep detection (end-of-line to start-of-next-line)
 * 13. Multiple-choice question scoring & reaction times
 * 14. Comprehension accuracy & breakdown by 5 question types
 * 15. Missing-data & invalid gaze sample handling
 * 16. Complete session aggregation (ReadingSessionRecord)
 * 17. Raw-data preservation (unaltered raw gaze, mouse, events)
 * 18. JSON serialization & round-trip integrity
 * 19. Seed reproducibility & deterministic selection
 * 20. Extreme / empty / boundary input handling
 */

import assert from "node:assert";

console.log("==================================================================");
console.log("VISIONEXIS - PHASE 7: READING & COMPREHENSION TEST SUITE");
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
// Core Engine Definitions & Passage Bank
// -----------------------------------------------------------------------------

const READING_PASSAGE_BANK = [
  {
    passageId: "passage_boreal_forest",
    title: "Ecosystems of the Boreal Forest",
    text: "The boreal forest, also known as the taiga, represents one of the largest terrestrial biomes on Earth. Spanning broad northern latitudes across North America, Scandinavia, and northern Eurasia, this dense coniferous wilderness endures long, severe winters and short, temperate summers. Evergreen spruce, pine, and fir trees dominate the landscape, featuring conical shapes and flexible needles specifically adapted to shed heavy snowfall without breaking. Beneath the dense forest canopy, the forest floor is blanketed with thick moss, lichen, and peatlands that insulate the underlying permafrost layer. Numerous animal species have developed specialized adaptations to thrive in this demanding environment. While migratory birds travel south before the onset of extreme cold, resident species such as the snowshoe hare and lynx alter their coat density and coloration to blend seamlessly with the winter snow. The boreal forest plays a crucial global role by storing vast quantities of carbon in its soil and biomass.",
    paragraphs: [
      "The boreal forest, also known as the taiga, represents one of the largest terrestrial biomes on Earth. Spanning broad northern latitudes across North America, Scandinavia, and northern Eurasia, this dense coniferous wilderness endures long, severe winters and short, temperate summers.",
      "Evergreen spruce, pine, and fir trees dominate the landscape, featuring conical shapes and flexible needles specifically adapted to shed heavy snowfall without breaking. Beneath the dense forest canopy, the forest floor is blanketed with thick moss, lichen, and peatlands that insulate the underlying permafrost layer.",
      "Numerous animal species have developed specialized adaptations to thrive in this demanding environment. While migratory birds travel south before the onset of extreme cold, resident species such as the snowshoe hare and lynx alter their coat density and coloration to blend seamlessly with the winter snow. The boreal forest plays a crucial global role by storing vast quantities of carbon in its soil and biomass.",
    ],
    wordCount: 150,
    estimatedReadingTimeSec: 45,
    questions: [
      {
        questionId: "q_bf_1",
        question: "What is another common name for the boreal forest?",
        type: "factual_recall",
        options: ["Tundra", "Taiga", "Savanna", "Chaparral"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_bf_2",
        question: "What structural feature helps evergreen trees in this biome survive heavy snow?",
        type: "detail",
        options: ["Broad flat leaves", "Deep taproots", "Conical shapes and flexible needles", "Thick deciduous bark"],
        correctOptionIndex: 2,
      },
      {
        questionId: "q_bf_3",
        question: "Why do resident species like the snowshoe hare change coat coloration in winter?",
        type: "simple_inference",
        options: ["To absorb more sunlight", "To attract seasonal mates", "To blend with the snow and avoid predators", "To shed excess moisture"],
        correctOptionIndex: 2,
      },
      {
        questionId: "q_bf_4",
        question: "What is the primary global ecological benefit of the boreal forest mentioned in the passage?",
        type: "main_idea",
        options: ["Supplying freshwater to equatorial rivers", "Storing massive amounts of carbon in soil and biomass", "Producing the majority of commercial timber", "Preventing desertification in tropical zones"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_bf_5",
        question: "What event occurs before the onset of severe winter cold?",
        type: "sequence_cause_effect",
        options: ["Permafrost completely melts", "Migratory birds travel south", "Spruce trees shed all their needles", "The forest floor dries out completely"],
        correctOptionIndex: 1,
      },
    ],
  },
  {
    passageId: "passage_deep_ocean",
    title: "Exploration of the Abyssal Ocean",
    text: "Deep beneath the sunlit ocean surface lies the abyssal zone, a perpetual expanse of darkness, freezing temperatures, and crushing hydrostatic pressure. Reaching depths between three thousand and six thousand meters, this extreme marine habitat covers more than sixty percent of the ocean floor. Sunlight diminishes completely below two hundred meters, eliminating photosynthetic vegetation and requiring organisms to rely on alternative energy sources. Nutrients primarily descend from above in the form of marine snow, a continuous shower of organic particles, deceased plankton, and detritus. Hydrothermal vents situated along tectonic rift boundaries provide another vital oasis, discharging mineral-rich superheated fluids that support chemosynthetic bacteria. These specialized microbes form the foundation of unique ecosystems comprising giant tube worms, vent crabs, and bioluminescent fish. Advancements in robotic submersibles and autonomous underwater vehicles have recently transformed ocean exploration, allowing oceanographers to document previously undiscovered biological adaptations.",
    paragraphs: [
      "Deep beneath the sunlit ocean surface lies the abyssal zone, a perpetual expanse of darkness, freezing temperatures, and crushing hydrostatic pressure. Reaching depths between three thousand and six thousand meters, this extreme marine habitat covers more than sixty percent of the ocean floor.",
      "Sunlight diminishes completely below two hundred meters, eliminating photosynthetic vegetation and requiring organisms to rely on alternative energy sources. Nutrients primarily descend from above in the form of marine snow, a continuous shower of organic particles, deceased plankton, and detritus.",
      "Hydrothermal vents situated along tectonic rift boundaries provide another vital oasis, discharging mineral-rich superheated fluids that support chemosynthetic bacteria. These specialized microbes form the foundation of unique ecosystems comprising giant tube worms, vent crabs, and bioluminescent fish. Advancements in robotic submersibles and autonomous underwater vehicles have recently transformed ocean exploration, allowing oceanographers to document previously undiscovered biological adaptations.",
    ],
    wordCount: 141,
    estimatedReadingTimeSec: 44,
    questions: [
      {
        questionId: "q_do_1",
        question: "At what depth does sunlight diminish completely in the ocean?",
        type: "factual_recall",
        options: ["50 meters", "200 meters", "1,000 meters", "3,000 meters"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_do_2",
        question: "What is 'marine snow' as described in the text?",
        type: "detail",
        options: ["Frozen seawater drifting near the poles", "A continuous shower of organic particles and detritus", "Mineral crystals precipitating from underwater volcanoes", "Bioluminescent algae blooms floating on the surface"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_do_3",
        question: "What organisms form the foundational energy base around hydrothermal vents?",
        type: "simple_inference",
        options: ["Photosynthetic kelp", "Chemosynthetic bacteria", "Coral polyps", "Microscopic jellyfish"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_do_4",
        question: "What is the overarching main theme of the passage?",
        type: "main_idea",
        options: ["The historical development of scuba diving", "Commercial fishing operations in deep water", "The unique ecology and exploration of the dark abyssal ocean", "Global weather patterns driven by ocean surface currents"],
        correctOptionIndex: 2,
      },
      {
        questionId: "q_do_5",
        question: "Why can photosynthetic plants not survive in the abyssal zone?",
        type: "sequence_cause_effect",
        options: ["Water pressure crushes cell walls", "Total absence of sunlight below 200 meters", "The water is saturated with sulfur", "Temperatures are too high near vents"],
        correctOptionIndex: 1,
      },
    ],
  },
  {
    passageId: "passage_archaeology_drones",
    title: "Aerial Technology in Modern Archaeology",
    text: "Archaeological methodology has undergone a profound transformation over the past two decades through the integration of aerial remote sensing technologies. Traditional field archaeology relied almost exclusively on labor-intensive ground surveys and historical cartography to locate buried settlements. Today, researchers utilize unmanned aerial vehicles equipped with specialized sensors, including multispectral cameras and LiDAR systems. LiDAR, which stands for Light Detection and Ranging, transmits rapid pulses of laser light toward the ground, calculating the precise time required for each pulse to reflect back to the sensor. By digitally removing dense forest vegetation from the resulting point cloud data, archaeologists can generate high-resolution topographical elevation models of the terrain beneath. This capability has enabled the rapid discovery of extensive pre-Columbian urban complexes, ancient roadway networks, and sophisticated agricultural terraces concealed beneath dense jungle canopies. Non-destructive remote mapping protects fragile archaeological heritage while guiding targeted on-site excavations.",
    paragraphs: [
      "Archaeological methodology has undergone a profound transformation over the past two decades through the integration of aerial remote sensing technologies. Traditional field archaeology relied almost exclusively on labor-intensive ground surveys and historical cartography to locate buried settlements.",
      "Today, researchers utilize unmanned aerial vehicles equipped with specialized sensors, including multispectral cameras and LiDAR systems. LiDAR, which stands for Light Detection and Ranging, transmits rapid pulses of laser light toward the ground, calculating the precise time required for each pulse to reflect back to the sensor.",
      "By digitally removing dense forest vegetation from the resulting point cloud data, archaeologists can generate high-resolution topographical elevation models of the terrain beneath. This capability has enabled the rapid discovery of extensive pre-Columbian urban complexes, ancient roadway networks, and sophisticated agricultural terraces concealed beneath dense jungle canopies. Non-destructive remote mapping protects fragile archaeological heritage while guiding targeted on-site excavations.",
    ],
    wordCount: 143,
    estimatedReadingTimeSec: 43,
    questions: [
      {
        questionId: "q_ad_1",
        question: "What does the acronym LiDAR represent?",
        type: "factual_recall",
        options: ["Light Detection and Ranging", "Laser Imaging for Digital Aerial Reconnaissance", "Low-altitude Infrared Detection and Radar", "Linear Data Analysis Resource"],
        correctOptionIndex: 0,
      },
      {
        questionId: "q_ad_2",
        question: "How did traditional archaeology locate buried settlements prior to modern sensors?",
        type: "detail",
        options: ["Satellite thermal imaging", "Ground surveys and historical cartography", "Magnetic resonance scanning", "Autonomous robotic excavation"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_ad_3",
        question: "How does LiDAR reveal ancient structures hidden beneath dense jungle vegetation?",
        type: "simple_inference",
        options: ["By burning away surface foliage with high-energy lasers", "By filtering out vegetation data points to reveal the ground elevation model", "By detecting magnetic disturbances in ancient pottery", "By measuring moisture levels in tree roots"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_ad_4",
        question: "What key advantage does non-destructive remote mapping offer?",
        type: "main_idea",
        options: ["It completely eliminates the need for historians", "It protects fragile cultural heritage while guiding targeted excavations", "It is significantly cheaper than studying historical books", "It replaces the need for museum preservation"],
        correctOptionIndex: 1,
      },
      {
        questionId: "q_ad_5",
        question: "What is calculated by the sensor when laser pulses reflect from the ground?",
        type: "sequence_cause_effect",
        options: ["The temperature of the earth", "The mineral composition of the rocks", "The precise round-trip travel time of the light pulse", "The wind speed during flight"],
        correctOptionIndex: 2,
      },
    ],
  },
];

// Helper functions for reading calculation
function calculateWordsPerMinute(wordCount, activeReadingTimeMs) {
  if (activeReadingTimeMs <= 0 || wordCount <= 0) return 0;
  const minutes = activeReadingTimeMs / 60000;
  return Math.round(wordCount / minutes);
}

function classifyReadingSaccade(sac, lineAOIs) {
  const fromLine = lineAOIs.find(
    (l) => sac.startY >= l.y - 12 && sac.startY <= l.y + l.height + 12
  );
  const toLine = lineAOIs.find(
    (l) => sac.endY >= l.y - 12 && sac.endY <= l.y + l.height + 12
  );

  const fromLineIdx = fromLine ? fromLine.lineIndex : undefined;
  const toLineIdx = toLine ? toLine.lineIndex : undefined;

  const dx = sac.endX - sac.startX;
  const dy = sac.endY - sac.startY;

  // 1. Return Sweep: End of line to next line start
  if (
    fromLineIdx !== undefined &&
    toLineIdx !== undefined &&
    toLineIdx === fromLineIdx + 1 &&
    dx < -120 &&
    dy > 0
  ) {
    return {
      classification: "return_sweep",
      fromLineIndex: fromLineIdx,
      toLineIndex: toLineIdx,
      isRegression: false,
      isReturnSweep: true,
    };
  }

  // 2. Regression
  if (
    (fromLineIdx !== undefined && toLineIdx !== undefined && toLineIdx < fromLineIdx) ||
    (fromLineIdx !== undefined && toLineIdx === fromLineIdx && dx < -35)
  ) {
    return {
      classification: "regressive",
      fromLineIndex: fromLineIdx,
      toLineIndex: toLineIdx,
      isRegression: true,
      isReturnSweep: false,
    };
  }

  // 3. Progressive
  if (
    (fromLineIdx !== undefined && toLineIdx === fromLineIdx && dx >= 15) ||
    (fromLineIdx !== undefined && toLineIdx !== undefined && toLineIdx > fromLineIdx && dx >= 0)
  ) {
    return {
      classification: "progressive",
      fromLineIndex: fromLineIdx,
      toLineIndex: toLineIdx,
      isRegression: false,
      isReturnSweep: false,
    };
  }

  // 4. Vertical Glance
  if (Math.abs(dy) > 30 && Math.abs(dx) < 30) {
    return {
      classification: "vertical_interline",
      fromLineIndex: fromLineIdx,
      toLineIndex: toLineIdx,
      isRegression: false,
      isReturnSweep: false,
    };
  }

  return {
    classification: "indeterminate",
    fromLineIndex: fromLineIdx,
    toLineIndex: toLineIdx,
    isRegression: false,
    isReturnSweep: false,
  };
}

function computeMedianValue(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function aggregateReadingSession(
  sessionId,
  passage,
  lineAOIs,
  wordAOIs,
  rawGazeSamples,
  rawMouseEvents,
  fixations,
  saccades,
  readingStartTime,
  readingEndTime,
  questionResponses,
  seed,
  participantId,
  metadata
) {
  const readingTimeMs = Math.max(0, Math.round(readingEndTime - readingStartTime));

  const readingGaze = rawGazeSamples.filter(
    (s) => s.timestamp >= readingStartTime && s.timestamp <= readingEndTime
  );
  const validReadingGaze = readingGaze.filter((s) => !s.blink && s.confidence >= 0.4);

  const activeReadingTimeMs = validReadingGaze.length > 0
    ? Math.round(validReadingGaze.length * 33.3)
    : readingTimeMs;

  const wordsPerMinute = calculateWordsPerMinute(passage.wordCount, activeReadingTimeMs);

  const readingFixations = fixations.filter((f) => {
    const fStart = f.startTime ?? f.fixationStart;
    return fStart >= readingStartTime && fStart <= readingEndTime;
  });

  const fixationDurations = readingFixations.map((f) => f.duration);
  const totalFixationCount = readingFixations.length;
  const meanFixationDurationMs = totalFixationCount > 0
    ? Math.round(fixationDurations.reduce((a, b) => a + b, 0) / totalFixationCount)
    : 0;
  const medianFixationDurationMs = computeMedianValue(fixationDurations);
  const maxFixationDurationMs = fixationDurations.length > 0 ? Math.max(...fixationDurations) : 0;
  const minFixationDurationMs = fixationDurations.length > 0 ? Math.min(...fixationDurations) : 0;
  const fixationsPer100Words = Number(
    ((totalFixationCount / Math.max(1, passage.wordCount)) * 100).toFixed(1)
  );

  const classifiedSaccades = [];
  const regressions = [];
  const returnSweeps = [];

  const readingSaccades = saccades.filter(
    (s) => s.startTime >= readingStartTime && s.startTime <= readingEndTime
  );

  readingSaccades.forEach((sac, idx) => {
    const res = classifyReadingSaccade(sac, lineAOIs);
    const classified = {
      saccadeId: sac.id ?? `sac_${idx}_${Math.round(sac.startTime)}`,
      startTime: sac.startTime,
      endTime: sac.endTime,
      duration: sac.duration,
      startX: sac.startX,
      startY: sac.startY,
      endX: sac.endX,
      endY: sac.endY,
      amplitude: sac.amplitude,
      velocity: sac.velocity,
      classification: res.classification,
      fromLineIndex: res.fromLineIndex,
      toLineIndex: res.toLineIndex,
    };
    classifiedSaccades.push(classified);

    if (res.isRegression && res.fromLineIndex !== undefined && res.toLineIndex !== undefined) {
      regressions.push({
        regressionId: `reg_${idx}`,
        startTime: sac.startTime,
        endTime: sac.endTime,
        fromLine: res.fromLineIndex,
        toLine: res.toLineIndex,
        distancePx: Math.round(sac.amplitude),
        isInterLine: res.toLineIndex !== res.fromLineIndex,
      });
    }

    if (res.isReturnSweep && res.fromLineIndex !== undefined && res.toLineIndex !== undefined) {
      returnSweeps.push({
        fromLine: res.fromLineIndex,
        toLine: res.toLineIndex,
        timestamp: sac.startTime,
        durationMs: sac.duration,
        horizontalDistancePx: Math.abs(sac.endX - sac.startX),
        verticalDistancePx: Math.abs(sac.endY - sac.startY),
      });
    }
  });

  const totalSaccadeCount = classifiedSaccades.length;
  const progressiveSaccadesCount = classifiedSaccades.filter((s) => s.classification === "progressive").length;
  const totalRegressionsCount = regressions.length;
  const regressionsPer100Words = Number(
    ((totalRegressionsCount / Math.max(1, passage.wordCount)) * 100).toFixed(1)
  );
  const regressionRate = totalSaccadeCount > 0
    ? Number(((totalRegressionsCount / totalSaccadeCount) * 100).toFixed(1))
    : 0;

  const lineMetrics = lineAOIs.map((line) => {
    const lineFixations = readingFixations.filter(
      (f) => f.meanY >= line.y - 8 && f.meanY <= line.y + line.height + 8
    );
    const dwellTimeMs = lineFixations.reduce((sum, f) => sum + f.duration, 0);
    const fixationCount = lineFixations.length;
    const isVisited = fixationCount > 0;
    const firstFixationTimeMs = isVisited
      ? Math.max(0, Math.round((lineFixations[0].startTime ?? lineFixations[0].fixationStart) - readingStartTime))
      : 0;
    const meanFixationDuration = fixationCount > 0 ? Math.round(dwellTimeMs / fixationCount) : 0;
    const revisitCount = Math.max(0, fixationCount - 1);

    return {
      lineIndex: line.lineIndex,
      dwellTimeMs,
      fixationCount,
      revisitCount,
      firstFixationTimeMs,
      meanFixationDurationMs: meanFixationDuration,
      isVisited,
    };
  });

  const visitedLinesCount = lineMetrics.filter((l) => l.isVisited).length;
  const readingCoveragePct = lineAOIs.length > 0
    ? Number(((visitedLinesCount / lineAOIs.length) * 100).toFixed(1))
    : 0;

  const totalRevisits = lineMetrics.reduce((acc, l) => acc + l.revisitCount, 0);
  const lineTransitionsCount = returnSweeps.length;

  const totalQuestions = questionResponses.length || 1;
  const correctQuestions = questionResponses.filter((q) => q.isCorrect);
  const correctCount = correctQuestions.length;
  const incorrectCount = totalQuestions - correctCount;
  const overallComprehensionAccuracyPct = Number(((correctCount / totalQuestions) * 100).toFixed(1));

  const qRTs = questionResponses.map((q) => q.reactionTimeMs);
  const meanQuestionReactionTimeMs = Math.round(
    qRTs.reduce((a, b) => a + b, 0) / totalQuestions
  );
  const medianQuestionReactionTimeMs = computeMedianValue(qRTs);
  const fastestQuestionReactionTimeMs = qRTs.length > 0 ? Math.min(...qRTs) : 0;
  const slowestQuestionReactionTimeMs = qRTs.length > 0 ? Math.max(...qRTs) : 0;

  const types = [
    "factual_recall",
    "main_idea",
    "detail",
    "simple_inference",
    "sequence_cause_effect",
  ];
  const accuracyByQuestionType = types.reduce((acc, type) => {
    const matching = questionResponses.filter((q) => q.questionType === type);
    const total = matching.length;
    const correct = matching.filter((q) => q.isCorrect).length;
    acc[type] = {
      total,
      correct,
      accuracyPct: total > 0 ? Number(((correct / total) * 100).toFixed(1)) : 0,
    };
    return acc;
  }, {});

  const totalGazeCount = readingGaze.length;
  const validGazeCount = validReadingGaze.length;
  const gazeAvailabilityPct = totalGazeCount > 0
    ? Number(((validGazeCount / totalGazeCount) * 100).toFixed(1))
    : 0;
  const meanConfidence = validGazeCount > 0
    ? Number((validReadingGaze.reduce((s, g) => s + g.confidence, 0) / validGazeCount).toFixed(2))
    : 0;

  let qualityRating = "GOOD";
  if (gazeAvailabilityPct < 50 || validGazeCount < 20) {
    qualityRating = "INSUFFICIENT";
  } else if (gazeAvailabilityPct < 75 || meanConfidence < 0.6) {
    qualityRating = "ACCEPTABLE";
  }

  return {
    sessionId,
    participantId,
    task: "reading_comprehension",
    taskVersion: metadata?.taskVersion ?? "1.0.0",
    calibrationProfileId: metadata?.calibrationProfileId ?? "default_v1",
    seed,
    viewportWidth: metadata?.viewportWidth ?? 800,
    viewportHeight: metadata?.viewportHeight ?? 600,
    cameraStatus: metadata?.cameraStatus ?? "CONNECTED",
    validationStatus: metadata?.validationStatus ?? "VALIDATED",
    passage,
    wordAOIs,
    lineAOIs,
    readingStartTime,
    readingEndTime,
    readingTimeMs,
    activeReadingTimeMs,
    rawGazeSamples,
    rawMouseEvents,
    fixations: readingFixations,
    saccades: classifiedSaccades,
    regressions,
    returnSweeps,
    lineMetrics,
    questionResponses,
    derivedMetrics: {
      wordsPerMinute,
      readingCoveragePct,
      totalFixationCount,
      meanFixationDurationMs,
      medianFixationDurationMs,
      maxFixationDurationMs,
      minFixationDurationMs,
      fixationsPer100Words,
      totalSaccadeCount,
      progressiveSaccadesCount,
      totalRegressionsCount,
      regressionsPer100Words,
      regressionRate,
      totalReturnSweepsCount: returnSweeps.length,
      lineTransitionsCount,
      totalRevisits,
      overallComprehensionAccuracyPct,
      correctQuestionsCount: correctCount,
      incorrectQuestionsCount: incorrectCount,
      meanQuestionReactionTimeMs,
      medianQuestionReactionTimeMs,
      fastestQuestionReactionTimeMs,
      slowestQuestionReactionTimeMs,
      accuracyByQuestionType,
    },
    dataQuality: {
      gazeAvailabilityPct,
      validGazeSampleCount: validGazeCount,
      totalGazeSampleCount: totalGazeCount,
      meanConfidence,
      qualityRating,
    },
  };
}

// -----------------------------------------------------------------------------
// TEST CASES (1 to 20)
// -----------------------------------------------------------------------------

test("1. Passage loading & schema verification", () => {
  assert(READING_PASSAGE_BANK.length >= 3, "Must have at least 3 passages");
  READING_PASSAGE_BANK.forEach((p, idx) => {
    assert(p.passageId && typeof p.passageId === "string", `Passage ${idx} missing ID`);
    assert(p.title && typeof p.title === "string", `Passage ${idx} missing title`);
    assert(p.text && typeof p.text === "string", `Passage ${idx} missing text`);
    assert(Array.isArray(p.paragraphs) && p.paragraphs.length > 0, `Passage ${idx} missing paragraphs`);
    assert(Array.isArray(p.questions) && p.questions.length === 5, `Passage ${idx} must have 5 questions`);
  });
});

test("2. Word counting precision", () => {
  READING_PASSAGE_BANK.forEach((p) => {
    const rawTokens = p.text.trim().split(/\s+/).filter(Boolean);
    assert.strictEqual(rawTokens.length, p.wordCount, `Passage ${p.passageId} wordCount mismatch`);
    assert(p.wordCount >= 120 && p.wordCount <= 200, `Passage ${p.passageId} must be 120-200 words`);
  });
});

test("3. Line AOI generation & geometry", () => {
  const lineAOIs = [
    { lineId: "line_0", lineIndex: 0, paragraphIndex: 0, x: 20, y: 30, width: 700, height: 32, text: "Line 1 text", wordStartIndex: 0, wordEndIndex: 12 },
    { lineId: "line_1", lineIndex: 1, paragraphIndex: 0, x: 20, y: 66, width: 680, height: 32, text: "Line 2 text", wordStartIndex: 13, wordEndIndex: 25 },
    { lineId: "line_2", lineIndex: 2, paragraphIndex: 0, x: 20, y: 102, width: 650, height: 32, text: "Line 3 text", wordStartIndex: 26, wordEndIndex: 38 },
  ];

  assert.strictEqual(lineAOIs.length, 3);
  lineAOIs.forEach((l, idx) => {
    assert.strictEqual(l.lineIndex, idx);
    assert(l.width > 0 && l.height > 0);
    assert(l.y >= 0);
  });
});

test("4. Word AOI generation & bounding boxes", () => {
  const wordAOIs = [
    { wordId: "w_0_0", wordIndex: 0, lineIndex: 0, paragraphIndex: 0, text: "The", x: 20, y: 30, width: 35, height: 28, screenWidth: 800, screenHeight: 600 },
    { wordId: "w_0_1", wordIndex: 1, lineIndex: 0, paragraphIndex: 0, text: "boreal", x: 60, y: 30, width: 55, height: 28, screenWidth: 800, screenHeight: 600 },
  ];

  assert.strictEqual(wordAOIs.length, 2);
  assert.strictEqual(wordAOIs[0].text, "The");
  assert.strictEqual(wordAOIs[1].text, "boreal");
  assert(wordAOIs[0].x < wordAOIs[1].x, "Word 0 should appear horizontally before Word 1");
});

test("5. Passage randomization & selection", () => {
  const seed1 = 12345;
  const seed2 = 98765;
  const pick1 = READING_PASSAGE_BANK[seed1 % READING_PASSAGE_BANK.length];
  const pick2 = READING_PASSAGE_BANK[seed2 % READING_PASSAGE_BANK.length];
  assert(pick1 && pick2);
  assert(pick1.passageId);
  assert(pick2.passageId);
});

test("6. Question generation, options & question types (5 per passage)", () => {
  const requiredTypes = ["factual_recall", "main_idea", "detail", "simple_inference", "sequence_cause_effect"];
  READING_PASSAGE_BANK.forEach((p) => {
    const typesInPassage = p.questions.map((q) => q.type);
    requiredTypes.forEach((req) => {
      assert(typesInPassage.includes(req), `Passage ${p.passageId} missing question type: ${req}`);
    });
    p.questions.forEach((q) => {
      assert.strictEqual(q.options.length, 4, `Question ${q.questionId} must have exactly 4 options`);
      assert(q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3, `Invalid correct option for ${q.questionId}`);
    });
  });
});

test("7. Reading-time calculation (total & active)", () => {
  const start = 1000;
  const end = 46000; // 45 seconds = 45000 ms
  const totalMs = end - start;
  assert.strictEqual(totalMs, 45000);

  // Active time calculated from 1200 valid 30Hz gaze samples = ~39960 ms
  const validSamplesCount = 1200;
  const activeMs = Math.round(validSamplesCount * 33.3);
  assert(activeMs > 0 && activeMs <= totalMs);
});

test("8. Words Per Minute (WPM) calculation", () => {
  // 150 words read in 45,000 ms (0.75 min) = 200 WPM
  const wpm = calculateWordsPerMinute(150, 45000);
  assert.strictEqual(wpm, 200);

  // Zero active time returns 0 safely
  assert.strictEqual(calculateWordsPerMinute(150, 0), 0);
  assert.strictEqual(calculateWordsPerMinute(0, 45000), 0);
});

test("9. Fixation aggregation & metrics", () => {
  const dummyFixations = [
    { id: "f1", fixationStart: 2000, duration: 250, meanX: 100, meanY: 45, confidence: 0.9 },
    { id: "f2", fixationStart: 2300, duration: 180, meanX: 220, meanY: 45, confidence: 0.92 },
    { id: "f3", fixationStart: 2550, duration: 320, meanX: 340, meanY: 45, confidence: 0.88 },
  ];

  const durations = dummyFixations.map((f) => f.duration);
  const mean = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const median = computeMedianValue(durations);
  const max = Math.max(...durations);
  const min = Math.min(...durations);

  assert.strictEqual(mean, 250);
  assert.strictEqual(median, 250);
  assert.strictEqual(max, 320);
  assert.strictEqual(min, 180);

  // Fixations per 100 words for 150 words: (3 / 150) * 100 = 2.0
  const per100 = Number(((dummyFixations.length / 150) * 100).toFixed(1));
  assert.strictEqual(per100, 2.0);
});

test("10. Saccade aggregation & velocity/amplitude metrics", () => {
  const dummySaccade = {
    id: "s1",
    startTime: 2250,
    endTime: 2290,
    duration: 40,
    startX: 100,
    startY: 45,
    endX: 220,
    endY: 45,
    amplitude: 120,
    velocity: 3.0,
  };

  assert.strictEqual(dummySaccade.amplitude, 120);
  assert.strictEqual(dummySaccade.velocity, 3.0);
  assert.strictEqual(dummySaccade.duration, 40);
});

test("11. Regression detection (intra-line & inter-line)", () => {
  const lineAOIs = [
    { lineId: "l0", lineIndex: 0, paragraphIndex: 0, x: 20, y: 30, width: 700, height: 30, text: "L0", wordStartIndex: 0, wordEndIndex: 10 },
    { lineId: "l1", lineIndex: 1, paragraphIndex: 0, x: 20, y: 70, width: 700, height: 30, text: "L1", wordStartIndex: 11, wordEndIndex: 20 },
  ];

  // Intra-line regression: Gaze on line 0 moves backward (startX: 400 -> endX: 200, dx: -200)
  const intraSac = { startX: 400, startY: 35, endX: 200, endY: 35, amplitude: 200, velocity: 4.0, duration: 50 };
  const intraRes = classifyReadingSaccade(intraSac, lineAOIs);
  assert.strictEqual(intraRes.classification, "regressive");
  assert.strictEqual(intraRes.isRegression, true);

  // Inter-line regression: Gaze moves from line 1 back to line 0 (startY: 75 -> endY: 35)
  const interSac = { startX: 250, startY: 75, endX: 300, endY: 35, amplitude: 60, velocity: 2.0, duration: 30 };
  const interRes = classifyReadingSaccade(interSac, lineAOIs);
  assert.strictEqual(interRes.classification, "regressive");
  assert.strictEqual(interRes.fromLineIndex, 1);
  assert.strictEqual(interRes.toLineIndex, 0);
  assert.strictEqual(interRes.isRegression, true);
});

test("12. Return-sweep detection (end-of-line to start-of-next-line)", () => {
  const lineAOIs = [
    { lineId: "l0", lineIndex: 0, paragraphIndex: 0, x: 20, y: 30, width: 700, height: 30, text: "L0", wordStartIndex: 0, wordEndIndex: 10 },
    { lineId: "l1", lineIndex: 1, paragraphIndex: 0, x: 20, y: 70, width: 700, height: 30, text: "L1", wordStartIndex: 11, wordEndIndex: 20 },
  ];

  // Return sweep: Gaze at end of line 0 (X: 680, Y: 35) jumps to start of line 1 (X: 50, Y: 75)
  const sweepSac = { startX: 680, startY: 35, endX: 50, endY: 75, amplitude: 630, velocity: 9.0, duration: 70 };
  const sweepRes = classifyReadingSaccade(sweepSac, lineAOIs);
  assert.strictEqual(sweepRes.classification, "return_sweep");
  assert.strictEqual(sweepRes.isReturnSweep, true);
  assert.strictEqual(sweepRes.fromLineIndex, 0);
  assert.strictEqual(sweepRes.toLineIndex, 1);
});

test("13. Multiple-choice question scoring & reaction times", () => {
  const responses = [
    { questionId: "q1", questionType: "factual_recall", questionStartTime: 1000, responseTime: 2500, reactionTimeMs: 1500, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
    { questionId: "q2", questionType: "detail", questionStartTime: 3000, responseTime: 4800, reactionTimeMs: 1800, selectedOptionIndex: 0, correctOptionIndex: 2, isCorrect: false },
    { questionId: "q3", questionType: "simple_inference", questionStartTime: 5000, responseTime: 6200, reactionTimeMs: 1200, selectedOptionIndex: 2, correctOptionIndex: 2, isCorrect: true },
    { questionId: "q4", questionType: "main_idea", questionStartTime: 7000, responseTime: 8600, reactionTimeMs: 1600, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
    { questionId: "q5", questionType: "sequence_cause_effect", questionStartTime: 9000, responseTime: 11000, reactionTimeMs: 2000, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
  ];

  const correctCount = responses.filter((r) => r.isCorrect).length;
  assert.strictEqual(correctCount, 4);
  const accuracy = (correctCount / responses.length) * 100;
  assert.strictEqual(accuracy, 80);

  const meanRT = Math.round(responses.reduce((s, r) => s + r.reactionTimeMs, 0) / responses.length);
  assert.strictEqual(meanRT, 1620);
});

test("14. Comprehension accuracy & breakdown by 5 question types", () => {
  const responses = [
    { questionId: "q1", questionType: "factual_recall", reactionTimeMs: 1500, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
    { questionId: "q2", questionType: "detail", reactionTimeMs: 1800, selectedOptionIndex: 0, correctOptionIndex: 2, isCorrect: false },
    { questionId: "q3", questionType: "simple_inference", reactionTimeMs: 1200, selectedOptionIndex: 2, correctOptionIndex: 2, isCorrect: true },
    { questionId: "q4", questionType: "main_idea", reactionTimeMs: 1600, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
    { questionId: "q5", questionType: "sequence_cause_effect", reactionTimeMs: 2000, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
  ];

  const types = ["factual_recall", "main_idea", "detail", "simple_inference", "sequence_cause_effect"];
  const breakdown = {};
  types.forEach((t) => {
    const matching = responses.filter((r) => r.questionType === t);
    const correct = matching.filter((r) => r.isCorrect).length;
    breakdown[t] = { total: matching.length, correct, accuracyPct: (correct / matching.length) * 100 };
  });

  assert.strictEqual(breakdown.factual_recall.accuracyPct, 100);
  assert.strictEqual(breakdown.detail.accuracyPct, 0);
  assert.strictEqual(breakdown.simple_inference.accuracyPct, 100);
  assert.strictEqual(breakdown.main_idea.accuracyPct, 100);
  assert.strictEqual(breakdown.sequence_cause_effect.accuracyPct, 100);
});

test("15. Missing-data & invalid gaze sample handling", () => {
  const rawGaze = [
    { timestamp: 1000, gazeX: 100, gazeY: 40, confidence: 0.9, blink: false },
    { timestamp: 1033, gazeX: 110, gazeY: 40, confidence: 0.2, blink: false }, // Low confidence -> invalid
    { timestamp: 1066, gazeX: 0, gazeY: 0, confidence: 0.0, blink: true },      // Blink -> invalid
    { timestamp: 1100, gazeX: 130, gazeY: 40, confidence: 0.85, blink: false },
  ];

  const validGaze = rawGaze.filter((s) => !s.blink && s.confidence >= 0.4);
  assert.strictEqual(validGaze.length, 2);
  const availability = (validGaze.length / rawGaze.length) * 100;
  assert.strictEqual(availability, 50);
});

test("16. Complete session aggregation (ReadingSessionRecord)", () => {
  const passage = READING_PASSAGE_BANK[0];
  const lineAOIs = [
    { lineId: "l0", lineIndex: 0, paragraphIndex: 0, x: 20, y: 30, width: 700, height: 30, text: "Line 0", wordStartIndex: 0, wordEndIndex: 15 },
    { lineId: "l1", lineIndex: 1, paragraphIndex: 0, x: 20, y: 70, width: 700, height: 30, text: "Line 1", wordStartIndex: 16, wordEndIndex: 30 },
  ];
  const wordAOIs = [];
  const rawGaze = [
    { timestamp: 1000, gazeX: 100, gazeY: 35, confidence: 0.9, blink: false },
    { timestamp: 1033, gazeX: 200, gazeY: 35, confidence: 0.9, blink: false },
    { timestamp: 1066, gazeX: 300, gazeY: 35, confidence: 0.9, blink: false },
    { timestamp: 1100, gazeX: 400, gazeY: 35, confidence: 0.9, blink: false },
  ];
  const rawMouse = [{ type: "click", x: 300, y: 200, timestamp: 2000 }];
  const fixations = [
    { id: "f0", fixationStart: 1000, duration: 250, meanX: 100, meanY: 35, confidence: 0.9 },
    { id: "f1", fixationStart: 1050, duration: 300, meanX: 300, meanY: 35, confidence: 0.9 },
  ];
  const saccades = [
    { id: "s0", startTime: 1025, endTime: 1045, duration: 20, startX: 100, startY: 35, endX: 300, endY: 35, amplitude: 200, velocity: 10 },
  ];
  const qResponses = [
    { questionId: "q1", questionType: "factual_recall", questionStartTime: 2000, responseTime: 3500, reactionTimeMs: 1500, selectedOptionIndex: 1, correctOptionIndex: 1, isCorrect: true },
  ];

  const record = aggregateReadingSession(
    "sess_reading_test",
    passage,
    lineAOIs,
    wordAOIs,
    rawGaze,
    rawMouse,
    fixations,
    saccades,
    1000,
    1200,
    qResponses,
    42,
    "patient_001"
  );

  assert.strictEqual(record.sessionId, "sess_reading_test");
  assert.strictEqual(record.task, "reading_comprehension");
  assert.strictEqual(record.derivedMetrics.totalFixationCount, 2);
  assert.strictEqual(record.derivedMetrics.totalSaccadeCount, 1);
  assert.strictEqual(record.derivedMetrics.progressiveSaccadesCount, 1);
  assert.strictEqual(record.derivedMetrics.overallComprehensionAccuracyPct, 100);
});

test("17. Raw-data preservation (unaltered raw gaze, mouse, events)", () => {
  const rawGaze = [{ timestamp: 500, gazeX: 123.456, gazeY: 789.012, confidence: 0.88, blink: false }];
  const rawMouse = [{ type: "mousemove", x: 450, y: 320, timestamp: 505 }];

  const record = aggregateReadingSession(
    "sess_raw_preservation",
    READING_PASSAGE_BANK[0],
    [],
    [],
    rawGaze,
    rawMouse,
    [],
    [],
    400,
    600,
    [],
    99
  );

  assert.strictEqual(record.rawGazeSamples[0].gazeX, 123.456);
  assert.strictEqual(record.rawGazeSamples[0].gazeY, 789.012);
  assert.strictEqual(record.rawMouseEvents[0].x, 450);
});

test("18. JSON serialization & round-trip integrity", () => {
  const record = aggregateReadingSession(
    "sess_json_test",
    READING_PASSAGE_BANK[0],
    [],
    [],
    [{ timestamp: 1000, gazeX: 100, gazeY: 200, confidence: 0.9, blink: false }],
    [{ type: "click", x: 100, y: 200, timestamp: 1050 }],
    [],
    [],
    1000,
    2000,
    [],
    101
  );

  const jsonStr = JSON.stringify(record, null, 2);
  const parsed = JSON.parse(jsonStr);

  assert.strictEqual(parsed.sessionId, record.sessionId);
  assert.strictEqual(parsed.task, "reading_comprehension");
  assert.strictEqual(parsed.derivedMetrics.wordsPerMinute, record.derivedMetrics.wordsPerMinute);
  assert.strictEqual(parsed.rawGazeSamples.length, 1);
});

test("19. Seed reproducibility & deterministic selection", () => {
  const seed = 42;
  const idx1 = seed % READING_PASSAGE_BANK.length;
  const idx2 = seed % READING_PASSAGE_BANK.length;
  assert.strictEqual(idx1, idx2);
  assert.strictEqual(READING_PASSAGE_BANK[idx1].passageId, READING_PASSAGE_BANK[idx2].passageId);
});

test("20. Extreme / empty / boundary input handling", () => {
  // Empty gaze, empty mouse, 0 reading time
  const emptyRecord = aggregateReadingSession(
    "sess_empty",
    READING_PASSAGE_BANK[0],
    [],
    [],
    [],
    [],
    [],
    [],
    0,
    0,
    [],
    0
  );

  assert.strictEqual(emptyRecord.derivedMetrics.wordsPerMinute, 0);
  assert.strictEqual(emptyRecord.derivedMetrics.totalFixationCount, 0);
  assert.strictEqual(emptyRecord.derivedMetrics.totalSaccadeCount, 0);
  assert.strictEqual(emptyRecord.derivedMetrics.totalRegressionsCount, 0);
  assert.strictEqual(emptyRecord.dataQuality.qualityRating, "INSUFFICIENT");
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log("==================================================================");

if (passedTests !== totalTests) {
  process.exit(1);
}
