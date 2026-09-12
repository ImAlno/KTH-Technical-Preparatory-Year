const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const TEST_ROOT = __dirname;
const FIXTURE_DIR = path.join(TEST_ROOT, "fixtures");
const QUESTION_IDS_FIXTURE = path.join(FIXTURE_DIR, "question-ids.json");
const UNDERLAG_FIXTURE = path.join(FIXTURE_DIR, "underlag-sha256.txt");
const UNDERLAG_ROOT = path.join(TEST_ROOT, "../Underlag");

const SLOT_MAPS = [
  { subject: "math", root: "../Matematik KS2", slots: [1, 2, 3, 4, 5], fileName: "questions.js", prefix: "math-s" },
  { subject: "physics", root: "../Fysik KS1", slots: [1, 2, 3, 4, 5], fileName: "questions.js", prefix: "physics-s" },
  { subject: "chemistry", root: "../Kemi KS", slots: [1, 2, 3, 4, 5, 6], fileName: "questions.js", prefix: "chemistry-s" },
];

function readQuestionFixture() {
  const raw = fs.readFileSync(QUESTION_IDS_FIXTURE, "utf8");
  return JSON.parse(raw);
}

function collectQuestionIds() {
  return SLOT_MAPS.flatMap((subject) => subject.slots.map((slot) => {
    const slotPath = path.join(TEST_ROOT, subject.root, "questions", `slot-${slot}.js`);
    const questions = require(slotPath);
    return {
      subject: subject.subject,
      slot,
      ids: questions.map((question) => question.id),
    };
  }));
}

function collectUnderlagHashes() {
  const files = fs.readdirSync(UNDERLAG_ROOT).filter((name) => {
    const full = path.join(UNDERLAG_ROOT, name);
    return fs.statSync(full).isFile();
  });
  const sorted = files.slice().sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  return sorted.map((relative) => {
    const full = path.join(UNDERLAG_ROOT, relative);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
    return `${hash}  ${path.join("KS Förberedelse", "Underlag", relative)}`;
  });
}

function readUnderlagFixture() {
  const raw = fs.readFileSync(UNDERLAG_FIXTURE, "utf8").trim();
  return raw.length ? raw.split(/\r?\n/) : [];
}

test("question IDs in every slot are locked", () => {
  assert.deepEqual(collectQuestionIds(), readQuestionFixture());
});

test("Underlag files and byte hashes are locked", () => {
  const expected = readUnderlagFixture();
  const actual = collectUnderlagHashes();
  assert.deepEqual(actual, expected);
});
