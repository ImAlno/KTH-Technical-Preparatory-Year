const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const exam = require("../assets/js/exam-engine.js");
const expression = require("../assets/js/expression-parser.js");
const grading = require("../assets/js/grading.js");

const MATH_ROOT = path.join(__dirname, "../Matematik KS2");
const SLOT_FAMILIES = {
  1: ["sqrt-equals-linear", "linear-plus-sqrt", "scaled-sqrt-plus-linear", "sqrt-minus-constant", "sqrt-equals-scaled-linear"],
  2: ["abs-linear", "abs-constant", "scaled-shifted-abs", "abs-equals-abs", "contextual-distance"],
  3: ["factor-cancellation", "difference-of-squares", "complex-fraction", "unlike-denominators", "sign-handling"],
  4: ["rational-one-exclusion", "rational-two-exclusions", "biquadratic", "factorable-cubic", "quadratic-substitution"],
  5: ["right-triangle", "non-right-triangle-area", "parallel-transversal", "composite-quadrilateral", "symmetric-construction"]
};
const SLOT_SKILLS = ["radical-equations", "absolute-value-equations", "rational-simplification", "rational-polynomial-equations", "geometry"];

function loadSlots() {
  return Object.fromEntries([1, 2, 3, 4, 5].map((slot) => [slot, require(path.join(MATH_ROOT, `questions/slot-${slot}.js`))]));
}

function loadSubjectDataFresh() {
  const files = [1, 2, 3, 4, 5].map((slot) => path.join(MATH_ROOT, `questions/slot-${slot}.js`));
  files.push(path.join(MATH_ROOT, "questions.js"));
  files.forEach((file) => { delete require.cache[require.resolve(file)]; });
  return require(path.join(MATH_ROOT, "questions.js"));
}

function allQuestions() {
  return Object.values(loadSlots()).flat();
}

function close(left, right, tolerance = 1e-8) {
  return Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));
}

function sortedUnique(values) {
  return values.slice().sort((left, right) => left - right).filter((value, index, sorted) => index === 0 || !close(value, sorted[index - 1]));
}

function assertNumberSets(actual, expected, message) {
  const left = sortedUnique(actual);
  const right = sortedUnique(expected);
  assert.equal(left.length, right.length, message);
  left.forEach((value, index) => assert.ok(close(value, right[index]), `${message}: ${value} != ${right[index]}`));
}

function quadraticRoots(a, b, c) {
  assert.notEqual(a, 0);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-10) return [];
  if (close(discriminant, 0)) return [-b / (2 * a)];
  const root = Math.sqrt(Math.max(0, discriminant));
  return sortedUnique([(-b - root) / (2 * a), (-b + root) / (2 * a)]);
}

function linearRoot(coefficient, constant) {
  return close(coefficient, 0) ? [] : [-constant / coefficient];
}

function radicalSides(data, x) {
  const p = data.parameters;
  if (data.family === "sqrt-equals-linear") return [Math.sqrt(x + p.b), p.c - x, x + p.b >= 0];
  if (data.family === "linear-plus-sqrt") return [x + Math.sqrt(p.a * x + p.b), p.c, p.a * x + p.b >= 0];
  if (data.family === "scaled-sqrt-plus-linear") return [p.k * Math.sqrt(x + p.b) + x, p.c, x + p.b >= 0];
  if (data.family === "sqrt-minus-constant") return [Math.sqrt(p.a * x + p.b) - p.d, x, p.a * x + p.b >= 0];
  if (data.family === "sqrt-equals-scaled-linear") return [Math.sqrt(x + p.b), p.k * x + p.d, x + p.b >= 0];
  throw new Error(`Unknown radical family ${data.family}`);
}

function radicalSquaredCandidates(data) {
  const p = data.parameters;
  if (data.family === "sqrt-equals-linear") return quadraticRoots(1, -(2 * p.c + 1), p.c * p.c - p.b);
  if (data.family === "linear-plus-sqrt") return quadraticRoots(1, -(2 * p.c + p.a), p.c * p.c - p.b);
  if (data.family === "scaled-sqrt-plus-linear") return quadraticRoots(1, -(2 * p.c + p.k * p.k), p.c * p.c - p.k * p.k * p.b);
  if (data.family === "sqrt-minus-constant") return quadraticRoots(1, 2 * p.d - p.a, p.d * p.d - p.b);
  if (data.family === "sqrt-equals-scaled-linear") return quadraticRoots(p.k * p.k, 2 * p.k * p.d - 1, p.d * p.d - p.b);
  throw new Error(`Unknown radical family ${data.family}`);
}

