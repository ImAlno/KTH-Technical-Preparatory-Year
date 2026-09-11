const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const grading = require("../assets/js/grading.js");

test("parses decimal comma and scientific notation", () => {
  assert.equal(grading.parseNumeric("1,25").value, 1.25);
  assert.equal(grading.parseNumeric("1,2·10^3").value, 1200);
  assert.equal(grading.parseNumeric("1.2e3").value, 1200);
  assert.equal(grading.parseNumeric("1,2*10^3").value, 1200);
});

test("parses a target unit separately from the numeric token", () => {
  assert.deepEqual(grading.parseNumeric(" 9,82 m/s² "), { ok: true, value: 9.82, unit: "m/s2" });
});

test("parses finite rational numeric tokens without confusing unit slashes", () => {
  assert.deepEqual(grading.parseNumeric("1/2"), { ok: true, value: 0.5, unit: null });
  assert.deepEqual(grading.parseNumeric("1,5e2 / 3e1 kg"), { ok: true, value: 5, unit: "kg" });
  assert.deepEqual(grading.parseNumeric("1,2·10^3 / -2,4e2"), { ok: true, value: -5, unit: null });
  assert.deepEqual(grading.parseNumeric("10 m/s"), { ok: true, value: 10, unit: "m/s" });

  ["1/0", "1/0e2", "1/1e309", "1e309/2", "1/2m"].forEach((raw) => {
    assert.equal(grading.parseNumeric(raw).ok, false, raw);
  });
});

test("accepts a value inside the field tolerance", () => {
  const result = grading.gradeNumeric(
    { expected: 9.82, points: 2, tolerance: { absolute: 0.01 }, targetUnit: "m/s2" },
    "9,82"
  );

  assert.equal(result.status, "correct");
  assert.equal(result.earned, 2);
  assert.equal(result.possible, 2);
});

test("converts matching answers to the stated target unit", () => {
  const result = grading.gradeNumeric(
    { expected: 10, points: 2, tolerance: { absolute: 0.001 }, targetUnit: "m/s" },
    "36 km/h"
  );

  assert.equal(result.status, "correct");
  assert.equal(result.earned, 2);
  assert.equal(result.interpreted, 10);
  assert.equal(result.message, "Rätt värde i annan enhet.");
});

test("field metadata can reduce credit for a correct value in another unit", () => {
  const reduced = grading.gradeNumeric(
    { expected: 10, points: 2, tolerance: { absolute: 0.001 }, targetUnit: "m/s", alternativeUnitCredit: "reduced" },
    "36 km/h"
  );
  const target = grading.gradeNumeric(
    { expected: 10, points: 2, tolerance: { absolute: 0.001 }, targetUnit: "m/s", alternativeUnitCredit: "reduced" },
    "10 m s−1"
  );

  assert.deepEqual(
    { status: reduced.status, earned: reduced.earned, message: reduced.message },
    { status: "partial", earned: 1, message: "Rätt värde i annan enhet." }
  );
  assert.deepEqual(
    { status: target.status, earned: target.earned, message: target.message },
    { status: "correct", earned: 2, message: "Rätt svar." }
  );
  assert.equal(grading.gradeNumeric({
    expected: 10,
    points: 2,
    targetUnit: "m/s",
    alternativeUnitCredit: "sometimes"
  }, "10 m/s").status, "self");
});

test("returns self review for ambiguous input or incompatible units", () => {
  const spec = { expected: 10, points: 2, tolerance: { absolute: 0.1 }, targetUnit: "m/s" };

  assert.equal(grading.gradeNumeric(spec, "ungefär tio").status, "self");
  assert.equal(grading.gradeNumeric(spec, "10 kg").status, "self");
});

test("uses the larger absolute or relative tolerance", () => {
  const result = grading.gradeNumeric(
    { expected: 100, points: 1, tolerance: { absolute: 0.1, relative: 0.02 }, targetUnit: "m" },
    "101,5"
  );

  assert.equal(result.status, "correct");
});

