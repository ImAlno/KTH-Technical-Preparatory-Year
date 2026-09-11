(function (root, factory) {
  const isCommonJS = typeof module === "object" && module.exports && typeof require === "function";
  const api = factory(
    isCommonJS ? require("./units.js") : root && root.KS && root.KS.units,
    isCommonJS ? require("./expression-parser.js") : root && root.KS && root.KS.expression
  );
  if (isCommonJS) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.grading = api;
  }
})(typeof window !== "undefined" ? window : null, function (units, expression) {
  function parseNumeric(raw) {
    if (typeof raw !== "string") return { ok: false, reason: "invalid-input" };
    const match = raw.trim().match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:(?:[eE][+-]?\d+)|(?:(?:·|\*)\s*10\s*\^\s*[+-]?\d+))?)(?:\s*(.*))?$/);
    if (!match) return { ok: false, reason: "unparseable" };

    const token = match[1]
      .replace(",", ".")
      .replace(/(?:·|\*)\s*10\s*\^\s*([+-]?\d+)/, "e$1");
    const value = Number(token);
    if (!Number.isFinite(value)) return { ok: false, reason: "unparseable" };

    const rawUnit = match[2] ? match[2].trim() : "";
    if (!rawUnit) return { ok: true, value: value, unit: null };
    const unit = units && units.normalizeUnit(rawUnit);
    return unit ? { ok: true, value: value, unit: unit } : { ok: false, reason: "unknown-unit" };
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
      if (parsed.unit) {
        const converted = units.convert(parsed.value, parsed.unit, spec.targetUnit);
        if (!converted.ok) return result("self", spec, 0, parsed.value, "Svaret har en enhet som inte kan jämföras med uppgiftens enhet.");
        interpreted = converted.value;
      }
      const tolerance = spec.tolerance || {};
      const absolute = Number.isFinite(tolerance.absolute) ? tolerance.absolute : 0;
      const relative = Number.isFinite(tolerance.relative) ? Math.abs(spec.expected) * tolerance.relative : 0;
      const allowed = Math.max(absolute, relative);
      if (Math.abs(interpreted - spec.expected) <= allowed) {
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

  return { parseNumeric, gradeNumeric, gradeAliases, gradeSolutionSet, gradeExpression };
});