function solveRadical(data) {
  return radicalSquaredCandidates(data).filter((candidate) => {
    const [left, right, inDomain] = radicalSides(data, candidate);
    return inDomain && Number.isFinite(left) && Number.isFinite(right) && close(left, right);
  });
}

function absSides(data, x) {
  const p = data.parameters;
  if (data.family === "abs-equals-abs") return [Math.abs(p.a * x + p.b), Math.abs(p.c * x + p.d)];
  if (data.family === "scaled-shifted-abs") return [p.m * Math.abs(x - p.b) + p.c, p.d];
  if (data.family === "contextual-distance") return [Math.abs(x - p.center), p.distance];
  return [Math.abs(p.a * x + p.b), data.family === "abs-constant" ? p.k : p.c * x + p.d];
}

function absoluteBranchCandidates(data) {
  const p = data.parameters;
  if (data.family === "abs-linear" || data.family === "abs-equals-abs") {
    return sortedUnique(linearRoot(p.a - p.c, p.b - p.d).concat(linearRoot(p.a + p.c, p.b + p.d)));
  }
  if (data.family === "abs-constant") return sortedUnique([(-p.b - p.k) / p.a, (-p.b + p.k) / p.a]);
  if (data.family === "scaled-shifted-abs") {
    const distance = (p.d - p.c) / p.m;
    return distance < 0 ? [] : sortedUnique([p.b - distance, p.b + distance]);
  }
  if (data.family === "contextual-distance") return sortedUnique([p.center - p.distance, p.center + p.distance]);
  throw new Error(`Unknown absolute-value family ${data.family}`);
}

function solveAbsolute(data) {
  return absoluteBranchCandidates(data).filter((candidate) => {
    const [left, right] = absSides(data, candidate);
    return Number.isFinite(left) && Number.isFinite(right) && close(left, right);
  });
}

function polynomialValue(coefficients, x) {
  return coefficients.reduce((value, coefficient) => value * x + coefficient, 0);
}

function solveSlotFour(data) {
  const p = data.parameters;
  let candidates;
  if (data.family === "rational-one-exclusion") {
    candidates = quadraticRoots(1, -p.r, p.leftNumerator - p.rightNumerator);
  } else if (data.family === "rational-two-exclusions") {
    candidates = quadraticRoots(...p.numeratorCoefficients);
  } else if (data.family === "biquadratic") {
    candidates = quadraticRoots(p.coefficients[0], p.coefficients[2], p.coefficients[4]).flatMap((square) => square < -1e-10 ? [] : [Math.sqrt(Math.max(0, square)), -Math.sqrt(Math.max(0, square))]);
  } else if (data.family === "factorable-cubic") {
    candidates = Array.from({ length: 81 }, (_, index) => index - 40).filter((x) => close(polynomialValue(p.coefficients, x), 0));
  } else if (data.family === "quadratic-substitution") {
    candidates = quadraticRoots(1, -(p.first + p.second), p.first * p.second).flatMap((value) => quadraticRoots(1, p.linearCoefficient, -value));
  } else {
    throw new Error(`Unknown slot-four family ${data.family}`);
  }
  return sortedUnique(candidates).filter((candidate) => {
    if ((data.exclusions || []).some((excluded) => close(candidate, excluded))) return false;
    if (data.family === "rational-one-exclusion") {
      const left = candidate + p.leftNumerator / (candidate - p.r);
      const right = p.rightNumerator / (candidate - p.r);
      return Number.isFinite(left) && Number.isFinite(right) && close(left, right);
    }
    if (data.family === "rational-two-exclusions") {
      const denominator = polynomialValue(p.denominatorCoefficients, candidate);
      return !close(denominator, 0) && close(polynomialValue(p.numeratorCoefficients, candidate) / denominator, 0);
    }
    if (data.family === "biquadratic" || data.family === "factorable-cubic") return close(polynomialValue(p.coefficients, candidate), 0);
    const substituted = candidate * candidate + p.linearCoefficient * candidate;
    return close((substituted - p.first) * (substituted - p.second), 0);
  });
}

function parsedValue(raw, x) {
  const parsed = expression.parse(raw);
  assert.equal(parsed.ok, true, raw);
  return expression.evaluate(parsed.ast, { x });
}

