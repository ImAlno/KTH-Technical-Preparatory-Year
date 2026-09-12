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
  if (element.kind === "angleArc") {
    const start = Math.atan2(element.fromRay[1], element.fromRay[0]);
    let delta = Math.atan2(element.toRay[1], element.toRay[0]) - start;
    if (element.sweep === 1 && delta < 0) delta += Math.PI * 2;
    if (element.sweep === -1 && delta > 0) delta -= Math.PI * 2;
    const points = Array.from({ length: 33 }, (_, index) => [
      element.vertex[0] + element.radius * Math.cos(start + delta * index / 32),
      element.vertex[1] + element.radius * Math.sin(start + delta * index / 32)
    ]);
    return points.slice(1).map((point, index) => ({ kind: "segment", from: points[index], to: point, width }));
  }
  if (element.kind === "rope") {
    const pieces = element.segments;
    const arc = pieces[1];
    const start = Math.atan2(arc.from[1] - arc.center[1], arc.from[0] - arc.center[0]);
    const points = Array.from({ length: 65 }, (_, index) => [
      arc.center[0] + arc.radius * Math.cos(start + arc.sweep * arc.delta * index / 64),
      arc.center[1] + arc.radius * Math.sin(start + arc.sweep * arc.delta * index / 64)
    ]);
    return [
      { kind: "segment", from: pieces[0].from, to: pieces[0].to, width },
      ...points.slice(1).map((point, index) => ({ kind: "segment", from: points[index], to: point, width })),
      { kind: "segment", from: pieces[2].from, to: pieces[2].to, width }
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

function serializedLine(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<line\\b(?=[^>]*\\bid="${escaped}")[^>]*>`, "u"));
  assert.ok(tag, `missing serialized line ${id}`);
  const attributes = Object.fromEntries(Array.from(tag[0].matchAll(/([\w-]+)="([^"]*)"/gu), (entry) => [entry[1], entry[2]]));
  return {
    from: [Number(attributes.x1), Number(attributes.y1)],
    to: [Number(attributes.x2), Number(attributes.y2)]
  };
}

function pointOnSegment(point, start, end, tolerance = 1e-8) {
  if (pointLineDistance(point, start, end) > tolerance) return false;
  return point[0] >= Math.min(start[0], end[0]) - tolerance && point[0] <= Math.max(start[0], end[0]) + tolerance &&
    point[1] >= Math.min(start[1], end[1]) - tolerance && point[1] <= Math.max(start[1], end[1]) + tolerance;
}

function pointStrictlyInsidePolygon(point, polygon, tolerance = 1e-8) {
  if (polygon.some((start, index) => pointOnSegment(point, start, polygon[(index + 1) % polygon.length], tolerance))) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const left = polygon[index];
    const right = polygon[previous];
    if ((left[1] > point[1]) !== (right[1] > point[1]) &&
        point[0] < (right[0] - left[0]) * (point[1] - left[1]) / (right[1] - left[1]) + left[0]) inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(point, start, end) {
  const delta = subtractPoints(end, start);
  const squared = delta[0] ** 2 + delta[1] ** 2;
  const parameter = Math.max(0, Math.min(1, ((point[0] - start[0]) * delta[0] + (point[1] - start[1]) * delta[1]) / squared));
  return Math.hypot(point[0] - start[0] - parameter * delta[0], point[1] - start[1] - parameter * delta[1]);
}

function polygonFor(element) {
  if (element.kind === "rect") return [[element.x, element.y], [element.x + element.width, element.y], [element.x + element.width, element.y + element.height], [element.x, element.y + element.height]];
  if (element.kind === "body" || element.kind === "polygon") return element.points;
  assert.fail(`unsupported body primitive ${element.id}/${element.kind}`);
}

function pointOnPrimitiveBoundary(point, element, tolerance = 1e-8) {
  return primitiveSegments(element).some(([start, end]) => pointOnSegment(point, start, end, tolerance));
}

function normalizedDirection(from, to) {
  const delta = subtractPoints(to, from);
  const magnitude = Math.hypot(delta[0], delta[1]);
  return [delta[0] / magnitude, delta[1] / magnitude];
}

function directedAngleTravel(fromAngle, toAngle, sweep) {
  let delta = sweep === 1 ? toAngle - fromAngle : fromAngle - toAngle;
  while (delta < 0) delta += Math.PI * 2;
  while (delta >= Math.PI * 2) delta -= Math.PI * 2;
  return delta;
}

function primitiveSegments(element) {
  if (element.kind === "line") return [[element.from, element.to]];
  if (element.kind === "rect") {
    const points = [[element.x, element.y], [element.x + element.width, element.y], [element.x + element.width, element.y + element.height], [element.x, element.y + element.height]];
    return points.map((point, index) => [point, points[(index + 1) % points.length]]);
  }
  if (["body", "polygon", "polyline"].includes(element.kind)) {
    const limit = element.kind === "polyline" ? element.points.length - 1 : element.points.length;
    return Array.from({ length: limit }, (_, index) => [element.points[index], element.points[(index + 1) % element.points.length]]);
  }
  return [];
}

function convexHull(points) {
  const sorted = points.map((point) => point.slice()).sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const cross = (origin, left, right) => (left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0]);
  const half = (input) => {
    const result = [];
    input.forEach((point) => {
      while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    });
    return result;
  };
  return half(sorted).slice(0, -1).concat(half(sorted.slice().reverse()).slice(0, -1));
}

function outsideConvexHullBy(point, hull, clearance) {
  return hull.some((start, index) => {
    const end = hull[(index + 1) % hull.length];
    const signedDistance = ((end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])) / Math.hypot(end[0] - start[0], end[1] - start[1]);
    return signedDistance < -clearance;
  });
}

function sameUndirectedSegment(left, right) {
  const same = (a, b) => close(a[0], b[0]) && close(a[1], b[1]);
  return (same(left[0], right[0]) && same(left[1], right[1])) || (same(left[0], right[1]) && same(left[1], right[0]));
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

test("slots one through four expose exactly 100 prompt and 40 solution manifests with unique accessible provenance", () => {
  const slots = loadSlots();
  const prompts = [1, 2, 3, 4].flatMap((slot) => slots[slot].map((question) => ({ question, manifest: question.sourceData.diagram, html: question.promptHtml })));
  const solutions = [1, 2, 3, 4].flatMap((slot) => slots[slot].filter((question) => question.sourceData.solutionDiagram).map((question) => ({ question, manifest: question.sourceData.solutionDiagram, html: question.solutionHtml })));
  assert.equal(prompts.length, 100);
  assert.equal(solutions.length, 40);
  assert.equal(slots[3].filter((question) => question.sourceData.solutionDiagram).length, 0);
  assert.equal(slots[4].filter((question) => question.sourceData.solutionDiagram).length, 25);
  const domIds = [];
  prompts.concat(solutions).forEach(({ question, manifest, html }, index) => {
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    const isSolution = index >= prompts.length;
    assert.equal(manifest.purpose, isSolution ? "solution" : "prompt", question.id);
    assert.equal(manifest.id, `${question.id}-${isSolution ? "solution-" : ""}diagram`, question.id);
    assert.equal(manifest.ariaLabelledby, `${manifest.id}-title ${manifest.id}-desc`, question.id);
    assert.ok(html.includes(`id="${manifest.id}"`), question.id);
    assert.ok(html.includes(`aria-labelledby="${manifest.ariaLabelledby}"`), question.id);
    if (isSolution) assert.equal((html.match(/<svg\b/gu) || []).length, 1, `${question.id}: exactly one solution SVG`);
    domIds.push(...manifest.domIds);
  });
  assert.equal(new Set(domIds).size, domIds.length, "all slot 1-4 fragment IDs are globally unique");
});

test("all physics figures have the exact prompt and former-drawing solution inventory", () => {
  const slots = loadSlots();
  const prompts = Object.values(slots).flatMap((questions) => questions.map((question) => ({ question, manifest: question.sourceData.diagram, html: question.promptHtml })));
  const solutions = Object.values(slots).flatMap((questions) => questions.filter((question) => question.sourceData.solutionDiagram).map((question) => ({ question, manifest: question.sourceData.solutionDiagram, html: question.solutionHtml })));
  const expectedSolutionIds = new Set([
    ...slots[1].filter((question) => question.sourceData.family === "contact-equilibrium").map((question) => question.id),
    ...slots[4].map((question) => question.id),
    ...slots[5].map((question) => question.id)
  ]);

  assert.equal(prompts.length, 125);
  assert.equal(solutions.length, 65);
  Object.values(slots).flat().forEach((question) => assert.equal(Boolean(question.sourceData.solutionDiagram), expectedSolutionIds.has(question.id), question.id));
  const domIds = [];
  prompts.concat(solutions).forEach(({ question, manifest, html }, index) => {
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    const isSolution = index >= prompts.length;
    assert.equal(manifest.purpose, isSolution ? "solution" : "prompt", question.id);
    assert.equal(manifest.id, `${question.id}-${isSolution ? "solution-" : ""}diagram`, question.id);
    assert.equal(manifest.ariaLabelledby, `${manifest.id}-title ${manifest.id}-desc`, question.id);
    assert.ok(html.includes(`id="${manifest.id}"`), question.id);
    assert.ok(html.includes(`aria-labelledby="${manifest.ariaLabelledby}"`), question.id);
    if (isSolution) assert.equal((html.match(/<svg\b/gu) || []).length, 1, `${question.id}: exactly one solution SVG`);
    domIds.push(...manifest.domIds);
  });
  assert.equal(new Set(domIds).size, domIds.length, "all 190 physics figure DOM IDs are globally unique");
});

test("all slot-five prompts derive contacts, angles, arrows and pulley topology from physical geometry", () => {
  const questions = loadSlots()[5];
  const horizontalFamilies = new Set(["horizontal-pull", "unknown-pull", "unknown-friction"]);
  assert.equal(questions.length, 25);

  questions.forEach((question) => {
    const manifest = question.sourceData.diagram;
    const family = question.sourceData.family;
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    assert.equal(manifest.purpose, "prompt", question.id);
    assert.equal(manifest.elements.some((element) => /force-(?:weight|normal|friction)/u.test(element.id)), false, `${question.id}: prompt must not reveal the requested force set`);
    assert.ok(manifest.elements.filter((element) => element.role === "force").length <= 1, `${question.id}: prompt has at most one given force`);

    if (horizontalFamilies.has(family)) {
      const ground = manifestElement(manifest, `${question.id}-ground`);
      const body = manifestElement(manifest, `${question.id}-body`);
      assert.equal(body.kind, "body", question.id);
      body.points.slice(0, 2).forEach((corner) => {
        assert.ok(pointOnSegment(corner, ground.from, ground.to, 0.01), `${question.id}: whole bottom edge lies on floor`);
      });
      body.points.slice(2).forEach((corner) => assert.ok(Math.abs(pointLineDistance(corner, ground.from, ground.to) - body.height) <= 0.01, `${question.id}: body stays on one side of floor`));
      const requiredArrows = family === "horizontal-pull"
        ? [`${question.id}-applied-force`]
        : family === "unknown-pull"
          ? [`${question.id}-motion-arrow`]
          : [`${question.id}-drive-force`, `${question.id}-motion-arrow`];
      requiredArrows.forEach((arrowId) => {
        const arrow = manifestElement(manifest, arrowId);
        assert.ok(pointOnPrimitiveBoundary(arrow.from, body), `${arrowId}: starts on body`);
        assert.ok(arrow.to[0] > arrow.from[0] && close(arrow.to[1], arrow.from[1]), `${arrowId}: points right`);
      });
    } else if (family === "inclined-plane") {
      const plane = manifestElement(manifest, `${question.id}-plane`);
      const support = manifestElement(manifest, `${question.id}-plane-support`);
      const horizontal = manifestElement(manifest, `${question.id}-horizontal-reference`);
      const body = manifestElement(manifest, `${question.id}-body`);
      const arc = manifestElement(manifest, `${question.id}-incline-angle`);
      const motion = manifestElement(manifest, `${question.id}-motion-arrow`);
      body.points.slice(0, 2).forEach((corner) => assert.ok(pointOnSegment(corner, plane.from, plane.to, 0.01), `${question.id}: both bottom corners lie on actual incline`));
      body.points.slice(2).forEach((corner) => {
        const displacement = subtractPoints(corner, body.points[0]);
        assert.ok(displacement[0] * body.outwardNormal[0] + displacement[1] * body.outwardNormal[1] > 0, `${question.id}: other corners point outward`);
      });
      assertPoint(arc.vertex, plane.from, `${question.id}: angle uses plane vertex`);
      assertPoint(horizontal.from, arc.vertex, `${question.id}: horizontal reference shares vertex`);
      assert.ok(close(horizontal.from[1], horizontal.to[1]) && horizontal.to[0] > horizontal.from[0], `${question.id}: horizontal reference ray`);
      const planeDirection = normalizedDirection(plane.from, plane.to);
      assert.ok(close(arc.fromRay[0], 1) && close(arc.fromRay[1], 0), `${question.id}: angle begins on horizontal`);
      assertPoint(arc.toRay, planeDirection, `${question.id}: angle ends on incline`);
      assert.ok(close(Math.acos(arc.fromRay[0] * arc.toRay[0] + arc.fromRay[1] * arc.toRay[1]) * 180 / Math.PI, question.sourceData.givens.angleDeg), `${question.id}: authored incline angle`);
      const angleLabel = manifest.labels.find((label) => label.id === `${question.id}-angle-label`);
      const angleBox = manifest.backgrounds.find((background) => background.labelId === angleLabel.id).bbox;
      const labelCenter = boxCenter(angleBox);
      const labelRay = normalizedDirection(arc.vertex, labelCenter);
      const fromAngle = Math.atan2(arc.fromRay[1], arc.fromRay[0]);
      const labelAngle = Math.atan2(labelRay[1], labelRay[0]);
      const totalTravel = directedAngleTravel(fromAngle, Math.atan2(arc.toRay[1], arc.toRay[0]), arc.sweep);
      const labelTravel = directedAngleTravel(fromAngle, labelAngle, arc.sweep);
      assert.ok(labelTravel > 0 && labelTravel < totalTravel, `${question.id}: angle label lies in correct sector`);
      assert.ok(Math.hypot(labelCenter[0] - arc.vertex[0], labelCenter[1] - arc.vertex[1]) > arc.radius + 6, `${question.id}: angle label lies outside arc`);
      assert.equal(pointStrictlyInsidePolygon(labelCenter, support.points), false, `${question.id}: angle label is outside support triangle`);
      assert.ok(pointOnPrimitiveBoundary(motion.from, body), `${question.id}: motion starts on body`);
      const downhill = [-planeDirection[0], -planeDirection[1]];
      const motionDirection = normalizedDirection(motion.from, motion.to);
      assert.ok(motionDirection[0] * downhill[0] + motionDirection[1] * downhill[1] > 1 - 1e-8, `${question.id}: motion points down slope`);
    } else {
      const table = manifestElement(manifest, `${question.id}-tabletop`);
      const tableBody = manifestElement(manifest, `${question.id}-table-body`);
      const hangingBody = manifestElement(manifest, `${question.id}-hanging-body`);
      const pulley = manifestElement(manifest, `${question.id}-pulley`);
      const rope = manifestElement(manifest, `${question.id}-rope`);
      const bodies = [polygonFor(tableBody), polygonFor(hangingBody)];
      assert.equal(tableBody.role, "table-body", `${question.id}: preserve table-body role`);
      assert.equal(hangingBody.role, "hanging-body", `${question.id}: preserve hanging-body role`);
      assert.equal(pulley.role, "pulley", `${question.id}: preserve pulley role`);
      assert.equal(rope.role, "rope", `${question.id}: preserve rope role`);
      tableBody.points.slice(0, 2).forEach((corner) => assert.ok(pointOnSegment(corner, table.from, table.to, 0.01), `${question.id}: table body rests on tabletop`));
      assert.ok(pointOnPrimitiveBoundary(rope.from, tableBody), `${question.id}: rope starts at actual table-body attachment`);
      assert.ok(pointOnPrimitiveBoundary(rope.to, hangingBody), `${question.id}: rope ends at actual hanging-body attachment`);
      assert.equal(rope.segments.length, 3, `${question.id}: line-arc-line rope`);
      const [incoming, ropeArc, outgoing] = rope.segments;
      assertPoint(incoming.from, rope.from, `${question.id}: continuous incoming start`);
      assertPoint(incoming.to, rope.fromTangent, `${question.id}: continuous first tangent`);
      assertPoint(ropeArc.from, rope.fromTangent, `${question.id}: arc starts at first tangent`);
      assertPoint(ropeArc.to, rope.toTangent, `${question.id}: arc ends at second tangent`);
      assertPoint(outgoing.from, rope.toTangent, `${question.id}: continuous second tangent`);
      assertPoint(outgoing.to, rope.to, `${question.id}: continuous rope endpoint`);
      [rope.fromTangent, rope.toTangent].forEach((tangent, index) => {
        const external = index === 0 ? rope.from : rope.to;
        const radiusDirection = normalizedDirection(pulley.center, tangent);
        const straightDirection = normalizedDirection(tangent, external);
        assert.ok(Math.abs(radiusDirection[0] * straightDirection[0] + radiusDirection[1] * straightDirection[1]) <= 1e-8, `${question.id}: straight segment tangent ${index + 1}`);
      });
      const incomingDirection = normalizedDirection(incoming.from, incoming.to);
      const outgoingDirection = normalizedDirection(outgoing.from, outgoing.to);
      const firstArcDirection = normalizedDirection([0, 0], [ropeArc.sweep * -(ropeArc.from[1] - pulley.center[1]), ropeArc.sweep * (ropeArc.from[0] - pulley.center[0])]);
      const lastArcDirection = normalizedDirection([0, 0], [ropeArc.sweep * -(ropeArc.to[1] - pulley.center[1]), ropeArc.sweep * (ropeArc.to[0] - pulley.center[0])]);
      assert.ok(incomingDirection[0] * firstArcDirection[0] + incomingDirection[1] * firstArcDirection[1] > 1 - 1e-7, `${question.id}: C1 at first tangent`);
      assert.ok(outgoingDirection[0] * lastArcDirection[0] + outgoingDirection[1] * lastArcDirection[1] > 1 - 1e-7, `${question.id}: C1 at second tangent`);
      const ropeSamples = [];
      [incoming, outgoing].forEach((segment) => {
        for (let index = 1; index < 10; index += 1) ropeSamples.push([segment.from[0] + (segment.to[0] - segment.from[0]) * index / 10, segment.from[1] + (segment.to[1] - segment.from[1]) * index / 10]);
      });
      const startAngle = Math.atan2(ropeArc.from[1] - pulley.center[1], ropeArc.from[0] - pulley.center[0]);
      for (let index = 0; index <= 20; index += 1) ropeSamples.push([pulley.center[0] + pulley.radius * Math.cos(startAngle + ropeArc.sweep * ropeArc.delta * index / 20), pulley.center[1] + pulley.radius * Math.sin(startAngle + ropeArc.sweep * ropeArc.delta * index / 20)]);
      ropeSamples.forEach((point) => bodies.forEach((body) => assert.equal(pointStrictlyInsidePolygon(point, body), false, `${question.id}: rope stays outside bodies`)));
      bodies.forEach((body) => {
        assert.equal(pointStrictlyInsidePolygon(pulley.center, body), false, `${question.id}: pulley center outside body`);
        assert.ok(Math.min(...body.map((point, index) => pointSegmentDistance(pulley.center, point, body[(index + 1) % body.length]))) >= pulley.radius - 0.01, `${question.id}: pulley does not enter body interior`);
      });
      const tableMotion = manifestElement(manifest, `${question.id}-table-motion-arrow`);
      const hangingMotion = manifestElement(manifest, `${question.id}-hanging-motion-arrow`);
      assert.ok(pointOnPrimitiveBoundary(tableMotion.from, tableBody) && tableMotion.to[0] > tableMotion.from[0] && close(tableMotion.to[1], tableMotion.from[1]), `${question.id}: table motion starts at body and points right`);
      assert.ok(pointOnPrimitiveBoundary(hangingMotion.from, hangingBody) && hangingMotion.to[1] > hangingMotion.from[1] && close(hangingMotion.to[0], hangingMotion.from[0]), `${question.id}: hanging motion starts at body and points down`);
    }
  });
});

test("all slot-five solution figures contain complete force sets that satisfy each body's equations and moments", () => {
  const arrowVector = (arrow, magnitude) => {
    const direction = normalizedDirection(arrow.from, arrow.to);
    return [direction[0] * magnitude, direction[1] * magnitude];
  };
  const addVectors = (vectors) => vectors.reduce((sum, vector) => [sum[0] + vector[0], sum[1] + vector[1]], [0, 0]);
  const centerOf = (body) => body.kind === "rect"
    ? [body.x + body.width / 2, body.y + body.height / 2]
    : body.points.reduce((sum, point) => [sum[0] + point[0] / body.points.length, sum[1] + point[1] / body.points.length], [0, 0]);
  const assertBodyForces = (question, body, forceSpecs, expectedResultant) => {
    const center = centerOf(body);
    const vectors = forceSpecs.map(({ id, magnitude, direction }) => {
      const arrow = manifestElement(question.sourceData.solutionDiagram, `${question.id}-${id}`);
      assert.equal(arrow.role, "force", `${question.id}/${id}`);
      assert.ok(pointStrictlyInsidePolygon(arrow.from, polygonFor(body)) || pointOnPrimitiveBoundary(arrow.from, body), `${question.id}/${id}: force originates on isolated body`);
      const unit = normalizedDirection(arrow.from, arrow.to);
      assert.ok(unit[0] * direction[0] + unit[1] * direction[1] > 1 - 1e-8, `${question.id}/${id}: force direction`);
      const vector = arrowVector(arrow, magnitude);
      return { arrow, vector };
    });
    const resultant = addVectors(vectors.map((item) => item.vector));
    assert.ok(close(resultant[0], expectedResultant[0], 1e-8) && close(resultant[1], expectedResultant[1], 1e-8), `${question.id}: component equation ${resultant} != ${expectedResultant}`);
    const moment = vectors.reduce((sum, item) => sum + (item.arrow.from[0] - center[0]) * item.vector[1] - (item.arrow.from[1] - center[1]) * item.vector[0], 0);
    assert.ok(close(moment, 0, 1e-8), `${question.id}: signed moment about isolated body centre`);
  };

  loadSlots()[5].forEach((question) => {
    const data = question.sourceData;
    const p = data.givens;
    const manifest = data.solutionDiagram;
    assert.doesNotThrow(() => diagramKit.validateManifest(manifest), question.id);
    assert.equal(manifest.purpose, "solution", question.id);
    assert.equal((question.solutionHtml.match(/<svg\b/gu) || []).length, 1, question.id);
    const forceElements = manifest.elements.filter((element) => element.role === "force");
    forceElements.forEach((force) => assert.ok(manifest.labels.some((label) => label.anchorId === force.id), `${force.id}: labelled force`));

    if (data.family === "connected-masses") {
      assert.equal(forceElements.length, 6, `${question.id}: complete two-body force set`);
      const tableBody = manifestElement(manifest, `${question.id}-isolated-table-body`);
      const hangingBody = manifestElement(manifest, `${question.id}-isolated-hanging-body`);
      const friction = p.frictionCoefficient * p.tableMassKg * G;
      const acceleration = (p.hangingMassKg * G - friction) / (p.tableMassKg + p.hangingMassKg);
      const tension = p.tableMassKg * acceleration + friction;
      assertBodyForces(question, tableBody, [
        { id: "table-force-weight", magnitude: p.tableMassKg * G, direction: [0, 1] },
        { id: "table-force-normal", magnitude: p.tableMassKg * G, direction: [0, -1] },
        { id: "table-force-tension", magnitude: tension, direction: [1, 0] },
        { id: "table-force-friction", magnitude: friction, direction: [-1, 0] }
      ], [p.tableMassKg * acceleration, 0]);
      assertBodyForces(question, hangingBody, [
        { id: "hanging-force-weight", magnitude: p.hangingMassKg * G, direction: [0, 1] },
        { id: "hanging-force-tension", magnitude: tension, direction: [0, -1] }
      ], [0, p.hangingMassKg * acceleration]);
      const tensionLabels = manifest.labels.filter((label) => label.anchorId.endsWith("force-tension"));
      assert.equal(tensionLabels.length, 2, `${question.id}: paired tension labels`);
      assert.ok(tensionLabels.every((label) => label.text === "T"), `${question.id}: same ideal-rope tension`);
      assert.ok(centerOf(tableBody)[0] + 100 < centerOf(hangingBody)[0], `${question.id}: isolated bodies are separated`);
    } else if (data.family === "inclined-plane") {
      assert.equal(forceElements.length, 3, `${question.id}: complete incline force set`);
      const body = manifestElement(manifest, `${question.id}-isolated-body`);
      const theta = p.angleDeg * Math.PI / 180;
      const uphill = [Math.cos(theta), -Math.sin(theta)];
      const outward = [-Math.sin(theta), -Math.cos(theta)];
      const downhill = [-uphill[0], -uphill[1]];
      const acceleration = G * Math.sin(theta) - p.frictionForceN / p.massKg;
      assertBodyForces(question, body, [
        { id: "force-weight", magnitude: p.massKg * G, direction: [0, 1] },
        { id: "force-normal", magnitude: p.massKg * G * Math.cos(theta), direction: outward },
        { id: "force-friction", magnitude: p.frictionForceN, direction: uphill }
      ], [p.massKg * acceleration * downhill[0], p.massKg * acceleration * downhill[1]]);
    } else {
      assert.equal(forceElements.length, 4, `${question.id}: complete horizontal force set`);
      const body = manifestElement(manifest, `${question.id}-isolated-body`);
      const acceleration = data.family === "unknown-pull" ? p.accelerationMps2 : data.family === "unknown-friction" ? p.finalSpeedMps / p.elapsedS : (p.pullForceN - p.frictionCoefficient * p.massKg * G) / p.massKg;
      const friction = data.family === "unknown-friction" ? p.driveForceN - p.massKg * acceleration : p.frictionCoefficient * p.massKg * G;
      const applied = data.family === "horizontal-pull" ? p.pullForceN : data.family === "unknown-pull" ? p.massKg * acceleration + friction : p.driveForceN;
      assertBodyForces(question, body, [
        { id: "force-weight", magnitude: p.massKg * G, direction: [0, 1] },
        { id: "force-normal", magnitude: p.massKg * G, direction: [0, -1] },
        { id: "force-applied", magnitude: applied, direction: [1, 0] },
        { id: "force-friction", magnitude: friction, direction: [-1, 0] }
      ], [p.massKg * acceleration, 0]);
    }
  });
});

test("all vertical-motion prompts derive origin, ground, body, trajectory and motion direction from one semantic path", () => {
  loadSlots()[3].forEach((question) => {
    const manifest = question.sourceData.diagram;
    const ground = manifestElement(manifest, `${question.id}-ground`);
    const origin = manifestElement(manifest, `${question.id}-origin`);
    const body = manifestElement(manifest, `${question.id}-body`);
    const trajectory = manifestElement(manifest, `${question.id}-trajectory`);
    const motion = manifestElement(manifest, `${question.id}-motion-arrow`);
    const sign = manifestElement(manifest, `${question.id}-positive-arrow`);
    assert.equal(motion.role, "motion", question.id);
    assert.equal(sign.role, "axis", question.id);
    assert.equal(manifest.elements.some((element) => element.role === "force"), false, `${question.id}: motion prompt has no force arrow`);
    assert.ok(pointOnSegment(origin.center, ground.from, ground.to), `${question.id}: origin lies on ground`);
    assert.ok(pointOnSegment(origin.center, trajectory.from, trajectory.to), `${question.id}: origin lies on trajectory`);
    assert.ok(pointOnSegment(body.center, trajectory.from, trajectory.to), `${question.id}: body centre lies on trajectory`);
    assertPoint(motion.from, body.center, `${question.id}: motion starts at body centre`);
    assert.ok(pointOnSegment(motion.to, trajectory.from, trajectory.to), `${question.id}: motion follows trajectory`);
    assert.ok(motion.to[1] < motion.from[1], `${question.id}: launch direction is upward`);
    assert.ok(close(sign.from[0], sign.to[0]) && sign.to[1] < sign.from[1], `${question.id}: positive y direction is upward`);
    const zones = question.sourceData.diagramLayout;
    assert.deepEqual(Object.keys(zones).sort(), ["height", "sign", "velocity"], question.id);
    manifest.labels.forEach((label) => {
      const zone = label.id.endsWith("-height-label") ? zones.height : label.id.endsWith("-positive-label") || label.id.endsWith("-origin-label") ? zones.sign : zones.velocity;
      assert.ok(label.bbox.x >= zone.x && label.bbox.y >= zone.y && label.bbox.x + label.bbox.width <= zone.x + zone.width && label.bbox.y + label.bbox.height <= zone.y + zone.height, `${label.id}: typed local zone`);
    });
  });
});

test("zero initial-height motion bodies touch ground while positive heights retain a real nonzero measure", () => {
  const questions = loadSlots()[3].filter((question) => question.sourceData.givens.initialHeightM !== undefined);
  const zero = questions.filter((question) => question.sourceData.givens.initialHeightM === 0);
  const positive = questions.filter((question) => question.sourceData.givens.initialHeightM > 0);
  assert.deepEqual(zero.map((question) => question.id), [
    "physics-s3-maximum-height-01",
    "physics-s3-maximum-height-04",
    "physics-s3-flight-time-01"
  ]);
  assert.equal(positive.length, 12);
  zero.forEach((question) => {
    const manifest = question.sourceData.diagram;
    const ground = manifestElement(manifest, `${question.id}-ground`);
    const body = manifestElement(manifest, `${question.id}-body`);
    const origin = manifestElement(manifest, `${question.id}-origin`);
    assert.ok(close(body.center[1] + body.radius, ground.from[1]), `${question.id}: zero-height body is bottom-tangent to ground`);
    assert.equal(manifest.elements.some((element) => element.id === `${question.id}-height-measure`), false, `${question.id}: zero height has no nonzero measure line`);
    const zeroLabel = manifestElement(manifest, `${question.id}-origin-label`);
    assert.match(zeroLabel.text, /y₀\s*=\s*0.*marknivå/iu, question.id);
    assert.equal(zeroLabel.anchorId, origin.id, question.id);
  });
  const scales = positive.map((question) => {
    const manifest = question.sourceData.diagram;
    const ground = manifestElement(manifest, `${question.id}-ground`);
    const body = manifestElement(manifest, `${question.id}-body`);
    const measure = manifestElement(manifest, `${question.id}-height-measure`);
    assertPoint(measure.from, [measure.from[0], ground.from[1]], `${question.id}: height starts at ground`);
    assertPoint(measure.to, [measure.to[0], body.center[1] + body.radius], `${question.id}: height ends at body bottom`);
    assert.ok(measure.from[1] > measure.to[1], `${question.id}: positive height is nonzero and upward`);
    return (measure.from[1] - measure.to[1]) / question.sourceData.givens.initialHeightM;
  });
  scales.forEach((scale) => assert.ok(close(scale, scales[0]), `positive y₀ values share one geometric scale: ${scales}`));
});

test("cable angle labels are derived from the painted arc bisector rather than fixed zones", () => {
  loadSlots()[4].filter((question) => ["cables-at-angles", "frictionless-wall-contact"].includes(question.sourceData.family)).forEach((question) => {
    const manifest = question.sourceData.diagram;
    const arc = manifestElement(manifest, `${question.id}-cable-angle`);
    const label = manifestElement(manifest, `${question.id}-angle-label`);
    const start = Math.atan2(arc.fromRay[1], arc.fromRay[0]);
    const end = Math.atan2(arc.toRay[1], arc.toRay[0]);
    const turn = (angle) => {
      let delta = angle - start;
      if (arc.sweep === 1 && delta < 0) delta += Math.PI * 2;
      if (arc.sweep === -1 && delta > 0) delta -= Math.PI * 2;
      return delta;
    };
    const total = turn(end);
    const center = boxCenter(label.bbox);
    const vector = subtractPoints(center, arc.vertex);
    const progress = turn(Math.atan2(vector[1], vector[0]));
    assert.ok(Math.sign(progress) === Math.sign(total) && Math.abs(progress) > 1e-3 && Math.abs(progress) < Math.abs(total) - 1e-3, `${question.id}: label centre lies strictly inside directed sector`);
    assert.ok(Math.abs(progress - total / 2) <= 0.09, `${question.id}: label centre follows arc bisector`);
    const radius = Math.hypot(...vector);
    assert.ok(radius > arc.radius + 15 && radius < arc.radius + 95, `${question.id}: label remains near its arc`);
  });
});

test("hanging solution preserves the prompt stack and uses three collinear non-layered force shafts", () => {
  loadSlots()[4].filter((question) => question.sourceData.family === "hanging-masses").forEach((question) => {
    const prompt = question.sourceData.diagram;
    const solution = question.sourceData.solutionDiagram;
    const promptUpper = manifestElement(prompt, `${question.id}-upper-body`);
    const promptLower = manifestElement(prompt, `${question.id}-lower-body`);
    const promptRopes = [manifestElement(prompt, `${question.id}-upper-rope`), manifestElement(prompt, `${question.id}-lower-rope`)];
    const commonX = promptUpper.x + promptUpper.width / 2;
    assert.ok(close(promptLower.x + promptLower.width / 2, commonX) && promptRopes.every((rope) => close(rope.from[0], commonX) && close(rope.to[0], commonX)), question.id);
    const upper = manifestElement(solution, `${question.id}-isolated-upper-body`);
    const lower = manifestElement(solution, `${question.id}-isolated-lower-body`);
    assert.ok(upper.y + upper.height < lower.y, `${question.id}: isolated bodies retain stacked order`);
    assert.ok(close(upper.x + upper.width / 2, commonX) && close(lower.x + lower.width / 2, commonX), `${question.id}: solution bodies retain prompt line of action`);
    const tension = manifestElement(solution, `${question.id}-force-tension`);
    const upperWeight = manifestElement(solution, `${question.id}-force-upper-weight`);
    const lowerWeight = manifestElement(solution, `${question.id}-force-lower-weight`);
    [tension, upperWeight, lowerWeight].forEach((force) => assert.ok(close(force.from[0], commonX) && close(force.to[0], commonX), `${force.id}: prompt-collinear force`));
    assertPoint(tension.from, [commonX, upper.y], `${question.id}: tension starts at top connection`);
    assertPoint(upperWeight.from, [commonX, upper.y + upper.height / 2], `${question.id}: m1g starts at upper COM`);
    assertPoint(lowerWeight.from, [commonX, lower.y + lower.height / 2], `${question.id}: m2g starts at lower COM`);
    const shafts = [tension, upperWeight, lowerWeight].map((force) => [Math.min(force.from[1], force.to[1]), Math.max(force.from[1], force.to[1])]);
    shafts.forEach((shaft, index) => shafts.slice(index + 1).forEach((other) => assert.ok(shaft[1] < other[0] || other[1] < shaft[0], `${question.id}: force shafts do not overlap`)));
    const totalMass = question.sourceData.givens.upperMassKg + question.sourceData.givens.lowerMassKg;
    assert.ok(close(totalMass * question.sourceData.g - question.sourceData.givens.upperMassKg * question.sourceData.g - question.sourceData.givens.lowerMassKg * question.sourceData.g, 0), `${question.id}: force sum`);
  });
});

test("beam prompt declares the COM that the solution uses with the exact prompt support contacts", () => {
  loadSlots()[4].filter((question) => question.sourceData.family === "supported-beams").forEach((question) => {
    const data = question.sourceData;
    const prompt = data.diagram;
    const solution = data.solutionDiagram;
    const body = manifestElement(prompt, `${question.id}-body`);
    const underside = body.points.slice(0, 2);
    const supportX = ["left", "right"].map((side) => {
      const support = manifestElement(prompt, `${question.id}-${side}-support`);
      return support.points.find((point) => pointOnSegment(point, underside[0], underside[1]))[0];
    });
    const com = manifestElement(prompt, `${question.id}-center-of-mass`);
    const weight = data.givens.massKg * data.g;
    const secondReaction = weight - data.givens.knownSupportN;
    const expectedComX = (data.givens.knownSupportN * supportX[0] + secondReaction * supportX[1]) / weight;
    assert.ok(close(com.center[0], expectedComX), `${question.id}: prompt COM follows authored reactions`);
    assert.ok(pointInsideBox(com.center, body.bbox), `${question.id}: COM mark lies on prompt beam`);
    assert.match(prompt.description, /markerad tyngdpunkt/iu, question.id);
    assert.equal(prompt.elements.some((element) => element.id === `${question.id}-force-weight` || element.id === `${question.id}-force-support-right`), false, `${question.id}: prompt does not leak weight or unknown reaction`);
    const left = manifestElement(solution, `${question.id}-force-support-left`);
    const right = manifestElement(solution, `${question.id}-force-support-right`);
    const gravity = manifestElement(solution, `${question.id}-force-weight`);
    assert.ok(close(left.from[0], supportX[0]) && close(right.from[0], supportX[1]), `${question.id}: solution reactions use prompt contacts`);
    assert.ok(close(gravity.from[0], com.center[0]), `${question.id}: solution weight uses prompt COM vertical`);
    const resultant = data.givens.knownSupportN + secondReaction - weight;
    const moment = (supportX[0] - com.center[0]) * data.givens.knownSupportN + (supportX[1] - com.center[0]) * secondReaction;
    assert.ok(close(resultant, 0) && close(moment, 0), `${question.id}: independent prompt-geometry force and moment balance`);
  });
});

test("static prompt geometry uses exact body contacts, declared horizontal angles and only the given vectors", () => {
  loadSlots()[4].forEach((question) => {
    const data = question.sourceData;
    const manifest = data.diagram;
    const promptForces = manifest.elements.filter((element) => element.role === "force");
    if (data.family === "hanging-masses") {
      const upper = manifestElement(manifest, `${question.id}-upper-body`);
      const lower = manifestElement(manifest, `${question.id}-lower-body`);
      const upperRope = manifestElement(manifest, `${question.id}-upper-rope`);
      const lowerRope = manifestElement(manifest, `${question.id}-lower-rope`);
      const ceiling = manifestElement(manifest, `${question.id}-ceiling`);
      assert.ok(pointOnSegment(upperRope.from, ceiling.from, ceiling.to), `${question.id}: upper rope starts at ceiling anchor`);
      assertPoint(upperRope.to, [upper.x + upper.width / 2, upper.y], `${question.id}: upper rope ends on upper body top edge`);
      assertPoint(lowerRope.from, [upper.x + upper.width / 2, upper.y + upper.height], `${question.id}: lower rope starts on upper body bottom edge`);
      assertPoint(lowerRope.to, [lower.x + lower.width / 2, lower.y], `${question.id}: lower rope ends on lower body top edge`);
      assert.equal(promptForces.length, 0, question.id);
    } else if (data.family === "cables-at-angles") {
      const body = manifestElement(manifest, `${question.id}-body`);
      const leftCable = manifestElement(manifest, `${question.id}-left-cable`);
      const rightCable = manifestElement(manifest, `${question.id}-right-cable`);
      const angle = manifestElement(manifest, `${question.id}-cable-angle`);
      const reference = manifestElement(manifest, `${question.id}-horizontal-reference`);
      const ceiling = manifestElement(manifest, `${question.id}-ceiling`);
      const leftCorner = [body.x, body.y];
      const rightCorner = [body.x + body.width, body.y];
      assertPoint(leftCable.to, leftCorner, `${question.id}: left cable meets body corner`);
      assertPoint(rightCable.to, rightCorner, `${question.id}: right cable meets body corner`);
      assert.ok(pointOnSegment(leftCable.from, ceiling.from, ceiling.to) && pointOnSegment(rightCable.from, ceiling.from, ceiling.to), `${question.id}: both cables start at ceiling anchors`);
      assertPoint(angle.vertex, leftCorner, `${question.id}: angle vertex is cable attachment`);
      assertPoint(angle.fromRay, [-1, 0], `${question.id}: angle starts on declared leftward horizontal ray`);
      assertPoint(reference.to, angle.vertex, `${question.id}: painted horizontal ray reaches angle vertex`);
      assert.ok(close(reference.from[1], reference.to[1]) && reference.from[0] < reference.to[0], `${question.id}: reference ray is horizontal and leftward`);
      assertPoint(angle.toRay, subtractPoints(leftCable.from, leftCable.to).map((value) => value / Math.hypot(...subtractPoints(leftCable.from, leftCable.to))), `${question.id}: angle ends on cable ray`);
      assert.ok(close(Math.acos(angle.fromRay[0] * angle.toRay[0] + angle.fromRay[1] * angle.toRay[1]), data.givens.angleDeg * Math.PI / 180), `${question.id}: angle equals stated degrees`);
      assert.equal(promptForces.length, 0, question.id);
    } else if (data.family === "missing-fourth-force") {
      const origin = manifestElement(manifest, `${question.id}-node`).center;
      const vectors = manifest.elements.filter((element) => element.kind === "arrow" && element.id.includes("-given-vector-"));
      assert.equal(vectors.length, 3, question.id);
      vectors.forEach((vector, index) => {
        const given = data.givens.forces[index];
        const magnitude = Math.hypot(given.xN, given.yN);
        assert.equal(vector.role, "arrow", vector.id);
        assertPoint(vector.from, origin, `${vector.id}: vector starts at node`);
        const drawn = subtractPoints(vector.to, vector.from);
        assertPoint(drawn.map((value) => value / Math.hypot(...drawn)), [given.xN / magnitude, -given.yN / magnitude], `${vector.id}: normalized component direction`);
      });
      assert.equal(manifest.elements.some((element) => element.id === `${question.id}-given-vector-4` || element.id === `${question.id}-force-4`), false, `${question.id}: requested fourth vector is absent`);
      assert.equal(promptForces.length, 0, question.id);
    } else if (data.family === "supported-beams") {
      const body = manifestElement(manifest, `${question.id}-body`);
      const underside = body.points.slice(0, 2);
      ["left", "right"].forEach((side) => {
        const support = manifestElement(manifest, `${question.id}-${side}-support`);
        assert.ok(support.points.some((point) => pointOnSegment(point, underside[0], underside[1])), `${question.id}: ${side} support touches beam`);
      });
      assert.equal(promptForces.length, 1, `${question.id}: prompt shows only known support reaction`);
    } else {
      const wall = manifestElement(manifest, `${question.id}-wall`);
      const sphere = manifestElement(manifest, `${question.id}-sphere`);
      const cable = manifestElement(manifest, `${question.id}-cable`);
      const angle = manifestElement(manifest, `${question.id}-cable-angle`);
      const reference = manifestElement(manifest, `${question.id}-horizontal-reference`);
      assert.ok(close(wall.from[0], wall.to[0]) && close(sphere.center[0] + sphere.radius, wall.from[0]), `${question.id}: sphere is tangent to vertical wall`);
      assert.ok(close(Math.hypot(cable.from[0] - sphere.center[0], cable.from[1] - sphere.center[1]), sphere.radius), `${question.id}: cable attaches at declared circle point`);
      assert.ok(pointOnSegment(cable.to, wall.from, wall.to), `${question.id}: cable terminates at wall anchor`);
      assertPoint(angle.vertex, cable.from, `${question.id}: wall cable angle is declared at cable attachment`);
      assertPoint(angle.fromRay, [1, 0], `${question.id}: wall cable angle starts from horizontal`);
      assertPoint(reference.from, angle.vertex, `${question.id}: painted horizontal ray starts at angle vertex`);
      assert.ok(close(reference.from[1], reference.to[1]) && reference.to[0] > reference.from[0], `${question.id}: reference ray is horizontal and rightward`);
      const cableDirection = subtractPoints(cable.to, cable.from);
      assertPoint(angle.toRay, cableDirection.map((value) => value / Math.hypot(...cableDirection)), `${question.id}: angle ends on cable ray`);
      assert.ok(close(Math.acos(angle.fromRay[0] * angle.toRay[0] + angle.fromRay[1] * angle.toRay[1]), data.givens.cableAngleDeg * Math.PI / 180), `${question.id}: wall cable angle equals stated degrees`);
      assert.equal(promptForces.length, 0, question.id);
    }
  });
});

test("all 25 static solution diagrams contain the authored complete force set and independently balance force and moment", () => {
  loadSlots()[4].forEach((question) => {
    const data = question.sourceData;
    const manifest = data.solutionDiagram;
    const forces = manifest.elements.filter((element) => element.role === "force");
    const labels = manifest.labels.filter((label) => label.id.includes("-force-")).map((label) => label.text);
    let physical;
    let center;
    if (data.family === "hanging-masses") {
      const promptUpper = manifestElement(data.diagram, `${question.id}-upper-body`);
      center = [promptUpper.x + promptUpper.width / 2, promptUpper.y + promptUpper.height / 2];
      physical = [
        { id: `${question.id}-force-tension`, vector: [0, (data.givens.upperMassKg + data.givens.lowerMassKg) * data.g] },
        { id: `${question.id}-force-upper-weight`, vector: [0, -data.givens.upperMassKg * data.g] },
        { id: `${question.id}-force-lower-weight`, vector: [0, -data.givens.lowerMassKg * data.g] }
      ];
      assert.deepEqual(labels.slice().sort(), ["T", "m₁g", "m₂g"].sort(), question.id);
    } else if (data.family === "cables-at-angles") {
      const body = manifestElement(manifest, `${question.id}-isolated-body`);
      center = boxCenter(body.bbox);
      const angle = data.givens.angleDeg * Math.PI / 180;
      const tension = data.givens.massKg * data.g / (2 * Math.sin(angle));
      physical = [
        { id: `${question.id}-force-left-tension`, vector: [-tension * Math.cos(angle), tension * Math.sin(angle)] },
        { id: `${question.id}-force-right-tension`, vector: [tension * Math.cos(angle), tension * Math.sin(angle)] },
        { id: `${question.id}-force-weight`, vector: [0, -data.givens.massKg * data.g] }
      ];
      assert.deepEqual(labels.slice().sort(), ["T", "T", "mg"].sort(), question.id);
    } else if (data.family === "missing-fourth-force") {
      center = manifestElement(manifest, `${question.id}-isolated-node`).center;
      const sum = data.givens.forces.reduce((value, force) => [value[0] + force.xN, value[1] + force.yN], [0, 0]);
      physical = data.givens.forces.map((force, index) => ({ id: `${question.id}-force-${index + 1}`, vector: [force.xN, force.yN] }))
        .concat([{ id: `${question.id}-force-4`, vector: [-sum[0], -sum[1]] }]);
      assert.deepEqual(labels.slice().sort(), ["F₁", "F₂", "F₃", "F₄"].sort(), question.id);
    } else if (data.family === "supported-beams") {
      center = manifestElement(data.diagram, `${question.id}-center-of-mass`).center;
      physical = [
        { id: `${question.id}-force-support-left`, vector: [0, data.givens.knownSupportN] },
        { id: `${question.id}-force-support-right`, vector: [0, data.givens.massKg * data.g - data.givens.knownSupportN] },
        { id: `${question.id}-force-weight`, vector: [0, -data.givens.massKg * data.g] }
      ];
      assert.deepEqual(labels.slice().sort(), ["F₁", "F₂", "mg"].sort(), question.id);
    } else {
      const sphere = manifestElement(manifest, `${question.id}-isolated-sphere`);
      center = sphere.center;
      const angle = data.givens.cableAngleDeg * Math.PI / 180;
      const tension = data.givens.massKg * data.g / Math.sin(angle);
      physical = [
        { id: `${question.id}-force-tension`, vector: [tension * Math.cos(angle), tension * Math.sin(angle)] },
        { id: `${question.id}-force-normal`, vector: [-tension * Math.cos(angle), 0] },
        { id: `${question.id}-force-weight`, vector: [0, -data.givens.massKg * data.g] }
      ];
      assert.deepEqual(labels.slice().sort(), ["N", "T", "mg"].sort(), question.id);
    }
    assert.equal(forces.length, physical.length, `${question.id}: complete force count`);
    const actual = physical.map((force) => ({ ...force, geometry: manifestElement(manifest, force.id) }));
    if (data.family === "hanging-masses") {
      const upper = manifestElement(manifest, `${question.id}-isolated-upper-body`);
      const lower = manifestElement(manifest, `${question.id}-isolated-lower-body`);
      assertPoint(actual[0].geometry.from, [upper.x + upper.width / 2, upper.y], `${question.id}: tension applied at upper connection`);
      assertPoint(actual[1].geometry.from, [upper.x + upper.width / 2, upper.y + upper.height / 2], `${question.id}: upper weight applied at COM`);
      assertPoint(actual[2].geometry.from, [lower.x + lower.width / 2, lower.y + lower.height / 2], `${question.id}: lower weight applied at COM`);
    } else if (data.family === "cables-at-angles") {
      const body = manifestElement(manifest, `${question.id}-isolated-body`);
      assertPoint(actual[0].geometry.from, [body.x, body.y], `${question.id}: left tension applied at left attachment`);
      assertPoint(actual[1].geometry.from, [body.x + body.width, body.y], `${question.id}: right tension applied at right attachment`);
      assertPoint(actual[2].geometry.from, boxCenter(body.bbox), `${question.id}: weight applied at body centre`);
    } else if (data.family === "missing-fourth-force") {
      const node = manifestElement(manifest, `${question.id}-isolated-node`);
      actual.forEach((force) => assertPoint(force.geometry.from, node.center, `${force.id}: applied to isolated node`));
    } else if (data.family === "supported-beams") {
      const body = manifestElement(manifest, `${question.id}-isolated-body`);
      actual.slice(0, 2).forEach((force) => assert.ok(pointOnSegment(force.geometry.from, body.points[0], body.points[1]), `${force.id}: reaction applied on beam underside`));
      assert.ok(pointInsideBox(actual[2].geometry.from, body.bbox), `${question.id}: weight applied to beam`);
    } else {
      const sphere = manifestElement(manifest, `${question.id}-isolated-sphere`);
      actual.forEach((force) => assertPoint(force.geometry.from, sphere.center, `${force.id}: concurrent at sphere centre`));
    }
    actual.forEach((force) => {
      const direction = [force.vector[0], -force.vector[1]];
      const magnitude = Math.hypot(...direction);
      const drawn = subtractPoints(force.geometry.to, force.geometry.from);
      assertPoint(drawn.map((value) => value / Math.hypot(...drawn)), direction.map((value) => value / magnitude), `${force.id}: authored physical direction`);
    });
    const resultant = actual.reduce((sum, force) => [sum[0] + force.vector[0], sum[1] + force.vector[1]], [0, 0]);
    const moment = actual.reduce((sum, force) => {
      const radius = [force.geometry.from[0] - center[0], center[1] - force.geometry.from[1]];
      return sum + radius[0] * force.vector[1] - radius[1] * force.vector[0];
    }, 0);
    const forceScale = Math.max(1, ...actual.map((force) => Math.hypot(...force.vector)));
    assert.ok(Math.hypot(...resultant) <= forceScale * 1e-10, `${question.id}: ΣF = 0, got ${resultant}`);
    assert.ok(Math.abs(moment) <= forceScale * manifest.width * 1e-10, `${question.id}: ΣM = 0, got ${moment}`);
  });
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
    assert.equal(Object.prototype.hasOwnProperty.call(data, "diagramGeometry"), false, `${question.id}: no copied contact geometry oracle`);
    const body = manifestElement(prompt, `${question.id}-body`);
    const promptForces = prompt.elements.filter((element) => element.role === "force");
    const solutionForces = solution.elements.filter((element) => element.role === "force");
    assert.equal(promptForces.length, 1, `${question.id}: prompt shows only the given force`);
    assert.equal(solutionForces.length, 3, `${question.id}: solution has the complete three-force diagram`);
    assert.equal((question.promptHtml.match(/data-role="force"/gu) || []).length, 1, question.id);
    assert.ok(!question.promptHtml.includes("force-weight") && !question.promptHtml.includes("force-normal") && !question.promptHtml.includes("force-support-right"), question.id);

    if (data.contactType === "two-support") {
      const underside = body.points.filter((point) => close(point[1], Math.max(...body.points.map((candidate) => candidate[1])))).sort((left, right) => left[0] - right[0]);
      assert.equal(underside.length, 2, `${question.id}: beam underside comes from body polygon`);
      ["left", "right"].forEach((side) => {
        const support = manifestElement(prompt, `${question.id}-${side}-support`);
        const contacts = support.points.filter((point) => pointOnSegment(point, underside[0], underside[1]));
        assert.equal(contacts.length, 1, `${question.id}: ${side} support has one manifest-derived contact`);
        assert.ok(contacts[0][0] > underside[0][0] && contacts[0][0] < underside[1][0], `${question.id}: ${side} contact is inside beam span`);
        support.points.filter((point) => point !== contacts[0]).forEach((point) => assert.ok(point[1] > underside[0][1], `${question.id}: support remains below beam`));
      });
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

test("all 15 serialized solution force diagrams balance force and signed moment without overlapping lines", () => {
  loadSlots()[1].filter((question) => question.sourceData.family === "contact-equilibrium").forEach((question) => {
    const data = question.sourceData;
    const prompt = data.diagram;
    const solution = data.solutionDiagram;
    const isolated = manifestElement(solution, `${question.id}-isolated-body`);
    const center = [isolated.points.reduce((sum, point) => sum + point[0], 0) / isolated.points.length, isolated.points.reduce((sum, point) => sum + point[1], 0) / isolated.points.length];
    const weight = data.massKg * data.g;
    let forces;
    if (data.contactType === "floor-pull") {
      forces = [
        { id: `${question.id}-force-weight`, vector: [0, weight] },
        { id: `${question.id}-force-normal`, vector: [0, -(weight - data.appliedForceN)] },
        { id: `${question.id}-force-applied`, vector: [0, -data.appliedForceN] }
      ];
    } else if (data.contactType === "floor-push") {
      forces = [
        { id: `${question.id}-force-weight`, vector: [0, weight] },
        { id: `${question.id}-force-normal`, vector: [0, -(weight + data.appliedForceN)] },
        { id: `${question.id}-force-applied`, vector: [0, data.appliedForceN] }
      ];
    } else {
      forces = [
        { id: `${question.id}-force-weight`, vector: [0, weight] },
        { id: `${question.id}-force-support-left`, vector: [0, -data.knownSupportN] },
        { id: `${question.id}-force-support-right`, vector: [0, -(weight - data.knownSupportN)] }
      ];
    }
    const actual = forces.map((force) => Object.assign({}, force, { line: serializedLine(question.solutionHtml, force.id) }));
    actual.forEach((force) => {
      assert.ok(close(force.line.from[0], force.line.to[0]), `${force.id}: force line is vertical`);
      assert.ok(force.line.from[0] >= isolated.bbox.x + 10 && force.line.from[0] <= isolated.bbox.x + isolated.bbox.width - 10, `${force.id}: application stays inside body span`);
    });
    actual.forEach((force, index) => actual.slice(index + 1).forEach((other) => {
      assert.ok(Math.abs(force.line.from[0] - other.line.from[0]) >= 8, `${question.id}: ${force.id} and ${other.id} must not overlap or layer`);
    }));
    const resultant = actual.reduce((sum, force) => [sum[0] + force.vector[0], sum[1] + force.vector[1]], [0, 0]);
    const moment = actual.reduce((sum, force) => {
      const radius = subtractPoints(force.line.from, center);
      return sum + radius[0] * force.vector[1] - radius[1] * force.vector[0];
    }, 0);
    assert.ok(Math.hypot(...resultant) <= weight * 1e-10, `${question.id}: ΣF = 0, got ${resultant}`);
    assert.ok(Math.abs(moment) <= weight * isolated.bbox.width * 1e-10, `${question.id}: ΣM(center) = 0, got ${moment}`);

    const byId = Object.fromEntries(actual.map((force) => [force.id, force.line.from[0]]));
    if (data.contactType === "two-support") {
      const promptBody = manifestElement(prompt, `${question.id}-body`);
      const underside = promptBody.points.filter((point) => close(point[1], Math.max(...promptBody.points.map((candidate) => candidate[1])))).sort((left, right) => left[0] - right[0]);
      const contactX = ["left", "right"].map((side) => {
        const support = manifestElement(prompt, `${question.id}-${side}-support`);
        return support.points.find((point) => pointOnSegment(point, underside[0], underside[1]))[0];
      });
      assert.ok(close(byId[`${question.id}-force-support-left`], contactX[0]), `${question.id}: left solution reaction stays at actual support`);
      assert.ok(close(byId[`${question.id}-force-support-right`], contactX[1]), `${question.id}: right solution reaction stays at actual support`);
      const expectedWeightX = (data.knownSupportN * contactX[0] + (weight - data.knownSupportN) * contactX[1]) / weight;
      assert.ok(close(byId[`${question.id}-force-weight`], expectedWeightX), `${question.id}: weight line uses exact reaction-weighted lever point`);
    } else if (data.contactType === "floor-pull") {
      const xWeight = byId[`${question.id}-force-weight`];
      const xNormal = byId[`${question.id}-force-normal`];
      const xApplied = byId[`${question.id}-force-applied`];
      assert.ok(close(xWeight, center[0]) && (xNormal - center[0]) * (xApplied - center[0]) < 0, `${question.id}: pull forces straddle centered weight`);
      assert.ok(close((weight - data.appliedForceN) * Math.abs(xNormal - center[0]), data.appliedForceN * Math.abs(xApplied - center[0])), `${question.id}: pull lever products balance`);
    } else {
      const xWeight = byId[`${question.id}-force-weight`];
      const xNormal = byId[`${question.id}-force-normal`];
      const xApplied = byId[`${question.id}-force-applied`];
      assert.ok(close(xNormal, center[0]) && (xWeight - center[0]) * (xApplied - center[0]) < 0, `${question.id}: downward push forces straddle centered normal`);
      assert.ok(close(weight * Math.abs(xWeight - center[0]), data.appliedForceN * Math.abs(xApplied - center[0])), `${question.id}: push lever products balance`);
    }
  });
});

test("body dimensions derive from manifest geometry and lie outward from each solid", () => {
  loadSlots()[2].forEach((question) => {
    const data = question.sourceData;
    const manifest = data.diagram;
    assert.equal(Object.prototype.hasOwnProperty.call(data, "diagramGeometry"), false, `${question.id}: no copied diagram geometry oracle`);
    const dimensions = manifest.elements.filter((element) => element.kind === "dimension");
    const sourceElements = manifest.elements.filter((element) => ["body", "connection", "measure"].includes(element.role));
    const segments = sourceElements.flatMap(primitiveSegments);
    assert.ok(dimensions.length >= 1, question.id);
    dimensions.forEach((dimension) => {
      [dimension.a, dimension.b].forEach((point) => {
        assert.ok(segments.some((segment) => pointOnSegment(point, segment[0], segment[1])), `${dimension.id}: endpoint belongs to a manifest body edge or measure`);
      });
      const midpoint = [(dimension.anchors[0][0] + dimension.anchors[1][0]) / 2, (dimension.anchors[0][1] + dimension.anchors[1][1]) / 2];
      const circle = sourceElements.find((element) => element.kind === "circle" && element.role === "body");
      if (circle) {
        assert.ok(Math.hypot(midpoint[0] - circle.center[0], midpoint[1] - circle.center[1]) >= circle.radius + 6, `${dimension.id}: dimension line lies outside expanded circle`);
      } else {
        const solidPoints = sourceElements.filter((element) => element.role === "body").flatMap((element) => {
          if (element.kind === "rect") return [[element.x, element.y], [element.x + element.width, element.y], [element.x + element.width, element.y + element.height], [element.x, element.y + element.height]];
          return element.points || [];
        });
        assert.ok(outsideConvexHullBy(midpoint, convexHull(solidPoints), 6), `${dimension.id}: dimension line lies outward from expanded solid hull`);
      }
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
    if (data.family === "prism" && data.baseShape === "rectangle") {
      assert.equal(dimensions.length, 3, `${question.id}: rectangular prism has length, height and depth dimensions`);
      const front = manifestElement(manifest, `${question.id}-prism-front`);
      const back = manifestElement(manifest, `${question.id}-prism-back`);
      const prismEdges = primitiveSegments(front).concat(primitiveSegments(back), sourceElements.filter((element) => element.role === "connection").flatMap(primitiveSegments));
      const named = ["length", "height", "width"].map((name) => manifestElement(manifest, `${question.id}-${name}-dimension`));
      named.forEach((dimension) => assert.ok(prismEdges.some((edge) => sameUndirectedSegment([dimension.a, dimension.b], edge)), `${dimension.id}: endpoints are an actual prism edge`));
      const vectors = named.map((dimension) => subtractPoints(dimension.b, dimension.a));
      vectors.forEach((vector, index) => vectors.slice(index + 1).forEach((other) => {
        assert.ok(Math.abs(vector[0] * other[1] - vector[1] * other[0]) > 1e-8, `${question.id}: all three edge direction classes are nonparallel`);
      }));
    }
  });
});

test("all 190 physics figures keep exact opaque labels clear, local and attached", () => {
  const slots = loadSlots();
  const figures = [1, 2, 3, 4, 5].flatMap((slot) => slots[slot].map((question) => ({ question, purpose: "prompt", manifest: question.sourceData.diagram, html: question.promptHtml })))
    .concat([1, 2, 3, 4, 5].flatMap((slot) => slots[slot].filter((question) => question.sourceData.solutionDiagram).map((question) => ({ question, purpose: "solution", manifest: question.sourceData.solutionDiagram, html: question.solutionHtml }))));
  const failures = [];
  assert.equal(figures.length, 190);
  figures.forEach(({ question, purpose, manifest, html }) => {
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
      if (question.slot === 3) {
        const zones = question.sourceData.diagramLayout;
        const zone = label.id.endsWith("-height-label") ? zones.height : label.id.endsWith("-positive-label") || label.id.endsWith("-origin-label") ? zones.sign : zones.velocity;
        assert.ok(box.x >= zone.x && box.y >= zone.y && box.x + box.width <= zone.x + zone.width && box.y + box.height <= zone.y + zone.height, `${label.id}: inside typed motion zone`);
      } else if (question.slot === 4 || question.slot === 5) {
        const zoneGroups = purpose === "solution" ? question.sourceData.solutionLabelZones : question.sourceData.diagramLabelZones;
        const zone = zoneGroups && zoneGroups.find((candidate) => candidate.labelIds.includes(label.id));
        assert.ok(zone && ["given", "given-force", "given-vector", "angle", "force", "motion"].includes(zone.type), `${label.id}: typed local zone`);
        assert.ok(box.x >= zone.bounds.x && box.y >= zone.bounds.y && box.x + box.width <= zone.bounds.x + zone.bounds.width && box.y + box.height <= zone.bounds.y + zone.bounds.height, `${label.id}: inside local zone`);
        if (question.slot === 5) {
          const ownerDistance = Math.min(...paintedParts(owner).map((part) => part.kind === "segment"
            ? pointSegmentDistance(center, part.from, part.to)
            : Math.abs(Math.hypot(center[0] - part.center[0], center[1] - part.center[1]) - part.radius)));
          assert.ok(ownerDistance <= 160, `${label.id}: attached to semantic owner`);
        }
      } else if (label.id.includes("-tick-label-") || label.id.endsWith("-title")) {
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

test("wall-contact SVG topology matches the stated force models", () => {
  loadSlots()[4]
    .filter((question) => question.sourceData.family === "frictionless-wall-contact")
    .forEach((question) => {
      const manifest = question.sourceData.diagram;
      const wall = manifestElement(manifest, `${question.id}-wall`);
      const sphere = manifestElement(manifest, `${question.id}-sphere`);
      const cable = manifestElement(manifest, `${question.id}-cable`);
      const wallX = wall.from[0];
      const cx = sphere.center[0];
      const cy = sphere.center[1];
      const radius = sphere.radius;
      const x1 = cable.from[0];
      const y1 = cable.from[1];
      const x2 = cable.to[0];
      const y2 = cable.to[1];
      assert.ok(close(wall.from[0], wall.to[0]), `${question.id}: wall must be vertical`);
      assert.ok(close(cx + radius, wallX), `${question.id}: sphere must touch wall`);
      assert.ok(close(Math.hypot(x1 - cx, y1 - cy), radius), `${question.id}: cable must attach on sphere`);
      assert.ok(close(x2, wallX), `${question.id}: cable must terminate on wall`);
      assert.ok(x2 > x1 && y2 < y1, `${question.id}: cable must run upward toward wall`);
      assert.ok(close((y1 - y2) / (x2 - x1), Math.tan(question.sourceData.givens.cableAngleDeg * Math.PI / 180)), `${question.id}: drawn cable angle`);
      assert.ok(close((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1), 0), `${question.id}: cable line of action must pass through center`);
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
