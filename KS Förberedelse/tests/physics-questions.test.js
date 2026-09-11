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
  return { mass: "kg", density: "kg/m3", radius: "m", height: "m", volume: "m3" }[unknown];
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

function geometricVolume(data) {
  const p = data.givens;
  if (data.family === "cylinder" || data.family === "liquid-column") return Math.PI * p.radiusM ** 2 * p.heightM;
  if (data.family === "cone") return Math.PI * p.radiusM ** 2 * p.heightM / 3;
  if (data.family === "sphere") return 4 * Math.PI * p.radiusM ** 3 / 3;
  if (data.family === "prism" && data.baseShape === "regular-hexagon") return 3 * Math.sqrt(3) * p.radiusM ** 2 * p.heightM / 2;
  if (data.family === "prism") return p.lengthM * p.widthM * p.heightM;
  throw new Error(`Unknown geometry ${data.family}`);
}

function derivedGeometryAnswerSI(data) {
  const p = data.givens;
  const volumeFromMatter = p.massKg / p.densityKgM3;
  if (data.unknown === "mass") return p.densityKgM3 * geometricVolume(data);
  if (data.unknown === "density") return p.massKg / geometricVolume(data);
  if (data.unknown === "volume") return geometricVolume(data);
  if (data.unknown === "radius") {
    if (data.family === "cone") return Math.sqrt(3 * volumeFromMatter / (Math.PI * p.heightM));
    if (data.family === "sphere") return Math.cbrt(3 * volumeFromMatter / (4 * Math.PI));
    if (data.family === "prism") return Math.sqrt(2 * volumeFromMatter / (3 * Math.sqrt(3) * p.heightM));
    return Math.sqrt(volumeFromMatter / (Math.PI * p.heightM));
  }
  if (data.unknown === "height") {
    if (data.family === "cone") return 3 * volumeFromMatter / (Math.PI * p.radiusM ** 2);
    if (data.family === "sphere") return 2 * Math.cbrt(3 * volumeFromMatter / (4 * Math.PI));
    if (data.family === "prism") return volumeFromMatter / (p.lengthM * p.widthM);
    return volumeFromMatter / (Math.PI * p.radiusM ** 2);
  }
  throw new Error(`Unknown requested quantity ${data.unknown}`);
}

function derivedVerticalAnswer(data) {
  const p = data.givens;
  if (data.family === "time-to-apex") return p.initialSpeedMps / G;
  if (data.family === "maximum-height") return p.initialHeightM + p.initialSpeedMps ** 2 / (2 * G);
  if (data.family === "initial-speed") return p.laterVelocityMps + G * p.elapsedS;
  if (data.family === "impact-speed") {
    const initialSpeed = (-p.initialHeightM + G * p.flightTimeS ** 2 / 2) / p.flightTimeS;
    return Math.abs(initialSpeed - G * p.flightTimeS);
  }
  if (data.family === "flight-time") return (p.initialSpeedMps + Math.sqrt(p.initialSpeedMps ** 2 + 2 * G * p.initialHeightM)) / G;
  throw new Error(`Unknown vertical-motion family ${data.family}`);
}

function derivedEquilibriumAnswer(data) {
  const p = data.givens;
  if (data.family === "hanging-masses") return (p.upperMassKg + p.lowerMassKg) * G;
  if (data.family === "cables-at-angles") return p.massKg * G / (2 * Math.sin(p.angleDeg * Math.PI / 180));
  if (data.family === "missing-fourth-force") {
    return Math.hypot(p.forces.reduce((sum, force) => sum + force.xN, 0), p.forces.reduce((sum, force) => sum + force.yN, 0));
  }
  if (data.family === "supported-beams") return p.massKg * G - p.knownSupportN;
  if (data.family === "frictionless-wall-contact") return p.massKg * G / Math.sin(p.cableAngleDeg * Math.PI / 180);
  throw new Error(`Unknown equilibrium family ${data.family}`);
}

