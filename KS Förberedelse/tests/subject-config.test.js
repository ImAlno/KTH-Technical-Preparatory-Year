const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../assets/js/subject-config.js");

test("hub page includes minimalist subject-nav styling tokens", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  assert.match(html, /<style>[\s\S]*?<\/style>/);
  assert.ok(html.includes("system-ui"));
  assert.ok(html.includes("#f5f5f7"));
  assert.ok(html.includes("#ffffff"));
  assert.ok(html.includes("#d2d2d7"));
  assert.ok(html.includes("#0071e3"));
  assert.ok(html.includes("a:hover"));
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
