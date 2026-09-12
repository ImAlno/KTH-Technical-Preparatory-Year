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
  "../assets/js/exam-engine.js",
  "../assets/js/diagram-kit.js"
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

function cssTokens(css) {
  return Object.fromEntries(Array.from(css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi), (match) => [match[1], match[2]]));
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort((left, right) => right - left);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

function cssDeclarations(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return Object.fromEntries(Array.from(match[1].matchAll(/([\w-]+):\s*([^;]+);/g), (declaration) => [
    declaration[1], declaration[2].trim()
  ]));
}

function cascadedDeclarations(css, selectors) {
  return Object.assign({}, ...selectors.map((selector) => cssDeclarations(css, selector)));
}

function paletteValue(tokens, declaration) {
  const match = /^var\(--([\w-]+)\)$/.exec(declaration);
  assert.ok(match, `expected a palette token, received ${declaration}`);
  return tokens[match[1]];
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
    value: "",
    type: "",
    name: "",
    checked: false,
    htmlFor: "",
    _textContent: null,
    get textContent() {
      if (this._textContent !== null) return this._textContent;
      return (this.children || []).map((child) => child && child.textContent || "").join("");
    },
    set textContent(value) { this._textContent = String(value); },
    append(...children) {
      children.forEach((child) => {
        if (child && typeof child === "object") {
          child.parentNode = this;
          child.parentElement = this;
        }
      });
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    fire(type, event) {
      if ((type === "change" || type === "click") && this.tagName === "INPUT" && this.type === "radio") {
        this.checked = true;
        let ancestor = this.parentElement;
        while (ancestor) {
          const group = descendants(ancestor).filter((node) => node.tagName === "INPUT" && node.type === "radio" && node.name === this.name);
          if (group.length > 1) {
            group.forEach((node) => { node.checked = node === this; });
            break;
          }
          ancestor = ancestor.parentElement;
        }
      }
      (listeners[type] || []).forEach((handler) => handler(event || {}));
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "id") this.id = String(value);
      if (name === "open") this.open = true;
      if (name === "type") this.type = String(value);
      if (name === "name") this.name = String(value);
      if (name === "value") this.value = String(value);
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "id") delete this.id;
      if (name === "open") this.open = false;
      if (name === "data-print-mode") delete this.dataset.printMode;
    },
    getAttribute(name) {
      if (name === "id" && this.id !== undefined) return this.id;
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
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
      return descendants(this).filter((node) => node !== this && matchesSelector(node, selector));
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  };
}

function matchesSelector(node, selector) {
  if (selector === "svg") return node.tagName === "SVG";
  if (selector === "[id]") return typeof node.id === "string";
  if (selector === "[data-focus-key]") return typeof node.dataset.focusKey === "string";
  if (selector === "input") return node.tagName === "INPUT";
  if (selector === "textarea") return node.tagName === "TEXTAREA";
  if (selector === "button") return node.tagName === "BUTTON";
  if (selector === "label") return node.tagName === "LABEL";
  if (selector === "fieldset") return node.tagName === "FIELDSET";
  if (selector === "legend") return node.tagName === "LEGEND";
  if (selector === "aside") return node.tagName === "ASIDE";
  if (selector === "input[type=radio]") return node.tagName === "INPUT" && node.type === "radio";
  if (selector.startsWith(".")) return node.className === selector.slice(1);
  return false;
}

function fakeTemplate() {
  const template = fakeNode("template");
  template.content = fakeNode("fragment");
  Object.defineProperty(template, "innerHTML", {
    set(html) {
      const fragment = fakeNode("fragment");
      const stack = [fragment];
      const tokens = String(html).match(/<\/?[A-Za-z][^>]*>|[^<]+/gu) || [];
      tokens.forEach((token) => {
        if (/^<\//u.test(token)) {
          if (stack.length > 1) stack.pop();
          return;
        }
        if (/^</u.test(token)) {
          const tagMatch = token.match(/^<([A-Za-z][\w:-]*)/u);
          if (!tagMatch) return;
          const node = fakeNode(tagMatch[1]);
          const attributes = token.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(["'])(.*?)\2/gu);
          for (const attribute of attributes) node.setAttribute(attribute[1], attribute[3]);
          stack[stack.length - 1].append(node);
          if (!/\/>$/u.test(token)) stack.push(node);
          return;
        }
        if (token.trim()) stack[stack.length - 1].append({ textContent: token });
      });
      this.content = fragment;
    }
  });
  return template;
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
    createElement(tagName) { return String(tagName).toLowerCase() === "template" ? fakeTemplate() : fakeNode(tagName); },
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
        fields: [{ id: "a", label: "Svar", kind: "aliases", points: 1, expected: "ja" }],
        workOnPaper: { title: "Räknehäftet", instruction: "Visa ditt arbete i räknehäftet.", comparison: "Jämför ditt arbete med lösningen." },
        rubric: [{ points: 1, text: "Korrekt redovisning" }]
      }]
    }
  };
  return { adapter, document, nodes, root, subjectData, values, window, windowListeners };
}

