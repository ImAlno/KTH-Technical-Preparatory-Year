# Real Chrome file-flow evidence

- Date: 2026-09-12T17:17:44.913Z
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

Native radio/checkbox controls are measured through their associated visible label hit area; disabled and inert controls are excluded because they are not interactive.

## Functional flows

| Subject | Questions | Non-sequential answered positions | Boundary repeat failures | Result |
|---|---:|---:|---:|---:|
| Matematik KS2 | 5 | 3 | 0 | pass |
| Fysik KS1 | 5 | 3 | 0 | pass |
| Kemi KS | 6 | 4 | 0 | pass |

Both version-1 and changed-field-schema recovery cases showed the Swedish answer-type migration message, preserved active/history bytes until the second explicit replacement action, and retained all history queues afterwards.

## Print evidence

| Artifact | Pages | PDF | First-page decoded raster |
|---|---:|---|---|
| Matematik KS2 | 5 | `prints/math-exam.pdf` | 794×1123, `a85fd663534f53c205edee6defcc7d3313aab48880c9018a9a15b14a2c381f7e` |
| Fysik KS1 | 5 | `prints/physics-exam.pdf` | 794×1123, `19a2c7ee0f61ae143ff51b892681abec77d75be0d9f46ccb73eb9f80bd6354b2` |
| Kemi KS | 6 | `prints/chemistry-exam.pdf` | 794×1123, `09b6c83a0bba80700b0f5da894a3136f20671f8af1c9c108228f932172d76f92` |
| Kemins formelblad | 1 | `prints/chemistry-formula-sheet.pdf` | 794×1123, `33b6dd74373a2d2db9a9c55a09e86521014adacd883dc249b2eaf93315277237` |

Subject PDFs contain only the generated print exam: screen navigation, timer, status, answer controls, grading and solutions were computed as hidden. Every question retained a measured work box; every included diagram had a non-zero readable print rectangle.

## Chemistry formula sheet

- Source SHA-256: `e1ca7f9914fa4920e6a5f3a80281e82ad5003c8d86cfc85c487f8cf94e4dafee`
- Loaded dimensions: 2481×3508
- Printed pages: 1
- Embedded decoded pixel hash matches source: yes

Dialog evidence includes initial focus, Escape/focus return, close-button focus return, desktop/mobile Tab and Shift+Tab order, 50–300% zoom clamps, fit reset, wheel and arrow-key panning, and formula-only print mode.

## Check result

- Passed leaves: 168
- Failed leaves: 0
- Subject flows: 3
- Page/viewport combinations: 12
- Print artifacts: 4

## Limitations

The harness validates the local app in the installed headless Google Chrome build and inspects generated PDFs with Poppler. It does not emulate a screen reader's speech output or a physical printer's device-specific margins.
