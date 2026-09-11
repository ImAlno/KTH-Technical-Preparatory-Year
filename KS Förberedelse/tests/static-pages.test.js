const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SUBJECT_PAGES = [
  "Matematik KS2/index.html",
  "Fysik KS1/index.html",
  "Kemi KS/index.html"
];
const SHARED_SCRIPTS = [
  "../assets/js/subject-config.js",
  "../assets/js/units.js",
  "../assets/js/expression-parser.js",
  "../assets/js/chemistry-parser.js",
  "../assets/js/grading.js",
  "../assets/js/storage.js",
  "../assets/js/timer.js",
  "../assets/js/exam-engine.js",
  "../assets/js/app.js"
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function scriptSources(html) {
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g), (match) => match[1]);
}

test("all subject pages use one local dependency order and no future question files", () => {
  for (const file of SUBJECT_PAGES) {
    const html = read(file);
    const scripts = scriptSources(html);

    assert.doesNotMatch(html, /https?:\/\//, file);
    assert.deepEqual(scripts, SHARED_SCRIPTS, file);
    assert.doesNotMatch(html, /(?:questions|slot-?\d+)\.js/i, file);
    scripts.forEach((source) => {
      assert.equal(fs.existsSync(path.resolve(path.dirname(path.join(ROOT, file)), source)), true, `${file}: ${source}`);
    });
  }
});

test("subject shells expose semantic landmarks, live feedback and native dialogs", () => {
  for (const file of SUBJECT_PAGES) {
    const html = read(file);

    assert.match(html, /<html\s+lang="sv">/, file);
    assert.match(html, /<header\b/, file);
    assert.match(html, /<nav\b[^>]*aria-label="Uppgifter"/, file);
    assert.match(html, /<main\s+id="exam-app"/, file);
    assert.match(html, /aria-live="polite"/, file);
    ["submit-dialog", "history-dialog", "formula-dialog", "recovery-dialog"].forEach((id) => {
      assert.match(html, new RegExp(`<dialog\\s+id="${id}"`), `${file}: ${id}`);
    });
  }
});

test("the visual system uses the approved restrained tokens and responsive grid", () => {
  const css = read("assets/app.css");
  const tokens = {
    text: "#1d1d1f",
    secondary: "#6e6e73",
    line: "#d2d2d7",
    surface: "#ffffff",
    background: "#f5f5f7",
    accent: "#0071e3",
    success: "#168447",
    danger: "#b42318"
  };

  Object.entries(tokens).forEach(([name, value]) => {
    assert.match(css, new RegExp(`--${name}:\\s*${value}`, "i"));
  });
  assert.match(css, /font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*"SF Pro Text",\s*"Helvetica Neue",\s*Arial,\s*sans-serif/);
  assert.match(css, /grid-template-columns:\s*96px\s+minmax\(0,\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*680px\)/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /gradient\s*\(/i);
  assert.doesNotMatch(css, /box-shadow\s*:/i);
  assert.doesNotMatch(css, /text-transform:\s*uppercase/i);
});

test("print mode removes interaction and prints every prompt with answer space", () => {
  const css = read("assets/app.css");

  assert.match(css, /@media\s+print/);
  ["app-header", "question-nav", "status-region", "timer", "screen-controls", "answer-area", "grade", "solution"].forEach((name) => {
    assert.match(css, new RegExp(`\\.${name}`), name);
  });
  assert.match(css, /\.print-exam[\s\S]*display:\s*block/);
  assert.match(css, /\.print-answer-space/);
  assert.match(css, /break-inside:\s*avoid/);
});

test("view-model labels distinguish progress and flags without relying on colour", () => {
  const app = require("../assets/js/app.js");
  const snapshot = {
    answers: {
      blank: {},
      started: { a: "utkast", b: "" },
      answered: { a: "klart", b: "också klart" }
    },
    flags: ["started"],
    questionFields: {
      blank: ["a"],
      started: ["a", "b"],
      answered: ["a", "b"]
    }
  };

  assert.deepEqual(app.questionStatus(snapshot, "blank"), { state: "unanswered", label: "obesvarad", flagged: false });
  assert.deepEqual(app.questionStatus(snapshot, "started"), { state: "started", label: "påbörjad", flagged: true });
  assert.deepEqual(app.questionStatus(snapshot, "answered"), { state: "answered", label: "besvarad", flagged: false });
});

test("solutions stay absent until grading and an explicit expansion", () => {
  const app = require("../assets/js/app.js");

  assert.equal(app.canShowSolution({ status: "active", expandedSolutions: ["q1"] }, "q1"), false);
  assert.equal(app.canShowSolution({ status: "graded", expandedSolutions: [] }, "q1"), false);
  assert.equal(app.canShowSolution({ status: "graded", expandedSolutions: ["q1"] }, "q1"), true);
});

test("mount reports a controlled Swedish state when subject data is missing", () => {
  const app = require("../assets/js/app.js");
  const controls = {};
  const document = {
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        children: [],
        append(...children) { this.children.push(...children); },
        set textContent(value) { this.text = value; }
      };
    },
    getElementById(id) { return controls[id] || null; }
  };
  const root = {
    ownerDocument: document,
    children: [],
    replaceChildren(...children) { this.children = children; }
  };
  controls["question-list"] = { replaceChildren() {} };
  ["timer-start", "timer-pause", "timer-reset", "history-open", "print-exam"].forEach((id) => {
    controls[id] = { disabled: false };
  });

  assert.deepEqual(app.mount(root, undefined), { ok: false, reason: "missing-question-bank" });
  assert.equal(root.children[0].children[0].text, "Frågebanken laddades inte");
  assert.equal(controls["timer-start"].disabled, true);
});

test("app exports the same public helpers in CommonJS and the browser namespace", () => {
  const source = read("assets/js/app.js");
  const app = require("../assets/js/app.js");
  const document = { readyState: "loading", addEventListener() {} };
  const context = vm.createContext({ window: {}, document, module: undefined });

  vm.runInContext(source, context, { filename: "app.js" });
  ["mount", "questionStatus", "canShowSolution"].forEach((name) => {
    assert.equal(typeof app[name], "function", `CommonJS ${name}`);
    assert.equal(typeof context.window.KS.app[name], "function", `browser ${name}`);
  });
});

test("interaction wiring keeps navigation free, autosaves input and uses session grading APIs", () => {
  const source = read("assets/js/app.js");

  assert.match(source, /addEventListener\("input"/);
  assert.match(source, /session\.setAnswer\(/);
  assert.match(source, /session\.navigate\(/);
  assert.match(source, /session\.submit\(/);
  assert.match(source, /session\.setSelfGrade\(/);
  assert.match(source, /session\.overrideGrade\(/);
  assert.match(source, /session\.toggleSolution\(/);
  assert.match(source, /KS\.timer\.(?:start|pause|reset)\(/);
});
