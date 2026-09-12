const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../assets/js/subject-config.js");

test("hub uses the shared journal stylesheet and three authentic exam rows", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  assert.match(html, /<link\s+rel="stylesheet"\s+href="assets\/app\.css">/);
  assert.match(html, /<body\s+class="hub-page">/);
  assert.match(html, /<main\s+class="hub-shell">/);
  assert.equal((html.match(/class="subject-row"/g) || []).length, 3);
  [
    ["Matematik KS2", "5 frågor", "10 poäng", "105 minuter", "Matematik KS2/index.html"],
    ["Fysik KS1", "5 frågor", "10 poäng", "105 minuter", "Fysik KS1/index.html"],
    ["Kemi KS", "6 frågor", "20 poäng", "120 minuter", "Kemi KS/index.html"]
  ].forEach(([name, questions, points, duration, href]) => {
    const row = html.match(new RegExp(`<li\\s+class="subject-row"[\\s\\S]*?${name}[\\s\\S]*?<\\/li>`))[0];
    assert.match(row, new RegExp(questions));
    assert.match(row, new RegExp(points));
    assert.match(row, new RegExp(duration));
    assert.match(row, new RegExp(`<a[^>]+href="${href.replace(".", "\\.")}"[^>]*>\\s*Starta provet\\s*<\\/a>`));
  });
  assert.doesNotMatch(html, /<style>|https?:\/\/|system-ui|#0071e3|#f5f5f7|hero|card-grid/i);
});

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

test("validates the complete public subject configuration contract", () => {
  const valid = { ...config.SUBJECTS.math };
  Object.values(config.SUBJECTS).forEach((subject) => {
    assert.equal(config.validateSubjectConfig(subject), true, subject.id);
  });

  [
    null,
    {},
    { ...valid, id: " " },
    { ...valid, id: 7 },
    { ...valid, name: " " },
    { ...valid, questionCount: 0 },
    { ...valid, questionCount: "5" },
    { ...valid, maxPoints: 0 },
    { ...valid, maxPoints: Infinity },
    { ...valid, passPoints: -1 },
    { ...valid, passPoints: valid.maxPoints + 1 },
    { ...valid, durationMinutes: 0 },
    { ...valid, durationMinutes: "105" }
  ].forEach((subject) => {
    assert.equal(config.validateSubjectConfig(subject), false, JSON.stringify(subject));
  });
});
