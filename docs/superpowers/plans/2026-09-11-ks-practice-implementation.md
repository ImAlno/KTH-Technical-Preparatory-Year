# Interaktiva KS övningsprov Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg tre helt lokala och interaktiva KS övningssidor med fler än 100 nyskrivna uppgifter per ämne, robust hybridrättning, repetitionsskydd och fullständiga lösningar.

**Architecture:** En beroendefri provmotor exponeras som små UMD-liknande moduler under det globala namnrymden `window.KS` i webbläsaren och via `module.exports` i Node-tester. Varje ämne registrerar fokuserade frågefiler per provposition och ett tunt ämneskontrakt i `window.KS_SUBJECT_DATA`. Allt tillstånd lagras lokalt och alla sidor fungerar via `file://`.

**Tech Stack:** Semantisk HTML5, CSS, klassisk JavaScript utan externa paket, Node `node:test`, SVG och Poppler för extraktion av kemins originalformelblad.

**Spec:** `docs/superpowers/specs/2026-09-11-ks-practice-design.md`

## Global Constraints

- Alla slutliga filer ska ligga under `KS Förberedelse`; underlagsfilerna får inte ändras.
- Sidorna ska fungera utan server, byggsteg, konto, internet eller CDN.
- Gamla KS används endast som analysunderlag; inga uppgiftstexter eller sifferuppsättningar får kopieras.
- Matematik ska ha minst 125 unika huvuduppgifter, fysik minst 125 och kemi minst 120.
- Ett genererat prov ska alltid ha 5 frågor och 10 poäng i matematik, 5 frågor och 10 poäng i fysik samt 6 huvudfrågor och 20 poäng i kemi.
- Godkäntgränserna är 6 poäng i matematik och fysik samt 10 poäng i kemi.
- Timerförvalen är 105 minuter i matematik och fysik samt 120 minuter i kemi.
- Lösningar får endast visas efter rättning och efter en separat handling för den aktuella uppgiften.
- Vid osäker automatisk bedömning ska resultatet vara `self`, aldrig ett falskt säkert `incorrect`.
- Kemins visuella formelblad ska vara den oförändrade sidan från `KS_VT26_260305_med_lösn.pdf`.
- Gränssnittet ska vara minimalistiskt: systemtypsnitt, vit huvudyta, ljusgrå bakgrund, tunna avdelare och funktionell accentfärg.

---

## Locked File Map

```text
KS Förberedelse/
├── index.html                         # Ämnesnav
├── assets/
│   ├── app.css                        # Gemensam minimalistisk layout och utskrift
│   └── js/
│       ├── subject-config.js          # Fasta ämnes- och provvärden
│       ├── grading.js                 # Numerisk, alias- och sammansatt rättning
│       ├── units.js                   # Normalisering och dimensionssäker konvertering
│       ├── expression-parser.js       # Säker algebraisk parser och ekvivalens
│       ├── chemistry-parser.js        # Kemiska formler och reaktionsformler
│       ├── storage.js                 # Versionsstyrd localStorage-adapter
│       ├── timer.js                   # Ren timerlogik
│       ├── exam-engine.js             # Urval, session, poäng och lösningsspärr
│       └── app.js                     # DOM-rendering och händelser
├── Matematik KS2/
│   ├── index.html
│   ├── questions.js                   # Samlar positionerna till ämnesdata
│   └── questions/slot-1.js … slot-5.js
├── Fysik KS1/
│   ├── index.html
│   ├── questions.js
│   └── questions/slot-1.js … slot-5.js
├── Kemi KS/
│   ├── index.html
│   ├── questions.js
│   ├── questions/slot-1.js … slot-6.js
│   └── assets/formelblad-ks.png
└── tests/
    ├── subject-config.test.js
    ├── grading.test.js
    ├── units.test.js
    ├── expression-parser.test.js
    ├── chemistry-parser.test.js
    ├── storage.test.js
    ├── timer.test.js
    ├── exam-engine.test.js
    ├── math-questions.test.js
    ├── physics-questions.test.js
    ├── chemistry-questions.test.js
    └── static-pages.test.js
```

### Shared data contracts

```js
// Question
{
  id: "math-s1-radical-01",
  slot: 1,
  title: "Rotekvation",
  points: 2,
  promptHtml: "...",
  skills: ["rotekvation", "definitionsmängd"],
  fields: [{
    id: "roots",
    label: "Svar",
    kind: "solution-set",
    points: 2,
    expected: [1, 6],
    targetUnit: null,
    unitEmbedded: false,
    tolerance: null,
    aliases: []
  }],
  solutionHtml: "<ol>...</ol>",
  rubric: [{ points: 1, text: "..." }],
  figureSvg: null
}

// GradeResult
{
  status: "correct" | "partial" | "incorrect" | "self",
  earned: 0,
  possible: 2,
  interpreted: "x ∈ {1, 6}",
  message: "Rätt svar"
}

// ExamSession snapshot
{
  schemaVersion: 1,
  subjectId: "math-ks2",
  examId: "crypto-random-id",
  questionIds: ["..."],
  currentIndex: 0,
  answers: { "question-id": { "field-id": "raw answer" } },
  flags: ["question-id"],
  status: "active" | "graded",
  grades: { "question-id": GradeResult },
  expandedSolutions: ["question-id"],
  timer: { durationMs: 6300000, elapsedMs: 0, runningSince: null }
}
```

---

### Task 1: Ämneskontrakt och statiskt ämnesnav

**Files:**
- Create: `KS Förberedelse/assets/js/subject-config.js`
- Create: `KS Förberedelse/tests/subject-config.test.js`
- Create: `KS Förberedelse/index.html`

**Interfaces:**
- Produces: `subjectConfig.SUBJECTS`, `subjectConfig.validateSubjectConfig(config)`
- Produces: ämnes-ID:n `math-ks2`, `physics-ks1`, `chemistry-ks`

- [ ] **Step 1: Write the failing config test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../assets/js/subject-config.js");

