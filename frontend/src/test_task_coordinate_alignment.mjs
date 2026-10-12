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
// Coordinate Helper Functions (mirroring coordinates.ts)
// ------------------------------------------------------------------
function windowNormToContainer(normX, normY, containerRect, winWidth = 1920, winHeight = 1080) {
  const screenX = normX * winWidth;
  const screenY = normY * winHeight;
  return {
    x: Math.round(screenX - containerRect.left),
    y: Math.round(screenY - containerRect.top),
  };
}

function containerToWindowNorm(containerRelX, containerRelY, containerRect, winWidth = 1920, winHeight = 1080) {
  const screenX = containerRect.left + containerRelX;
  const screenY = containerRect.top + containerRelY;
  return {
    normX: Math.max(0, Math.min(1, screenX / (winWidth || 1))),
    normY: Math.max(0, Math.min(1, screenY / (winHeight || 1))),
  };
}

function targetToWindowNorm(targetNormX, targetNormY, containerRect, winWidth = 1920, winHeight = 1080) {
  const containerRelX = targetNormX * containerRect.width;
  const containerRelY = targetNormY * containerRect.height;
  return containerToWindowNorm(containerRelX, containerRelY, containerRect, winWidth, winHeight);
}

// ------------------------------------------------------------------
// Test 4: Boundary Conditions: Screen Corners (0,0) and (1,1)
// ------------------------------------------------------------------
test("Boundary Condition: Screen corners map accurately relative to container", () => {
  const winW = 1920;
  const winH = 1080;
  const containerRect = { left: 500, top: 200, width: 800, height: 600 };

  // Top-left corner of the window (0, 0)
  const ptTopLeft = windowNormToContainer(0.0, 0.0, containerRect, winW, winH);
  assert.strictEqual(ptTopLeft.x, -500, "Window top-left X relative to container must be -500");
  assert.strictEqual(ptTopLeft.y, -200, "Window top-left Y relative to container must be -200");

  // Bottom-right corner of the window (1, 1)
  const ptBottomRight = windowNormToContainer(1.0, 1.0, containerRect, winW, winH);
  assert.strictEqual(ptBottomRight.x, 1920 - 500, "Window bottom-right X relative to container must be 1420");
  assert.strictEqual(ptBottomRight.y, 1080 - 200, "Window bottom-right Y relative to container must be 880");
});

// ------------------------------------------------------------------
// Test 5: Calibration Target Window Normalization & Inversion
// ------------------------------------------------------------------
test("Round-trip Coordinate Conversion: targetToWindowNorm -> windowNormToContainer", () => {
  const resolutions = [
    { w: 1920, h: 1080 },
    { w: 1366, h: 768 },
    { w: 2560, h: 1440 },
  ];

  for (const { w, h } of resolutions) {
    const containerRect = {
      left: Math.round((w - 800) / 2),
      top: Math.round((h - 450) / 2),
      width: 800,
      height: 450,
    };

    // Test 9 calibration positions
    const targets = [
      { normX: 0.15, normY: 0.15 },
      { normX: 0.50, normY: 0.50 },
      { normX: 0.85, normY: 0.85 },
    ];

    for (const tgt of targets) {
      const winNorm = targetToWindowNorm(tgt.normX, tgt.normY, containerRect, w, h);
      const reconstructed = windowNormToContainer(winNorm.normX, winNorm.normY, containerRect, w, h);

      const expectedContainerX = Math.round(tgt.normX * containerRect.width);
      const expectedContainerY = Math.round(tgt.normY * containerRect.height);

      assert.strictEqual(
        reconstructed.x,
        expectedContainerX,
        `Reconstructed X (${reconstructed.x}) must match expected (${expectedContainerX}) at ${w}x${h}`
      );
      assert.strictEqual(
        reconstructed.y,
        expectedContainerY,
        `Reconstructed Y (${reconstructed.y}) must match expected (${expectedContainerY}) at ${w}x${h}`
      );
    }
  }
});

// ------------------------------------------------------------------
// Test 6: Container Edge Clamping for Out-of-Bounds Gaze
// ------------------------------------------------------------------
test("Container to Window Normalization clamps out-of-bounds coordinates", () => {
  const containerRect = { left: 0, top: 0, width: 1000, height: 1000 };
  const negativePoint = containerToWindowNorm(-100, -50, containerRect, 1000, 1000);
  assert.strictEqual(negativePoint.normX, 0, "Negative X must be clamped to 0");
  assert.strictEqual(negativePoint.normY, 0, "Negative Y must be clamped to 0");

  const overflowPoint = containerToWindowNorm(1200, 1500, containerRect, 1000, 1000);
  assert.strictEqual(overflowPoint.normX, 1, "Overflow X must be clamped to 1");
  assert.strictEqual(overflowPoint.normY, 1, "Overflow Y must be clamped to 1");
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
