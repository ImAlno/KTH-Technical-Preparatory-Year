const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

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
const FIVE_SLOT_QUESTION_SCRIPTS = [
  "questions/slot-1.js",
  "questions/slot-2.js",
  "questions/slot-3.js",
  "questions/slot-4.js",
  "questions/slot-5.js",
  "questions.js"
];
const SIX_SLOT_QUESTION_SCRIPTS = FIVE_SLOT_QUESTION_SCRIPTS.slice(0, -1).concat("questions/slot-6.js", "questions.js");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function scriptSources(html) {
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g), (match) => match[1]);
}

function shippedHtmlAndJavaScript() {
  const files = [];
  const directories = [ROOT];

  while (directories.length) {
    const directory = directories.pop();
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(ROOT, absolutePath);
      if (entry.isDirectory()) {
        if (relativePath !== "tests" && relativePath !== "Underlag") directories.push(absolutePath);
      } else if (/\.(?:html|js)$/u.test(entry.name)) {
        files.push(absolutePath);
      }
    });
  }

  return files.sort();
}

const ALL_SHIPPED_HTML_AND_JS = shippedHtmlAndJavaScript();

function fakeNode(tagName) {
  const listeners = {};
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    hidden: false,
    disabled: false,
    open: false,
    style: {},
    scrollLeft: 0,
    scrollTop: 0,
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
      if (name === "data-print-mode") delete this.dataset.printMode;
    },
    scrollTo(left, top) {
      this.scrollLeft = left;
      this.scrollTop = top;
    },
    scrollBy(left, top) {
      this.scrollLeft += left;
      this.scrollTop += top;
    },
    showModal() { this.setAttribute("open", ""); },
    close() { this.removeAttribute("open"); },
    focus() { this.focused = true; },
    querySelectorAll(selector) {
      if (selector !== "[data-focus-key]") return [];
      return descendants(this).filter((node) => node !== this && typeof node.dataset.focusKey === "string");
    }
  };
}

function descendants(node) {
  return [node].concat((node.children || []).flatMap(descendants));
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
    "formula-dialog", "formula-content", "formula-image", "formula-zoom-out", "formula-zoom-in",
    "formula-fit", "formula-zoom-output", "print-formula", "print-exam"
  ].forEach((id) => { nodes[id] = fakeNode(id.endsWith("dialog") ? "dialog" : "div"); });
  nodes["formula-content"].clientWidth = 800;
  nodes["formula-content"].clientHeight = 600;
  nodes["formula-image"].naturalWidth = 2481;
  nodes["formula-image"].naturalHeight = 3508;
  nodes["formula-open"].hidden = true;
  const windowListeners = {};
  const document = {
    body: fakeNode("body"),
    createElement: fakeNode,
    getElementById(id) { return nodes[id] || null; },
    querySelectorAll() { return []; }
  };
  const window = {
    KS: { exam, storage, timer, grading },
    localStorage: adapter,
    setInterval(handler) { this.intervalHandler = handler; return 1; },
    clearInterval() {},
    addEventListener(type, handler) { windowListeners[type] = handler; },
    print() { this.printModeWhenPrinted = document.body.dataset.printMode || null; }
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
  return { adapter, document, nodes, root, subjectData, values, window, windowListeners };
}

function validRecoverySnapshot(status) {
  const active = {
    schemaVersion: 1,
    subjectId: "recovery-test",
    examId: "saved-exam",
    questionIds: ["q1"],
    currentIndex: 0,
    answers: {},
    flags: [],
    status: "active",
    grades: {},
    expandedSolutions: [],
    timer: { durationMs: 60_000, elapsedMs: 0, runningSince: null }
  };
  if (status !== "graded") return active;
  active.answers = { q1: { a: "ja" } };
  active.status = "graded";
  active.grades = {
    q1: {
      status: "correct",
      earned: 1,
      possible: 1,
      interpreted: null,
      message: "Uppgiften har rättats.",
      fieldResults: {
        a: { status: "correct", earned: 1, possible: 1, interpreted: "ja", message: "Rätt svar." }
      },
      requiresSelfAssessment: false
    }
  };
  active.result = { status: "complete", earned: 1, possible: 1 };
  return active;
}