test("grades normalized aliases and always returns the shared result shape", () => {
  const result = grading.gradeAliases(
    { expected: "Rätt svar", aliases: ["godkänt svar"], points: 3 },
    "  GODKÄNT   SVAR "
  );

  assert.deepEqual(result, {
    status: "correct",
    earned: 3,
    possible: 3,
    interpreted: "godkänt svar",
    message: result.message
  });
  assert.equal(typeof result.message, "string");
});

test("treats empty aliases as incorrect and malformed aliases as self review", () => {
  const spec = { expected: "ja", aliases: ["japp"], points: 1 };

  assert.equal(grading.gradeAliases(spec, "").status, "incorrect");
  assert.equal(grading.gradeAliases({ aliases: [], points: 1 }, "ja").status, "self");
  assert.equal(grading.gradeAliases({ expected: "ja", aliases: "japp", points: 1 }, "ja").status, "self");
});

test("treats empty alias input as incorrect and ignores empty accepted aliases", () => {
  assert.equal(grading.gradeAliases({ expected: "", aliases: [""], points: 1 }, "").status, "self");
  assert.equal(grading.gradeAliases({ expected: "ja", aliases: [""], points: 1 }, "").status, "incorrect");
});

test("normalizes aliases with locale-independent lowercasing", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../assets/js/grading.js"), "utf8");

  assert.match(source, /\.toLowerCase\(\)/);
  assert.doesNotMatch(source, /\.toLocaleLowerCase\(\)/);
});

test("returns self review for malformed numeric grading specifications", () => {
  assert.equal(
    grading.gradeNumeric({ expected: 10, points: 1, tolerance: { absolute: -1 }, targetUnit: "m" }, "10 m").status,
    "self"
  );
});

test("grades solution sets without order and merges roots within tolerance", () => {
  const spec = { expected: [1, 6], points: 2, tolerance: { absolute: 0.001 }, variable: "x" };

  assert.equal(grading.gradeSolutionSet(spec, "x=6 eller x=1").status, "correct");
  assert.equal(grading.gradeSolutionSet(spec, "1; 1,0004; 6").status, "correct");
  assert.equal(grading.gradeSolutionSet(spec, "1; 6; 9").status, "incorrect");
});

test("grades documented empty solution sets only when expected is empty", () => {
  assert.equal(grading.gradeSolutionSet({ expected: [], points: 1, variable: "x" }, "saknar reella lösningar").status, "correct");
  assert.equal(grading.gradeSolutionSet({ expected: [1], points: 1, variable: "x" }, "∅").status, "incorrect");
});

test("returns self review for uncertain solution-set input or specifications", () => {
  assert.equal(grading.gradeSolutionSet({ expected: [1], points: 1, variable: "x" }, "x är ett").status, "self");
  assert.equal(grading.gradeSolutionSet({ expected: [Infinity], points: 1, variable: "x" }, "1").status, "self");
});

test("grades equivalent and non-equivalent algebraic expressions", () => {
  const spec = { expected: "x^2+x-2", points: 2, variables: ["x"] };

  assert.equal(grading.gradeExpression(spec, "(x-1)(x+2)").status, "correct");
  assert.equal(grading.gradeExpression(spec, "x^2+x-3").status, "incorrect");
});

test("simplification grading rejects copied factors and removable domain holes", () => {
  const spec = { expected: "(x-5)/(x-7)", points: 1, variables: ["x"] };

  assert.equal(
    grading.gradeSimplifiedExpression(spec, "(x^2-7*x+10)/(x^2-9*x+14)").status,
    "incorrect"
  );
  assert.equal(
    grading.gradeSimplifiedExpression({ expected: "x+1", points: 1, variables: ["x"] }, "(x+1)*(x-6)/(x-6)").status,
    "incorrect"
  );
  assert.equal(
    grading.gradeSimplifiedExpression(spec, "(5-x)/(7-x)").status,
    "correct",
    "moving a common sign must remain accepted"
  );
  assert.equal(
    grading.gradeSimplifiedExpression(spec, "(x-5)*(x-6)/((x-7)*(x-6))").status,
    "incorrect",
    "an extra removable denominator hole must be rejected"
  );
  assert.equal(
    grading.gradeExpression({ expected: "x+1", points: 1, variables: ["x"] }, "(x+1)*(x-6)/(x-6)").status,
    "correct",
    "general equivalence fields must retain their broad contract"
  );
});

