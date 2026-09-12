# SDD ledger — plan: docs/superpowers/plans/2026-09-12-ks-practice-redesign-implementation.md

## Setup

- Worktree: `/Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice`
- Branch: `codex/ks-practice`
- Plan start HEAD: `c01d097`
- Merge base with `main`: `d6c9ff9`
- Baseline: 182 tests passed, 0 failed; output pristine.
- Spec reachable: `docs/superpowers/specs/2026-09-12-ks-practice-redesign.md`.

## Preflight self-consistency scan

| Task | Tests versus implementation | Files now versus later | Finding / ruling |
|---|---|---|---|
| 0 | Preservation test covers exact IDs and ignored Underlag hashes. | Produces fixtures consumed by Tasks 4–11 and 15. | Finding: plan orders fixture generation before its RED test. Ruling: write the test first, run missing-fixture RED, then create fixtures — this restores the global TDD rule — cost if wrong: only the baseline task order changes, not the fixture values. |
| 1 | Choice/error cases and `workOnPaper` validation directly cover grader/engine changes. | Produces field contract for Tasks 2–6. | Consistent. |
| 2 | Snapshot signature and recovery tests cover schema v2 plus migration copy. | Produces `inspectSnapshot` used by Tasks 3, 13 and 14. | Consistent. |
| 3 | DOM tests cover radio storage, notebook placement, solution gating and focus. | Produces DOM/CSS hooks restyled in Task 12 and audited in Tasks 13–14. | Consistent. |
| 4 | Bank-wide math tests cover all 125 questions and unchanged answers/IDs. | Slot 5 is later rebuilt by Task 8. | Consistent; Task 8 must preserve Task 4 metadata. |
| 5 | Bank-wide physics tests cover removal of all 65 self fields and all 125 numeric scores. | All five files are later rebuilt by Tasks 9–11. | Consistent; later diagram tasks must preserve final-answer fields and notebook metadata. |
| 6 | Chemistry and cross-subject tests cover all 370 final-answer contracts. | Chemistry HTML is later restyled; banks are otherwise stable. | Consistent. |
| 7 | Pure geometry/a11y tests cover the new UMD kit and script loading. | Kit is consumed by Tasks 8–11 and audited in Task 13. | Consistent. |
| 8 | Five math-family invariants cover all 25 prompt diagrams. | Output is consumed and hash-bound by Task 13. | Consistent. |
| 9 | Slot 1–2 invariants plus all five UMD wrappers cover 50 prompt and 15 solution figures. | Wrapper edits precede geometry work in Tasks 10–11. | Consistent; Task 9 review range must account for deliberate wrapper-only changes in slots 3–5. |
| 10 | Slot 3–4 invariants cover 50 prompt and 25 solution figures. | Shares physics tests and slot wrappers with Tasks 9/11. | Consistent; preserve Task 9 wrapper/API. |
| 11 | Slot 5 invariants cover 25 prompt and 25 solution figures and final 125/65 totals. | Output is consumed and hash-bound by Task 13. | Consistent. |
| 12 | Static token/layout/print tests cover final CSS and HTML structure. | Must precede Task 13 because CSS/font metrics affect diagram pixels. | Consistent; order is correct. |
| 13 | Hermetic browser audit covers 795 records; tracked summary binds sources/environment/pixels. | Produces verifier/evidence used by Tasks 14–15. | Consistent. |
| 14 | Real Chrome flow covers hub, subjects, formula dialog, recovery, keyboard, contrast and print. | May touch CSS/app and therefore invalidate Task 13 hashes. | Consistent because task explicitly requires rerunning and reapproving Task 13 evidence after such a change. |
| 15 | Preservation, full suite, browser audit, hash verifier and report cover completion claims. | Final task only. | Consistent. |

## Preflight shared-file/interface scan

