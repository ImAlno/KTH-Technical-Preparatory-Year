# Real Chrome file-flow evidence

- Date: 2026-09-12T17:49:46.271Z
- Chrome: Chrome/152.0.7977.83
- Revision: @79460ebecaa5625e57a5fb679a735659e73dc687
- Protocol: 1.3
- Harness: `node "KS Förberedelse/tests/browser-flow-browser.js"`
- Isolated temporary profile: yes (removed in `finally`)
- External network requests: 0
- Console/application errors: 0

## Local URLs

- `file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html`
- `file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Matematik%20KS2/index.html`
- `file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Fysik%20KS1/index.html`
- `file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Kemi%20KS/index.html`

## Viewport matrix

| Page | Viewport | Size | Overflow | Mobile target failures | Clipped focus targets | Contrast failures |
|---|---:|---:|---:|---:|---:|---:|
| Hubb | desktop | 1440×900 | 0 | 0 | 0 | 0 |
| Hubb | tablet | 768×1024 | 0 | 0 | 0 | 0 |
| Hubb | mobile | 390×844 | 0 | 0 | 0 | 0 |
| Matematik KS2 | desktop | 1440×900 | 0 | 0 | 0 | 0 |
| Matematik KS2 | tablet | 768×1024 | 0 | 0 | 0 | 0 |
| Matematik KS2 | mobile | 390×844 | 0 | 0 | 0 | 0 |
| Fysik KS1 | desktop | 1440×900 | 0 | 0 | 0 | 0 |
| Fysik KS1 | tablet | 768×1024 | 0 | 0 | 0 | 0 |
| Fysik KS1 | mobile | 390×844 | 0 | 0 | 0 | 0 |
| Kemi KS | desktop | 1440×900 | 0 | 0 | 0 | 0 |
| Kemi KS | tablet | 768×1024 | 0 | 0 | 0 | 0 |
| Kemi KS | mobile | 390×844 | 0 | 0 | 0 | 0 |

Native radio/checkbox controls are measured through their associated visible label hit area. Disabled controls remain in touch-size and contrast inventories; only disabled, inert, closed-disclosure and modal-background controls are excluded from keyboard/focus traversal.

## Complete keyboard traversal

### layout_hub_desktop

- Inventory: `{"link":3,"questionNav":0,"answer":0,"primary":0,"timer":0,"formulaTrigger":0}`
- Forward (3): `["a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Matematik%20KS2/index.html\"]@0:Starta provet","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Fysik%20KS1/index.html\"]@1:Starta provet","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Kemi%20KS/index.html\"]@2:Starta provet"]`
- Reverse (3): `["a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Kemi%20KS/index.html\"]@2:Starta provet","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Fysik%20KS1/index.html\"]@1:Starta provet","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/Matematik%20KS2/index.html\"]@0:Starta provet"]`

### layout_math_desktop

- Inventory: `{"link":1,"questionNav":5,"answer":1,"primary":1,"timer":2,"formulaTrigger":0}`
- Forward (14): `["a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html\"]@0:Alla ämnen","button#timer-start@1:Starta","button#timer-reset@3:Återställ","button#history-open@4:Rensa historik","button#print-exam@6:Skriv ut prov","button@7:Uppgift 1, obesvarad","button@8:Uppgift 2, obesvarad","button@9:Uppgift 3, obesvarad","button@10:Uppgift 4, obesvarad","button@11:Uppgift 5, obesvarad","button@13:Markera","input#answer-math-s1-sqrt-equals-linear-02-roots[name=\"roots\"]@14","button@16:Rätta provet","button@17:Nästa"]`
- Reverse (14): `["button@17:Nästa","button@16:Rätta provet","input#answer-math-s1-sqrt-equals-linear-02-roots[name=\"roots\"]@14","button@13:Markera","button@11:Uppgift 5, obesvarad","button@10:Uppgift 4, obesvarad","button@9:Uppgift 3, obesvarad","button@8:Uppgift 2, obesvarad","button@7:Uppgift 1, obesvarad","button#print-exam@6:Skriv ut prov","button#history-open@4:Rensa historik","button#timer-reset@3:Återställ","button#timer-start@1:Starta","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html\"]@0:Alla ämnen"]`

### layout_physics_desktop

- Inventory: `{"link":1,"questionNav":5,"answer":1,"primary":1,"timer":2,"formulaTrigger":0}`
- Forward (14): `["a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html\"]@0:Alla ämnen","button#timer-start@1:Starta","button#timer-reset@3:Återställ","button#history-open@4:Rensa historik","button#print-exam@6:Skriv ut prov","button@7:Uppgift 1, obesvarad","button@8:Uppgift 2, obesvarad","button@9:Uppgift 3, obesvarad","button@10:Uppgift 4, obesvarad","button@11:Uppgift 5, obesvarad","button@13:Markera","input#answer-physics-s1-graph-10-answer[name=\"answer\"]@14","button@16:Rätta provet","button@17:Nästa"]`
- Reverse (14): `["button@17:Nästa","button@16:Rätta provet","input#answer-physics-s1-graph-10-answer[name=\"answer\"]@14","button@13:Markera","button@11:Uppgift 5, obesvarad","button@10:Uppgift 4, obesvarad","button@9:Uppgift 3, obesvarad","button@8:Uppgift 2, obesvarad","button@7:Uppgift 1, obesvarad","button#print-exam@6:Skriv ut prov","button#history-open@4:Rensa historik","button#timer-reset@3:Återställ","button#timer-start@1:Starta","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html\"]@0:Alla ämnen"]`

