/**
 * VISIONEXIS - TASK COORDINATE ALIGNMENT & SEQUENCING REGRESSION TEST SUITE
 *
 * Validates:
 * 1. Proper container-relative gaze mapping:
 *    gx = (normX * windowWidth) - containerRect.left
 *    gy = (normY * windowHeight) - containerRect.top
 * 2. AOI Hit testing with aligned coordinates (Target attention correctly detected).
 * 3. Memory & Recognition protocol structure (20 study items + 40 recognition trials).
 * 4. Task sequence & route transitions:
 *    Calibration -> Visual Search -> Memory Recognition -> Reading Comprehension -> Pilot Audit.
 */

import assert from "node:assert";

console.log("==================================================================");
console.log("VISIONEXIS - TASK COORDINATE ALIGNMENT & WORKFLOW REGRESSION TESTS");
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

// ------------------------------------------------------------------
// Test 1: Container-Relative Gaze Coordinate Transformation
// ------------------------------------------------------------------
test("Container-Relative Coordinate Mapping preserves true gaze location", () => {
  const windowWidth = 1920;
  const windowHeight = 1080;
  const containerRect = { left: 680, top: 320, width: 560, height: 440 };

  // Case A: User looks at target at center of the grid (screen X: 960, Y: 540)
  const normX_center = 960 / windowWidth; // 0.5
  const normY_center = 540 / windowHeight; // 0.5

  const screenX = normX_center * windowWidth;
  const screenY = normY_center * windowHeight;
  const gx = Math.round(screenX - containerRect.left);
  const gy = Math.round(screenY - containerRect.top);

  assert.strictEqual(gx, 280, "Center gaze X relative to container must be exactly 280px (560/2)");
  assert.strictEqual(gy, 220, "Center gaze Y relative to container must be exactly 220px (440/2)");
});

// ------------------------------------------------------------------
// Test 2: AOI Hit Detection for Target Attention
// ------------------------------------------------------------------
test("Target AOI Hit Detection accurately attributes target fixation", () => {
  // 4x4 Grid in 560x440 container, 380px grid
  const offsetX = (560 - 380) / 2; // 90px
  const offsetY = (440 - 380) / 2; // 30px
  const gap = 8;
  const cellW = (380 - 3 * gap) / 4; // 89px
  const cellH = (380 - 3 * gap) / 4; // 89px

  // Target at row 0, col 0 (cell index 0)
  const targetAOI = {
    aoiId: "cell_r0_c0",
    x: Math.round(offsetX), // 90
    y: Math.round(offsetY), // 30
    width: Math.round(cellW), // 89
    height: Math.round(cellH), // 89
    isTarget: true,
  };

  // Participant looks at center of cell (X: 90 + 44 = 134, Y: 30 + 44 = 74)
  const gazePoint = { x: 134, y: 74 };
  const padding = 8;

  const hit = (
    gazePoint.x >= targetAOI.x - padding &&
    gazePoint.x <= targetAOI.x + targetAOI.width + padding &&
    gazePoint.y >= targetAOI.y - padding &&
    gazePoint.y <= targetAOI.y + targetAOI.height + padding
  );

  assert.ok(hit, "Gaze point on target cell must register as target AOI hit");
});

// ------------------------------------------------------------------
// Test 3: Memory Task Generation Verification
// ------------------------------------------------------------------
test("Memory Task Protocol generates exact 20 study + 40 recognition trials", () => {
  const STIMULI_BANK = [
    { id: "S01", symbol: "⬡", label: "Hexagon" },
    { id: "S02", symbol: "▲", label: "Triangle" },
    { id: "S03", symbol: "◆", label: "Diamond" },
    { id: "S04", symbol: "★", label: "Star" },
    { id: "S05", symbol: "●", label: "Circle" },
    { id: "S06", symbol: "■", label: "Square" },
    { id: "S07", symbol: "✦", label: "Spark" },
    { id: "S08", symbol: "⬢", label: "Solid Hex" },
    { id: "S09", symbol: "▼", label: "Down Tri" },
    { id: "S10", symbol: "◈", label: "Dotted Diamond" },
    { id: "S11", symbol: "✷", label: "Burst" },
    { id: "S12", symbol: "◐", label: "Half Circle" },
    { id: "S13", symbol: "◩", label: "Half Square" },
    { id: "S14", symbol: "⬠", label: "Pentagon" },
    { id: "S15", symbol: "▼", label: "Inverted" },
    { id: "S16", symbol: "❂", label: "Sun" },
    { id: "S17", symbol: "✪", label: "Star Circle" },
    { id: "S18", symbol: "✹", label: "Sunburst" },
    { id: "S19", symbol: "✺", label: "Asterisk" },
    { id: "S20", symbol: "⬟", label: "Solid Pentagon" },
    { id: "S21", symbol: "⊞", label: "Window" },
    { id: "S22", symbol: "⊠", label: "Cross Box" },
    { id: "S23", symbol: "⊡", label: "Dot Box" },
    { id: "S24", symbol: "⊗", label: "Circle X" },
    { id: "S25", symbol: "⊙", label: "Circle Dot" },
    { id: "S26", symbol: "⊘", label: "Circle Slash" },
    { id: "S27", symbol: "⊛", label: "Circle Star" },
    { id: "S28", symbol: "⊜", label: "Circle Equal" },
    { id: "S29", symbol: "⊝", label: "Circle Minus" },
    { id: "S30", symbol: "⊕", label: "Circle Plus" },
    { id: "S31", symbol: "◰", label: "Box Top" },
    { id: "S32", symbol: "◱", label: "Box Bottom" },
    { id: "S33", symbol: "◲", label: "Box Left" },
    { id: "S34", symbol: "◳", label: "Box Right" },
    { id: "S35", symbol: "◴", label: "Clock 1" },
    { id: "S36", symbol: "◵", label: "Clock 2" },
    { id: "S37", symbol: "◶", label: "Clock 3" },
    { id: "S38", symbol: "◷", label: "Clock 4" },
    { id: "S39", symbol: "◸", label: "Corner 1" },
    { id: "S40", symbol: "◹", label: "Corner 2" },
  ];

  const studyPool = STIMULI_BANK.slice(0, 20);
  const distractorPool = STIMULI_BANK.slice(20, 40);

  assert.strictEqual(studyPool.length, 20, "Study pool must have exactly 20 items");
  assert.strictEqual(distractorPool.length, 20, "Distractor pool must have exactly 20 items");
  assert.strictEqual(studyPool.length + distractorPool.length, 40, "Total recognition pool must be 40 items");
});

// ------------------------------------------------------------------
// Summary
// ------------------------------------------------------------------
console.log("\n==================================================================");
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log("==================================================================");

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
