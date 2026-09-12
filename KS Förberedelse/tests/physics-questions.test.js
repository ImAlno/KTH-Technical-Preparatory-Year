const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const exam = require("../assets/js/exam-engine.js");
const grading = require("../assets/js/grading.js");
const units = require("../assets/js/units.js");
const diagramKit = require("../assets/js/diagram-kit.js");

const PHYSICS_ROOT = path.join(__dirname, "../Fysik KS1");
const G = 9.82;
const SLOT_SKILLS = [
  "graphs-and-contact-equilibrium",
  "density-and-geometric-bodies",
  "vertical-motion",
  "vector-equilibrium",
  "newton-and-friction"
];
const SLOT_FAMILIES = {
  3: ["time-to-apex", "maximum-height", "initial-speed", "impact-speed", "flight-time"],
  4: ["hanging-masses", "cables-at-angles", "missing-fourth-force", "supported-beams", "frictionless-wall-contact"],
  5: ["horizontal-pull", "inclined-plane", "connected-masses", "unknown-pull", "unknown-friction"]
};

function loadSlots() {
  return Object.fromEntries([1, 2, 3, 4, 5].map((slot) => [slot, require(path.join(PHYSICS_ROOT, `questions/slot-${slot}.js`))]));
}

function allPhysicsQuestions() {
  return Object.values(loadSlots()).flat();
}

function loadSubjectDataFresh() {
  const assembly = path.join(PHYSICS_ROOT, "questions.js");
  delete require.cache[require.resolve(assembly)];
  return require(assembly);
}

function close(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected));
}