function expectedSlotThree(data) {
  const p = data.parameters;
  if (data.family === "factor-cancellation") return `(x-${p.s})/(x-${p.t})`;
  if (data.family === "difference-of-squares") return `(x+${p.a})/(x+${p.b})`;
  if (data.family === "complex-fraction") return `(2*x-${p.r + p.s})/(${p.k}*(x-${p.s}))`;
  if (data.family === "unlike-denominators") return `(${p.a + p.b}*x-${p.a * p.s + p.b * p.r})/((x-${p.r})*(x-${p.s}))`;
  if (data.family === "sign-handling") return `-(x-${p.s})/(x-${p.t})`;
  throw new Error(`Unknown simplification family ${data.family}`);
}

function roundGeometry(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function independentlyDeriveGeometry(data) {
  const p = data.parameters;
  let value;
  if (data.family === "right-triangle") {
    const radians = p.angleDegrees * Math.PI / 180;
    const hypotenuse = p.adjacent / Math.cos(radians);
    value = Math.sqrt(hypotenuse * hypotenuse - p.adjacent * p.adjacent);
  } else if (data.family === "non-right-triangle-area") {
    const radians = p.angleDegrees * Math.PI / 180;
    const thirdSide = Math.sqrt(p.sideA * p.sideA + p.sideB * p.sideB - 2 * p.sideA * p.sideB * Math.cos(radians));
    const semiperimeter = (p.sideA + p.sideB + thirdSide) / 2;
    value = Math.sqrt(semiperimeter * (semiperimeter - p.sideA) * (semiperimeter - p.sideB) * (semiperimeter - thirdSide));
  } else if (data.family === "parallel-transversal") {
    const fullFirstSide = p.ad + p.db;
    const fullSecondSide = p.ae * fullFirstSide / p.ad;
    value = fullSecondSide - p.ae;
  } else if (data.family === "composite-quadrilateral") {
    const leftRectangleWidth = p.outerWidth - p.cutWidth;
    value = leftRectangleWidth * p.outerHeight + p.cutWidth * (p.outerHeight - p.cutHeight);
  } else if (data.family === "symmetric-construction") {
    const semiperimeter = (2 * p.equalSide + p.base) / 2;
    const triangleArea = Math.sqrt(semiperimeter * (semiperimeter - p.equalSide) * (semiperimeter - p.equalSide) * (semiperimeter - p.base));
    value = 2 * triangleArea / p.base;
  } else throw new Error(`Unknown geometry family ${data.family}`);
  return value;
}

function swedishNumber(value) {
  return String(Number(value.toFixed(10))).replace(".", ",");
}

function fixedSwedish(value, decimals) {
  return Number(value).toFixed(decimals).replace(".", ",");
}

function seededRng(seed) {
  let value = seed >>> 0;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function memoryStore() {
  let history = { schemaVersion: 1, slots: {} };
  return {
    loadHistory() { return structuredClone(history); },
    saveHistory(next) { history = structuredClone(next); return { ok: true, persisted: true }; },
    saveActive() { return { ok: true, persisted: true }; }
  };
}

test("math has exactly 25 complete, stable and unique questions in every slot", () => {
  const first = loadSlots();
  const serialized = JSON.stringify(first);
  Object.values(first).flat().forEach((question) => delete require.cache[require.resolve(path.join(MATH_ROOT, `questions/slot-${question.slot}.js`))]);
  const second = loadSlots();
  const questions = Object.values(first).flat();

  assert.deepEqual(Object.values(first).map((slot) => slot.length), [25, 25, 25, 25, 25]);
  assert.equal(new Set(questions.map((question) => question.id)).size, 125);
  assert.equal(serialized, JSON.stringify(second), "fresh module loads must preserve every stable question");
  questions.forEach((question) => {
    assert.equal(question.points, 2, question.id);
    assert.equal(question.slot, Number(question.id.match(/math-s([1-5])-/)[1]), question.id);
    assert.ok(question.title.trim(), question.id);
    assert.ok(question.promptHtml.trim(), question.id);
    assert.ok(question.solutionHtml.length > 80, question.id);
    assert.ok(question.sourceData && typeof question.sourceData === "object", question.id);
    assert.ok(Array.isArray(question.fields) && question.fields.length > 0, question.id);
    assert.ok(Array.isArray(question.rubric) && question.rubric.length > 0, question.id);
    assert.equal(question.fields.reduce((sum, field) => sum + field.points, 0), 2, question.id);
    assert.equal(question.rubric.reduce((sum, item) => sum + item.points, 0), 2, question.id);
  });
});

test("every slot contains five authored families with five cases and a distinct exam skill", () => {
  const slots = loadSlots();
  Object.entries(slots).forEach(([slot, questions]) => {
    const counts = Object.fromEntries(SLOT_FAMILIES[slot].map((family) => [family, 0]));
    questions.forEach((question) => {
      assert.equal(question.sourceData.skill, SLOT_SKILLS[Number(slot) - 1], question.id);
      assert.ok(Object.hasOwn(counts, question.sourceData.family), question.id);
      counts[question.sourceData.family] += 1;
    });
    assert.deepEqual(Object.values(counts), [5, 5, 5, 5, 5], `slot ${slot}`);
  });
});

test("every canonical math answer receives full automatic credit", () => {
  const graders = { numeric: grading.gradeNumeric, "solution-set": grading.gradeSolutionSet, expression: grading.gradeExpression, "simplified-expression": grading.gradeSimplifiedExpression };
  allQuestions().forEach((question) => {
    question.fields.forEach((field) => {
      let raw;
      if (field.kind === "numeric") raw = `${String(field.expected).replace(".", ",")} ${field.targetUnit}`;
      else if (field.kind === "solution-set") raw = field.expected.length
        ? field.expected.map((value) => `x = ${String(value).replace(".", ",")}`).join("; ")
        : "ingen lösning";
      else raw = field.expected;
      const result = graders[field.kind](field, raw);
      assert.equal(result.status, "correct", question.id);
      assert.equal(result.earned, field.points, question.id);
    });
  });
});

test("every radical answer comes from squaring and survives domain and original-equation checks", () => {
  loadSlots()[1].forEach((question) => {
    const expected = question.fields[0].expected;
    const candidates = radicalSquaredCandidates(question.sourceData);
    assert.ok(candidates.length >= 1 && candidates.length <= 2, question.id);
    assertNumberSets(expected, solveRadical(question.sourceData), question.id);
    expected.forEach((root) => {
      const [left, right, inDomain] = radicalSides(question.sourceData, root);
      assert.equal(inDomain, true, question.id);
      assert.ok(close(left, right), question.id);
    });
    assert.match(question.solutionHtml, /Definitionsvillkor/);
    assert.match(question.solutionHtml, /Kvadrering/);
    assert.match(question.solutionHtml, /Prövning i ursprungsekvationen/);
  });
});

test("every absolute-value branch candidate is explicitly accepted or rejected after substitution", () => {
  loadSlots()[2].forEach((question) => {
    const candidates = absoluteBranchCandidates(question.sourceData);
    const expected = solveAbsolute(question.sourceData);
    assertNumberSets(question.fields[0].expected, solveAbsolute(question.sourceData), question.id);
    candidates.forEach((candidate) => {
      const [left, right] = absSides(question.sourceData, candidate);
      const accepted = Number.isFinite(left) && Number.isFinite(right) && close(left, right);
      const marker = `<var>x</var> = ${swedishNumber(candidate)}`;
      const start = question.solutionHtml.indexOf(marker);
      assert.notEqual(start, -1, `${question.id}: missing candidate ${candidate}`);
      const item = question.solutionHtml.slice(start, question.solutionHtml.indexOf("</li>", start));
      assert.match(item, accepted ? /godtas/i : /förkastas/i, `${question.id}: candidate ${candidate}`);
      assert.equal(expected.some((root) => close(root, candidate)), accepted, question.id);
    });
    assert.match(question.solutionHtml, /fall|gren|Prövning/i, question.id);
  });
  const rejectedRegression = loadSlots()[2].find((question) => question.id === "math-s2-abs-linear-04");
  assert.deepEqual(absoluteBranchCandidates(rejectedRegression.sourceData), [-5, -3]);
  assert.match(rejectedRegression.solutionHtml, /<var>x<\/var> = -5[^<]*(?:<[^>]+>[^<]*)*förkastas/i);
});

test("every rational simplification preserves values and all original exclusions", () => {
  loadSlots()[3].forEach((question) => {
    const data = question.sourceData;
    const [expressionField, exclusionsField] = question.fields;
    assert.equal(question.fields.length, 2, question.id);
    assert.deepEqual(question.fields.map((field) => [field.id, field.kind, field.points]), [
      ["expression", "simplified-expression", 1], ["exclusions", "solution-set", 1]
    ], question.id);
    assert.deepEqual(expressionField.exclude.slice().sort((a, b) => a - b), data.exclusions.slice().sort((a, b) => a - b), question.id);
    assertNumberSets(exclusionsField.expected, data.exclusions, question.id);
    assert.match(exclusionsField.help, /semikolon/i, question.id);
    const expressionOnly = grading.gradeSimplifiedExpression(expressionField, expressionField.expected);
    const omittedExclusions = grading.gradeSolutionSet(exclusionsField, "");
    assert.equal(expressionOnly.earned + omittedExclusions.earned, 1, `${question.id}: expression alone must not earn full credit`);
    const independentlySimplified = expectedSlotThree(data);
    let matches = 0;
    [-13, -8, -4, -1, 0, 2, 5, 9, 14].forEach((x) => {
      if (data.exclusions.includes(x)) return;
      const original = parsedValue(data.originalExpression, x);
      const recomputed = parsedValue(independentlySimplified, x);
      const actual = parsedValue(expressionField.expected, x);
      assert.equal(original.ok, recomputed.ok, `${question.id} at x=${x}`);
      assert.equal(actual.ok, recomputed.ok, `${question.id} at x=${x}`);
      if (original.ok) {
        assert.ok(close(original.value, recomputed.value), `${question.id} at x=${x}`);
        assert.ok(close(actual.value, recomputed.value), `${question.id} at x=${x}`);
        matches += 1;
      }
    });
    assert.ok(matches >= 6, question.id);
    data.exclusions.forEach((x) => assert.equal(parsedValue(data.originalExpression, x).ok, false, `${question.id} exclusion ${x}`));
  });
});

test("all real simplification fields reject their unchanged source expression", () => {
  loadSlots()[3].forEach((question) => {
    const field = question.fields[0];
    const unchanged = grading.gradeSimplifiedExpression(field, question.sourceData.originalExpression);

    assert.equal(field.kind, "simplified-expression", question.id);
    assert.equal(unchanged.status, "incorrect", `${question.id}: unchanged source must not count as fully simplified`);
    assert.equal(unchanged.earned, 0, question.id);
  });

  const signField = loadSlots()[3].find((question) => question.id === "math-s3-factor-cancellation-01").fields[0];
  assert.equal(grading.gradeSimplifiedExpression(signField, "(5-x)/(7-x)").status, "correct");
  ["0.5*(x-5)/(0.5*(x-7))", "1.25*(x-5)/(1.25*(x-7))"].forEach((raw) => {
    assert.equal(grading.gradeSimplifiedExpression(signField, raw).status, "incorrect", raw);
  });
});

test("every rational or polynomial root is independently recovered and valid in the original equation", () => {
  loadSlots()[4].forEach((question) => {
    const expected = question.fields[0].expected;
    assertNumberSets(expected, solveSlotFour(question.sourceData), question.id);
    expected.forEach((root) => assert.equal((question.sourceData.exclusions || []).some((excluded) => close(root, excluded)), false, question.id));
    (question.sourceData.exclusions || []).forEach((excluded) => assert.equal(expected.some((root) => close(root, excluded)), false, question.id));
    assert.match(question.solutionHtml, /generell|nollprodukt|substitution|definitionsmängd/i, question.id);
  });
  assert.ok(loadSlots()[4].some((question) => question.sourceData.rejectedCandidates.length > 0), "the bank must exercise excluded candidate rejection");
});

test("geometry answers match independent constructions and every schematic SVG is accessible", () => {
  const fixtures = {
    "math-s5-right-triangle-01": 4.8,
    "math-s5-non-right-triangle-area-01": 23,
    "math-s5-parallel-transversal-02": 10.8,
    "math-s5-composite-quadrilateral-01": 46.7,
    "math-s5-symmetric-construction-04": 7.4
  };
  loadSlots()[5].forEach((question) => {
    const data = question.sourceData;
    const independentlyRounded = roundGeometry(independentlyDeriveGeometry(data), data.decimals);
    assert.equal(question.fields[0].expected, independentlyRounded, question.id);
    if (Object.hasOwn(fixtures, question.id)) assert.equal(question.fields[0].expected, fixtures[question.id], question.id);
    assert.equal(question.fields[0].targetUnit, data.unit, question.id);
    assert.match(question.promptHtml, /Avrunda svaret till/);
    assert.match(question.promptHtml, new RegExp(data.unit.replace("²", "\\²")));
    assert.match(question.promptHtml, /<svg\b[^>]*role="img"[^>]*aria-labelledby="[^"]+"/);
    assert.match(question.promptHtml, /<title\s+id="[^"]+">[^<]+<\/title>/);
    assert.match(question.promptHtml, /<desc\s+id="[^"]+">[^<]+<\/desc>/);
    assert.match(question.promptHtml, /inte skalenlig/i);
    assert.match(question.solutionHtml, /Samband:/);
  });
});

test("geometry solutions retain every requested trailing decimal", () => {
  loadSlots()[5].forEach((question) => {
    const data = question.sourceData;
    const finalAnswer = fixedSwedish(question.fields[0].expected, data.decimals) + " " + data.unit;
    assert.match(question.solutionHtml, new RegExp(`Efter avrundning[\\s\\S]*<strong>${finalAnswer.replace("²", "\\²")}<\\/strong>`), question.id);
  });
  const byId = Object.fromEntries(loadSlots()[5].map((question) => [question.id, question]));
  assert.match(byId["math-s5-non-right-triangle-area-01"].solutionHtml, /<strong>23,0 m²<\/strong>/);
  assert.match(byId["math-s5-parallel-transversal-02"].solutionHtml, /<strong>10,80 m<\/strong>/);
  assert.match(byId["math-s5-symmetric-construction-04"].solutionHtml, /<strong>7,40 cm<\/strong>/);
});

test("subject assembly works in CommonJS and through ordered classic browser scripts", () => {
  const subjectData = loadSubjectDataFresh();
  assert.equal(subjectData.config.id, "math-ks2");
  assert.deepEqual(Object.keys(subjectData.slots), ["1", "2", "3", "4", "5"]);

  const context = vm.createContext({ window: {} });
  [
    "../assets/js/subject-config.js",
    "questions/slot-1.js", "questions/slot-2.js", "questions/slot-3.js", "questions/slot-4.js", "questions/slot-5.js", "questions.js"
  ].forEach((relative) => {
    const filename = path.resolve(MATH_ROOT, relative);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  });
  assert.equal(context.window.KS_SUBJECT_DATA.config.id, "math-ks2");
  assert.deepEqual(Array.from(Object.values(context.window.KS_SUBJECT_DATA.slots), (slot) => slot.length), [25, 25, 25, 25, 25]);
});

test("the math page loads all slot scripts and assembly immediately before the app", () => {
  const html = fs.readFileSync(path.join(MATH_ROOT, "index.html"), "utf8");
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g), (match) => match[1]);
  assert.deepEqual(scripts.slice(-7), [
    "questions/slot-1.js", "questions/slot-2.js", "questions/slot-3.js", "questions/slot-4.js", "questions/slot-5.js", "questions.js", "../assets/js/app.js"
  ]);
});

