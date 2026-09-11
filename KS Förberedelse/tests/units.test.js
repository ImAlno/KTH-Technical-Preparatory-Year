const test = require("node:test");
const assert = require("node:assert/strict");
const units = require("../assets/js/units.js");

test("normalizes whitespace, Unicode notation and aliases", () => {
  assert.equal(units.normalizeUnit(" m / s² "), "m/s2");
  assert.equal(units.normalizeUnit("m s−1"), "m/s");
  assert.equal(units.normalizeUnit("liter"), "dm3");
});

test("converts compatible units", () => {
  assert.equal(units.convert(36, "km/h", "m/s").value, 10);
  assert.equal(units.convert(250, "cm3", "dm3").value, 0.25);
  assert.equal(units.convert(1, "g/cm³", "kg/m3").value, 1000);
});

test("refuses incompatible or unknown units", () => {
  assert.deepEqual(units.convert(1, "N", "kg"), { ok: false, reason: "incompatible-dimension" });
  assert.equal(units.convert(1, "glim", "m").ok, false);
});
