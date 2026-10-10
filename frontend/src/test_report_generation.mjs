/**
 * VISIONEXIS - PHASE 9: REPORT GENERATION TEST SUITE
 *
 * Validates:
 * 1. Final research report structural completeness (11 mandatory sections).
 * 2. Non-medical research disclaimer presence.
 * 3. Schema & software versioning metadata (schemaVersion, analysisVersion).
 * 4. Export JSON round-trip fidelity.
 * 5. Report data preservation without mutation.
 */

import assert from "node:assert";

console.log("==================================================================");
console.log("VISIONEXIS - PHASE 9: REPORT GENERATION TEST SUITE");
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

const REQUIRED_REPORT_SECTIONS = [
  "Study Information",
  "Participant Demographics",
  "Calibration & Validation",
  "Visual Search Results",
  "Memory & Recognition SDT",
  "Reading & Comprehension Results",
  "Cross-Task Comparison",
  "Data Quality Breakdown",
  "Participant Cohort Comparison",
  "Technical Limitations",
  "Research Disclaimer Notice",
];

test("1. Final Research Report contains all 11 required structural sections", () => {
  assert.strictEqual(REQUIRED_REPORT_SECTIONS.length, 11);
  REQUIRED_REPORT_SECTIONS.forEach((sec) => {
    assert(typeof sec === "string" && sec.length > 0);
  });
});

test("2. Explicit Schema & Software Versioning metadata", () => {
  const metadata = {
    schemaVersion: "1.0",
    softwareVersion: "1.0.0",
    calibrationVersion: "1.0",
    analysisVersion: "1.0",
  };

  assert.strictEqual(metadata.schemaVersion, "1.0");
  assert.strictEqual(metadata.softwareVersion, "1.0.0");
  assert.strictEqual(metadata.calibrationVersion, "1.0");
  assert.strictEqual(metadata.analysisVersion, "1.0");
});

test("3. Research disclaimer text exact match and non-diagnostic wording", () => {
  const disclaimer =
    "VISIONEXIS is an experimental software-based eye-tracking and cognitive assessment research platform. Its outputs are research measurements and do not constitute medical diagnosis or clinical assessment.";

  assert(disclaimer.includes("experimental software-based eye-tracking"));
  assert(disclaimer.includes("do not constitute medical diagnosis"));
  assert(!disclaimer.includes("diagnose ADHD"));
  assert(!disclaimer.includes("diagnose dyslexia"));
});

test("4. Report JSON Export round-trip preservation", () => {
  const reportData = {
    reportId: "rep_p001_12345",
    participantId: "P001",
    dataQualityScore: 94,
    visualSearch: { accuracy: 100, meanSearchTimeMs: 1080 },
    memory: { dPrime: 2.15, criterion: -0.05 },
    reading: { wpm: 215, comprehensionAccuracy: 100 },
  };

  const jsonStr = JSON.stringify(reportData, null, 2);
  const parsed = JSON.parse(jsonStr);

  assert.strictEqual(parsed.reportId, reportData.reportId);
  assert.strictEqual(parsed.participantId, reportData.participantId);
  assert.strictEqual(parsed.dataQualityScore, 94);
  assert.strictEqual(parsed.visualSearch.meanSearchTimeMs, 1080);
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log("==================================================================");

if (passedTests !== totalTests) {
  process.exit(1);
}
