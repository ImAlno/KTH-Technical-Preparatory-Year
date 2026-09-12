# KS-träningens slutsvars-, diagram- och UI-redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gör om den befintliga offlineappen så att endast korta slutsvar poängsätts digitalt, allt metodarbete hänvisas till räknehäftet, samtliga 150 promptdiagram och 65 lösningsfigurer är semantiskt korrekta och kollisionsfria, och hela appen använder den godkända akademiska tidskriftsstilen.

**Architecture:** Behåll den beroendefria UMD/CommonJS-arkitekturen och de stabila fråge-ID:na. Utöka provmotorn med strikt `choice`-validering och ett versionsbundet fältschema, låt frågorna bära icke-interaktiv `workOnPaper`-metadata, och bygg alla prompt-SVG:er genom en gemensam `diagram-kit.js` som samtidigt lämnar ett testbart geometrimanifest. Node-tester verifierar data och geometri; en lokal headless-Chrome-revision använder riktiga SVG-mått (`getBBox`/CTM) över fyra renderingslägen och skapar kontaktkartor för manuell granskning.

**Tech Stack:** Semantisk HTML5, CSS, klassisk JavaScript utan byggsteg eller externa paket, UMD/CommonJS, Node 24 `node:test`, SVG, lokal Google Chrome i headless-läge och `file://`.

**Spec:** `docs/superpowers/specs/2026-09-12-ks-practice-redesign.md`

## Global Constraints

- Ändra aldrig `KS Förberedelse/Underlag` och ladda aldrig underlaget från studentsidorna.
- Bevara exakt 125 matematikfrågor, 125 fysikfrågor och 120 kemifrågor samt samtliga 370 huvudfråge-ID:n.
- Bevara provvikterna 10/10/20, godkäntgränser, timer, fri navigation, autosparning och repetitionsköer.
- Ingen levererad fråga får innehålla `kind: "self"`, metodbegärande `textarea` eller en interaktiv metod-/självbedömning.
- Osäker tolkning av ett kort slutsvar får fortfarande returnera rättningsstatus `self` och kunna korrigeras manuellt; detta är inte samma sak som ett levererat `self`-fält.
- Kemins `formelblad-ks.png` ska förbli byte-identiskt med SHA-256 `e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee`.
- Alla nya JavaScriptmoduler ska fungera både med `module.exports` och via ordnade klassiska `<script>`-taggar från `file://`.
- Diagramuppgifter får inte avslöja den kraftfigur studenten instrueras att rita i räknehäftet.
- En uppgift är inte färdig förrän dess kanoniska slutsvar ger full poäng och ett representativt felaktigt svar inte gör det.
- Använd TDD per task: verifiera först det avsedda röda felet, implementera minsta fullständiga lösning, kör fokuserade tester och därefter berörda regressionsfiler.

---

## Shared Contracts

```js
// Ändligt, maskinrättat val
{
  id: "polarity",
  label: "Är molekylen en dipol?",
  kind: "choice",
  points: 1,
  expected: "yes",
  options: [
    { value: "yes", label: "Ja" },
    { value: "no", label: "Nej" }
  ]
}

// Instruktion som aldrig sparas som svar eller påverkar poängen
{
  workOnPaper: {
    title: "Arbeta i räknehäftet",
    instruction: "Rita en fullständig kraftfigur och visa din beräkning där. Här skriver du endast slutsvaret.",
    comparison: "Jämför friläggning, riktningar, teckenval och beräkningsgång med lösningen."
  }
}

// Serialiserbar diagrammetadata på question.sourceData.diagram
{
  id: "physics-s5-inclined-plane-01-diagram",
  family: "inclined-plane",
  viewBox: [0, 0, 520, 300],
  points: { planeStart: [66, 232], planeEnd: [454, 88] },
  invariants: [
    { kind: "body-tangent-to-line", body: "load", line: "plane", tolerance: 0.01 },
    { kind: "angle-at-vertex", angle: "incline-angle", vertex: "planeStart" }
  ]
}
```

`choice.options[].value` är den enda lagrade representationen. `label` är presentationsspråk. `workOnPaper` och `sourceData.diagram` får aldrig kopieras in i sessionssvaret.

De 65 fysikfrågor som kräver en egen kraftfigur får dessutom `sourceData.solutionDiagram` och en fullständig, tillgänglig kraftfigur inne i `solutionHtml`. Den visas aldrig i prompten och granskas i alla tre skärmlägen efter lösningsöppning.

---

### Task 0: Lås bevarandebaslinjen före implementation

**Files:**
- Create: `KS Förberedelse/tests/fixtures/question-ids.json`
- Create: `KS Förberedelse/tests/fixtures/underlag-sha256.txt`
- Create: `KS Förberedelse/tests/preservation.test.js`

- [ ] **Step 1: Generate the exact stable-ID fixture from the untouched banks**

Write a one-off Node command that requires every slot in subject/slot order and serializes `{ subject, slot, ids }` with all current IDs. The committed fixture must contain exactly 370 IDs: 125 math, 125 physics and 120 chemistry.

- [ ] **Step 2: Generate the ignored-Underlag hash fixture**

From repository root, hash all 18 regular files below `KS Förberedelse/Underlag` in byte-sorted relative-path order. Store lines as `<sha256><two spaces><relative path>`; never copy source content into Git.

```bash
find "KS Förberedelse/Underlag" -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 > "KS Förberedelse/tests/fixtures/underlag-sha256.txt"
```

- [ ] **Step 3: Add and run preservation tests**

`preservation.test.js` must compare every current ID array exactly and recompute every Underlag hash. It must fail on renamed/reordered/missing IDs, added/removed Underlag files or changed bytes.

Run: `node --test "KS Förberedelse/tests/preservation.test.js"`

Expected GREEN on the untouched baseline: exact ID fixture and all 18 Underlag hashes match.

- [ ] **Step 4: Commit the locked baseline before any content edit**

```bash
git add "KS Förberedelse/tests/fixtures/question-ids.json" "KS Förberedelse/tests/fixtures/underlag-sha256.txt" "KS Förberedelse/tests/preservation.test.js"
git commit -m "test: lock KS content preservation baseline"
```

---

### Task 1: Strikt slutsvarskontrakt och ny `choice`-rättare

**Files:**
- Modify: `KS Förberedelse/assets/js/grading.js`
- Modify: `KS Förberedelse/assets/js/exam-engine.js`
- Modify: `KS Förberedelse/tests/grading.test.js`
- Modify: `KS Förberedelse/tests/exam-engine.test.js`