| Producer task → consumer task(s) | Shared file or interface | Finding / ruling |
|---|---|---|
| 0 → 4, 5, 8, 9, 10, 11, 15 | `question-ids.json`, `underlag-sha256.txt`, preservation test | Exact baseline dependency; no conflict. |
| 1 → 2, 3, 6, 15 | `choice`, strict field validation, `workOnPaper`, grading/engine tests | Additive contract; no conflict. |
| 1 ↔ 2 | `exam-engine.js`, `exam-engine.test.js` | Task 2 builds schema v2 on Task 1 field validation; sequential and compatible. |
| 1 ↔ 6 | `grading.test.js`, `exam-engine.test.js`, choice grader | Task 6 consumes rather than rewrites the contract; no conflict. |
| 2 ↔ 3 | `app.js`, `static-pages.test.js`, snapshot view | Task 3 renders schema-v2 sessions; preserve migration path. |
| 2 → 13, 14 | `inspectSnapshot`, recovery behavior | Later browser failure/recovery tests consume the exact reason API; no conflict. |
| 3 ↔ 12 | `app.css`, DOM class structure, `static-pages.test.js` | Task 12 restyles but must not remove semantic hooks; no conflict. |
| 3 ↔ 13, 14 | `app.js`, solution gating, focus and DOM controls | Audits/flows consume behavior; later fixes must retain Task 3 tests. |
| 4 ↔ 8 | Math slot 5 and `math-questions.test.js` | Task 8 replaces only diagrams and preserves answers/paper metadata; no conflict. |
| 4 → 13, 15 | Math bank IDs/metadata | Read-only consumption; no conflict. |
| 5 ↔ 9, 10, 11 | Physics banks and `physics-questions.test.js` | Diagram rewrites occur after score conversion and must keep all final-answer data; no conflict. |
| 5 → 13, 15 | Physics bank IDs/metadata | Read-only consumption; no conflict. |
| 6 → 14, 15 | Chemistry choices, paper metadata and final-answer test | Real browser/final verification consume them; no conflict. |
| 7 ↔ 8, 9, 10, 11 | `diagram-kit.js` UMD API and manifests | All diagram tasks use the declared kit interface; no conflict. |
| 7 ↔ 12 | Subject HTML script order and `static-pages.test.js` | Task 12 may change markup/style but must retain exact script order; no conflict. |
| 7 ↔ 13 | Kit validation, app preflight, audit page and static tests | Task 13 consumes the kit and adds controlled app errors; no conflict. |
| 8, 9, 10, 11 → 13 | 150 prompt + 65 solution manifests | Audit is downstream and hash-bound; no conflict. |
| 9 ↔ 10 ↔ 11 | Physics wrappers/files and common test file | Deliberate sequential ownership; each review base is the previous task HEAD. |
| 12 → 13 | Final `app.css`, real containers and print rules | Critical order dependency resolved before execution; no conflict. |
| 12 ↔ 14 | `app.css`, subject/hub HTML, static tests | Browser-found fixes are allowed but invalidate Task 13 evidence; rerun required. |
| 13 ↔ 14 | `app.js`, `static-pages.test.js`, audit verifier | Task 14 consumes controlled diagram errors and must rerun hash verifier after edits. |
| 13 → 15 | audit summary, browser runner, verifier | Final report consumes exact reviewed evidence; no conflict. |
| 14 → 15 | browser-flow evidence | Final report consumes exact executed results; no conflict. |

## Preflight rulings

- Ruling: Task 0 uses TDD order `test → missing-fixture RED → fixtures → GREEN`, despite the brief's prose ordering — restores the plan's global TDD contract — cost if wrong: implementation order only.
- Ruling: Fixture contents must be written with `apply_patch`; the plan's shell redirection is treated as a value-generation example only — required by workspace file-edit constraints — cost if wrong: mechanical fixture creation is slower but bytes remain reviewable.

## Task progress

