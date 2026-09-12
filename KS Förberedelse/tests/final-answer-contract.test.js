const test = require("node:test");
const assert = require("node:assert/strict");
const grading = require("../assets/js/grading.js");
const exam = require("../assets/js/exam-engine.js");
const units = require("../assets/js/units.js");

const BANKS = {
  math: { id: "math-ks2", directory: "Matematik KS2", slots: 5, questionCount: 125, maxPoints: 10 },
  physics: { id: "physics-ks1", directory: "Fysik KS1", slots: 5, questionCount: 125, maxPoints: 10 },
  chemistry: { id: "chemistry-ks", directory: "Kemi KS", slots: 6, questionCount: 120, maxPoints: 20 }
};

function loadBanks() {
  return Object.fromEntries(Object.entries(BANKS).map(([subject, config]) => {
    const slots = Object.fromEntries(Array.from({ length: config.slots }, (_, index) => {
      const slot = index + 1;
      return [slot, require(`../${config.directory}/questions/slot-${slot}.js`)];
    }));
    return [subject, slots];
  }));
}

function allQuestions() {
  return Object.values(loadBanks()).flatMap((slots) => Object.values(slots).flat());
}

function memoryStore() {
  let history = { schemaVersion: 1, slots: {} };
  return {
    loadHistory() { return structuredClone(history); },
    saveHistory(next) { history = structuredClone(next); return { ok: true, persisted: true }; },
    saveActive() { return { ok: true, persisted: true }; }
  };
}

function seededRng(seed) {
  let value = seed >>> 0;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function numericAnswer(field) {
  if (field.targetUnit === "1" || field.targetUnit === null || field.targetUnit === undefined) return String(field.expected);
  return `${field.expected} ${field.requestedUnitLabel || field.targetUnit}`;
}

function solutionSetAnswer(field) {
  return field.expected.length ? field.expected.map((value) => `${field.variable || "x"} = ${value}`).join("; ") : "∅";
}

function canonicalAnswer(field) {
  if (field.kind === "numeric") return numericAnswer(field);
  if (field.kind === "solution-set") return solutionSetAnswer(field);
  return field.expected;
}

function wrongAnswer(field) {
  if (field.kind === "numeric") {
    const distance = Math.max(1, field.expected === 0 ? 1 : Math.abs(field.expected) * 0.5, field.tolerance && Number.isFinite(field.tolerance.absolute) ? field.tolerance.absolute * 10 : 0);
    return numericAnswer(Object.assign({}, field, { expected: field.expected + distance }));
  }
  if (field.kind === "aliases") return "inte-godtagbart-svar";
  if (field.kind === "choice") return field.options.length > 1
    ? field.options.find((option) => option.value !== field.expected).value
    : "unknown-choice";
  if (field.kind === "solution-set") {
    return field.expected.length ? `${field.variable || "x"} = ${field.expected[0] + 1}` : `${field.variable || "x"} = 1`;
  }
  if (field.kind === "chemical-formula") return field.expected === "H" ? "He" : "H";
  if (field.kind === "chemical-equation") return "H2 -> H2";
  if (field.kind === "simplified-expression" || field.kind === "expression") return `${field.expected} + 1`;
  throw new Error(`No wrong-answer fixture for ${field.kind}`);
}

function normalizeUnitText(value) {
  return String(value)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[−–—⁻]/g, "-")
    .replace(/[¹²³]/g, (digit) => ({ "¹": "1", "²": "2", "³": "3" })[digit])
    .replace(/[·×]/g, "")
    .replace(/\s+/g, "");
}

function mentionsUnit(text, targetUnit) {
  const definition = units.UNIT_DEFINITIONS[targetUnit];
  if (!definition) return false;
  const normalized = normalizeUnitText(text);
  return definition.aliases.some((alias) => normalized.includes(normalizeUnitText(alias)));
}

test("all 370 questions expose only objective final-answer fields", () => {
  const questions = allQuestions();
  assert.equal(questions.length, 370);
  questions.forEach((question) => {
    assert.ok(question.fields.length > 0, question.id);
    assert.ok(question.workOnPaper, `${question.id}: workOnPaper`);
    assert.deepEqual(Object.keys(question.workOnPaper).sort(), ["comparison", "instruction", "title"], question.id);
    Object.values(question.workOnPaper).forEach((value) => assert.equal(typeof value, "string", question.id));
    question.fields.forEach((field) => {
      assert.notEqual(field.kind, "self", `${question.id}/${field.id}`);
      assert.equal(Object.hasOwn(field, "multiline"), false, `${question.id}/${field.id}`);
    });
  });
});