**Interfaces:**
- Add: `grading.gradeChoice(spec, raw)`
- Change: `exam.validateExamData(subject, slots)` rejects every delivered `self` field.
- Validate optional `question.workOnPaper` as exactly three non-empty strings.

- [ ] **Step 1: Add failing choice-grader tests**

Add exact cases for a valid choice, a wrong listed choice, blank input, an unknown stored value, duplicate option values, empty labels and an `expected` value missing from `options`.

```js
test("grades only stable values from a valid finite choice", () => {
  const spec = {
    kind: "choice", points: 1, expected: "yes",
    options: [{ value: "yes", label: "Ja" }, { value: "no", label: "Nej" }]
  };
  assert.equal(grading.gradeChoice(spec, "yes").status, "correct");
  assert.equal(grading.gradeChoice(spec, "no").status, "incorrect");
  assert.equal(grading.gradeChoice(spec, "maybe").status, "self");
});
```

- [ ] **Step 2: Add failing engine-contract tests**

Assert that a bank containing `kind: "self"` is rejected before storage/RNG, that malformed choice options are rejected, and that valid `workOnPaper` metadata is accepted while missing keys, extra keys or empty values are rejected.

Run: `node --test "KS Förberedelse/tests/grading.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected RED: `gradeChoice` is missing and the current engine still accepts `self`.

- [ ] **Step 3: Implement the choice grader and field validation**

Add `choice: "gradeChoice"` to `FIELD_GRADERS`. `gradeChoice` must return full credit only when `raw === expected`, zero/`incorrect` for another declared option, zero/`incorrect` for blank, and zero/`self` for a value the spec does not declare. Export it from both CommonJS and `window.KS.grading`.

Replace the permissive `return field.kind === "self"` branch with explicit rejection. Validate options as a non-empty array of records containing only non-empty unique `value` and `label` strings.

- [ ] **Step 4: Validate paper-work metadata without altering the snapshot**

Add a `validWorkOnPaper(question)` helper used by `validateExamData`. Omitted metadata is valid. Present metadata must contain only `title`, `instruction`, `comparison`, each a non-empty string.

- [ ] **Step 5: Run focused and full engine/grading tests**

Run: `node --test "KS Förberedelse/tests/grading.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected GREEN: all tests pass; prior numeric, algebraic and chemistry graders retain their exports.

- [ ] **Step 6: Commit**

```bash
git add "KS Förberedelse/assets/js/grading.js" "KS Förberedelse/assets/js/exam-engine.js" "KS Förberedelse/tests/grading.test.js" "KS Förberedelse/tests/exam-engine.test.js"
git commit -m "feat: enforce final-answer field contracts"
```

---

### Task 2: Versionsbundet fältschema och kontrollerad sessionsmigrering

**Files:**
- Modify: `KS Förberedelse/assets/js/exam-engine.js`
- Modify: `KS Förberedelse/assets/js/app.js`
- Modify: `KS Förberedelse/tests/exam-engine.test.js`
- Modify: `KS Förberedelse/tests/static-pages.test.js`

**Interfaces:**
- Add snapshot `schemaVersion: 2`.
- Add snapshot `fieldSchema`, keyed by selected question ID.
- Add: `exam.questionFieldSchema(question)` returning only IDs, kinds and choice option values.
- Add: `exam.inspectSnapshot(snapshot, questionSource, subject)` returning `{ ok, reason }`, where `reason` distinguishes `field-schema-mismatch` from `invalid-snapshot`.

- [ ] **Step 1: Write failing snapshot-signature tests**

Create a session, assert this exact normalized shape, and verify restore rejects changed field IDs, kinds, order or choice options even when `answers` is empty.

```js
assert.deepEqual(snapshot.fieldSchema.q1, [
  { id: "polarity", kind: "choice", options: ["yes", "no"] }
]);
```

Also assert that history queues remain untouched when an incompatible active snapshot is detected.

- [ ] **Step 2: Write failing recovery-copy tests**

Mount the app with a version-1 snapshot and assert:

- recovery dialog remains open;
- active storage is not removed or overwritten;
- message is `Provets svarstyp har uppdaterats. Starta ett nytt prov för att fortsätta.`;
- replacement occurs only after `recovery-new` and the existing confirmation path.

Run: `node --test "KS Förberedelse/tests/exam-engine.test.js" "KS Förberedelse/tests/static-pages.test.js"`

Expected RED: snapshots have no `fieldSchema` and the migration-specific copy is absent.

- [ ] **Step 3: Implement schema version 2**

Store normalized selected-field schemas at session creation, include them in snapshot validation and require an exact match in restore. Every schema entry is `{ id, kind, options }`, where `options` is the ordered stable-value array for `choice` and `null` for all other kinds. Do not include labels, expected answers or point values. Keep storage key names and history schema unchanged so repetition queues survive. Make `validateSnapshot` delegate to `inspectSnapshot(...).ok` so its existing boolean API remains compatible.

- [ ] **Step 4: Implement controlled incompatibility handling**

Use `inspectSnapshot` in `restoreSavedSession` to differentiate current-bank incompatibility from corrupt/invalid state. Preserve the current active value until the student explicitly confirms replacement; do not silently create a new exam. Version 1 and a changed `fieldSchema` use the answer-type-update message; malformed state keeps the existing generic recovery error.

- [ ] **Step 5: Run focused tests**

Run: `node --test "KS Förberedelse/tests/exam-engine.test.js" "KS Förberedelse/tests/static-pages.test.js"`

Expected GREEN: version-2 snapshots round-trip; version-1 and changed-field snapshots follow the controlled dialog path.

- [ ] **Step 6: Commit**

```bash
git add "KS Förberedelse/assets/js/exam-engine.js" "KS Förberedelse/assets/js/app.js" "KS Förberedelse/tests/exam-engine.test.js" "KS Förberedelse/tests/static-pages.test.js"
git commit -m "feat: version saved answer schemas"
```

---

### Task 3: Semantiska val, räknehäftesruta och icke-interaktiv lösningsjämförelse

**Files:**
- Modify: `KS Förberedelse/assets/js/app.js`
- Modify: `KS Förberedelse/assets/app.css`
- Modify: `KS Förberedelse/tests/static-pages.test.js`

**Interfaces:**
- Add internal renderers: `renderChoiceField`, `renderWorkOnPaper`, `renderComparison`.
- Remove shipped rendering path for `textarea` and the `setSelfGrade` UI.
- Retain collapsed `overrideGrade` for parser false negatives.

- [ ] **Step 1: Add failing DOM-harness tests**

Extend `fakeNode` only as needed to test native radio groups. Assert that:

