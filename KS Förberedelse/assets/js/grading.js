(function (root, factory) {
  const isCommonJS = typeof module === "object" && module.exports && typeof require === "function";
  const api = factory(
    isCommonJS ? require("./units.js") : root && root.KS && root.KS.units,
    isCommonJS ? require("./expression-parser.js") : root && root.KS && root.KS.expression,
    isCommonJS ? require("./chemistry-parser.js") : root && root.KS && root.KS.chemistry
  );
  if (isCommonJS) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.grading = api;
  }
})(typeof window !== "undefined" ? window : null, function (units, expression, chemistry) {
  const NUMERIC_ATOM = "[+-]?(?:\\d+(?:[.,]\\d*)?|[.,]\\d+)(?:(?:[eE][+-]?\\d+)|(?:(?:·|\\*)\\s*10\\s*\\^\\s*[+-]?\\d+))?";

  function parseNumericAtom(raw) {
    const token = raw
      .replace(",", ".")
      .replace(/(?:·|\*)\s*10\s*\^\s*([+-]?\d+)/, "e$1");
    const value = Number(token);
    return Number.isFinite(value) ? value : null;
  }

  function parsedNumeric(value, rawUnit) {
    if (!Number.isFinite(value)) return { ok: false, reason: "unparseable" };
    const trimmedUnit = rawUnit ? rawUnit.trim() : "";
    if (!trimmedUnit) return { ok: true, value: value, unit: null };
    const unit = units && units.normalizeUnit(trimmedUnit);
    return unit ? { ok: true, value: value, unit: unit } : { ok: false, reason: "unknown-unit" };
  }

  function parseNumeric(raw) {
    if (typeof raw !== "string") return { ok: false, reason: "invalid-input" };
    const trimmed = raw.trim();
    const rational = trimmed.match(new RegExp("^(" + NUMERIC_ATOM + ")\\s*\\/\\s*(" + NUMERIC_ATOM + ")(?:\\s+(.+))?$"));
    if (rational) {
      const numerator = parseNumericAtom(rational[1]);
      const denominator = parseNumericAtom(rational[2]);
      if (numerator === null || denominator === null || denominator === 0) return { ok: false, reason: "unparseable" };
      return parsedNumeric(numerator / denominator, rational[3]);
    }

    const scalar = trimmed.match(new RegExp("^(" + NUMERIC_ATOM + ")(?:\\s*(.*))?$"));
    if (!scalar) return { ok: false, reason: "unparseable" };
    const value = parseNumericAtom(scalar[1]);
    return value === null ? { ok: false, reason: "unparseable" } : parsedNumeric(value, scalar[2]);
  }

  function result(status, spec, earned, interpreted, message) {
    return {
      status: status,
      earned: earned,
      possible: spec && Number.isFinite(spec.points) ? spec.points : 0,
      interpreted: interpreted,
      message: message
    };
  }

  function validNumericSpec(spec) {
    if (!spec || !Number.isFinite(spec.expected) || !Number.isFinite(spec.points) || spec.points < 0 || typeof spec.targetUnit !== "string" || !units.normalizeUnit(spec.targetUnit)) return false;
    if (spec.alternativeUnitCredit !== undefined && spec.alternativeUnitCredit !== "full" && spec.alternativeUnitCredit !== "reduced") return false;
    if (spec.tolerance === undefined) return true;
    if (!spec.tolerance || typeof spec.tolerance !== "object") return false;
    return ["absolute", "relative"].every(function (key) {
      return spec.tolerance[key] === undefined || (Number.isFinite(spec.tolerance[key]) && spec.tolerance[key] >= 0);
    });
  }

  function gradeNumeric(spec, raw) {
    try {
      if (!validNumericSpec(spec)) return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      const parsed = parseNumeric(raw);
      if (!parsed.ok) return result("self", spec, 0, null, "Svaret kunde inte tolkas säkert. Kontrollera tal och enhet.");

      let interpreted = parsed.value;
      let usedAlternativeUnit = false;
      if (parsed.unit) {
        const converted = units.convert(parsed.value, parsed.unit, spec.targetUnit);
        if (!converted.ok) return result("self", spec, 0, parsed.value, "Svaret har en enhet som inte kan jämföras med uppgiftens enhet.");
        interpreted = converted.value;
        usedAlternativeUnit = parsed.unit !== units.normalizeUnit(spec.targetUnit);
      }
      const tolerance = spec.tolerance || {};
      const absolute = Number.isFinite(tolerance.absolute) ? tolerance.absolute : 0;
      const relative = Number.isFinite(tolerance.relative) ? Math.abs(spec.expected) * tolerance.relative : 0;
      const allowed = Math.max(absolute, relative);
      if (Math.abs(interpreted - spec.expected) <= allowed) {
        if (usedAlternativeUnit) {
          const reduced = spec.alternativeUnitCredit === "reduced";
          return result(reduced ? "partial" : "correct", spec, reduced ? spec.points / 2 : spec.points, interpreted, "Rätt värde i annan enhet.");
        }
        return result("correct", spec, spec.points, interpreted, "Rätt svar.");
      }
      return result("incorrect", spec, 0, interpreted, "Svaret ligger utanför den tillåtna toleransen.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  function normalizeAlias(raw) {
    return typeof raw === "string"
      ? raw.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()
      : null;
  }

  function gradeAliases(spec, raw) {
    try {
      if (!spec || !Number.isFinite(spec.points) || spec.points < 0) return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      if (spec.aliases !== undefined && (!Array.isArray(spec.aliases) || spec.aliases.some(function (alias) { return typeof alias !== "string"; }))) {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const accepted = [];
      if (typeof spec.expected === "string") {
        const normalizedExpected = normalizeAlias(spec.expected);
        if (normalizedExpected) accepted.push(normalizedExpected);
      }
      if (Array.isArray(spec.aliases)) spec.aliases.forEach(function (alias) {
        const normalized = normalizeAlias(alias);
        if (normalized) accepted.push(normalized);
      });
      if (!accepted.length) return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom godtagbara svar saknas.");
      const interpreted = normalizeAlias(raw);
      if (interpreted === null) return result("self", spec, 0, null, "Svaret kunde inte tolkas säkert.");
      if (!interpreted) return result("incorrect", spec, 0, interpreted, "Inget svar angavs.");
      if (accepted.includes(interpreted)) return result("correct", spec, spec.points, interpreted, "Rätt svar.");
      return result("incorrect", spec, 0, interpreted, "Svaret stämmer inte med de godtagbara svaren.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  function validPoints(spec) {
    return spec && Number.isFinite(spec.points) && spec.points >= 0;
  }

  function solutionTolerance(spec) {
    if (spec.tolerance === undefined || spec.tolerance === null) return { absolute: 1e-9, relative: 0 };
    if (Number.isFinite(spec.tolerance) && spec.tolerance >= 0) return { absolute: spec.tolerance, relative: 0 };
    if (!spec.tolerance || typeof spec.tolerance !== "object") return null;
    const absolute = spec.tolerance.absolute === undefined ? 0 : spec.tolerance.absolute;
    const relative = spec.tolerance.relative === undefined ? 0 : spec.tolerance.relative;
    if (!Number.isFinite(absolute) || absolute < 0 || !Number.isFinite(relative) || relative < 0) return null;
    return { absolute: absolute, relative: relative };
  }

  function valuesClose(left, right, tolerance) {
    const allowed = Math.max(tolerance.absolute, Math.max(Math.abs(left), Math.abs(right)) * tolerance.relative);
    return Math.abs(left - right) <= allowed;
  }

  function mergeSortedValues(values, tolerance) {
    return values.slice().sort(function (left, right) { return left - right; }).reduce(function (merged, value) {
      if (!merged.length || !valuesClose(merged[merged.length - 1], value, tolerance)) merged.push(value);
      return merged;
    }, []);
  }

  function formatSolutionSet(variable, values) {
    return variable + " ∈ {" + values.join(", ") + "}";
  }

  function gradeSolutionSet(spec, raw) {
    try {
      if (!validPoints(spec) || !Array.isArray(spec.expected) || spec.expected.some(function (value) { return !Number.isFinite(value); })) {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const tolerance = solutionTolerance(spec);
      if (!tolerance || !expression || typeof expression.parseSolutionSet !== "function") {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const variable = spec.variable === undefined ? "x" : spec.variable;
      const parsed = expression.parseSolutionSet(raw, variable);
      if (!parsed.ok) return result("self", spec, 0, null, "Lösningsmängden kunde inte tolkas säkert.");

      const actual = mergeSortedValues(parsed.values, tolerance);
      const expected = mergeSortedValues(spec.expected, tolerance);
      const interpreted = formatSolutionSet(variable, actual);
      if (actual.length !== expected.length) {
        return result("incorrect", spec, 0, interpreted, "Lösningsmängden har fel antal värden.");
      }
      const matches = expected.every(function (value, index) { return valuesClose(actual[index], value, tolerance); });
      return matches
        ? result("correct", spec, spec.points, interpreted, "Rätt svar.")
        : result("incorrect", spec, 0, interpreted, "Lösningsmängden stämmer inte.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  function collectExpressionVariables(ast, names) {
    if (!ast || typeof ast !== "object") return;
    if (ast.type === "variable") names.add(ast.name);
    if (ast.type === "unary") collectExpressionVariables(ast.operand, names);
    if (ast.type === "function") collectExpressionVariables(ast.argument, names);
    if (ast.type === "binary") {
      collectExpressionVariables(ast.left, names);
      collectExpressionVariables(ast.right, names);
    }
  }

  function gradeExpression(spec, raw) {
    try {
      if (!validPoints(spec) || typeof spec.expected !== "string" || !expression || typeof expression.parse !== "function" || typeof expression.equivalent !== "function") {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const expected = expression.parse(spec.expected);
      if (!expected.ok) return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom facit inte kunde tolkas.");
      const inferredVariables = new Set();
      collectExpressionVariables(expected.ast, inferredVariables);
      const variables = spec.variables === undefined ? Array.from(inferredVariables).sort() : spec.variables;
      const comparison = expression.equivalent(raw, spec.expected, {
        variables: variables,
        exclude: spec.exclude
      });
      if (comparison.equivalent === null) {
        return result("self", spec, 0, null, "Uttrycket kunde inte jämföras med tillräcklig säkerhet.");
      }
      if (comparison.equivalent) return result("correct", spec, spec.points, raw, "Rätt svar.");
      return result("incorrect", spec, 0, raw, "Uttrycket är inte ekvivalent med facit.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  function gradeSimplifiedExpression(spec, raw) {
    try {
      if (!validPoints(spec) || typeof spec.expected !== "string" || !expression ||
          typeof expression.parse !== "function" || typeof expression.analyzeRational !== "function" ||
          typeof expression.compareReducedRationals !== "function") {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const expected = expression.parse(spec.expected);
      if (!expected.ok) return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom facit inte kunde tolkas.");
      const inferredVariables = new Set();
      collectExpressionVariables(expected.ast, inferredVariables);
      const variables = spec.variables === undefined ? Array.from(inferredVariables).sort() : spec.variables;
      if (!Array.isArray(variables) || variables.length !== 1 || typeof variables[0] !== "string") {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar en entydig variabel.");
      }
      const expectedAnalysis = expression.analyzeRational(spec.expected, { variable: variables[0] });
      if (!expectedAnalysis.ok || !expectedAnalysis.reduced || !expectedAnalysis.coefficientReduced || expectedAnalysis.variableDivisions > 1) {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom facit inte är ett fullständigt förenklat rationellt uttryck.");
      }
      const comparison = expression.compareReducedRationals(raw, spec.expected, { variable: variables[0] });
      if (comparison.equivalent === null) {
        return result("self", spec, 0, null, "Uttrycket kunde inte tolkas som ett rationellt polynomuttryck.");
      }
      if (!comparison.equivalent) return result("incorrect", spec, 0, raw, "Uttrycket är inte ekvivalent med facit.");
      if (!comparison.reduced) return result("incorrect", spec, 0, raw, "Uttrycket innehåller fortfarande en faktor som kan förkortas.");
      if (!comparison.coefficientReduced) return result("incorrect", spec, 0, raw, "Uttrycket innehåller fortfarande en gemensam talfaktor som kan förkortas.");
      if (!comparison.sameDomain) return result("incorrect", spec, 0, raw, "Uttryckets nämnare ger en annan definitionsmängd än det förenklade facit.");
      if (!comparison.simple) return result("incorrect", spec, 0, raw, "Uttrycket är inte sammanfört till en fullständigt förenklad rationell form.");
      return result("correct", spec, spec.points, raw, "Rätt svar.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  function validChemistrySpec(spec) {
    return validPoints(spec) && typeof spec.expected === "string" &&
      (spec.requireStates === undefined || typeof spec.requireStates === "boolean");
  }

  function gradeChemicalFormula(spec, raw) {
    try {
      if (!validChemistrySpec(spec) || (spec.aliases !== undefined && (!Array.isArray(spec.aliases) || spec.aliases.some(function (alias) { return typeof alias !== "string"; }))) ||
          !chemistry || typeof chemistry.parseFormula !== "function") {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const accepted = [spec.expected].concat(Array.isArray(spec.aliases) ? spec.aliases : []).map(function (value) {
        return chemistry.parseFormula(value);
      });
      if (accepted.some(function (candidate) { return !candidate.ok || (spec.requireStates && !candidate.state); })) {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom facit inte kunde tolkas.");
      }
      const actual = chemistry.parseFormula(raw);
      if (!actual.ok) return result("self", spec, 0, null, "Den kemiska formeln kunde inte tolkas säkert.");

      const match = accepted.some(function (candidate) {
        return actual.identityCanonical === candidate.identityCanonical && (!spec.requireStates || actual.state === candidate.state);
      });
      if (match) return result("correct", spec, spec.points, actual.canonical, "Rätt svar.");
      return result("incorrect", spec, 0, actual.canonical, "Den kemiska formeln stämmer inte med facit.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  function equationHasStates(parsed) {
    return parsed.reactants.concat(parsed.products).every(function (item) {
      return Boolean(item.formula.state);
    });
  }

  function gradeChemicalEquation(spec, raw) {
    try {
      if (!validChemistrySpec(spec) || !chemistry || typeof chemistry.parseEquation !== "function" || typeof chemistry.equivalentEquations !== "function") {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const statePoints = spec.statePoints === undefined ? spec.points / 2 : spec.statePoints;
      if (!Number.isFinite(statePoints) || statePoints < 0 || statePoints > spec.points) {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom uppgiften saknar giltiga rättningsuppgifter.");
      }
      const expected = chemistry.parseEquation(spec.expected);
      if (!expected.ok || (spec.requireStates && !equationHasStates(expected))) {
        return result("self", spec, 0, null, "Svaret kan inte rättas automatiskt eftersom facit inte kunde tolkas.");
      }
      const actual = chemistry.parseEquation(raw);
      if (!actual.ok) return result("self", spec, 0, null, "Reaktionsformeln kunde inte tolkas säkert.");

      const comparison = chemistry.equivalentEquations(raw, spec.expected, { requireStates: Boolean(spec.requireStates) });
      if (comparison.equivalent === null) return result("self", spec, 0, null, "Reaktionsformeln kunde inte jämföras säkert.");
      if (comparison.equivalent) return result("correct", spec, spec.points, actual.canonical, "Rätt svar.");
      if (comparison.reason === "state-mismatch") {
        return result("partial", spec, spec.points - statePoints, actual.canonical, "Reaktionsformeln är rätt, men ett eller flera aggregationstillstånd saknas eller är fel.");
      }
      return result("incorrect", spec, 0, actual.canonical, "Reaktionsformeln stämmer inte med facit.");
    } catch (error) {
      return result("self", spec, 0, null, "Svaret kunde inte rättas automatiskt.");
    }
  }

  return { parseNumeric, gradeNumeric, gradeAliases, gradeSolutionSet, gradeExpression, gradeSimplifiedExpression, gradeChemicalFormula, gradeChemicalEquation };
});