test("every canonical final answer grades for full credit and a type-specific wrong answer does not", () => {
  allQuestions().forEach((question) => question.fields.forEach((field) => {
    const correct = grading[`grade${field.kind === "numeric" ? "Numeric" : field.kind === "aliases" ? "Aliases" : field.kind === "choice" ? "Choice" : field.kind === "solution-set" ? "SolutionSet" : field.kind === "simplified-expression" ? "SimplifiedExpression" : field.kind === "chemical-formula" ? "ChemicalFormula" : field.kind === "chemical-equation" ? "ChemicalEquation" : "Expression"}`](field, canonicalAnswer(field));
    assert.equal(correct.status, "correct", `${question.id}/${field.id}: ${correct.message}`);
    assert.equal(correct.earned, field.points, `${question.id}/${field.id}`);
    const wrong = grading[`grade${field.kind === "numeric" ? "Numeric" : field.kind === "aliases" ? "Aliases" : field.kind === "choice" ? "Choice" : field.kind === "solution-set" ? "SolutionSet" : field.kind === "simplified-expression" ? "SimplifiedExpression" : field.kind === "chemical-formula" ? "ChemicalFormula" : field.kind === "chemical-equation" ? "ChemicalEquation" : "Expression"}`](field, wrongAnswer(field));
    assert.ok(wrong.earned < field.points, `${question.id}/${field.id}: wrong input received full credit`);
  }));
});

test("selected exams retain five/five/six questions and 10/10/20 point totals", () => {
  const banks = loadBanks();
  Object.entries(BANKS).forEach(([subject, config], index) => {
    const subjectConfig = { id: config.id, questionCount: config.slots, maxPoints: config.maxPoints, passPoints: config.maxPoints / 2, durationMinutes: 1 };
    const session = exam.createSession(subjectConfig, banks[subject], memoryStore(), seededRng(index + 1));
    const snapshot = session.snapshot();
    assert.equal(snapshot.questionIds.length, config.slots, subject);
    assert.equal(snapshot.questionIds.reduce((sum, id, position) => sum + banks[subject][position + 1].find((question) => question.id === id).points, 0), config.maxPoints, subject);
  });
});

test("numeric fields state a normalized requested unit in both prompt and answer label", () => {
  allQuestions().forEach((question) => question.fields.filter((field) => field.kind === "numeric").forEach((field) => {
    assert.ok(typeof field.targetUnit === "string" && units.normalizeUnit(field.targetUnit), `${question.id}/${field.id}: target unit`);
    if (field.targetUnit !== "1") {
      assert.ok(mentionsUnit(field.label, units.normalizeUnit(field.targetUnit)), `${question.id}/${field.id}: label unit`);
      assert.ok(mentionsUnit(question.promptHtml, units.normalizeUnit(field.targetUnit)), `${question.id}/${field.id}: prompt unit`);
    }
  }));
});

test("prompt language separates digital conclusions from calculation, proof, force, Bohr, drawing and long reasoning work", () => {
  const methodWords = /(?:beräkna|räkna|bevisa|proof|kraftfigur|frilägg|bohrs modell|bohrmodell|elektronformel|rita|redovisa|motivera|förklara|stegvis|fullständig lösning)/iu;
  const directDigitalMethod = /(?:beräkna|räkna|bevisa|kraftfigur|frilägg|bohrs modell|bohrmodell|elektronformel|rita|redovisa|motivera|förklara|stegvis|fullständig lösning)[^.!?]{0,100}(?:digitalt|i appen)/iu;
  allQuestions().forEach((question) => {
    const prompt = question.promptHtml.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
    if (methodWords.test(prompt)) assert.match(question.workOnPaper.instruction, /räknehäftet/iu, question.id);
    if (/(?:digitalt|i appen)/iu.test(prompt)) {
      assert.match(prompt, /endast[^.!?]{0,80}slutsvar/iu, question.id);
      if (directDigitalMethod.test(prompt)) {
        assert.match(prompt, /endast[^.!?]{0,80}slutsvar/iu, question.id);
      }
    }
  });
});