- a `choice` field renders one `<fieldset>`, one `<legend>` and native radio inputs sharing a name;
- selecting a radio saves only its stable option value;
- `workOnPaper` appears before `.answer-area` and creates no input;
- `.comparison` is absent before grading and before solution reveal;
- after grade plus explicit reveal, solution and comparison checklist appear with no input/button inside the comparison;
- `.manual-grade`, `self-score` and answer textareas never render;
- override details still restores focus after rerender.

Run: `node --test "KS Förberedelse/tests/static-pages.test.js"`

Expected RED: choice fields render as text inputs and no paper/comparison components exist.

- [ ] **Step 2: Implement choice rendering**

Use native `<input type="radio">` controls. On `change`, call `session.setAnswer(question.id, field.id, option.value)` and refresh only navigation unless a full render is necessary. In locked mode show the selected Swedish option label, not the raw stable value.

- [ ] **Step 3: Implement paper and solution comparison components**

Render a semantic `<aside class="work-on-paper">` with visible title and instruction before answers. After explicit solution reveal, append `<aside class="comparison">` containing `workOnPaper.comparison` and a plain `<ul>` built from `question.rubric`; omit point numbers and every interactive control.

- [ ] **Step 4: Delete the self-assessment presentation path**

Remove `grade.requiresSelfAssessment` controls and preliminary-result copy from `app.js`. Leave manual override as the only score-adjustment UI. Do not render textareas; `field.multiline` no longer changes the control type.

If a short answer receives the uncertainty status `self`, display `Rättningen behöver kontrolleras` and direct the student to the collapsed manual correction. Do not show method-self-assessment controls or treat uncertainty as a method score.

- [ ] **Step 5: Add minimal structural CSS hooks**

Style radio groups, work instructions and comparison boxes accessibly without applying the final redesign yet. Ensure every label is clickable and controls have visible focus.

- [ ] **Step 6: Run focused tests and commit**

Run: `node --test "KS Förberedelse/tests/static-pages.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

```bash
git add "KS Förberedelse/assets/js/app.js" "KS Förberedelse/assets/app.css" "KS Förberedelse/tests/static-pages.test.js"
git commit -m "feat: move method work to notebook guidance"
```

---

### Task 4: Matematikbankens räknehäftesinstruktioner

**Files:**
- Modify: `KS Förberedelse/Matematik KS2/questions/slot-1.js`
- Modify: `KS Förberedelse/Matematik KS2/questions/slot-2.js`
- Modify: `KS Förberedelse/Matematik KS2/questions/slot-3.js`
- Modify: `KS Förberedelse/Matematik KS2/questions/slot-4.js`
- Modify: `KS Förberedelse/Matematik KS2/questions/slot-5.js`
- Modify: `KS Förberedelse/tests/math-questions.test.js`

- [ ] **Step 1: Write the bank-wide failing audit**

For all 125 questions assert zero `self`/`multiline` fields, valid `workOnPaper`, explicit wording equivalent to `Här skriver du endast slutsvaret`, full automatic points, and no prompt language asking the student to type/show a derivation in the computer.

Run: `node --test "KS Förberedelse/tests/math-questions.test.js"`

Expected RED: `workOnPaper` is absent.

- [ ] **Step 2: Add family-specific paper instructions**

At each slot generator, set instructions appropriate to the tested method:

- slot 1: definitionsvillkor, kvadrering and prövning;
- slot 2: both absolute-value branches and substitution checks;
- slot 3: factoring/cancellation plus original exclusions;
- slot 4: denominator restrictions, substitution and root validation;
- slot 5: geometric relation, labelled sketch and calculation.

Keep every field ID, expected answer, point allocation and question ID unchanged.

- [ ] **Step 3: Preserve full post-grade method solutions**

Verify that each question's rubric forms a useful notebook checklist and that existing detailed solution steps are not shortened.

- [ ] **Step 4: Run tests and commit**

Run: `node --test "KS Förberedelse/tests/math-questions.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

```bash
git add "KS Förberedelse/Matematik KS2/questions" "KS Förberedelse/tests/math-questions.test.js"
git commit -m "content: direct math workings to notebooks"
```

---

### Task 5: Fysikbankens 65 metodfält blir slutsvarspoäng

**Files:**
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-1.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-2.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-3.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-4.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-5.js`
- Modify: `KS Förberedelse/tests/physics-questions.test.js`

- [ ] **Step 1: Replace the old manual-field tests with a failing final-answer audit**

Assert exactly 125 numeric fields total, each worth the full two points, zero `self` fields, zero `multiline`, and valid paper instructions on all 125 questions. Specifically assert former manual families contain one `answer` field only.

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js"`

Expected RED: 65 self fields remain and their paired numeric answers are worth one point.

- [ ] **Step 2: Convert slot 1 contact questions**

Remove `diagram`; make `answer.points = 2`. Put force-figure and equilibrium work in `workOnPaper`. Keep graph questions' numeric field at two points and add graph-reading/calculation paper instructions.

- [ ] **Step 3: Convert slots 2 and 3 guidance**

Keep their single two-point numeric fields. Add family-specific paper instructions for unit conversion/geometric rearrangement and vertical-motion sign conventions/root selection.

- [ ] **Step 4: Convert slots 4 and 5**

Remove all 50 `diagram` fields, make every numeric `answer` worth two points, and add explicit force-figure/free-body instructions to `workOnPaper`. Preserve all full solutions and rubrics as comparison checklists.

- [ ] **Step 5: Verify physics behavior**

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected GREEN: canonical answer on every physics question earns 2/2; 1,000 generated exams still produce five questions and ten points with full 25-question cycles.

- [ ] **Step 6: Commit**

```bash
git add "KS Förberedelse/Fysik KS1/questions" "KS Förberedelse/tests/physics-questions.test.js"
git commit -m "content: score only physics final answers"
```

---

### Task 6: Kemins Bohr-, molekyl- och bindningsfrågor blir objektiva slutsvar

**Files:**
- Modify: `KS Förberedelse/Kemi KS/questions/slot-1.js`
- Modify: `KS Förberedelse/Kemi KS/questions/slot-2.js`
- Modify: `KS Förberedelse/Kemi KS/questions/slot-3.js`
- Modify: `KS Förberedelse/Kemi KS/questions/slot-4.js`
- Modify: `KS Förberedelse/Kemi KS/questions/slot-5.js`
- Modify: `KS Förberedelse/Kemi KS/questions/slot-6.js`
- Modify: `KS Förberedelse/tests/chemistry-questions.test.js`
- Create: `KS Förberedelse/tests/final-answer-contract.test.js`

- [ ] **Step 1: Write the failing chemistry final-answer audit**