test("all subject pages keep shared dependency order and load their complete question banks", () => {
  for (const file of SUBJECT_PAGES) {
    const html = read(file);
    const scripts = scriptSources(html);
    const questionScripts = file.startsWith("Kemi") ? SIX_SLOT_QUESTION_SCRIPTS : FIVE_SLOT_QUESTION_SCRIPTS;
    const expected = SHARED_DEPENDENCIES.concat(questionScripts, "../assets/js/app.js");

    assert.doesNotMatch(html, /https?:\/\//, file);
    assert.deepEqual(scripts, expected, file);
    scripts.forEach((source) => {
      assert.equal(fs.existsSync(path.resolve(path.dirname(path.join(ROOT, file)), source)), true, `${file}: ${source}`);
    });
  }
});

test("every subject page exposes the complete local application", () => {
  for (const page of SUBJECT_PAGES) {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    assert.match(html, /assets\/js\/exam-engine\.js/, page);
    assert.match(html, /assets\/js\/app\.js/, page);
    assert.doesNotMatch(html, /https?:\/\//, page);
  }
});

test("source underlag is never loaded by a student page", () => {
  for (const page of ALL_SHIPPED_HTML_AND_JS) {
    assert.doesNotMatch(fs.readFileSync(page, "utf8"), /Underlag\//, path.relative(ROOT, page));
  }
});

test("chemistry page references the full A4 raster of the configured local original sheet", () => {
  const html = read("Kemi KS/index.html");
  const subjectData = require("../Kemi KS/questions.js");
  const assetPath = path.join(ROOT, "Kemi KS/assets/formelblad-ks.png");

  const png = fs.readFileSync(assetPath);
  assert.deepEqual(pngDimensions(png), { width: 2481, height: 3508 });
  assert.ok(png.length > 250_000, `formula sheet is unexpectedly small: ${png.length} bytes`);
  assert.equal(
    crypto.createHash("sha256").update(png).digest("hex"),
    "e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee"
  );
  assert.match(html, /<img\b[^>]*src="assets\/formelblad-ks\.png"/);
  assert.equal(subjectData.formulaSheetUrl, "assets/formelblad-ks.png");
});

test("formula-sheet URLs accept only safe local relative asset paths", () => {
  const app = require("../assets/js/app.js");

  assert.equal(app.isSafeLocalAssetPath("assets/formelblad-ks.png"), true);
  [
    "https://example.test/formelblad.png",
    "http://example.test/formelblad.png",
    "//example.test/formelblad.png",
    "/absolute/formelblad.png",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "assets\\formelblad-ks.png",
    "assets/../Underlag/source.pdf",
    "assets/%2e%2e/Underlag/source.pdf",
    "assets/%252e%252e/Underlag/source.pdf",
    "%2fabsolute/formelblad.png",
    "assets/formelblad\n.png",
    "assets/%00formelblad.png",
    "assets/\u0085formelblad-ks.png",
    "assets/%C2%85formelblad-ks.png",
    "assets/%25C2%2585formelblad-ks.png"
  ].forEach((value) => {
    assert.equal(app.isSafeLocalAssetPath(value), false, value);
  });
});

test("an unsafe configured formula URL stays hidden and produces a controlled warning", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.formulaSheetUrl = "assets/%252e%252e/Underlag/source.pdf";

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  assert.equal(harness.nodes["formula-open"].hidden, true);
  assert.equal(harness.nodes["formula-image"].src, undefined);
  assert.match(harness.nodes["status-region"].textContent, /Formelbladet kunde inte öppnas.*säker lokal/);
});

test("chemistry formula dialog keeps the original image as its only visible formula content", () => {
  const html = read("Kemi KS/index.html");
  const css = read("assets/app.css");

  assert.match(html, /<dialog\s+id="formula-dialog"[^>]*aria-labelledby="formula-title"/);
  assert.match(html, /<img\b[^>]*id="formula-image"[^>]*src="assets\/formelblad-ks\.png"[^>]*width="2481"[^>]*height="3508"/);
  ["Zooma in", "Zooma ut", "Anpassa", "Skriv ut", "Stäng"].forEach((label) => {
    assert.match(html, new RegExp(`>\\s*${label}\\s*<`), label);
  });
  assert.match(html, /id="formula-transcription"\s+class="visually-hidden"/);
  assert.match(html, /Grundämnenas periodiska system/);
  assert.match(html, /Gasernas allmänna tillståndslag/);
  assert.match(html, /Den elektrokemiska spänningsserien/);
  assert.doesNotMatch(html, /https?:\/\/|data:/);
  assert.match(css, /\.formula-dialog-content\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.formula-sheet-image\s*\{[^}]*max-width:\s*none/s);
  assert.match(css, /@page\s+formula-sheet\s*\{[^}]*size:\s*A4[^}]*margin:\s*0/s);
  assert.match(css, /body\[data-print-mode="formula"\]\s*\{[^}]*page:\s*formula-sheet/s);
  assert.match(css, /body\[data-print-mode="formula"\][\s\S]*\.formula-sheet-image[\s\S]*width:\s*210mm\s*!important/);
});

test("formula controls load the configured sheet, clamp zoom, reset fit, pan, and isolate printing", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.formulaSheetUrl = "assets/formelblad-ks.png";

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  assert.equal(harness.nodes["formula-open"].hidden, false);
  assert.equal(harness.nodes["formula-image"].src, "assets/formelblad-ks.png");

  harness.nodes["formula-open"].fire("click");
  assert.equal(harness.nodes["formula-dialog"].open, true);
  assert.equal(harness.nodes["formula-content"].focused, true);
  assert.equal(harness.nodes["formula-zoom-output"].textContent, "100 %");
  assert.equal(harness.nodes["formula-content"].scrollLeft, 0);
  assert.equal(harness.nodes["formula-content"].scrollTop, 0);

  for (let index = 0; index < 20; index += 1) harness.nodes["formula-zoom-out"].fire("click");
  assert.equal(harness.nodes["formula-zoom-output"].textContent, "50 %");
  assert.equal(harness.nodes["formula-zoom-out"].disabled, true);

  for (let index = 0; index < 20; index += 1) harness.nodes["formula-zoom-in"].fire("click");
  assert.equal(harness.nodes["formula-zoom-output"].textContent, "300 %");
  assert.equal(harness.nodes["formula-zoom-in"].disabled, true);

  harness.nodes["formula-content"].fire("keydown", { key: "ArrowDown", preventDefault() {} });
  assert.equal(harness.nodes["formula-content"].scrollTop, 48);
  harness.nodes["formula-fit"].fire("click");
  assert.equal(harness.nodes["formula-zoom-output"].textContent, "100 %");
  assert.equal(harness.nodes["formula-content"].scrollTop, 0);

  harness.nodes["submit-confirm"].fire("click");
  assert.equal(harness.nodes["formula-open"].hidden, false, "the formula sheet stays available after grading");

  harness.nodes["print-formula"].fire("click");
  assert.equal(harness.window.printModeWhenPrinted, "formula");
  harness.windowListeners.afterprint();
  assert.equal(harness.document.body.dataset.printMode, undefined);
});

