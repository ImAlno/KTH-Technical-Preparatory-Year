const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PHYSICS_ROOT = path.join(__dirname, "../Fysik KS1");
const FIXTURE_PATH = path.join(__dirname, "fixtures/physics-answer-semantics.txt");

function loadQuestions() {
  return [1, 2, 3, 4, 5].flatMap((slot) => require(path.join(PHYSICS_ROOT, `questions/slot-${slot}.js`)));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function answerProjection(question) {
  const field = question.fields.find((candidate) => candidate.kind === "numeric");
  assert.ok(field, `${question.id}: missing numeric answer field`);
  const numericField = Object.fromEntries(Object.entries(field).filter(([key]) => key !== "points"));
  return canonical({
    slot: question.slot,
    id: question.id,
    field: numericField,
    solutionHtml: question.solutionHtml,
    rubric: question.rubric
  });
}

function answerHash(question) {
  return crypto.createHash("sha256").update(JSON.stringify(answerProjection(question))).digest("hex");
}

test("physics answer semantics and solution rubrics match the pre-Task-5 baseline", () => {
  const lines = fs.readFileSync(FIXTURE_PATH, "utf8").trim().split(/\r?\n/);
  const fixture = {
    baselineCommit: lines.find((line) => line.startsWith("# baselineCommit=")).slice("# baselineCommit=".length),
    entries: lines.filter((line) => !line.startsWith("#")).map((line) => {
      const [slot, id, hash] = line.split("\t");
      return { slot: Number(slot), id, hash };
    })
  };
  const questions = loadQuestions();
  assert.equal(fixture.baselineCommit, "3c05c0a");
  assert.equal(fixture.entries.length, 125);
  assert.equal(questions.length, fixture.entries.length);
  questions.forEach((question, index) => {
    const expected = fixture.entries[index];
    assert.equal(expected.slot, question.slot, `question order ${index + 1}`);
    assert.equal(expected.id, question.id, `question order ${index + 1}`);
    assert.equal(expected.hash, answerHash(question), `${question.slot}/${question.id}`);
  });
});