test("1,000 real-engine exams always contain five distinct skills, ten points and 25-exam slot cycles", () => {
  const subjectData = loadSubjectDataFresh();
  const store = memoryStore();
  const rng = seededRng(20260911);
  const byId = Object.fromEntries(Object.values(subjectData.slots).flat().map((question) => [question.id, question]));
  const seenBySlot = Object.fromEntries([1, 2, 3, 4, 5].map((slot) => [slot, []]));

  for (let index = 0; index < 1000; index += 1) {
    const snapshot = exam.createSession(subjectData.config, subjectData.slots, store, rng).snapshot();
    const questions = snapshot.questionIds.map((id) => byId[id]);
    assert.equal(questions.length, 5, `exam ${index + 1}`);
    assert.equal(questions.reduce((sum, question) => sum + question.points, 0), 10, `exam ${index + 1}`);
    assert.equal(new Set(questions.map((question) => question.sourceData.skill)).size, 5, `exam ${index + 1}`);
    questions.forEach((question) => seenBySlot[question.slot].push(question.id));
  }

  Object.entries(seenBySlot).forEach(([slot, ids]) => {
    for (let start = 0; start < ids.length; start += 25) {
      assert.equal(new Set(ids.slice(start, start + 25)).size, 25, `slot ${slot}, cycle ${start / 25 + 1}`);
      if (start > 0) assert.notEqual(ids[start], ids[start - 1], `slot ${slot}, refill boundary ${start}`);
    }
  });
});
