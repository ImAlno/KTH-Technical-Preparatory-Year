const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const exam = require("../assets/js/exam-engine.js");
const grading = require("../assets/js/grading.js");
const units = require("../assets/js/units.js");

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
  const files = [1, 2, 3, 4, 5].map((slot) => path.join(PHYSICS_ROOT, `questions/slot-${slot}.js`));
  files.push(path.join(PHYSICS_ROOT, "questions.js"));
  files.forEach((file) => { delete require.cache[require.resolve(file)]; });
  return require(path.join(PHYSICS_ROOT, "questions.js"));
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
  const forceWorkTerms = "(?:kraftfigur|frilägg(?:ning)?|skiss|vektorfigur|diagram|rit(?:a|ning))";
  return new RegExp(`\\b(?:redovisa|redogör|beskriv|skriv|ange|visa)\\b[^.?!]{0,120}\\b${derivationTerms}\\b`, "i").test(text) ||
    /\b(?:bevisa|förklara|motivera)\b/i.test(text) ||
    /\bvisa\s+(?:hur|varför)\b/i.test(text) ||
    /\bskriv\b[^.?!]{0,80}\b(?:hur|varför)\s+(?:du|ni|man)\b/i.test(text) ||
    new RegExp(`\\b(?:redovisa|beskriv|skriv|ange|visa|rita|r\u00e4kna)\\b[^.?!]{0,100}\\b(?:${forceWorkTerms})\\b[^.?!]{0,100}\\b(?:här|i\\s+(?:svarsfältet|rutan|formuläret)|online|på\\s+skärmen)\\b`, "i").test(text) ||
    new RegExp(`\\b(?:${forceWorkTerms})\\b(?![^.?!]{0,100}\\bräknehäftet\\b)[^.?!]{0,100}\\b(?:digitalt|online|på\\s+skärmen)\\b`, "i").test(text);
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
  Object.values(first).flat().forEach((question) => delete require.cache[require.resolve(path.join(PHYSICS_ROOT, `questions/slot-${question.slot}.js`))]);
  const second = loadSlots();
  const questions = Object.values(first).flat();

  assert.deepEqual(Object.values(first).map((slot) => slot.length), [25, 25, 25, 25, 25]);
  assert.equal(questions.length, 125);
  assert.equal(new Set(questions.map((question) => question.id)).size, 125);
  assert.equal(serialized, JSON.stringify(second), "fresh loads must reproduce every authored ID and value");
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
  const sphereBody = attributesForRole(sphere.promptHtml, "circle", "sphere-body");
  const diameter = attributesForRole(sphere.promptHtml, "line", "diameter");
  assert.ok(close(Number(diameter.y1), Number(sphereBody.cy)) && close(Number(diameter.y2), Number(sphereBody.cy)));
  assert.ok(close(Number(diameter.x1), Number(sphereBody.cx) - Number(sphereBody.r)));
  assert.ok(close(Number(diameter.x2), Number(sphereBody.cx) + Number(sphereBody.r)));
  assert.match(sphere.promptHtml, /<text\b(?=[^>]*data-role="diameter-label")[^>]*>d<\/text>/);

  const prism = slot.find((question) => question.id === "physics-s2-prism-05");
  assert.equal(prism.sourceData.radiusDefinition, "circumradius-center-to-vertex");
  assert.match(prism.promptHtml, /omskrivna cirkelns radie från sexkantens centrum till ett hörn/i);
  assert.match(prism.solutionHtml, /omskrivna cirkelns radie, mätt från centrum till hörn/i);
  const outline = attributesForRole(prism.promptHtml, "path", "hex-prism-outline");
  const radius = attributesForRole(prism.promptHtml, "line", "circumradius");
  const face = outline.d.match(/^M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) Z/);
  assert.ok(face, "front hexagon must expose six vertices");
  const values = face.slice(1).map(Number);
  const vertices = Array.from({ length: 6 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
  const center = {
    x: vertices.reduce((sum, vertex) => sum + vertex.x, 0) / vertices.length,
    y: vertices.reduce((sum, vertex) => sum + vertex.y, 0) / vertices.length
  };
  assert.ok(Math.abs(Number(radius.x1) - center.x) < 0.5 && Math.abs(Number(radius.y1) - center.y) < 0.5, "r must start at hexagon center");
  assert.ok(vertices.some((vertex) => close(Number(radius.x2), vertex.x) && close(Number(radius.y2), vertex.y)), "r must end at a vertex");
  assert.match(prism.promptHtml, /<text\b(?=[^>]*data-role="circumradius-label")[^>]*>r<\/text>/);
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
    ["<p>Rita kraftfiguren i räknehäftet och skriv endast slutsvaret digitalt.</p>", false],
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