### layout_chemistry_desktop

- Inventory: `{"link":1,"questionNav":6,"answer":4,"primary":1,"timer":2,"formulaTrigger":1}`
- Forward (19): `["a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html\"]@0:Alla ämnen","button#timer-start@1:Starta","button#timer-reset@3:Återställ","button#history-open@4:Rensa historik","button#formula-open@5:Formelblad","button#print-exam@6:Skriv ut prov","button@7:Uppgift 1, obesvarad","button@8:Uppgift 2, obesvarad","button@9:Uppgift 3, obesvarad","button@10:Uppgift 4, obesvarad","button@11:Uppgift 5, obesvarad","button@12:Uppgift 6, obesvarad","button@14:Markera","input#answer-chemistry-s1-atomic-10-isotope[name=\"isotope\"]@15","input#answer-chemistry-s1-atomic-10-term[name=\"term\"]@16","input#answer-chemistry-s1-atomic-10-shells[name=\"shells\"]@17","input#answer-chemistry-s1-atomic-10-ion[name=\"ion\"]@18","button@20:Rätta provet","button@21:Nästa"]`
- Reverse (19): `["button@21:Nästa","button@20:Rätta provet","input#answer-chemistry-s1-atomic-10-ion[name=\"ion\"]@18","input#answer-chemistry-s1-atomic-10-shells[name=\"shells\"]@17","input#answer-chemistry-s1-atomic-10-term[name=\"term\"]@16","input#answer-chemistry-s1-atomic-10-isotope[name=\"isotope\"]@15","button@14:Markera","button@12:Uppgift 6, obesvarad","button@11:Uppgift 5, obesvarad","button@10:Uppgift 4, obesvarad","button@9:Uppgift 3, obesvarad","button@8:Uppgift 2, obesvarad","button@7:Uppgift 1, obesvarad","button#print-exam@6:Skriv ut prov","button#formula-open@5:Formelblad","button#history-open@4:Rensa historik","button#timer-reset@3:Återställ","button#timer-start@1:Starta","a[href=\"file:///Users/alno/Documents/GitHub/KTH-Technical-Preparatory-Year/.worktrees/ks-practice/KS%20F%C3%B6rberedelse/index.html\"]@0:Alla ämnen"]`

### Formula dialog wrap

- desktop forward (7): `["formula-content","formula-zoom-out","formula-zoom-in","formula-fit","print-formula","Stäng","formula-content"]`
- desktop reverse (7): `["formula-content","Stäng","print-formula","formula-fit","formula-zoom-in","formula-zoom-out","formula-content"]`
- mobile forward (7): `["formula-content","formula-zoom-out","formula-zoom-in","formula-fit","print-formula","Stäng","formula-content"]`
- mobile reverse (7): `["formula-content","Stäng","print-formula","formula-fit","formula-zoom-in","formula-zoom-out","formula-content"]`

## Mobile runtime-state matrix

| State | Radio cases | Touch targets | Touch failures | Focus paints | Focus failures | Contrast samples | Contrast failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| state_math_active | 0 | 17 | 0 | 14 | 0 | 53 | 0 |
| state_math_timer_warning | 0 | 17 | 0 | 14 | 0 | 58 | 0 |
| state_math_active_flagged | 0 | 17 | 0 | 14 | 0 | 53 | 0 |
| state_math_flagged_other | 0 | 17 | 0 | 15 | 0 | 58 | 0 |
| state_math_graded | 0 | 17 | 0 | 12 | 0 | 65 | 0 |
| state_math_solution | 0 | 17 | 0 | 12 | 0 | 69 | 0 |
| state_math_override_open | 0 | 22 | 0 | 17 | 0 | 119 | 0 |
| state_math_override_success | 0 | 22 | 0 | 17 | 0 | 119 | 0 |
| state_physics_active | 0 | 17 | 0 | 14 | 0 | 53 | 0 |
| state_physics_active_flagged | 0 | 17 | 0 | 14 | 0 | 53 | 0 |
| state_physics_flagged_other | 0 | 17 | 0 | 15 | 0 | 58 | 0 |
| state_physics_graded | 0 | 17 | 0 | 12 | 0 | 65 | 0 |
| state_physics_solution | 0 | 17 | 0 | 12 | 0 | 69 | 0 |
| state_physics_override_open | 0 | 22 | 0 | 17 | 0 | 119 | 0 |
| state_physics_override_success | 0 | 22 | 0 | 17 | 0 | 119 | 0 |
| state_chemistry_active | 0 | 22 | 0 | 19 | 0 | 69 | 0 |
| state_chemistry_active_flagged | 0 | 22 | 0 | 19 | 0 | 69 | 0 |
| state_chemistry_flagged_other | 0 | 21 | 0 | 19 | 0 | 69 | 0 |
| state_chemistry_choice | 7 | 25 | 0 | 23 | 0 | 71 | 0 |
| state_chemistry_formula_open | 0 | 6 | 0 | 6 | 0 | 137 | 0 |
| state_chemistry_graded | 0 | 19 | 0 | 14 | 0 | 69 | 0 |
| state_chemistry_solution | 0 | 19 | 0 | 14 | 0 | 73 | 0 |
| state_chemistry_override_open | 0 | 28 | 0 | 23 | 0 | 163 | 0 |
| state_chemistry_override_success | 0 | 28 | 0 | 23 | 0 | 163 | 0 |