test("simplification grading rejects a cancellable non-unit common factor", () => {
  const spec = { expected: "(x-5)/(x-7)", points: 1, variables: ["x"] };

  assert.equal(
    grading.gradeSimplifiedExpression(spec, "2*(x-5)/(2*(x-7))").status,
    "incorrect"
  );
  assert.equal(
    grading.gradeSimplifiedExpression(spec, "(5-x)/(7-x)").status,
    "correct",
    "a common sign remains a valid reduced form"
  );
});

test("simplification grading rejects an unchanged sum of unlike denominators", () => {
  const spec = { expected: "(5*x-13)/((x-1)*(x-5))", points: 1, variables: ["x"] };

  assert.equal(grading.gradeSimplifiedExpression(spec, "2/(x-1)+3/(x-5)").status, "incorrect");
  assert.equal(grading.gradeSimplifiedExpression(spec, spec.expected).status, "correct");
});

test("unknown or insufficient-confidence expression syntax falls back to self assessment", () => {
  assert.equal(grading.gradeExpression({ expected: "x+1", points: 2, variables: ["x"] }, "x plus ett").status, "self");
  assert.equal(grading.gradeExpression({ expected: "sqrt(x)", points: 2, variables: ["x"] }, "x^(1/2)").status, "self");
});

test("overflowing unequal constants fall back to self assessment", () => {
  const result = grading.gradeExpression({ expected: "10^308*10", points: 2 }, "10^308+10^308");

  assert.equal(result.status, "self");
  assert.equal(result.earned, 0);
});

test("algebra graders preserve the existing numeric and alias API", () => {
  assert.equal(typeof grading.parseNumeric, "function");
  assert.equal(typeof grading.gradeNumeric, "function");
  assert.equal(typeof grading.gradeAliases, "function");
  assert.equal(grading.gradeNumeric({ expected: 10, points: 1, targetUnit: "m" }, "10 m").status, "correct");
  assert.equal(grading.gradeAliases({ expected: "ja", points: 1 }, "ja").status, "correct");
});

test("browser scripts resolve expression grading through the KS namespace", () => {
  const context = vm.createContext({ window: {} });
  ["units.js", "expression-parser.js", "grading.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/js", file), "utf8"), context, { filename: file });
  });

  assert.equal(context.window.KS.grading.gradeExpression(
    { expected: "x+1", points: 1, variables: ["x"] },
    "1+x"
  ).status, "correct");
  assert.equal(typeof context.window.KS.grading.gradeNumeric, "function");
});

test("grades case-sensitive chemical formulas and uncertain formula input", () => {
  const spec = { expected: "CO", points: 2 };
  const correct = grading.gradeChemicalFormula(spec, "CO");

  assert.deepEqual(correct, {
    status: "correct",
    earned: 2,
    possible: 2,
    interpreted: correct.interpreted,
    message: correct.message
  });
  assert.equal(grading.gradeChemicalFormula(spec, "Co").status, "incorrect");
  assert.equal(grading.gradeChemicalFormula(spec, "kemisk formel").status, "self");
});

test("chemical formula grading preserves grouping and order unless an alias is explicit", () => {
  const spec = { expected: "Ca(NO3)2", points: 1 };

  assert.equal(grading.gradeChemicalFormula(spec, "Ca(NO3)2").status, "correct");
  assert.equal(grading.gradeChemicalFormula(spec, "Ca(NO₃)₂").status, "correct");
  assert.equal(grading.gradeChemicalFormula(spec, "CaN2O6").status, "incorrect");
  assert.equal(grading.gradeChemicalFormula(spec, "O6N2Ca").status, "incorrect");
  assert.equal(
    grading.gradeChemicalFormula({ expected: "N^3-", aliases: ["N3-"], points: 1 }, "N3-").status,
    "correct"
  );
});

