const test = require("node:test");
const assert = require("node:assert/strict");
const units = require("../assets/js/units.js");

test("normalizes whitespace, Unicode notation and aliases", () => {
  assert.equal(units.normalizeUnit(" m / s² "), "m/s2");
  assert.equal(units.normalizeUnit("m s−1"), "m/s");
  assert.equal(units.normalizeUnit("m·s⁻¹"), "m/s");
  assert.equal(units.normalizeUnit("m×s-1"), "m/s");
  assert.equal(units.normalizeUnit("liter"), "dm3");
});

test("converts compatible units", () => {
  assert.equal(units.convert(36, "km/h", "m/s").value, 10);
  assert.equal(units.convert(250, "cm3", "dm3").value, 0.25);
  assert.equal(units.convert(1, "g/cm³", "kg/m3").value, 1000);
  assert.equal(units.convert(10, "m×s-1", "m/s").value, 10);
});

test("normalizes and converts first-class square-area units", () => {
  const aliases = { m2: ["m2", "m^2", "m²"], cm2: ["cm2", "cm^2", "cm²"], mm2: ["mm2", "mm^2", "mm²"] };
  Object.entries(aliases).forEach(([canonical, variants]) => {
    variants.forEach((variant) => assert.equal(units.normalizeUnit(variant), canonical));
  });
  assert.equal(units.convert(1, "m²", "cm²").value, 10000);
  assert.equal(units.convert(2500, "mm^2", "cm2").value, 25);
  assert.deepEqual(units.convert(1, "m²", "m"), { ok: false, reason: "incompatible-dimension" });
});

test("normalizes and converts first-class molar-mass units", () => {
  ["g/mol", "g mol−1", "g·mol⁻¹"].forEach((variant) => {
    assert.equal(units.normalizeUnit(variant), "g/mol");
  });
  assert.equal(units.normalizeUnit("kg/mol"), "kg/mol");
  assert.equal(units.convert(1, "kg/mol", "g/mol").value, 1000);
  assert.deepEqual(units.convert(18.02, "g/mol", "g"), { ok: false, reason: "incompatible-dimension" });
});

test("represents counts with a genuine dimensionless unit", () => {
  assert.equal(units.normalizeUnit("1"), "1");
  assert.equal(units.convert(7, "1", "1").value, 7);
  assert.deepEqual(units.convert(7, "1", "mol"), { ok: false, reason: "incompatible-dimension" });
});

test("refuses incompatible or unknown units", () => {
  assert.deepEqual(units.convert(1, "N", "kg"), { ok: false, reason: "incompatible-dimension" });
  assert.equal(units.convert(1, "glim", "m").ok, false);
});
