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
  assert.equal(result.interpreted, 10);
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
