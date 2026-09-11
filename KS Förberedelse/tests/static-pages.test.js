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
const SHARED_DEPENDENCIES = [
  "../assets/js/subject-config.js",
  "../assets/js/units.js",
  "../assets/js/expression-parser.js",
  "../assets/js/chemistry-parser.js",
  "../assets/js/grading.js",
  "../assets/js/storage.js",
  "../assets/js/timer.js",
  "../assets/js/exam-engine.js"
];
const MATH_QUESTION_SCRIPTS = [
  "questions/slot-1.js",
  "questions/slot-2.js",
  "questions/slot-3.js",
  "questions/slot-4.js",
  "questions/slot-5.js",
  "questions.js"
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function scriptSources(html) {
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g), (match) => match[1]);
}

function fakeNode(tagName) {
  const listeners = {};
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    hidden: false,
    disabled: false,
    open: false,
    attributes: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    fire(type, event) {
      (listeners[type] || []).forEach((handler) => handler(event || {}));
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "open") this.open = true;
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "open") this.open = false;
    },
    showModal() { this.setAttribute("open", ""); },
    close() { this.removeAttribute("open"); },
    focus() { this.focused = true; }
  };
}

function recoveryHarness(savedSnapshot, options) {
  const exam = require("../assets/js/exam-engine.js");
  const storage = require("../assets/js/storage.js");
  const timer = require("../assets/js/timer.js");
  const grading = require("../assets/js/grading.js");
  const stored = options && options.raw ? savedSnapshot : JSON.stringify(savedSnapshot);
  const values = new Map([["ks-practice:v1:recovery-test:active", stored]]);
  const adapter = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const nodes = {};
  [
    "subject-name", "session-state", "question-list", "status-region", "timer-display",
    "timer-start", "timer-pause", "timer-reset", "history-open", "history-dialog",
    "history-confirm", "submit-dialog", "submit-message", "submit-confirm", "recovery-dialog",
    "recovery-message", "recovery-continue", "recovery-new", "recovery-back", "formula-open",
    "formula-dialog", "formula-content", "print-formula", "print-exam"
  ].forEach((id) => { nodes[id] = fakeNode(id.endsWith("dialog") ? "dialog" : "div"); });
  const document = {
    body: fakeNode("body"),
    createElement: fakeNode,
    getElementById(id) { return nodes[id] || null; },
    querySelectorAll() { return []; }
  };
  const window = {
    KS: { exam, storage, timer, grading },
    localStorage: adapter,
    setInterval() { return 1; },
    clearInterval() {},
    addEventListener() {},
    print() {}
  };
  document.defaultView = window;
  const root = fakeNode("main");
  root.ownerDocument = document;
  const subjectData = {
    subject: { id: "recovery-test", name: "Test", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 },
    slots: {
      1: [{
        id: "q1", slot: 1, title: "Testfråga", points: 1,
        promptHtml: "<p>Fråga</p>", solutionHtml: "<p>Lösning</p>",
        fields: [{ id: "a", label: "Svar", kind: "aliases", points: 1, expected: "ja" }], rubric: []
      }]
    }
  };
  return { adapter, document, nodes, root, subjectData, values };
}

