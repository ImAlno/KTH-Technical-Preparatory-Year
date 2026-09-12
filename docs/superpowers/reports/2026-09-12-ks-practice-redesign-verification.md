# KS practice redesign — final verification

Date: 2026-09-12  
Outcome: pass

## Delivered assessment model

Only short final answers are entered and scored digitally. Calculations, proofs, explanations, Bohr/electron drawings and force diagrams remain notebook work. Full methods and notebook-comparison points appear only after grading and an explicit `Visa lösning` action. Manual override remains available only for a genuinely correct final answer that the parser did not recognize.

## Preserved content and scoring

| Subject | Questions | Answer fields | Field kinds | Exam points |
|---|---:|---:|---|---:|
| Mathematics KS2 | 125 | 150 | 100 solution-set, 25 simplified-expression, 25 numeric | 10 |
| Physics KS1 | 125 | 125 | 125 numeric | 10 |
| Chemistry KS | 120 | 320 | 106 numeric, 30 aliases, 24 chemical-formula, 40 chemical-equation, 120 choice | 20 |
| **Total** | **370** | **595** | all objective final-answer fields | **10 / 10 / 20** |

The locked preservation test passed 3/3. All 370 question IDs are unique and match the baseline fixture. All 18 recursively discovered `KS Förberedelse/Underlag` paths and SHA-256 values match the baseline fixture exactly. The chemistry formula sheet remains 2481×3508 and byte-identical at SHA-256 `e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee`.

## Diagram correction inventory

The 25 mathematics prompt diagrams cover five corrected families: `right-triangle`, `non-right-triangle-area`, `parallel-transversal`, `composite-quadrilateral` and `symmetric-construction`. Corrections included finite-sector angle placement, local point labels, separated cut dimensions and labels, exact parallel/contact geometry, and extension gaps that prevent helper lines from covering labels.

The 125 physics prompt diagrams cover 22 corrected families: `graph-interpretation`, `contact-equilibrium`, `cylinder`, `cone`, `sphere`, `prism`, `liquid-column`, `time-to-apex`, `maximum-height`, `initial-speed`, `impact-speed`, `flight-time`, `hanging-masses`, `cables-at-angles`, `missing-fourth-force`, `supported-beams`, `frictionless-wall-contact`, `horizontal-pull`, `unknown-friction`, `unknown-pull`, `inclined-plane` and `connected-masses`.

The 65 solution-only force figures cover 11 families: `contact-equilibrium`, `hanging-masses`, `cables-at-angles`, `missing-fourth-force`, `supported-beams`, `frictionless-wall-contact`, `horizontal-pull`, `unknown-friction`, `unknown-pull`, `inclined-plane` and `connected-masses`. Reviewed fixes include exact ground/support/body contact, scale-correct dimensions, rope tangency and continuity, physical incline placement, separated force shafts, correct application points, force/component balance and signed moment balance. Prompt figures do not reveal a force diagram the student must construct.

The sealed real-Chrome diagram audit passed 795/795 records: 600 prompt renders (150 roots across desktop, tablet, mobile and print) and 195 solution renders (65 roots across three screen modes). It contains 215 globally unique accessible diagrams, zero collision/clipping/invariant failures, 33/33 visually approved contact sheets, and 6/6 approved PDFs covering 150 raster-inspected pages. The fresh verifier returned `{"records":795,"contactSheets":33,"printPdfs":6,"matched":true}`.

## Responsive browser and print evidence

The final persistent `file://` flow passed 316/316 leaves across 12/12 page/viewport combinations and 24 mobile runtime states. It audited 541 focus paints, 2,567 contrast samples and 14 radio cases with zero overflow, touch-target, focus, contrast, external-network or console failures. Complete forward/reverse keyboard counts were hub 3/3 at all three widths; mathematics 14/14 at all widths; physics 14/14 desktop and 15/15 tablet/mobile including the native scroll-region stop; chemistry 19/19 at all widths. The formula dialog passed 7/7 forward and reverse stops on desktop and mobile.

Real print flows produced 5/5 A4 mathematics pages, 5/5 A4 physics pages, 6/6 A4 chemistry pages and one A4 formula-sheet page. Every MediaBox and CropBox was `[0, 0, 594.96, 841.92]`. Screen-only controls, submitted answers, grades, solutions, comparisons and override controls were present before printing and hidden in print output; formula-only print hid existing non-formula content and retained the exact embedded source pixels.

## Final commands

- JavaScript syntax checks: pass for every shared app module and every subject slot module.
- Full Node suite: 287 passed, 0 failed, 0 skipped; 15.747 s.
- Preservation suite: 3 passed, 0 failed; 370 unique IDs; 18 exact Underlag hashes.
- Diagram seal verifier: 795 records, 33 contact sheets, 6 PDFs, exact match.
- Formula SHA-256: exact.
- `git diff --check`: pass.

Task 13's complete visual audit and Task 14's browser/accessibility flow each received independent scoped review rounds, and all critical/important findings from those rounds were fixed and reverified. At the user's explicit cutoff, another independent whole-branch review was skipped; this report does not claim that unperformed review. There are no unresolved critical or important findings in the executed verification scope.