Assert zero `self` and `multiline` fields across 120 questions, canonical answers earn exactly 4/7/2/2/2/3 points by slot, every choice option set is valid, and all questions requiring method or drawing have `workOnPaper`.

Run: `node --test "KS Förberedelse/tests/chemistry-questions.test.js"`

Expected RED: 70 self fields remain.

- [ ] **Step 2: Convert slot 1 Bohr work**

For the ten Bohr variants, replace `bohr` with `shells`, an `aliases` field worth one point. Canonical form is comma-separated inner-to-outer shells such as `2,5`; explicitly enumerate safe equivalents with hyphen, en dash and spaces. The prompt requires the actual Bohr drawing in the notebook and asks only for shell distribution digitally. Preserve other isotope/term/ion/concentration fields and the total four points.

- [ ] **Step 3: Convert slot 3 molecular structure and polarity**

Keep electron formula drawing and justification in the notebook. Replace the two self fields with:

- `geometry`, one-point `choice` using stable values `linear`, `bent`, `trigonal-planar`, `trigonal-pyramidal`, `tetrahedral` and Swedish labels;
- `polarity`, one-point `choice` using `yes`/`no`.

Generate only options relevant to a consistent shared set; never infer correctness from displayed text.

- [ ] **Step 4: Convert slot 4 bonding checklist**

Replace the two-point text area with four half-point choice fields `part-a` through `part-d`. Phase-change choices classify the dominant particle interaction; reaction choices classify the named intramolecular bond. Keep the short reasoning in the notebook and retain the four rubric items as the post-solution checklist.

- [ ] **Step 5: Audit slots 2, 5 and 6**

Add explicit notebook instructions for balancing, molar-mass work, stoichiometry, gas-law conversion and composition calculations while leaving their existing objective field IDs/graders intact.

- [ ] **Step 6: Add the cross-subject final-answer contract test**

Load all 370 questions and assert:

- zero `self`/`multiline` fields and at least one objective final-answer field per question;
- no answer UI request for calculation, proof, force drawing, Bohr drawing, electron drawing or long reasoning;
- every canonical field input earns its field points and their sum equals the question points;
- one type-specific wrong input per field (`numeric`, `aliases`, `choice`, algebra, formula and equation) never earns full field credit;
- selected exams retain five/five/six questions and 10/10/20 points;
- every numeric field has a normalized target unit and both prompt/label state the requested unit, except explicit dimensionless unit `1`;
- all questions needing work have valid `workOnPaper`, and that metadata contains no answer/score controls.

- [ ] **Step 7: Run chemistry, cross-subject and engine tests**

Run: `node --test "KS Förberedelse/tests/chemistry-questions.test.js" "KS Förberedelse/tests/final-answer-contract.test.js" "KS Förberedelse/tests/chemistry-parser.test.js" "KS Förberedelse/tests/grading.test.js" "KS Förberedelse/tests/exam-engine.test.js"`

Expected GREEN: all 120 questions validate and grade automatically; notation safety tests remain unchanged.

- [ ] **Step 8: Commit**

```bash
git add "KS Förberedelse/Kemi KS/questions" "KS Förberedelse/tests/chemistry-questions.test.js" "KS Förberedelse/tests/final-answer-contract.test.js"
git commit -m "content: replace chemistry self grading with final answers"
```

---

### Task 7: Gemensam SVG-geometrimotor

**Files:**
- Create: `KS Förberedelse/assets/js/diagram-kit.js`
- Create: `KS Förberedelse/tests/diagram-kit.test.js`
- Modify: `KS Förberedelse/tests/static-pages.test.js`
- Modify: `KS Förberedelse/Matematik KS2/index.html`
- Modify: `KS Förberedelse/Fysik KS1/index.html`
- Modify: `KS Förberedelse/Kemi KS/index.html`

**Interfaces:**

```js
const diagram = kit.create({ id, title, description, width, height });
diagram.add("geometry", kit.line({ id, a, b, role }));
diagram.add("connections", kit.ropeAroundCircle({ id, from, pulley, to, side }));
diagram.add("information", kit.angleArc({ id, vertex, fromRay, toRay, radius }));
diagram.add("labels", kit.label({ id, at, text, anchor, avoid, minClearance: 6 }));
const { html, manifest } = diagram.finish();
```

The module also exports pure vector helpers, `bodyOnLine`, `dimension`, `arrow`, `graphTransform` and `validateManifest`.

- [ ] **Step 1: Write failing pure-geometry tests**

Test vector normalization, signed point-to-line distance, rectangle contact points on an arbitrary incline, tangent points from an external point to a circle, continuous rope endpoints, angle-arc endpoints, dimension anchors and graph coordinate transforms. Include vertical/horizontal and near-degenerate inputs; invalid or non-finite geometry must throw a controlled error.

Run: `node --test "KS Förberedelse/tests/diagram-kit.test.js"`

Expected RED: the module does not exist.

- [ ] **Step 2: Implement vectors and semantic primitives**

All functions receive/return finite numeric arrays `[x, y]`. `bodyOnLine` must place both intended bottom corners on the supplied line using its unit tangent and chosen outward normal. `ropeAroundCircle` must solve actual tangent points and verify radius-dot-segment orthogonality within `1e-6`. The same primitives produce prompt manifests and solution-only manifests; a manifest carries `purpose: "prompt"` or `purpose: "solution"`.

- [ ] **Step 3: Implement layered SVG serialization**

Always serialize layers in `geometry`, `connections`, `information`, `labels` order. Every visible element emitted in `geometry`, `connections` or `information` becomes a collision object by default with a validated semantic role; callers cannot opt out by omitting an attribute. A decorative exemption requires an explicit role from a short allowlist and is rejected if it carries semantic geometry. Add `data-role`, `data-geometry-id`, `data-label`, label-anchor and label-background metadata required by browser auditing. Escape all title, description and label text. Reject duplicate element IDs, missing accessible text, non-finite attributes and viewBox overflow declared in the manifest. Unit tests require every root to have `role="img"`, an `aria-labelledby` containing exactly its own unique `<title>` and `<desc>` IDs, and no duplicate fragment ID across diagrams, markers or clip paths.

- [ ] **Step 4: Load the module before question banks**

Insert `../assets/js/diagram-kit.js` after the shared parser/grader dependencies and before every `questions/slot-*.js`. Update `SHARED_DEPENDENCIES` in static tests. The chemistry page loads it too so all pages retain identical shared ordering.

- [ ] **Step 5: Run module/static tests and commit**

Run: `node --test "KS Förberedelse/tests/diagram-kit.test.js" "KS Förberedelse/tests/static-pages.test.js"`

