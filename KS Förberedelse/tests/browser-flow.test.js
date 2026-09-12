"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { runBrowserFlow, allChecksPass } = require("./browser-flow-browser.js");

test("real file pages satisfy every declared browser-flow check", { timeout: 180_000 }, async () => {
  const result = await runBrowserFlow({ writeEvidence: false });

  assert.equal(allChecksPass(result.checks), true);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.viewports, 12);
  assert.equal(result.summary.subjectFlows, 3);
  assert.equal(result.summary.prints, 4);
  assert.equal(result.summary.externalRequests, 0);
  assert.equal(result.summary.consoleErrors, 0);
  assert.equal(result.formula.sha256, "e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee");
  assert.deepEqual(result.formula.dimensions, { width: 2481, height: 3508 });
  assert.equal(result.formula.printPages, 1);
  assert.equal(result.checks.formula.desktop_tab_cycle, "pass");
  assert.equal(result.checks.formula.mobile_tab_cycle, "pass");
});

test("browser-flow status rejects a nested failed leaf", () => {
  assert.equal(allChecksPass({ hub: { desktop: "pass", mobile: "fail" } }), false);
  assert.equal(allChecksPass({ hub: { desktop: "pass", mobile: "pass" } }), true);
});
