const test = require("node:test");
const assert = require("node:assert/strict");
const chemistry = require("../assets/js/chemistry-parser.js");

test("normalizes ordinary and subscript digits without folding element case", () => {
  assert.equal(chemistry.normalizeFormula("H₂SO₄"), chemistry.normalizeFormula("H2SO4"));
  assert.notEqual(chemistry.normalizeFormula("CO"), chemistry.normalizeFormula("Co"));
});

test("normalizes ionic charge notation while preserving atom subscripts", () => {
  assert.equal(chemistry.normalizeFormula("SO₄²⁻"), chemistry.normalizeFormula("SO4^2-"));
  assert.equal(chemistry.normalizeFormula("Fe³⁺"), chemistry.normalizeFormula("Fe^3+"));

  const ammonium = chemistry.parseFormula("NH4+");
  assert.equal(ammonium.ok, true);
  assert.deepEqual(ammonium.elements, { H: 4, N: 1 });
  assert.equal(ammonium.charge, 1);
});

test("parses nested groups and hydrate components", () => {
  const nested = chemistry.parseFormula("K4(ON(SO3)2)2");
  assert.equal(nested.ok, true);
  assert.deepEqual(nested.elements, { K: 4, N: 2, O: 14, S: 4 });

  const hydrate = chemistry.parseFormula("CuSO4·5H2O(s)");
  assert.equal(hydrate.ok, true);
  assert.deepEqual(hydrate.elements, { Cu: 1, H: 10, O: 9, S: 1 });
  assert.deepEqual(hydrate.hydrates, [{ multiplier: 5, elements: { H: 2, O: 1 } }]);
  assert.equal(hydrate.state, "s");
  assert.equal(chemistry.normalizeFormula("CuSO4.5H2O"), chemistry.normalizeFormula("CuSO4·5H2O"));
});

test("rejects malformed, unknown, and coefficient-prefixed formulas without throwing", () => {
  ["", "H2O)", "Mg(OH", "Xx2", "2H2O", "SO4^2", null, 42].forEach((raw) => {
    assert.equal(chemistry.parseFormula(raw).ok, false);
  });
});

test("reaction order and common coefficient scale do not matter", () => {
  const expected = "2 H2(g) + O2(g) -> 2 H2O(l)";
  assert.equal(chemistry.equivalentEquations("O2(g)+2H2(g)→2H2O(l)", expected, { requireStates: true }).equivalent, true);
  assert.equal(chemistry.equivalentEquations("4H2(g)+2O2(g)→4H2O(l)", expected, { requireStates: true }).equivalent, true);
  assert.equal(chemistry.parseEquation("N2(g)+3H2(g)⇌2NH3(g)").ok, true);
});

test("parses ionic charges without confusing charge signs and species separators", () => {
  const plain = "2 Ag+(aq) + CO3^2-(aq) -> Ag2CO3(s)";
  const unicode = "CO₃²⁻(aq)+2Ag⁺(aq)→Ag₂CO₃(s)";

  assert.equal(chemistry.equivalentEquations(plain, unicode, { requireStates: true }).equivalent, true);
  assert.equal(chemistry.parseEquation("Ag++Cl-→AgCl").ok, true);
});

test("hydrates and nested groups remain comparable in equations", () => {
  const spacedDot = "CuSO4 + 5 H2O -> CuSO4 · 5 H2O";
  const compactDot = "5H2O+CuSO4=CuSO4.5H2O";

  assert.equal(chemistry.equivalentEquations(spacedDot, compactDot).equivalent, true);
});

test("equation sides remain distinct and states are optional unless required", () => {
  const expected = "2H2(g)+O2(g)->2H2O(l)";
  assert.equal(chemistry.equivalentEquations("2H2O(l)->2H2(g)+O2(g)", expected).equivalent, false);
  assert.equal(chemistry.equivalentEquations("2H2+O2->2H2O", expected).equivalent, true);

  const stateComparison = chemistry.equivalentEquations("2H2(g)+O2(g)->2H2O(g)", expected, { requireStates: true });
  assert.equal(stateComparison.equivalent, false);
  assert.equal(stateComparison.reason, "state-mismatch");
});

test("malformed or ambiguous equations are reported as unparseable", () => {
  ["H2 + -> H2O", "H2 -> O2 -> H2O", "0H2+O2->H2O", "H2 plus O2 -> H2O", null].forEach((raw) => {
    assert.equal(chemistry.parseEquation(raw).ok, false);
  });
  assert.equal(chemistry.equivalentEquations("H2 ->", "H2->H2").equivalent, null);
});

test("rejects duplicate-species coefficient totals beyond safe integers", () => {
  const plusOne = "9007199254740991H2+1H2->O2";
  const plusTwo = "9007199254740991H2+2H2->O2";

  assert.equal(chemistry.parseEquation(plusOne).ok, false);
  assert.equal(chemistry.parseEquation(plusTwo).ok, false);
  assert.equal(chemistry.equivalentEquations(plusOne, plusTwo).equivalent, null);
});
