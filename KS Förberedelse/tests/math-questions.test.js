const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const exam = require("../assets/js/exam-engine.js");
const expression = require("../assets/js/expression-parser.js");
const grading = require("../assets/js/grading.js");
const diagramKit = require("../assets/js/diagram-kit.js");

const MATH_ROOT = path.join(__dirname, "../Matematik KS2");
const SLOT_FAMILIES = {
  1: ["sqrt-equals-linear", "linear-plus-sqrt", "scaled-sqrt-plus-linear", "sqrt-minus-constant", "sqrt-equals-scaled-linear"],
  2: ["abs-linear", "abs-constant", "scaled-shifted-abs", "abs-equals-abs", "contextual-distance"],
  3: ["factor-cancellation", "difference-of-squares", "complex-fraction", "unlike-denominators", "sign-handling"],
  4: ["rational-one-exclusion", "rational-two-exclusions", "biquadratic", "factorable-cubic", "quadratic-substitution"],
  5: ["right-triangle", "non-right-triangle-area", "parallel-transversal", "composite-quadrilateral", "symmetric-construction"]
};
const SLOT_SKILLS = ["radical-equations", "absolute-value-equations", "rational-simplification", "rational-polynomial-equations", "geometry"];
const NOTEBOOK_REQUIREMENTS = {
  1: {
    "sqrt-equals-linear": [/definitionsvillkor/i, /kvadrering/i, /pröv/i],
    "linear-plus-sqrt": [/isol/i, /kvadrering/i, /pröv/i],
    "scaled-sqrt-plus-linear": [/skalfaktor|koefficient/i, /kvadrering/i, /pröv/i],
    "sqrt-minus-constant": [/konstant/i, /kvadrering/i, /pröv/i],
    "sqrt-equals-scaled-linear": [/skalfaktor|tecken/i, /kvadrering/i, /pröv/i]
  },
  2: {
    "abs-linear": [/båda.*absolutbeloppsgrenarna/i, /substitution/i],
    "abs-constant": [/båda.*fall/i, /substitution/i],
    "scaled-shifted-abs": [/isolera/i, /båda.*grenarna/i, /substitution/i],
    "abs-equals-abs": [/plus- och minusfall/i, /substitution/i],
    "contextual-distance": [/två riktning|två grenar/i, /substitution/i]
  },
  3: {
    "factor-cancellation": [/faktoris/i, /förkort/i, /ursprungliga.*definitions/i],
    "difference-of-squares": [/konjugatregeln/i, /förkort/i, /ursprungliga.*definitions/i],
    "complex-fraction": [/gemensam nämnare/i, /faktoris/i, /ursprungliga.*definitions/i],
    "unlike-denominators": [/liknämn/i, /faktoris/i, /ursprungliga.*definitions/i],
    "sign-handling": [/minusteck/i, /förkort/i, /ursprungliga.*definitions/i]
  },
  4: {
    "rational-one-exclusion": [/definitionsvillkor/i, /multiplicera/i, /validera|insättning/i],
    "rational-two-exclusions": [/nämnarvillkor/i, /faktoris/i, /kontroll/i],
    "biquadratic": [/substitution/i, /y = x²/i, /validera/i],
    "factorable-cubic": [/rot/i, /faktoris/i, /validera/i],
    "quadratic-substitution": [/substitution/i, /andragradsekvation/i, /validera/i]
  },
  5: {
    "right-triangle": [/trigonometriska.*samband/i, /märkt skiss/i, /beräkning/i],
    "non-right-triangle-area": [/areasamband/i, /märkt skiss/i, /beräkning/i],
    "parallel-transversal": [/likformighets.*proportionalitet/i, /märkt skiss/i, /beräkning/i],
    "composite-quadrilateral": [/märkt skiss/i, /area.samband/i, /beräkning/i],
    "symmetric-construction": [/märkt skiss/i, /pythagoras samband/i, /beräkning/i]
  }
};

