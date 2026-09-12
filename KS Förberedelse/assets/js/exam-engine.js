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
    choice: "gradeChoice",
    "solution-set": "gradeSolutionSet",
    expression: "gradeExpression",
    "simplified-expression": "gradeSimplifiedExpression",
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

  function nonEmptyString(value) {
    return typeof value === "string" && Boolean(value.trim());
  }

  function validTolerance(value) {
    if (value === undefined || value === null) return true;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return ["absolute", "relative"].every(function (name) {
      return value[name] === undefined || (Number.isFinite(value[name]) && value[name] >= 0);
    });
  }

  function validAliases(field) {
    if (field.expected !== undefined && typeof field.expected !== "string") return false;
    if (field.aliases !== undefined && (!Array.isArray(field.aliases) || field.aliases.some(function (alias) { return typeof alias !== "string"; }))) return false;
    const values = (typeof field.expected === "string" ? [field.expected] : []).concat(Array.isArray(field.aliases) ? field.aliases : []);
    return values.some(nonEmptyString);
  }

  function validChoice(field) {
    if (typeof field.expected !== "string" || !Array.isArray(field.options) || !field.options.length) return false;
    const values = new Set();
    const validOptions = field.options.every(function (option) {
      if (!option || typeof option !== "object" || Array.isArray(option)) return false;
      const keys = Object.keys(option).sort();
      if (keys.length !== 2 || keys[0] !== "label" || keys[1] !== "value" ||
          !nonEmptyString(option.value) || !nonEmptyString(option.label) || values.has(option.value)) return false;
      values.add(option.value);
      return true;
    });
    return validOptions && values.has(field.expected);
  }

  function validWorkOnPaper(value) {
    if (value === undefined) return true;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value).sort();
    return keys.length === 3 && keys[0] === "comparison" && keys[1] === "instruction" && keys[2] === "title" &&
      nonEmptyString(value.title) && nonEmptyString(value.instruction) && nonEmptyString(value.comparison);
  }

  function validFieldData(field) {
    if (field.kind === "numeric") {
      const validUnit = field.targetUnit === undefined || field.targetUnit === null || nonEmptyString(field.targetUnit);
      const validAlternativeUnitCredit = field.alternativeUnitCredit === undefined ||
        field.alternativeUnitCredit === "full" || field.alternativeUnitCredit === "reduced";
      return Number.isFinite(field.expected) && validUnit && validTolerance(field.tolerance) && validAlternativeUnitCredit;
    }
    if (field.kind === "aliases") return validAliases(field);
    if (field.kind === "choice") return validChoice(field);
    if (field.kind === "solution-set") return Array.isArray(field.expected) && field.expected.every(Number.isFinite);
    if (field.kind === "expression" || field.kind === "simplified-expression" || field.kind === "chemical-formula") return nonEmptyString(field.expected);
    if (field.kind === "chemical-equation") {
      return nonEmptyString(field.expected) && (field.statePoints === undefined ||
        (Number.isFinite(field.statePoints) && field.statePoints >= 0 && field.statePoints <= field.points));
    }
    return field.kind === "self";
  }

  function validField(field, ids) {
    if (!field || !nonEmptyString(field.id) || ids.has(field.id) || !nonEmptyString(field.label)) return false;
    if (!Number.isFinite(field.points) || field.points <= 0) return false;
    if (field.kind !== "self" && !FIELD_GRADERS[field.kind]) return false;
    if (!validFieldData(field)) return false;
    ids.add(field.id);
    return true;
  }

  function validRubric(question) {
    if (!Array.isArray(question.rubric)) return false;
    if (question.rubric.some(function (item) {
      return !item || !Number.isFinite(item.points) || item.points < 0 || !nonEmptyString(item.text);
    })) return false;
    const selfPoints = question.fields.reduce(function (sum, field) {
      return sum + (field.kind === "self" ? field.points : 0);
    }, 0);
    if (!selfPoints) return true;
    const rubricPoints = question.rubric.reduce(function (sum, item) { return sum + item.points; }, 0);
    return question.rubric.length > 0 && rubricPoints + 1e-9 >= selfPoints;
  }

  function validateExamData(subject, slots) {
    if (!subject || typeof subject.id !== "string" || !subject.id || !Number.isInteger(subject.questionCount) || subject.questionCount <= 0 ||
        !Number.isFinite(subject.maxPoints) || subject.maxPoints < 0 || !Number.isFinite(subject.durationMinutes) || subject.durationMinutes <= 0) return false;
    const keys = orderedSlots(slots);
    if (keys.length !== subject.questionCount) return false;
    if (keys.some(function (key, index) { return Number(key) !== index + 1; })) return false;

    const questionIds = new Set();
    let totalPoints = 0;
    for (const key of keys) {
      const position = Number(key);
      if (!Number.isInteger(position)) return false;
      const bank = slots[key];
      if (!Array.isArray(bank) || !bank.length) return false;
      let slotPoints = null;
      for (const question of bank) {
        if (!question || !nonEmptyString(question.id) || questionIds.has(question.id) || !Number.isInteger(question.slot) || question.slot !== position ||
            !nonEmptyString(question.title) || !Number.isFinite(question.points) || question.points <= 0 || !nonEmptyString(question.promptHtml) ||
            !nonEmptyString(question.solutionHtml) || !Array.isArray(question.fields) || !question.fields.length ||
            !validWorkOnPaper(question.workOnPaper)) return false;
        questionIds.add(question.id);
        if (slotPoints === null) slotPoints = question.points;
        if (!close(question.points, slotPoints)) return false;
        const fieldIds = new Set();
        if (!question.fields.every(function (item) { return validField(item, fieldIds); })) return false;
        const fieldPoints = question.fields.reduce(function (sum, item) { return sum + item.points; }, 0);
        if (!close(fieldPoints, question.points) || !validRubric(question)) return false;
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

  function gradeQuestion(question, answers) {
    const rawAnswers = answers || {};
    const fieldResults = {};
    let earned = 0;
    let requiresSelfAssessment = question.fields.length === 0;
    question.fields.forEach(function (field) {
      const fieldResult = gradeField(field, rawAnswers[field.id]);
      fieldResults[field.id] = fieldResult;
      earned += Number.isFinite(fieldResult.earned) ? fieldResult.earned : 0;
      if (fieldResult.status === "self") requiresSelfAssessment = true;
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

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function hasOnlyKeys(value, allowed) {
    return isRecord(value) && Object.keys(value).every(function (key) { return allowed.includes(key); });
  }

  function sameKeys(value, expected) {
    if (!isRecord(value)) return false;
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    return actual.length === wanted.length && actual.every(function (key, index) { return key === wanted[index]; });
  }

  function validJsonValue(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (!value || typeof value !== "object") return false;
    const visited = seen || new Set();
    if (visited.has(value)) return false;
    visited.add(value);
    const values = Array.isArray(value) ? value : Object.keys(value).map(function (key) { return value[key]; });
    const valid = values.every(function (item) { return validJsonValue(item, visited); });
    visited.delete(value);
    return valid;
  }

  function sameJsonValue(left, right) {
    if (left === right) return true;
    if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
        left.every(function (item, index) { return sameJsonValue(item, right[index]); });
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every(function (key, index) {
      return key === rightKeys[index] && sameJsonValue(left[key], right[key]);
    });
  }

  function validIdCollection(value, selectedIds) {
    return Array.isArray(value) && new Set(value).size === value.length && value.every(function (id) {
      return typeof id === "string" && selectedIds.has(id);
    });
  }

  function scoreMatchesStatus(status, earned, possible, allowSelf) {
    if (status === "self") return Boolean(allowSelf);
    if (status === "correct") return close(earned, possible);
    if (status === "incorrect") return close(earned, 0);
    return status === "partial" && earned > 0 && earned < possible;
  }

  function validFieldResult(value, field) {
    if (!hasOnlyKeys(value, ["status", "earned", "possible", "interpreted", "message"]) ||
        !["correct", "partial", "incorrect", "self"].includes(value.status) ||
        !Number.isFinite(value.earned) || value.earned < 0 || value.earned > field.points ||
        !Number.isFinite(value.possible) || !close(value.possible, field.points) ||
        !validJsonValue(value.interpreted) || typeof value.message !== "string") return false;
    return scoreMatchesStatus(value.status, value.earned, value.possible, value.status === "self");
  }

  function validQuestionGrade(value, question, answers) {
    if (!hasOnlyKeys(value, ["status", "earned", "possible", "interpreted", "message", "fieldResults", "requiresSelfAssessment", "selfAssessed", "overridden"]) ||
        !["correct", "partial", "incorrect", "self"].includes(value.status) ||
        !Number.isFinite(value.earned) || value.earned < 0 || value.earned > question.points ||
        !Number.isFinite(value.possible) || !close(value.possible, question.points) ||
        !validJsonValue(value.interpreted) || typeof value.message !== "string" ||
        typeof value.requiresSelfAssessment !== "boolean" ||
        (value.selfAssessed !== undefined && value.selfAssessed !== true) ||
        (value.overridden !== undefined && value.overridden !== true) ||
        !sameKeys(value.fieldResults, question.fields.map(function (field) { return field.id; }))) return false;

    const fieldResults = question.fields.map(function (field) { return value.fieldResults[field.id]; });
    if (fieldResults.some(function (fieldResult, index) { return !validFieldResult(fieldResult, question.fields[index]); })) return false;
    const automatic = gradeQuestion(question, answers);
    if (!sameJsonValue(value.fieldResults, automatic.fieldResults) ||
        value.requiresSelfAssessment !== automatic.requiresSelfAssessment ||
        !sameJsonValue(value.interpreted, automatic.interpreted)) return false;
    if (value.selfAssessed && !automatic.requiresSelfAssessment) return false;
    const manuallyScored = Boolean(value.selfAssessed || value.overridden);
    if (!manuallyScored) return sameJsonValue(value, automatic);
    if (!validManualPoints(value.earned, question.points) || value.status !== gradeStatus(value.earned, question.points)) return false;
    const manualMessages = [];
    if (value.selfAssessed) manualMessages.push("Självbedömningen är registrerad.");
    if (value.overridden) manualMessages.push("Den automatiska bedömningen har ändrats manuellt.");
    return manualMessages.includes(value.message);
  }

  function validTimerSnapshot(value, subject) {
    return sameKeys(value, ["durationMs", "elapsedMs", "runningSince"]) &&
      Number.isFinite(value.durationMs) && value.durationMs > 0 && close(value.durationMs, subject.durationMinutes * 60_000) &&
      Number.isFinite(value.elapsedMs) && value.elapsedMs >= 0 && value.elapsedMs <= value.durationMs &&
      (value.runningSince === null || (Number.isFinite(value.runningSince) && value.runningSince >= 0));
  }

  function validateSnapshot(snapshot, questionSource, subject) {
    if (!validateExamData(subject, questionSource) || !isRecord(snapshot) || snapshot.schemaVersion !== 1 ||
        snapshot.subjectId !== subject.id || !nonEmptyString(snapshot.examId) ||
        !Array.isArray(snapshot.questionIds) || snapshot.questionIds.length !== subject.questionCount ||
        new Set(snapshot.questionIds).size !== snapshot.questionIds.length ||
        !Number.isInteger(snapshot.currentIndex) || snapshot.currentIndex < 0 || snapshot.currentIndex >= subject.questionCount ||
        !["active", "graded"].includes(snapshot.status) || !isRecord(snapshot.answers) || !isRecord(snapshot.grades) ||
        !validTimerSnapshot(snapshot.timer, subject)) return false;

    const index = makeQuestionIndex(questionSource);
    const selectedIds = new Set(snapshot.questionIds);
    let selectedPoints = 0;
    for (let position = 0; position < snapshot.questionIds.length; position += 1) {
      const id = snapshot.questionIds[position];
      const question = typeof id === "string" ? index[id] : null;
      if (!question || question.slot !== position + 1) return false;
      selectedPoints += question.points;
    }
    if (!close(selectedPoints, subject.maxPoints) || !validIdCollection(snapshot.flags, selectedIds) ||
        !validIdCollection(snapshot.expandedSolutions, selectedIds)) return false;

    for (const questionId of Object.keys(snapshot.answers)) {
      const question = selectedIds.has(questionId) ? index[questionId] : null;
      const answers = snapshot.answers[questionId];
      if (!question || !isRecord(answers)) return false;
      const fieldIds = new Set(question.fields.map(function (field) { return field.id; }));
      if (Object.keys(answers).some(function (fieldId) { return !fieldIds.has(fieldId) || typeof answers[fieldId] !== "string"; })) return false;
    }

    if (snapshot.status === "active") {
      return Object.keys(snapshot.grades).length === 0 && snapshot.expandedSolutions.length === 0 && snapshot.result === undefined;
    }
    if (!sameKeys(snapshot.grades, snapshot.questionIds) || !hasOnlyKeys(snapshot.result, ["status", "earned", "possible"]) ||
        !["preliminary", "complete"].includes(snapshot.result.status) ||
        !Number.isFinite(snapshot.result.earned) || !Number.isFinite(snapshot.result.possible)) return false;

    for (const questionId of snapshot.questionIds) {
      if (!validQuestionGrade(snapshot.grades[questionId], index[questionId], snapshot.answers[questionId] || {})) return false;
    }
    const expectedResult = createOverallResult(snapshot);
    return snapshot.result.status === expectedResult.status && close(snapshot.result.earned, expectedResult.earned) &&
      close(snapshot.result.possible, expectedResult.possible) && close(snapshot.result.possible, subject.maxPoints);
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

    function submit() {
      if (current.status !== "active") return { ok: false, reason: "already-graded" };
      const grades = {};
      current.questionIds.forEach(function (id) { grades[id] = gradeQuestion(questionFor(id), current.answers[id]); });
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

  function restoreSession(snapshot, questionSource, store, subject) {
    if (!validateSnapshot(snapshot, questionSource, subject)) throw new Error("Invalid exam snapshot");
    const index = makeQuestionIndex(questionSource);
    return makeSession(snapshot, index, store);
  }

  return { createShuffleBag: createShuffleBag, createSession: createSession, validateSnapshot: validateSnapshot, restoreSession: restoreSession };
});