```bash
git add "KS Förberedelse/assets/js/diagram-kit.js" "KS Förberedelse/tests/diagram-kit.test.js" "KS Förberedelse/tests/static-pages.test.js" "KS Förberedelse/Matematik KS2/index.html" "KS Förberedelse/Fysik KS1/index.html" "KS Förberedelse/Kemi KS/index.html"
git commit -m "feat: add semantic SVG geometry kit"
```

---

### Task 8: Bygg om matematikens 25 geometridiagram

**Files:**
- Modify: `KS Förberedelse/Matematik KS2/questions/slot-5.js`
- Modify: `KS Förberedelse/tests/math-questions.test.js`
- Modify: `KS Förberedelse/tests/diagram-kit.test.js`

- [ ] **Step 1: Add failing family invariants**

For every one of the 25 variants verify:

- right-triangle marker is at the actual right-angle vertex and the angle arc is at the requested vertex;
- non-right-triangle angle lies exactly between the two dimensioned sides;
- `DE ∥ BC` from vector cross products and D/E lie on AB/AC;
- composite cut-out dimensions attach to the actual removed rectangle;
- symmetric height reaches the base midpoint perpendicularly;
- labels have family-specific anchors and reserved zones.

Run: `node --test "KS Förberedelse/tests/math-questions.test.js" "KS Förberedelse/tests/diagram-kit.test.js"`

Expected RED: current raw SVGs expose no manifests and cannot prove the invariants.

- [ ] **Step 2: Inject diagram-kit into the slot UMD wrapper**

Use `require("../../assets/js/diagram-kit.js")` in CommonJS and `root.KS.diagram` in the browser. Fail bank construction loudly if the dependency is absent.

- [ ] **Step 3: Rebuild all five figure generators**

Use actual geometry points as the single source for outlines, dimensions, angle arcs and label anchors. Do not encode separate decorative coordinates that can drift away from the semantic points.

- [ ] **Step 4: Attach and validate manifests**

Set `question.sourceData.diagram = manifest` while preserving every question ID, source parameter and answer. Verify 25 unique SVG title/description IDs.

- [ ] **Step 5: Run tests and commit**

Run: `node --test "KS Förberedelse/tests/math-questions.test.js" "KS Förberedelse/tests/diagram-kit.test.js"`

```bash
git add "KS Förberedelse/Matematik KS2/questions/slot-5.js" "KS Förberedelse/tests/math-questions.test.js" "KS Förberedelse/tests/diagram-kit.test.js"
git commit -m "fix: rebuild every math geometry diagram"
```

---

### Task 9: Bygg om fysik slot 1–2 — grafer, kontakt och kroppsmått

**Files:**
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-1.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-2.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-3.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-4.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-5.js`
- Modify: `KS Förberedelse/tests/physics-questions.test.js`

- [ ] **Step 1: Add failing slot 1–2 invariant tests**

Verify every graph point maps exactly from declared scales, every polyline breakpoint equals the transformed point, axes/ticks stay in their reserved zones, floor bodies touch without crossing, beams touch both supports, sphere diameter crosses its centre, hexagon radius runs from centre to vertex, and all dimension endpoints match source geometry.

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js"`

Expected RED: current SVG strings lack the required semantic manifests.

- [ ] **Step 2: Inject diagram-kit into all five physics UMD wrappers**

Each physics slot uses `require("../../assets/js/diagram-kit.js")` in CommonJS and `root.KS.diagram` in the browser, passed explicitly into its factory. Bank creation fails with a controlled dependency error when the module is missing; no slot reads an undeclared global.

- [ ] **Step 3: Rebuild graph/contact diagrams and contact solutions**

Use `graphTransform`, named tick zones, `bodyOnLine` for floor contact and explicit support contact points. Prompt figures show the situation and given applied force/support, never the requested complete free-body diagram. For all 15 contact questions, append a separate solution-only force diagram with every force anchored to the isolated body/system and store its manifest as `sourceData.solutionDiagram`.

- [ ] **Step 4: Rebuild all geometric-body diagrams**

Create explicit dimension primitives outside the solids. Keep diameter/circumradius semantics and test roles used by existing regression tests. Split long givens into non-overlapping labels rather than one over-wide text row.

- [ ] **Step 5: Run tests and commit**

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js" "KS Förberedelse/tests/diagram-kit.test.js"`

```bash
git add "KS Förberedelse/Fysik KS1/questions/slot-1.js" "KS Förberedelse/Fysik KS1/questions/slot-2.js" "KS Förberedelse/Fysik KS1/questions/slot-3.js" "KS Förberedelse/Fysik KS1/questions/slot-4.js" "KS Förberedelse/Fysik KS1/questions/slot-5.js" "KS Förberedelse/tests/physics-questions.test.js"
git commit -m "fix: rebuild physics graph and body diagrams"
```

---

### Task 10: Bygg om fysik slot 3–4 — rörelse och statik

**Files:**
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-3.js`
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-4.js`
- Modify: `KS Förberedelse/tests/physics-questions.test.js`

- [ ] **Step 1: Add failing slot 3–4 invariant tests**

Check motion arrows originate at the body/path and differ semantically from force arrows. Check hanging ropes terminate at body edges, cable endpoints meet anchors/bodies, cable-angle arcs use the stated horizontal reference, vector-component arrows use normalized directions, beams touch supports, wall-contact circles are tangent to the wall, and wall cables attach to the circle at the declared point.

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js"`

Expected RED: at least the manifest assertions fail on both slots.

- [ ] **Step 2: Rebuild vertical-motion diagrams**

Use a named origin/ground, body centre, trajectory and direction arrow. Separate `v₀`, height and sign-convention labels into reserved regions.

- [ ] **Step 3: Rebuild static-equilibrium diagrams and solution force figures**

Derive rope/cable endpoints and contact points, place angle labels in a clear sector, and keep given-vector diagrams visibly distinct from student-created free-body diagrams. Use `bodyOnLine` or exact tangent/contact tests where applicable. Append one complete solution-only free-body diagram to each of the 25 solutions and validate force origin, direction and labels against the family's equations.

- [ ] **Step 4: Run tests and commit**

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js" "KS Förberedelse/tests/diagram-kit.test.js"`

Before commit, assert slots 1–4 now contain 100 valid `sourceData.diagram` manifests while all 125 question IDs still match the preservation fixture.

```bash
git add "KS Förberedelse/Fysik KS1/questions/slot-3.js" "KS Förberedelse/Fysik KS1/questions/slot-4.js" "KS Förberedelse/tests/physics-questions.test.js"
git commit -m "fix: rebuild physics motion and statics diagrams"
```

