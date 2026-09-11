const test = require("node:test");
const assert = require("node:assert/strict");
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