function derivedDynamicsAnswer(data) {
  const p = data.givens;
  if (data.family === "horizontal-pull") return (p.pullForceN - p.frictionCoefficient * p.massKg * G) / p.massKg;
  if (data.family === "inclined-plane") return G * Math.sin(p.angleDeg * Math.PI / 180) - p.frictionForceN / p.massKg;
  if (data.family === "connected-masses") return (p.hangingMassKg - p.tableMassKg * p.frictionCoefficient) * G / (p.hangingMassKg + p.tableMassKg);
  if (data.family === "unknown-pull") return p.massKg * (p.accelerationMps2 + p.frictionCoefficient * G);
  if (data.family === "unknown-friction") return p.driveForceN - p.massKg * p.finalSpeedMps / p.elapsedS;
  throw new Error(`Unknown dynamics family ${data.family}`);
}

function derivedAnswerInTargetUnit(question) {
  const data = question.sourceData;
  let siValue;
  let siUnit;
  if (question.slot === 1) {
    siValue = data.family === "graph-interpretation" ? derivedGraphAnswer(data) : derivedContactAnswer(data);
    siUnit = data.targetUnit;
  } else if (question.slot === 2) {
    siValue = derivedGeometryAnswerSI(data);
    siUnit = canonicalUnitForUnknown(data.unknown);
  } else if (question.slot === 3) {
    siValue = derivedVerticalAnswer(data);
    siUnit = data.targetUnit;
  } else if (question.slot === 4) {
    siValue = derivedEquilibriumAnswer(data);
    siUnit = "N";
  } else {
    siValue = derivedDynamicsAnswer(data);
    siUnit = data.targetUnit;
  }
  const converted = units.convert(siValue, siUnit, data.targetUnit);
  assert.equal(converted.ok, true, question.id);
  return converted.value;
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
    unknownCounts[question.sourceData.unknown] += 1;
  });
  assert.deepEqual(shapeCounts, { cylinder: 5, cone: 5, sphere: 5, prism: 5, "liquid-column": 5 });
  assert.deepEqual(unknownCounts, { mass: 5, density: 5, radius: 5, height: 5, volume: 5 });

  [3, 4, 5].forEach((slot) => {
    const counts = Object.fromEntries(SLOT_FAMILIES[slot].map((family) => [family, 0]));
    slots[slot].forEach((question) => { counts[question.sourceData.family] += 1; });
    assert.deepEqual(Object.values(counts), [5, 5, 5, 5, 5], `slot ${slot}`);
  });
});

test("every numeric answer is independently recomputed from SI source data and grades correctly", () => {
  allPhysicsQuestions().forEach((question) => {
    const numeric = question.fields.find((field) => field.kind === "numeric");
    assert.ok(numeric, question.id);
    const independentlyDerived = derivedAnswerInTargetUnit(question);
    const rounded = roundSignificant(independentlyDerived, question.sourceData.significantFigures);
    assert.ok(close(numeric.expected, rounded), `${question.id}: ${numeric.expected} != ${rounded}`);
    const result = grading.gradeNumeric(numeric, `${String(numeric.expected).replace(".", ",")} ${numeric.targetUnit}`);
    assert.equal(result.status, "correct", question.id);
    assert.equal(result.earned, numeric.points, question.id);
  });
});

