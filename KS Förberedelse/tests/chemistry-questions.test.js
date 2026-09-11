const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const chemistry = require("../assets/js/chemistry-parser.js");
const exam = require("../assets/js/exam-engine.js");
const grading = require("../assets/js/grading.js");

const CHEMISTRY_ROOT = path.join(__dirname, "../Kemi KS");
const SLOT_NUMBERS = [1, 2, 3, 4, 5, 6];
const SLOT_WEIGHTS = [4, 7, 2, 2, 2, 3];
const SLOT_SKILLS = [
  "atomic-structure",
  "reactions-and-stoichiometry",
  "electron-formulas-and-polarity",
  "bonding-and-phase-change",
  "stoichiometry-and-gas-law",
  "composition-and-concentration"
];
const ATOMIC_MASSES = {
  H: 1.01,
  B: 10.8,
  C: 12.0,
  N: 14.0,
  O: 16.0,
  F: 19.0,
  Na: 23.0,
  Mg: 24.3,
  Al: 27.0,
  Si: 28.1,
  P: 31.0,
  S: 32.1,
  Cl: 35.5,
  K: 39.1,
  Ca: 40.1,
  Fe: 55.8,
  Cu: 63.5,
  Zn: 65.4,
  Ag: 107.9,
  Ba: 137.3
};

function slotFiles() {
  return SLOT_NUMBERS.map((slot) => path.join(CHEMISTRY_ROOT, `questions/slot-${slot}.js`));
}

function assertBankFilesExist() {
  const expected = slotFiles().concat(path.join(CHEMISTRY_ROOT, "questions.js"));
  const missing = expected.filter((file) => !fs.existsSync(file)).map((file) => path.relative(CHEMISTRY_ROOT, file));
  assert.deepEqual(missing, [], `missing chemistry bank files: ${missing.join(", ")}`);
}

function loadSlots() {
  assertBankFilesExist();
  return Object.fromEntries(SLOT_NUMBERS.map((slot) => [slot, require(path.join(CHEMISTRY_ROOT, `questions/slot-${slot}.js`))]));
}

function loadSubjectDataFresh() {
  assertBankFilesExist();
  const files = slotFiles().concat(path.join(CHEMISTRY_ROOT, "questions.js"));
  files.forEach((file) => { delete require.cache[require.resolve(file)]; });
  return require(path.join(CHEMISTRY_ROOT, "questions.js"));
}

function allQuestions() {
  return Object.values(loadSlots()).flat();
}

function close(actual, expected, relative = 1e-10) {
  return Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(actual), Math.abs(expected));
}

