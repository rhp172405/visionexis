/**
 * VISIONEXIS - PHASE 9: DESCRIPTIVE STATISTICS & METRICS TEST SUITE
 *
 * Validates:
 * 1. Mean, median, standard deviation calculation.
 * 2. Min, max, range calculations.
 * 3. 95% Confidence Interval computation.
 * 4. Cohen's d effect size between groups.
 * 5. Edge cases: empty arrays, single-element arrays, identical values.
 */

import assert from "node:assert";

console.log("==================================================================");
console.log("VISIONEXIS - PHASE 9: STATISTICS & DESCRIPTIVE TEST SUITE");
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

function calculateMean(values) {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Number((sum / values.length).toFixed(2));
}

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

function calculateStdDev(values) {
  if (values.length <= 1) return 0;
  const avg = calculateMean(values);
  const sumSq = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0);
  return Number(Math.sqrt(sumSq / (values.length - 1)).toFixed(2));
}

function calculateCI95(values) {
  if (values.length === 0) return { lower: 0, upper: 0, margin: 0 };
  const avg = calculateMean(values);
  const sd = calculateStdDev(values);
  const n = values.length;
  const critical = n < 30 ? 2.04 : 1.96;
  const margin = Number((critical * (sd / Math.sqrt(Math.max(1, n)))).toFixed(2));
  return {
    lower: Number((avg - margin).toFixed(2)),
    upper: Number((avg + margin).toFixed(2)),
    margin,
  };
}

function calculateCohensD(groupA, groupB) {
  if (groupA.length === 0 || groupB.length === 0) return 0;
  const meanA = calculateMean(groupA);
  const meanB = calculateMean(groupB);
  const sdA = calculateStdDev(groupA);
  const sdB = calculateStdDev(groupB);

  const pooledSD = Math.sqrt(
    ((groupA.length - 1) * Math.pow(sdA, 2) + (groupB.length - 1) * Math.pow(sdB, 2)) /
      Math.max(1, groupA.length + groupB.length - 2)
  );

  if (pooledSD === 0) return 0;
  return Number(((meanA - meanB) / pooledSD).toFixed(2));
}

test("1. Mean calculation for integer and float values", () => {
  assert.strictEqual(calculateMean([10, 20, 30, 40, 50]), 30);
  assert.strictEqual(calculateMean([1.5, 2.5, 3.5]), 2.5);
  assert.strictEqual(calculateMean([]), 0);
});

test("2. Median calculation for odd and even length samples", () => {
  assert.strictEqual(calculateMedian([5, 1, 9, 3, 7]), 5);
  assert.strictEqual(calculateMedian([10, 20, 30, 40]), 25);
  assert.strictEqual(calculateMedian([]), 0);
});

test("3. Sample Standard Deviation calculation", () => {
  const sample = [10, 12, 23, 23, 16, 23, 21, 16];
  const sd = calculateStdDev(sample);
  assert(sd > 4.5 && sd < 5.5, `Expected SD around 5.0, got ${sd}`);
  assert.strictEqual(calculateStdDev([5]), 0);
  assert.strictEqual(calculateStdDev([7, 7, 7, 7]), 0);
});

test("4. 95% Confidence Interval estimation", () => {
  const sample = [100, 105, 98, 102, 104, 99, 101, 103];
  const ci = calculateCI95(sample);
  assert(ci.lower < ci.upper);
  assert(ci.margin > 0);
  assert(ci.lower <= 101.5 && ci.upper >= 101.5);
});

test("5. Cohen's d effect size between study dwell groups", () => {
  const hitsDwell = [800, 850, 790, 820, 840, 810];
  const missDwell = [400, 420, 380, 410, 390, 430];
  const d = calculateCohensD(hitsDwell, missDwell);
  assert(d > 2.0, `Expected large effect size (d > 2.0), got ${d}`);
});

console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log("==================================================================");

if (passedTests !== totalTests) {
  process.exit(1);
}