test("subject pages keep shared dependency order and load only implemented question banks", () => {
  for (const file of SUBJECT_PAGES) {
    const html = read(file);
    const scripts = scriptSources(html);
    const expected = SHARED_DEPENDENCIES.concat(file.startsWith("Matematik") ? MATH_QUESTION_SCRIPTS : [], "../assets/js/app.js");

    assert.doesNotMatch(html, /https?:\/\//, file);
    assert.deepEqual(scripts, expected, file);
    if (!file.startsWith("Matematik")) assert.doesNotMatch(html, /(?:questions|slot-?\d+)\.js/i, file);
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

test("the exam is one continuous white work surface on the gray page", () => {
  const css = read("assets/app.css");
  const layoutRule = css.match(/\.exam-layout\s*\{[^}]+\}/)[0];

  assert.match(layoutRule, /background:\s*var\(--surface\)/);
  assert.match(css, /body\s*\{[^}]*background:\s*var\(--background\)/s);
});

test("programmatic main focus receives a visible keyboard focus replacement", () => {
  const css = read("assets/app.css");
  const focusMatch = css.match(/#exam-app:focus-visible\s*\{[^}]+\}/);

  assert.ok(focusMatch, "a focused main target needs its own visible focus rule");
  assert.match(focusMatch[0], /outline:\s*3px\s+solid/);
  assert.match(focusMatch[0], /outline-offset:/);
});

test("the back link has a full touch target", () => {
  const css = read("assets/app.css");
  const backLinkRule = css.match(/\.back-link\s*\{[^}]+\}/)[0];

  assert.match(backLinkRule, /min-height:\s*44px/);
  assert.match(backLinkRule, /display:\s*(?:inline-)?flex/);
});

test("closed native dialogs stay hidden in the no-dialog fallback", () => {
  const css = read("assets/app.css");

  assert.match(css, /dialog:not\(\[open\]\)\s*\{\s*display:\s*none;?\s*\}/);
});

test("print mode removes interaction and prints every prompt with answer space", () => {
  const css = read("assets/app.css");
  const source = read("assets/js/app.js");

  assert.match(css, /@media\s+print/);
  ["app-header", "question-nav", "status-region", "timer", "screen-controls", "answer-area", "grade", "solution"].forEach((name) => {
    assert.match(css, new RegExp(`\\.${name}`), name);
  });
  assert.match(css, /\.print-exam[\s\S]*display:\s*block/);
  assert.match(css, /\.print-answer-space/);
  assert.match(css, /break-inside:\s*avoid/);
  assert.match(source, /`Uppgift \$\{position \+ 1\}: \$\{question\.title\} \(\$\{formatPoints\(question\.points\)\} p\)`/);
});

test("recovery cannot be dismissed while no session exists", () => {
  const source = read("assets/js/app.js");

  assert.match(source, /recoveryDialog\.addEventListener\("cancel",\s*function\s*\(event\)\s*\{[\s\S]{0,160}if \(!session\)[\s\S]{0,80}event\.preventDefault\(\)/);
});

test("a failed restore stays read-only until replacement is confirmed twice", () => {
  const source = read("assets/js/app.js");
  const restoreFunction = source.match(/function restoreSavedSession\(saved\)\s*\{[\s\S]+?\n    \}/)[0];

  assert.doesNotMatch(restoreFunction, /startNewSession\(/);
  assert.match(restoreFunction, /showRestoreFailure\(/);
  assert.match(source, /Det sparade provet kunde inte återställas/);
  assert.match(source, /function prepareReplacementConfirmation\(/);
  assert.match(source, /if \(elements\.recoveryDialog\.dataset\.confirming === "true"\)[\s\S]{0,160}startNewSession\(\)/);
});

test("failed recovery behavior preserves storage through cancel and first replacement choice", () => {
  const app = require("../assets/js/app.js");
  const key = "ks-practice:v1:recovery-test:active";
  const saved = { schemaVersion: 1, subjectId: "recovery-test", questionIds: ["missing-question"] };
  const harness = recoveryHarness(saved);
  const original = harness.values.get(key);

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  let cancelPrevented = false;
  harness.nodes["recovery-dialog"].fire("cancel", { preventDefault() { cancelPrevented = true; } });
  assert.equal(cancelPrevented, true);
  assert.equal(harness.values.get(key), original);

  harness.nodes["recovery-continue"].fire("click");
  assert.match(harness.nodes["recovery-message"].textContent, /kunde inte återställas/);
  assert.equal(harness.values.get(key), original);

  harness.nodes["recovery-new"].fire("click");
  assert.equal(harness.nodes["recovery-dialog"].dataset.confirming, "true");
  assert.equal(harness.values.get(key), original);

  harness.nodes["recovery-new"].fire("click");
  assert.notEqual(harness.values.get(key), original);
  assert.equal(JSON.parse(harness.values.get(key)).questionIds[0], "q1");
});

test("a render failure after restore clears the session and keeps recovery modal", () => {
  const app = require("../assets/js/app.js");
  const key = "ks-practice:v1:recovery-test:active";
  const saved = {
    schemaVersion: 1,
    subjectId: "recovery-test",
    questionIds: ["q1"],
    currentIndex: 0,
    answers: {},
    status: "active",
    grades: {},
    expandedSolutions: [],
    timer: { durationMs: 60_000, elapsedMs: 0, runningSince: null }
  };
  const harness = recoveryHarness(saved);
  const original = harness.values.get(key);

  app.mount(harness.root, harness.subjectData);
  harness.nodes["recovery-continue"].fire("click");
  assert.equal(harness.values.get(key), original);
  assert.equal(harness.nodes["recovery-dialog"].open, true);
  assert.match(harness.nodes["recovery-message"].textContent, /kunde inte återställas/);

  let cancelPrevented = false;
  harness.nodes["recovery-dialog"].fire("cancel", { preventDefault() { cancelPrevented = true; } });
  assert.equal(cancelPrevented, true);

  harness.nodes["recovery-new"].fire("click");
  assert.equal(harness.nodes["recovery-dialog"].dataset.confirming, "true");
  assert.equal(harness.values.get(key), original);
});

test("corrupt active JSON remains untouched until the second replacement confirmation", () => {
  const app = require("../assets/js/app.js");
  const key = "ks-practice:v1:recovery-test:active";
  const corrupt = "{broken-active-json";
  const harness = recoveryHarness(corrupt, { raw: true });

  app.mount(harness.root, harness.subjectData);
  assert.equal(harness.values.get(key), corrupt);
  assert.equal(harness.nodes["recovery-dialog"].open, true);
  assert.match(harness.nodes["recovery-message"].textContent, /kunde inte återställas/);

  let cancelPrevented = false;
  harness.nodes["recovery-dialog"].fire("cancel", { preventDefault() { cancelPrevented = true; } });
  assert.equal(cancelPrevented, true);
  assert.equal(harness.values.get(key), corrupt);

  harness.nodes["recovery-continue"].fire("click");
  assert.equal(harness.values.get(key), corrupt);
  assert.match(harness.nodes["recovery-message"].textContent, /kunde inte återställas/);

  harness.nodes["recovery-new"].fire("click");
  assert.equal(harness.nodes["recovery-dialog"].dataset.confirming, "true");
  assert.equal(harness.values.get(key), corrupt);

  harness.nodes["recovery-new"].fire("click");
  assert.notEqual(harness.values.get(key), corrupt);
  assert.equal(JSON.parse(harness.values.get(key)).questionIds[0], "q1");
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

test("the real Task 5 modules provide every callable API consumed by the app", () => {
  const exam = require("../assets/js/exam-engine.js");
  const storage = require("../assets/js/storage.js");
  const timer = require("../assets/js/timer.js");
  const values = new Map();
  const adapter = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const store = storage.createStore(adapter, "ui-compatibility");
  const subject = { id: "ui-compatibility", name: "Test", questionCount: 1, maxPoints: 1, passPoints: 1, durationMinutes: 1 };
  const slots = {
    1: [{
      id: "q1",
      slot: 1,
      title: "Testfråga",
      points: 1,
      promptHtml: "<p>Fråga</p>",
      solutionHtml: "<p>Lösning</p>",
      fields: [{ id: "a", label: "Svar", kind: "aliases", points: 1, expected: "ja" }],
      rubric: []
    }]
  };
  const session = exam.createSession(subject, slots, store, () => 0);

  ["navigate", "setAnswer", "toggleFlag", "submit", "setSelfGrade", "overrideGrade", "toggleSolution", "snapshot"].forEach((name) => {
    assert.equal(typeof session[name], "function", name);
  });
  assert.equal(session.navigate(0).ok, true);
  assert.equal(session.setAnswer("q1", "a", "ja").ok, true);
  assert.equal(session.toggleFlag("q1").ok, true);
  assert.equal(session.submit().ok, true);
  assert.deepEqual(session.setSelfGrade("q1", 1), { ok: false, reason: "not-self" });
  assert.equal(session.overrideGrade("q1", 1).ok, true);
  assert.equal(session.toggleSolution("q1").ok, true);
  assert.equal(store.loadActive().status, "graded");
  assert.equal(typeof store.clearHistory, "function");

  const timerState = timer.create(60_000);
  assert.equal(timer.remaining(timer.start(timerState, 1_000), 2_000), 59_000);
  assert.equal(timer.pause(timer.start(timerState, 1_000), 2_000).runningSince, null);
  assert.equal(timer.reset(timerState).elapsedMs, 0);
});