function validRecoverySnapshot(status) {
  const active = {
    schemaVersion: 2,
    subjectId: "recovery-test",
    examId: "saved-exam",
    questionIds: ["q1"],
    fieldSchema: { q1: [{ id: "a", kind: "aliases", options: null }] },
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

test("choice fields render a semantic radio group and persist only the stable option value", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.slots[1][0].fields = [{
    id: "polarity", label: "Är molekylen en dipol?", kind: "choice", points: 1,
    expected: "yes", options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  }];

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  const fieldset = harness.root.querySelector("fieldset");
  const legend = harness.root.querySelector("legend");
  const radios = harness.root.querySelectorAll("input[type=radio]");
  const labels = harness.root.querySelectorAll("label");

  assert.ok(fieldset);
  assert.equal(legend.textContent, "Är molekylen en dipol?");
  assert.equal(radios.length, 2);
  assert.equal(labels.length, 2);
  assert.equal(new Set(radios.map((radio) => radio.name)).size, 1);
  assert.notEqual(radios[0].name, "polarity");

  radios[1].fire("change");
  const saved = JSON.parse(harness.values.get("ks-practice:v1:recovery-test:active"));
  assert.deepEqual(saved.answers, { q1: { polarity: "no" } });
});

test("native radio selection stays exclusive and checked after navigation rerender", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.subject.questionCount = 2;
  harness.subjectData.subject.maxPoints = 2;
  harness.subjectData.subject.passPoints = 2;
  harness.subjectData.slots[1][0].fields = [{
    id: "polarity", label: "Är molekylen en dipol?", kind: "choice", points: 1,
    expected: "yes", options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  }];
  harness.subjectData.slots[2] = [{
    id: "q2", slot: 2, title: "Andra frågan", points: 1,
    promptHtml: "<p>Fråga två</p>", solutionHtml: "<p>Lösning två</p>",
    fields: [{ id: "answer", label: "Svar", kind: "aliases", points: 1, expected: "ja" }],
    workOnPaper: harness.subjectData.slots[1][0].workOnPaper, rubric: []
  }];

  app.mount(harness.root, harness.subjectData);
  const original = harness.root.querySelector("input[type=radio]");
  const radios = harness.root.querySelectorAll("input[type=radio]");
  radios[1].fire("change");
  assert.equal(radios[1].checked, true);
  assert.equal(radios[0].checked, false);
  assert.equal(harness.root.querySelector("input[type=radio]"), original, "answer change only refreshes navigation");
  assert.deepEqual(JSON.parse(harness.values.get("ks-practice:v1:recovery-test:active")).answers, { q1: { polarity: "no" } });

  const next = descendants(harness.root).find((node) => node.tagName === "BUTTON" && node.textContent === "Nästa");
  next.fire("click");
  const previous = descendants(harness.root).find((node) => node.tagName === "BUTTON" && node.textContent === "Föregående");
  previous.fire("click");
  const restored = harness.root.querySelectorAll("input[type=radio]");
  assert.equal(restored[1].checked, true);
  assert.equal(restored[0].checked, false);
});

test("graded choice answers show Swedish labels without raw yes/no or geometry values", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.subject.maxPoints = 2;
  harness.subjectData.subject.passPoints = 2;
  harness.subjectData.slots[1][0].points = 2;
  harness.subjectData.slots[1][0].fields = [
    {
      id: "polarity", label: "Är molekylen en dipol?", kind: "choice", points: 1,
      expected: "yes", options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
    },
    {
      id: "geometry", label: "Geometri", kind: "choice", points: 1,
      expected: "tetrahedral", options: [{ value: "tetrahedral", label: "Tetraedrisk" }, { value: "linear", label: "Linjär" }]
    }
  ];

  app.mount(harness.root, harness.subjectData);
  harness.root.querySelectorAll("input[type=radio]").filter((radio) => radio.value === "yes" || radio.value === "tetrahedral")
    .forEach((radio) => radio.fire("change"));
  harness.nodes["submit-confirm"].fire("click");

  assert.match(harness.root.textContent, /Ja/);
  assert.match(harness.root.textContent, /Tetraedrisk/);
  assert.equal(harness.root.textContent.includes("yes"), false);
  assert.equal(harness.root.textContent.includes("tetrahedral"), false);
});

test("work-on-paper guidance precedes answers and never renders an input", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  const article = harness.root.children[0];
  const paper = article.children.find((node) => node.className === "work-on-paper");
  const answers = article.children.find((node) => node.className === "answer-area");

  assert.ok(paper);
  assert.equal(paper.tagName, "ASIDE");
  assert.equal(paper.children[0].textContent, "Räknehäftet");
  assert.ok(article.children.indexOf(paper) < article.children.indexOf(answers));
  assert.equal(paper.querySelectorAll("input").length, 0);
});

test("solution comparison is gated behind grading and explicit reveal", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  assert.equal(harness.root.querySelector(".comparison"), null);

  harness.nodes["submit-confirm"].fire("click");
  assert.equal(harness.root.querySelector(".comparison"), null);
  const showSolution = descendants(harness.root).find((node) => node.tagName === "BUTTON" && node.textContent === "Visa lösning");
  assert.ok(showSolution);
  showSolution.fire("click");

  const comparison = harness.root.querySelector(".comparison");
  assert.ok(comparison);
  assert.match(comparison.textContent, /Jämför ditt arbete med lösningen/);
  assert.match(comparison.textContent, /Korrekt redovisning/);
  assert.equal(comparison.querySelectorAll("input").length, 0);
  assert.equal(comparison.querySelectorAll("button").length, 0);
  assert.equal(comparison.querySelectorAll("textarea").length, 0);
  assert.doesNotMatch(comparison.textContent, /\b1\s*p\b/);
});