function roundSignificant(value, figures) {
  if (value === 0) return 0;
  const power = figures - 1 - Math.floor(Math.log10(Math.abs(value)));
  const scale = 10 ** power;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function formatSignificant(value, figures) {
  if (value === 0) return `0,${"0".repeat(figures - 1)}`;
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  return value.toFixed(Math.max(0, figures - 1 - exponent)).replace(".", ",");
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function addCounts(target, source, multiplier = 1) {
  Object.entries(source).forEach(([symbol, count]) => {
    target[symbol] = (target[symbol] || 0) + count * multiplier;
  });
  return target;
}

// Deliberately independent from assets/js/chemistry-parser.js. This is the
// arithmetic oracle for molar masses and conservation, not an equivalence check.
function parseFormulaOracle(raw) {
  let formula = raw.replace(/\s+/g, "").replace(/\((s|l|g|aq)\)$/u, "");
  let charge = 0;
  const caretCharge = formula.match(/\^([1-9]\d*)?([+-])$/u);
  const simpleCharge = caretCharge ? null : formula.match(/([+-])$/u);
  if (caretCharge) {
    charge = (caretCharge[1] ? Number(caretCharge[1]) : 1) * (caretCharge[2] === "+" ? 1 : -1);
    formula = formula.slice(0, -caretCharge[0].length);
  } else if (simpleCharge) {
    charge = simpleCharge[1] === "+" ? 1 : -1;
    formula = formula.slice(0, -1);
  }

  function componentCounts(component) {
    let position = 0;
    function sequence(inGroup) {
      const counts = {};
      let items = 0;
      while (position < component.length && component[position] !== ")") {
        let nested;
        if (component[position] === "(") {
          position += 1;
          nested = sequence(true);
          assert.equal(component[position], ")", `${raw}: missing closing parenthesis`);
          position += 1;
        } else {
          const match = component.slice(position).match(/^[A-Z][a-z]?/u);
          assert.ok(match, `${raw}: invalid element at ${component.slice(position)}`);
          nested = { [match[0]]: 1 };
          position += match[0].length;
        }
        const digits = component.slice(position).match(/^\d+/u);
        const multiplier = digits ? Number(digits[0]) : 1;
        if (digits) position += digits[0].length;
        addCounts(counts, nested, multiplier);
        items += 1;
      }
      assert.ok(items > 0, `${raw}: empty formula group`);
      if (inGroup) assert.ok(position < component.length, `${raw}: unterminated group`);
      return counts;
    }
    const result = sequence(false);
    assert.equal(position, component.length, `${raw}: trailing formula content`);
    return result;
  }

  const totals = {};
  formula.split("·").forEach((rawComponent, index) => {
    const leading = index === 0 ? null : rawComponent.match(/^([1-9]\d*)(?=[A-Z(])/u);
    const multiplier = leading ? Number(leading[1]) : 1;
    const component = leading ? rawComponent.slice(leading[1].length) : rawComponent;
    addCounts(totals, componentCounts(component), multiplier);
  });
  return { elements: totals, charge };
}

function molarMassOracle(formula) {
  const parsed = parseFormulaOracle(formula);
  return Object.entries(parsed.elements).reduce((sum, [symbol, count]) => {
    assert.ok(Object.hasOwn(ATOMIC_MASSES, symbol), `${formula}: no fixed mass for ${symbol}`);
    return sum + ATOMIC_MASSES[symbol] * count;
  }, 0);
}

function parseEquationOracle(raw) {
  const sides = raw.split(/\s*(?:->|→|=)\s*/u);
  assert.equal(sides.length, 2, `${raw}: equation must have one arrow`);
  return sides.map((side) => side.split(/\s+\+\s+/u).map((rawSpecies) => {
    const coefficient = rawSpecies.match(/^([1-9]\d*)\s*/u);
    const formula = coefficient ? rawSpecies.slice(coefficient[0].length) : rawSpecies;
    return {
      coefficient: coefficient ? Number(coefficient[1]) : 1,
      rawFormula: formula.replace(/\((?:s|l|g|aq)\)$/u, ""),
      formula: parseFormulaOracle(formula)
    };
  }));
}

function speciesWithFormula(side, formula, equation) {
  const species = side.find((candidate) => candidate.rawFormula === formula);
  assert.ok(species, `${equation}: missing species ${formula}`);
  return species;
}

function assertBalancedOracle(raw) {
  const [reactants, products] = parseEquationOracle(raw);
  function sideTotals(side) {
    return side.reduce((totals, species) => {
      addCounts(totals.elements, species.formula.elements, species.coefficient);
      totals.charge += species.formula.charge * species.coefficient;
      return totals;
    }, { elements: {}, charge: 0 });
  }
  assert.deepEqual(sideTotals(reactants), sideTotals(products), raw);
}

function equationFields(question) {
  return question.fields.filter((field) => field.kind === "chemical-equation");
}

function numericField(question, id) {
  const field = question.fields.find((candidate) => candidate.id === id);
  assert.ok(field, `${question.id}: missing ${id}`);
  assert.equal(field.kind, "numeric", `${question.id}: ${id}`);
  return field;
}

function seededRng(seed) {
  let value = seed >>> 0;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function memoryStore() {
  let history = { schemaVersion: 1, slots: {} };
  let active = null;
  return {
    loadHistory() { return structuredClone(history); },
    saveHistory(next) { history = structuredClone(next); return { ok: true, persisted: true }; },
    saveActive(next) { active = structuredClone(next); return { ok: true, persisted: true }; },
    get active() { return active; }
  };
}

test("chemistry has exactly 20 deterministic questions in each weighted slot", () => {
  const slots = loadSlots();
  assert.deepEqual(Object.values(slots).map((slot) => slot.length), [20, 20, 20, 20, 20, 20]);
  assert.deepEqual(Object.values(slots).map((slot) => new Set(slot.map((question) => question.points))), [new Set([4]), new Set([7]), new Set([2]), new Set([2]), new Set([2]), new Set([3])]);
  const questions = Object.values(slots).flat();
  assert.equal(new Set(questions.map((question) => question.id)).size, 120);
  assert.equal(new Set(questions.map((question) => question.promptHtml)).size, 120);
  assert.ok(questions.reduce((sum, question) => sum + question.fields.length, 0) > 120);

  const firstIds = questions.map((question) => question.id);
  slotFiles().forEach((file) => { delete require.cache[require.resolve(file)]; });
  assert.deepEqual(Object.values(loadSlots()).flat().map((question) => question.id), firstIds);
});

test("every chemistry question satisfies the real engine field and rubric contract", () => {
  const subjectData = loadSubjectDataFresh();
  assert.doesNotThrow(() => exam.createSession(subjectData.config, subjectData.slots, memoryStore(), seededRng(1)));

  allQuestions().forEach((question) => {
    assert.equal(question.slot >= 1 && question.slot <= 6, true, question.id);
    assert.equal(question.points, SLOT_WEIGHTS[question.slot - 1], question.id);
    assert.match(question.id, /^chemistry-s[1-6]-[a-z0-9-]+-\d{2}$/u, question.id);
    assert.ok(question.title.trim(), question.id);
    assert.ok(question.promptHtml.length >= 90, `${question.id}: prompt detail`);
    assert.ok(question.solutionHtml.length >= 140, `${question.id}: complete solution`);
    assert.ok(Array.isArray(question.rubric) && question.rubric.length > 0, `${question.id}: rubric`);
    assert.equal(question.rubric.reduce((sum, item) => sum + item.points, 0), question.points, `${question.id}: rubric capacity`);
    assert.equal(question.fields.reduce((sum, field) => sum + field.points, 0), question.points, `${question.id}: field points`);
    assert.equal(new Set(question.fields.map((field) => field.id)).size, question.fields.length, `${question.id}: field ids`);
    assert.equal(question.sourceData.skill, SLOT_SKILLS[question.slot - 1], question.id);
    assert.ok(Number.isInteger(question.sourceData.caseNumber), `${question.id}: case number`);
    assert.doesNotMatch(question.promptHtml + question.solutionHtml, /TODO|TBD|platshållare/iu, question.id);
    question.fields.filter((field) => field.applied).forEach((field) => {
      assert.equal(typeof field.targetUnit, "string", `${question.id}/${field.id}: target unit`);
      assert.ok(Number.isInteger(field.significantFigures), `${question.id}/${field.id}: significant figures`);
      assert.match(field.label, /värdesiffror/u, `${question.id}/${field.id}: rounding in label`);
      assert.ok(field.requestedUnitLabel && field.label.includes(field.requestedUnitLabel), `${question.id}/${field.id}: exact requested unit`);
    });
  });
});

test("slot structures and curriculum topic rotations are explicit and complete", () => {
  const slots = loadSlots();
  const slotOneTopics = new Set();
  let bohrGroups = 0;
  let amountGroups = 0;
  slots[1].forEach((question) => {
    assert.deepEqual(question.fields.map((field) => field.points), [1, 1, 1, 1], question.id);
    question.sourceData.subtopics.forEach((topic) => slotOneTopics.add(topic));
    if (question.sourceData.subtopics.includes("bohr-model")) {
      bohrGroups += 1;
      assert.equal(question.fields.some((field) => field.kind === "self"), true, question.id);
      assert.match(question.rubric.map((item) => item.text).join(" "), /kärna.*elektron|elektron.*skal/iu, question.id);
    }
    if (question.sourceData.subtopics.includes("amount-from-concentration")) amountGroups += 1;
  });
  ["isotope-comparison", "terminology", "bohr-model", "valence-electrons", "ion-notation", "amount-from-concentration"].forEach((topic) => assert.ok(slotOneTopics.has(topic), topic));
  assert.equal(bohrGroups, 10);
  assert.equal(amountGroups, 10);

  const reactionFamilies = {};
  const rotations = new Set();
  slots[2].forEach((question) => {
    assert.deepEqual(question.fields.map((field) => field.points), [2, 3, 2], question.id);
    assert.deepEqual(question.fields.map((field) => field.kind), ["chemical-equation", "numeric", "chemical-equation"], question.id);
    assert.equal(question.fields[0].requireStates, true, question.id);
    assert.equal(question.fields[2].requireStates, true, question.id);
    assert.equal(question.fields[0].statePoints, 1, question.id);
    assert.equal(question.fields[2].statePoints, 1, question.id);
    reactionFamilies[question.sourceData.family] = (reactionFamilies[question.sourceData.family] || 0) + 1;
    rotations.add(question.sourceData.rotationElement);
  });
  assert.deepEqual(reactionFamilies, { hydrate: 10, formation: 10 });
  ["calcium", "magnesium", "copper", "iron", "sodium", "ammonium"].forEach((name) => assert.ok(rotations.has(name), name));

  const requiredMolecules = new Set(["NH3", "H2O", "H2S", "SO2", "CO2", "CH3Cl", "CH2Cl2", "BF3"]);
  slots[3].forEach((question) => {
    requiredMolecules.delete(question.sourceData.molecule);
    assert.deepEqual(question.fields.map((field) => field.points), [1, 1], question.id);
    assert.deepEqual(question.fields.map((field) => field.kind), ["self", "self"], question.id);
    assert.match(question.rubric.map((item) => item.text).join(" "), /elektron|geometri/iu, question.id);
    assert.match(question.rubric.map((item) => item.text).join(" "), /dipol|laddningsförskjutning|symmetri/iu, question.id);
  });
  assert.deepEqual(Array.from(requiredMolecules), []);

  const bondTypes = new Set();
  slots[4].forEach((question) => {
    assert.deepEqual(question.fields.map((field) => [field.kind, field.points]), [["self", 2]], question.id);
    assert.ok([4, 5].includes(question.sourceData.items.length), question.id);
    question.sourceData.items.forEach((item) => bondTypes.add(item.bondType));
    assert.deepEqual(question.rubric.map((item) => item.points), [0.5, 0.5, 0.5, 0.5], `${question.id}: one checklist point per part`);
    assert.deepEqual(question.rubric.map((item) => item.text.match(/^Del ([a-d])/u)?.[1]), ["a", "b", "c", "d"], `${question.id}: concrete a–d checklist`);
    assert.ok(question.sourceData.items.some((item) => item.process === "phase-change"), question.id);
    assert.ok(question.sourceData.items.some((item) => item.process === "reaction"), question.id);
  });
  ["metallic", "ionic", "hydrogen", "dipole-dipole", "dispersion", "covalent-intramolecular"].forEach((type) => assert.ok(bondTypes.has(type), type));

  const gasUnits = new Set();
  const gasInputs = new Set();
  slots[5].forEach((question) => {
    assert.deepEqual(question.fields.map((field) => [field.kind, field.points]), [["numeric", 2]], question.id);
    const field = question.fields[0];
    gasUnits.add(field.targetUnit);
    gasInputs.add(question.sourceData.inputType);
    assert.match(question.promptHtml, /pV\s*=\s*nRT|allmänna gaslagen/iu, question.id);
  });
  assert.deepEqual(gasUnits, new Set(["dm3", "m3"]));
  assert.deepEqual(gasInputs, new Set(["mass", "amount"]));

  const compositionFamilies = slots[6].reduce((counts, question) => {
    counts[question.sourceData.family] = (counts[question.sourceData.family] || 0) + 1;
    assert.deepEqual(question.fields.map((field) => field.points), [1, 2], question.id);
    return counts;
  }, {});
  assert.deepEqual(compositionFamilies, { empirical: 8, "formula-unit": 6, concentration: 6 });
});

test("terminology aliases are not used to grade chemistry notation or explanations", () => {
  allQuestions().forEach((question) => {
    question.fields.forEach((field) => {
      if (field.kind === "aliases") assert.equal(field.purpose, "terminology", `${question.id}/${field.id}`);
      if (/formula|equation|jonbeteckning/u.test(field.purpose || "")) {
        assert.ok(["chemical-formula", "chemical-equation"].includes(field.kind), `${question.id}/${field.id}`);
      }
    });
  });
});

test("source-specific compound and process anchors are not reused as authored cases", () => {
  const slots = loadSlots();
  const compact = (value) => value.replace(/\s+/gu, "").replace(/\((?:aq|s|l|g)\)/gu, "");
  const primaryEquations = slots[2].map((question) => compact(question.sourceData.primaryEquation));
  const bondProcesses = slots[4].flatMap((question) => question.sourceData.items.map((item) => compact(item.text)));
  const empiricalInputs = slots[6].filter((question) => question.sourceData.family === "empirical").map((question) => question.sourceData.molecularFormula);

  assert.equal(primaryEquations.includes("2Na+Cl2->2NaCl"), false, "HT25 sodium/chlorine formation anchor");
  assert.equal(bondProcesses.some((item) => item.includes("MgSO4→MgSO4")), false, "VT24 magnesium-sulfate phase anchor");
  assert.equal(bondProcesses.some((item) => item.includes("I2") && /sublimer/iu.test(item)), false, "VT25 iodine sublimation anchor");
  ["C3H6O3", "C4H8O2", "C6H12O6"].forEach((formula) => {
    assert.equal(empiricalInputs.includes(formula), false, `source molecular formula ${formula}`);
  });
  allQuestions().forEach((question) => {
    assert.doesNotMatch(question.promptHtml, /av samma grundämne som har olika/iu, `${question.id}: VT26 six-word wording anchor`);
  });
  slots[5].forEach((question) => {
    assert.notEqual(question.sourceData.inputFormula, "KClO3", `${question.id}: VT26 gas-law reactant`);
    assert.notEqual(question.sourceData.inputFormula, "C6H12O6", `${question.id}: HT25 gas-law reactant`);
    assert.notEqual(question.sourceData.inputFormula, "C3H8", `${question.id}: HT24 combustion reactant`);
  });
});

test("reaction scenarios do not contradict the stated excess-reactant assumption", () => {
  loadSlots()[2].forEach((question) => {
    assert.doesNotMatch(question.promptHtml, /lika stora substansmängder[\s\S]*andra reaktanten finns i överskott/iu, question.id);
  });
});

test("every canonical automatic answer earns its exact field points", () => {
  const graders = {
    numeric: grading.gradeNumeric,
    aliases: grading.gradeAliases,
    "chemical-formula": grading.gradeChemicalFormula,
    "chemical-equation": grading.gradeChemicalEquation
  };
  allQuestions().forEach((question) => {
    question.fields.filter((field) => field.kind !== "self").forEach((field) => {
      const raw = field.kind === "numeric" ? `${field.expected}${field.targetUnit ? ` ${field.targetUnit}` : ""}` : field.expected;
      const result = graders[field.kind](field, raw);
      assert.equal(result.status, "correct", `${question.id}/${field.id}: ${result.message}`);
      assert.equal(result.earned, field.points, `${question.id}/${field.id}`);
      assert.equal(result.possible, field.points, `${question.id}/${field.id}`);
    });
  });
});

test("applied solutions preserve the requested significant trailing zeros", () => {
  allQuestions().forEach((question) => {
    question.fields.filter((field) => field.applied).forEach((field) => {
      const rendered = formatSignificant(field.expected, field.significantFigures);
      assert.ok(question.solutionHtml.includes(rendered), `${question.id}/${field.id}: expected visible ${rendered}`);
    });
  });
});

test("mixed manual and automatic chemistry work preserves earned automatic credit", () => {
  const sourceQuestion = loadSlots()[1].find((question) => question.fields.some((field) => field.kind === "self"));
  const subject = { id: "chemistry-mixed", questionCount: 1, maxPoints: 4, passPoints: 2, durationMinutes: 1 };
  const session = exam.createSession(subject, { 1: [sourceQuestion] }, memoryStore(), seededRng(2));
  sourceQuestion.fields.forEach((field) => {
    const raw = field.kind === "self" ? "Ritad på papper" : field.kind === "numeric" ? `${field.expected}${field.targetUnit ? ` ${field.targetUnit}` : ""}` : field.expected;
    session.setAnswer(sourceQuestion.id, field.id, raw);
  });
  session.submit();
  const grade = session.snapshot().grades[sourceQuestion.id];
  const automaticPoints = sourceQuestion.fields.filter((field) => field.kind !== "self").reduce((sum, field) => sum + field.points, 0);
  assert.equal(grade.status, "self");
  assert.equal(grade.earned, automaticPoints);
  assert.equal(grade.possible, 4);
});

test("the local atomic-mass map is anchored to the supplied VT26 periodic table", () => {
  const subjectData = loadSubjectDataFresh();
  assert.deepEqual(subjectData.atomicMasses, ATOMIC_MASSES);
  assert.deepEqual(
    { H: subjectData.atomicMasses.H, C: subjectData.atomicMasses.C, O: subjectData.atomicMasses.O, Mg: subjectData.atomicMasses.Mg, S: subjectData.atomicMasses.S, Cl: subjectData.atomicMasses.Cl, Fe: subjectData.atomicMasses.Fe, Cu: subjectData.atomicMasses.Cu },
    { H: 1.01, C: 12.0, O: 16.0, Mg: 24.3, S: 32.1, Cl: 35.5, Fe: 55.8, Cu: 63.5 }
  );
  assert.equal(subjectData.formulaSheetUrl, "assets/formelblad-ks.png");
});

test("slot 1 isotope, shell, ion and concentration answers recompute independently", () => {
  const atomicNumbers = { H: 1, Li: 3, B: 5, C: 6, N: 7, O: 8, F: 9, Ne: 10, Na: 11, Mg: 12, Al: 13, Si: 14, P: 15, S: 16, Cl: 17, K: 19, Ca: 20, Fe: 26, Cu: 29, Zn: 30 };
  const valenceCounts = { H: 1, Li: 1, B: 3, C: 4, Ne: 8, Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, K: 1, Ca: 2, Fe: 2, Cu: 1, Zn: 2 };
  const questions = loadSlots()[1];

  questions.forEach((question) => {
    const data = question.sourceData;
    assert.equal(data.atomicNumber, atomicNumbers[data.symbol], `${question.id}: atomic number`);
    const isotopeAnswer = data.isotopeTask === "neutrons"
      ? data.massNumber - atomicNumbers[data.symbol]
      : Math.abs(data.massNumber - data.comparisonMass);
    assert.equal(numericField(question, "isotope").expected, isotopeAnswer, `${question.id}: isotope arithmetic`);

    if (data.subtopics.includes("bohr-model")) {
      assert.equal(data.shells.reduce((sum, count) => sum + count, 0), atomicNumbers[data.symbol], `${question.id}: neutral shell total`);
      const ion = parseFormulaOracle(data.ion);
      assert.deepEqual(ion.elements, { [data.symbol]: 1 }, `${question.id}: simple-ion element`);
      const outerElectrons = data.shells.at(-1);
      const expectedCharge = outerElectrons <= 3 ? outerElectrons : -(8 - outerElectrons);
      assert.equal(ion.charge, expectedCharge, `${question.id}: octet ion charge`);
    } else {
      assert.equal(numericField(question, "valence").expected, valenceCounts[data.symbol], `${question.id}: valence electrons`);
      const amount = roundSignificant(data.concentration * data.volumeDm3, data.significantFigures);
      assert.equal(numericField(question, "amount").expected, amount, `${question.id}: n = cV`);
    }
  });

  assert.deepEqual(questions[0].fields.map((field) => field.expected), [8, "isotoper", undefined, "N^3-"]);
  assert.equal(numericField(questions[10], "amount").expected, 0.0084);
});

test("all expected equations independently conserve every atom and total charge", () => {
  allQuestions().forEach((question) => {
    const equations = equationFields(question).map((field) => field.expected);
    if (question.slot === 5) equations.push(question.sourceData.reaction);
    equations.forEach((equation) => {
      assertBalancedOracle(equation);
      assert.equal(chemistry.parseEquation(equation).ok, true, `${question.id}: parser notation ${equation}`);
    });
  });
});

test("precipitation equations name every state and retain explicit partial state credit", () => {
  loadSlots()[2].forEach((question) => {
    const field = question.fields[2];
    const parsed = chemistry.parseEquation(field.expected);
    assert.equal(parsed.ok, true, question.id);
    assert.equal(parsed.reactants.concat(parsed.products).every((item) => Boolean(item.formula.state)), true, question.id);
    assert.equal(parsed.products.some((item) => item.formula.state === "s"), true, question.id);
    const withoutStates = field.expected.replace(/\((?:aq|s|l|g)\)/gu, "");
    const partial = grading.gradeChemicalEquation(field, withoutStates);
    assert.equal(partial.status, "partial", question.id);
    assert.equal(partial.earned, field.points - field.statePoints, question.id);
  });
});

test("slot 2 molar masses, coefficient factors and product masses recompute independently", () => {
  const questions = loadSlots()[2];
  questions.forEach((question) => {
    const data = question.sourceData.stoichiometry;
    const [reactants, products] = parseEquationOracle(question.sourceData.primaryEquation);
    const inputSpecies = speciesWithFormula(reactants, data.inputFormula, question.sourceData.primaryEquation);
    const outputSpecies = speciesWithFormula(products, data.outputFormula, question.sourceData.primaryEquation);
    const inputMolarMass = molarMassOracle(data.inputFormula);
    const outputMolarMass = molarMassOracle(data.outputFormula);
    const exactOutputMass = data.inputMassG / inputMolarMass * outputSpecies.coefficient / inputSpecies.coefficient * outputMolarMass;
    assert.equal(data.inputCoefficient, inputSpecies.coefficient, `${question.id}: input coefficient`);
    assert.equal(data.outputCoefficient, outputSpecies.coefficient, `${question.id}: output coefficient`);
    assert.ok(close(data.inputMolarMassGPerMol, inputMolarMass), `${question.id}: input molar mass`);
    assert.ok(close(data.outputMolarMassGPerMol, outputMolarMass), `${question.id}: output molar mass`);
    assert.equal(numericField(question, "mass").expected, roundSignificant(exactOutputMass, data.significantFigures), question.id);
  });
  const anchor = questions[0];
  assert.equal(anchor.id, "chemistry-s2-hydrate-01");
  assert.equal(anchor.sourceData.primaryEquation, "CuSO4(s) + 5 H2O(l) -> CuSO4·5H2O(s)");
  assert.equal(anchor.sourceData.stoichiometry.inputMassG, 73.5);
  assert.equal(numericField(anchor, "mass").expected, 115);
  const formationAnchor = questions[17];
  assert.equal(formationAnchor.id, "chemistry-s2-formation-18");
  assert.equal(formationAnchor.sourceData.primaryEquation, "3 Mg(s) + N2(g) -> Mg3N2(s)");
  assert.equal(numericField(formationAnchor, "mass").expected, 20.1);
});

test("slot 5 gas values recompute from SI pressure, kelvin and balanced coefficients", () => {
  const questions = loadSlots()[5];
  questions.forEach((question) => {
    const data = question.sourceData;
    assert.ok(data.pressurePa >= 70000 && data.pressurePa <= 150000, `${question.id}: pressure`);
    assert.ok(data.temperatureK >= 250 && data.temperatureK <= 360, `${question.id}: temperature`);
    const inputMolarMass = molarMassOracle(data.inputFormula);
    const [reactants, products] = parseEquationOracle(data.reaction);
    const inputSpecies = speciesWithFormula(reactants, data.inputFormula, data.reaction);
    const gasSpecies = speciesWithFormula(products, data.gasFormula, data.reaction);
    const inputMoles = data.inputType === "mass" ? data.inputMassG / inputMolarMass : data.inputAmountMol;
    const gasMoles = inputMoles * gasSpecies.coefficient / inputSpecies.coefficient;
    const volumeM3 = gasMoles * 8.314 * data.temperatureK / data.pressurePa;
    const requested = data.targetUnit === "dm3" ? volumeM3 * 1000 : volumeM3;
    assert.ok(close(data.inputMolarMassGPerMol, inputMolarMass), `${question.id}: stored molar mass`);
    assert.equal(data.inputCoefficient, inputSpecies.coefficient, `${question.id}: input coefficient`);
    assert.equal(data.gasCoefficient, gasSpecies.coefficient, `${question.id}: gas coefficient`);
    assert.ok(close(data.gasAmountMol, gasMoles), `${question.id}: stoichiometric amount`);
    assert.ok(close(data.volumeM3, volumeM3), `${question.id}: SI gas volume`);
    assert.equal(question.fields[0].expected, roundSignificant(requested, data.significantFigures), question.id);
  });
  assert.equal(questions[0].id, "chemistry-s5-gas-01");
  assert.equal(questions[0].sourceData.reaction, "CaCO3(s) -> CaO(s) + CO2(g)");
  assert.equal(questions[0].fields[0].expected, 3.12);
});

test("slot 6 empirical formulas, formula-unit charges and concentrations recompute independently", () => {
  const questions = loadSlots()[6];
  const concentrationMultipliers = [1, 1, 2, 1, 2, 3];
  let concentrationIndex = 0;
  questions.forEach((question) => {
    const data = question.sourceData;
    if (data.family === "empirical") {
      const molecular = parseFormulaOracle(data.molecularFormula).elements;
      const molecularMass = molarMassOracle(data.molecularFormula);
      const divisor = Object.values(molecular).reduce(greatestCommonDivisor);
      const empirical = parseFormulaOracle(question.fields[0].expected).elements;
      assert.deepEqual(empirical, Object.fromEntries(Object.entries(molecular).map(([symbol, count]) => [symbol, count / divisor])), question.id);
      const percent = ATOMIC_MASSES[data.percentElement] * molecular[data.percentElement] / molecularMass * 100;
      assert.ok(close(data.exactMolarMassGPerMol, molecularMass), `${question.id}: stored molecular mass`);
      assert.equal(question.fields[1].expected, roundSignificant(percent, data.significantFigures), question.id);
    } else if (data.family === "formula-unit") {
      const cation = parseFormulaOracle(data.cation);
      const anion = parseFormulaOracle(data.anion);
      const expectedAtoms = {};
      addCounts(expectedAtoms, cation.elements, data.cationCount);
      addCounts(expectedAtoms, anion.elements, data.anionCount);
      const formulaMass = molarMassOracle(data.formula);
      assert.equal(cation.charge, data.cationCharge, `${question.id}: cation charge`);
      assert.equal(anion.charge, data.anionCharge, `${question.id}: anion charge`);
      assert.equal(data.cationCharge * data.cationCount + data.anionCharge * data.anionCount, 0, `${question.id}: neutral formula unit`);
      assert.equal(greatestCommonDivisor(data.cationCount, data.anionCount), 1, `${question.id}: simplest ratio`);
      assert.deepEqual(parseFormulaOracle(data.formula).elements, expectedAtoms, `${question.id}: formula-unit composition`);
      assert.ok(close(data.exactMolarMassGPerMol, formulaMass), `${question.id}: stored formula-unit mass`);
      assert.equal(question.fields[0].expected, data.formula, question.id);
      assert.equal(question.fields[1].expected, roundSignificant(formulaMass, data.significantFigures), question.id);
    } else {
      const soluteMass = molarMassOracle(data.soluteFormula);
      const multiplier = concentrationMultipliers[concentrationIndex];
      concentrationIndex += 1;
      const saltConcentration = data.massG / soluteMass / data.volumeDm3;
      const ionConcentration = saltConcentration * multiplier;
      assert.ok(close(data.exactMolarMassGPerMol, soluteMass), `${question.id}: stored solute mass`);
      assert.equal(data.ionMultiplier, multiplier, `${question.id}: literal dissociation factor`);
      assert.equal(question.fields[0].expected, roundSignificant(saltConcentration, data.significantFigures), `${question.id}: salt concentration`);
      assert.equal(question.fields[1].expected, roundSignificant(ionConcentration, data.significantFigures), `${question.id}: ion concentration`);
    }
  });
  assert.equal(questions[0].fields[0].expected, "CH2");
  assert.equal(questions[0].fields[1].expected, 85.6);
  assert.equal(questions[8].fields[0].expected, "Ca(NO3)2");
  assert.equal(questions[8].fields[1].expected, 164);
  assert.equal(questions[14].id, "chemistry-s6-concentration-15");
  assert.deepEqual(questions[14].fields.map((field) => field.expected), [0.25, 0.25]);
});

test("subject assembly works in CommonJS and ordered classic browser scripts", () => {
  const subjectData = loadSubjectDataFresh();
  assert.equal(subjectData.config.id, "chemistry-ks");
  assert.deepEqual(Object.keys(subjectData.slots), ["1", "2", "3", "4", "5", "6"]);

  const context = vm.createContext({ window: {} });
  [
    "../assets/js/subject-config.js",
    "questions/slot-1.js", "questions/slot-2.js", "questions/slot-3.js", "questions/slot-4.js", "questions/slot-5.js", "questions/slot-6.js", "questions.js"
  ].forEach((relative) => {
    const filename = path.resolve(CHEMISTRY_ROOT, relative);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  });
  assert.equal(context.window.KS_SUBJECT_DATA.config.id, "chemistry-ks");
  assert.deepEqual(Array.from(Object.values(context.window.KS_SUBJECT_DATA.slots), (slot) => slot.length), [20, 20, 20, 20, 20, 20]);
});

test("the chemistry page loads six slots and assembly immediately before app.js", () => {
  const html = fs.readFileSync(path.join(CHEMISTRY_ROOT, "index.html"), "utf8");
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/gu), (match) => match[1]);
  assert.deepEqual(scripts.slice(-8), [
    "questions/slot-1.js", "questions/slot-2.js", "questions/slot-3.js", "questions/slot-4.js", "questions/slot-5.js", "questions/slot-6.js", "questions.js", "../assets/js/app.js"
  ]);
});

test("1,000 real-engine exams keep six skills, twenty points and full 20-question cycles", () => {
  const subjectData = loadSubjectDataFresh();
  const store = memoryStore();
  const rng = seededRng(260911);
  const byId = Object.fromEntries(Object.values(subjectData.slots).flat().map((question) => [question.id, question]));
  const seenBySlot = Object.fromEntries(SLOT_NUMBERS.map((slot) => [slot, []]));

  for (let index = 0; index < 1000; index += 1) {
    const snapshot = exam.createSession(subjectData.config, subjectData.slots, store, rng).snapshot();
    const questions = snapshot.questionIds.map((id) => byId[id]);
    assert.equal(questions.length, 6, `exam ${index + 1}`);
    assert.equal(questions.reduce((sum, question) => sum + question.points, 0), 20, `exam ${index + 1}`);
    assert.equal(new Set(questions.map((question) => question.sourceData.skill)).size, 6, `exam ${index + 1}`);
    questions.forEach((question) => seenBySlot[question.slot].push(question.id));
  }
  Object.entries(seenBySlot).forEach(([slot, ids]) => {
    for (let start = 0; start < ids.length; start += 20) {
      assert.equal(new Set(ids.slice(start, start + 20)).size, 20, `slot ${slot}, cycle ${start / 20 + 1}`);
      if (start > 0) assert.notEqual(ids[start], ids[start - 1], `slot ${slot}, refill boundary ${start}`);
    }
  });
});
