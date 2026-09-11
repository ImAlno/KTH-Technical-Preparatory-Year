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
