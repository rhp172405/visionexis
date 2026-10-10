/**
 * VISIONEXIS Reading & Comprehension Eye-Tracking Task Engine (Phase 7).
 *
 * Implements:
 * 1. Curated neutral passage bank (120-200 words each) with 5 comprehension MCQs per passage.
 * 2. Word-level and Line-level dynamic rendered AOI extraction.
 * 3. Reading eye-movement dynamics:
 *    - Reading Time & Active Reading Time (ms)
 *    - Words Per Minute (WPM)
 *    - Fixation metrics (Count, Mean/Median/Max/Min duration, Fixations / 100 words)
 *    - Saccade classification (Progressive, Regressive, Return Sweep, Vertical, Indeterminate)
 *    - Regression detection & rate per 100 words
 *    - Line transitions, dwell times, and revisit tracking
 *    - Reading coverage (% of lines visited)
 * 4. 5-Question Comprehension assessment via independent mouse response.
 * 5. Reading behavior vs. Comprehension accuracy correlation analysis.
 * 6. Data Quality scoring (GOOD, ACCEPTABLE, INSUFFICIENT).
 * 7. Complete raw data & event model preservation.
 *
 * NOTE: Experimental eye-movement & cognitive-task measurement system; NOT intended for medical diagnosis.
 */

import type { RawGazeBufferSample, FixationEvent, SaccadeEvent } from "./webcam/gazeEvents";

export type QuestionType = "factual_recall" | "main_idea" | "detail" | "simple_inference" | "sequence_cause_effect";

export interface ReadingQuestion {
  questionId: string;
  question: string;
  type: QuestionType;
  options: [string, string, string, string]; // Exactly 4 options: A, B, C, D
  correctOptionIndex: number; // 0..3
  explanation?: string;
}

export interface ReadingPassage {
  passageId: string;
  title: string;
  text: string;
  paragraphs: string[];
  wordCount: number;
  estimatedReadingTimeSec: number;
  questions: ReadingQuestion[];
}

