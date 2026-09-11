const test = require("node:test");
const assert = require("node:assert/strict");
const expression = require("../assets/js/expression-parser.js");

function valueOf(raw, variables) {
  const parsed = expression.parse(raw);
  assert.equal(parsed.ok, true, parsed.reason);
  const evaluated = expression.evaluate(parsed.ast, variables || {});
  assert.equal(evaluated.ok, true, evaluated.reason);
  return evaluated.value;
}

test("tokenizes decimal comma without treating it as a separator", () => {
  const tokenized = expression.tokenize("1,25 + x");

  assert.equal(tokenized.ok, true);
  assert.deepEqual(tokenized.tokens.map((token) => token.value), [1.25, "+", "x"]);
});

test("uses unary precedence and right-associative exponentiation", () => {
  assert.equal(valueOf("-2^2"), 4);
  assert.equal(valueOf("2^3^2"), 512);
});

test("evaluates supported functions and implicit multiplication", () => {
  assert.equal(valueOf("2x + (x-1)(x+2)", { x: 3 }), 16);
  assert.equal(valueOf("sqrt(9) + √(16)"), 7);
});

test("rejects executable or out-of-scope syntax", () => {
  ["x=1", "x.y", "x[0]", "'x'", "sin(x)", "process.exit()"].forEach((raw) => {
    assert.equal(expression.parse(raw).ok, false, raw);
  });
});

test("returns invalid evaluation results for undefined real values", () => {
  assert.equal(expression.evaluate(expression.parse("1/0").ast, {}).ok, false);
  assert.equal(expression.evaluate(expression.parse("√(-1)").ast, {}).ok, false);
  assert.equal(expression.evaluate(expression.parse("10^1000").ast, {}).ok, false);
});

test("solution sets ignore order and Swedish separators", () => {
  assert.deepEqual(expression.parseSolutionSet("x=6 eller x=1", "x").values, [1, 6]);
  assert.deepEqual(expression.parseSolutionSet("1; 6", "x").values, [1, 6]);
});

test("solution sets distinguish decimal comma from repeated assignments", () => {
  assert.deepEqual(expression.parseSolutionSet("1,6", "x").values, [1.6]);
  assert.deepEqual(expression.parseSolutionSet("x=1, x=6", "x").values, [1, 6]);
});

test("solution sets recognize only documented empty-set phrases", () => {
  ["ingen lösning", "saknar reella lösningar", "∅"].forEach((raw) => {
    assert.deepEqual(expression.parseSolutionSet(raw, "x").values, []);
  });
  assert.equal(expression.parseSolutionSet("tom", "x").ok, false);
});

test("equivalent forms compare mathematically", () => {
  assert.equal(expression.equivalent("(x-1)*(x+2)", "x^2+x-2", { variables: ["x"] }).equivalent, true);
  assert.equal(expression.equivalent("(a+1)/((a-1)*(a+1))", "1/(a-1)", { variables: ["a"], exclude: [-1, 1] }).equivalent, true);
});

test("equivalence preserves domain exclusions", () => {
  assert.equal(expression.equivalent("(x+1)/(x+1)", "1", { variables: ["x"] }).equivalent, false);
  assert.equal(expression.equivalent("(x+1)/(x+1)", "1", { variables: ["x"], exclude: [-1] }).equivalent, true);
});

test("rational analysis exposes reduction and exact denominator-domain structure", () => {
  const copied = expression.analyzeRational(
    "(x^2-7*x+10)/(x^2-9*x+14)",
    { variable: "x" }
  );
  const reduced = expression.analyzeRational("(x-5)/(x-7)", { variable: "x" });
  const removableHole = expression.compareReducedRationals(
    "(x+1)*(x-6)/(x-6)",
    "x+1",
    { variable: "x" }
  );
  const decimalScalar = expression.compareReducedRationals(
    "0.5*(x-5)/(0.5*(x-7))",
    "(x-5)/(x-7)",
    { variable: "x" }
  );

  assert.equal(copied.ok, true);
  assert.equal(copied.reduced, false, "the copied quotient still has the factor x-2");
  assert.equal(reduced.ok, true);
  assert.equal(reduced.reduced, true);
  assert.deepEqual(removableHole, {
    equivalent: true,
    reduced: false,
    coefficientReduced: true,
    sameDomain: false,
    simple: true
  });
  assert.equal(decimalScalar.equivalent, true);
  assert.equal(decimalScalar.coefficientReduced, false, "a common finite decimal scalar remains cancellable");
});

test("equivalence rejects mismatches but reports unsafe comparisons as uncertain", () => {
  assert.equal(expression.equivalent("x+1", "x+2", { variables: ["x"] }).equivalent, false);
  assert.deepEqual(expression.equivalent("x plus ett", "x+1", { variables: ["x"] }), {
    equivalent: null,
    reason: "unparseable"
  });
  assert.deepEqual(expression.equivalent("√(x)", "x^(1/2)", { variables: ["x"] }), {
    equivalent: null,
    reason: "insufficient-confidence"
  });
});

test("overflowing constant expressions do not collide during normalization", () => {
  assert.deepEqual(expression.equivalent("10^308+10^308", "10^308*10"), {
    equivalent: null,
    reason: "insufficient-confidence"
  });
});