test("required aggregation states receive configurable partial credit", () => {
  const expected = "Ag+(aq)+Cl-(aq)->AgCl(s)";
  const missingStates = grading.gradeChemicalEquation(
    { expected: expected, points: 2, requireStates: true },
    "Ag+ + Cl- -> AgCl"
  );
  const wrongState = grading.gradeChemicalEquation(
    { expected: expected, points: 5, requireStates: true, statePoints: 2 },
    "Ag+(s) + Cl-(aq) -> AgCl(s)"
  );

  assert.equal(missingStates.status, "partial");
  assert.equal(missingStates.earned, 1);
  assert.equal(wrongState.status, "partial");
  assert.equal(wrongState.earned, 3);
  assert.equal(missingStates.possible, 2);
  assert.equal(typeof missingStates.message, "string");
});

test("chemical equation grading distinguishes wrong, uncertain, and malformed specifications", () => {
  const spec = { expected: "2H2+O2->2H2O", points: 2 };

  assert.equal(grading.gradeChemicalEquation(spec, "2H2O->2H2+O2").status, "incorrect");
  assert.equal(grading.gradeChemicalEquation(spec, "H2 plus O2").status, "self");
  assert.equal(grading.gradeChemicalEquation({ expected: spec.expected, points: 2, requireStates: true }, "2H2+O2->2H2O").status, "self");
  assert.equal(grading.gradeChemicalEquation({ expected: spec.expected, points: 2, statePoints: 3 }, spec.expected).status, "self");
});

test("chemistry graders preserve all existing grading exports", () => {
  ["parseNumeric", "gradeNumeric", "gradeAliases", "gradeSolutionSet", "gradeExpression", "gradeSimplifiedExpression", "gradeChemicalFormula", "gradeChemicalEquation"].forEach((name) => {
    assert.equal(typeof grading[name], "function");
  });
  assert.equal(grading.gradeExpression({ expected: "x+1", points: 1 }, "1+x").status, "correct");
  assert.equal(grading.gradeNumeric({ expected: 10, points: 1, targetUnit: "m" }, "10 m").status, "correct");
});

test("chemical graders return a complete result for non-string input", () => {
  const formulaResult = grading.gradeChemicalFormula({ expected: "H2O", points: 1 }, null);
  const equationResult = grading.gradeChemicalEquation({ expected: "2H2+O2->2H2O", points: 2 }, Symbol("answer"));

  [formulaResult, equationResult].forEach((result) => {
    assert.deepEqual(Object.keys(result).sort(), ["earned", "interpreted", "message", "possible", "status"]);
    assert.equal(result.status, "self");
    assert.equal(result.earned, 0);
    assert.equal(typeof result.message, "string");
  });
});

test("browser scripts resolve chemistry grading through the KS namespace", () => {
  const context = vm.createContext({ window: {} });
  ["units.js", "expression-parser.js", "chemistry-parser.js", "grading.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/js", file), "utf8"), context, { filename: file });
  });

  assert.equal(context.window.KS.grading.gradeChemicalFormula({ expected: "H2O", points: 1 }, "H₂O").status, "correct");
  assert.equal(context.window.KS.grading.gradeChemicalFormula({ expected: "H2O", points: 1 }, "OH2").status, "incorrect");
  assert.equal(context.window.KS.grading.gradeExpression({ expected: "x+1", points: 1 }, "1+x").status, "correct");
});

test("unsafe duplicate-species coefficient totals fall back to self assessment", () => {
  const result = grading.gradeChemicalEquation(
    { expected: "9007199254740991H2+1H2->O2", points: 2 },
    "9007199254740991H2+2H2->O2"
  );

  assert.equal(result.status, "self");
  assert.equal(result.earned, 0);
  assert.equal(result.possible, 2);
});