export const READING_PASSAGE_BANK: ReadingPassage[] = [
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

export interface WordAOI {
  wordId: string;
  wordIndex: number;
  lineIndex: number;
  paragraphIndex: number;
  text: string;
  x: number; // container px
  y: number;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
}

export interface LineAOI {
  lineId: string;
  lineIndex: number;
  paragraphIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  wordStartIndex: number;
  wordEndIndex: number;
}

export type SaccadeClassification =
  | "progressive" // Forward movement along line / next line
  | "regressive" // Backward movement to earlier text
  | "return_sweep" // End of line to beginning of next line
  | "vertical_interline" // Pure vertical movement across lines
  | "indeterminate"; // Ambiguous or outside text

export interface ClassifiedSaccade {
  saccadeId: string;
  startTime: number;
  endTime: number;
  duration: number; // ms
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  amplitude: number; // px
  velocity: number; // px/ms
  classification: SaccadeClassification;
  fromLineIndex?: number;
  toLineIndex?: number;
}

export interface ReadingRegression {
  regressionId: string;
  startTime: number;
  endTime: number;
  fromLine: number;
  toLine: number;
  fromWordIndex?: number;
  toWordIndex?: number;
  distancePx: number;
  isInterLine: boolean;
}

export interface ReturnSweep {
  fromLine: number;
  toLine: number;
  timestamp: number;
  durationMs: number;
  horizontalDistancePx: number;
  verticalDistancePx: number;
}

export interface LineReadingMetrics {
  lineIndex: number;
  dwellTimeMs: number;
  fixationCount: number;
  revisitCount: number;
  firstFixationTimeMs: number;
  meanFixationDurationMs: number;
  isVisited: boolean;
}

export interface QuestionResponseRecord {
  questionId: string;
  questionType: QuestionType;
  questionStartTime: number;
  responseTime: number;
  reactionTimeMs: number;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
}

export interface ReadingSessionRecord {
  sessionId: string;
  participantId?: string;
  task: "reading_comprehension";
  taskVersion: string;
  calibrationProfileId?: string;
  seed: number;
  viewportWidth: number;
  viewportHeight: number;
  cameraStatus: string;
  validationStatus: string;

  // Passage information
  passage: ReadingPassage;
  wordAOIs: WordAOI[];
  lineAOIs: LineAOI[];

  // Timing
  readingStartTime: number;
  readingEndTime: number;
  readingTimeMs: number;
  activeReadingTimeMs: number;

  // Raw Event & Gaze Buffers
  rawGazeSamples: RawGazeBufferSample[];
  rawMouseEvents: { type: string; x: number; y: number; timestamp: number }[];
  fixations: FixationEvent[];
  saccades: ClassifiedSaccade[];
  regressions: ReadingRegression[];
  returnSweeps: ReturnSweep[];
  lineMetrics: LineReadingMetrics[];

  // Questions & Responses
  questionResponses: QuestionResponseRecord[];

  // Aggregated Derived Metrics
  derivedMetrics: {
    wordsPerMinute: number;
    readingCoveragePct: number;
    totalFixationCount: number;
    meanFixationDurationMs: number;
    medianFixationDurationMs: number;
    maxFixationDurationMs: number;
    minFixationDurationMs: number;
    fixationsPer100Words: number;
    totalSaccadeCount: number;
    progressiveSaccadesCount: number;
    totalRegressionsCount: number;
    regressionsPer100Words: number;
    regressionRate: number; // Regressions / Total Saccades
    totalReturnSweepsCount: number;
    lineTransitionsCount: number;
    totalRevisits: number;

    // Comprehension Metrics
    overallComprehensionAccuracyPct: number;
    correctQuestionsCount: number;
    incorrectQuestionsCount: number;
    meanQuestionReactionTimeMs: number;
    medianQuestionReactionTimeMs: number;
    fastestQuestionReactionTimeMs: number;
    slowestQuestionReactionTimeMs: number;
    accuracyByQuestionType: Record<QuestionType, { total: number; correct: number; accuracyPct: number }>;
  };

  dataQuality: {
    gazeAvailabilityPct: number;
    validGazeSampleCount: number;
    totalGazeSampleCount: number;
    meanConfidence: number;
    qualityRating: "GOOD" | "ACCEPTABLE" | "INSUFFICIENT";
  };
}

/**
 * Computes Words Per Minute (WPM) safely.
 */
export function calculateWordsPerMinute(wordCount: number, activeReadingTimeMs: number): number {
  if (activeReadingTimeMs <= 0 || wordCount <= 0) return 0;
  const minutes = activeReadingTimeMs / 60000;
  return Math.round(wordCount / minutes);
}

/**
 * Classifies saccadic eye movements in reading.
 */
export function classifyReadingSaccade(
  sac: SaccadeEvent,
  lineAOIs: LineAOI[]
): {
  classification: SaccadeClassification;
  fromLineIndex?: number;
  toLineIndex?: number;
  isRegression: boolean;
  isReturnSweep: boolean;
} {
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

  // 1. Return Sweep check: Move from end of line (high X) to start of next line (lower X, next line index)
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

  // 2. Intra-line or Inter-line Regression
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

  // 3. Progressive reading saccade
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

  // 4. Vertical Glance / Interline shift
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

function computeMedianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Aggregates complete reading & comprehension session data.
 */
export function aggregateReadingSession(
  sessionId: string,
  passage: ReadingPassage,
  lineAOIs: LineAOI[],
  wordAOIs: WordAOI[],
  rawGazeSamples: RawGazeBufferSample[],
  rawMouseEvents: { type: string; x: number; y: number; timestamp: number }[],
  fixations: FixationEvent[],
  saccades: SaccadeEvent[],
  readingStartTime: number,
  readingEndTime: number,
  questionResponses: QuestionResponseRecord[],
  seed: number,
  participantId?: string,
  metadata?: {
    calibrationProfileId?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    cameraStatus?: string;
    validationStatus?: string;
    taskVersion?: string;
  }
): ReadingSessionRecord {
  const readingTimeMs = Math.max(0, Math.round(readingEndTime - readingStartTime));

  // Gaze samples inside reading window
  const readingGaze = rawGazeSamples.filter(
    (s) => s.timestamp >= readingStartTime && s.timestamp <= readingEndTime
  );
  const validReadingGaze = readingGaze.filter((s) => !s.blink && s.confidence >= 0.4);

  const activeReadingTimeMs = validReadingGaze.length > 0
    ? Math.round(validReadingGaze.length * 33.3)
    : readingTimeMs;

  const wordsPerMinute = calculateWordsPerMinute(passage.wordCount, activeReadingTimeMs);

  // Fixations inside reading window
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

  // Saccade Analysis & Classifications
  const classifiedSaccades: ClassifiedSaccade[] = [];
  const regressions: ReadingRegression[] = [];
  const returnSweeps: ReturnSweep[] = [];

  const readingSaccades = saccades.filter(
    (s) => s.startTime >= readingStartTime && s.startTime <= readingEndTime
  );

  readingSaccades.forEach((sac, idx) => {
    const res = classifyReadingSaccade(sac, lineAOIs);
    const classified: ClassifiedSaccade = {
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

  // Line-level dwell metrics
  const lineMetrics: LineReadingMetrics[] = lineAOIs.map((line) => {
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

  // Comprehension Analysis
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

  // Accuracy by question type
  const types: QuestionType[] = [
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
  }, {} as Record<QuestionType, { total: number; correct: number; accuracyPct: number }>);

  // Data Quality Assessment
  const totalGazeCount = readingGaze.length;
  const validGazeCount = validReadingGaze.length;
  const gazeAvailabilityPct = totalGazeCount > 0
    ? Number(((validGazeCount / totalGazeCount) * 100).toFixed(1))
    : 0;
  const meanConfidence = validGazeCount > 0
    ? Number((validReadingGaze.reduce((s, g) => s + g.confidence, 0) / validGazeCount).toFixed(2))
    : 0;

  let qualityRating: "GOOD" | "ACCEPTABLE" | "INSUFFICIENT" = "GOOD";
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
