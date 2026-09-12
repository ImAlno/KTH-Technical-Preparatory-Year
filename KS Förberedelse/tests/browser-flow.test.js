"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runBrowserFlow,
  allChecksPass,
  descriptorsAreUnique,
  requiredInventoryPresent,
  isA4PageBox,
  focusContrastPass,
  completeEvidenceInventory,
  REQUIRED_KEYBOARD_SECTIONS,
  REQUIRED_MOBILE_STATE_SECTIONS
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
  assert.equal(result.states.filter((entry) => /_(math|physics|chemistry)_active$/u.test(entry.section)).every((entry) => entry.contrast.inventory.answer_unit > 0), true);
  assert.deepEqual(result.keyboardResults.map((entry) => entry.section).sort(), REQUIRED_KEYBOARD_SECTIONS.slice().sort());
  assert.deepEqual(result.states.map((entry) => entry.section).sort(), REQUIRED_MOBILE_STATE_SECTIONS.slice().sort());
  assert.deepEqual(result.formulaSequences.map((entry) => entry.viewport).sort(), ["desktop", "mobile"]);
  assert.equal(completeEvidenceInventory(result), true);
  assert.equal(completeEvidenceInventory(Object.assign({}, result, { states: result.states.slice(1) })), false);
  assert.equal(completeEvidenceInventory(Object.assign({}, result, { keyboardResults: result.keyboardResults.slice(1) })), false);
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

  const a4 = { x0: 0, y0: 0, x1: 594.96, y1: 841.92, width: 594.96, height: 841.92 };
  assert.equal(isA4PageBox({ media: a4, crop: a4 }), true);
  assert.equal(isA4PageBox({ media: { x0: 0, y0: 0, x1: 612, y1: 792, width: 612, height: 792 }, crop: { x0: 0, y0: 0, x1: 612, y1: 792, width: 612, height: 792 } }), false);
  assert.equal(isA4PageBox({ media: a4, crop: { x0: 0, y0: 0, x1: 580, y1: 820, width: 580, height: 820 } }), false);
  assert.equal(isA4PageBox({ media: a4, crop: { x0: 5, y0: 0, x1: 599.96, y1: 841.92, width: 594.96, height: 841.92 } }), false);

  assert.equal(focusContrastPass("#356B59", ["#34202A"]), false, "work against ink is only about 2.45:1");
  assert.equal(focusContrastPass("#356B59", ["#A94F3B"]), false, "work against attention is only about 1.14:1");
  assert.equal(focusContrastPass("#FBF8EF", ["#34202A", "#A94F3B"]), true);
});