test("locked choice answers show Swedish labels and shipped UI has no self-assessment controls", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.slots[1][0].fields = [{
    id: "polarity", label: "Val", kind: "choice", points: 1,
    expected: "yes", options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  }];

  app.mount(harness.root, harness.subjectData);
  const radio = harness.root.querySelector("input[type=radio]");
  radio.fire("change");
  harness.nodes["submit-confirm"].fire("click");

  assert.equal(harness.root.querySelectorAll("input").length, 0);
  assert.equal(harness.root.querySelectorAll("textarea").length, 0);
  assert.equal(harness.root.querySelector(".manual-grade"), null);
  assert.equal(harness.root.querySelector(".self-score"), null);
  assert.match(harness.root.textContent, /Ja/);
  assert.doesNotMatch(harness.root.textContent, /Bedöm din lösning|Slutför självbedömningen/);
});

test("objective uncertainty directs the student to collapsed manual correction", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  harness.subjectData.slots[1][0].fields = [{
    id: "answer", label: "Svar", kind: "numeric", points: 1, expected: 2,
    targetUnit: "1", tolerance: { absolute: 0 }
  }];

  app.mount(harness.root, harness.subjectData);
  const input = harness.root.querySelector("input");
  input.value = "inte ett tal";
  input.fire("input");
  harness.nodes["submit-confirm"].fire("click");

  assert.match(harness.root.textContent, /Rättningen behöver kontrolleras/);
  const correction = harness.root.querySelector(".override-grade");
  const warningGrade = descendants(harness.root).find((node) => node.className === "grade" && node.dataset.tone === "warning");
  const warningIcon = descendants(harness.root).find((node) => node.className === "grade-tone-icon");
  assert.ok(correction);
  assert.ok(warningGrade);
  assert.ok(warningIcon);
  assert.equal(warningIcon.textContent, "⚠");
  assert.equal(warningIcon.attributes["aria-hidden"], "true");
  assert.match(warningGrade.textContent, /Bedömning: kontroll krävs/);
  assert.match(warningGrade.textContent, /Ändra poängen manuellt/);
  assert.equal(correction.open, false);
  assert.equal(harness.root.querySelector(".manual-grade"), null);
});

