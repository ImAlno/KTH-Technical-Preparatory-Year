"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runBrowserFlow,
  allChecksPass,
  descriptorsAreUnique,
  requiredInventoryPresent,
  isA4PageBox
} = require("./browser-flow-browser.js");

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
  assert.ok(result.summary.radioCases > 0);
  assert.ok(result.summary.focusPaintChecks > 0);
  assert.ok(result.summary.contrastSamples > 0);
  assert.equal(result.states.some((entry) => entry.contrast.inventory.status_warning > 0), true);
  assert.equal(result.states.some((entry) => entry.contrast.inventory.flagged_nav > 0), true);
  assert.equal(result.prints.every((entry) => entry.a4Pages === entry.pages), true);
  assert.equal(result.checks.recovery.version1_history_after_replace, "pass");
  assert.equal(result.checks.recovery.changed_schema_history_after_replace, "pass");
});

test("browser-flow status rejects a nested failed leaf", () => {
  assert.equal(allChecksPass({ hub: { desktop: "pass", mobile: "fail" } }), false);
  assert.equal(allChecksPass({ hub: { desktop: "pass", mobile: "pass" } }), true);
});

test("browser-flow gates reject descriptor, inventory and paper-size vacuity", () => {
  assert.equal(descriptorsAreUnique([
    { href: "math.html", text: "Starta", index: 0 },
    { href: "physics.html", text: "Starta", index: 1 }
  ]), true);
  assert.equal(descriptorsAreUnique([
    { href: "math.html", text: "Starta", index: 0 },
    { href: "math.html", text: "Starta", index: 0 }
  ]), false);
  assert.equal(descriptorsAreUnique([{ href: "", text: "Starta", index: 0 }]), false);

  assert.equal(requiredInventoryPresent({ radio: 1, primary: 2 }, { radio: 1, primary: 1 }), true);
  assert.equal(requiredInventoryPresent({ radio: 0, primary: 2 }, { radio: 1, primary: 1 }), false);
  assert.equal(requiredInventoryPresent({}, { radio: 1 }), false);

  assert.equal(isA4PageBox({ media: { width: 594.96, height: 841.92 }, crop: { width: 594.96, height: 841.92 } }), true);
  assert.equal(isA4PageBox({ media: { width: 612, height: 792 }, crop: { width: 612, height: 792 } }), false);
  assert.equal(isA4PageBox({ media: { width: 594.96, height: 841.92 }, crop: { width: 580, height: 820 } }), false);
});
