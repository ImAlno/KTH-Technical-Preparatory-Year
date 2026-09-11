(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.expression = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const SAMPLE_VALUES = [-11, -7, -3, -1, 0, 2, 5, 9, 13];

  function isIdentifierStart(character) {
    return typeof character === "string" && /^[A-Za-zÅÄÖåäö]$/.test(character);
  }

  function isIdentifierPart(character) {
    return typeof character === "string" && /^[A-Za-z0-9_ÅÄÖåäö]$/.test(character);
  }

  function tokenize(raw) {
    if (typeof raw !== "string") return { ok: false, reason: "invalid-input" };
    const tokens = [];
    let index = 0;

    while (index < raw.length) {
      const character = raw[index];
      if (/\s/.test(character)) {
        index += 1;
        continue;
      }

      if (/\d/.test(character) || ((character === "." || character === ",") && /\d/.test(raw[index + 1] || ""))) {
        const start = index;
        while (/\d/.test(raw[index] || "")) index += 1;
        if ((raw[index] === "." || raw[index] === ",") && /\d/.test(raw[index + 1] || "")) {
          index += 1;
          while (/\d/.test(raw[index] || "")) index += 1;
        }
        const value = Number(raw.slice(start, index).replace(",", "."));
        if (!Number.isFinite(value)) return { ok: false, reason: "unparseable" };
        tokens.push({ type: "number", value: value, position: start });
        continue;
      }

      if (isIdentifierStart(character)) {
        const start = index;
        index += 1;
        while (isIdentifierPart(raw[index])) index += 1;
        const value = raw.slice(start, index);
        tokens.push({ type: value === "sqrt" ? "function" : "identifier", value: value, position: start });
        continue;
      }

      if (character === "√") {
        tokens.push({ type: "function", value: "sqrt", position: index });
        index += 1;
        continue;
      }

      if ("+-*/^".includes(character)) {
        tokens.push({ type: "operator", value: character, position: index });
        index += 1;
        continue;
      }

      if (character === "(" || character === ")") {
        tokens.push({ type: character === "(" ? "left-parenthesis" : "right-parenthesis", value: character, position: index });
        index += 1;
        continue;
      }

      return { ok: false, reason: "unparseable" };
    }

    if (!tokens.length) return { ok: false, reason: "unparseable" };
    return { ok: true, tokens: tokens };
  }

  function parserFailure() {
    const error = new Error("unparseable");
    error.reason = "unparseable";
    throw error;
  }

  function parse(raw) {
    const tokenized = tokenize(raw);
    if (!tokenized.ok) return tokenized;
    const tokens = tokenized.tokens.concat([{ type: "end", value: null, position: raw.length }]);
    let position = 0;

    function peek() {
      return tokens[position];
    }

    function take() {
      const token = tokens[position];
      position += 1;
      return token;
    }

    function startsFactor(token) {
      return token.type === "number" || token.type === "identifier" || token.type === "function" || token.type === "left-parenthesis";
    }

    function parsePrefix() {
      const token = take();
      if (token.type === "number") return { type: "number", value: token.value };
      if (token.type === "identifier") {
        if (peek().type === "left-parenthesis") parserFailure();
        return { type: "variable", name: token.value };
      }
      if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
        return { type: "unary", operator: token.value, operand: parseExpression(40) };
      }
      if (token.type === "left-parenthesis") {
        const expression = parseExpression(0);
        if (take().type !== "right-parenthesis") parserFailure();
        return expression;
      }
      if (token.type === "function" && token.value === "sqrt") {
        if (take().type !== "left-parenthesis") parserFailure();
        const argument = parseExpression(0);
        if (take().type !== "right-parenthesis") parserFailure();
        return { type: "function", name: "sqrt", argument: argument };
      }
      parserFailure();
    }

    function parseExpression(minimumBindingPower) {
      let left = parsePrefix();
      while (true) {
        const token = peek();
        let operator;
        let bindingPower;
        let implicit = false;

        if (token.type === "operator") {
          operator = token.value;
          bindingPower = operator === "+" || operator === "-" ? 10 : operator === "*" || operator === "/" ? 20 : 30;
        } else if (startsFactor(token)) {
          operator = "*";
          bindingPower = 20;
          implicit = true;
        } else {
          break;
        }

        if (bindingPower < minimumBindingPower) break;
        if (!implicit) take();
        const rightBindingPower = operator === "^" ? bindingPower : bindingPower + 1;
        const right = parseExpression(rightBindingPower);
        left = { type: "binary", operator: operator, left: left, right: right };
      }
      return left;
    }

    try {
      const ast = parseExpression(0);
      if (peek().type !== "end") parserFailure();
      return { ok: true, ast: ast };
    } catch (error) {
      return { ok: false, reason: "unparseable" };
    }
  }

  function finiteResult(value) {
    return Number.isFinite(value) ? { ok: true, value: value } : { ok: false, reason: "undefined-value" };
  }

  function calculate(operator, left, right) {
    if (operator === "+") return finiteResult(left + right);
    if (operator === "-") return finiteResult(left - right);
    if (operator === "*") return finiteResult(left * right);
    if (operator === "/") return right === 0 ? { ok: false, reason: "division-by-zero" } : finiteResult(left / right);
    if (operator === "^") return finiteResult(Math.pow(left, right));
    return { ok: false, reason: "unknown-operator" };
  }

  function evaluate(ast, variables) {
    if (!ast || typeof ast !== "object") return { ok: false, reason: "invalid-ast" };
    const values = variables && typeof variables === "object" ? variables : {};

    if (ast.type === "number") return finiteResult(ast.value);
    if (ast.type === "variable") {
      if (!Object.prototype.hasOwnProperty.call(values, ast.name) || !Number.isFinite(values[ast.name])) {
        return { ok: false, reason: "missing-variable" };
      }
      return { ok: true, value: values[ast.name] };
    }
    if (ast.type === "unary") {
      const operand = evaluate(ast.operand, values);
      if (!operand.ok) return operand;
      return finiteResult(ast.operator === "-" ? -operand.value : operand.value);
    }
    if (ast.type === "function" && ast.name === "sqrt") {
      const argument = evaluate(ast.argument, values);
      if (!argument.ok) return argument;
      if (argument.value < 0) return { ok: false, reason: "non-real-root" };
      return finiteResult(Math.sqrt(argument.value));
    }
    if (ast.type === "binary") {
      const left = evaluate(ast.left, values);
      if (!left.ok) return left;
      const right = evaluate(ast.right, values);
      if (!right.ok) return right;
      return calculate(ast.operator, left.value, right.value);
    }
    return { ok: false, reason: "invalid-ast" };
  }

  function numberKey(value) {
    return "number:" + (Object.is(value, -0) ? "0" : String(value));
  }

  function flatten(node, operator, output) {
    if (node.type === "binary" && node.operator === operator) {
      flatten(node.left, operator, output);
      flatten(node.right, operator, output);
    } else {
      output.push(node);
    }
  }

  function canonical(node) {
    if (node.type === "number") return { constant: true, value: node.value, key: numberKey(node.value) };
    if (node.type === "variable") return { constant: false, key: "variable:" + node.name };
    if (node.type === "unary") {
      const operand = canonical(node.operand);
      if (node.operator === "+") return operand;
      if (operand.constant) return { constant: true, value: -operand.value, key: numberKey(-operand.value) };
      return { constant: false, key: "unary:-[" + operand.key + "]" };
    }
    if (node.type === "function") {
      const argument = canonical(node.argument);
      if (argument.constant && argument.value >= 0) {
        const value = Math.sqrt(argument.value);
        if (Number.isFinite(value)) return { constant: true, value: value, key: numberKey(value) };
      }
      return { constant: false, key: "sqrt[" + argument.key + "]" };
    }
    if (node.type === "binary" && (node.operator === "+" || node.operator === "*")) {
      const rawChildren = [];
      flatten(node, node.operator, rawChildren);
      let children = rawChildren.map(canonical);
      const constants = children.filter(function (child) { return child.constant; });
      const others = children.filter(function (child) { return !child.constant; });
      if (constants.length) {
        const constantValue = constants.reduce(function (total, child) {
          return node.operator === "+" ? total + child.value : total * child.value;
        }, node.operator === "+" ? 0 : 1);
        const mayDiscardIdentity = node.operator === "+" || constantValue !== 0;
        if (!others.length || !mayDiscardIdentity || (node.operator === "+" ? constantValue !== 0 : constantValue !== 1)) {
          others.push({ constant: true, value: constantValue, key: numberKey(constantValue) });
        }
      }
      children = others.sort(function (left, right) { return left.key.localeCompare(right.key); });
      if (children.length === 1) return children[0];
      return { constant: children.every(function (child) { return child.constant; }), key: node.operator + "[" + children.map(function (child) { return child.key; }).join(",") + "]" };
    }
    if (node.type === "binary") {
      const left = canonical(node.left);
      const right = canonical(node.right);
      if (left.constant && right.constant) {
        const calculated = calculate(node.operator, left.value, right.value);
        if (calculated.ok) return { constant: true, value: calculated.value, key: numberKey(calculated.value) };
      }
      return { constant: false, key: node.operator + "[" + left.key + "," + right.key + "]" };
    }
    return { constant: false, key: "invalid" };
  }

  function collectVariables(node, names) {
    if (node.type === "variable") names.add(node.name);
    if (node.type === "unary") collectVariables(node.operand, names);
    if (node.type === "function") collectVariables(node.argument, names);
    if (node.type === "binary") {
      collectVariables(node.left, names);
      collectVariables(node.right, names);
    }
  }

  function validVariableName(name) {
    if (typeof name !== "string" || !name.length || !isIdentifierStart(name[0])) return false;
    for (let index = 1; index < name.length; index += 1) {
      if (!isIdentifierPart(name[index])) return false;
    }
    return name !== "sqrt";
  }

  function isExcluded(assignment, variableNames, exclude) {
    if (Array.isArray(exclude)) {
      return variableNames.some(function (name) { return exclude.includes(assignment[name]); });
    }
    if (exclude && typeof exclude === "object") {
      return variableNames.some(function (name) {
        return Array.isArray(exclude[name]) && exclude[name].includes(assignment[name]);
      });
    }
    return false;
  }

  function equivalent(leftRaw, rightRaw, options) {
    const left = parse(leftRaw);
    const right = parse(rightRaw);
    if (!left.ok || !right.ok) return { equivalent: null, reason: "unparseable" };

    const settings = options && typeof options === "object" ? options : {};
    const foundVariables = new Set();
    collectVariables(left.ast, foundVariables);
    collectVariables(right.ast, foundVariables);
    const variableNames = settings.variables === undefined ? Array.from(foundVariables).sort() : settings.variables;
    if (!Array.isArray(variableNames) || variableNames.some(function (name) { return !validVariableName(name); })) {
      return { equivalent: null, reason: "unparseable" };
    }
    if (Array.from(foundVariables).some(function (name) { return !variableNames.includes(name); })) {
      return { equivalent: null, reason: "unparseable" };
    }
    if (settings.exclude !== undefined && !Array.isArray(settings.exclude) && (!settings.exclude || typeof settings.exclude !== "object")) {
      return { equivalent: null, reason: "unparseable" };
    }

    if (canonical(left.ast).key === canonical(right.ast).key) return { equivalent: true };

    let matches = 0;
    for (let sampleIndex = 0; sampleIndex < SAMPLE_VALUES.length; sampleIndex += 1) {
      const assignment = {};
      variableNames.forEach(function (name, variableIndex) {
        assignment[name] = SAMPLE_VALUES[(sampleIndex + variableIndex * 2) % SAMPLE_VALUES.length];
      });
      if (isExcluded(assignment, variableNames, settings.exclude)) continue;

      const actual = evaluate(left.ast, assignment);
      const expected = evaluate(right.ast, assignment);
      if (actual.ok !== expected.ok) return { equivalent: false, reason: "domain-mismatch" };
      if (!actual.ok) continue;
      const tolerance = 1e-9 * Math.max(1, Math.abs(expected.value));
      if (Math.abs(actual.value - expected.value) > tolerance) return { equivalent: false, reason: "value-mismatch" };
      matches += 1;
    }

    return matches >= 7
      ? { equivalent: true }
      : { equivalent: null, reason: "insufficient-confidence" };
  }

  function parseSolutionSet(raw, variableName) {
    if (typeof raw !== "string") return { ok: false, reason: "invalid-input" };
    const variable = variableName === undefined ? "x" : variableName;
    if (!validVariableName(variable)) return { ok: false, reason: "invalid-variable" };
    const normalized = raw.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
    if (normalized === "ingen lösning" || normalized === "saknar reella lösningar" || normalized === "∅") {
      return { ok: true, values: [] };
    }
    if (!normalized) return { ok: false, reason: "unparseable" };

    const separatedAssignments = raw.replace(/,\s*(?=[A-Za-zÅÄÖåäö][A-Za-z0-9_ÅÄÖåäö]*\s*=)/g, ";");
    const parts = separatedAssignments.split(/\s*(?:;|\beller\b)\s*/i);
    if (!parts.length || parts.some(function (part) { return !part.trim(); })) return { ok: false, reason: "unparseable" };

    const values = [];
    for (let index = 0; index < parts.length; index += 1) {
      let candidate = parts[index].trim();
      const assignment = candidate.match(/^([A-Za-zÅÄÖåäö][A-Za-z0-9_ÅÄÖåäö]*)\s*=\s*(.+)$/);
      if (assignment) {
        if (assignment[1] !== variable) return { ok: false, reason: "unparseable" };
        candidate = assignment[2];
      } else if (candidate.includes("=")) {
        return { ok: false, reason: "unparseable" };
      }

      const parsed = parse(candidate);
      if (!parsed.ok) return { ok: false, reason: "unparseable" };
      const names = new Set();
      collectVariables(parsed.ast, names);
      if (names.size) return { ok: false, reason: "unparseable" };
      const evaluated = evaluate(parsed.ast, {});
      if (!evaluated.ok || !Number.isFinite(evaluated.value)) return { ok: false, reason: "unparseable" };
      values.push(evaluated.value);
    }

    values.sort(function (left, right) { return left - right; });
    return { ok: true, values: values };
  }

  return {
    tokenize: tokenize,
    parse: parse,
    evaluate: evaluate,
    parseSolutionSet: parseSolutionSet,
    equivalent: equivalent
  };
});