Each runtime row also enforced its state-specific nonzero role inventory. Inventories include active text fields, chemistry radios, current/flagged navigation, formula controls, warning/success grades, result, revealed solution/comparison, override disclosure and manual score controls. Focus paint uses computed outline width plus offset and outer box-shadow extents against viewport and clipping ancestors; every visible focus indicator is tested at 3:1.

Runtime contrast inventory totals: `{"body":24,"muted":126,"link":24,"primary":13,"secondary":188,"answer_control":32,"disabled":67,"current_nav":21,"current_flagged_nav":3,"flagged_nav":3,"work":24,"comparison":9,"solution":9,"grade_warning":9,"grade_success":3,"result":12,"status_warning":1,"status_success":12,"radio":14,"formula_control":5,"override_control":50}`. Every visible instance was tested; normal text uses 4.5:1, large text and each required UI boundary side/graphic use 3:1.

## Functional flows

| Subject | Questions | Non-sequential answered positions | Boundary repeat failures | Result |
|---|---:|---:|---:|---:|
| Matematik KS2 | 5 | 3 | 0 | pass |
| Fysik KS1 | 5 | 3 | 0 | pass |
| Kemi KS | 6 | 4 | 0 | pass |

Both version-1 and changed-field-schema recovery cases used exact, nonempty two-item sentinel queues plus nonempty lastId values for every slot. The harness deep-compared the exact serialized active/history values after reload and first confirmation, then compared the exact expected one-item queues/new lastIds after replacement.

## Print evidence

| Artifact | Pages | A4 MediaBox + CropBox pages | PDF | First-page decoded raster |
|---|---:|---:|---|---|
| Matematik KS2 | 5 | 5 | `prints/math-exam.pdf` | 794×1123, `cb0f9651b8142fb97d08f0d5ae09b8904c0583fa4473157d532ea28c62aeeb57` |
| Fysik KS1 | 5 | 5 | `prints/physics-exam.pdf` | 794×1123, `19a2c7ee0f61ae143ff51b892681abec77d75be0d9f46ccb73eb9f80bd6354b2` |
| Kemi KS | 6 | 6 | `prints/chemistry-exam.pdf` | 794×1123, `09b6c83a0bba80700b0f5da894a3136f20671f8af1c9c108228f932172d76f92` |
| Kemins formelblad | 1 | 1 | `prints/chemistry-formula-sheet.pdf` | 794×1123, `33b6dd74373a2d2db9a9c55a09e86521014adacd883dc249b2eaf93315277237` |

Before every subject print, a real exam was graded, its solution/comparison revealed, and manual override details opened. Every asserted selector had a nonzero inventory; effective hidden state was then checked through ancestors for screen controls, answer/facit, grade, solution/comparison and override/manual UI. Every question retained a measured work box; every included diagram had a non-zero readable print rectangle. All MediaBox and CropBox dimensions were within 0.75 pt of portrait A4, and the 96 dpi raster aspect matched A4 within 0.002.

## Chemistry formula sheet

- Source SHA-256: `e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee`
- Loaded dimensions: 2481×3508
- Printed pages: 1
- Embedded decoded pixel hash matches source: yes

Dialog evidence includes initial focus, Escape/focus return, close-button focus return, complete desktop/mobile forward and reverse wrap, 50–300% zoom clamps, fit reset, wheel and arrow-key panning, and formula-only print mode. Formula-only print also proved non-formula page content existed and was effectively hidden while dialog/image content remained visible.

## Check result

- Passed leaves: 288
- Failed leaves: 0
- Subject flows: 3
- Page/viewport combinations: 12
- Mobile runtime states: 24
- Radio cases audited: 7
- Focus paint checks: 526
- Contrast samples: 2559
- Print artifacts: 4

## Limitations

The harness validates the local app in the installed headless Google Chrome build and inspects generated PDFs with Poppler. It does not emulate a screen reader's speech output or a physical printer's device-specific margins.
