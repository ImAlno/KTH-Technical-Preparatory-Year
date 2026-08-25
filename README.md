# KTH Technical Preparatory Year — Video-Based Study Plans

Study plans for the courses of KTH's *tekniskt basår* (Technical Preparatory Year), built for students who want to learn the theory primarily through **video walkthroughs**, with the course textbooks used for reading and problem sets.

Each plan follows its course's own official schedule, topic by topic, and maps every topic to the videos, pages and exercises that cover it.

> ### 🇸🇪 A note on language
>
> **All study material in this repository is written in Swedish.** This is deliberate: the courses are taught in Swedish, the textbooks are Swedish, the exams are written in Swedish, and the video walkthroughs are Swedish. Translating the plans would decouple them from the material they point at — a student searching for *"kraftmoment"* in Heureka is not helped by a plan that says *"torque"*.
>
> This root README is in English so the repository is legible to anyone browsing it. Everything below `Fysik 1/`, `Kemi 1/` and the other course directories is in Swedish, and is meant to be.

---

## What is the tekniskt basår?

A one-year preparatory programme at KTH that gives students the mathematics, physics and chemistry needed to qualify for an engineering degree. The courses are full-speed and largely self-directed, which is exactly why a plan that says *what to watch, what to read, and what to solve, in what order* is worth writing down.

---

## Courses

| Directory | Course | Code | Status |
|---|---|---|---|
| [`Kemi 1/`](Kemi%201/) | Kemi 1 (Chemistry 1) | HF0023 | ✅ Complete |
| [`Fysik 1/`](Fysik%201/) | Fysik för basår I (Physics 1) | HF0022 | ✅ Complete |
| `Fysik 2/` | Fysik för basår II (Physics 2) | HF0025 | 📋 Planned |
| `Matematik 1/` | Matematik för basår I (Mathematics 1) | HF0021 | 📋 Planned |
| `Matematik 2/` | Matematik för basår II (Mathematics 2) | HF0024 | 📋 Planned |

Start at the `README.md` inside a course directory — it is the index for that course.

---

## How a course directory is organised

Every course follows the same structure, so once you know one you know them all.

```
<Course>/
├── README.md                          index, sources, study method, course dates
├── 01-<topic>.md                      ┐
├── 02-<topic>.md                      │ one file per topic, in course order
├── ...                                ┘
├── laborationer.md                    mandatory lab work
└── tentor-och-kontrollskrivningar.md  past exams and quizzes
```

**Topics, not weeks.** The backbone is the subject matter — chemical bonding, forces, electricity — not week numbers, because week numbers shift every year while the physics does not. Lesson order is preserved exactly as the course schedules it; the topic files are contiguous blocks, not a reordering.

**Every lesson looks the same:**

```markdown
### F5 · Jonbindning och sammansatta joner

**Efter lektionen ska du kunna**       ← learning goals
- ...

**Nyckelbegrepp** — ...                 ← key terms and formulas

**Läsning:** Syntes s. 83–91            ← textbook pages
**Uppgifter:** Kemi 1000, kap. 4: 1–7   ← problem set

**Video**
- [ ] [Jonbindningar ...](https://...) · YouTube
```

Video links are checkboxes — tick them off as you go. Each is tagged with its source so you can see whether it opens a video directly or a lesson page.

---

## Conventions

**Anything tied to a specific academic year lives in one place.** Each course README has a single `## Kursdata` section holding week numbers, exam dates and lab scheduling. Everything else is year-independent. Updating a plan for a new intake means rewriting that one block — see [Reusing these plans](#reusing-these-plans-for-a-new-year) below.

**Learning goals and key terms are not official.** The `Efter lektionen ska du kunna` and `Nyckelbegrepp` lines do not come from KTH. They are written from what each lesson's pages, exercises and videos actually cover, and are an interpretation. They work well as a self-test — if you can explain every bullet without notes, you are done with the lesson — but where they disagree with the course's own learning outcomes in Canvas, Canvas wins.

**Group numbers are stripped.** Lab group and class assignments are specific to one cohort and have been removed; check your own schedule for which group you are in.

**Past exams link to Canvas.** Exam PDFs are linked by their canonical Canvas file URL, which requires a KTH login. Canvas also exposes `verifier=` tokens that grant access without logging in; those are deliberately **not** stored here, since they function as access keys and expire.

---

## Reusing these plans for a new year

The plans are built to survive a change of intake. To adapt one:

1. **Rewrite the `## Kursdata` block** in the course README — week numbers, exam dates, lab weeks. This is usually the only change needed.
2. **Diff the new detaljplanering against the exercise table** in the same README. Page and exercise numbers change when a textbook edition changes; the topics rarely do.
3. **Check the source books** listed at the top of the course README still match what the course prescribes.
4. **Refresh the exam list** from Canvas — new sittings are added each term.
5. **Spot-check the videos.** Links rot and channels reorganise. If a topic loses its video, the plan still tells you exactly which pages and exercises cover it.

---

## Sources

Videos are external recommendations, chosen to cover the theory that KTH's schedule explicitly lists. The main sources are Magnus Ehinger (chemistry) and Tomas Rönnåbakk Sverin, Räkna med mig!, Daniel Barker, Eddler and FysikStugan (physics). Textbooks, page references, exercise numbers, labs and exam dates come from the courses' own detailed schedules.

Past exams and quizzes come from the KTH Canvas course [Basår Flemingsberg](https://canvas.kth.se/courses/60501).

---

## Disclaimer

This is an unofficial, student-made study aid. It is not affiliated with or endorsed by KTH.

Videos do not replace labs, group exercises, course handouts (*stenciler*) or your teachers' instructions — several topics are explicitly flagged in the plans as places where the course's own material governs the method, and a video only helps with the underlying idea.

**Where this repository and Canvas disagree, Canvas is right.** Schedules change.
