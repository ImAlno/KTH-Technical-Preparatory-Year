const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

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
  const files = collectUnderlagRelativeFiles(UNDERLAG_ROOT).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  return files.map((relative) => {
    const full = path.join(UNDERLAG_ROOT, relative);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
    return `${hash}  ${path.posix.join("KS Förberedelse", "Underlag", relative)}`;
  });
}

function collectUnderlagRelativeFiles(root, relativeRoot = "") {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return collectUnderlagRelativeFiles(path.join(root, entry.name), relativePath);
    }
    if (entry.isFile()) return [relativePath];
    return [];
  });
}

function byteSortedPaths(paths) {
  return paths.slice().sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
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

test("underlag collection is recursive and uses repository-style POSIX relative paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ks-preservation-underlag-"));
  try {
    fs.writeFileSync(path.join(root, "top-level.txt"), "top-level");
    const nestedPath = path.join(root, "nested", "deep");
    fs.mkdirSync(nestedPath, { recursive: true });
    fs.writeFileSync(path.join(nestedPath, "deep.txt"), "nested");

    const collected = byteSortedPaths(collectUnderlagRelativeFiles(root));
    assert.deepEqual(collected, ["nested/deep/deep.txt", "top-level.txt"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