---

### Task 11: Bygg om fysik slot 5 — dynamik, lutande plan och trissa

**Files:**
- Modify: `KS Förberedelse/Fysik KS1/questions/slot-5.js`
- Modify: `KS Förberedelse/tests/physics-questions.test.js`

- [ ] **Step 1: Add failing slot 5 contact/tangent tests**

For all 25 variants assert:

- horizontal bodies' full bottom contact edge lies on the floor;
- the inclined box's two bottom corners lie on the plane within `0.01` SVG units and no box corner crosses the plane;
- incline angle arc shares the plane vertex and horizontal reference;
- table body rests on the tabletop;
- both straight rope segments are tangent to the pulley, the rope path is continuous, and neither rope nor pulley intersects a body interior;
- motion/applied-force arrows start at their body and point in the declared direction;
- no prompt contains a full gravity/normal/friction free-body set.

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js"`

Expected RED: the old inclined box and raw rope topology do not satisfy the new manifests/contracts.

- [ ] **Step 2: Rebuild horizontal and inclined-plane diagrams**

Use `bodyOnLine` for both floor and incline placement. Compute the displayed incline from `angleDeg`; the box bottom is tangent to that exact line. Anchor the angle text outside the triangle in a protected sector.

- [ ] **Step 3: Rebuild the connected-mass system and all solution force figures**

Use actual circle tangents, a continuous line/arc/line rope, table and hanging-body edge attachment points, and clearance checks against both bodies. Preserve `data-role="table-body"`, `pulley` and `rope` compatibility. Append full solution-only free-body diagrams for every slot-5 question; connected-mass variants show two separated bodies with paired tension and the correct kinetic-friction direction.

- [ ] **Step 4: Run tests and commit**

Run: `node --test "KS Förberedelse/tests/physics-questions.test.js" "KS Förberedelse/tests/diagram-kit.test.js"`

Before commit, assert all 125 physics questions contain exactly one valid prompt `sourceData.diagram`, exactly 65 former drawing questions contain one valid `sourceData.solutionDiagram`, no other question has one, and every ID still matches the preservation fixture.

```bash
git add "KS Förberedelse/Fysik KS1/questions/slot-5.js" "KS Förberedelse/tests/physics-questions.test.js"
git commit -m "fix: rebuild every physics dynamics diagram"
```

---

### Task 12: Akademisk tidskriftsstil på hubb, prov och dialoger

**Files:**
- Modify: `KS Förberedelse/assets/app.css`
- Modify: `KS Förberedelse/index.html`
- Modify: `KS Förberedelse/Matematik KS2/index.html`
- Modify: `KS Förberedelse/Fysik KS1/index.html`
- Modify: `KS Förberedelse/Kemi KS/index.html`
- Modify: `KS Förberedelse/tests/subject-config.test.js`
- Modify: `KS Förberedelse/tests/static-pages.test.js`

- [ ] **Step 1: Add failing visual-system contract tests**

Assert the exact tokens `#FBF8EF`, `#E8E1D3`, `#34202A`, `#74676C`, `#C9BEB8`, `#356B59`, `#A94F3B`; Georgia/Times content; Helvetica/Arial controls; 44 px mobile targets; print hiding rules; reduced-motion handling; and no external URLs.

Run: `node --test "KS Förberedelse/tests/subject-config.test.js" "KS Förberedelse/tests/static-pages.test.js"`

Expected RED: current Apple-blue token set is present.

- [ ] **Step 2: Rebuild the shared page shell**

Create one warm ground with a continuous paper surface, narrow left question rail and readable 72-character content column. On mobile, make navigation horizontally scrollable above the question without page-level horizontal overflow. Use cards only for true standalone result/dialog units.

- [ ] **Step 3: Apply typography and control hierarchy**

Use serif for question/solution prose and large headings, sans-serif for timer/navigation/inputs. Primary actions use dark ink on paper; work/comparison elements use the green rule; warnings use attention rust plus text/icon. Radii stay 4–6 px and focus rings remain visible.

- [ ] **Step 4: Redesign hub, grading, solution and formula dialog**

Hubb entries show subject, authentic exam structure and a direct start link without a marketing hero. Preserve chemistry zoom/pan/print behavior and the original image bytes. Keep manual score correction visually secondary and collapsed.

- [ ] **Step 5: Implement print styling**

Print white/black, hide navigation/timer/answer/grade/solution UI, retain concise notebook instruction and useful answer workspace, and preserve chemistry formula-sheet A4 isolation.

- [ ] **Step 6: Run static tests and commit**

Run: `node --test "KS Förberedelse/tests/subject-config.test.js" "KS Förberedelse/tests/static-pages.test.js"`

```bash
git add "KS Förberedelse/assets/app.css" "KS Förberedelse/index.html" "KS Förberedelse/Matematik KS2/index.html" "KS Förberedelse/Fysik KS1/index.html" "KS Förberedelse/Kemi KS/index.html" "KS Förberedelse/tests/subject-config.test.js" "KS Förberedelse/tests/static-pages.test.js"
git commit -m "style: apply academic journal interface"
```

---

### Task 13: Slutlig 795-vyrevision och kontaktkartor

**Files:**
- Create: `KS Förberedelse/tests/diagram-audit-page.html`
- Create: `KS Förberedelse/tests/diagram-audit-browser.js`
- Create: `KS Förberedelse/tests/diagram-audit-verify.js`
- Create: `KS Förberedelse/tests/diagram-audit.test.js`
- Create: `KS Förberedelse/tests/fixtures/diagram-audit-summary.json`
- Modify: `KS Förberedelse/assets/js/app.js`
- Modify: `KS Förberedelse/tests/static-pages.test.js`
- Modify: `.gitignore`

**Generated, ignored:**
- `.superpowers/diagram-audit/manifest.json`
- `.superpowers/diagram-audit/contact-sheets/*.png`
- `.superpowers/diagram-audit/prints/*.pdf`

- [ ] **Step 1: Write the failing audit-contract test**

Require exactly 150 prompt-SVG:er in all four modes plus 65 solution-only force figures in the three screen modes, for 795 records total. The test invokes the exported runner against a unique `fs.mkdtempSync(path.join(os.tmpdir(), "ks-diagram-audit-"))` directory and removes only that exact temporary directory after assertions, so a clean checkout does not depend on ignored prior output:

