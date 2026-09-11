(function (root, factory) {
  const isCommonJS = typeof module === "object" && module.exports && typeof require === "function";
  const api = factory(isCommonJS ? require("./grading.js") : root && root.KS && root.KS.grading);
  if (isCommonJS) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.exam = api;
  }
})(typeof window !== "undefined" ? window : null, function (grading) {
  const FIELD_GRADERS = {
    numeric: "gradeNumeric",
    aliases: "gradeAliases",
    "solution-set": "gradeSolutionSet",
    expression: "gradeExpression",
    "chemical-formula": "gradeChemicalFormula",
    "chemical-equation": "gradeChemicalEquation"
  };
  let examSequence = 0;

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function close(left, right) {
    return Math.abs(left - right) < 1e-9;
  }

  function shuffle(ids, rng) {
    const values = ids.slice();
    for (let index = values.length - 1; index > 0; index -= 1) {
      const random = rng();
      const bounded = Number.isFinite(random) ? Math.min(Math.max(random, 0), 0.9999999999999999) : 0;
      const other = Math.floor(bounded * (index + 1));
      const held = values[index];
      values[index] = values[other];
      values[other] = held;
    }
    return values;
  }

  function createShuffleBag(ids, persisted, rng) {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new TypeError("Shuffle bag requires unique ids");
    const random = typeof rng === "function" ? rng : Math.random;
    const valid = new Set(ids);
    const initial = persisted && Array.isArray(persisted.queue) ? persisted.queue : [];
    let queue = initial.filter(function (id, index) { return valid.has(id) && initial.indexOf(id) === index; });
    let lastId = persisted && typeof persisted.lastId === "string" ? persisted.lastId : null;

    function refill() {
      queue = shuffle(ids, random);
      if (queue.length > 1 && queue[0] === lastId) {
        const held = queue[0];
        queue[0] = queue[1];
        queue[1] = held;
      }
    }

    function take() {
      if (!queue.length) refill();
      const id = queue.shift();
      lastId = id;
      return id;
    }

    function snapshot() {
      return { queue: queue.slice(), lastId: lastId };
    }

    return { take: take, snapshot: snapshot };
  }

  function orderedSlots(slots) {
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) return [];
    return Object.keys(slots).sort(function (left, right) { return Number(left) - Number(right); });
  }

  function validField(field, ids) {
    if (!field || typeof field.id !== "string" || !field.id || ids.has(field.id)) return false;
    if (!Number.isFinite(field.points) || field.points < 0) return false;
    if (field.kind !== "self" && !FIELD_GRADERS[field.kind]) return false;
    ids.add(field.id);
    return true;
  }

  function validateExamData(subject, slots) {
    if (!subject || typeof subject.id !== "string" || !subject.id || !Number.isInteger(subject.questionCount) || subject.questionCount <= 0 ||
        !Number.isFinite(subject.maxPoints) || subject.maxPoints < 0 || !Number.isFinite(subject.durationMinutes) || subject.durationMinutes <= 0) return false;
    const keys = orderedSlots(slots);
    if (keys.length !== subject.questionCount) return false;

    const questionIds = new Set();
    let totalPoints = 0;
    for (const key of keys) {
      const bank = slots[key];
      if (!Array.isArray(bank) || !bank.length) return false;
      let slotPoints = null;
      for (const question of bank) {
        if (!question || typeof question.id !== "string" || !question.id || questionIds.has(question.id) ||
            !Number.isFinite(question.points) || question.points <= 0 || String(question.slot) !== String(key) || !Array.isArray(question.fields)) return false;
        questionIds.add(question.id);
        if (slotPoints === null) slotPoints = question.points;
        if (!close(question.points, slotPoints)) return false;
        const fieldIds = new Set();
        if (!question.fields.every(function (item) { return validField(item, fieldIds); })) return false;
        if (question.fields.length) {
          const fieldPoints = question.fields.reduce(function (sum, item) { return sum + item.points; }, 0);
          if (!close(fieldPoints, question.points)) return false;
        }
      }
      totalPoints += slotPoints;
    }
    return close(totalPoints, subject.maxPoints);
  }

  function normalizeHistory(value) {
    return value && value.schemaVersion === 1 && value.slots && typeof value.slots === "object"
      ? copy(value)
      : { schemaVersion: 1, slots: {} };
  }

  function createExamId() {
    examSequence += 1;
    return "exam-" + Date.now().toString(36) + "-" + examSequence.toString(36);
  }

  function makeQuestionIndex(value) {
    const index = {};
    if (value instanceof Map) value.forEach(function (question, id) { index[id] = question; });
    else if (Array.isArray(value)) value.forEach(function (question) { if (question && question.id) index[question.id] = question; });
    else if (value && typeof value === "object") {
      Object.keys(value).forEach(function (key) {
        const item = value[key];
        if (Array.isArray(item)) item.forEach(function (question) { if (question && question.id) index[question.id] = question; });
        else if (item && item.id) index[item.id] = item;
      });
    }
    return index;
  }

  function gradeStatus(earned, possible) {
    if (close(earned, possible)) return "correct";
    if (close(earned, 0)) return "incorrect";
    return "partial";
  }

  function validManualPoints(earned, possible) {
    return Number.isFinite(earned) && earned >= 0 && earned <= possible && close(earned * 2, Math.round(earned * 2));
  }

  function createOverallResult(state) {
    const grades = state.grades || {};
    const earned = state.questionIds.reduce(function (sum, id) { return sum + (grades[id] ? grades[id].earned : 0); }, 0);
    const possible = state.questionIds.reduce(function (sum, id) { return sum + (grades[id] ? grades[id].possible : 0); }, 0);
    const preliminary = state.questionIds.some(function (id) { return grades[id] && grades[id].status === "self"; });
    return { status: preliminary ? "preliminary" : "complete", earned: earned, possible: possible };
  }

  function makeSession(state, questionIndex, store) {
    let current = copy(state);

    function persist() {
      if (store && typeof store.saveActive === "function") store.saveActive(copy(current));
    }

    function questionFor(id) {
      return questionIndex[id] || null;
    }

    function validQuestion(id) {
      return current.questionIds.includes(id) && Boolean(questionFor(id));
    }

    function navigate(index) {
      if (!Number.isInteger(index) || index < 0 || index >= current.questionIds.length) return { ok: false, reason: "invalid-index" };
      current.currentIndex = index;
      persist();
      return { ok: true };
    }

    function setAnswer(questionId, fieldId, raw) {
      if (current.status !== "active") return { ok: false, reason: "answers-locked" };
      const question = questionFor(questionId);
      if (!validQuestion(questionId)) return { ok: false, reason: "unknown-question" };
      if (!question.fields.some(function (field) { return field.id === fieldId; })) return { ok: false, reason: "unknown-field" };
      current.answers[questionId] = current.answers[questionId] || {};
      current.answers[questionId][fieldId] = raw;
      persist();
      return { ok: true };
    }

    function toggleFlag(questionId) {
      if (!validQuestion(questionId)) return { ok: false, reason: "unknown-question" };
      const index = current.flags.indexOf(questionId);
      const flagged = index === -1;
      if (flagged) current.flags.push(questionId);
      else current.flags.splice(index, 1);
      persist();
      return { ok: true, flagged: flagged };
    }

    function gradeField(field, raw) {
      if (field.kind === "self") {
        return { status: "self", earned: 0, possible: field.points, interpreted: raw === undefined ? null : raw, message: "Bedöm svaret själv med hjälp av lösningen." };
      }
      const method = FIELD_GRADERS[field.kind];
      if (!grading || typeof grading[method] !== "function") {
        return { status: "self", earned: 0, possible: field.points, interpreted: null, message: "Svaret kunde inte rättas automatiskt." };
      }
      return grading[method](field, raw === undefined ? "" : raw);
    }

    function gradeQuestion(question) {
      const rawAnswers = current.answers[question.id] || {};
      const fieldResults = {};
      let earned = 0;
      let requiresSelfAssessment = question.fields.length === 0;
      question.fields.forEach(function (field) {
        const result = gradeField(field, rawAnswers[field.id]);
        fieldResults[field.id] = result;
        earned += Number.isFinite(result.earned) ? result.earned : 0;
        if (result.status === "self") requiresSelfAssessment = true;
      });
      return {
        status: requiresSelfAssessment ? "self" : gradeStatus(earned, question.points),
        earned: earned,
        possible: question.points,
        interpreted: null,
        message: requiresSelfAssessment ? "En del av uppgiften behöver bedömas manuellt." : "Uppgiften har rättats.",
        fieldResults: fieldResults,
        requiresSelfAssessment: requiresSelfAssessment
      };
    }

    function submit() {
      if (current.status !== "active") return { ok: false, reason: "already-graded" };
      const grades = {};
      current.questionIds.forEach(function (id) { grades[id] = gradeQuestion(questionFor(id)); });
      current.grades = grades;
      current.status = "graded";
      current.result = createOverallResult(current);
      persist();
      return { ok: true, result: copy(current.result) };
    }

    function applyManualGrade(questionId, earned, property, requireSelf) {
      if (current.status !== "graded") return { ok: false, reason: "not-graded" };
      const question = questionFor(questionId);
      const grade = current.grades[questionId];
      if (!question || !grade) return { ok: false, reason: "unknown-question" };
      if (requireSelf && !grade.requiresSelfAssessment) return { ok: false, reason: "not-self" };
      if (!validManualPoints(earned, question.points)) return { ok: false, reason: "invalid-points" };
      grade.earned = earned;
      grade.status = gradeStatus(earned, question.points);
      grade[property] = true;
      grade.message = property === "overridden" ? "Den automatiska bedömningen har ändrats manuellt." : "Självbedömningen är registrerad.";
      current.result = createOverallResult(current);
      persist();
      return { ok: true };
    }

    function setSelfGrade(questionId, earned) {
      return applyManualGrade(questionId, earned, "selfAssessed", true);
    }

    function overrideGrade(questionId, earned) {
      return applyManualGrade(questionId, earned, "overridden", false);
    }

    function toggleSolution(questionId) {
      if (current.status !== "graded") return { ok: false, reason: "not-graded" };
      if (!validQuestion(questionId)) return { ok: false, reason: "unknown-question" };
      const index = current.expandedSolutions.indexOf(questionId);
      const expanded = index === -1;
      if (expanded) current.expandedSolutions.push(questionId);
      else current.expandedSolutions.splice(index, 1);
      persist();
      return { ok: true, expanded: expanded };
    }

    return {
      navigate: navigate,
      setAnswer: setAnswer,
      toggleFlag: toggleFlag,
      submit: submit,
      setSelfGrade: setSelfGrade,
      overrideGrade: overrideGrade,
      toggleSolution: toggleSolution,
      snapshot: function () { return copy(current); }
    };
  }

  function createSession(subject, slots, store, rng) {
    if (!validateExamData(subject, slots)) throw new Error("Invalid exam data");
    if (!store || typeof store.loadHistory !== "function" || typeof store.saveHistory !== "function" || typeof store.saveActive !== "function") {
      throw new TypeError("Invalid exam data store");
    }
    const history = normalizeHistory(store.loadHistory());
    const questionIds = [];
    const index = {};
    orderedSlots(slots).forEach(function (key) {
      const bank = slots[key];
      bank.forEach(function (question) { index[question.id] = question; });
      const bag = createShuffleBag(bank.map(function (question) { return question.id; }), history.slots[key], rng);
      questionIds.push(bag.take());
      history.slots[key] = bag.snapshot();
      store.saveHistory(copy(history));
    });
    const state = {
      schemaVersion: 1,
      subjectId: subject.id,
      examId: createExamId(),
      questionIds: questionIds,
      currentIndex: 0,
      answers: {},
      flags: [],
      status: "active",
      grades: {},
      expandedSolutions: [],
      timer: { durationMs: subject.durationMinutes * 60_000, elapsedMs: 0, runningSince: null }
    };
    const session = makeSession(state, index, store);
    store.saveActive(session.snapshot());
    return session;
  }

  function restoreSession(snapshot, questionIndex, store) {
    const index = makeQuestionIndex(questionIndex);
    if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.questionIds) ||
        snapshot.questionIds.some(function (id) { return !index[id]; })) throw new Error("Invalid exam snapshot");
    return makeSession(snapshot, index, store);
  }

  return { createShuffleBag: createShuffleBag, createSession: createSession, restoreSession: restoreSession };
});
