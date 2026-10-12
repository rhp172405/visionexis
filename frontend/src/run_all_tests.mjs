import { spawnSync } from "child_process";

const testFiles = [
  "src/test_calibration.mjs",
  "src/test_accuracy_validation.mjs",
  "src/test_visual_search.mjs",
  "src/test_phase5_validation.mjs",
  "src/test_memory_recognition.mjs",
  "src/test_reading_comprehension.mjs",
  "src/test_system_integration.mjs",
  "src/test_statistics.mjs",
  "src/test_dataset_manager.mjs",
  "src/test_research_analysis.mjs",
  "src/test_report_generation.mjs",
  "src/test_pilot_study.mjs",
  "src/test_phase11_statistical_validation.mjs",
  "src/test_phase12_cohort_validation.mjs",
  "src/test_task_coordinate_alignment.mjs",
  "src/test_assessment_workflow.mjs",
  "src/test_mbt_integrated_analysis.mjs",
  "src/test_full_integrated_e2e.mjs",
  "src/test_operator_access_and_remediation.mjs",
];

let suitesPassed = 0;
let suitesFailed = 0;

console.log("==================================================");
console.log("VISIONEXIS AUTOMATED TEST SUITE RUNNER (ALL PHASES)");
console.log("==================================================\n");

for (const file of testFiles) {
  const result = spawnSync("node", [file], { encoding: "utf8" });
  if (result.status === 0) {
    suitesPassed++;
    console.log(`[PASS] ${file}`);
    const lines = (result.stdout || "").trim().split("\n");
    const summaryLine = lines.find((l) => l.includes("PASSED") || l.includes("tests passed") || l.includes("Summary:"));
    if (summaryLine) {
      console.log(`       ${summaryLine.trim()}`);
    }
  } else {
    suitesFailed++;
    console.log(`[FAIL] ${file}`);
    console.error(result.stderr || result.stdout);
  }
}

console.log("\n==================================================");
console.log(`TOTAL SUITES PASSED: ${suitesPassed} / ${testFiles.length}`);
console.log(`TOTAL SUITES FAILED: ${suitesFailed}`);
console.log("==================================================");

if (suitesFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