test("all subject configs match the real KS limits", () => {
  assert.deepEqual(
    Object.values(config.SUBJECTS).map(({ id, questionCount, maxPoints, passPoints, durationMinutes }) =>
      ({ id, questionCount, maxPoints, passPoints, durationMinutes })),
    [
      { id: "math-ks2", questionCount: 5, maxPoints: 10, passPoints: 6, durationMinutes: 105 },
      { id: "physics-ks1", questionCount: 5, maxPoints: 10, passPoints: 6, durationMinutes: 105 },
      { id: "chemistry-ks", questionCount: 6, maxPoints: 20, passPoints: 10, durationMinutes: 120 }
    ]
  );
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node --test "KS Förberedelse/tests/subject-config.test.js"`

Expected: FAIL with `Cannot find module '../assets/js/subject-config.js'`.

- [ ] **Step 3: Implement the browser and Node compatible config module**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.subjectConfig = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const SUBJECTS = Object.freeze({
    math: Object.freeze({ id: "math-ks2", name: "Matematik KS2", questionCount: 5, maxPoints: 10, passPoints: 6, durationMinutes: 105 }),
    physics: Object.freeze({ id: "physics-ks1", name: "Fysik KS1", questionCount: 5, maxPoints: 10, passPoints: 6, durationMinutes: 105 }),
    chemistry: Object.freeze({ id: "chemistry-ks", name: "Kemi KS", questionCount: 6, maxPoints: 20, passPoints: 10, durationMinutes: 120 })
  });
  function validateSubjectConfig(value) {
    return Boolean(value && value.id && value.questionCount > 0 && value.maxPoints >= value.passPoints && value.durationMinutes > 0);
  }
  return { SUBJECTS, validateSubjectConfig };
});
```

Create a semantic `index.html` with one `<main>`, a concise heading, three plain subject links, each subject's question count and duration, and no decorative dashboard metrics.

- [ ] **Step 4: Run the config test**

Run: `node --test "KS Förberedelse/tests/subject-config.test.js"`

Expected: PASS.

- [ ] **Step 5: Open the hub through `file://` and verify all three links resolve**

Expected: no console errors; links target `Matematik KS2/index.html`, `Fysik KS1/index.html`, and `Kemi KS/index.html`.

- [ ] **Step 6: Commit**

```bash
git add "KS Förberedelse/index.html" "KS Förberedelse/assets/js/subject-config.js" "KS Förberedelse/tests/subject-config.test.js"
git commit -m "feat: add KS subject configuration and hub"
```

---

### Task 2: Numeriska svar och dimensionssäkra enheter

**Files:**
- Create: `KS Förberedelse/assets/js/units.js`
- Create: `KS Förberedelse/assets/js/grading.js`
- Create: `KS Förberedelse/tests/units.test.js`
- Create: `KS Förberedelse/tests/grading.test.js`

**Interfaces:**
- Produces: `units.normalizeUnit(raw)`, `units.convert(value, fromUnit, toUnit)`
- Produces: `grading.parseNumeric(raw)`, `grading.gradeNumeric(spec, raw)`, `grading.gradeAliases(spec, raw)`
- `gradeNumeric` returns `GradeResult` and never throws for user input.

- [ ] **Step 1: Write failing tests for Swedish numbers, notation and units**

```js
test("parses decimal comma and scientific notation", () => {
  assert.equal(grading.parseNumeric("1,25").value, 1.25);
  assert.equal(grading.parseNumeric("1,2·10^3").value, 1200);
  assert.equal(grading.parseNumeric("1.2e3").value, 1200);
});

test("converts only compatible units", () => {
  assert.equal(units.convert(36, "km/h", "m/s").value, 10);
  assert.equal(units.convert(250, "cm3", "dm3").value, 0.25);
  assert.equal(units.convert(1, "N", "kg").ok, false);
});

test("accepts a value inside the field tolerance", () => {
  const result = grading.gradeNumeric({ expected: 9.82, points: 2, tolerance: { absolute: 0.01 }, targetUnit: "m/s2" }, "9,82");
  assert.equal(result.status, "correct");
  assert.equal(result.earned, 2);
});
```

- [ ] **Step 2: Run both test files and verify they fail**

Run: `node --test "KS Förberedelse/tests/units.test.js" "KS Förberedelse/tests/grading.test.js"`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the exact unit registry**

Implement aliases and SI factors for:

```js
const UNIT_DEFINITIONS = {
  "kg": { dimension: "mass", factor: 1, aliases: ["kg"] },
  "g": { dimension: "mass", factor: 1e-3, aliases: ["g", "gram"] },
  "mg": { dimension: "mass", factor: 1e-6, aliases: ["mg"] },
  "m": { dimension: "length", factor: 1, aliases: ["m", "meter"] },
  "cm": { dimension: "length", factor: 1e-2, aliases: ["cm"] },
  "mm": { dimension: "length", factor: 1e-3, aliases: ["mm"] },
  "km": { dimension: "length", factor: 1e3, aliases: ["km"] },
  "s": { dimension: "time", factor: 1, aliases: ["s", "sek", "sekund", "sekunder"] },
  "min": { dimension: "time", factor: 60, aliases: ["min", "minut", "minuter"] },
  "h": { dimension: "time", factor: 3600, aliases: ["h", "timme", "timmar"] },
  "m/s": { dimension: "speed", factor: 1, aliases: ["m/s", "ms-1", "m s-1"] },
  "km/h": { dimension: "speed", factor: 1 / 3.6, aliases: ["km/h", "kmh"] },
  "m/s2": { dimension: "acceleration", factor: 1, aliases: ["m/s2", "m/s^2", "m/s²", "ms-2"] },
  "N": { dimension: "force", factor: 1, aliases: ["N", "newton"] },
  "kN": { dimension: "force", factor: 1000, aliases: ["kN"] },
  "Pa": { dimension: "pressure", factor: 1, aliases: ["Pa"] },
  "kPa": { dimension: "pressure", factor: 1000, aliases: ["kPa"] },
  "m3": { dimension: "volume", factor: 1, aliases: ["m3", "m^3", "m³"] },
  "dm3": { dimension: "volume", factor: 1e-3, aliases: ["dm3", "dm^3", "dm³", "L", "liter"] },
  "cm3": { dimension: "volume", factor: 1e-6, aliases: ["cm3", "cm^3", "cm³", "mL", "ml"] },
  "kg/m3": { dimension: "density", factor: 1, aliases: ["kg/m3", "kg/m^3", "kg/m³"] },
  "g/cm3": { dimension: "density", factor: 1000, aliases: ["g/cm3", "g/cm^3", "g/cm³"] },
  "mol": { dimension: "amount", factor: 1, aliases: ["mol"] },
  "mol/dm3": { dimension: "concentration", factor: 1000, aliases: ["mol/dm3", "mol/dm^3", "mol/dm³", "M"] },
  "%": { dimension: "percent", factor: 1, aliases: ["%", "procent"] }
};
```

Normalize Unicode minus, multiplication signs, superscripts and whitespace before lookup. `convert` must return `{ ok: false, reason: "incompatible-dimension" }` for incompatible dimensions.

- [ ] **Step 4: Implement numeric parsing and grading**

Parse optional target units separately from the numeric token. Support `e` notation and `·10^n`/`*10^n`. Use `Math.max(absoluteTolerance, Math.abs(expected) * relativeTolerance)` when both tolerances are present. Return `self` with a Swedish explanation for ambiguous input rather than throwing.

- [ ] **Step 5: Run the unit and grading tests**

Run: `node --test "KS Förberedelse/tests/units.test.js" "KS Förberedelse/tests/grading.test.js"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "KS Förberedelse/assets/js/units.js" "KS Förberedelse/assets/js/grading.js" "KS Förberedelse/tests/units.test.js" "KS Förberedelse/tests/grading.test.js"
git commit -m "feat: grade numeric answers and units"
```

---

### Task 3: Algebraisk parser och ekvivalens

**Files:**
- Create: `KS Förberedelse/assets/js/expression-parser.js`
- Create: `KS Förberedelse/tests/expression-parser.test.js`
- Modify: `KS Förberedelse/assets/js/grading.js`
- Modify: `KS Förberedelse/tests/grading.test.js`

**Interfaces:**
- Produces: `expression.tokenize(raw)`, `expression.parse(raw)`, `expression.evaluate(ast, variables)`
- Produces: `expression.parseSolutionSet(raw, variableName)`
- Produces: `expression.equivalent(left, right, options)`
- Adds: `grading.gradeSolutionSet(spec, raw)`, `grading.gradeExpression(spec, raw)`

- [ ] **Step 1: Write failing algebra tests**

```js
test("solution sets ignore order and Swedish separators", () => {
  assert.deepEqual(expression.parseSolutionSet("x=6 eller x=1", "x").values, [1, 6]);
  assert.deepEqual(expression.parseSolutionSet("1; 6", "x").values, [1, 6]);
});

test("equivalent forms compare mathematically", () => {
  assert.equal(expression.equivalent("(x-1)*(x+2)", "x^2+x-2", { variables: ["x"] }).equivalent, true);
  assert.equal(expression.equivalent("(a+1)/((a-1)*(a+1))", "1/(a-1)", { variables: ["a"], exclude: [-1, 1] }).equivalent, true);
});

test("unknown syntax falls back to self assessment", () => {
  assert.equal(grading.gradeExpression({ expected: "x+1", points: 2 }, "x plus ett").status, "self");
});
```

- [ ] **Step 2: Run tests and verify the failure**

Run: `node --test "KS Förberedelse/tests/expression-parser.test.js" "KS Förberedelse/tests/grading.test.js"`

Expected: FAIL because the expression module and graders do not exist.

- [ ] **Step 3: Implement a restricted Pratt parser without `eval`**

Support numbers with decimal comma or point, identifiers, parentheses, unary plus/minus, `+ - * / ^`, `sqrt(...)`, `√(...)`, and implicit multiplication between adjacent factors such as `2x` and `(x-1)(x+2)`. Reject assignments, property access, brackets, strings and unknown function names.

Use this precedence: unary signs, exponentiation (right associative), multiplication/division, addition/subtraction. Evaluation returns `{ ok: false }` for division by zero, non-real square roots or non-finite values.

- [ ] **Step 4: Implement deterministic expression comparison**

Normalize both ASTs for commutative term ordering and constant folding. If normalized trees differ, evaluate at `[-11, -7, -3, -1, 0, 2, 5, 9, 13]` for each variable, skipping explicit exclusions and invalid points. Require at least seven matching valid evaluations within `1e-9 * max(1, |expected|)`; otherwise return `{ equivalent: null, reason: "insufficient-confidence" }`.

- [ ] **Step 5: Implement solution-set and expression graders**

Sort finite roots, merge values within the question tolerance and compare cardinality before values. Accept `ingen lösning`, `saknar reella lösningar`, and `∅` only when the expected set is empty. Convert all parser uncertainty to `GradeResult.status = "self"`.

- [ ] **Step 6: Run parser and grading tests**

Run: `node --test "KS Förberedelse/tests/expression-parser.test.js" "KS Förberedelse/tests/grading.test.js"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "KS Förberedelse/assets/js/expression-parser.js" "KS Förberedelse/assets/js/grading.js" "KS Förberedelse/tests/expression-parser.test.js" "KS Förberedelse/tests/grading.test.js"
git commit -m "feat: compare equivalent algebra answers"
```

---

### Task 4: Kemiska formler och reaktionsformler

**Files:**
- Create: `KS Förberedelse/assets/js/chemistry-parser.js`
- Create: `KS Förberedelse/tests/chemistry-parser.test.js`
- Modify: `KS Förberedelse/assets/js/grading.js`
- Modify: `KS Förberedelse/tests/grading.test.js`

**Interfaces:**
- Produces: `chemistry.normalizeFormula(raw)`, `chemistry.parseFormula(raw)`
- Produces: `chemistry.parseEquation(raw)`, `chemistry.equivalentEquations(left, right, options)`
- Adds: `grading.gradeChemicalFormula(spec, raw)`, `grading.gradeChemicalEquation(spec, raw)`

- [ ] **Step 1: Write failing chemistry tests**

```js
test("normalizes ordinary and subscript digits", () => {
  assert.equal(chemistry.normalizeFormula("H₂SO₄"), chemistry.normalizeFormula("H2SO4"));
  assert.notEqual(chemistry.normalizeFormula("CO"), chemistry.normalizeFormula("Co"));
});

test("reaction order and common coefficient scale do not matter", () => {
  const expected = "2 H2(g) + O2(g) -> 2 H2O(l)";
  assert.equal(chemistry.equivalentEquations("O2(g)+2H2(g)→2H2O(l)", expected, { requireStates: true }).equivalent, true);
  assert.equal(chemistry.equivalentEquations("4H2(g)+2O2(g)→4H2O(l)", expected, { requireStates: true }).equivalent, true);
});

test("required aggregation states are graded", () => {
  const result = grading.gradeChemicalEquation({ expected: "Ag+(aq)+Cl-(aq)->AgCl(s)", points: 2, requireStates: true }, "Ag+ + Cl- -> AgCl");
  assert.equal(result.status, "partial");
});
```

- [ ] **Step 2: Run tests and verify the missing module failure**

Run: `node --test "KS Förberedelse/tests/chemistry-parser.test.js" "KS Förberedelse/tests/grading.test.js"`

Expected: FAIL.

- [ ] **Step 3: Implement formula tokenization**

Normalize Unicode subscripts/superscripts, hydrate dots, charge forms (`SO4^2-`, `SO₄²⁻`) and state labels (`(s)`, `(l)`, `(g)`, `(aq)`). Parse element symbols case-sensitively, nested parentheses, integer subscripts, hydrate components and net charge. Return a canonical formula containing sorted element counts, charge, hydrate groups and optional state.

- [ ] **Step 4: Implement equation canonicalization**

Split on `->`, `→`, `=`, or `⇌`; keep reactant/product sides distinct. Parse coefficients as positive integers. Sort species by canonical formula and divide all coefficients by their greatest common divisor. Compare state labels only when `requireStates` is true. A missing requested state returns `partial`; unparseable input returns `self`.

- [ ] **Step 5: Connect chemistry graders and run tests**

Run: `node --test "KS Förberedelse/tests/chemistry-parser.test.js" "KS Förberedelse/tests/grading.test.js"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "KS Förberedelse/assets/js/chemistry-parser.js" "KS Förberedelse/assets/js/grading.js" "KS Förberedelse/tests/chemistry-parser.test.js" "KS Förberedelse/tests/grading.test.js"
git commit -m "feat: grade chemical notation"
```

---

### Task 5: Lagring, timer och repetitionsskydd

**Files:**
- Create: `KS Förberedelse/assets/js/storage.js`
- Create: `KS Förberedelse/assets/js/timer.js`
- Create: `KS Förberedelse/assets/js/exam-engine.js`
- Create: `KS Förberedelse/tests/storage.test.js`
- Create: `KS Förberedelse/tests/timer.test.js`
- Create: `KS Förberedelse/tests/exam-engine.test.js`

**Interfaces:**
- Produces: `storage.createStore(adapter, namespace)`, `store.loadActive()`, `store.saveActive(snapshot)`, `store.loadHistory()`, `store.saveHistory(history)`, `store.clearHistory()`
- Produces: `timer.create(durationMs)`, `timer.start(state, now)`, `timer.pause(state, now)`, `timer.reset(state)`, `timer.remaining(state, now)`
- Produces: `exam.createSession(subject, slots, store, rng)`, `exam.restoreSession(snapshot, questionIndex)`
- Produces session methods: `navigate(index)`, `setAnswer(questionId, fieldId, raw)`, `toggleFlag(questionId)`, `submit()`, `setSelfGrade(questionId, earned)`, `overrideGrade(questionId, earned)`, `toggleSolution(questionId)`

- [ ] **Step 1: Write failing pure tests for timer and storage migration**

```js
test("timer survives time passing while the page is closed", () => {
  let state = timer.start(timer.create(60_000), 1_000);
  assert.equal(timer.remaining(state, 21_000), 40_000);
  state = timer.pause(state, 21_000);
  assert.equal(timer.remaining(state, 99_000), 40_000);
});

test("store isolates each subject namespace", () => {
  const adapter = memoryStorage();
  storage.createStore(adapter, "math-ks2").saveHistory({ used: ["m1"] });
  assert.deepEqual(storage.createStore(adapter, "physics-ks1").loadHistory(), { schemaVersion: 1, slots: {} });
});
```

- [ ] **Step 2: Write failing engine tests for shuffle bags and navigation**

```js
test("a slot is exhausted before a question repeats", () => {
  const ids = Array.from({ length: 25 }, (_, index) => `q-${index}`);
  const bag = exam.createShuffleBag(ids, { queue: [], lastId: null }, seededRng(7));
  const firstCycle = Array.from({ length: 25 }, () => bag.take());
  assert.equal(new Set(firstCycle).size, 25);
  assert.notEqual(bag.take(), firstCycle.at(-1));
});

test("navigation never requires an answer", () => {
  const session = makeSession();
  session.navigate(4);
  assert.equal(session.snapshot().currentIndex, 4);
  assert.deepEqual(session.snapshot().answers, {});
});
```

- [ ] **Step 3: Run the tests and verify the failures**

Run: `node --test "KS Förberedelse/tests/storage.test.js" "KS Förberedelse/tests/timer.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected: FAIL because the modules are missing.

- [ ] **Step 4: Implement versioned storage with an in-memory fallback**

Use keys `ks-practice:v1:<subject-id>:active` and `ks-practice:v1:<subject-id>:history`. Wrap every adapter operation in `try/catch`. On failure, preserve the current session in a module-local memory adapter and expose `store.persistenceAvailable === false` plus a Swedish warning string.

- [ ] **Step 5: Implement immutable timer transitions**

Each timer function returns a new plain object. `remaining` clamps to `[0, durationMs]`. Starting an already running timer and pausing a paused timer are idempotent. Reset preserves duration and clears elapsed time.

- [ ] **Step 6: Implement per-slot shuffle bags and the session API**

Fisher-Yates shuffle each slot using injected `rng`. Persist remaining queues and `lastId` per slot immediately after selection. Validate question count, unique IDs and total points before returning a session. Autosave after every mutating session method. `toggleSolution` must reject active sessions with `{ ok: false, reason: "not-graded" }`.

- [ ] **Step 7: Implement submission and manual grading state**

`submit()` calls the field grader, sums automatic fields, leaves manual fields as `self`, and locks raw answers. `setSelfGrade` accepts only integer or half-point values from zero through the question maximum. Overall status is `preliminary` while any result is `self` and becomes `complete` afterward.

- [ ] **Step 8: Run all three test files**

Run: `node --test "KS Förberedelse/tests/storage.test.js" "KS Förberedelse/tests/timer.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "KS Förberedelse/assets/js/storage.js" "KS Förberedelse/assets/js/timer.js" "KS Förberedelse/assets/js/exam-engine.js" "KS Förberedelse/tests/storage.test.js" "KS Förberedelse/tests/timer.test.js" "KS Förberedelse/tests/exam-engine.test.js"
git commit -m "feat: add persistent KS exam sessions"
```

---

### Task 6: Minimalistiskt provgränssnitt

**Files:**
- Create: `KS Förberedelse/assets/app.css`
- Create: `KS Förberedelse/assets/js/app.js`
- Create: `KS Förberedelse/Matematik KS2/index.html`
- Create: `KS Förberedelse/Fysik KS1/index.html`
- Create: `KS Förberedelse/Kemi KS/index.html`
- Create: `KS Förberedelse/tests/static-pages.test.js`

**Interfaces:**
- Consumes: `window.KS_SUBJECT_DATA`, `KS.exam`, `KS.storage`, `KS.timer`, `KS.grading`
- Produces: `app.mount(root, subjectData)`, `app.questionStatus(snapshot, questionId)`, `app.canShowSolution(snapshot, questionId)`

- [ ] **Step 1: Write failing static and view-model tests**

```js
test("all subject pages load local scripts only", () => {
  for (const file of SUBJECT_PAGES) {
    const html = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(html, /https?:\/\//);
    assert.match(html, /<main id="exam-app"/);
  }
});

test("solutions stay hidden until grading and an explicit expansion", () => {
  assert.equal(app.canShowSolution({ status: "active", expandedSolutions: ["q1"] }, "q1"), false);
  assert.equal(app.canShowSolution({ status: "graded", expandedSolutions: [] }, "q1"), false);
  assert.equal(app.canShowSolution({ status: "graded", expandedSolutions: ["q1"] }, "q1"), true);
});
```

- [ ] **Step 2: Run the tests and verify the missing page/module failure**

Run: `node --test "KS Förberedelse/tests/static-pages.test.js"`

Expected: FAIL.

- [ ] **Step 3: Build the shared semantic HTML shell**

Each subject page loads shared scripts in dependency order, then its slot files, `questions.js`, and `app.js`. The body contains a slim `<header>`, `<nav aria-label="Uppgifter">`, `<main id="exam-app">`, one polite live region, and native dialogs for submission warning, history reset and formula-sheet viewing.

- [ ] **Step 4: Implement the approved visual system**

Use these tokens and no decorative substitutes:

```css
:root {
  --text: #1d1d1f;
  --secondary: #6e6e73;
  --line: #d2d2d7;
  --surface: #ffffff;
  --background: #f5f5f7;
  --accent: #0071e3;
  --success: #168447;
  --danger: #b42318;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
}
```

The desktop grid is `96px minmax(0, 760px)` centered in the available width. At `680px` and narrower, move question numbers into a horizontal row. Do not add a logo tile, colored top bar, gradients, notebook lines, decorative cards or large shadows. Primary actions may use a blue rounded rectangle; secondary actions remain text or neutral outlines.

- [ ] **Step 5: Implement free navigation and autosave**

Render every question number as a native button with Swedish accessible labels including state. `Föregående`, `Nästa`, and direct question buttons call `session.navigate` without validation. Input and textarea events call `session.setAnswer`. Show unanswered, started, answered and flagged states through text or shape as well as color.

- [ ] **Step 6: Implement grading, individual solutions and self-assessment**

Submission first shows the unanswered count. After grading, replace editable fields with their saved values, show interpreted answers and render `Visa lösning` per question. Manual rubrics use explicit point buttons and update the preliminary total. Keep all solution DOM absent, not merely visually hidden, while the exam is active.

- [ ] **Step 7: Implement timer controls and active-session recovery**

Timer is initially stopped. Provide `Starta`, `Pausa`, and `Återställ`. On page load, offer `Fortsätt provet` or `Starta nytt` when an active snapshot exists. `Starta nytt` requires explicit confirmation before replacing the snapshot.

- [ ] **Step 8: Add print rules**

At print time hide application navigation, status, timer, controls, answers, grades and solutions. Show all questions in order with stable page breaks and blank answer space. Add a separate print action for the chemistry formula sheet.

- [ ] **Step 9: Run tests and inspect the three empty-bank shells through `file://`**

Run: `node --test "KS Förberedelse/tests/static-pages.test.js"`

Expected: PASS; each page displays a clear `Frågebanken laddades inte` error until subject data is added, with no uncaught console error.

- [ ] **Step 10: Commit**

```bash
git add "KS Förberedelse/assets/app.css" "KS Förberedelse/assets/js/app.js" "KS Förberedelse/Matematik KS2/index.html" "KS Förberedelse/Fysik KS1/index.html" "KS Förberedelse/Kemi KS/index.html" "KS Förberedelse/tests/static-pages.test.js"
git commit -m "feat: add minimalist KS exam interface"
```

---

### Task 7: Matematik KS2 frågebank

**Files:**
- Create: `KS Förberedelse/Matematik KS2/questions/slot-1.js`
- Create: `KS Förberedelse/Matematik KS2/questions/slot-2.js`
- Create: `KS Förberedelse/Matematik KS2/questions/slot-3.js`
- Create: `KS Förberedelse/Matematik KS2/questions/slot-4.js`
- Create: `KS Förberedelse/Matematik KS2/questions/slot-5.js`
- Create: `KS Förberedelse/Matematik KS2/questions.js`
- Create: `KS Förberedelse/tests/math-questions.test.js`

**Interfaces:**
- Produces: five arrays of at least 25 `Question` objects, two points each
- Produces: `window.KS_SUBJECT_DATA = { config, slots }` for `math-ks2`

- [ ] **Step 1: Write failing bank-contract tests**

```js
test("math has 25 unique questions in every slot", () => {
  const slots = loadMathSlots();
  assert.deepEqual(Object.values(slots).map((slot) => slot.length), [25, 25, 25, 25, 25]);
  assert.equal(new Set(Object.values(slots).flat().map((question) => question.id)).size, 125);
  assert.ok(Object.values(slots).flat().every((question) => question.points === 2 && question.solutionHtml.length > 80));
});

test("every generated math answer satisfies its own problem invariant", () => {
  for (const question of allMathQuestions()) validateMathQuestion(question);
});
```

- [ ] **Step 2: Run the bank test and verify it fails**

Run: `node --test "KS Förberedelse/tests/math-questions.test.js"`

Expected: FAIL because the slot modules are missing.

- [ ] **Step 3: Implement slot 1 with 25 radical equations**

Use five authored families with five checked parameter rows each: `sqrt(x+b)=c-x`, `x+sqrt(ax+b)=c`, `k*sqrt(x+b)+x=c`, `sqrt(ax+b)-d=x`, and `sqrt(x+b)=kx+d`. Choose integer parameter tables that yield one or two real roots after squaring. Every solution must state the domain, show the squared equation and verify candidates in the original equation.

- [ ] **Step 4: Implement slot 2 with 25 absolute-value equations**

Use `|ax+b|=cx+d`, `|ax+b|=k`, `m|x-b|+c=d`, `|ax+b|=|cx+d|`, and contextual distance equations. Store expected root sets in ascending order and explain interval conditions or formal verification.

- [ ] **Step 5: Implement slot 3 with 25 rational simplifications**

Cover factor cancellation, conjugate-style factorizations, complex fractions, sums with unlike denominators, and expressions requiring both factorization and sign handling. Store `kind: "expression"`, expected simplified form and original domain exclusions.

- [ ] **Step 6: Implement slot 4 with 25 rational or polynomial equations**

Use rational equations with one or two excluded values, biquadratic equations, factorable cubics, quadratic substitutions and polynomial factorization. Ensure each question requires a general method and that roots at excluded values are rejected in the solution.

- [ ] **Step 7: Implement slot 5 with 25 geometry problems and SVG figures**

Create five variants each for right-triangle trigonometry, non-right triangle area, parallel transversals, composite quadrilaterals, and symmetric constructions. Generate figures from the data, not measured scale. Each prompt states the target unit and rounding. Each solution defines the geometric relation before calculating.

- [ ] **Step 8: Assemble subject data and run exhaustive tests**

`questions.js` verifies all five browser slot arrays exist and assigns the math config plus slots to `window.KS_SUBJECT_DATA`. The Node test substitutes every expected root into the original equation, samples expression equivalence, and recomputes geometry answers from source parameters.

Run: `node --test "KS Förberedelse/tests/math-questions.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected: PASS with 125 unique IDs and 10 points in 1,000 generated math exams.

- [ ] **Step 9: Manually review all question texts against the six source KS documents**

Expected: objectives and difficulty align; no sentence, scenario or number set duplicates a source question.

- [ ] **Step 10: Commit**

```bash
git add "KS Förberedelse/Matematik KS2" "KS Förberedelse/tests/math-questions.test.js"
git commit -m "feat: add Matematik KS2 question bank"
```

---

### Task 8: Fysik KS1 frågebank

**Files:**
- Create: `KS Förberedelse/Fysik KS1/questions/slot-1.js`
- Create: `KS Förberedelse/Fysik KS1/questions/slot-2.js`
- Create: `KS Förberedelse/Fysik KS1/questions/slot-3.js`
- Create: `KS Förberedelse/Fysik KS1/questions/slot-4.js`
- Create: `KS Förberedelse/Fysik KS1/questions/slot-5.js`
- Create: `KS Förberedelse/Fysik KS1/questions.js`
- Create: `KS Förberedelse/tests/physics-questions.test.js`

**Interfaces:**
- Produces: five arrays of at least 25 `Question` objects, two points each
- Produces: `window.KS_SUBJECT_DATA = { config, slots }` for `physics-ks1`

- [ ] **Step 1: Write failing bank and dimensional tests**

```js
test("physics has 125 unique two-point questions", () => {
  const questions = allPhysicsQuestions();
  assert.equal(questions.length, 125);
  assert.equal(new Set(questions.map((question) => question.id)).size, 125);
  assert.ok(questions.every((question) => question.points === 2 && question.fields.every((field) => field.targetUnit || field.kind === "self")));
});

test("physics values remain realistic", () => {
  for (const question of allPhysicsQuestions()) assertPhysicsRanges(question.sourceData);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js"`

Expected: FAIL.

- [ ] **Step 3: Implement slot 1 with graph interpretation and contact equilibrium**

Create 10 piecewise-linear `s-t`/`v-t` graph questions and 15 contact-force equilibrium questions. Graph SVGs expose exact axis scales and ask for slope, area, average speed or acceleration. Contact questions require a force diagram self-check plus one numeric final value.

- [ ] **Step 4: Implement slot 2 with density and geometric bodies**

Create five variants each using cylinders, cones, spheres, prisms and liquid columns. Rotate which quantity is unknown among mass, density, radius, height and volume. Store all source data in SI internally, show realistic mixed units, and specify the target unit in the prompt and field suffix.

- [ ] **Step 5: Implement slot 3 with vertical motion**

Cover launch from ground, launch from a height, finding initial speed from later velocity, impact speed, turning height and elapsed time. Use `g = 9.82 m/s²` consistently. Every solution defines the positive direction and signs before substituting.

- [ ] **Step 6: Implement slot 4 with vector equilibrium**

Create hanging masses, cables at angles, missing fourth force, supported beams and frictionless wall contact. Render force situations as precise SVGs. Require numeric component/resultant answers automatically and force diagrams through a manual rubric.

- [ ] **Step 7: Implement slot 5 with Newton's second law and friction**

Create horizontal pulls, inclined planes, two connected masses, known acceleration with unknown pull, and known terminal speed-time with unknown friction. Reject parameter sets that produce negative normal force, static contradictions or impossible motion direction.

- [ ] **Step 8: Assemble subject data and run exhaustive recomputation**

Tests independently recompute all numeric answers from `sourceData`, verify unit dimensions, require two to four significant figures, inspect all SVGs for accessible `<title>`/`<desc>`, and generate 1,000 exams with exact 10-point totals.

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected: PASS.

- [ ] **Step 9: Review against all six source physics KS documents**

Expected: coverage mirrors density, motion, equilibrium and dynamics without reusing source wording, objects plus values, or diagram geometry.

- [ ] **Step 10: Commit**

```bash
git add "KS Förberedelse/Fysik KS1" "KS Förberedelse/tests/physics-questions.test.js"
git commit -m "feat: add Fysik KS1 question bank"
```

---

### Task 9: Kemi KS frågebank

**Files:**
- Create: `KS Förberedelse/Kemi KS/questions/slot-1.js`
- Create: `KS Förberedelse/Kemi KS/questions/slot-2.js`
- Create: `KS Förberedelse/Kemi KS/questions/slot-3.js`
- Create: `KS Förberedelse/Kemi KS/questions/slot-4.js`
- Create: `KS Förberedelse/Kemi KS/questions/slot-5.js`
- Create: `KS Förberedelse/Kemi KS/questions/slot-6.js`
- Create: `KS Förberedelse/Kemi KS/questions.js`
- Create: `KS Förberedelse/tests/chemistry-questions.test.js`

**Interfaces:**
- Produces: six arrays of at least 20 `Question` objects with fixed slot weights `[4, 7, 2, 2, 2, 3]`
- Produces: `window.KS_SUBJECT_DATA = { config, slots, formulaSheetUrl }` for `chemistry-ks`

- [ ] **Step 1: Write failing count, score and chemistry-invariant tests**

```js
test("chemistry has 20 questions in each weighted slot", () => {
  const slots = loadChemistrySlots();
  assert.deepEqual(Object.values(slots).map((slot) => slot.length), [20, 20, 20, 20, 20, 20]);
  assert.deepEqual(Object.values(slots).map((slot) => slot[0].points), [4, 7, 2, 2, 2, 3]);
  assert.equal(new Set(Object.values(slots).flat().map((question) => question.id)).size, 120);
});

test("all expected equations conserve atoms and charge", () => {
  for (const equation of expectedChemistryEquations()) assertBalanced(equation);
});
```

- [ ] **Step 2: Run the bank test and verify it fails**

Run: `node --test "KS Förberedelse/tests/chemistry-questions.test.js"`

Expected: FAIL.

- [ ] **Step 3: Implement slot 1, 20 four-point atomic-structure groups**

Each group has four one-point fields drawn from isotope comparison, terminology, Bohr electron distribution, valence electrons, ion notation and `n = cV`. Include a manual drawing rubric only when the group asks for a Bohr model; all other fields use aliases, formula parsing or numeric grading.

- [ ] **Step 4: Implement slot 2, 20 seven-point reaction groups**

Use fixed 2+3+2 point substructure: balanced hydrate/formation reaction, full stoichiometric mass calculation, and precipitation reaction with required states. Rotate calcium, magnesium, copper, iron, sodium and ammonium compounds while verifying molar masses from the same atomic-mass table used by the formula sheet.

- [ ] **Step 5: Implement slot 3, 20 two-point electron-formula and dipole groups**

Use one point for the electron formula or molecular geometry self-check and one point for a concise dipole/polarity explanation. Cover at least NH3, H2O, H2S, SO2, CO2, CH3Cl, CH2Cl2, BF3 and related curriculum-level molecules without repeating the source scenarios.

- [ ] **Step 6: Implement slot 4, 20 two-point bonding groups**

Each group presents four or five phase changes/reactions and awards partial points from a checklist. Cover metallic, ionic, hydrogen, dipole-dipole, dispersion and covalent intramolecular bonds. Keep `bryts vid smältning/förångning` distinct from bonds broken in chemical reactions.

- [ ] **Step 7: Implement slot 5, 20 two-point stoichiometry-plus-gas groups**

Every group uses a balanced reaction, mass or amount conversion, and `pV=nRT`. Store pressure in Pa and temperature in kelvin internally. Ask for a single final gas volume in `dm³` or `m³` with the requested unit fixed beside the field.

- [ ] **Step 8: Implement slot 6, 20 three-point composition groups**

Use a one-point empirical formula/formula-unit/concentration field and a two-point mass-percent, molar-mass or ion-concentration calculation. Include hydrate and molecular cases but avoid introducing acid-base, redox or organic nomenclature beyond the KS1 scope.

- [ ] **Step 9: Assemble subject data and run exhaustive chemistry validation**

Implement a local atomic-mass map matching the supplied sheet. Tests recompute molar masses, atom conservation, charge conservation, gas-law values, concentration factors and empirical formulas. Generate 1,000 exams and require six questions, 20 total points and all six skill groups.

Run: `node --test "KS Förberedelse/tests/chemistry-questions.test.js" "KS Förberedelse/tests/chemistry-parser.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected: PASS.

- [ ] **Step 10: Review against all five source chemistry KS documents**

Expected: questions test the same knowledge and response modes without copying wording, named scenarios, compound combinations plus values, or solution structure.

- [ ] **Step 11: Commit**

```bash
git add "KS Förberedelse/Kemi KS/questions.js" "KS Förberedelse/Kemi KS/questions" "KS Förberedelse/tests/chemistry-questions.test.js"
git commit -m "feat: add Kemi KS question bank"
```

---

### Task 10: Kemins exakta originalformelblad

**Files:**
- Create: `KS Förberedelse/Kemi KS/assets/formelblad-ks.png`
- Modify: `KS Förberedelse/Kemi KS/index.html`
- Modify: `KS Förberedelse/assets/js/app.js`
- Modify: `KS Förberedelse/assets/app.css`
- Modify: `KS Förberedelse/tests/static-pages.test.js`

**Interfaces:**
- Consumes: `window.KS_SUBJECT_DATA.formulaSheetUrl`
- Produces: fullskärmsdialog med zoom, panorering och separat utskrift

- [ ] **Step 1: Write a failing asset-fidelity test**

```js
test("chemistry page references the extracted local original sheet", () => {
  const html = fs.readFileSync(path.join(ROOT, "Kemi KS/index.html"), "utf8");
  assert.match(html, /assets\/formelblad-ks\.png/);
  const png = fs.readFileSync(path.join(ROOT, "Kemi KS/assets/formelblad-ks.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.ok(png.length > 250_000);
});
```

- [ ] **Step 2: Run the static test and verify the missing asset failure**

Run: `node --test "KS Förberedelse/tests/static-pages.test.js"`

Expected: FAIL because `formelblad-ks.png` does not exist.

- [ ] **Step 3: Extract page 4 without cropping or redrawing**

Run:

```bash
mkdir -p /private/tmp/ks-formelblad "KS Förberedelse/Kemi KS/assets"
pdftoppm -f 4 -l 4 -singlefile -r 300 -png "KS Förberedelse/Underlag/KS_VT26_260305_med_lösn.pdf" /private/tmp/ks-formelblad/formelblad-ks
cp /private/tmp/ks-formelblad/formelblad-ks.png "KS Förberedelse/Kemi KS/assets/formelblad-ks.png"
```

Do not crop, recolor, sharpen, OCR-replace or reconstruct any visible content.

- [ ] **Step 4: Implement the formula-sheet dialog**

Use a native `<dialog>` containing the original `<img>`, `Zooma in`, `Zooma ut`, `Anpassa`, `Skriv ut`, and `Stäng`. Keep the button available during active and graded chemistry exams. Constrain zoom to 50–300 percent and allow overflow panning inside the dialog. Provide an exact Swedish text transcription as visually hidden accessible content, not as a visual replacement.

- [ ] **Step 5: Compare the PNG and source page visually**

Render source page 4 separately at 300 DPI and inspect both at original resolution. Expected: identical visible page bounds, typography, periodic table, constants and electrochemical series; no clipping or resampling artifact.

- [ ] **Step 6: Run static tests**

Run: `node --test "KS Förberedelse/tests/static-pages.test.js"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "KS Förberedelse/Kemi KS/assets/formelblad-ks.png" "KS Förberedelse/Kemi KS/index.html" "KS Förberedelse/assets/js/app.js" "KS Förberedelse/assets/app.css" "KS Förberedelse/tests/static-pages.test.js"
git commit -m "feat: add exact Kemi KS formula sheet"
```

---

### Task 11: Full integration, accessibility and visual verification

**Files:**
- Modify: any file under `KS Förberedelse` only when a failing integration check identifies a defect
- Modify: `KS Förberedelse/tests/static-pages.test.js`
- Create: `KS Förberedelse/README.md`

**Interfaces:**
- Consumes: every interface from Tasks 1–10
- Produces: documented, verified local study application

- [ ] **Step 1: Add final integration assertions**

```js
test("every subject page exposes the complete local application", () => {
  for (const page of SUBJECT_PAGES) {
    const html = fs.readFileSync(page, "utf8");
    assert.match(html, /assets\/js\/exam-engine\.js/);
    assert.match(html, /assets\/js\/app\.js/);
    assert.doesNotMatch(html, /https?:\/\//);
  }
});

test("source underlag is never loaded by a student page", () => {
  for (const page of ALL_SHIPPED_HTML_AND_JS) {
    assert.doesNotMatch(fs.readFileSync(page, "utf8"), /Underlag\//);
  }
});
```

- [ ] **Step 2: Run the complete automated suite**

Run: `node --test "KS Förberedelse/tests/"*.test.js`

Expected: all tests PASS; output confirms at least 370 unique main-question IDs.

- [ ] **Step 3: Verify the math end-to-end flow through `file://`**

Start a new exam, jump directly from question 1 to question 5 without answering, enter decimal comma and reversed root order, flag a question, reload, resume, grade with unanswered questions, expand exactly one solution and override one result. Expected: every state persists, no solution appears before grading and the score updates correctly.

- [ ] **Step 4: Verify the physics end-to-end flow**

Check all five figure types, required units, unit suffixes, alternate equivalent units and manual force-diagram scoring. Expected: SVG labels remain readable, dimensions convert correctly and uncertain responses become self-assessment.

- [ ] **Step 5: Verify the chemistry end-to-end flow**

Check Unicode/plain formula input, reordered scaled equations, aggregation-state partial credit, manual electron-formula scoring and the original formelblad at 50, 100, 200 and 300 percent. Expected: all six main questions total 20 points and the formula sheet remains available throughout.

- [ ] **Step 6: Verify no-repeat behavior**

Generate a full slot cycle for each subject using a cleared test profile. Expected: no stable ID repeats within 25 math/fys cycles or 20 chemistry cycles, and the first ID after refill differs from the last ID before refill.

- [ ] **Step 7: Verify responsive and keyboard behavior**

Inspect at 1440×900, 768×1024 and 390×844. Use only Tab, Shift+Tab, Enter, Space and arrow-free native navigation. Expected: no horizontal overflow, no clipped formula sheet controls, visible focus, 44px mobile targets, and DOM order matching reading order.

- [ ] **Step 8: Verify print previews**

Print-preview one exam per subject and the chemistry sheet separately. Expected: no navigation, buttons, timer, status, answer text or solution content appears; every question and figure is readable with useful answer space.

- [ ] **Step 9: Check browser logs and static files**

Expected: zero error/warning logs from the application, zero missing assets and zero external requests. Fix only defects demonstrated by these checks, then rerun the directly affected automated and manual check.

- [ ] **Step 10: Write the local usage README**

Document how to open the hub, start/resume/reset a test, use the optional timer, understand status markers, grade manual tasks, open the chemistry sheet, print, and clear question history. State that all data stays in the browser.

- [ ] **Step 11: Run final verification**

Run:

```bash
node --test "KS Förberedelse/tests/"*.test.js
git diff --check
git status --short
```

Expected: tests PASS, `git diff --check` is silent, and status contains only intended files plus the user's pre-existing `Underlag` directory and `.superpowers` brainstorming artifacts.

- [ ] **Step 12: Commit**

```bash
git add "KS Förberedelse/index.html" \
  "KS Förberedelse/README.md" \
  "KS Förberedelse/assets" \
  "KS Förberedelse/Matematik KS2" \
  "KS Förberedelse/Fysik KS1" \
  "KS Förberedelse/Kemi KS" \
  "KS Förberedelse/tests"
git commit -m "feat: complete interactive KS practice exams"
```

---

## Review Checkpoints

After Task 6, review the shared application shell before adding hundreds of questions. After each subject-bank task, run the full suite and manually inspect at least five generated exams for that subject. Do not defer content correctness until final integration; incorrect source data in a question family must block the task that introduced it.

## Completion Evidence

The final handoff must report:

- exact test command and pass count;
- question totals per subject and per slot;
- proof that 1,000 generated exams per subject preserve structure and score;
- visual checks performed at three viewport sizes;
- confirmation that the chemistry sheet is the unmodified page 4 extraction;
- remaining untracked user-owned files, if any.