test("numeric answer fields expose the requested unit as a fixed accessible suffix", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.slots[1][0].fields = [{
    id: "acceleration",
    label: "Acceleration",
    kind: "numeric",
    points: 1,
    expected: 2.5,
    targetUnit: "m/s2",
    tolerance: { absolute: 0.01 }
  }];

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  const rendered = descendants(harness.root);
  const input = rendered.find((node) => node.tagName === "INPUT");
  const suffix = rendered.find((node) => node.className === "answer-unit");

  assert.ok(input, "the numeric answer input is rendered");
  assert.ok(suffix, "the target unit is rendered beside the input");
  assert.equal(suffix.textContent, "m/s²");
  assert.equal(input.attributes["aria-describedby"], suffix.id);
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

test("formula-sheet printing removes the modal backdrop from the A4 page", () => {
  const css = read("assets/app.css");
  const printRules = css.slice(css.indexOf("@media print"));

  assert.match(printRules, /\.formula-dialog::backdrop\s*\{[^}]*background:\s*transparent/s);
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

test("mounted recovery identifies semantic snapshot corruption without overwriting it", () => {
  const app = require("../assets/js/app.js");
  const key = "ks-practice:v1:recovery-test:active";
  const base = validRecoverySnapshot("graded");
  const cases = [
    ["mystery status", (value) => { value.status = "mystery"; }],
    ["wrong subject", (value) => { value.subjectId = "physics-ks1"; }],
    ["duplicate ids", (value) => { value.questionIds = ["q1", "q1"]; }],
    ["malformed answer map", (value) => { value.answers = []; }],
    ["malformed flag map", (value) => { value.flags = {}; }],
    ["invalid timer", (value) => { value.timer.elapsedMs = -1; }],
    ["inconsistent result", (value) => { value.result.earned = 0; }]
  ];

  cases.forEach(([name, mutate]) => {
    const candidate = structuredClone(base);
    mutate(candidate);
    const harness = recoveryHarness(candidate);
    const original = harness.values.get(key);

    assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true }, name);
    assert.equal(harness.nodes["recovery-dialog"].open, true, name);
    assert.match(harness.nodes["recovery-message"].textContent, /kunde inte återställas/, name);
    assert.equal(harness.values.get(key), original, name);
  });
});

test("mounted recovery rejects known ids saved in the wrong slot order", () => {
  const app = require("../assets/js/app.js");
  const saved = {
    schemaVersion: 1,
    subjectId: "recovery-test",
    examId: "wrong-order",
    questionIds: ["q2", "q1"],
    currentIndex: 0,
    answers: {},
    flags: [],
    status: "active",
    grades: {},
    expandedSolutions: [],
    timer: { durationMs: 60_000, elapsedMs: 0, runningSince: null }
  };
  const harness = recoveryHarness(saved);
  harness.subjectData.subject.questionCount = 2;
  harness.subjectData.subject.maxPoints = 2;
  harness.subjectData.slots[2] = [{
    id: "q2", slot: 2, title: "Andra frågan", points: 1,
    promptHtml: "<p>Fråga</p>", solutionHtml: "<p>Lösning</p>",
    fields: [{ id: "b", label: "Svar", kind: "aliases", points: 1, expected: "ja" }], rubric: []
  }];

  app.mount(harness.root, harness.subjectData);
  assert.match(harness.nodes["recovery-message"].textContent, /kunde inte återställas/);
  assert.equal(harness.nodes["recovery-dialog"].open, true);
});

test("valid active and graded snapshots still resume through the mounted app", () => {
  const app = require("../assets/js/app.js");

  ["active", "graded"].forEach((status) => {
    const snapshot = validRecoverySnapshot(status);
    const harness = recoveryHarness(snapshot);
    const original = harness.values.get("ks-practice:v1:recovery-test:active");

    app.mount(harness.root, harness.subjectData);
    assert.equal(String(harness.nodes["recovery-message"].textContent).includes("kunde inte återställas"), false, status);
    harness.nodes["recovery-continue"].fire("click");
    assert.equal(harness.nodes["recovery-dialog"].open, false, status);
    assert.equal(harness.nodes["session-state"].textContent, status === "active" ? "Pågående prov" : "Rättat prov");
    assert.equal(harness.values.get("ks-practice:v1:recovery-test:active"), original, status);
  });
});

test("flagging restores focus to the equivalent newly rendered control", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  const original = descendants(harness.root).find((node) => node.className === "neutral-button flag-button");
  assert.ok(original);
  original.fire("click");

  const replacement = descendants(harness.root).find((node) => node.className === "neutral-button flag-button");
  assert.notEqual(replacement, original);
  assert.equal(replacement.focused, true);
});