- Task 0: fix round 1/5 (2 addressed, 0 open — recursive Underlag traversal; POSIX fixture paths; commit `cc3373a`)
- Task 0: complete (commits `c01d097..cc3373a`, review clean)
- Task 1: Ruling: defer the final `self`-field rejection switch/test to Task 6, after physics and chemistry banks have been converted — otherwise Task 1 deliberately makes the still-shipped legacy banks invalid and prevents a green full suite through Tasks 2–5; Task 1 still adds `choice`, its validation/grader, and `workOnPaper` validation now — cost if wrong: the branch permits legacy `self` fields during intermediate commits, but Task 6 is load-bearing and cannot complete until strict rejection plus the 370-question zero-self contract is green.
- Task 1: complete (commits `cc3373a..e519e1a`, review clean under recorded staged-self ruling)
- Task 2: fix round 1/5 (1 addressed, 0 open — saved active/graded schema changes now classify as `field-schema-mismatch`; commit `2bd14b0`)
- Task 2: complete (commits `e519e1a..2bd14b0`, scoped re-review clean)
- Execution-order ruling: run Tasks 4, 5 and 6 before Task 3. Task 3 removes the shipped self-assessment rendering path, while the current physics and chemistry banks still contain 135 legacy `self` fields; converting all banks and activating Task 6's hard rejection first avoids a knowingly broken intermediate application and lets Task 3 implement only the final field contract. Dependencies remain valid because Tasks 4–6 consume Task 1's engine contract and do not depend on Task 3 DOM work. Cost if wrong: UI implementation is delayed by three tasks, with no change to the final deliverable.
- Task 4: fix round 1/5 (2 addressed, 0 open — family-specific notebook audit and HTML-normalized forbidden-prompt audit; commit `8c97270`)
- Task 4: fix round 2/5 (1 addressed, 0 open — Swedish `redogör`/`beskriv`/`skriv hur` reasoning forms; commit `3c05c0a`)
- Task 4: complete (commits `2bd14b0..3c05c0a`, scoped re-review clean)
- Task 5: fix round 1/5 (2 addressed, 0 open — commit-anchored per-question semantic baseline and normalized prompt-language audit; commit `e5a8115`)
- Task 5: fix round 2/5 (3 addressed, 0 open — clause-aware destination audit and duplicate report removal; commit `7638cce`)
- Task 5: fix round 3/5 (2 addressed, 0 open — plural/passive drawing terms and masking cases; commit `b10b286`)
- Task 5: fix round 4/5 (1 addressed, 0 open — action-intent versus display-only classification; commit `71d208a`)
- Task 5: fix round 5/5 (1 addressed, 0 open — generic diagram display versus submitted student work; commit `994cdad`)
- Task 5: complete (commits `3c05c0a..994cdad`, final scoped re-review clean)
- Task 6: ruling — activate the deferred hard rejection after converting all chemistry fields: `validateExamData` now rejects every delivered `self` field and any `multiline` property before history/RNG/active storage side effects. Parser uncertainty may still produce result status `self` for an objective field and remains manually overridable; this is not a shipped self field.
- Task 6: complete (chemistry slots 1–6 converted, cross-subject final-answer contract added, commit `fba2a74`, report verification clean)
- Task 6: fix round 1 complete (UI rendering findings deferred to Task 3 by ruling; independent Bohr/geometry/polarity/bond truth tables, declared wrong choice alternatives, explicit non-Bohr notebook wording, and uncertain-objective snapshot regression; commit `9c2855b`)
- Task 6: complete after scoped re-review (commits `994cdad..9c2855b`, review clean under recorded Task 3 UI deferral)
- Task 3: fix round 1/5 (2 addressed, 0 open — Swedish choice labels in graded UI and native radio restoration coverage; commit `72cc030`)
- Task 3: complete (commits `9c2855b..72cc030`, scoped re-review clean)
- Task 7: fix round 1/5 (namespace, C1 coupling, provenance, paint metadata, IDs, anchors and baseline guards improved; 7 finding groups remained; commit `d969d6b`)
- Task 7: fix round 2/5 (multi-arrow markers, dimensions, deep projections, semantic anchors, atomic reservation improved; 6 concrete repro groups remained; commit `cc2f273`)
- Task 7: fix round 3/5 (mutated-provenance bypass, canonical reconstruction, DOM IDs, vector sides, overflow and reservation addressed; 3 finding groups remained; commit `938e0f1`)
- Task 7: fix round 4/5 (extra-turn rope and raw-path command handling addressed; 3 findings remained: whole-path crossing, exact total tamper, omitted side; commit `843215c`)
- Task 7: fix round 5/5 (whole-path crossing and omitted side addressed; 2 findings remained: public provenance bypass and scale-dependent rope tolerances/fuzz; commit `744b35c`)
- Task 7: Ruling: the public truthy `validateManifest(manifest, internal)` bypass is real and load-bearing for Task 13's runtime/audit gate; Task 8 must remove the public bypass by using a closure-private validator or unforgeable sentinel before any bank integration — cost if wrong: Task 8 expands into a small shared-kit/test edit, but proceeding without it would let consistently rewritten manifests pass validation.
- Task 7: Ruling: the absolute cross-product epsilon and weak fixed-scale fuzz are real; although shipped diagrams use ordinary coordinate scales, Task 8 must normalize intersection tolerances by geometric scale and add multi-scale named/vector-side fuzz with minimum successes plus C1, orthogonality, length, side, penetration and crossing assertions — cost if wrong: additional geometry work precedes math migration, but it prevents a latent scale-dependent contract failure.
- Task 7: complete at breaker cap (commits `72cc030..744b35c`; two adjudicated load-bearing findings carried into Task 8)
- Task 8: completed both Task 7 carryovers before integration (public manifest bypass removed; scale-aware rope tolerances and substantive multiscale fuzz added; commit `585defd`)
- Task 8: fix round 1/5 (2 addressed, 0 open — exact all-geometry label collision audit and complete angle-ray/right-marker invariants; commit `494be95`)
- Task 8: fix round 2/5 (2 addressed, 0 open — complete non-owner avoid sets and local semantic label zones; commit `5f49b0a`)
- Task 8: complete (commits `744b35c..5f49b0a`, scoped re-review clean)
- Task 9: Ruling: Task 5's semantic fixture currently hashes complete `solutionHtml`, while Task 9 intentionally appends 15 generated solution-only force diagrams. Task 9 may update the preservation projection/fixture only to normalize out kit-generated diagram SVG/manifest additions; the surrounding solution prose, rubric, final-answer fields, units, tolerances and notebook metadata remain anchored to the pre-Task-9 baseline — cost if wrong: the preservation helper becomes slightly more complex, but otherwise the required solution figures and the existing exact solution hash cannot coexist.
- Task 9: fix round 1/5 (3 addressed, 0 open — moment-balanced solution force lines, true three-axis prisms and manifest-derived invariants; commit `f4b1aab`)
- Task 9: complete (commits `5f49b0a..f4b1aab`, scoped re-review clean)
- Task 10: fix round 1/5 (3 addressed, 0 open — shared prompt/solution force origins, sector-bound angle labels and truthful zero-height geometry; commit `3ba5259`)
- Task 10: parked — the report's earlier narrative still says hanging tension placement is mass-weighted — Ruling: the appended corrective section and reviewed code/tests explicitly supersede that stale report sentence, so this ignored coordination artifact does not affect shipped behavior or downstream interfaces — cost if wrong: a future reader could momentarily misread the earlier paragraph before reaching the corrective section.
- Task 10: complete (commits `f4b1aab..3ba5259`, scoped re-review approved)
- Task 11: complete (commits `3ba5259..2bb1648`, review clean)
- Task 12: Ruling: source-level responsive/print contract assertions belong to Task 12 exactly as planned, while computed 44×44 targets, real scrollWidth, cascade/dialog state and print visibility are explicitly owned by Task 14's real-Chrome flow. The reviewer observation is valid but deferred to Task 14 rather than duplicating a partial browser harness in Task 12 — cost if wrong: Task 12 alone cannot substantiate runtime layout claims, so Task 14 is load-bearing and must not complete without those computed checks.
- Task 12: fix round 1/5 (2 addressed, 0 open — active-control contrast and semantic warning/status tones; commit `6c1ce90`)
- Task 12: fix round 2/5 (3 addressed, 0 open — compound flagged/current state, disabled hover and complete grade tones; commit `f33ed20`)
- Task 12: complete (commits `2bb1648..f33ed20`, scoped re-review clean; computed responsive/print checks carried to Task 14 by ruling)
- Task 13: initial implementation complete (hermetic four-mode diagram audit, controlled app preflight, persistent reviewed evidence and exact source/environment/raster binding; commit `b755b7a`)
- Task 13: fix round 1 complete (true CTM-scaled font thresholds, exact geometry/background/marker checks, strict rendered-root/app reconciliation, finite-sector angle labels and launch cleanup regressions; commit `9c20916`)
- Task 13: fix round 2 complete (transformed ellipse/path/polygon/marker collision gaps, spoofed-owner rejection, exact painted ellipse extents and recursive regression gate; commit `422f007`)
- Task 13: fix round 3 complete (browser-native SVG fill/stroke truth, 0.25/0.5 CSS-pixel paint probing, exact DOM semantic-layer reconciliation and `auditSvg`-owned root gate; commit `998df99`)
- Task 13: complete (commits `b755b7a..998df99`, independent scoped review approved; 795/795 records pass; 33 contact sheets; 6 PDFs/150 pages; 14 negative + 2 positive regressions; full suite 283/283; fresh verifier exact)
