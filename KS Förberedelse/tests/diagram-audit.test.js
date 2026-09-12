const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runAudit } = require("./diagram-audit-browser.js");

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
    assert.equal(audit.regressions.nestedTransform, "pass");
    assert.equal(audit.regressions.cssWidth, "pass");
    assert.equal(audit.preflight.outcome, "pass");
    assert.deepEqual(audit.networkRequests, []);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true });
  }
});