test("hand-calculated fixtures anchor each physics structure independently of generator formulas", () => {
  const byId = Object.fromEntries(allPhysicsQuestions().map((question) => [question.id, question]));
  const fixtures = {
    "physics-s1-graph-06": [33, "m"],
    "physics-s1-contact-01": [32, "N"],
    "physics-s2-cylinder-03": [21.3, "mm"],
    "physics-s2-cone-03": [112, "mm"],
    "physics-s2-sphere-02": [7.87, "cm"],
    "physics-s2-prism-05": [36.3, "mm"],
    "physics-s2-liquid-column-05": [28.4, "cm"],
    "physics-s3-impact-speed-01": [15.3, "m/s"],
    "physics-s4-missing-fourth-force-01": [3.61, "N"],
    "physics-s5-connected-masses-01": [2.72, "m/s2"],
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
    const answer = Math.abs(derivedAnswerInTargetUnit(question));
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
      const si = derivedGeometryAnswerSI(data);
      if (data.unknown === "radius" || data.unknown === "height") assert.ok(si > 0.001 && si < 3, question.id);
      if (data.unknown === "volume") assert.ok(si > 1e-7 && si < 2, question.id);
    }
    if (question.slot === 3) {
      assert.equal(data.g, G, question.id);
      assert.ok(derivedVerticalAnswer(data) > 0 && derivedVerticalAnswer(data) < 120, question.id);
      if (data.family === "impact-speed") {
        const p = data.givens;
        const initial = (-p.initialHeightM + G * p.flightTimeS ** 2 / 2) / p.flightTimeS;
        assert.ok(initial > 0 && initial < 35 && initial - G * p.flightTimeS < 0, question.id);
      }
    }
    if (question.slot === 4) {
      assert.equal(data.g, G, question.id);
      assert.ok(derivedEquilibriumAnswer(data) > 0 && derivedEquilibriumAnswer(data) < 3000, question.id);
      if (data.family === "supported-beams") assert.ok(data.givens.knownSupportN < data.givens.massKg * G, question.id);
    }
    if (question.slot === 5) {
      assert.equal(data.g, G, question.id);
      const p = data.givens;
      if (data.normalForceN !== null) assert.ok(data.normalForceN > 0, `${question.id}: negative normal force`);
      assert.ok(derivedDynamicsAnswer(data) > 0, `${question.id}: impossible motion direction`);
      if (data.family === "horizontal-pull") assert.ok(p.pullForceN > data.frictionForceN, `${question.id}: static contradiction`);
      if (data.family === "inclined-plane") assert.ok(p.massKg * G * Math.sin(p.angleDeg * Math.PI / 180) > p.frictionForceN, `${question.id}: static contradiction`);
      if (data.family === "connected-masses") assert.ok(p.hangingMassKg > p.tableMassKg * p.frictionCoefficient, `${question.id}: static contradiction`);
      if (data.family === "unknown-friction") assert.ok(derivedDynamicsAnswer(data) < p.driveForceN, `${question.id}: impossible friction`);
    }
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

test("manual force work has concrete Swedish rubrics while automatic credit remains intact", () => {
  const mixed = allPhysicsQuestions().filter((question) => question.fields.some((field) => field.kind === "self"));
  assert.ok(mixed.length >= 65);
  mixed.forEach((question) => {
    const manual = question.fields.find((field) => field.kind === "self");
    const numeric = question.fields.find((field) => field.kind === "numeric");
    assert.equal(manual.points, 1, question.id);
    assert.equal(numeric.points, 1, question.id);
    assert.match(manual.label, /kraftfigur|resonemang/i, question.id);
    assert.ok(question.rubric.some((item) => /riktning|kraft|newton|jämvikt|komposant/i.test(item.text)), question.id);
    assert.ok(question.rubric.every((item) => !/korrekt lösning$/i.test(item.text.trim())), question.id);
  });

  const question = mixed[0];
  const subject = { id: "physics-mixed-check", name: "Kontroll", questionCount: 1, maxPoints: 2, passPoints: 1, durationMinutes: 1 };
  const session = exam.createSession(subject, { 1: [Object.assign({}, question, { slot: 1 })] }, memoryStore(), seededRng(9));
  const numeric = question.fields.find((field) => field.kind === "numeric");
  session.setAnswer(question.id, numeric.id, `${numeric.expected} ${numeric.targetUnit}`);
  session.submit();
  const grade = session.snapshot().grades[question.id];
  assert.equal(grade.requiresSelfAssessment, true);
  assert.equal(grade.fieldResults[numeric.id].status, "correct");
  assert.equal(grade.earned, 1, "automatic point must survive a pending self field");
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
