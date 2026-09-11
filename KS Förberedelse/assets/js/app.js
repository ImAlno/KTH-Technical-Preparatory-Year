(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.app = api;
  }
})(typeof window !== "undefined" ? window : null, function (root) {
  function nonEmpty(value) {
    if (value === null || value === undefined) return false;
    return typeof value === "string" ? Boolean(value.trim()) : Boolean(String(value).trim());
  }

  function questionStatus(snapshot, questionId) {
    const answers = snapshot && snapshot.answers && snapshot.answers[questionId]
      ? snapshot.answers[questionId]
      : {};
    const recorded = Object.keys(answers);
    const expected = snapshot && snapshot.questionFields && Array.isArray(snapshot.questionFields[questionId])
      ? snapshot.questionFields[questionId]
      : recorded;
    const values = expected.map(function (fieldId) { return answers[fieldId]; });
    const filled = values.filter(nonEmpty).length;
    let state = "unanswered";
    let label = "obesvarad";

    if (filled > 0 && filled === expected.length) {
      state = "answered";
      label = "besvarad";
    } else if (filled > 0) {
      state = "started";
      label = "påbörjad";
    }

    return {
      state: state,
      label: label,
      flagged: Boolean(snapshot && Array.isArray(snapshot.flags) && snapshot.flags.includes(questionId))
    };
  }

  function canShowSolution(snapshot, questionId) {
    return Boolean(
      snapshot && snapshot.status === "graded" &&
      Array.isArray(snapshot.expandedSolutions) &&
      snapshot.expandedSolutions.includes(questionId)
    );
  }

  function questionMap(slots) {
    const index = {};
    if (!slots || typeof slots !== "object") return index;
    Object.keys(slots).forEach(function (slot) {
      if (!Array.isArray(slots[slot])) return;
      slots[slot].forEach(function (question) {
        if (question && question.id) index[question.id] = question;
      });
    });
    return index;
  }

  function withFieldMap(snapshot, index) {
    const view = Object.assign({}, snapshot, { questionFields: {} });
    snapshot.questionIds.forEach(function (questionId) {
      const question = index[questionId];
      view.questionFields[questionId] = question ? question.fields.map(function (field) { return field.id; }) : [];
    });
    return view;
  }

  function formatPoints(value) {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }

  function formatTime(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [hours, minutes, remainder].map(function (part) { return String(part).padStart(2, "0"); }).join(":");
  }

  function interpretedText(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    }
    return String(value);
  }

  function gradeLabel(status) {
    return {
      correct: "Rätt",
      incorrect: "Inte rätt",
      partial: "Delvis rätt",
      self: "Bedöm själv"
    }[status] || "Bedömning saknas";
  }

  function createElement(document, tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setHtml(element, html) {
    element.innerHTML = html;
    return element;
  }

  function showDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function renderMissingBank(rootElement) {
    const document = rootElement.ownerDocument;
    const section = createElement(document, "section", "empty-state");
    section.append(
      createElement(document, "h1", "", "Frågebanken laddades inte"),
      createElement(document, "p", "", "Kontrollera att ämnets frågefiler finns och ladda sedan om sidan.")
    );
    rootElement.replaceChildren(section);
    const navigation = document.getElementById("question-list");
    if (navigation) navigation.replaceChildren();
    ["timer-start", "timer-pause", "timer-reset", "history-open", "print-exam"].forEach(function (id) {
      const control = document.getElementById(id);
      if (control) control.disabled = true;
    });
    return { ok: false, reason: "missing-question-bank" };
  }

  function mount(rootElement, subjectData) {
    if (!rootElement || !rootElement.ownerDocument) return { ok: false, reason: "missing-root" };
    const document = rootElement.ownerDocument;
    const win = document.defaultView || root;
    const KS = win && win.KS ? win.KS : null;
    const subject = subjectData && (subjectData.subject || subjectData.config);
    const slots = subjectData && subjectData.slots;

    if (!subject || !slots || !Object.keys(slots).length) return renderMissingBank(rootElement);
    if (!KS || !KS.exam || !KS.storage || !KS.timer || !KS.grading) return renderMissingBank(rootElement);

    const index = questionMap(slots);
    let store;
    try {
      store = KS.storage.createStore(win.localStorage, subject.id);
    } catch (error) {
      return renderMissingBank(rootElement);
    }

    let session = null;
    let timerInterval = null;
    const elements = {
      subjectName: document.getElementById("subject-name"),
      sessionState: document.getElementById("session-state"),
      questionList: document.getElementById("question-list"),
      status: document.getElementById("status-region"),
      timerDisplay: document.getElementById("timer-display"),
      timerStart: document.getElementById("timer-start"),
      timerPause: document.getElementById("timer-pause"),
      timerReset: document.getElementById("timer-reset"),
      historyOpen: document.getElementById("history-open"),
      historyDialog: document.getElementById("history-dialog"),
      historyConfirm: document.getElementById("history-confirm"),
      submitDialog: document.getElementById("submit-dialog"),
      submitMessage: document.getElementById("submit-message"),
      submitConfirm: document.getElementById("submit-confirm"),
      recoveryDialog: document.getElementById("recovery-dialog"),
      recoveryMessage: document.getElementById("recovery-message"),
      recoveryContinue: document.getElementById("recovery-continue"),
      recoveryNew: document.getElementById("recovery-new"),
      recoveryBack: document.getElementById("recovery-back"),
      formulaOpen: document.getElementById("formula-open"),
      formulaDialog: document.getElementById("formula-dialog"),
      formulaContent: document.getElementById("formula-content"),
      printFormula: document.getElementById("print-formula"),
      printExam: document.getElementById("print-exam")
    };

    if (elements.subjectName) elements.subjectName.textContent = subject.name;

    function announce(message) {
      if (elements.status) elements.status.textContent = message;
    }

    function currentSnapshot() {
      return session ? session.snapshot() : null;
    }

    function currentViewSnapshot() {
      return withFieldMap(currentSnapshot(), index);
    }

    function renderTimer() {
      if (!session) return;
      const snapshot = currentSnapshot();
      const remaining = KS.timer.remaining(snapshot.timer, Date.now());
      if (elements.timerDisplay) elements.timerDisplay.textContent = formatTime(remaining);
      if (elements.timerStart) elements.timerStart.disabled = snapshot.timer.runningSince !== null || snapshot.status === "graded";
      if (elements.timerPause) elements.timerPause.disabled = snapshot.timer.runningSince === null || snapshot.status === "graded";
      if (elements.timerReset) elements.timerReset.disabled = snapshot.status === "graded";
    }

    function updateTimer(transition) {
      if (!session || currentSnapshot().status === "graded") return;
      const next = currentSnapshot();
      next.timer = transition(next.timer);
      store.saveActive(next);
      session = KS.exam.restoreSession(next, index, store);
      renderTimer();
    }

    function renderNavigation() {
      if (!session || !elements.questionList) return;
      const snapshot = currentViewSnapshot();
      elements.questionList.replaceChildren();
      snapshot.questionIds.forEach(function (questionId, position) {
        const status = questionStatus(snapshot, questionId);
        const item = createElement(document, "li");
        const button = createElement(document, "button");
        const marker = createElement(document, "span", "question-marker", status.state === "answered" ? "●" : status.state === "started" ? "◐" : "○");
        const number = createElement(document, "span", "question-number", String(position + 1));
        const flagText = status.flagged ? ", markerad" : "";

        button.type = "button";
        button.dataset.state = status.state;
        button.dataset.flagged = String(status.flagged);
        button.setAttribute("aria-label", `Uppgift ${position + 1}, ${status.label}${flagText}`);
        if (position === snapshot.currentIndex) button.setAttribute("aria-current", "step");
        button.append(marker, number);
        button.addEventListener("click", function () {
          session.navigate(position);
          render();
          rootElement.focus();
        });
        item.append(button);
        elements.questionList.append(item);
      });
    }

    function answerValue(snapshot, questionId, fieldId) {
      const questionAnswers = snapshot.answers[questionId] || {};
      return questionAnswers[fieldId] === undefined || questionAnswers[fieldId] === null
        ? ""
        : String(questionAnswers[fieldId]);
    }

    function renderActiveFields(container, question, snapshot) {
      question.fields.forEach(function (field, fieldIndex) {
        const wrapper = createElement(document, "div", "answer-field");
        const id = `answer-${question.id}-${field.id}`;
        const label = createElement(document, "label", "", field.label);
        const control = field.kind === "self" || field.multiline
          ? createElement(document, "textarea")
          : createElement(document, "input");
        label.htmlFor = id;
        control.id = id;
        control.name = field.id;
        if (control.tagName === "INPUT") {
          control.type = "text";
          control.autocomplete = "off";
        }
        control.value = answerValue(snapshot, question.id, field.id);
        control.addEventListener("input", function () {
          session.setAnswer(question.id, field.id, control.value);
          renderNavigation();
        });
        wrapper.append(label, control);
        if (field.help) wrapper.append(createElement(document, "p", "field-help", field.help));
        if (fieldIndex === 0) control.dataset.firstAnswer = "true";
        container.append(wrapper);
      });
    }

    function renderLockedFields(container, question, snapshot) {
      question.fields.forEach(function (field) {
        const wrapper = createElement(document, "div", "answer-field");
        const value = answerValue(snapshot, question.id, field.id);
        wrapper.append(
          createElement(document, "strong", "", field.label),
          createElement(document, "p", "saved-answer", value || "Inget svar")
        );
        container.append(wrapper);
      });
    }

    function pointButtons(question, grade, action, label) {
      const group = createElement(document, "div", "point-choices");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", label);
      for (let points = 0; points <= question.points + 0.001; points += 0.5) {
        const normalized = Math.round(points * 2) / 2;
        const button = createElement(document, "button", "neutral-button", formatPoints(normalized));
        button.type = "button";
        button.setAttribute("aria-label", `${formatPoints(normalized)} av ${formatPoints(question.points)} poäng`);
        button.setAttribute("aria-pressed", String(Boolean(grade.selfAssessed || grade.overridden) && grade.earned === normalized));
        button.addEventListener("click", function () {
          action(normalized);
          render();
          announce(`Poängen för uppgift ${question.slot} uppdaterades.`);
        });
        group.append(button);
      }
      return group;
    }

    function renderGrade(question, snapshot) {
      const grade = snapshot.grades[question.id];
      const section = createElement(document, "section", "grade");
      const heading = createElement(document, "h2", "", "Bedömning");
      const summary = createElement(document, "div", "grade-summary");
      summary.append(
        createElement(document, "strong", "", `${formatPoints(grade.earned)} av ${formatPoints(grade.possible)} poäng`),
        createElement(document, "span", "", gradeLabel(grade.status))
      );
      section.append(heading, summary, createElement(document, "p", "grade-message", grade.message));

      const fieldList = createElement(document, "ul", "field-results");
      question.fields.forEach(function (field) {
        const result = grade.fieldResults[field.id];
        if (!result) return;
        const item = createElement(document, "li");
        item.append(createElement(document, "strong", "", `${field.label}: ${gradeLabel(result.status)}`));
        const interpreted = interpretedText(result.interpreted);
        if (interpreted) item.append(createElement(document, "p", "interpreted-answer", `Tolkat svar: ${interpreted}`));
        if (result.message) item.append(createElement(document, "p", "grade-message", result.message));
        fieldList.append(item);
      });
      if (fieldList.children.length) section.append(fieldList);

      if (grade.requiresSelfAssessment) {
        const manual = createElement(document, "section", "manual-grade");
        manual.append(createElement(document, "h3", "", "Bedöm din lösning"));
        if (question.rubric.length) {
          const rubric = createElement(document, "ul", "rubric");
          question.rubric.forEach(function (item) {
            rubric.append(createElement(document, "li", "", `${formatPoints(item.points)} p – ${item.text}`));
          });
          manual.append(rubric);
        }
        manual.append(pointButtons(question, grade, function (points) {
          session.setSelfGrade(question.id, points);
        }, "Självbedömning"));
        section.append(manual);
      }

      const override = createElement(document, "details", "override-grade");
      override.append(createElement(document, "summary", "", "Ändra poängen manuellt"));
      override.append(pointButtons(question, grade, function (points) {
        session.overrideGrade(question.id, points);
      }, "Manuell poängändring"));
      section.append(override);
      return section;
    }

    function renderPrintExam(snapshot) {
      const print = createElement(document, "section", "print-exam");
      print.setAttribute("aria-hidden", "true");
      print.append(createElement(document, "h1", "", subject.name));
      snapshot.questionIds.forEach(function (questionId, position) {
        const question = index[questionId];
        const article = createElement(document, "article", "print-question");
        article.append(createElement(document, "h2", "", `Uppgift ${position + 1}: ${question.title} (${formatPoints(question.points)} p)`));
        article.append(setHtml(createElement(document, "div", "prompt"), question.promptHtml));
        article.append(createElement(document, "div", "print-answer-space"));
        print.append(article);
      });
      return print;
    }

    function renderTotal(snapshot, container) {
      if (!snapshot.result) return;
      const result = createElement(document, "section", "exam-total");
      const preliminary = snapshot.result.status === "preliminary";
      result.append(
        createElement(document, "strong", "", `${preliminary ? "Preliminärt: " : "Resultat: "}${formatPoints(snapshot.result.earned)} av ${formatPoints(snapshot.result.possible)} poäng`),
        createElement(document, "span", "", preliminary ? "Slutför självbedömningen för ett slutligt resultat." : snapshot.result.earned >= subject.passPoints ? "Godkänd nivå uppnådd." : "Godkänd nivå är inte uppnådd ännu.")
      );
      container.append(result);
    }

    function unansweredCount() {
      const snapshot = currentViewSnapshot();
      return snapshot.questionIds.filter(function (questionId) {
        return questionStatus(snapshot, questionId).state === "unanswered";
      }).length;
    }

    function openSubmitDialog() {
      const count = unansweredCount();
      if (elements.submitMessage) {
        elements.submitMessage.textContent = count
          ? `${count} ${count === 1 ? "uppgift är" : "uppgifter är"} obesvarad${count === 1 ? "" : "e"}. När provet rättas låses alla svar.`
          : "Alla uppgifter har ett svar. När provet rättas låses alla svar.";
      }
      showDialog(elements.submitDialog);
    }

    function render() {
      if (!session) return;
      const snapshot = currentSnapshot();
      const questionId = snapshot.questionIds[snapshot.currentIndex];
      const question = index[questionId];
      const article = createElement(document, "article", "question-screen");
      const header = createElement(document, "header", "question-header");
      const heading = createElement(document, "div", "question-heading");
      heading.append(
        createElement(document, "p", "", `Uppgift ${snapshot.currentIndex + 1} av ${snapshot.questionIds.length} · ${formatPoints(question.points)} poäng`),
        createElement(document, "h1", "", question.title)
      );
      const flag = createElement(document, "button", "neutral-button flag-button", snapshot.flags.includes(questionId) ? "Avmarkera" : "Markera");
      flag.type = "button";
      flag.setAttribute("aria-pressed", String(snapshot.flags.includes(questionId)));
      flag.addEventListener("click", function () {
        session.toggleFlag(questionId);
        render();
      });
      header.append(heading, flag);
      article.append(header, setHtml(createElement(document, "div", "prompt"), question.promptHtml));

      const answers = createElement(document, "section", "answer-area");
      answers.setAttribute("aria-label", "Svar");
      if (snapshot.status === "active") renderActiveFields(answers, question, snapshot);
      else renderLockedFields(answers, question, snapshot);
      article.append(answers);

      if (snapshot.status === "graded") {
        article.append(renderGrade(question, snapshot));
        const solutionControls = createElement(document, "div", "solution-controls");
        const solutionButton = createElement(document, "button", "neutral-button", canShowSolution(snapshot, questionId) ? "Dölj lösning" : "Visa lösning");
        solutionButton.type = "button";
        solutionButton.setAttribute("aria-expanded", String(canShowSolution(snapshot, questionId)));
        solutionButton.addEventListener("click", function () {
          session.toggleSolution(questionId);
          render();
        });
        solutionControls.append(solutionButton);
        article.append(solutionControls);
        if (canShowSolution(snapshot, questionId)) {
          const solution = createElement(document, "section", "solution");
          solution.append(createElement(document, "h2", "", "Lösning"));
          solution.append(setHtml(createElement(document, "div"), question.solutionHtml));
          article.append(solution);
        }
        renderTotal(snapshot, article);
      }

      const controls = createElement(document, "nav", "screen-controls");
      controls.setAttribute("aria-label", "Navigera i provet");
      const previous = createElement(document, "button", "neutral-button", "Föregående");
      const next = createElement(document, "button", "neutral-button next-button", "Nästa");
      previous.type = "button";
      next.type = "button";
      previous.disabled = snapshot.currentIndex === 0;
      next.disabled = snapshot.currentIndex === snapshot.questionIds.length - 1;
      previous.addEventListener("click", function () {
        session.navigate(snapshot.currentIndex - 1);
        render();
        rootElement.focus();
      });
      next.addEventListener("click", function () {
        session.navigate(snapshot.currentIndex + 1);
        render();
        rootElement.focus();
      });
      controls.append(previous);
      if (snapshot.status === "active") {
        const submit = createElement(document, "button", "primary-button submit-button", "Rätta provet");
        submit.type = "button";
        submit.addEventListener("click", openSubmitDialog);
        controls.append(submit);
      }
      controls.append(next);
      article.append(controls);

      rootElement.replaceChildren(article, renderPrintExam(snapshot));
      if (elements.sessionState) {
        elements.sessionState.textContent = snapshot.status === "active"
          ? "Pågående prov"
          : snapshot.result && snapshot.result.status === "preliminary" ? "Preliminärt resultat" : "Rättat prov";
      }
      renderNavigation();
      renderTimer();
    }

    function startNewSession() {
      try {
        session = KS.exam.createSession(subject, slots, store);
      } catch (error) {
        renderMissingBank(rootElement);
        return false;
      }
      closeDialog(elements.recoveryDialog);
      render();
      if (store.warning) announce(store.warning);
      return true;
    }

    function restoreSavedSession(saved) {
      try {
        session = KS.exam.restoreSession(saved, index, store);
        closeDialog(elements.recoveryDialog);
        render();
        if (store.warning) announce(store.warning);
        return true;
      } catch (error) {
        session = null;
        showRestoreFailure();
        return false;
      }
    }

    let recoveryProblem = false;

    function resetRecoveryChoice() {
      elements.recoveryDialog.dataset.confirming = "false";
      elements.recoveryMessage.textContent = recoveryProblem
        ? "Det sparade provet kunde inte återställas. Försök igen eller starta ett nytt prov."
        : "Fortsätt där du slutade eller starta ett nytt prov.";
      elements.recoveryContinue.hidden = false;
      elements.recoveryContinue.textContent = recoveryProblem ? "Försök igen" : "Fortsätt provet";
      elements.recoveryBack.hidden = true;
      elements.recoveryNew.textContent = "Starta nytt";
      elements.recoveryNew.className = "neutral-button";
    }

    function prepareReplacementConfirmation() {
      elements.recoveryDialog.dataset.confirming = "true";
      elements.recoveryMessage.textContent = "Det sparade provet ersätts. Den åtgärden går inte att ångra.";
      elements.recoveryContinue.hidden = true;
      elements.recoveryBack.hidden = false;
      elements.recoveryNew.textContent = "Ersätt med nytt prov";
      elements.recoveryNew.className = "primary-button";
    }

    function showRestoreFailure() {
      recoveryProblem = true;
      resetRecoveryChoice();
      if (elements.sessionState) elements.sessionState.textContent = "Det sparade provet kunde inte öppnas";
      announce("Det sparade provet kunde inte återställas. Inget sparat prov har skrivits över.");
      showDialog(elements.recoveryDialog);
    }

    if (elements.timerStart) elements.timerStart.addEventListener("click", function () {
      updateTimer(function (state) { return KS.timer.start(state, Date.now()); });
      announce("Tidtagningen startade.");
    });
    if (elements.timerPause) elements.timerPause.addEventListener("click", function () {
      updateTimer(function (state) { return KS.timer.pause(state, Date.now()); });
      announce("Tidtagningen pausades.");
    });
    if (elements.timerReset) elements.timerReset.addEventListener("click", function () {
      updateTimer(function (state) { return KS.timer.reset(state); });
      announce("Tidtagningen återställdes.");
    });

    if (elements.submitConfirm) elements.submitConfirm.addEventListener("click", function () {
      updateTimer(function (state) { return KS.timer.pause(state, Date.now()); });
      session.submit();
      closeDialog(elements.submitDialog);
      render();
      announce("Provet är rättat och svaren är låsta.");
    });

    if (elements.historyOpen) elements.historyOpen.addEventListener("click", function () {
      showDialog(elements.historyDialog);
    });
    if (elements.historyConfirm) elements.historyConfirm.addEventListener("click", function () {
      store.clearHistory();
      closeDialog(elements.historyDialog);
      announce("Frågehistoriken rensades.");
    });

    document.querySelectorAll("[data-dialog-close]").forEach(function (button) {
      button.addEventListener("click", function () { closeDialog(button.closest("dialog")); });
    });

    const formulaHtml = subjectData.formulaSheetHtml || subjectData.formulaHtml || "";
    if (formulaHtml && elements.formulaOpen && elements.formulaContent) {
      elements.formulaOpen.hidden = false;
      setHtml(elements.formulaContent, formulaHtml);
      elements.formulaOpen.addEventListener("click", function () { showDialog(elements.formulaDialog); });
    }

    if (elements.printExam) elements.printExam.addEventListener("click", function () {
      document.body.removeAttribute("data-print-mode");
      win.print();
    });
    if (elements.printFormula) elements.printFormula.addEventListener("click", function () {
      document.body.dataset.printMode = "formula";
      win.print();
    });
    if (win) win.addEventListener("afterprint", function () {
      document.body.removeAttribute("data-print-mode");
    });

    if (elements.recoveryContinue) elements.recoveryContinue.addEventListener("click", function () {
      const saved = store.loadActive();
      if (store.activeReadStatus === "corrupt") showRestoreFailure();
      else if (saved) restoreSavedSession(saved);
      else startNewSession();
    });
    if (elements.recoveryNew) elements.recoveryNew.addEventListener("click", function () {
      if (elements.recoveryDialog.dataset.confirming === "true") {
        startNewSession();
        return;
      }
      prepareReplacementConfirmation();
    });
    if (elements.recoveryBack) elements.recoveryBack.addEventListener("click", function () {
      resetRecoveryChoice();
    });
    if (elements.recoveryDialog) elements.recoveryDialog.addEventListener("cancel", function (event) {
      if (!session) event.preventDefault();
    });

    const saved = store.loadActive();
    if (store.activeReadStatus === "corrupt") {
      showRestoreFailure();
    } else if (saved && saved.subjectId === subject.id) {
      showDialog(elements.recoveryDialog);
      if (elements.sessionState) elements.sessionState.textContent = "Sparat prov hittades";
    } else {
      startNewSession();
    }

    timerInterval = win.setInterval(renderTimer, 1000);
    if (win) win.addEventListener("pagehide", function () {
      if (timerInterval !== null) win.clearInterval(timerInterval);
    }, { once: true });

    return { ok: true };
  }

  function autoMount() {
    if (!root || !root.document) return;
    const rootElement = root.document.getElementById("exam-app");
    if (rootElement) mount(rootElement, root.KS_SUBJECT_DATA);
  }

  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", autoMount, { once: true });
    else autoMount();
  }

  return {
    mount: mount,
    questionStatus: questionStatus,
    canShowSolution: canShowSolution
  };
});