test("solution toggling restores focus to its equivalent newly rendered control", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  harness.nodes["submit-confirm"].fire("click");
  const original = descendants(harness.root).find((node) => node.textContent === "Visa lösning");
  assert.ok(original);
  original.fire("click");

  const replacement = descendants(harness.root).find((node) => node.textContent === "Dölj lösning");
  assert.notEqual(replacement, original);
  assert.equal(replacement.focused, true);
});

test("manual scoring restores focus to the equivalent newly rendered score control", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  harness.nodes["submit-confirm"].fire("click");
  const original = descendants(harness.root).find((node) => node.attributes["aria-label"] === "1 av 1 poäng");
  assert.ok(original);
  original.fire("click");

  const replacement = descendants(harness.root).find((node) => node.attributes["aria-label"] === "1 av 1 poäng");
  assert.notEqual(replacement, original);
  assert.equal(replacement.focused, true);
});

test("submitting an exam moves focus to the rendered results main", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  harness.nodes["submit-confirm"].fire("click");

  assert.equal(harness.root.focused, true);
  assert.equal(harness.nodes["session-state"].textContent, "Rättat prov");
});

test("timer expiry announces the zero transition once without submitting", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  const remaining = [1000, 0, 0];
  harness.window.KS.timer = Object.assign({}, harness.window.KS.timer, {
    remaining() { return remaining.shift(); }
  });

  app.mount(harness.root, harness.subjectData);
  harness.window.intervalHandler();
  assert.equal(harness.nodes["timer-display"].textContent, "00:00:00");
  assert.equal(harness.nodes["status-region"].textContent, "Tiden har gått ut.");
  assert.equal(harness.nodes["session-state"].textContent, "Pågående prov");
  assert.ok(descendants(harness.root).some((node) => node.tagName === "INPUT"));

  harness.nodes["status-region"].textContent = "Annat meddelande";
  harness.window.intervalHandler();
  assert.equal(harness.nodes["status-region"].textContent, "Annat meddelande");
});

test("a timer that expired while the page was closed announces once on restore", () => {
  const app = require("../assets/js/app.js");
  const snapshot = validRecoverySnapshot("active");
  snapshot.timer = { durationMs: 60_000, elapsedMs: 0, runningSince: 0 };
  const harness = recoveryHarness(snapshot);

  app.mount(harness.root, harness.subjectData);
  assert.equal(harness.nodes["recovery-dialog"].open, true);
  harness.nodes["recovery-continue"].fire("click");

  assert.equal(harness.nodes["timer-display"].textContent, "00:00:00");
  assert.equal(harness.nodes["status-region"].textContent, "Tiden har gått ut.");
  assert.equal(harness.nodes["session-state"].textContent, "Pågående prov");
  assert.ok(descendants(harness.root).some((node) => node.tagName === "INPUT"));

  harness.nodes["status-region"].textContent = "Annat meddelande";
  harness.window.intervalHandler();
  assert.equal(harness.nodes["status-region"].textContent, "Annat meddelande");
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
  ["mount", "questionStatus", "canShowSolution", "isSafeLocalAssetPath"].forEach((name) => {
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
