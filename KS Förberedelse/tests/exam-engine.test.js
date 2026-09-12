const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const exam = require("../assets/js/exam-engine.js");

function seededRng(seed) {
  let value = seed >>> 0;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function memoryStore(history) {
  let active = null;
  let savedHistory = history || { schemaVersion: 1, slots: {} };
  let historyReads = 0;
  let activeWrites = 0;
  let historyWrites = 0;
  return {
    loadHistory() { historyReads += 1; return structuredClone(savedHistory); },
    saveHistory(next) { savedHistory = structuredClone(next); historyWrites += 1; return { ok: true, persisted: true }; },
    saveActive(next) { active = structuredClone(next); activeWrites += 1; return { ok: true, persisted: true }; },
    get active() { return active; },
    get history() { return savedHistory; },
    get historyReads() { return historyReads; },
    get activeWrites() { return activeWrites; },
    get historyWrites() { return historyWrites; }
  };
}

function field(id, kind, points, expected) {
  const answer = { id, label: id, kind, points };
  if (expected !== undefined) answer.expected = expected;
  if (kind === "numeric") answer.targetUnit = "m";
  return answer;
}

function question(id, slot, points, fields) {
  return { id, slot, title: id, points, promptHtml: "<p>Fråga</p>", fields, solutionHtml: "<p>Lösning</p>", rubric: [] };
}

function makeSession(overrides) {
  const subject = Object.assign({ id: "math-ks2", questionCount: 2, maxPoints: 4, passPoints: 2, durationMinutes: 1 }, overrides && overrides.subject);
  const slots = (overrides && overrides.slots) || {
    1: [question("q-1", 1, 2, [field("value", "numeric", 2, 4)])],
    2: [question("q-2", 2, 2, [field("name", "aliases", 2, "ja")])]
  };
  const store = (overrides && overrides.store) || memoryStore();
  return { session: exam.createSession(subject, slots, store, seededRng(7)), store, slots, subject };
}

test("a slot is exhausted before a question repeats", () => {
  const ids = Array.from({ length: 25 }, (_, index) => `q-${index}`);
  const bag = exam.createShuffleBag(ids, { queue: [], lastId: null }, seededRng(7));
  const firstCycle = Array.from({ length: 25 }, () => bag.take());

  assert.equal(new Set(firstCycle).size, 25);
  assert.notEqual(bag.take(), firstCycle.at(-1));
});
test("shuffle bag honors a persisted queue and protects the refill boundary", () => {
  const bag = exam.createShuffleBag(["a", "b", "c"], { queue: ["b", "a"], lastId: "c" }, () => 0.999);

  assert.equal(bag.take(), "b");
  assert.equal(bag.take(), "a");
  assert.notEqual(bag.take(), "a");
  assert.deepEqual(Object.keys(bag.snapshot()).sort(), ["lastId", "queue"]);
});

test("creating a session selects and persists one question per slot", () => {
  const { session, store } = makeSession();
  const snapshot = session.snapshot();

  assert.deepEqual(snapshot.questionIds, ["q-1", "q-2"]);
  assert.equal(snapshot.status, "active");
  assert.deepEqual(snapshot.timer, { durationMs: 60_000, elapsedMs: 0, runningSince: null });
  assert.equal(store.historyWrites, 2);
  assert.equal(store.activeWrites, 1);
  assert.deepEqual(store.active, snapshot);
});

test("navigation never requires an answer and every mutation autosaves", () => {
  const { session, store } = makeSession();
  const initialWrites = store.activeWrites;

  assert.deepEqual(session.navigate(1), { ok: true });
  assert.equal(session.snapshot().currentIndex, 1);
  assert.deepEqual(session.snapshot().answers, {});
  assert.deepEqual(session.toggleFlag("q-2"), { ok: true, flagged: true });
  assert.equal(store.activeWrites, initialWrites + 2);
  assert.deepEqual(session.navigate(9), { ok: false, reason: "invalid-index" });
  assert.equal(store.activeWrites, initialWrites + 2);
});

test("invalid exam structure is rejected before storage or randomness is touched", () => {
  const validSubject = { id: "x", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const valid = question("valid", 1, 1, [field("answer", "aliases", 1, "ja")]);
  const changed = (property, value) => Object.assign(structuredClone(valid), { [property]: value });
  const cases = [
    {
      name: "wrong slot count",
      subject: { id: "x", questionCount: 2, maxPoints: 2, passPoints: 1, durationMinutes: 1 },
      slots: { 1: [question("a", 1, 1, [field("a", "aliases", 1, "a")])] }
    },
    {
      name: "duplicate ids",
      subject: { id: "x", questionCount: 2, maxPoints: 2, passPoints: 1, durationMinutes: 1 },
      slots: { 1: [question("same", 1, 1, [field("a", "aliases", 1, "a")])], 2: [question("same", 2, 1, [field("b", "aliases", 1, "b")])] }
    },
    {
      name: "wrong points",
      subject: { id: "x", questionCount: 2, maxPoints: 3, passPoints: 1, durationMinutes: 1 },
      slots: { 1: [question("a", 1, 1, [field("a", "aliases", 1, "a")])], 2: [question("b", 2, 1, [field("b", "aliases", 1, "b")])] }
    },
    { name: "noncontiguous slot position", subject: validSubject, slots: { 2: [question("q", 2, 1, [field("answer", "aliases", 1, "ja")])] } },
    { name: "missing question id", subject: validSubject, slots: { 1: [changed("id", " ")] } },
    { name: "non-integer slot", subject: validSubject, slots: { 1: [changed("slot", 1.5)] } },
    { name: "missing title", subject: validSubject, slots: { 1: [changed("title", " ")] } },
    { name: "missing prompt", subject: validSubject, slots: { 1: [changed("promptHtml", "")] } },
    { name: "missing solution", subject: validSubject, slots: { 1: [changed("solutionHtml", " ")] } },
    { name: "missing rubric", subject: validSubject, slots: { 1: [changed("rubric", undefined)] } },
    { name: "empty fields", subject: validSubject, slots: { 1: [changed("fields", [])] } },
    { name: "field points differ from question", subject: validSubject, slots: { 1: [changed("fields", [field("answer", "aliases", 0.5, "ja")])] } },
    { name: "zero-point field", subject: validSubject, slots: { 1: [changed("fields", [field("answer", "aliases", 0, "ja"), field("other", "aliases", 1, "nej")])] } },
    { name: "field label missing", subject: validSubject, slots: { 1: [changed("fields", [Object.assign(field("answer", "aliases", 1, "ja"), { label: "" })])] } },
    { name: "duplicate field ids", subject: validSubject, slots: { 1: [changed("fields", [field("same", "aliases", 0.5, "ja"), field("same", "aliases", 0.5, "ja")])] } }
  ];

  cases.forEach(({ name, subject, slots }) => {
    const store = memoryStore();
    let rngCalls = 0;
    assert.throws(() => exam.createSession(subject, slots, store, () => { rngCalls += 1; return 0.5; }), /invalid exam data/i, name);
    assert.equal(store.historyReads, 0, name);
    assert.equal(store.historyWrites, 0, name);
    assert.equal(store.activeWrites, 0, name);
    assert.equal(rngCalls, 0, name);
  });
});

test("invalid grader data and self-assessment rubrics are rejected before any side effect", () => {
  const subject = { id: "x", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const invalidFields = [
    { name: "numeric expected", value: { id: "f", label: "Svar", kind: "numeric", points: 1, targetUnit: null } },
    { name: "numeric tolerance", value: { id: "f", label: "Svar", kind: "numeric", points: 1, expected: 2, targetUnit: null, tolerance: { absolute: -1 } } },
    { name: "numeric relative tolerance", value: { id: "f", label: "Svar", kind: "numeric", points: 1, expected: 2, targetUnit: null, tolerance: { relative: Infinity } } },
    { name: "numeric target unit", value: { id: "f", label: "Svar", kind: "numeric", points: 1, expected: 2, targetUnit: 7 } },
    { name: "numeric alternative-unit credit", value: { id: "f", label: "Svar", kind: "numeric", points: 1, expected: 2, targetUnit: "m", alternativeUnitCredit: "sometimes" } },
    { name: "aliases", value: { id: "f", label: "Svar", kind: "aliases", points: 1, expected: " ", aliases: [""] } },
    { name: "malformed aliases", value: { id: "f", label: "Svar", kind: "aliases", points: 1, aliases: ["ja", 7] } },
    { name: "solution set", value: { id: "f", label: "Svar", kind: "solution-set", points: 1, expected: [1, Infinity] } },
    { name: "expression", value: { id: "f", label: "Svar", kind: "expression", points: 1, expected: "" } },
    { name: "chemical formula", value: { id: "f", label: "Svar", kind: "chemical-formula", points: 1, expected: " " } },
    { name: "chemical equation", value: { id: "f", label: "Svar", kind: "chemical-equation", points: 1 } },
    { name: "chemical equation state points", value: { id: "f", label: "Svar", kind: "chemical-equation", points: 1, expected: "H2->H2", statePoints: 2 } },
    { name: "self field lacking its required rubric", value: { id: "f", label: "Svar", kind: "self", points: 1 } },
    { name: "self rubric points", value: { id: "f", label: "Svar", kind: "self", points: 1 }, rubric: [{ points: -1, text: "Delsteg" }] },
    { name: "self rubric text", value: { id: "f", label: "Svar", kind: "self", points: 1 }, rubric: [{ points: 1, text: " " }] },
    { name: "self rubric capacity", value: { id: "f", label: "Svar", kind: "self", points: 1 }, rubric: [{ points: 0.5, text: "Delsteg" }] }
  ];

  invalidFields.forEach(({ name, value, rubric }) => {
    const candidate = question("q", 1, 1, [value]);
    if (rubric) candidate.rubric = rubric;
    const store = memoryStore();
    let rngCalls = 0;
    assert.throws(() => exam.createSession(subject, { 1: [candidate] }, store, () => { rngCalls += 1; return 0.5; }), /invalid exam data/i, name);
    assert.equal(store.historyReads, 0, name);
    assert.equal(store.historyWrites, 0, name);
    assert.equal(store.activeWrites, 0, name);
    assert.equal(rngCalls, 0, name);
  });
});

test("choice fields and exact work-on-paper metadata are validated before any side effect", () => {
  const subject = { id: "x", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const validChoice = {
    id: "f", label: "Svar", kind: "choice", points: 1, expected: "yes",
    options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  };
  const validQuestion = Object.assign(question("q", 1, 1, [validChoice]), {
    workOnPaper: { title: "Redovisa", instruction: "Visa ditt arbete.", comparison: "Jämför med lösningen." }
  });
  const invalidQuestions = [
    Object.assign(structuredClone(validQuestion), { fields: [Object.assign({}, validChoice, { options: [{ value: "yes", label: "Ja" }, { value: "yes", label: "Ja igen" }] })] }),
    Object.assign(structuredClone(validQuestion), { fields: [Object.assign({}, validChoice, { options: [{ value: "yes", label: "Ja", extra: true }] })] }),
    Object.assign(structuredClone(validQuestion), { workOnPaper: { title: "Redovisa", instruction: "Visa ditt arbete." } }),
    Object.assign(structuredClone(validQuestion), { workOnPaper: { title: "Redovisa", instruction: "Visa ditt arbete.", comparison: "Jämför med lösningen.", extra: true } }),
    Object.assign(structuredClone(validQuestion), { workOnPaper: { title: " ", instruction: "Visa ditt arbete.", comparison: "Jämför med lösningen." } })
  ];

  assert.deepEqual(
    exam.createSession(subject, { 1: [validQuestion] }, memoryStore(), seededRng(1)).snapshot().questionIds,
    ["q"]
  );
  invalidQuestions.forEach((candidate) => {
    const store = memoryStore();
    let rngCalls = 0;
    assert.throws(() => exam.createSession(subject, { 1: [candidate] }, store, () => { rngCalls += 1; return 0.5; }), /invalid exam data/i);
    assert.equal(store.historyReads, 0);
    assert.equal(store.historyWrites, 0);
    assert.equal(store.activeWrites, 0);
    assert.equal(rngCalls, 0);
  });
});

test("snapshots bind every selected answer field to its id, kind, and choice values", () => {
  const subject = { id: "schema-test", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const choice = {
    id: "polarity", label: "Polaritetsval", kind: "choice", points: 1, expected: "yes",
    options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  };
  const slots = { 1: [question("q1", 1, 1, [choice])] };
  const session = exam.createSession(subject, slots, memoryStore(), seededRng(1));
  const snapshot = session.snapshot();

  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(snapshot.fieldSchema.q1, [
    { id: "polarity", kind: "choice", options: ["yes", "no"] }
  ]);
  assert.deepEqual(exam.questionFieldSchema(slots[1][0]), snapshot.fieldSchema.q1);
  assert.equal(Object.hasOwn(snapshot.fieldSchema.q1[0], "label"), false);
  assert.equal(Object.hasOwn(snapshot.fieldSchema.q1[0], "points"), false);
  assert.equal(Object.hasOwn(snapshot.fieldSchema.q1[0], "expected"), false);
  assert.deepEqual(exam.questionFieldSchema({ fields: [{ id: "work", kind: "self" }] }), [
    { id: "work", kind: "self", options: null }
  ]);
});

test("restoring a snapshot rejects changed field ids, kinds, order, and choice options before answers exist", () => {
  const subject = { id: "schema-test", questionCount: 1, maxPoints: 2, passPoints: 1, durationMinutes: 1 };
  const first = { id: "polarity", label: "Polaritetsval", kind: "choice", points: 1, expected: "yes", options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }] };
  const second = field("explanation", "aliases", 1, "förklaring");
  const slots = { 1: [question("q1", 1, 2, [first, second])] };
  const valid = exam.createSession(subject, slots, memoryStore(), seededRng(1)).snapshot();
  const cases = [
    ["field id", (value) => { value.fieldSchema.q1[0].id = "changed"; }],
    ["field kind", (value) => { value.fieldSchema.q1[0].kind = "aliases"; }],
    ["field order", (value) => { value.fieldSchema.q1.reverse(); }],
    ["choice options", (value) => { value.fieldSchema.q1[0].options.reverse(); }]
  ];

  cases.forEach(([name, mutate]) => {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.deepEqual(exam.inspectSnapshot(candidate, slots, subject), { ok: false, reason: "field-schema-mismatch" }, name);
    assert.equal(exam.validateSnapshot(candidate, slots, subject), false, name);
    assert.throws(() => exam.restoreSession(candidate, slots, undefined, subject), /invalid exam snapshot/i, name);
  });
});

test("a current-bank field-id change is a schema mismatch when an active snapshot already has an answer", () => {
  const subject = { id: "schema-active", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const originalSlots = { 1: [question("q1", 1, 1, [field("saved-answer", "aliases", 1, "ja")])] };
  const session = exam.createSession(subject, originalSlots, memoryStore(), seededRng(1));
  session.setAnswer("q1", "saved-answer", "ja");
  const changedSlots = { 1: [question("q1", 1, 1, [field("current-answer", "aliases", 1, "ja")])] };

  assert.deepEqual(exam.inspectSnapshot(session.snapshot(), changedSlots, subject), {
    ok: false,
    reason: "field-schema-mismatch"
  });
});

test("a current-bank field change is a schema mismatch when a graded snapshot has saved grades", () => {
  const subject = { id: "schema-graded", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const originalSlots = { 1: [question("q1", 1, 1, [field("saved-answer", "aliases", 1, "ja")])] };
  const session = exam.createSession(subject, originalSlots, memoryStore(), seededRng(1));
  session.setAnswer("q1", "saved-answer", "ja");
  session.submit();
  const changedSlots = { 1: [question("q1", 1, 1, [{
    id: "current-answer", label: "Svar", kind: "choice", points: 1, expected: "yes",
    options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  }])] };

  assert.deepEqual(exam.inspectSnapshot(session.snapshot(), changedSlots, subject), {
    ok: false,
    reason: "field-schema-mismatch"
  });
});

test("dimensionless numeric fields may explicitly use a null target unit", () => {
  const subject = { id: "math", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const numeric = { id: "f", label: "Svar", kind: "numeric", points: 1, expected: 2, targetUnit: null };

  const session = exam.createSession(subject, { 1: [question("q", 1, 1, [numeric])] }, memoryStore(), seededRng(1));

  assert.deepEqual(session.snapshot().questionIds, ["q"]);
});

test("answers lock after submit and solutions remain gated until then", () => {
  const { session } = makeSession();
  assert.deepEqual(session.setAnswer("q-1", "value", "4 m"), { ok: true });
  assert.deepEqual(session.toggleSolution("q-1"), { ok: false, reason: "not-graded" });

  assert.equal(session.submit().ok, true);
  assert.deepEqual(session.setAnswer("q-1", "value", "9 m"), { ok: false, reason: "answers-locked" });
  assert.deepEqual(session.toggleSolution("q-1"), { ok: true, expanded: true });
  assert.deepEqual(session.snapshot().answers, { "q-1": { value: "4 m" } });
});

test("submit dispatches every automatic field kind and aggregates field points", () => {
  const fields = [
    Object.assign(field("n", "numeric", 1, 10), { targetUnit: "m" }),
    Object.assign(field("a", "aliases", 1, "ja"), { aliases: ["japp"] }),
    Object.assign(field("s", "solution-set", 1, [1, 2]), { variable: "x" }),
    Object.assign(field("e", "expression", 1, "x+1"), { variables: ["x"] }),
    field("f", "chemical-formula", 1, "H2O"),
    field("r", "chemical-equation", 1, "2H2+O2->2H2O"),
    { id: "c", label: "Val", kind: "choice", points: 1, expected: "yes", options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }] }
  ];
  const { session } = makeSession({
    subject: { id: "mixed", questionCount: 1, maxPoints: 7, passPoints: 3, durationMinutes: 1 },
    slots: { 1: [question("mixed-q", 1, 7, fields)] }
  });
  const answers = { n: "10 m", a: "japp", s: "2; 1", e: "1+x", f: "H₂O", r: "H2+H2+O2->2H2O", c: "yes" };
  Object.entries(answers).forEach(([id, raw]) => session.setAnswer("mixed-q", id, raw));

  const submitted = session.submit();
  const grade = session.snapshot().grades["mixed-q"];
  assert.equal(submitted.ok, true);
  assert.equal(grade.status, "correct");
  assert.equal(grade.earned, 7);
  assert.equal(Object.keys(grade.fieldResults).length, 7);
  assert.deepEqual(session.snapshot().result, { status: "complete", earned: 7, possible: 7 });
});

test("self fields keep automatic points and manual grading sets the question total", () => {
  const { session } = makeSession({
    subject: { id: "manual", questionCount: 1, maxPoints: 3, passPoints: 2, durationMinutes: 1 },
    slots: { 1: [Object.assign(question("manual-q", 1, 3, [field("auto", "aliases", 1, "rätt"), field("work", "self", 2)]), {
      rubric: [{ points: 2, text: "Korrekt redovisning" }]
    })] }
  });
  session.setAnswer("manual-q", "auto", "rätt");
  session.setAnswer("manual-q", "work", "på papper");
  session.submit();

  let snapshot = session.snapshot();
  assert.equal(snapshot.grades["manual-q"].status, "self");
  assert.equal(snapshot.grades["manual-q"].earned, 1);
  assert.deepEqual(snapshot.result, { status: "preliminary", earned: 1, possible: 3 });
  assert.deepEqual(session.setSelfGrade("manual-q", 2.5), { ok: true });

  snapshot = session.snapshot();
  assert.equal(snapshot.grades["manual-q"].earned, 2.5);
  assert.equal(snapshot.grades["manual-q"].status, "partial");
  assert.equal(snapshot.grades["manual-q"].selfAssessed, true);
  assert.deepEqual(snapshot.result, { status: "complete", earned: 2.5, possible: 3 });
  assert.deepEqual(session.setSelfGrade("manual-q", 2.25), { ok: false, reason: "invalid-points" });
  assert.deepEqual(session.setSelfGrade("manual-q", 3.5), { ok: false, reason: "invalid-points" });
});

test("override replaces the whole submitted question score and marks metadata", () => {
  const { session } = makeSession();
  session.setAnswer("q-1", "value", "4 m");
  session.setAnswer("q-2", "name", "nej");
  assert.deepEqual(session.overrideGrade("q-1", 1), { ok: false, reason: "not-graded" });
  session.submit();

  assert.deepEqual(session.overrideGrade("q-2", 1.5), { ok: true });
  let snapshot = session.snapshot();
  assert.equal(snapshot.grades["q-2"].earned, 1.5);
  assert.equal(snapshot.grades["q-2"].overridden, true);
  assert.deepEqual(snapshot.result, { status: "complete", earned: 3.5, possible: 4 });
  assert.deepEqual(session.overrideGrade("q-2", -0.5), { ok: false, reason: "invalid-points" });
});

test("restoreSession uses the saved question ids and preserves result metadata", () => {
  const { session, slots, subject } = makeSession();
  session.setAnswer("q-1", "value", "4 m");
  session.submit();
  session.overrideGrade("q-1", 1.5);
  const snapshot = session.snapshot();
  const restored = exam.restoreSession(snapshot, slots, undefined, subject);

  assert.deepEqual(restored.snapshot(), snapshot);
  assert.deepEqual(restored.navigate(1), { ok: true });
});

test("restore rejects wrong subjects, question selection shape, position, index, and timer state", () => {
  const { session, slots, subject } = makeSession();
  const valid = session.snapshot();
  const cases = [
    ["wrong subject", (value) => { value.subjectId = "physics-ks1"; }],
    ["missing exam id", (value) => { value.examId = ""; }],
    ["wrong question count", (value) => { value.questionIds.pop(); }],
    ["duplicate question id", (value) => { value.questionIds[1] = value.questionIds[0]; }],
    ["unknown question id", (value) => { value.questionIds[1] = "missing"; }],
    ["wrong slot order", (value) => { value.questionIds.reverse(); }],
    ["current index below range", (value) => { value.currentIndex = -1; }],
    ["current index above range", (value) => { value.currentIndex = 2; }],
    ["non-integer current index", (value) => { value.currentIndex = 0.5; }],
    ["missing timer", (value) => { delete value.timer; }],
    ["wrong timer duration", (value) => { value.timer.durationMs = 59_000; }],
    ["negative elapsed timer", (value) => { value.timer.elapsedMs = -1; }],
    ["elapsed timer beyond duration", (value) => { value.timer.elapsedMs = 60_001; }],
    ["nonfinite timer", (value) => { value.timer.elapsedMs = Infinity; }],
    ["negative running timestamp", (value) => { value.timer.runningSince = -1; }],
    ["nonfinite running timestamp", (value) => { value.timer.runningSince = NaN; }]
  ];

  cases.forEach(([name, mutate]) => {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => exam.restoreSession(candidate, slots, undefined, subject), /invalid exam snapshot/i, name);
  });
  assert.deepEqual(exam.restoreSession(valid, slots, undefined, subject).snapshot(), valid);
});

test("restore rejects malformed answer, flag, grade, and solution collections", () => {
  const { session, slots, subject } = makeSession();
  const valid = session.snapshot();
  const cases = [
    ["answers must be a map", (value) => { value.answers = []; }],
    ["answer question must be selected", (value) => { value.answers.missing = { value: "4" }; }],
    ["answer fields must be maps", (value) => { value.answers["q-1"] = []; }],
    ["answer field must exist", (value) => { value.answers["q-1"] = { missing: "4" }; }],
    ["raw answers must be strings", (value) => { value.answers["q-1"] = { value: 4 }; }],
    ["flags must be an array", (value) => { value.flags = {}; }],
    ["flags must be unique", (value) => { value.flags = ["q-1", "q-1"]; }],
    ["flags must be selected ids", (value) => { value.flags = ["missing"]; }],
    ["active grades must stay empty", (value) => { value.grades["q-1"] = {}; }],
    ["active result must stay absent", (value) => { value.result = { status: "complete", earned: 0, possible: 4 }; }],
    ["active solutions must stay collapsed", (value) => { value.expandedSolutions = ["q-1"]; }],
    ["solutions must be an array", (value) => { value.expandedSolutions = {}; }]
  ];

  cases.forEach(([name, mutate]) => {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => exam.restoreSession(candidate, slots, undefined, subject), /invalid exam snapshot/i, name);
  });
});

test("restore rejects mystery status and inconsistent graded result or override metadata", () => {
  const { session, slots, subject } = makeSession();
  session.setAnswer("q-1", "value", "4 m");
  session.setAnswer("q-2", "name", "ja");
  session.submit();
  const valid = session.snapshot();
  const cases = [
    ["mystery session status", (value) => { value.status = "mystery"; }],
    ["missing grade", (value) => { delete value.grades["q-1"]; }],
    ["extra grade", (value) => { value.grades.missing = value.grades["q-1"]; }],
    ["mystery grade status", (value) => { value.grades["q-1"].status = "mystery"; }],
    ["grade possible mismatch", (value) => { value.grades["q-1"].possible = 1; }],
    ["grade earned out of range", (value) => { value.grades["q-1"].earned = -1; }],
    ["missing field result", (value) => { delete value.grades["q-1"].fieldResults.value; }],
    ["extra field result", (value) => { value.grades["q-1"].fieldResults.missing = value.grades["q-1"].fieldResults.value; }],
    ["field result possible mismatch", (value) => { value.grades["q-1"].fieldResults.value.possible = 1; }],
    ["invalid override marker", (value) => { value.grades["q-1"].overridden = "true"; }],
    ["invalid self-assessment marker", (value) => { value.grades["q-1"].selfAssessed = 1; }],
    ["duplicate expanded solution", (value) => { value.expandedSolutions = ["q-1", "q-1"]; }],
    ["unknown expanded solution", (value) => { value.expandedSolutions = ["missing"]; }],
    ["missing result", (value) => { delete value.result; }],
    ["mystery result status", (value) => { value.result.status = "mystery"; }],
    ["wrong result earned", (value) => { value.result.earned -= 1; }],
    ["wrong result possible", (value) => { value.result.possible -= 1; }]
  ];

  cases.forEach(([name, mutate]) => {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => exam.restoreSession(candidate, slots, undefined, subject), /invalid exam snapshot/i, name);
  });
  assert.deepEqual(exam.restoreSession(valid, slots, undefined, subject).snapshot(), valid);
});

test("restore rejects graded answers and field results that disagree with the saved grade", () => {
  const { session, slots, subject } = makeSession();
  session.setAnswer("q-1", "value", "4 m");
  session.setAnswer("q-2", "name", "ja");
  session.submit();
  const valid = session.snapshot();
  const cases = [
    ["answer changed after grading", (value) => { value.answers["q-1"].value = "9 m"; }],
    ["field result message forged", (value) => { value.grades["q-1"].fieldResults.value.message = "Manipulerad bedömning."; }],
    ["question grade message forged", (value) => { value.grades["q-1"].message = "Manipulerad bedömning."; }]
  ];

  cases.forEach(([name, mutate]) => {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => exam.restoreSession(candidate, slots, undefined, subject), /invalid exam snapshot/i, name);
  });
  assert.deepEqual(exam.restoreSession(valid, slots, undefined, subject).snapshot(), valid);
});

test("browser build resolves grading through KS and exports the public API", () => {
  const context = vm.createContext({ window: {} });
  ["units.js", "expression-parser.js", "chemistry-parser.js", "grading.js", "exam-engine.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/js", file), "utf8"), context, { filename: file });
  });

  assert.equal(typeof context.window.KS.exam.createSession, "function");
  assert.equal(typeof context.window.KS.exam.createShuffleBag, "function");
  assert.equal(typeof context.window.KS.exam.questionFieldSchema, "function");
  assert.equal(typeof context.window.KS.exam.inspectSnapshot, "function");
});