test("mounted grades distinguish correct, incorrect, partial and uncertain outcomes without color alone", () => {
  const app = require("../assets/js/app.js");
  const cases = [
    { name: "correct", values: ["ja"], tone: "success", glyph: "✓", heading: "Bedömning: rätt" },
    { name: "incorrect", values: ["nej"], tone: "warning", glyph: "×", heading: "Bedömning: inte rätt" },
    { name: "partial", values: ["ja", "nej"], tone: "warning", glyph: "⚠", heading: "Bedömning: delvis rätt", partial: true },
    { name: "uncertain", values: ["inte ett tal"], tone: "warning", glyph: "⚠", heading: "Bedömning: kontroll krävs", uncertain: true }
  ];

  cases.forEach((item) => {
    const harness = recoveryHarness(null);
    if (item.partial) {
      harness.subjectData.slots[1][0].fields = [
        { id: "a", label: "Svar A", kind: "aliases", points: 0.5, expected: "ja" },
        { id: "b", label: "Svar B", kind: "aliases", points: 0.5, expected: "ja" }
      ];
    }
    if (item.uncertain) {
      harness.subjectData.slots[1][0].fields = [{
        id: "a", label: "Svar", kind: "numeric", points: 1, expected: 2,
        targetUnit: "1", tolerance: { absolute: 0 }
      }];
    }

    app.mount(harness.root, harness.subjectData);
    const inputs = harness.root.querySelectorAll("input");
    item.values.forEach((value, index) => {
      inputs[index].value = value;
      inputs[index].fire("input");
    });
    harness.nodes["submit-confirm"].fire("click");

    const grade = descendants(harness.root).find((node) => node.className === "grade");
    const icon = descendants(grade).find((node) => node.className === "grade-tone-icon");
    assert.equal(grade.dataset.tone, item.tone, item.name);
    assert.ok(icon, item.name);
    assert.equal(icon.textContent, item.glyph, item.name);
    assert.equal(icon.attributes["aria-hidden"], "true", item.name);
    assert.match(grade.textContent, new RegExp(item.heading), item.name);
    if (item.uncertain) {
      assert.match(grade.textContent, /Rättningen behöver kontrolleras/, item.name);
      assert.match(grade.textContent, /Ändra poängen manuellt/, item.name);
      assert.doesNotMatch(grade.textContent, /Bedömning: inte rätt/, item.name);
    }
  });
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

test("the visual system uses the approved academic-journal tokens and font roles", () => {
  const css = read("assets/app.css");
  const tokens = {
    paper: "#FBF8EF",
    ground: "#E8E1D3",
    ink: "#34202A",
    muted: "#74676C",
    rule: "#C9BEB8",
    work: "#356B59",
    attention: "#A94F3B"
  };

  Object.entries(tokens).forEach(([name, value]) => {
    assert.match(css, new RegExp(`--${name}:\\s*${value}`, "i"));
  });
  assert.match(css, /(?:\.prompt|\.solution)[\s\S]{0,240}font-family:\s*Georgia,\s*"Times New Roman",\s*serif/);
  assert.match(css, /(?:button|input)[\s\S]{0,180}font-family:\s*"Helvetica Neue",\s*Arial,\s*sans-serif/);
  assert.match(css, /(?:h1|h2)[\s\S]{0,240}font-family:\s*Georgia,\s*"Times New Roman",\s*serif/);
  assert.match(css, /grid-template-columns:\s*104px\s+minmax\(0,\s*72ch\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /gradient\s*\(/i);
  assert.doesNotMatch(css, /text-transform:\s*uppercase/i);
  assert.doesNotMatch(css, /#0071e3|#0068d1|#f5f5f7|#d2d2d7|-apple-system|BlinkMacSystemFont|SF Pro/i);
  assert.equal((css.match(/box-shadow\s*:/gi) || []).length, 1, "only the continuous paper may cast a shadow");
});

test("the exam is one continuous paper surface with one narrow folio rail", () => {
  const css = read("assets/app.css");
  const layoutRule = css.match(/\.exam-layout\s*\{[^}]+\}/)[0];
  const railRule = css.match(/\.question-nav\s*\{[^}]+\}/)[0];

  assert.match(layoutRule, /background:\s*var\(--paper\)/);
  assert.match(layoutRule, /box-shadow:\s*0\s+\d+px\s+\d+px/);
  assert.match(css, /body\s*\{[^}]*background:\s*var\(--ground\)/s);
  assert.match(railRule, /border-left:\s*3px\s+solid\s+var\(--ink\)/);
  assert.match(css, /\.question-nav\s+button\[aria-current="step"\]\s*\{[^}]*background:\s*var\(--ink\)[^}]*color:\s*var\(--paper\)/s);
  assert.doesNotMatch(css, /\.question-screen\s*\{[^}]*box-shadow|\.prompt\s*\{[^}]*box-shadow|\.answer-area\s*\{[^}]*box-shadow/s);
});

test("work, comparison, warnings and manual correction have distinct structural treatments", () => {
  const css = read("assets/app.css");

  assert.match(css, /\.work-on-paper[\s\S]{0,180}border-left:\s*3px\s+solid\s+var\(--work\)/);
  assert.match(css, /\.comparison[\s\S]{0,180}border-top:\s*3px\s+solid\s+var\(--work\)/);
  assert.match(css, /\.solution\s*\{[^}]*border-top:\s*3px\s+solid\s+var\(--work\)/s);
  assert.match(css, /button\[data-flagged="true"\][\s\S]{0,220}border-color:\s*var\(--attention\)/);
  assert.match(css, /button\[data-flagged="true"\][\s\S]{0,300}content:\s*"\s*⚑\s*"/);
  assert.match(css, /\.override-grade\s+summary\s*\{[^}]*color:\s*var\(--muted\)/s);
  assert.match(css, /\.exam-total\s*\{[^}]*border-radius:\s*6px/s);
  assert.match(css, /dialog\s*\{[^}]*border-radius:\s*6px/s);
});

test("the current flagged question retains both semantics and uses a compliant compound palette state", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  app.mount(harness.root, harness.subjectData);
  descendants(harness.root).find((node) => node.className === "neutral-button flag-button").fire("click");

  const currentFlagged = harness.nodes["question-list"].querySelector("button");
  assert.equal(currentFlagged.attributes["aria-current"], "step");
  assert.equal(currentFlagged.dataset.flagged, "true");
  assert.match(currentFlagged.attributes["aria-label"], /markerad/);

  const css = read("assets/app.css");
  const tokens = cssTokens(css);
  const states = [
    {
      name: "current",
      selectors: [".question-nav button", '.question-nav button[aria-current="step"]'],
      background: "--ink", foreground: "--paper", border: "--ink"
    },
    {
      name: "flagged",
      selectors: [".question-nav button", '.question-nav button[data-flagged="true"]'],
      background: "transparent", foreground: "--muted", border: "--attention",
      glyphSelectors: ['.question-nav button[data-flagged="true"] .question-marker::after'], glyph: "--attention"
    },
    {
      name: "current flagged",
      selectors: [
        ".question-nav button",
        '.question-nav button[aria-current="step"]',
        '.question-nav button[data-flagged="true"]',
        '.question-nav button[aria-current="step"][data-flagged="true"]'
      ],
      background: "--attention", foreground: "--paper", border: "--attention",
      glyphSelectors: [
        '.question-nav button[data-flagged="true"] .question-marker::after',
        '.question-nav button[aria-current="step"][data-flagged="true"] .question-marker::after'
      ],
      glyph: "--paper"
    }
  ];

  states.forEach((state) => {
    const declarations = cascadedDeclarations(css, state.selectors);
    assert.equal(declarations.background, state.background === "transparent" ? "transparent" : `var(${state.background})`, `${state.name} background`);
    assert.equal(declarations.color, `var(${state.foreground})`, `${state.name} text`);
    assert.equal(declarations["border-color"], `var(${state.border})`, `${state.name} border`);
    const background = state.background === "transparent" ? tokens.paper : paletteValue(tokens, declarations.background);
    assert.ok(contrastRatio(paletteValue(tokens, declarations.color), background) >= 4.5, `${state.name} text contrast`);
    assert.ok(contrastRatio(paletteValue(tokens, declarations["border-color"]), tokens.paper) >= 3, `${state.name} boundary contrast`);
    if (state.glyphSelectors) {
      const glyph = cascadedDeclarations(css, state.glyphSelectors).color;
      assert.equal(glyph, `var(${state.glyph})`, `${state.name} flag glyph`);
      assert.ok(contrastRatio(paletteValue(tokens, glyph), background) >= 4.5, `${state.name} flag glyph contrast`);
    }
  });
});

test("every declared active control boundary has at least 3 to 1 non-text contrast", () => {
  const css = read("assets/app.css");
  const tokens = cssTokens(css);
  const boundaries = [
    ["neutral button", /\.timer button,\s*\.neutral-button\s*\{[^}]*border:\s*1px\s+solid\s+var\(--muted\)/s, "muted", "paper"],
    ["neutral button hover", /\.timer button:hover:not\(\[disabled\]\),\s*\.neutral-button:hover:not\(\[disabled\]\)\s*\{[^}]*border-color:\s*var\(--muted\)/s, "muted", "paper"],
    ["answer input", /\.answer-field input\s*\{[^}]*border:\s*1px\s+solid\s+var\(--muted\)/s, "muted", "paper"],
    ["answer input interaction", /\.answer-field input:hover:not\(\[disabled\]\),\s*\.answer-field input:focus\s*\{[^}]*border-color:\s*var\(--work\)/s, "work", "paper"],
    ["choice hover", /\.choice-option:hover\s*\{[^}]*border-color:\s*var\(--muted\)/s, "muted", "paper"],
    ["radio", /\.choice-option input\s*\{[^}]*outline:\s*1px\s+solid\s+var\(--muted\)/s, "muted", "paper"],
    ["radio focus", /\.choice-option input:focus-visible\s*\{[^}]*outline:\s*3px\s+solid\s+var\(--work\)/s, "work", "paper"],
    ["current question", /button\[aria-current="step"\]\s*\{[^}]*border-color:\s*var\(--ink\)/s, "ink", "paper"],
    ["flagged question", /button\[data-flagged="true"\]\s*\{[^}]*border-color:\s*var\(--attention\)/s, "attention", "paper"],
    ["pressed flag", /\.flag-button\[aria-pressed="true"\]\s*\{[^}]*border-color:\s*var\(--attention\)/s, "attention", "paper"],
    ["pressed score", /\.point-choices button\[aria-pressed="true"\]\s*\{[^}]*border-color:\s*var\(--ink\)/s, "ink", "paper"],
    ["primary button", /\.primary-button\s*\{[^}]*border:\s*1px\s+solid\s+var\(--ink\)/s, "ink", "paper"],
    ["primary button hover", /\.primary-button:hover:not\(\[disabled\]\)\s*\{[^}]*border-color:\s*var\(--work\)/s, "work", "paper"],
    ["keyboard focus", /:focus-visible[\s\S]{0,260}outline:\s*3px\s+solid\s+var\(--work\)/s, "work", "paper"]
  ];

  boundaries.forEach(([label, declaration, foreground, background]) => {
    assert.match(css, declaration, label);
    assert.ok(
      contrastRatio(tokens[foreground], tokens[background]) >= 3,
      `${label}: ${foreground} against ${background} must be at least 3:1`
    );
  });
  assert.match(css, /button\[disabled\][\s\S]{0,260}border-color:\s*var\(--rule\)/s);
  assert.match(css, /button\[disabled\][\s\S]{0,260}opacity:\s*1/s);
});

test("disabled primary buttons cannot enter the active hover cascade and stay intentionally distinct", () => {
  const css = read("assets/app.css");
  const tokens = cssTokens(css);
  const base = cssDeclarations(css, ".primary-button");
  const hover = cssDeclarations(css, ".primary-button:hover:not([disabled])");
  const disabled = cssDeclarations(css, ".primary-button[disabled]");

  assert.doesNotMatch(css, /\.primary-button:hover\s*\{/);
  assert.ok(css.indexOf(".primary-button[disabled]") > css.indexOf(".primary-button:hover:not([disabled])"), "disabled rule follows active states");
  assert.equal(disabled.background, "var(--ground)");
  assert.equal(disabled.color, "var(--muted)");
  assert.equal(disabled["border-color"], "var(--rule)");
  assert.equal(disabled.cursor, "default");
  assert.equal(disabled.opacity, "1");
  assert.notEqual(disabled.background, base.background);
  assert.notEqual(disabled.background, hover.background);
  assert.ok(contrastRatio(tokens.muted, tokens.ground) >= 3, "disabled label remains intentionally legible");
});

test("status announcements transition between neutral, success and warning tones", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  harness.nodes["timer-start"].fire("click");
  assert.equal(harness.nodes["status-region"].dataset.tone, "neutral");
  assert.equal(harness.nodes["status-region"].textContent, "Tidtagningen startade.");

  harness.nodes["history-confirm"].fire("click");
  assert.equal(harness.nodes["status-region"].dataset.tone, "success");
  assert.equal(harness.nodes["status-region"].textContent, "Frågehistoriken rensades.");

  const warningHarness = recoveryHarness(null);
  warningHarness.subjectData.formulaSheetUrl = "assets/%252e%252e/Underlag/source.pdf";
  app.mount(warningHarness.root, warningHarness.subjectData);
  assert.equal(warningHarness.nodes["status-region"].dataset.tone, "warning");
  assert.match(warningHarness.nodes["status-region"].textContent, /^⚠\s+Varning:/);
  assert.match(warningHarness.nodes["status-region"].textContent, /Formelbladet kunde inte öppnas/);
});

test("semantic status and grade tones have visible structural treatments", () => {
  const css = read("assets/app.css");

  assert.match(css, /\.status-region\s*\{[^}]*border:\s*1px\s+solid\s+var\(--muted\)/s);
  assert.match(css, /\.status-region\[data-tone="success"\]\s*\{[^}]*border-color:\s*var\(--work\)/s);
  assert.match(css, /\.status-region\[data-tone="warning"\]\s*\{[^}]*border-color:\s*var\(--attention\)/s);
  assert.match(css, /\.grade\[data-tone="success"\]\s*\{[^}]*border-left:\s*3px\s+solid\s+var\(--work\)/s);
  assert.match(css, /\.grade\[data-tone="warning"\]\s*\{[^}]*border-left:\s*3px\s+solid\s+var\(--attention\)/s);
  assert.match(css, /\.success-heading\s*\{[^}]*color:\s*var\(--work\)/s);
  assert.match(css, /\.warning-heading\s*\{[^}]*color:\s*var\(--attention\)/s);
  SUBJECT_PAGES.forEach((page) => {
    assert.match(read(page), /id="status-region"[^>]*role="status"[^>]*aria-live="polite"/, page);
  });
});

test("mobile journal layout contains scrolling to the rail and keeps 44px targets", () => {
  const css = read("assets/app.css");
  const mobile = css.slice(css.indexOf("@media (max-width: 680px)"), css.indexOf("@media (prefers-reduced-motion: reduce)"));

  assert.match(mobile, /body\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(mobile, /\.exam-layout\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(mobile, /\.question-nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(mobile, /\.question-nav\s+ol\s*\{[^}]*flex-direction:\s*row/s);
  assert.match(mobile, /\.question-nav\s+button\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(mobile, /\.timer\s+button[\s\S]{0,180}min-width:\s*44px/);
  assert.match(css, /img,\s*svg\s*\{[^}]*max-width:\s*100%/s);
});

test("screen diagrams keep intrinsic legible sizing inside their own horizontal scroller", () => {
  const css = read("assets/app.css");
  assert.match(css, /\.prompt,\s*\n\.solution\s*\{[^}]*overflow-x:\s*auto;/u);
  assert.match(css, /\.prompt\s*>\s*svg,\s*\n\.solution\s*>\s*svg\s*\{[^}]*max-width:\s*none;/u);
  assert.match(css, /@media print\s*\{[\s\S]*?\.prompt,\s*\n\s*\.solution\s*\{[^}]*overflow-x:\s*visible;/u);
  assert.match(css, /@media print\s*\{[\s\S]*?\.prompt\s*>\s*svg,\s*\n\s*\.solution\s*>\s*svg\s*\{[^}]*max-width:\s*100%;/u);
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
  const printRules = css.slice(css.indexOf("@media print"));

  assert.match(css, /@media\s+print/);
  ["app-header", "question-nav", "status-region", "timer", "screen-controls", "answer-area", "grade", "solution-controls", "solution"].forEach((name) => {
    assert.match(printRules, new RegExp(`\\.${name}[\\s\\S]{0,220}display:\\s*none\\s*!important`), name);
  });
  assert.match(printRules, /:root,\s*body\s*\{[^}]*background:\s*#fff(?:fff)?[^}]*color:\s*#000/s);
  assert.match(printRules, /\.print-exam\s*\{[^}]*display:\s*block/s);
  assert.match(printRules, /\.print-work-on-paper\s*\{[^}]*display:\s*block[^}]*border-left:\s*3px\s+solid\s+#000/s);
  assert.match(printRules, /\.print-answer-space\s*\{[^}]*min-height:\s*\d+(?:\.\d+)?mm[^}]*border:\s*1px\s+solid\s+#000/s);
  assert.match(printRules, /\.print-question\s*\{[^}]*break-inside:\s*avoid/s);
  assert.match(source, /`Uppgift \$\{position \+ 1\}: \$\{question\.title\} \(\$\{formatPoints\(question\.points\)\} p\)`/);
  assert.match(source, /"aside",\s*"print-work-on-paper"/);
});

test("student-facing sources use no external assets or decorative separator templates", () => {
  const files = ["index.html", ...SUBJECT_PAGES, "assets/app.css", "assets/js/app.js"];

  files.forEach((file) => {
    const source = read(file);
    assert.doesNotMatch(source, /https?:\/\/|@import\s+url|url\(\s*["']?\/\//i, file);
    assert.doesNotMatch(source, /\s·\s|\s—\s/, file);
  });
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

test("version-1 recovery names changed answer types and leaves active and history storage untouched until replacement is confirmed", () => {
  const app = require("../assets/js/app.js");
  const key = "ks-practice:v1:recovery-test:active";
  const historyKey = "ks-practice:v1:recovery-test:history";
  const saved = validRecoverySnapshot("active");
  saved.schemaVersion = 1;
  delete saved.fieldSchema;
  const harness = recoveryHarness(saved);
  harness.values.set(historyKey, JSON.stringify({ schemaVersion: 1, slots: { 1: { queue: ["q1"], lastId: "q1" } } }));
  const original = harness.values.get(key);
  const originalHistory = harness.values.get(historyKey);

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  assert.equal(harness.nodes["recovery-dialog"].open, true);
  assert.equal(harness.nodes["recovery-message"].textContent, "Provets svarstyp har uppdaterats. Starta ett nytt prov för att fortsätta.");
  assert.equal(harness.values.get(key), original);
  assert.equal(harness.values.get(historyKey), originalHistory);

  harness.nodes["recovery-new"].fire("click");
  assert.equal(harness.nodes["recovery-dialog"].dataset.confirming, "true");
  assert.equal(harness.values.get(key), original);
  assert.equal(harness.values.get(historyKey), originalHistory);

  harness.nodes["recovery-new"].fire("click");
  assert.notEqual(harness.values.get(key), original);
});

test("changed saved field schemas use the answer-type recovery copy", () => {
  const app = require("../assets/js/app.js");
  const saved = validRecoverySnapshot("active");
  saved.fieldSchema.q1[0].id = "changed";
  const harness = recoveryHarness(saved);

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  assert.equal(harness.nodes["recovery-dialog"].open, true);
  assert.equal(harness.nodes["recovery-message"].textContent, "Provets svarstyp har uppdaterats. Starta ett nytt prov för att fortsätta.");
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
    schemaVersion: 2,
    subjectId: "recovery-test",
    examId: "wrong-order",
    questionIds: ["q2", "q1"],
    fieldSchema: {
      q2: [{ id: "b", kind: "aliases", options: null }],
      q1: [{ id: "a", kind: "aliases", options: null }]
    },
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
  const original = descendants(harness.root).find((node) => node.tagName === "BUTTON" && node.textContent === "Visa lösning");
  assert.ok(original);
  original.fire("click");

  const replacement = descendants(harness.root).find((node) => node.tagName === "BUTTON" && node.textContent === "Dölj lösning");
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

test("override scoring reopens its recreated details panel before restoring focus", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);

  app.mount(harness.root, harness.subjectData);
  harness.nodes["submit-confirm"].fire("click");
  const originalDetails = descendants(harness.root).find((node) => node.className === "override-grade");
  const original = descendants(harness.root).find((node) => node.dataset.focusKey === "override-score:q1:1");
  assert.ok(originalDetails);
  assert.ok(original);
  originalDetails.open = true;
  original.fire("click");

  const replacementDetails = descendants(harness.root).find((node) => node.className === "override-grade");
  const replacement = descendants(harness.root).find((node) => node.dataset.focusKey === "override-score:q1:1");
  assert.notEqual(replacementDetails, originalDetails);
  assert.notEqual(replacement, original);
  assert.equal(replacementDetails.open, true);
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
  assert.equal(harness.nodes["status-region"].dataset.tone, "warning");
  assert.equal(harness.nodes["status-region"].textContent, "⚠ Varning: Tiden har gått ut.");
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
  assert.equal(harness.nodes["status-region"].dataset.tone, "warning");
  assert.equal(harness.nodes["status-region"].textContent, "⚠ Varning: Tiden har gått ut.");
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

test("diagram preflight fails before creating a session and preserves active and history bytes", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  const activeKey = "ks-practice:v1:recovery-test:active";
  const historyKey = "ks-practice:v1:recovery-test:history";
  const activeBytes = "{\"sentinel\":\"active bytes\"}";
  const historyBytes = "[{\"sentinel\":\"history bytes\"}]";
  let createCalls = 0;
  let restoreCalls = 0;
  let validateCalls = 0;

  harness.values.set(activeKey, activeBytes);
  harness.values.set(historyKey, historyBytes);
  harness.subjectData.slots[1][0].sourceData = { diagram: { id: "broken-prompt-diagram" } };
  harness.window.KS.diagram = {
    validateManifest() {
      validateCalls += 1;
      throw new Error("broken manifest");
    }
  };
  harness.window.KS.exam = Object.assign({}, harness.window.KS.exam, {
    createSession() { createCalls += 1; throw new Error("must not create"); },
    restoreSession() { restoreCalls += 1; throw new Error("must not restore"); }
  });

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: false, reason: "diagram-preflight-failed" });
  assert.equal(validateCalls, 1);
  assert.equal(createCalls, 0);
  assert.equal(restoreCalls, 0);
  assert.equal(harness.values.get(activeKey), activeBytes);
  assert.equal(harness.values.get(historyKey), historyBytes);
  assert.equal(harness.root.textContent, "Diagrammet kunde inte visas korrekt. Dina sparade svar har inte ändrats.");
  [
    "timer-start", "timer-pause", "timer-reset", "history-open", "history-confirm",
    "submit-confirm", "recovery-continue", "recovery-new", "print-exam"
  ].forEach((id) => assert.equal(harness.nodes[id].disabled, true, id));
});

test("diagram preflight validates every prompt manifest before creating a new exam", () => {
  const app = require("../assets/js/app.js");
  const harness = recoveryHarness(null);
  function fixture(id, title) {
    const manifest = {
      id, title, description: "Beskrivning", titleId: id + "-title", descriptionId: id + "-desc",
      ariaLabelledby: id + "-title " + id + "-desc", fragmentIds: [],
      elements: [{ id: id + "-line" }], domIds: [id, id + "-title", id + "-desc", id + "-line"]
    };
    return {
      manifest,
      html: `<svg id="${id}" role="img" aria-labelledby="${manifest.ariaLabelledby}"><title id="${manifest.titleId}">${title}</title><desc id="${manifest.descriptionId}">Beskrivning</desc><line id="${id}-line"></line></svg>`
    };
  }
  const figures = [fixture("diagram-a", "Första"), fixture("diagram-b", "Andra")];
  const manifests = figures.map((figure) => figure.manifest);
  const validated = [];

  harness.subjectData.subject.questionCount = 2;
  harness.subjectData.subject.maxPoints = 2;
  harness.subjectData.slots[1][0].promptHtml = figures[0].html;
  harness.subjectData.slots[1][0].sourceData = { diagram: manifests[0] };
  harness.subjectData.slots[2] = [{
    id: "q2", slot: 2, title: "Andra", points: 1,
    promptHtml: figures[1].html, solutionHtml: "<p>Lösning</p>",
    fields: [{ id: "b", label: "Svar", kind: "aliases", points: 1, expected: "ja" }],
    sourceData: { diagram: manifests[1] }, rubric: []
  }];
  harness.window.KS.diagram = { validateManifest(manifest) { validated.push(manifest.id); } };

  assert.deepEqual(app.mount(harness.root, harness.subjectData), { ok: true });
  assert.deepEqual(validated, ["diagram-a", "diagram-b"]);
  assert.equal(harness.nodes["session-state"].textContent, "Pågående prov");
});

test("diagram preflight rejects empty, unrelated, malformed and multi-root SVG markup before mutations", () => {
  const app = require("../assets/js/app.js");
  const id = "strict-preflight-diagram";
  const manifest = {
    id, title: "Korrekt titel", description: "Korrekt beskrivning", titleId: id + "-title", descriptionId: id + "-desc",
    ariaLabelledby: id + "-title " + id + "-desc", fragmentIds: [id + "-marker"],
    elements: [{ id: id + "-line" }],
    domIds: [id, id + "-title", id + "-desc", id + "-marker", id + "-marker-path", id + "-line"]
  };
  const valid = `<svg id="${id}" role="img" aria-labelledby="${manifest.ariaLabelledby}"><title id="${manifest.titleId}">${manifest.title}</title><desc id="${manifest.descriptionId}">${manifest.description}</desc><defs><marker id="${id}-marker"><path id="${id}-marker-path"></path></marker></defs><line id="${id}-line"></line></svg>`;
  const invalidMarkup = [
    ["empty SVG", `<svg id="${id}"></svg>`],
    ["unrelated SVG", `<svg id="${id}" role="img" aria-labelledby="${manifest.ariaLabelledby}"><title id="${manifest.titleId}">${manifest.title}</title><desc id="${manifest.descriptionId}">${manifest.description}</desc><circle id="unrelated"></circle></svg>`],
    ["multiple roots", valid + `<svg id="extra-root"></svg>`],
    ["wrong role", valid.replace('role="img"', 'role="presentation"')],
    ["wrong aria-labelledby", valid.replace(manifest.ariaLabelledby, manifest.titleId)],
    ["wrong title ID", valid.replace(`id="${manifest.titleId}"`, `id="wrong-title"`)],
    ["wrong description ID", valid.replace(`id="${manifest.descriptionId}"`, `id="wrong-desc"`)],
    ["missing element ID", valid.replace(`<line id="${id}-line"></line>`, "")],
    ["missing fragment ID", valid.replace(` id="${id}-marker"`, "")],
    ["extra DOM ID", valid.replace("</svg>", '<circle id="unexpected"></circle></svg>')]
  ];

  invalidMarkup.forEach(([name, html]) => {
    const harness = recoveryHarness(null);
    const activeKey = "ks-practice:v1:recovery-test:active";
    const historyKey = "ks-practice:v1:recovery-test:history";
    const activeBytes = '{"sentinel":"active"}';
    const historyBytes = '[{"sentinel":"history"}]';
    let createCalls = 0;
    let restoreCalls = 0;
    let randomCalls = 0;
    harness.values.set(activeKey, activeBytes);
    harness.values.set(historyKey, historyBytes);
    harness.subjectData.slots[1][0].promptHtml = html;
    harness.subjectData.slots[1][0].sourceData = { diagram: manifest };
    harness.window.KS.diagram = { validateManifest() {} };
    harness.window.KS.exam = Object.assign({}, harness.window.KS.exam, {
      createSession() { createCalls += 1; throw new Error("must not create"); },
      restoreSession() { restoreCalls += 1; throw new Error("must not restore"); }
    });
    const originalRandom = Math.random;
    Math.random = function () { randomCalls += 1; throw new Error("must not randomize"); };
    let result;
    try {
      result = app.mount(harness.root, harness.subjectData);
    } finally {
      Math.random = originalRandom;
    }
    assert.deepEqual(result, { ok: false, reason: "diagram-preflight-failed" }, name);
    assert.equal(createCalls, 0, name);
    assert.equal(restoreCalls, 0, name);
    assert.equal(randomCalls, 0, name);
    assert.equal(harness.values.get(activeKey), activeBytes, name);
    assert.equal(harness.values.get(historyKey), historyBytes, name);
  });
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
  assert.doesNotMatch(source, /session\.setSelfGrade\(/);
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
