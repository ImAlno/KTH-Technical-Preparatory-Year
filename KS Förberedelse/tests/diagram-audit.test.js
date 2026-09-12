const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const { runAudit, launchChrome, regressionsPass } = require("./diagram-audit-browser.js");

test("standalone regression status requires every nested check to pass", () => {
  assert.equal(regressionsPass({ positive: { transform: "pass" }, negative: { marker: "pass" } }), true);
  assert.equal(regressionsPass({ positive: { transform: "pass" }, negative: { marker: "fail" } }), false);
});

test("a Chrome startup timeout kills the child and removes its isolated profile", async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ks-diagram-startup-test-"));
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = function () { this.killed = true; return true; };
  try {
    await assert.rejects(launchChrome({
      binaryPath: process.execPath,
      temporaryRoot,
      startupTimeoutMs: 5,
      spawnImpl() { return child; }
    }), /did not publish a debugging endpoint/u);
    assert.equal(child.killed, true);
    assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("audits every prompt in four modes and every solution figure in three screen modes", { timeout: 180_000 }, async () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ks-diagram-audit-"));
  try {
    const audit = await runAudit({ outputDirectory, screenshots: false, pdfs: false });
    const modes = ["desktop", "tablet", "mobile", "print"];

    assert.equal(audit.records.filter((item) => item.purpose === "prompt").length, 150 * modes.length);
    assert.equal(audit.records.filter((item) => item.purpose === "solution").length, 65 * 3);
    assert.equal(audit.records.length, 795);
    assert.equal(audit.records.filter((item) => item.failures.length).length, 0);
    assert.deepEqual(audit.viewportByMode, {
      desktop: [1440, 900], tablet: [768, 1024], mobile: [390, 844], print: [794, 1123]
    });
    assert.deepEqual(audit.sourceCounts, {
      mathPrompt: 25,
      physicsPrompt: 125,
      physicsSolution: 65,
      accessiblePairs: 215
    });
    assert.deepEqual(audit.regressions, {
      positive: { nestedTransform: "pass", cssWidth: "pass" },
      negative: {
        nestedOverlap: "pass",
        cssScaledFont: "pass",
        clipping: "pass",
        paintOverflow: "pass",
        extraRoot: "pass",
        transformedEllipse: "pass",
        transformedEllipsePaintOverflow: "pass",
        polygonContainment: "pass",
        opaqueBackgroundOwner: "pass",
        transformedPath: "pass",
        nestedMarker: "pass",
        spoofedOwner: "pass"
      }
    });
    assert.equal(audit.preflight.outcome, "pass");
    assert.deepEqual(audit.networkRequests, []);
    [
      "appCss", "subjectConfig", "units", "expressionParser", "grading", "storage", "timer", "examEngine",
      "diagramKit", "app", "mathSlot5", "physicsSlot1", "physicsSlot2", "physicsSlot3", "physicsSlot4",
      "physicsSlot5", "physicsQuestions", "auditPage", "auditRunner", "auditVerifier", "auditTest",
      "staticPagesTest", "diagramKitTest", "mathQuestionsTest", "physicsQuestionsTest"
    ].forEach((name) => assert.match(audit.sourceHashes[name] || "", /^[a-f0-9]{64}$/u, name));
  } finally {
    fs.rmSync(outputDirectory, { recursive: true });
  }
});
