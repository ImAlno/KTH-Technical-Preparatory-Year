(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.subjectConfig = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const SUBJECTS = Object.freeze({
    math: Object.freeze({
      id: "math-ks2",
      name: "Matematik KS2",
      questionCount: 5,
      maxPoints: 10,
      passPoints: 6,
      durationMinutes: 105
    }),
    physics: Object.freeze({
      id: "physics-ks1",
      name: "Fysik KS1",
      questionCount: 5,
      maxPoints: 10,
      passPoints: 6,
      durationMinutes: 105
    }),
    chemistry: Object.freeze({
      id: "chemistry-ks",
      name: "Kemi KS",
      questionCount: 6,
      maxPoints: 20,
      passPoints: 10,
      durationMinutes: 120
    })
  });

  function validateSubjectConfig(value) {
    return Boolean(
      value && typeof value === "object" && !Array.isArray(value) &&
      typeof value.id === "string" && value.id.trim() &&
      typeof value.name === "string" && value.name.trim() &&
      Number.isInteger(value.questionCount) && value.questionCount > 0 &&
      Number.isFinite(value.maxPoints) && value.maxPoints > 0 &&
      Number.isFinite(value.passPoints) && value.passPoints > 0 && value.maxPoints >= value.passPoints &&
      Number.isFinite(value.durationMinutes) && value.durationMinutes > 0
    );
  }

  return { SUBJECTS, validateSubjectConfig };
});