```js
const modes = ["desktop", "tablet", "mobile", "print"];
assert.equal(audit.records.filter((item) => item.purpose === "prompt").length, 150 * modes.length);
assert.equal(audit.records.filter((item) => item.purpose === "solution").length, 65 * 3);
assert.equal(audit.records.length, 795);
assert.equal(audit.records.filter((item) => item.failures.length).length, 0);
assert.deepEqual(audit.viewportByMode, {
  desktop: [1440, 900], tablet: [768, 1024], mobile: [390, 844], print: [794, 1123]
});
```

Run: `node --test "KS Förberedelse/tests/diagram-audit.test.js"`

Expected RED: the audit harness/output does not exist.

- [ ] **Step 2: Build the local audit page**

Load the real `assets/app.css`, `diagram-kit.js` and every math/physics slot script from relative `file://` paths. Render each SVG inside the same `.exam-layout`, `.question-screen`, `.prompt` and print containers used by the real app, at exact 1440×900, 768×1024, 390×844 and A4 794×1123 viewports. Wait for `document.fonts.ready` and two animation frames before measuring. The print run uses emulated print media and the real `@media print` rules. Never load network assets.

- [ ] **Step 3: Implement real-browser collision checks**

For each node compute the relative matrix

```js
const toRoot = rootSvg.getScreenCTM().inverse().multiply(node.getScreenCTM());
```

and transform all four local `getBBox()` corners through `toRoot`. Add regression fixtures containing nested `<g transform>` elements and the same SVG at different CSS widths. Use separating-axis polygon checks for transformed label boxes. For lines, polylines, polygons, circles and ellipses use exact segment/distance/interior tests; for arbitrary paths/arcs/arrowheads sample `getPointAtLength()` at no more than one rendered CSS pixel and combine it with `isPointInFill`/`isPointInStroke`. Do not reject from coarse axis-aligned geometry boxes alone.

Record failures for:

- label/label overlap beyond 1 px;
- label versus every non-anchor visible object in `geometry`, `connections` or `information`; only the label's manifest-verified anchor may be exempted;
- label or geometry outside viewBox;
- less than 6 rendered CSS px clearance between a label and non-anchor information;
- clipped text, screen text smaller than 12 CSS px or print text smaller than 10 pt;
- a prompt-root count other than exactly 25 math plus 125 physics SVGs or a solution-root count other than exactly 65 physics force diagrams;
- missing `role="img"`, malformed `aria-labelledby`, anything other than 215 globally unique title/description pairs, or any duplicate fragment ID including markers/clip paths;
- any manifest invariant rejected by `diagram-kit.validateManifest`.

Stroke width, explicit arrowhead/marker geometry and any label background rectangle participate in collision and viewBox checks. An opaque label background fails if its painted area intersects a semantically important line, arc, arrow or body, even when the text itself is clear. If layout evaluation throws, write a controlled failure record.

- [ ] **Step 4: Add controlled app failure handling**

Before creating/restoring a session, `app.js` calls `KS.diagram.validateManifest` for every prompt diagram. A broken manifest or diagram-render error shows `Diagrammet kunde inte visas korrekt. Dina sparade svar har inte ändrats.` and disables exam mutation controls. Add both DOM-harness and real `file://` tests proving the active snapshot/history bytes are not removed, overwritten or replaced and no new exam is created.

- [ ] **Step 5: Launch Chrome and create evidence**

`diagram-audit-browser.js` exports `runAudit({ outputDirectory, screenshots, pdfs })`, locates `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, uses an isolated `mkdtemp` profile, runs `--headless=new --allow-file-access-from-files`, and produces:

- one machine-readable record for each of the 795 prompt/solution/mode combinations;
- 24 prompt contact sheets grouped by math/physics slot and four modes, plus 9 solution sheets for physics slots 1, 4 and 5 in the three screen modes, with every variant visible;
- six real print PDFs: one for math slot 5 and one for each of physics slots 1–5.

Run: `node "KS Förberedelse/tests/diagram-audit-browser.js"`

Expected: exit 0, 795/795 records, 33 contact sheets and 6 print PDFs.

- [ ] **Step 6: Inspect every contact sheet and bind approval to sources**

Open each of the 33 PNGs and record reviewer, date and outcome. A sheet passes only after every visible variant has been checked for semantic correctness, covered numbers, angle placement, contact/tangent geometry, correct solution forces and legibility. Write the small tracked `fixtures/diagram-audit-summary.json` with 795 pass records, 33 reviewed sheets, 6 print PDFs, the exact Chrome version/platform/font-family metrics, stable decoded-pixel hashes for all 33 PNGs, fixed-DPI raster hashes for all six PDFs, and SHA-256 hashes of final `app.css`, `diagram-kit.js`, math slot 5, physics slots 1–5 and every audit harness file (`diagram-audit-page.html`, browser runner, verifier and test). PNG/PDF files remain ignored.

The runner computes PNG hashes from decoded width/height/RGBA scanlines, not metadata bytes. It rasterizes each PDF page at a fixed declared DPI with Poppler and hashes the decoded pixel stream, avoiding timestamps or PDF metadata.

Any correction returns to Tasks 8–12 and reruns the entire four-mode audit.

- [ ] **Step 7: Run hermetic audit and tracked-summary verification**

Run: `node --test "KS Förberedelse/tests/diagram-audit.test.js"`

The test runs all 795 DOM/invariant records with screenshots/PDFs disabled in its temporary output directory. The standalone command remains responsible for persistent ignored contact-sheet/PDF evidence.

Run: `node "KS Förberedelse/tests/diagram-audit-verify.js"`

The verifier creates a fresh temporary full-render set, then requires current source hashes, Chrome version/platform/font metrics, 33 contact-sheet pixel hashes and six print-raster hashes to equal the reviewed tracked summary. Any mismatch invalidates the recorded approvals and requires a new visual review before the summary may be updated.

Expected: fresh render hashes and current source/environment hashes match the reviewed tracked summary and every count is exact.

- [ ] **Step 8: Commit the harness and reviewed summary**

```bash
git add ".gitignore" "KS Förberedelse/assets/js/app.js" "KS Förberedelse/tests/diagram-audit-page.html" "KS Förberedelse/tests/diagram-audit-browser.js" "KS Förberedelse/tests/diagram-audit-verify.js" "KS Förberedelse/tests/diagram-audit.test.js" "KS Förberedelse/tests/fixtures/diagram-audit-summary.json" "KS Förberedelse/tests/static-pages.test.js"
git commit -m "test: audit all diagram variants in four modes"
```

---

### Task 14: Verkligt `file://`-flöde, mobil, utskrift och formelblad

**Files:**
- Create: `KS Förberedelse/tests/browser-flow-page-results.md`
- Modify: `KS Förberedelse/tests/static-pages.test.js`
- Modify: `KS Förberedelse/assets/js/app.js` only if a reproduced integration defect requires it.
- Modify: `KS Förberedelse/assets/app.css` only if a reproduced integration defect requires it.