function roundSignificant(value, figures) {
  if (value === 0) return 0;
  const power = figures - 1 - Math.floor(Math.log10(Math.abs(value)));
  const scale = 10 ** power;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function canonicalUnitForUnknown(unknown) {
  return { mass: "kg", density: "kg/m3", radius: "m", diameter: "m", height: "m", volume: "m3" }[unknown];
}

function derivedGraphAnswer(data) {
  const points = data.points;
  if (data.graphTask === "slope" || data.graphTask === "acceleration") {
    const left = points[data.segmentIndex];
    const right = points[data.segmentIndex + 1];
    return (right.y - left.y) / (right.t - left.t);
  }
  if (data.graphTask === "average-speed") {
    let distance = 0;
    for (let index = 1; index < points.length; index += 1) distance += Math.abs(points[index].y - points[index - 1].y);
    return distance / (points.at(-1).t - points[0].t);
  }
  if (data.graphTask === "distance") {
    let area = 0;
    for (let index = 1; index < points.length; index += 1) {
      const left = points[index - 1];
      const right = points[index];
      area += (right.t - left.t) * (left.y + right.y) / 2;
    }
    return area;
  }
  throw new Error(`Unknown graph task ${data.graphTask}`);
}

function derivedContactAnswer(data) {
  if (data.contactType === "floor-pull") return data.massKg * G - data.appliedForceN;
  if (data.contactType === "floor-push") return data.massKg * G + data.appliedForceN;
  if (data.contactType === "two-support") return data.massKg * G - data.knownSupportN;
  throw new Error(`Unknown contact type ${data.contactType}`);
}

function geometricVolume(data, dimensions = data.givens) {
  const p = dimensions;
  if (data.family === "cylinder" || data.family === "liquid-column") return Math.PI * p.radiusM ** 2 * p.heightM;
  if (data.family === "cone") return Math.PI * p.radiusM ** 2 * p.heightM / 3;
  if (data.family === "sphere") return 4 * Math.PI * p.radiusM ** 3 / 3;
  if (data.family === "prism" && data.baseShape === "regular-hexagon") return 3 * Math.sqrt(3) * p.radiusM ** 2 * p.heightM / 2;
  if (data.family === "prism") return p.lengthM * p.widthM * p.heightM;
  throw new Error(`Unknown geometry ${data.family}`);
}

function numericField(question) {
  return question.fields.find((field) => field.kind === "numeric");
}

function numericAnswerInSI(question) {
  const field = numericField(question);
  const canonical = question.slot === 2 ? canonicalUnitForUnknown(question.sourceData.unknown) : field.targetUnit;
  const converted = units.convert(field.expected, field.targetUnit, canonical);
  assert.equal(converted.ok, true, `${question.id}: ${field.targetUnit} -> ${canonical}`);
  return converted.value;
}

function numericAnswerBoundsInSI(question) {
  const field = numericField(question);
  const tolerance = field.tolerance || {};
  const allowed = Math.max(tolerance.absolute || 0, Math.abs(field.expected) * (tolerance.relative || 0));
  const canonical = question.slot === 2 ? canonicalUnitForUnknown(question.sourceData.unknown) : field.targetUnit;
  const convert = (value) => {
    const converted = units.convert(value, field.targetUnit, canonical);
    assert.equal(converted.ok, true, `${question.id}: ${field.targetUnit} -> ${canonical}`);
    return converted.value;
  };
  return { lower: convert(field.expected - allowed), center: convert(field.expected), upper: convert(field.expected + allowed) };
}

function assertResidualBracket(question, residualAt) {
  const bounds = numericAnswerBoundsInSI(question);
  const residuals = [residualAt(bounds.lower), residualAt(bounds.center), residualAt(bounds.upper)];
  assert.ok(residuals.every(Number.isFinite), `${question.id}: non-finite residual`);
  const scale = Math.max(1, ...residuals.map(Math.abs));
  const epsilon = 1e-12 * scale;
  assert.ok(
    Math.min(residuals[0], residuals[2]) <= epsilon && Math.max(residuals[0], residuals[2]) >= -epsilon,
    `${question.id}: zero is outside rounded-answer residual bracket [${residuals[0]}, ${residuals[2]}]`
  );
}

function assertGeometryResidual(question) {
  const data = question.sourceData;
  const p = data.givens;
  let residualAt;
  if (data.unknown === "mass") {
    residualAt = (value) => value - p.densityKgM3 * geometricVolume(data, p);
  } else if (data.unknown === "density") {
    residualAt = (value) => value * geometricVolume(data, p) - p.massKg;
  } else if (data.unknown === "volume") {
    residualAt = (value) => value - geometricVolume(data, p);
  } else {
    residualAt = (value) => {
      const dimensions = { ...p };
      if (data.unknown === "radius") dimensions.radiusM = value;
      else if (data.unknown === "diameter") dimensions.radiusM = value / 2;
      else if (data.unknown === "height") dimensions.heightM = value;
      else assert.fail(`${question.id}: unsupported geometry unknown ${data.unknown}`);
      return p.densityKgM3 * geometricVolume(data, dimensions) - p.massKg;
    };
  }
  assertResidualBracket(question, residualAt);
}

function assertVerticalResidual(question) {
  const data = question.sourceData;
  const p = data.givens;
  let residualAt;
  if (data.family === "time-to-apex") {
    residualAt = (value) => p.initialSpeedMps - G * value;
  } else if (data.family === "maximum-height") {
    residualAt = (value) => p.initialSpeedMps ** 2 - 2 * G * (value - p.initialHeightM);
  } else if (data.family === "initial-speed") {
    residualAt = (value) => value - G * p.elapsedS - p.laterVelocityMps;
  } else if (data.family === "impact-speed") {
    residualAt = (value) => p.initialHeightM - value * p.flightTimeS + G * p.flightTimeS ** 2 / 2;
  } else if (data.family === "flight-time") {
    residualAt = (value) => p.initialHeightM + p.initialSpeedMps * value - G * value ** 2 / 2;
  } else assert.fail(`${question.id}: unsupported vertical family ${data.family}`);
  assertResidualBracket(question, residualAt);
}

function assertEquilibriumResidual(question) {
  const data = question.sourceData;
  const p = data.givens;
  let residualAt;
  if (data.family === "hanging-masses") {
    residualAt = (force) => force - (p.upperMassKg + p.lowerMassKg) * G;
  } else if (data.family === "cables-at-angles") {
    residualAt = (force) => 2 * force * Math.sin(p.angleDeg * Math.PI / 180) - p.massKg * G;
  } else if (data.family === "missing-fourth-force") {
    const sumX = p.forces.reduce((sum, item) => sum + item.xN, 0);
    const sumY = p.forces.reduce((sum, item) => sum + item.yN, 0);
    const fourth = { xN: -sumX, yN: -sumY };
    assert.equal(sumX + fourth.xN, 0, `${question.id}: x balance`);
    assert.equal(sumY + fourth.yN, 0, `${question.id}: y balance`);
    residualAt = (force) => force ** 2 - fourth.xN ** 2 - fourth.yN ** 2;
  } else if (data.family === "supported-beams") {
    residualAt = (force) => p.knownSupportN + force - p.massKg * G;
  } else if (data.family === "frictionless-wall-contact") {
    const angle = p.cableAngleDeg * Math.PI / 180;
    residualAt = (force) => force * Math.sin(angle) - p.massKg * G;
    assert.ok(numericAnswerInSI(question) * Math.cos(angle) > 0, `${question.id}: wall normal must be positive`);
  } else assert.fail(`${question.id}: unsupported equilibrium family ${data.family}`);
  assertResidualBracket(question, residualAt);
}

function assertDynamicsResidual(question) {
  const data = question.sourceData;
  const p = data.givens;
  let residualAt;
  if (data.family === "horizontal-pull") {
    const friction = p.frictionCoefficient * p.massKg * G;
    residualAt = (value) => p.pullForceN - friction - p.massKg * value;
  } else if (data.family === "inclined-plane") {
    const downhill = p.massKg * G * Math.sin(p.angleDeg * Math.PI / 180);
    residualAt = (value) => downhill - p.frictionForceN - p.massKg * value;
  } else if (data.family === "connected-masses") {
    residualAt = (value) => {
      const tableTension = p.tableMassKg * value + p.frictionCoefficient * p.tableMassKg * G;
      const hangingTension = p.hangingMassKg * G - p.hangingMassKg * value;
      return tableTension - hangingTension;
    };
  } else if (data.family === "unknown-pull") {
    const friction = p.frictionCoefficient * p.massKg * G;
    residualAt = (value) => value - friction - p.massKg * p.accelerationMps2;
  } else if (data.family === "unknown-friction") {
    const acceleration = p.finalSpeedMps / p.elapsedS;
    residualAt = (value) => p.driveForceN - value - p.massKg * acceleration;
  } else assert.fail(`${question.id}: unsupported dynamics family ${data.family}`);
  assertResidualBracket(question, residualAt);
}

function attributesForRole(html, tag, role) {
  const element = html.match(new RegExp(`<${tag}\\b(?=[^>]*data-role="${role}")[^>]*>`));
  assert.ok(element, `missing <${tag}> with data-role=${role}`);
  return Object.fromEntries(Array.from(element[0].matchAll(/([\w-]+)="([^"]*)"/g), (match) => [match[1], match[2]]));
}

function manifestElement(manifest, id) {
  const element = manifest.elements.find((candidate) => candidate.id === id);
  assert.ok(element, `missing semantic diagram element ${id}`);
  return element;
}

function assertPoint(actual, expected, message) {
  assert.equal(actual.length, 2, message);
  actual.forEach((value, index) => assert.ok(close(value, expected[index]), `${message}: ${actual} != ${expected}`));
}

function pointLineDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  return Math.abs(dx * (start[1] - point[1]) - (start[0] - point[0]) * dy) / Math.hypot(dx, dy);
}

function subtractPoints(left, right) {
  return [left[0] - right[0], left[1] - right[1]];
}

function boxCenter(box) {
  return [box.x + box.width / 2, box.y + box.height / 2];
}

function expandedBox(box, amount) {
  return { x: box.x - amount, y: box.y - amount, width: box.width + amount * 2, height: box.height + amount * 2 };
}

function boxesOverlap(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function pointInsideBox(point, box) {
  return point[0] >= box.x && point[0] <= box.x + box.width && point[1] >= box.y && point[1] <= box.y + box.height;
}

function segmentIntersectsBox(from, to, box) {
  if (pointInsideBox(from, box) || pointInsideBox(to, box)) return true;
  const delta = subtractPoints(to, from);
  let minimum = 0;
  let maximum = 1;
  for (const [direction, distance] of [[-delta[0], from[0] - box.x], [delta[0], box.x + box.width - from[0]], [-delta[1], from[1] - box.y], [delta[1], box.y + box.height - from[1]]]) {
    if (Math.abs(direction) <= 1e-12) {
      if (distance < 0) return false;
    } else {
      const ratio = distance / direction;
      if (direction < 0) minimum = Math.max(minimum, ratio);
      else maximum = Math.min(maximum, ratio);
      if (minimum > maximum) return false;
    }
  }
  return true;
}

function paintedParts(element) {
  const width = element.strokeWidth || 0;
  if (element.kind === "line") return [{ kind: "segment", from: element.from, to: element.to, width }];
  if (element.kind === "arrow") {
    const head = element.arrowhead.points;
    return [
      { kind: "segment", from: element.from, to: element.to, width },
      { kind: "segment", from: head[0], to: head[1], width: 0 },
      { kind: "segment", from: head[1], to: head[2], width: 0 },
      { kind: "segment", from: head[2], to: head[0], width: 0 }
    ];
  }
  if (element.kind === "circle") return [{ kind: "circle", center: element.center, radius: element.radius, width }];
  if (element.kind === "rect") {
    const a = [element.x, element.y]; const b = [element.x + element.width, element.y]; const c = [element.x + element.width, element.y + element.height]; const d = [element.x, element.y + element.height];
    return [[a, b], [b, c], [c, d], [d, a]].map(([from, to]) => ({ kind: "segment", from, to, width }));
  }
  if (element.kind === "body" || element.kind === "polygon" || element.kind === "polyline") {
    const points = element.points;
    const count = element.kind === "polyline" ? points.length - 1 : points.length;
    return Array.from({ length: count }, (_, index) => ({ kind: "segment", from: points[index], to: points[(index + 1) % points.length], width }));
  }
  if (element.kind === "dimension") {
    return [
      { kind: "segment", from: element.anchors[0], to: element.anchors[1], width },
      { kind: "segment", from: element.a, to: element.anchors[0], width },
      { kind: "segment", from: element.b, to: element.anchors[1], width }
    ];
  }
  assert.fail(`unsupported painted primitive ${element.id}/${element.kind}`);
}

function paintedPartIntersectsBox(part, box, clearance) {
  if (part.kind === "segment") return segmentIntersectsBox(part.from, part.to, expandedBox(box, clearance + part.width / 2));
  const protectedBox = expandedBox(box, clearance);
  const closestX = Math.max(protectedBox.x, Math.min(part.center[0], protectedBox.x + protectedBox.width));
  const closestY = Math.max(protectedBox.y, Math.min(part.center[1], protectedBox.y + protectedBox.height));
  return Math.hypot(part.center[0] - closestX, part.center[1] - closestY) <= part.radius + part.width / 2;
}

function serializedBackgroundBox(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<rect\\b(?=[^>]*\\bid="${escaped}")[^>]*>`, "u"));
  assert.ok(tag, `missing serialized background ${id}`);
  const attributes = Object.fromEntries(Array.from(tag[0].matchAll(/([\w-]+)="([^"]*)"/gu), (entry) => [entry[1], entry[2]]));
  return { x: Number(attributes.x), y: Number(attributes.y), width: Number(attributes.width), height: Number(attributes.height) };
}

function visiblePromptText(html) {
  const entities = {
    nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    aring: "å", auml: "ä", ouml: "ö", Aring: "Å", Auml: "Ä", Ouml: "Ö"
  };
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      }
      return entities[entity] || entities[entity.toLowerCase()] || " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function asksForComputerDerivation(html) {
  const text = visiblePromptText(html);
  const derivationTerms = "(?:metod|beräkning|uträkning|mellanled|steg|resonemang|förklaring|bevis|härledning|lösningsgång|tankegång|argument)[a-zåäö]*";
  return new RegExp(`\\b(?:redovisa|redogör|beskriv|skriv|ange|visa)\\b[^.?!]{0,120}\\b${derivationTerms}\\b`, "i").test(text) ||
    /\b(?:bevisa|förklara|motivera)\b/i.test(text) ||
    /\bvisa\s+(?:hur|varför)\b/i.test(text) ||
    /\bskriv\b[^.?!]{0,80}\b(?:hur|varför)\s+(?:du|ni|man)\b/i.test(text) ||
    asksForComputerDrawing(text);
}

function asksForComputerDrawing(text) {
  const drawVerb = "(?:rit(?:a|ar|as|ad|ade|at|ades|ning)|skiss(?:a|ar|as|ad|ade|at|ades|ning)|teck(?:na|nar|nas|nad|nade|nat|nades|ning)|frilägg(?:a|er|s|ning|ningen|ningar|ningarna)?|frilag(?:d|da|de|t))";
  const submissionAction = "(?:redovisa|redogör|beskriv|skriv(?:\\s+in)?|ange|ladda\\s+upp)";
  const forceWork = "(?:kraftfigur(?:en|er|erna)?|kraftdiagram(?:met|mer|men)?|frilägg(?:ning|ningen|ningar|ningarna)?|skiss(?:en|er|erna|ar|arna)?|vektorfigur(?:en|er|erna)?|diagram(?:met|mer|men)?)";
  const workTerm = new RegExp(`\\b(?:${forceWork}|${drawVerb})\\b`, "i");
  const drawingAction = new RegExp(`\\b${drawVerb}\\b`, "i");
  const studentWorkObject = `(?:din|ditt|dina|egen|eget|egna|skapad(?:e|t)?|genererad(?:e|t)?)\\s+${forceWork}`;
  const studentShowAction = new RegExp(`\\bvisa(?:r|de)?\\b[^.?!;,]{0,80}\\b(?:den\\s+)?${studentWorkObject}\\b`, "i");
  const submission = new RegExp(`\\b${submissionAction}\\b`, "i");
  const computerDestination = /\b(?:på\s+(?:skärmen|datorn)|digitalt|online|här)\b/i;
  const answerBoxDestination = /\b(?:i\s+(?:svarsfältet|svarsrutan|rutan|formuläret))\b/i;
  const cleanFinalAnswer = /\b(?:sluts?svaret?|svar(?:et|a)?|resultatet)\b/i;
  const finalAnswerAction = /\b(?:ange(?:s|r)?|skriv(?:s|er)?(?:\s+in)?|svara(?:s|r)?|uppge(?:s|r)?|besvara(?:s|r)?|lämna(?:s|r)?)\b/i;
  const segments = text.split(/[.!?;,]+/).flatMap((sentence) => sentence.split(/\s+\b(?:och|men|samt|eller|därefter|sedan|så)\b\s*/i)).map((segment) => segment.trim()).filter(Boolean);
  return segments.some((segment) => {
    const hasWorkTerm = workTerm.test(segment);
    const isCleanFinalAnswer = cleanFinalAnswer.test(segment) && finalAnswerAction.test(segment) && !hasWorkTerm;
    if (isCleanFinalAnswer || !hasWorkTerm) return false;
    if (computerDestination.test(segment)) return drawingAction.test(segment) || submission.test(segment) || studentShowAction.test(segment);
    if (answerBoxDestination.test(segment)) {
      return drawingAction.test(segment) || submission.test(segment) || studentShowAction.test(segment) || finalAnswerAction.test(segment);
    }
    if (submission.test(segment) || studentShowAction.test(segment)) return true;
    return false;
  });
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

test("physics has exactly 125 complete, deterministic, unique two-point questions", () => {
  const first = loadSlots();
  const serialized = JSON.stringify(first);
  const freshScript = `const path = require("node:path"); const crypto = require("node:crypto"); const root = ${JSON.stringify(PHYSICS_ROOT)}; const slots = Object.fromEntries([1,2,3,4,5].map((slot) => [slot, require(path.join(root, "questions", "slot-" + slot + ".js"))])); process.stdout.write(crypto.createHash("sha256").update(JSON.stringify(slots)).digest("hex"));`;
  const secondHash = childProcess.execFileSync(process.execPath, ["-e", freshScript], { encoding: "utf8" });
  const questions = Object.values(first).flat();

  assert.deepEqual(Object.values(first).map((slot) => slot.length), [25, 25, 25, 25, 25]);
  assert.equal(questions.length, 125);
  assert.equal(new Set(questions.map((question) => question.id)).size, 125);
  assert.equal(crypto.createHash("sha256").update(serialized).digest("hex"), secondHash, "fresh loads must reproduce every authored ID and value");
  questions.forEach((question) => {
    assert.match(question.id, new RegExp(`^physics-s${question.slot}-[a-z0-9-]+-\\d{2}$`));
    assert.equal(question.points, 2, question.id);
    assert.ok(question.title.trim(), question.id);
    assert.ok(question.promptHtml.length > 180, question.id);
    assert.ok(question.solutionHtml.length > 160, question.id);
    assert.ok(question.sourceData && typeof question.sourceData === "object", question.id);
    assert.equal(question.sourceData.skill, SLOT_SKILLS[question.slot - 1], question.id);
    assert.ok(Array.isArray(question.fields) && question.fields.length > 0, question.id);
    assert.ok(Array.isArray(question.rubric) && question.rubric.length > 0, question.id);
    assert.equal(question.fields.reduce((sum, field) => sum + field.points, 0), 2, question.id);
    assert.equal(question.rubric.reduce((sum, item) => sum + item.points, 0), 2, question.id);
    question.fields.forEach((field) => {
      assert.ok(field.label.trim(), `${question.id}/${field.id}`);
      if (field.kind === "self") {
        assert.equal(Object.hasOwn(field, "expected"), false, `${question.id}: self fields must not carry an auto-submitted canonical answer`);
      } else {
        assert.equal(field.kind, "numeric", question.id);
        assert.equal(units.normalizeUnit(field.targetUnit), field.targetUnit, question.id);
      }
    });
  });
});

test("slot structures and authored family rotations are exact", () => {
  const slots = loadSlots();
  assert.deepEqual(slots[1].reduce((counts, question) => {
    counts[question.sourceData.family] = (counts[question.sourceData.family] || 0) + 1;
    return counts;
  }, {}), { "graph-interpretation": 10, "contact-equilibrium": 15 });
  assert.deepEqual(slots[1].filter((question) => question.sourceData.family === "graph-interpretation").reduce((counts, question) => {
    counts[question.sourceData.graphTask] = (counts[question.sourceData.graphTask] || 0) + 1;
    return counts;
  }, {}), { slope: 3, "average-speed": 2, distance: 3, acceleration: 2 });

  const shapeCounts = { cylinder: 0, cone: 0, sphere: 0, prism: 0, "liquid-column": 0 };
  const unknownCounts = { mass: 0, density: 0, radius: 0, height: 0, volume: 0 };
  slots[2].forEach((question) => {
    shapeCounts[question.sourceData.family] += 1;
    const rotationQuantity = question.sourceData.family === "sphere" && question.sourceData.unknown === "diameter"
      ? "height"
      : question.sourceData.unknown;
    unknownCounts[rotationQuantity] += 1;
  });
  assert.deepEqual(shapeCounts, { cylinder: 5, cone: 5, sphere: 5, prism: 5, "liquid-column": 5 });
  assert.deepEqual(unknownCounts, { mass: 5, density: 5, radius: 5, height: 5, volume: 5 });

  [3, 4, 5].forEach((slot) => {
    const counts = Object.fromEntries(SLOT_FAMILIES[slot].map((family) => [family, 0]));
    slots[slot].forEach((question) => { counts[question.sourceData.family] += 1; });
    assert.deepEqual(Object.values(counts), [5, 5, 5, 5, 5], `slot ${slot}`);
  });
});

test("every numeric answer grades correctly and satisfies an independent forward equation", () => {
  allPhysicsQuestions().forEach((question) => {
    const numeric = numericField(question);
    assert.ok(numeric, question.id);
    if (question.slot === 1) {
      const independentlyDerived = question.sourceData.family === "graph-interpretation"
        ? derivedGraphAnswer(question.sourceData)
        : derivedContactAnswer(question.sourceData);
      const rounded = roundSignificant(independentlyDerived, question.sourceData.significantFigures);
      assert.ok(close(numeric.expected, rounded), `${question.id}: ${numeric.expected} != ${rounded}`);
    } else if (question.slot === 2) assertGeometryResidual(question);
    else if (question.slot === 3) assertVerticalResidual(question);
    else if (question.slot === 4) assertEquilibriumResidual(question);
    else assertDynamicsResidual(question);
    const result = grading.gradeNumeric(numeric, `${String(numeric.expected).replace(".", ",")} ${numeric.targetUnit}`);
    assert.equal(result.status, "correct", question.id);
    assert.equal(result.earned, numeric.points, question.id);
  });
});

test("a representative incorrect final answer earns no physics credit", () => {
  allPhysicsQuestions().forEach((question) => {
    const field = numericField(question);
    const wrong = field.expected + Math.max(1, Math.abs(field.expected));
    const result = grading.gradeNumeric(field, `${wrong} ${field.targetUnit}`);
    assert.notEqual(result.status, "correct", question.id);
    assert.equal(result.earned, 0, question.id);
  });
});

test("a real physics field keeps full credit while identifying an equivalent alternative unit", () => {
  const question = loadSlots()[2].find((candidate) => candidate.id === "physics-s2-cylinder-01");
  const result = grading.gradeNumeric(numericField(question), "1,32 kg");

  assert.deepEqual(
    { status: result.status, earned: result.earned, interpreted: result.interpreted, message: result.message },
    { status: "correct", earned: 2, interpreted: 1320, message: "Rätt värde i annan enhet." }
  );
});

test("fixed hand-calculated fixtures anchor all 25 geometry branches and every motion/force family", () => {
  const byId = Object.fromEntries(allPhysicsQuestions().map((question) => [question.id, question]));
  const fixtures = {
    "physics-s1-graph-06": [33, "m"],
    "physics-s1-contact-01": [32, "N"],
    "physics-s2-cylinder-01": [1320, "g"],
    "physics-s2-cylinder-02": [7780, "kg/m3"],
    "physics-s2-cylinder-03": [21.3, "mm"],
    "physics-s2-cylinder-04": [16.5, "cm"],
    "physics-s2-cylinder-05": [450, "cm3"],
    "physics-s2-cone-01": [4430, "kg/m3"],
    "physics-s2-cone-02": [4.09, "cm"],
    "physics-s2-cone-03": [112, "mm"],
    "physics-s2-cone-04": [276, "cm3"],
    "physics-s2-cone-05": [581, "g"],
    "physics-s2-sphere-01": [26.4, "mm"],
    "physics-s2-sphere-02": [7.87, "cm"],
    "physics-s2-sphere-03": [310, "cm3"],
    "physics-s2-sphere-04": [438, "g"],
    "physics-s2-sphere-05": [4.25, "g/cm3"],
    "physics-s2-prism-01": [20.6, "cm"],
    "physics-s2-prism-02": [528, "cm3"],
    "physics-s2-prism-03": [1.31, "kg"],
    "physics-s2-prism-04": [2050, "kg/m3"],
    "physics-s2-prism-05": [36.3, "mm"],
    "physics-s2-liquid-column-01": [0.847, "dm3"],
    "physics-s2-liquid-column-02": [1.71, "kg"],
    "physics-s2-liquid-column-03": [1.51, "g/cm3"],
    "physics-s2-liquid-column-04": [3.63, "cm"],
    "physics-s2-liquid-column-05": [28.4, "cm"],
    "physics-s3-time-to-apex-01": [0.55, "s"],
    "physics-s3-maximum-height-01": [3.1, "m"],
    "physics-s3-initial-speed-01": [18.2, "m/s"],
    "physics-s3-impact-speed-01": [15.3, "m/s"],
    "physics-s3-flight-time-01": [1.93, "s"],
    "physics-s4-hanging-masses-01": [49.1, "N"],
    "physics-s4-cables-at-angles-01": [95.7, "N"],
    "physics-s4-missing-fourth-force-01": [3.61, "N"],
    "physics-s4-supported-beams-01": [96.1, "N"],
    "physics-s4-frictionless-wall-contact-01": [83.2, "N"],
    "physics-s5-horizontal-pull-01": [3.09, "m/s2"],
    "physics-s5-inclined-plane-01": [1.8, "m/s2"],
    "physics-s5-connected-masses-01": [2.72, "m/s2"],
    "physics-s5-unknown-pull-01": [27.5, "N"],
    "physics-s5-unknown-friction-01": [25.3, "N"]
  };
  Object.entries(fixtures).forEach(([id, expected]) => {
    const numeric = byId[id].fields.find((field) => field.kind === "numeric");
    assert.deepEqual([numeric.expected, numeric.targetUnit], expected, id);
  });
});

test("physics values remain realistic and rule out impossible force situations", () => {
  allPhysicsQuestions().forEach((question) => {
    const data = question.sourceData;
    assert.ok(data.significantFigures >= 2 && data.significantFigures <= 4, question.id);
    const answer = Math.abs(numericField(question).expected);
    assert.ok(Number.isFinite(answer) && answer > 0 && answer < 100000, question.id);

    if (question.slot === 1 && data.family === "graph-interpretation") {
      assert.ok(data.points.length >= 2 && data.points.every((point) => point.t >= 0 && Number.isFinite(point.y)), question.id);
      assert.ok(data.points.every((point, index) => index === 0 || point.t > data.points[index - 1].t), question.id);
      if (data.graphType === "v-t") assert.ok(data.points.every((point) => point.y >= 0 && point.y <= 35), question.id);
    }
    if (question.slot === 1 && data.family === "contact-equilibrium") {
      assert.ok(data.massKg > 0.2 && data.massKg < 40, question.id);
      assert.ok(derivedContactAnswer(data) > 0, question.id);
      if (data.contactType === "floor-pull") assert.ok(data.appliedForceN < data.massKg * G, question.id);
      if (data.contactType === "two-support") assert.ok(data.knownSupportN < data.massKg * G, question.id);
    }
    if (question.slot === 2) {
      const p = data.givens;
      if (p.massKg !== undefined) assert.ok(p.massKg > 0.001 && p.massKg < 500, question.id);
      if (p.densityKgM3 !== undefined) assert.ok(p.densityKgM3 > 500 && p.densityKgM3 < 22000, question.id);
      const si = numericAnswerInSI(question);
      if (["radius", "diameter", "height"].includes(data.unknown)) assert.ok(si > 0.001 && si < 3, question.id);
      if (data.unknown === "volume") assert.ok(si > 1e-7 && si < 2, question.id);
    }
    if (question.slot === 3) {
      assert.equal(data.g, G, question.id);
      assert.ok(numericAnswerInSI(question) > 0 && numericAnswerInSI(question) < 120, question.id);
      if (data.family === "impact-speed") {
        const p = data.givens;
        const initial = (-p.initialHeightM + G * p.flightTimeS ** 2 / 2) / p.flightTimeS;
        assert.ok(initial > 0 && initial < 35 && initial - G * p.flightTimeS < 0, question.id);
      }
    }
    if (question.slot === 4) {
      assert.equal(data.g, G, question.id);
      assert.ok(numericAnswerInSI(question) > 0 && numericAnswerInSI(question) < 3000, question.id);
      if (data.family === "supported-beams") assert.ok(data.givens.knownSupportN < data.givens.massKg * G, question.id);
    }
    if (question.slot === 5) {
      assert.equal(data.g, G, question.id);
      const p = data.givens;
      if (data.normalForceN !== null) assert.ok(data.normalForceN > 0, `${question.id}: negative normal force`);
      assert.ok(numericAnswerInSI(question) > 0, `${question.id}: impossible motion direction`);
      if (data.family === "horizontal-pull") assert.ok(p.pullForceN > data.frictionForceN, `${question.id}: static contradiction`);
      if (data.family === "inclined-plane") assert.ok(p.massKg * G * Math.sin(p.angleDeg * Math.PI / 180) > p.frictionForceN, `${question.id}: static contradiction`);
      if (data.family === "connected-masses") assert.ok(p.hangingMassKg > p.tableMassKg * p.frictionCoefficient, `${question.id}: static contradiction`);
      if (data.family === "unknown-friction") assert.ok(numericAnswerInSI(question) < p.driveForceN, `${question.id}: impossible friction`);
    }
  });
});

test("connected-mass variants explicitly use established motion and kinetic friction throughout", () => {
  const connected = loadSlots()[5].filter((question) => question.sourceData.family === "connected-masses");

  assert.equal(connected.length, 5);
  connected.forEach((question) => {
    assert.equal(question.sourceData.startsMoving, true, question.id);
    assert.equal(question.sourceData.frictionCoefficientType, "kinetic", question.id);
    assert.match(question.promptHtml, /börjar[^.]*röra sig[^.]*hängande[^.]*nedåt|hängande[^.]*börjar[^.]*röra sig[^.]*nedåt/iu, question.id);
    assert.match(question.promptHtml, /kinetiska friktionstalet/iu, question.id);
    assert.match(question.solutionHtml, /kinetisk(?:a)? friktion/iu, question.id);
    assert.match(question.rubric.map((item) => item.text).join(" "), /kinetisk(?:a)? friktion/iu, question.id);
  });
});

test("every applied field states its exact unit and significant-figure instruction", () => {
  allPhysicsQuestions().forEach((question) => {
    const data = question.sourceData;
    question.fields.filter((field) => field.kind !== "self").forEach((field) => {
      assert.equal(field.targetUnit, data.targetUnit, question.id);
      assert.match(field.label, new RegExp(`\\(${data.requestedUnitLabel.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}; ${data.significantFigures} värdesiffror\\)`), question.id);
      assert.match(question.promptHtml, new RegExp(`Avrunda till ${data.significantFigures} värdesiffror`), question.id);
      assert.ok(question.promptHtml.includes(data.requestedUnitLabel), question.id);
      assert.ok(field.tolerance && (field.tolerance.absolute > 0 || field.tolerance.relative > 0), question.id);
    });
  });
});

test("solution formatting makes requested significant trailing zeros unambiguous", () => {
  const ambiguousIntegers = allPhysicsQuestions().filter((question) => {
    const numeric = question.fields.find((field) => field.kind === "numeric");
    return numeric && Number.isInteger(numeric.expected) && numeric.expected % 10 === 0 && Math.abs(numeric.expected) >= 10;
  });
  assert.ok(ambiguousIntegers.length > 0, "fixture must exercise scientific notation");
  ambiguousIntegers.forEach((question) => {
    const numeric = question.fields.find((field) => field.kind === "numeric");
    const decimals = Math.max(0, question.sourceData.significantFigures - 1 - Math.floor(Math.log10(Math.abs(numeric.expected))));
    if (decimals > 0) {
      assert.ok(question.solutionHtml.includes(numeric.expected.toFixed(decimals).replace(".", ",")), question.id);
    } else {
      assert.match(question.solutionHtml, /·10<sup>\d+<\/sup>/, question.id);
    }
  });
});

test("sphere diameter and regular-hexagon circumradius are explicit in data, wording, labels and diagrams", () => {
  const slot = loadSlots()[2];
  const sphere = slot.find((question) => question.id === "physics-s2-sphere-02");
  assert.equal(sphere.sourceData.unknown, "diameter");
  assert.equal(sphere.sourceData.diameterDefinition, "sphere-height");
  assert.match(sphere.promptHtml, /diametern \(sfärens höjd\)/i);
  assert.match(numericField(sphere).label, /^Diameter \(/);
  assert.match(sphere.solutionHtml, /diametern d/i);
  assert.match(sphere.solutionHtml, /d = 2/);
  const sphereBody = manifestElement(sphere.sourceData.diagram, `${sphere.id}-sphere-body`);
  const diameter = manifestElement(sphere.sourceData.diagram, `${sphere.id}-diameter`);
  assert.ok(close(diameter.from[1], sphereBody.center[1]) && close(diameter.to[1], sphereBody.center[1]));
  assert.ok(close(diameter.from[0], sphereBody.center[0] - sphereBody.radius));
  assert.ok(close(diameter.to[0], sphereBody.center[0] + sphereBody.radius));
  assert.ok(sphere.sourceData.diagram.labels.some((label) => /diameter.*label/u.test(label.id)));

  const prism = slot.find((question) => question.id === "physics-s2-prism-05");
  assert.equal(prism.sourceData.radiusDefinition, "circumradius-center-to-vertex");
  assert.match(prism.promptHtml, /omskrivna cirkelns radie från sexkantens centrum till ett hörn/i);
  assert.match(prism.solutionHtml, /omskrivna cirkelns radie, mätt från centrum till hörn/i);
  const outline = manifestElement(prism.sourceData.diagram, `${prism.id}-hex-face`);
  const radius = manifestElement(prism.sourceData.diagram, `${prism.id}-circumradius`);
  const center = [outline.points.reduce((sum, point) => sum + point[0], 0) / 6, outline.points.reduce((sum, point) => sum + point[1], 0) / 6];
  assertPoint(radius.from, center, "r must start at hexagon center");
  assert.ok(outline.points.some((vertex) => close(radius.to[0], vertex[0]) && close(radius.to[1], vertex[1])), "r must end at a vertex");
});

test("all slot-one and slot-two prompt figures and contact solutions expose valid unique manifests", () => {
  const slots = loadSlots();
  const promptQuestions = slots[1].concat(slots[2]);
  const contactQuestions = slots[1].filter((question) => question.sourceData.family === "contact-equilibrium");
  const manifests = [];

  assert.equal(promptQuestions.length, 50);
  assert.equal(contactQuestions.length, 15);
  promptQuestions.forEach((question) => {
    const manifest = question.sourceData.diagram;
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    assert.equal(manifest.purpose, "prompt", question.id);
    assert.equal(manifest.id, `${question.id}-diagram`, question.id);
    assert.equal(manifest.titleId, `${question.id}-diagram-title`, question.id);
    assert.equal(manifest.descriptionId, `${question.id}-diagram-desc`, question.id);
    assert.ok(question.promptHtml.includes(manifest.ariaLabelledby), question.id);
    manifests.push(manifest);
  });
  contactQuestions.forEach((question) => {
    const manifest = question.sourceData.solutionDiagram;
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    assert.equal(manifest.purpose, "solution", question.id);
    assert.equal(manifest.id, `${question.id}-solution-diagram`, question.id);
    assert.ok(question.solutionHtml.includes(manifest.ariaLabelledby), question.id);
    assert.equal((question.solutionHtml.match(/<svg\b/gu) || []).length, 1, question.id);
    manifests.push(manifest);
  });
  const ids = manifests.flatMap((manifest) => manifest.domIds);
  assert.equal(new Set(ids).size, ids.length, "all 65 Task 9 figures need globally unique DOM IDs");
});

test("graph points, breakpoints, axes, ticks and labels follow independently checked reserved geometry", () => {
  loadSlots()[1].filter((question) => question.sourceData.family === "graph-interpretation").forEach((question) => {
    const data = question.sourceData;
    const manifest = data.diagram;
    const layout = data.diagramLayout;
    assert.deepEqual(layout, {
      plot: { x: 82, y: 34, width: 438, height: 232 },
      xTickZone: { x: 74, y: 274, width: 456, height: 26 },
      yTickZone: { x: 18, y: 24, width: 52, height: 250 },
      xTitleZone: { x: 436, y: 316, width: 92, height: 26 },
      yTitleZone: { x: 224, y: 4, width: 92, height: 22 }
    }, question.id);
    const expected = data.points.map((point) => [
      layout.plot.x + point.t / data.axis.xMax * layout.plot.width,
      layout.plot.y + layout.plot.height - point.y / data.axis.yMax * layout.plot.height
    ]);
    const polyline = manifestElement(manifest, `${question.id}-data-line`);
    assert.deepEqual(polyline.points.length, expected.length, question.id);
    polyline.points.forEach((point, index) => assertPoint(point, expected[index], `${question.id}: breakpoint ${index}`));
    expected.forEach((point, index) => {
      assertPoint(manifestElement(manifest, `${question.id}-point-${index}`).center, point, `${question.id}: point ${index}`);
    });
    assertPoint(manifestElement(manifest, `${question.id}-x-axis`).from, [layout.plot.x, layout.plot.y + layout.plot.height], `${question.id}: x axis start`);
    assertPoint(manifestElement(manifest, `${question.id}-x-axis`).to, [layout.plot.x + layout.plot.width, layout.plot.y + layout.plot.height], `${question.id}: x axis end`);
    assertPoint(manifestElement(manifest, `${question.id}-y-axis`).from, [layout.plot.x, layout.plot.y], `${question.id}: y axis start`);
    assertPoint(manifestElement(manifest, `${question.id}-y-axis`).to, [layout.plot.x, layout.plot.y + layout.plot.height], `${question.id}: y axis end`);
    manifest.labels.filter((label) => label.id.includes("-x-tick-label-")).forEach((label) => {
      assert.ok(label.bbox.x >= layout.xTickZone.x && label.bbox.x + label.bbox.width <= layout.xTickZone.x + layout.xTickZone.width, label.id);
      assert.ok(label.bbox.y >= layout.xTickZone.y && label.bbox.y + label.bbox.height <= layout.xTickZone.y + layout.xTickZone.height, label.id);
    });
    manifest.labels.filter((label) => label.id.includes("-y-tick-label-")).forEach((label) => {
      assert.ok(label.bbox.x >= layout.yTickZone.x && label.bbox.x + label.bbox.width <= layout.yTickZone.x + layout.yTickZone.width, label.id);
      assert.ok(label.bbox.y >= layout.yTickZone.y && label.bbox.y + label.bbox.height <= layout.yTickZone.y + layout.yTickZone.height, label.id);
    });
    const xTitle = manifestElement(manifest, `${question.id}-x-title`);
    const yTitle = manifestElement(manifest, `${question.id}-y-title`);
    [xTitle, yTitle].forEach((label, index) => {
      const zone = index === 0 ? layout.xTitleZone : layout.yTitleZone;
      assert.ok(label.bbox.x >= zone.x && label.bbox.y >= zone.y && label.bbox.x + label.bbox.width <= zone.x + zone.width && label.bbox.y + label.bbox.height <= zone.y + zone.height, label.id);
    });
  });
});

test("contact prompts preserve exact floor/support contact and reserve full force sets for solutions", () => {
  loadSlots()[1].filter((question) => question.sourceData.family === "contact-equilibrium").forEach((question) => {
    const data = question.sourceData;
    const prompt = data.diagram;
    const solution = data.solutionDiagram;
    const body = manifestElement(prompt, `${question.id}-body`);
    const promptForces = prompt.elements.filter((element) => element.role === "force");
    const solutionForces = solution.elements.filter((element) => element.role === "force");
    assert.equal(promptForces.length, 1, `${question.id}: prompt shows only the given force`);
    assert.equal(solutionForces.length, 3, `${question.id}: solution has the complete three-force diagram`);
    assert.equal((question.promptHtml.match(/data-role="force"/gu) || []).length, 1, question.id);
    assert.ok(!question.promptHtml.includes("force-weight") && !question.promptHtml.includes("force-normal") && !question.promptHtml.includes("force-support-right"), question.id);

    if (data.contactType === "two-support") {
      const [leftSupport, rightSupport] = data.diagramGeometry.supportPoints;
      assert.ok(body.points.some((point) => close(point[1], leftSupport[1])) && body.points.some((point) => close(point[1], rightSupport[1])), question.id);
      assert.ok(leftSupport[0] > Math.min(...body.points.map((point) => point[0])) && rightSupport[0] < Math.max(...body.points.map((point) => point[0])), question.id);
      assertPoint(manifestElement(prompt, `${question.id}-left-support`).points[0], leftSupport, `${question.id}: left support contact`);
      assertPoint(manifestElement(prompt, `${question.id}-right-support`).points[0], rightSupport, `${question.id}: right support contact`);
    } else {
      const ground = manifestElement(prompt, `${question.id}-ground`);
      body.points.slice(0, 2).forEach((point) => {
        assert.ok(close(pointLineDistance(point, ground.from, ground.to), 0), `${question.id}: body bottom touches ground`);
      });
      body.points.slice(2).forEach((point) => assert.ok(point[1] < ground.from[1], `${question.id}: body stays above ground`));
    }

    const isolated = manifestElement(solution, `${question.id}-isolated-body`);
    solutionForces.forEach((force) => {
      assert.ok(force.from[0] >= isolated.bbox.x && force.from[0] <= isolated.bbox.x + isolated.bbox.width && force.from[1] >= isolated.bbox.y && force.from[1] <= isolated.bbox.y + isolated.bbox.height, `${force.id}: force anchored to isolated body`);
    });
    const weight = manifestElement(solution, `${question.id}-force-weight`);
    assert.ok(weight.to[1] > weight.from[1], `${question.id}: weight downward`);
    if (data.contactType === "two-support") {
      assert.ok(manifestElement(solution, `${question.id}-force-support-left`).to[1] < weight.from[1], question.id);
      assert.ok(manifestElement(solution, `${question.id}-force-support-right`).to[1] < weight.from[1], question.id);
    } else {
      assert.ok(manifestElement(solution, `${question.id}-force-normal`).to[1] < weight.from[1], question.id);
      const applied = manifestElement(solution, `${question.id}-force-applied`);
      assert.equal(applied.to[1] < applied.from[1], data.contactType === "floor-pull", question.id);
    }
  });
});

test("body dimensions are outside their solids and use exact source anchors", () => {
  loadSlots()[2].forEach((question) => {
    const data = question.sourceData;
    const manifest = data.diagram;
    assert.ok(data.diagramGeometry.dimensions.length >= 1, question.id);
    data.diagramGeometry.dimensions.forEach((specification) => {
      const dimension = manifestElement(manifest, specification.id);
      assertPoint(dimension.a, specification.a, `${specification.id}: source start`);
      assertPoint(dimension.b, specification.b, `${specification.id}: source end`);
      assert.ok(Math.abs(dimension.offset) >= 18, `${specification.id}: dimension must be outside solid`);
      assert.ok(data.diagramGeometry.sourcePoints.some((point) => close(point[0], dimension.a[0]) && close(point[1], dimension.a[1])), `${specification.id}: start belongs to source geometry`);
      assert.ok(data.diagramGeometry.sourcePoints.some((point) => close(point[0], dimension.b[0]) && close(point[1], dimension.b[1])), `${specification.id}: end belongs to source geometry`);
    });
    if (data.family === "sphere") {
      const sphere = manifestElement(manifest, `${question.id}-sphere-body`);
      const diameter = manifestElement(manifest, `${question.id}-diameter`);
      assertPoint(diameter.from, [sphere.center[0] - sphere.radius, sphere.center[1]], `${question.id}: diameter start`);
      assertPoint(diameter.to, [sphere.center[0] + sphere.radius, sphere.center[1]], `${question.id}: diameter end`);
    }
    if (data.baseShape === "regular-hexagon") {
      const face = manifestElement(manifest, `${question.id}-hex-face`);
      const radius = manifestElement(manifest, `${question.id}-circumradius`);
      const center = [face.points.reduce((sum, point) => sum + point[0], 0) / 6, face.points.reduce((sum, point) => sum + point[1], 0) / 6];
      assertPoint(radius.from, center, `${question.id}: circumradius center`);
      assert.ok(face.points.some((point) => close(point[0], radius.to[0]) && close(point[1], radius.to[1])), `${question.id}: circumradius ends at vertex`);
    }
  });
});

test("all 65 Task 9 figures keep exact opaque labels clear of every non-owner stroke", () => {
  const slots = loadSlots();
  const figures = slots[1].concat(slots[2]).map((question) => ({ question, manifest: question.sourceData.diagram, html: question.promptHtml }))
    .concat(slots[1].filter((question) => question.sourceData.solutionDiagram).map((question) => ({ question, manifest: question.sourceData.solutionDiagram, html: question.solutionHtml })));
  const failures = [];
  assert.equal(figures.length, 65);
  figures.forEach(({ question, manifest, html }) => {
    const geometry = manifest.elements.filter((element) => !["label", "label-background"].includes(element.role));
    const labelBoxes = manifest.labels.map((label) => {
      const background = manifest.backgrounds.find((candidate) => candidate.labelId === label.id);
      assert.ok(background, `${label.id}: opaque background`);
      const serialized = serializedBackgroundBox(html, background.id);
      for (const key of ["x", "y", "width", "height"]) assert.ok(close(serialized[key], background.bbox[key]), `${label.id}: exact serialized ${key}`);
      return { label, box: serialized };
    });
    labelBoxes.forEach(({ label, box }, index) => {
      if (!(box.x >= 0 && box.y >= 0 && box.x + box.width <= manifest.width && box.y + box.height <= manifest.height)) failures.push(`${label.id}: outside viewBox`);
      labelBoxes.slice(index + 1).forEach(({ label: other, box: otherBox }) => {
        if (boxesOverlap(expandedBox(box, 6), otherBox)) failures.push(`${label.id}: lacks 6px clearance from ${other.id}`);
      });
      const nonOwner = geometry.filter((element) => element.id !== label.anchorId);
      assert.deepEqual(label.avoid.slice().sort(), nonOwner.map((element) => element.id).sort(), `${label.id}: complete non-owner avoid set`);
      assert.ok(label.minClearance >= 6, label.id);
      nonOwner.forEach((element) => paintedParts(element).forEach((part) => {
        if (paintedPartIntersectsBox(part, box, label.minClearance)) failures.push(`${question.id}: ${label.id} intersects ${element.id}`);
      }));
      const center = boxCenter(box);
      const owner = geometry.find((element) => element.id === label.anchorId);
      assert.ok(owner, `${label.id}: semantic owner`);
      if (label.id.includes("-tick-label-") || label.id.endsWith("-title")) {
        assert.equal(question.sourceData.family, "graph-interpretation", label.id);
      } else if (owner.kind === "dimension") {
        const dimensionCenter = [(owner.anchors[0][0] + owner.anchors[1][0]) / 2, (owner.anchors[0][1] + owner.anchors[1][1]) / 2];
        assert.ok(Math.hypot(center[0] - dimensionCenter[0], center[1] - dimensionCenter[1]) <= 32, `${label.id}: constrained dimension zone`);
      } else if (owner.kind === "arrow") {
        const distances = [owner.from, owner.to].map((point) => Math.hypot(center[0] - point[0], center[1] - point[1]));
        assert.ok(Math.min(...distances) <= 95, `${label.id}: constrained force zone`);
      } else if (owner.kind === "line" && owner.role === "measure") {
        const measureCenter = [(owner.from[0] + owner.to[0]) / 2, (owner.from[1] + owner.to[1]) / 2];
        assert.ok(Math.hypot(center[0] - measureCenter[0], center[1] - measureCenter[1]) <= 45, `${label.id}: constrained measure zone`);
      } else if (label.id.endsWith("-mass-label") || label.id.endsWith("-density-label")) {
        assert.ok(center[0] >= 470 && center[0] <= 595, `${label.id}: constrained givens zone`);
      } else assert.fail(`${label.id}: missing local semantic placement type`);
    });
  });
  assert.deepEqual(failures, []);
});

test("every physics slot fails with a controlled error when diagram-kit is absent", () => {
  [1, 2, 3, 4, 5].forEach((slot) => {
    const source = fs.readFileSync(path.join(PHYSICS_ROOT, `questions/slot-${slot}.js`), "utf8");
    assert.throws(() => vm.runInNewContext(source, { window: {} }), /diagram.?kit|diagram dependency/i, `browser slot ${slot}`);
    assert.throws(() => vm.runInNewContext(source, { module: { exports: {} }, require() { return undefined; } }), /diagram.?kit|diagram dependency/i, `CommonJS slot ${slot}`);
  });
});

test("wall-contact and pulley-rope SVG topology matches the stated force models", () => {
  loadSlots()[4]
    .filter((question) => question.sourceData.family === "frictionless-wall-contact")
    .forEach((question) => {
      const wall = attributesForRole(question.promptHtml, "line", "wall");
      const sphere = attributesForRole(question.promptHtml, "circle", "sphere");
      const cable = attributesForRole(question.promptHtml, "line", "cable");
      const wallX = Number(wall.x1);
      const cx = Number(sphere.cx);
      const cy = Number(sphere.cy);
      const radius = Number(sphere.r);
      const x1 = Number(cable.x1);
      const y1 = Number(cable.y1);
      const x2 = Number(cable.x2);
      const y2 = Number(cable.y2);
      assert.ok(close(Number(wall.x1), Number(wall.x2)), `${question.id}: wall must be vertical`);
      assert.ok(close(cx + radius, wallX), `${question.id}: sphere must touch wall`);
      assert.ok(close(Math.hypot(x1 - cx, y1 - cy), radius), `${question.id}: cable must attach on sphere`);
      assert.ok(close(x2, wallX), `${question.id}: cable must terminate on wall`);
      assert.ok(x2 > x1 && y2 < y1, `${question.id}: cable must run upward toward wall`);
      assert.ok(close((y1 - y2) / (x2 - x1), Math.tan(question.sourceData.givens.cableAngleDeg * Math.PI / 180)), `${question.id}: drawn cable angle`);
      assert.ok(close((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1), 0), `${question.id}: cable line of action must pass through center`);
    });

  loadSlots()[5]
    .filter((question) => question.sourceData.family === "connected-masses")
    .forEach((question) => {
      const body = attributesForRole(question.promptHtml, "rect", "table-body");
      const pulley = attributesForRole(question.promptHtml, "circle", "pulley");
      const rope = attributesForRole(question.promptHtml, "path", "rope");
      const coordinates = rope.d.match(/^M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) A([\d.]+) ([\d.]+) 0 0 1 ([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)$/);
      assert.ok(coordinates, `${question.id}: rope needs straight–arc–straight topology`);
      const [, startX, startY, tangentX, tangentY, arcRx, arcRy, arcEndX, arcEndY, tailX, tailY] = coordinates.map(Number);
      const cx = Number(pulley.cx);
      const cy = Number(pulley.cy);
      const radius = Number(pulley.r);
      assert.ok(close(startX, Number(body.x) + Number(body.width)), `${question.id}: rope starts on table body`);
      assert.ok(startY >= Number(body.y) && startY <= Number(body.y) + Number(body.height), `${question.id}: rope attachment lies on body edge`);
      assert.ok(close(startY, tangentY), `${question.id}: first segment is horizontal`);
      assert.ok(close(tangentX, cx) && close(tangentY, cy - radius), `${question.id}: first segment reaches top tangent`);
      assert.ok(close(arcRx, radius) && close(arcRy, radius), `${question.id}: rope follows pulley radius`);
      assert.ok(close(arcEndX, cx + radius) && close(arcEndY, cy), `${question.id}: arc ends at right tangent`);
      assert.ok(close(tailX, cx + radius) && tailY > arcEndY, `${question.id}: final segment hangs vertically`);
    });
});

test("all data-generated SVGs are accessible, uniquely labelled and honest about scale", () => {
  const titleIds = new Set();
  const descIds = new Set();
  allPhysicsQuestions().forEach((question) => {
    const html = question.promptHtml;
    assert.match(html, /<svg\b[^>]*role="img"[^>]*aria-labelledby="([^"]+)"/, question.id);
    const title = html.match(/<title\s+id="([^"]+)">([^<]+)<\/title>/);
    const desc = html.match(/<desc\s+id="([^"]+)">([^<]+)<\/desc>/);
    assert.ok(title && desc, question.id);
    assert.equal(titleIds.has(title[1]), false, `${question.id}: repeated SVG title id`);
    assert.equal(descIds.has(desc[1]), false, `${question.id}: repeated SVG desc id`);
    titleIds.add(title[1]);
    descIds.add(desc[1]);
    assert.match(html.match(/aria-labelledby="([^"]+)"/)[1], new RegExp(`^${title[1]} ${desc[1]}$`), question.id);
    if (question.sourceData.family === "graph-interpretation") {
      const axis = question.sourceData.axis;
      assert.match(html, /data-scale="exact"/, question.id);
      assert.ok(html.includes(`data-x-max="${axis.xMax}"`) && html.includes(`data-y-max="${axis.yMax}"`), question.id);
      for (let value = 0; value <= axis.xMax; value += axis.xStep) assert.ok(html.includes(`>${value}<`), `${question.id}: x tick ${value}`);
      for (let value = 0; value <= axis.yMax; value += axis.yStep) assert.ok(html.includes(`>${value}<`), `${question.id}: y tick ${value}`);
    } else {
      assert.match(html, /schematisk och inte skalenlig/i, question.id);
    }
  });
  assert.equal(titleIds.size, 125);
  assert.equal(descIds.size, 125);
});

test("physics exposes exactly one full-credit numeric final answer and paper-work guidance per question", () => {
  const questions = allPhysicsQuestions();
  assert.equal(questions.length, 125);
  questions.forEach((question) => {
    assert.deepEqual(question.fields.map((field) => field.id), ["answer"], question.id);
    assert.equal(question.fields.length, 1, question.id);
    const answer = question.fields[0];
    assert.equal(answer.kind, "numeric", question.id);
    assert.equal(answer.points, 2, question.id);
    assert.equal(Object.hasOwn(answer, "multiline"), false, question.id);
    assert.ok(!question.fields.some((field) => field.kind === "self"), question.id);
    assert.deepEqual(Object.keys(question.workOnPaper).sort(), ["comparison", "instruction", "title"], question.id);
    Object.values(question.workOnPaper).forEach((value) => assert.equal(typeof value, "string"));
    Object.values(question.workOnPaper).forEach((value) => assert.ok(value.trim(), question.id));
    assert.match(question.workOnPaper.title, /räknehäftet/i, question.id);
    assert.match(question.workOnPaper.instruction, /endast slutsvaret.*digitalt|slutsvaret.*digitalt/i, question.id);
    assert.match(question.workOnPaper.instruction, /räknehäftet|anteckningsbok|häftet/i, question.id);
    assert.match(question.workOnPaper.comparison, /lösning|lösnings|jämför/i, question.id);
  });
});

test("paper-work instructions name the method expected by each physics family", () => {
  const byFamily = Object.fromEntries(allPhysicsQuestions().map((question) => [question.sourceData.family, question.workOnPaper.instruction]));
  assert.match(byFamily["graph-interpretation"], /graf|lutning|area|avläs|beräkna/i);
  assert.match(byFamily["contact-equilibrium"], /kraftfigur|frilägg|jämvikt/i);
  ["cylinder", "cone", "sphere", "prism", "liquid-column"].forEach((family) => assert.match(byFamily[family], /enhet|SI|geometri|mått|volym/i));
  ["time-to-apex", "maximum-height", "initial-speed", "impact-speed", "flight-time"].forEach((family) => assert.match(byFamily[family], /positiv riktning|tecken|rot|rörelse/i));
  ["hanging-masses", "cables-at-angles", "missing-fourth-force", "supported-beams", "frictionless-wall-contact", "horizontal-pull", "inclined-plane", "connected-masses", "unknown-pull", "unknown-friction"].forEach((family) => assert.match(byFamily[family], /kraftfigur|frilägg|Newtons|kraft/i));
});

test("physics prompts keep derivation and method work out of digital answer fields", () => {
  allPhysicsQuestions().forEach((question) => assert.equal(asksForComputerDerivation(question.promptHtml), false, question.id));
});

test("physics prompt audit catches wrapped derivation and computer-directed force-work requests", () => {
  const examples = [
    ["<p>Redovisa en generell <strong>metod</strong> och visa din <em>beräkning</em>.</p>", true],
    ["<p>Förklara <span>hur</span> du fick fram svaret.</p>", true],
    ["<p>Redogör för ditt <strong>resonemang</strong>.</p>", true],
    ["<p>Redog&ouml;r för ditt <strong>resonemang</strong>.</p>", true],
    ["<p>Beskriv <em>metoden</em> du använde.</p>", true],
    ["<p>Skriv <strong>hur</strong> du fick fram svaret.</p>", true],
    ["<p>Rita en <strong>kraftfigur</strong> i svarsfältet.</p>", true],
    ["<p>Redovisa din <em>friläggning</em> här.</p>", true],
    ["<p>Skriv in en <span>skiss</span> i rutan.</p>", true],
    ["<p>Bestäm alla reella <strong>lösningar</strong>.</p>", false],
    ["<p>Visa figuren och bestäm vinkeln.</p>", false],
    ["<p>Skriv endast slutsvaret.</p>", false],
    ["<p>Ange svaret med rätt enhet.</p>", false],
    ["<p>I räknehäftet rita kraftfiguren och skriv endast slutsvaret digitalt.</p>", false],
    ["<p>Rita kraftfiguren i räknehäftet och skriv endast slutsvaret digitalt.</p>", false],
    ["<p>Rita kraftfiguren i räknehäftet och ange svaret digitalt.</p>", false],
    ["<p>Rita kraftfiguren i räknehäftet; digitalt skriver du endast slutsvaret.</p>", false],
    ["<p>I räknehäftet ritas kraftfiguren och endast slutsvaret anges digitalt.</p>", false],
    ["<p>I räknehäftet ritas kraftfigurerna och endast slutsvaret skrivs digitalt.</p>", false],
    ["<p>Rita kraftfigurer i räknehäftet; endast slutsvaret besvaras digitalt.</p>", false],
    ["<p>I räknehäftet rita kraftfiguren och svara digitalt.</p>", false],
    ["<p>I räknehäftet rita kraftfiguren och uppge slutsvaret digitalt.</p>", false],
    ["<p>I räknehäftet ritas kraftfiguren, endast slutsvaret anges digitalt.</p>", false],
    ["<p>Diagrammet visas på skärmen.</p>", false],
    ["<p>Kraftdiagrammet visas på skärmen.</p>", false],
    ["<p>Diagrammen visas på skärmen.</p>", false],
    ["<p>Skissen visas på skärmen.</p>", false],
    ["<p>Visa diagrammet på skärmen.</p>", false],
    ["<p>Visa figuren digitalt.</p>", false],
    ["<p>Programmet visar kraftdiagrammet på skärmen.</p>", false],
    ["<p>På skärmen ritar du en kraftfigur.</p>", true],
    ["<p>Digitalt: rita en kraftfigur.</p>", true],
    ["<p>Rita en kraftfigur på datorn.</p>", true],
    ["<p>I svarsrutan ritas kraftfiguren.</p>", true],
    ["<p>På datorn ska du rita kraftfiguren.</p>", true],
    ["<p>Kraftfigurer ritas på skärmen.</p>", true],
    ["<p>Ritade kraftfigurer i svarsrutan.</p>", true],
    ["<p>Rita kraftfiguren och skriv svar: kraftfigur i svarsrutan.</p>", true],
    ["<p>Kraftfigurerna ritas digitalt.</p>", true],
    ["<p>Ritade kraftfigurer på datorn.</p>", true],
    ["<p>Friläggningar ritas på skärmen.</p>", true],
    ["<p>Friläggningarna ritas på skärmen.</p>", true],
    ["<p>Skisser ritas på skärmen.</p>", true],
    ["<p>Skisserna ritas på skärmen.</p>", true],
    ["<p>Visa din kraftfigur i svarsrutan.</p>", true],
    ["<p>Ladda upp din skiss.</p>", true],
    ["<p>Redovisa din friläggning digitalt.</p>", true],
    ["<p>Frilägg kraftfiguren digitalt.</p>", true],
    ["<p>I räknehäftet gör du beräkningen; på skärmen ritar du kraftfiguren.</p>", true],
    ["<p>Digitalt ritar du kraftfiguren; i räknehäftet gör du beräkningen.</p>", true],
    ["<p>Beräkna kraftfiguren i räknehäftet innan du anger slutsvaret.</p>", false],
    ["<p>Kontrollera <strong>enhet</strong> och avrundning.</p>", false]
  ];
  examples.forEach(([html, expected]) => assert.equal(asksForComputerDerivation(html), expected, html));
  assert.equal(visiblePromptText("<p>Ber&auml;kna&nbsp;endast&nbsp;slutsvaret.</p>"), "Beräkna endast slutsvaret.");
});

test("vertical solutions define upward-positive signs before substitution", () => {
  loadSlots()[3].forEach((question) => {
    assert.match(question.solutionHtml, /Positiv riktning: uppåt/i, question.id);
    assert.match(question.solutionHtml, /a = −9,82 m\/s²/, question.id);
    assert.ok(question.solutionHtml.indexOf("Positiv riktning") < question.solutionHtml.indexOf("Insättning"), question.id);
  });
});

test("subject assembly supports CommonJS and ordered file scripts", () => {
  const subjectData = loadSubjectDataFresh();
  assert.equal(subjectData.config.id, "physics-ks1");
  assert.deepEqual(Object.keys(subjectData.slots), ["1", "2", "3", "4", "5"]);
  assert.doesNotThrow(() => exam.createSession(subjectData.config, subjectData.slots, memoryStore(), seededRng(1)));

  const context = vm.createContext({ window: {} });
  [
    "../assets/js/subject-config.js",
    "../assets/js/diagram-kit.js",
    "questions/slot-1.js", "questions/slot-2.js", "questions/slot-3.js", "questions/slot-4.js", "questions/slot-5.js", "questions.js"
  ].forEach((relative) => {
    const filename = path.resolve(PHYSICS_ROOT, relative);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  });
  assert.equal(context.window.KS_SUBJECT_DATA.config.id, "physics-ks1");
  assert.deepEqual(Array.from(Object.values(context.window.KS_SUBJECT_DATA.slots), (slot) => slot.length), [25, 25, 25, 25, 25]);
});

test("the physics page loads five slots and assembly immediately before app.js", () => {
  const html = fs.readFileSync(path.join(PHYSICS_ROOT, "index.html"), "utf8");
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g), (match) => match[1]);
  assert.deepEqual(scripts.slice(-7), [
    "questions/slot-1.js", "questions/slot-2.js", "questions/slot-3.js", "questions/slot-4.js", "questions/slot-5.js", "questions.js", "../assets/js/app.js"
  ]);
});

test("1,000 real-engine physics exams keep all five skills, ten points and full no-repeat cycles", () => {
  const subjectData = loadSubjectDataFresh();
  const store = memoryStore();
  const rng = seededRng(260911);
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