function loadSlots() {
  return Object.fromEntries([1, 2, 3, 4, 5].map((slot) => [slot, require(path.join(MATH_ROOT, `questions/slot-${slot}.js`))]));
}

function loadSubjectDataFresh() {
  const assembly = path.join(MATH_ROOT, "questions.js");
  delete require.cache[require.resolve(assembly)];
  return require(path.join(MATH_ROOT, "questions.js"));
}

function allQuestions() {
  return Object.values(loadSlots()).flat();
}

function visiblePromptText(html) {
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asksForComputerDerivation(html) {
  const text = visiblePromptText(html);
  const derivationTerms = "(?:metod|beräkning|uträkning|mellanled|steg|resonemang|förklaring|bevis|härledning|lösningsgång|tankegång|argument)[a-zåäö]*";
  return new RegExp(`\\b(?:redovisa|redogör|beskriv|skriv|ange|visa)\\b[^.?!]{0,120}\\b${derivationTerms}\\b`, "i").test(text) ||
    /\b(?:bevisa|förklara|motivera)\b/i.test(text) ||
    /\bvisa\s+(?:hur|varför)\b/i.test(text) ||
    /\bskriv\b[^.?!]{0,80}\b(?:hur|varför)\s+(?:du|ni|man)\b/i.test(text);
}

function close(left, right, tolerance = 1e-8) {
  return Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));
}

function assertPointClose(actual, expected, message) {
  assert.equal(actual.length, 2, message);
  actual.forEach((value, index) => assert.ok(close(value, expected[index]), `${message}: ${actual} != ${expected}`));
}