- [ ] **Step 1: Run the full Node suite before browser work**

Run: `node --test "KS Förberedelse/tests"/*.test.js`

Expected: all tests pass.

- [ ] **Step 2: Exercise all three subjects in real Chrome**

First open the hub at 1440×900, 768×1024 and 390×844; verify all three subject links, semantic heading order, keyboard activation and `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

Then, for each subject through `file://`:

- open a fresh exam;
- jump from question 1 to the last question without answering;
- answer in non-sequential order, including a choice/radio field;
- reload and continue the compatible session;
- start/pause/reset the timer;
- submit with at least one blank answer and verify warning/lock;
- confirm solution is hidden until `Visa lösning`;
- reveal solution and verify non-interactive notebook comparison;
- adjust one auto-score and verify focus remains on the override button;
- start a new exam and verify no immediate repetition at shuffle-bag boundaries.

- [ ] **Step 3: Test incompatible recovery**

Seed a version-1 or changed-schema snapshot. Verify the Swedish migration message, no automatic overwrite, explicit replacement confirmation and preserved history queue.

- [ ] **Step 4: Fully exercise the chemistry formula-sheet dialog**

In real Chrome verify open/close, initial focus, Escape, focus return, zoom out/in limits, `Anpassa`, mouse/trackpad scrolling, arrow-key panning, separate print mode and that the displayed PNG dimensions/hash remain exact. Confirm dialog controls retain logical tab order at desktop and mobile sizes.

- [ ] **Step 5: Test responsive, accessibility and print modes**

Inspect hub and every subject at 1440×900, 768×1024 and 390×844. In page JavaScript assert `scrollWidth <= clientWidth`, no clipped focus target, every visible mobile control has a computed rectangle of at least 44×44 px, and actual Tab/Shift+Tab order follows the DOM and returns focus correctly after dialogs/rerenders. Compute WCAG contrast ratios from `getComputedStyle` foreground/background pairs for body text, muted text, links, buttons, focus indicators, work boxes, errors and result states; require 4.5:1 for normal text and 3:1 for large text/UI graphics. Print each subject exam and chemistry formula sheet; verify answers/facits are hidden, diagrams are readable and formula sheet is one unchanged A4 page.

- [ ] **Step 6: Record exact evidence**

Write `browser-flow-page-results.md` with Chrome version, date, tested local URLs, viewport matrix, console count, printed page counts and pass/fail for each flow. Do not claim a check that was not executed.

- [ ] **Step 7: Re-run affected tests, diagram hash verifier and commit**

Run: `node --test "KS Förberedelse/tests"/*.test.js`

Run: `node "KS Förberedelse/tests/diagram-audit-verify.js"`

If any integration fix changed CSS, diagram kit, a diagram bank or an audit script, the hash verifier must fail first; rerun all 795 views and visually reapprove all 33 contact sheets before updating the tracked summary.

```bash
git add "KS Förberedelse/tests/browser-flow-page-results.md" "KS Förberedelse/tests/static-pages.test.js" "KS Förberedelse/assets/js/app.js" "KS Förberedelse/assets/app.css"
git commit -m "test: verify complete offline exam flows"
```

---

### Task 15: Dokumentation, bevarandeaudit och slutverifiering

**Files:**
- Modify: `KS Förberedelse/README.md`
- Create: `docs/superpowers/reports/2026-09-12-ks-practice-redesign-verification.md`

- [ ] **Step 1: Update student instructions**

Replace `Rätta och självbedöma` with instructions stating that only final answers are entered/scored digitally, working/drawings go in the notebook, full methods appear after grade plus explicit reveal, and manual override is only for a correct final answer the parser failed to recognize.

- [ ] **Step 2: Run preservation counts and hashes**

Run the locked fixture test first, then the summary commands:

```bash
node --test "KS Förberedelse/tests/preservation.test.js"
node -e 'const fs=require("fs"); const path="KS Förberedelse"; const subjects=[["Matematik KS2",5],["Fysik KS1",5],["Kemi KS",6]]; let ids=[]; for(const [name,count] of subjects){for(let slot=1;slot<=count;slot+=1){const bank=require("./"+path+"/"+name+"/questions/slot-"+slot+".js"); ids=ids.concat(bank.map(q=>q.id));}} if(ids.length!==370||new Set(ids).size!==370) process.exit(1); console.log("370 unique question ids");'
shasum -a 256 "KS Förberedelse/Kemi KS/assets/formelblad-ks.png"
git diff --check
git status --short
```

Expected: all 370 current IDs match the pre-edit fixture exactly, all 18 ignored Underlag paths/hashes match the pre-edit fixture, formula sheet has the exact required hash, and there are no whitespace errors.

- [ ] **Step 3: Run all automated verification**

Run:

```bash
for file in "KS Förberedelse/assets/js"/*.js "KS Förberedelse/Matematik KS2/questions"/*.js "KS Förberedelse/Fysik KS1/questions"/*.js "KS Förberedelse/Kemi KS/questions"/*.js; do node --check "$file" || exit 1; done
node --test "KS Förberedelse/tests"/*.test.js
node "KS Förberedelse/tests/diagram-audit-browser.js"
node --test "KS Förberedelse/tests/diagram-audit.test.js"
node "KS Förberedelse/tests/diagram-audit-verify.js"
```

Expected: syntax clean, all Node tests green, 150 promptdiagram × 4 modes plus 65 solution figures × 3 screen modes = 795 successful records, 33/33 visually approved contact sheets, 6/6 print PDFs and current source hashes equal the reviewed summary.

- [ ] **Step 4: Write the final verification report**

Record exact question/field/type totals, exam point totals, test pass count, Chrome flows, diagram counts, 795-view collision outcome, 33-sheet human review outcome, print results, formula hash and `Underlag` status. List every fixed diagram family; leave no unresolved critical or important finding.

- [ ] **Step 5: Request independent code/design review**

Use `superpowers:requesting-code-review`. Reviewer must compare implementation to the redesign spec, inspect the verification evidence, independently sample generated exams, and inspect all contact-sheet approval records. Address every critical/important finding and rerun affected plus full verification.

- [ ] **Step 6: Commit documentation and evidence**

```bash
git add "KS Förberedelse/README.md" "docs/superpowers/reports/2026-09-12-ks-practice-redesign-verification.md"
git commit -m "docs: record KS redesign verification"
```

- [ ] **Step 7: Final branch handoff**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Do not merge, push or delete the worktree without the user's explicit choice.
