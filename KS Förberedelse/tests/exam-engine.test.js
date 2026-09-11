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
  let activeWrites = 0;
  let historyWrites = 0;
  return {
    loadHistory() { return structuredClone(savedHistory); },
    saveHistory(next) { savedHistory = structuredClone(next); historyWrites += 1; return { ok: true, persisted: true }; },
    saveActive(next) { active = structuredClone(next); activeWrites += 1; return { ok: true, persisted: true }; },
    get active() { return active; },
    get history() { return savedHistory; },
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

test("invalid exam data is rejected before a session or history is written", () => {
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
    }
  ];

  cases.forEach(({ name, subject, slots }) => {
    const store = memoryStore();
    assert.throws(() => exam.createSession(subject, slots, store, seededRng(1)), /invalid exam data/i, name);
    assert.equal(store.historyWrites, 0, name);
    assert.equal(store.activeWrites, 0, name);
  });
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
    field("r", "chemical-equation", 1, "2H2+O2->2H2O")
  ];
  const { session } = makeSession({
    subject: { id: "mixed", questionCount: 1, maxPoints: 6, passPoints: 3, durationMinutes: 1 },
    slots: { 1: [question("mixed-q", 1, 6, fields)] }
  });
  const answers = { n: "10 m", a: "japp", s: "2; 1", e: "1+x", f: "OH2", r: "H2+H2+O2->2H2O" };
  Object.entries(answers).forEach(([id, raw]) => session.setAnswer("mixed-q", id, raw));

  const submitted = session.submit();
  const grade = session.snapshot().grades["mixed-q"];
  assert.equal(submitted.ok, true);
  assert.equal(grade.status, "correct");
  assert.equal(grade.earned, 6);
  assert.equal(Object.keys(grade.fieldResults).length, 6);
  assert.deepEqual(session.snapshot().result, { status: "complete", earned: 6, possible: 6 });
});

test("self fields keep automatic points and manual grading sets the question total", () => {
  const { session } = makeSession({
    subject: { id: "manual", questionCount: 1, maxPoints: 3, passPoints: 2, durationMinutes: 1 },
    slots: { 1: [question("manual-q", 1, 3, [field("auto", "aliases", 1, "rätt"), field("work", "self", 2)])] }
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
  const { session, slots } = makeSession();
  session.setAnswer("q-1", "value", "4 m");
  session.submit();
  session.overrideGrade("q-1", 1.5);
  const snapshot = session.snapshot();
  const restored = exam.restoreSession(snapshot, Object.fromEntries(Object.values(slots).flat().map((item) => [item.id, item])));

  assert.deepEqual(restored.snapshot(), snapshot);
  assert.deepEqual(restored.navigate(1), { ok: true });
});

test("browser build resolves grading through KS and exports the public API", () => {
  const context = vm.createContext({ window: {} });
  ["units.js", "expression-parser.js", "chemistry-parser.js", "grading.js", "exam-engine.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/js", file), "utf8"), context, { filename: file });
  });

  assert.equal(typeof context.window.KS.exam.createSession, "function");
  assert.equal(typeof context.window.KS.exam.createShuffleBag, "function");
});