function subtractPoints(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function crossVectors(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function dotVectors(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function normalizeVector(value) {
  const magnitude = Math.hypot(value[0], value[1]);
  assert.ok(magnitude > 0, `cannot normalize ${value}`);
  return [value[0] / magnitude, value[1] / magnitude];
}

function unorderedVectorsMatch(actual, expected) {
  return expected.every((wanted) => actual.some((candidate) => close(candidate[0], wanted[0]) && close(candidate[1], wanted[1])));
}

function parseTagAttributes(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<(?:line|circle|rect|polygon|polyline|path|text)\\b[^>]*\\bid="${escapedId}"[^>]*>`, "u"));
  assert.ok(match, `missing serialized tag ${id}`);
  return Object.fromEntries(Array.from(match[0].matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/gu), (entry) => [entry[1], entry[2]]));
}

function strokedSegmentBox(a, b, strokeWidth) {
  const half = strokeWidth / 2;
  return {
    x: Math.min(a[0], b[0]) - half,
    y: Math.min(a[1], b[1]) - half,
    width: Math.abs(a[0] - b[0]) + strokeWidth,
    height: Math.abs(a[1] - b[1]) + strokeWidth
  };
}

function arcBoxesFromSerializedPath(attributes, element) {
  const tokens = attributes.d.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu) || [];
  assert.deepEqual(tokens.filter((token) => /^[A-Za-z]$/u.test(token)), ["M", "A"], element.id);
  const values = tokens.filter((token) => !/^[A-Za-z]$/u.test(token)).map(Number);
  const start = values.slice(0, 2);
  const radiusX = values[2]; const radiusY = values[3]; const rotation = values[4];
  const largeArc = values[5]; const svgSweep = values[6]; const end = values.slice(7, 9);
  assert.ok(close(radiusX, radiusY) && close(radiusX, element.radius), element.id);
  assert.equal(rotation, 0, element.id);
  assert.equal(largeArc, 0, element.id);
  assert.equal(svgSweep, element.sweep === 1 ? 1 : 0, element.id);
  const center = element.vertex;
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]);
  const normalizeAngle = (angle) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const delta = element.sweep === 1 ? normalizeAngle(endAngle - startAngle) : normalizeAngle(startAngle - endAngle);
  const points = [start, end];
  [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach((angle) => {
    const travel = element.sweep === 1 ? normalizeAngle(angle - startAngle) : normalizeAngle(startAngle - angle);
    if (travel <= delta + 1e-12) points.push([center[0] + radiusX * Math.cos(angle), center[1] + radiusY * Math.sin(angle)]);
  });
  const half = Number(attributes["stroke-width"]) / 2;
  const xs = points.map((point) => point[0]); const ys = points.map((point) => point[1]);
  return [{ x: Math.min(...xs) - half, y: Math.min(...ys) - half, width: Math.max(...xs) - Math.min(...xs) + 2 * half, height: Math.max(...ys) - Math.min(...ys) + 2 * half }];
}

function linearPathBoxes(attributes) {
  const tokens = attributes.d.match(/[ML]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu) || [];
  const strokeWidth = Number(attributes["stroke-width"]);
  const boxes = []; let command; let current;
  for (let index = 0; index < tokens.length;) {
    if (/^[ML]$/u.test(tokens[index])) command = tokens[index++];
    const next = [Number(tokens[index++]), Number(tokens[index++])];
    if (command === "L") boxes.push(strokedSegmentBox(current, next, strokeWidth));
    current = next;
  }
  return boxes;
}

function serializedCollisionBoxes(question, element) {
  const attributes = parseTagAttributes(question.promptHtml, element.id);
  const strokeWidth = Number(attributes["stroke-width"] || 0);
  if (element.kind === "line") return [strokedSegmentBox([Number(attributes.x1), Number(attributes.y1)], [Number(attributes.x2), Number(attributes.y2)], strokeWidth)];
  if (element.kind === "circle") {
    const radius = Number(attributes.r); const half = strokeWidth / 2;
    return [{ x: Number(attributes.cx) - radius - half, y: Number(attributes.cy) - radius - half, width: 2 * radius + strokeWidth, height: 2 * radius + strokeWidth }];
  }
  if (element.kind === "polygon" || element.kind === "polyline") {
    const points = attributes.points.trim().split(/\s+/u).map((pair) => pair.split(",").map(Number));
    const limit = element.kind === "polygon" ? points.length : points.length - 1;
    return Array.from({ length: limit }, (_, index) => strokedSegmentBox(points[index], points[(index + 1) % points.length], strokeWidth));
  }
  if (element.kind === "dimension") return linearPathBoxes(attributes);
  if (element.kind === "angleArc") return arcBoxesFromSerializedPath(attributes, element);
  assert.fail(`unsupported serialized collision geometry ${element.kind} for ${element.id}`);
}

function serializedLabelBox(question, label) {
  const background = question.sourceData.diagram.backgrounds.find((item) => item.labelId === label.id);
  assert.ok(background, `${label.id}: missing opaque serialized background`);
  const backgroundAttributes = parseTagAttributes(question.promptHtml, background.id);
  const textAttributes = parseTagAttributes(question.promptHtml, label.id);
  const fontSize = Number(textAttributes["font-size"]);
  const textWidth = Math.max(1, label.text.length * fontSize * 0.58);
  const textX = Number(textAttributes.x); const textY = Number(textAttributes.y); const textAnchor = textAttributes["text-anchor"];
  const computedX = textAnchor === "middle" ? textX - textWidth / 2 : textAnchor === "end" ? textX - textWidth : textX;
  const computed = { x: computedX - 2, y: textY - fontSize - 2, width: textWidth + 4, height: fontSize * 1.25 + 4 };
  const serialized = { x: Number(backgroundAttributes.x), y: Number(backgroundAttributes.y), width: Number(backgroundAttributes.width), height: Number(backgroundAttributes.height) };
  Object.keys(computed).forEach((key) => assert.ok(close(computed[key], serialized[key]), `${label.id}: serialized background ${key}`));
  return serialized;
}

function boxesOverlap(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function expandedBox(box, clearance) {
  return { x: box.x - clearance, y: box.y - clearance, width: box.width + 2 * clearance, height: box.height + 2 * clearance };
}

function unionBoxes(boxes) {
  const minX = Math.min(...boxes.map((box) => box.x)); const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width)); const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function diagramElement(question, suffix) {
  const id = `${question.id}-${suffix}`;
  const found = question.sourceData.diagram.elements.find((element) => element.id === id);
  assert.ok(found, `${question.id}: missing semantic diagram element ${id}`);
  return found;
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
  const questions = Object.values(first).flat();

  const freshProcessSource = `const path = require("node:path"); const root = ${JSON.stringify(MATH_ROOT)}; const slots = Object.fromEntries([1,2,3,4,5].map((slot) => [slot, require(path.join(root, "questions/slot-" + slot + ".js"))])); process.stdout.write(JSON.stringify(slots));`;
  const freshSerialized = childProcess.execFileSync(process.execPath, ["-e", freshProcessSource], { encoding: "utf8" });

  assert.deepEqual(Object.values(first).map((slot) => slot.length), [25, 25, 25, 25, 25]);
  assert.equal(new Set(questions.map((question) => question.id)).size, 125);
  assert.equal(serialized, freshSerialized, "fresh module loads must preserve every stable question");
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

test("every math question directs method work to the notebook and accepts only final answers digitally", () => {
  allQuestions().forEach((question) => {
    assert.ok(question.workOnPaper && typeof question.workOnPaper === "object", question.id);
    assert.deepEqual(Object.keys(question.workOnPaper).sort(), ["comparison", "instruction", "title"], question.id);
    ["title", "instruction", "comparison"].forEach((key) => {
      assert.equal(typeof question.workOnPaper[key], "string", `${question.id}: ${key}`);
      assert.ok(question.workOnPaper[key].trim(), `${question.id}: ${key}`);
    });
    assert.match(question.workOnPaper.instruction, /Här skriver du endast slutsvaret/i, question.id);
    const requirements = NOTEBOOK_REQUIREMENTS[question.slot][question.sourceData.family];
    assert.ok(requirements, `${question.id}: missing family audit requirements`);
    const notebookText = `${question.workOnPaper.instruction} ${question.workOnPaper.comparison}`;
    requirements.forEach((requirement) => assert.match(notebookText, requirement, `${question.id}: missing family-specific notebook concept`));
    question.fields.forEach((field) => {
      assert.notEqual(field.kind, "self", question.id);
      assert.notEqual(field.kind, "multiline", question.id);
    });
    assert.equal(asksForComputerDerivation(question.promptHtml), false, question.id);
    assert.equal(question.fields.reduce((sum, field) => sum + field.points, 0), question.points, question.id);
  });
});

test("math prompt audit catches derivation requests when HTML wraps the forbidden terms", () => {
  const examples = [
    ["<p>Redovisa en generell <strong>metod</strong> och visa din <em>beräkning</em>.</p>", true],
    ["<p>Förklara <span>hur</span> du fick fram svaret.</p>", true],
    ["<p>Redogör för ditt <strong>resonemang</strong>.</p>", true],
    ["<p>Beskriv <em>metoden</em> du använde.</p>", true],
    ["<p>Skriv <strong>hur</strong> du fick fram svaret.</p>", true],
    ["<p>Bestäm alla reella <strong>lösningar</strong>.</p>", false],
    ["<p>Visa figuren och bestäm vinkeln.</p>", false],
    ["<p>Skriv endast slutsvaret.</p>", false],
    ["<p>Ange svaret med rätt enhet.</p>", false]
  ];
  examples.forEach(([html, expected]) => assert.equal(asksForComputerDerivation(html), expected, html));
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

test("slot-five geometry metadata remains byte-for-byte preserved outside the rebuilt diagram", () => {
  const projection = loadSlots()[5].map(({ id, points, workOnPaper, fields, solutionHtml, rubric, sourceData }) => {
    const stableSourceData = Object.fromEntries(Object.entries(sourceData).filter(([key]) => key !== "diagram"));
    return { id, points, workOnPaper, fields, solutionHtml, rubric, sourceData: stableSourceData };
  });
  const hash = crypto.createHash("sha256").update(JSON.stringify(projection)).digest("hex");
  assert.equal(hash, "1a4b7fb1f0430843f4b7445c967876124379d8cdfc21cfac784fe7c5cdfd7cc6");
});

test("serialized slot-five label backgrounds clear labels, declared avoid geometry, and the viewBox", () => {
  const failures = [];
  loadSlots()[5].forEach((question) => {
    const manifest = question.sourceData.diagram;
    manifest.elements.filter((element) => !["label", "rect"].includes(element.kind)).forEach((element) => {
      const computed = unionBoxes(serializedCollisionBoxes(question, element));
      Object.keys(computed).forEach((key) => assert.ok(close(computed[key], element.bbox[key]), `${element.id}: independent serialized ${key} bbox`));
    });
    const labelledBoxes = manifest.labels.map((label) => ({ label, box: serializedLabelBox(question, label) }));
    labelledBoxes.forEach(({ label, box }, index) => {
      if (!(box.x >= 0 && box.y >= 0 && box.x + box.width <= manifest.width && box.y + box.height <= manifest.height)) failures.push(`${label.id}: background overflows viewBox`);
      labelledBoxes.slice(index + 1).forEach(({ label: other, box: otherBox }) => {
        if (boxesOverlap(box, otherBox)) failures.push(`${question.id}: ${label.id} overlaps ${other.id}`);
      });
      label.avoid.forEach((avoidId) => {
        if (avoidId === label.anchorId) return;
        const target = manifest.elements.find((element) => element.id === avoidId);
        assert.ok(target, `${label.id}: missing avoid target ${avoidId}`);
        serializedCollisionBoxes(question, target).forEach((targetBox, segmentIndex) => {
          if (boxesOverlap(box, expandedBox(targetBox, label.minClearance))) failures.push(`${question.id}: ${label.id} violates ${label.minClearance}px clearance from ${avoidId} segment ${segmentIndex}`);
        });
      });
    });
  });
  assert.deepEqual(failures, []);
});

test("all 25 slot-five diagrams expose independent semantic family invariants", () => {
  const questions = loadSlots()[5];
  const allDomIds = [];
  questions.forEach((question) => {
    const manifest = question.sourceData.diagram;
    const p = question.sourceData.parameters;
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    assert.equal(manifest.purpose, "prompt", question.id);
    assert.equal(manifest.id, `${question.id}-diagram`, question.id);
    assert.equal(manifest.titleId, `${question.id}-diagram-title`, question.id);
    assert.equal(manifest.descriptionId, `${question.id}-diagram-desc`, question.id);
    allDomIds.push(...manifest.domIds);

    const outline = diagramElement(question, "outline");
    const labels = manifest.labels;
    assert.ok(labels.length >= 3, `${question.id}: expected family labels`);
    labels.forEach((label) => {
      assert.ok(manifest.elements.some((element) => element.id === label.anchorId && element.collision), `${question.id}: label owner ${label.anchorId}`);
      assert.ok(label.avoid.length >= 2, `${question.id}: ${label.id} needs meaningful reserved geometry`);
      assert.ok(label.avoid.includes(outline.id), `${question.id}: ${label.id} must reserve the outline`);
      assert.ok(label.minClearance >= 6, `${question.id}: ${label.id} clearance`);
    });

    if (question.sourceData.family === "right-triangle") {
      const [rightVertex, angleVertex, apex] = outline.points;
      assert.ok(Math.abs(dotVectors(subtractPoints(angleVertex, rightVertex), subtractPoints(apex, rightVertex))) <= 1e-8, question.id);
      const marker = diagramElement(question, "right-marker");
      const firstOffset = subtractPoints(marker.points[0], rightVertex);
      const middleOffset = subtractPoints(marker.points[1], rightVertex);
      const lastOffset = subtractPoints(marker.points[2], rightVertex);
      const rightRays = [normalizeVector(subtractPoints(apex, rightVertex)), normalizeVector(subtractPoints(angleVertex, rightVertex))];
      assert.ok(unorderedVectorsMatch([normalizeVector(firstOffset), normalizeVector(lastOffset)], rightRays), `${question.id}: marker endpoints must lie on perpendicular rays`);
      assert.ok(close(Math.hypot(...firstOffset), Math.hypot(...lastOffset)) && Math.hypot(...firstOffset) > 0, `${question.id}: square marker offsets`);
      assertPointClose(middleOffset, [firstOffset[0] + lastOffset[0], firstOffset[1] + lastOffset[1]], `${question.id}: square marker corner`);
      const markerEdgeOne = subtractPoints(marker.points[1], marker.points[0]);
      const markerEdgeTwo = subtractPoints(marker.points[2], marker.points[1]);
      assert.ok(close(dotVectors(markerEdgeOne, markerEdgeTwo), 0), `${question.id}: square marker edges perpendicular`);
      assert.ok(close(Math.hypot(...markerEdgeOne), Math.hypot(...markerEdgeTwo)), `${question.id}: square marker edges equal`);
      const givenAngle = diagramElement(question, "given-angle");
      assertPointClose(givenAngle.vertex, angleVertex, `${question.id}: requested angle vertex`);
      const expectedAngleRays = [normalizeVector(subtractPoints(rightVertex, angleVertex)), normalizeVector(subtractPoints(apex, angleVertex))];
      assert.ok(unorderedVectorsMatch([givenAngle.fromRay, givenAngle.toRay], expectedAngleRays), `${question.id}: requested angle rays must match outline sides`);
      assert.ok(close(Math.acos(dotVectors(givenAngle.fromRay, givenAngle.toRay)) * 180 / Math.PI, p.angleDegrees), question.id);
      const adjacent = diagramElement(question, "adjacent-dimension");
      assertPointClose(adjacent.a, rightVertex, `${question.id}: adjacent dimension start`);
      assertPointClose(adjacent.b, angleVertex, `${question.id}: adjacent dimension end`);
    } else if (question.sourceData.family === "non-right-triangle-area") {
      const [vertex, sideAEnd, sideBEnd] = outline.points;
      const sideA = diagramElement(question, "side-a-dimension");
      const sideB = diagramElement(question, "side-b-dimension");
      assertPointClose(sideA.a, vertex, `${question.id}: side a starts at included angle`);
      assertPointClose(sideA.b, sideAEnd, `${question.id}: side a endpoint`);
      assertPointClose(sideB.a, vertex, `${question.id}: side b starts at included angle`);
      assertPointClose(sideB.b, sideBEnd, `${question.id}: side b endpoint`);
      const angle = diagramElement(question, "included-angle");
      assertPointClose(angle.vertex, vertex, `${question.id}: included angle vertex`);
      const expectedAngleRays = [normalizeVector(subtractPoints(sideA.b, vertex)), normalizeVector(subtractPoints(sideB.b, vertex))];
      assert.ok(unorderedVectorsMatch([angle.fromRay, angle.toRay], expectedAngleRays), `${question.id}: included angle rays must match dimensioned sides`);
      assert.ok(close(Math.acos(dotVectors(angle.fromRay, angle.toRay)) * 180 / Math.PI, p.angleDegrees), question.id);
    } else if (question.sourceData.family === "parallel-transversal") {
      const [a, b, c] = outline.points;
      const transversal = diagramElement(question, "transversal");
      const d = transversal.from; const e = transversal.to;
      assert.ok(Math.abs(crossVectors(subtractPoints(d, a), subtractPoints(b, a))) <= 1e-8, `${question.id}: D on AB`);
      assert.ok(Math.abs(crossVectors(subtractPoints(e, a), subtractPoints(c, a))) <= 1e-8, `${question.id}: E on AC`);
      assert.ok(dotVectors(subtractPoints(d, a), subtractPoints(d, b)) <= 1e-8, `${question.id}: D within AB`);
      assert.ok(dotVectors(subtractPoints(e, a), subtractPoints(e, c)) <= 1e-8, `${question.id}: E within AC`);
      assert.ok(Math.abs(crossVectors(subtractPoints(e, d), subtractPoints(c, b))) <= 1e-8, `${question.id}: DE parallel BC`);
    } else if (question.sourceData.family === "composite-quadrilateral") {
      const cutTopLeft = outline.points[1];
      const cutBottomLeft = outline.points[2];
      const cutBottomRight = outline.points[3];
      const removedTopRight = [cutBottomRight[0], cutTopLeft[1]];
      const cutWidth = diagramElement(question, "cut-width-dimension");
      const cutHeight = diagramElement(question, "cut-height-dimension");
      assertPointClose(cutWidth.a, cutTopLeft, `${question.id}: cut width begins on removed rectangle`);
      assertPointClose(cutWidth.b, removedTopRight, `${question.id}: cut width ends on removed rectangle`);
      assertPointClose(cutHeight.a, removedTopRight, `${question.id}: cut height begins on removed rectangle`);
      assertPointClose(cutHeight.b, cutBottomRight, `${question.id}: cut height ends on removed rectangle`);
      assert.ok(close(Math.abs(cutBottomLeft[1] - cutTopLeft[1]) / Math.abs(cutBottomRight[0] - cutBottomLeft[0]), p.cutHeight / p.cutWidth), question.id);
    } else {
      const [apex, baseLeft, baseRight] = outline.points;
      const height = diagramElement(question, "height");
      const midpoint = [(baseLeft[0] + baseRight[0]) / 2, (baseLeft[1] + baseRight[1]) / 2];
      assertPointClose(height.from, apex, `${question.id}: height starts at apex`);
      assertPointClose(height.to, midpoint, `${question.id}: height reaches base midpoint`);
      assert.ok(Math.abs(dotVectors(subtractPoints(height.to, height.from), subtractPoints(baseRight, baseLeft))) <= 1e-8, `${question.id}: height perpendicular to base`);
      const marker = diagramElement(question, "right-marker");
      const firstOffset = subtractPoints(marker.points[0], midpoint);
      const middleOffset = subtractPoints(marker.points[1], midpoint);
      const lastOffset = subtractPoints(marker.points[2], midpoint);
      const midpointRays = [normalizeVector(subtractPoints(apex, midpoint)), normalizeVector(subtractPoints(baseRight, midpoint))];
      assert.ok(unorderedVectorsMatch([normalizeVector(firstOffset), normalizeVector(lastOffset)], midpointRays), `${question.id}: midpoint marker endpoints`);
      assert.ok(close(Math.hypot(...firstOffset), Math.hypot(...lastOffset)) && Math.hypot(...firstOffset) > 0, `${question.id}: midpoint square offsets`);
      assertPointClose(middleOffset, [firstOffset[0] + lastOffset[0], firstOffset[1] + lastOffset[1]], `${question.id}: midpoint square corner`);
      const markerEdgeOne = subtractPoints(marker.points[1], marker.points[0]);
      const markerEdgeTwo = subtractPoints(marker.points[2], marker.points[1]);
      assert.ok(close(dotVectors(markerEdgeOne, markerEdgeTwo), 0), `${question.id}: midpoint marker edges perpendicular`);
      assert.ok(close(Math.hypot(...markerEdgeOne), Math.hypot(...markerEdgeTwo)), `${question.id}: midpoint marker edges equal`);
    }
  });
  assert.equal(new Set(allDomIds).size, allDomIds.length, "all SVG, title, description, element and fragment IDs must be unique");
});

test("slot five fails loudly when the diagram kit is absent in either module environment", () => {
  const source = fs.readFileSync(path.join(MATH_ROOT, "questions/slot-5.js"), "utf8");
  assert.throws(() => vm.runInNewContext(source, { window: {} }), /diagram.?kit|diagram dependency/i);
  assert.throws(() => vm.runInNewContext(source, { module: { exports: {} }, require() { return undefined; } }), /diagram.?kit|diagram dependency/i);
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
    "../assets/js/diagram-kit.js",
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
