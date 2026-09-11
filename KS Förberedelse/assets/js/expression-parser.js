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
      const canonicalChildren = rawChildren.map(canonical);
      const constants = canonicalChildren.filter(function (child) { return child.constant; });
      let children = canonicalChildren.filter(function (child) { return !child.constant; });
      let foldable = true;
      if (constants.length) {
        const constantValue = constants.reduce(function (total, child) {
          return node.operator === "+" ? total + child.value : total * child.value;
        }, node.operator === "+" ? 0 : 1);
        if (!Number.isFinite(constantValue)) {
          children = canonicalChildren;
          foldable = false;
        } else {
          const mayDiscardIdentity = node.operator === "+" || constantValue !== 0;
          if (!children.length || !mayDiscardIdentity || (node.operator === "+" ? constantValue !== 0 : constantValue !== 1)) {
            children.push({ constant: true, value: constantValue, key: numberKey(constantValue) });
          }
        }
      }
      children.sort(function (left, right) { return left.key.localeCompare(right.key); });
      if (children.length === 1) return children[0];
      return { constant: foldable && children.every(function (child) { return child.constant; }), key: node.operator + "[" + children.map(function (child) { return child.key; }).join(",") + "]" };
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

  const POLYNOMIAL_EPSILON = 1e-9;

  function normalizePolynomial(raw) {
    const values = raw.slice();
    const scale = values.reduce(function (largest, value) {
      return Math.max(largest, Math.abs(value));
    }, 1);
    const threshold = POLYNOMIAL_EPSILON * scale;
    for (let index = 0; index < values.length; index += 1) {
      if (Math.abs(values[index]) <= threshold) values[index] = 0;
    }
    while (values.length > 1 && values[values.length - 1] === 0) values.pop();
    return values.length ? values : [0];
  }

  function polynomialIsZero(polynomial) {
    const normalized = normalizePolynomial(polynomial);
    return normalized.length === 1 && normalized[0] === 0;
  }

  function polynomialDegree(polynomial) {
    return normalizePolynomial(polynomial).length - 1;
  }

  function addPolynomials(left, right, direction) {
    const length = Math.max(left.length, right.length);
    const output = Array.from({ length: length }, function (_, index) {
      return (left[index] || 0) + direction * (right[index] || 0);
    });
    return normalizePolynomial(output);
  }

  function multiplyPolynomials(left, right) {
    if (polynomialIsZero(left) || polynomialIsZero(right)) return [0];
    const output = Array(left.length + right.length - 1).fill(0);
    left.forEach(function (leftValue, leftIndex) {
      right.forEach(function (rightValue, rightIndex) {
        output[leftIndex + rightIndex] += leftValue * rightValue;
      });
    });
    if (output.some(function (value) { return !Number.isFinite(value); })) return null;
    return normalizePolynomial(output);
  }

  function scalePolynomial(polynomial, factor) {
    if (!Number.isFinite(factor)) return null;
    const output = polynomial.map(function (value) { return value * factor; });
    return output.some(function (value) { return !Number.isFinite(value); }) ? null : normalizePolynomial(output);
  }

  function powerPolynomial(polynomial, exponent) {
    let result = [1];
    let factor = polynomial;
    let remaining = exponent;
    while (remaining > 0) {
      if (remaining % 2 === 1) {
        result = multiplyPolynomials(result, factor);
        if (!result) return null;
      }
      remaining = Math.floor(remaining / 2);
      if (remaining) {
        factor = multiplyPolynomials(factor, factor);
        if (!factor) return null;
      }
    }
    return result;
  }

  function dividePolynomials(dividend, divisor) {
    let remainder = normalizePolynomial(dividend);
    const denominator = normalizePolynomial(divisor);
    if (polynomialIsZero(denominator)) return null;
    const quotient = Array(Math.max(1, remainder.length - denominator.length + 1)).fill(0);
    let iterations = 0;
    while (!polynomialIsZero(remainder) && polynomialDegree(remainder) >= polynomialDegree(denominator)) {
      if (iterations > 64) return null;
      const offset = polynomialDegree(remainder) - polynomialDegree(denominator);
      const factor = remainder[remainder.length - 1] / denominator[denominator.length - 1];
      if (!Number.isFinite(factor)) return null;
      quotient[offset] += factor;
      const subtraction = Array(offset).fill(0).concat(denominator.map(function (value) { return value * factor; }));
      remainder = addPolynomials(remainder, subtraction, -1);
      iterations += 1;
    }
    return { quotient: normalizePolynomial(quotient), remainder: normalizePolynomial(remainder) };
  }

  function monicPolynomial(polynomial) {
    const normalized = normalizePolynomial(polynomial);
    if (polynomialIsZero(normalized)) return [0];
    return scalePolynomial(normalized, 1 / normalized[normalized.length - 1]);
  }

  function polynomialGcd(left, right) {
    let current = normalizePolynomial(left);
    let next = normalizePolynomial(right);
    let iterations = 0;
    while (!polynomialIsZero(next)) {
      if (iterations > 64) return null;
      const divided = dividePolynomials(current, next);
      if (!divided) return null;
      current = next;
      next = divided.remainder;
      iterations += 1;
    }
    return monicPolynomial(current);
  }

  function integerGreatestCommonDivisor(left, right) {
    let first = Math.abs(left);
    let second = Math.abs(right);
    while (second) {
      const remainder = first % second;
      first = second;
      second = remainder;
    }
    return first;
  }

  function integerPolynomialContent(polynomial) {
    const normalized = normalizePolynomial(polynomial);
    if (!normalized.every(Number.isInteger)) return 1;
    return normalized.reduce(function (content, coefficient) {
      return integerGreatestCommonDivisor(content, coefficient);
    }, 0);
  }

  function hasCommonIntegerFactor(left, right) {
    return integerGreatestCommonDivisor(integerPolynomialContent(left), integerPolynomialContent(right)) > 1;
  }

  function sameCoefficientScaleUpToSign(left, right) {
    const first = Math.abs(left);
    const second = Math.abs(right);
    const scale = Math.max(1, first, second);
    return Number.isFinite(first) && Number.isFinite(second) &&
      Math.abs(first - second) <= POLYNOMIAL_EPSILON * scale;
  }

  function polynomialDerivative(polynomial) {
    if (polynomial.length <= 1) return [0];
    return normalizePolynomial(polynomial.slice(1).map(function (coefficient, index) {
      return coefficient * (index + 1);
    }));
  }

  function squareFreePolynomial(polynomial) {
    const normalized = normalizePolynomial(polynomial);
    if (polynomialDegree(normalized) <= 0) return [1];
    const divisor = polynomialGcd(normalized, polynomialDerivative(normalized));
    const divided = divisor && dividePolynomials(normalized, divisor);
    if (!divided || !polynomialIsZero(divided.remainder)) return null;
    return monicPolynomial(divided.quotient);
  }

  function samePolynomial(left, right) {
    const first = normalizePolynomial(left);
    const second = normalizePolynomial(right);
    if (first.length !== second.length) return false;
    const scale = Math.max(1, ...first.map(Math.abs), ...second.map(Math.abs));
    return first.every(function (value, index) {
      return Math.abs(value - second[index]) <= POLYNOMIAL_EPSILON * scale;
    });
  }

  function constantInteger(ast) {
    const names = new Set();
    collectVariables(ast, names);
    if (names.size) return null;
    const value = evaluate(ast, {});
    return value.ok && Number.isInteger(value.value) && Math.abs(value.value) <= 32 ? value.value : null;
  }

  function rationalFromAst(ast, variable) {
    if (ast.type === "number") return { ok: true, numerator: [ast.value], denominator: [1], domain: [1], variableDivisions: 0 };
    if (ast.type === "variable") {
      return ast.name === variable
        ? { ok: true, numerator: [0, 1], denominator: [1], domain: [1], variableDivisions: 0 }
        : { ok: false, reason: "unsupported-variable" };
    }
    if (ast.type === "unary") {
      const operand = rationalFromAst(ast.operand, variable);
      if (!operand.ok) return operand;
      if (ast.operator === "-") operand.numerator = scalePolynomial(operand.numerator, -1);
      return operand;
    }
    if (ast.type !== "binary") return { ok: false, reason: "not-rational-polynomial" };

    if (ast.operator === "^") {
      const base = rationalFromAst(ast.left, variable);
      const exponent = constantInteger(ast.right);
      if (!base.ok || exponent === null) return { ok: false, reason: "not-rational-polynomial" };
      if (exponent === 0) {
        return { ok: true, numerator: [1], denominator: [1], domain: base.domain, variableDivisions: base.variableDivisions };
      }
      const magnitude = Math.abs(exponent);
      const numerator = powerPolynomial(exponent > 0 ? base.numerator : base.denominator, magnitude);
      const denominator = powerPolynomial(exponent > 0 ? base.denominator : base.numerator, magnitude);
      if (!numerator || !denominator || polynomialIsZero(denominator)) return { ok: false, reason: "undefined-rational" };
      const zeroRestriction = exponent < 0 ? base.numerator : [1];
      const domain = multiplyPolynomials(base.domain, zeroRestriction);
      return domain ? {
        ok: true,
        numerator: numerator,
        denominator: denominator,
        domain: domain,
        variableDivisions: base.variableDivisions + (exponent < 0 && (polynomialDegree(base.numerator) > 0 || polynomialDegree(base.denominator) > 0) ? 1 : 0)
      } : { ok: false, reason: "polynomial-overflow" };
    }

    const left = rationalFromAst(ast.left, variable);
    const right = rationalFromAst(ast.right, variable);
    if (!left.ok) return left;
    if (!right.ok) return right;
    let numerator;
    let denominator;
    let domain = multiplyPolynomials(left.domain, right.domain);
    let variableDivisions = left.variableDivisions + right.variableDivisions;

    if (ast.operator === "+" || ast.operator === "-") {
      const leftTerm = multiplyPolynomials(left.numerator, right.denominator);
      const rightTerm = multiplyPolynomials(right.numerator, left.denominator);
      numerator = leftTerm && rightTerm ? addPolynomials(leftTerm, rightTerm, ast.operator === "+" ? 1 : -1) : null;
      denominator = multiplyPolynomials(left.denominator, right.denominator);
    } else if (ast.operator === "*") {
      numerator = multiplyPolynomials(left.numerator, right.numerator);
      denominator = multiplyPolynomials(left.denominator, right.denominator);
    } else if (ast.operator === "/") {
      if (polynomialIsZero(right.numerator)) return { ok: false, reason: "division-by-zero" };
      numerator = multiplyPolynomials(left.numerator, right.denominator);
      denominator = multiplyPolynomials(left.denominator, right.numerator);
      domain = domain && multiplyPolynomials(domain, right.numerator);
      if (polynomialDegree(right.numerator) > 0 || polynomialDegree(right.denominator) > 0) variableDivisions += 1;
    } else {
      return { ok: false, reason: "not-rational-polynomial" };
    }

    if (!numerator || !denominator || !domain || polynomialIsZero(denominator) || polynomialIsZero(domain)) {
      return { ok: false, reason: "undefined-rational" };
    }
    return { ok: true, numerator: numerator, denominator: denominator, domain: domain, variableDivisions: variableDivisions };
  }

  function analyzeRational(raw, options) {
    const settings = options === undefined ? {} : options;
    if (!settings || typeof settings !== "object") return { ok: false, reason: "invalid-options" };
    const variable = settings.variable === undefined ? "x" : settings.variable;
    if (!validVariableName(variable)) return { ok: false, reason: "invalid-variable" };
    const parsed = parse(raw);
    if (!parsed.ok) return parsed;
    const rational = rationalFromAst(parsed.ast, variable);
    if (!rational.ok) return rational;

    const divisor = polynomialGcd(rational.numerator, rational.denominator);
    if (!divisor) return { ok: false, reason: "normalization-failed" };
    const numeratorDivision = dividePolynomials(rational.numerator, divisor);
    const denominatorDivision = dividePolynomials(rational.denominator, divisor);
    if (!numeratorDivision || !denominatorDivision || !polynomialIsZero(numeratorDivision.remainder) || !polynomialIsZero(denominatorDivision.remainder)) {
      return { ok: false, reason: "normalization-failed" };
    }
    const denominatorLead = denominatorDivision.quotient[denominatorDivision.quotient.length - 1];
    const numerator = scalePolynomial(numeratorDivision.quotient, 1 / denominatorLead);
    const denominator = scalePolynomial(denominatorDivision.quotient, 1 / denominatorLead);
    const domain = squareFreePolynomial(rational.domain);
    if (!numerator || !denominator || !domain) return { ok: false, reason: "normalization-failed" };

    return {
      ok: true,
      numerator: numerator,
      denominator: denominator,
      domain: domain,
      reduced: polynomialDegree(divisor) === 0,
      coefficientReduced: !hasCommonIntegerFactor(numeratorDivision.quotient, denominatorDivision.quotient),
      coefficientScale: denominatorLead,
      variableDivisions: rational.variableDivisions
    };
  }

  function compareReducedRationals(actualRaw, expectedRaw, options) {
    const actual = analyzeRational(actualRaw, options);
    const expected = analyzeRational(expectedRaw, options);
    if (!actual.ok || !expected.ok) return { equivalent: null, reason: !actual.ok ? actual.reason : expected.reason };
    const left = multiplyPolynomials(actual.numerator, expected.denominator);
    const right = multiplyPolynomials(expected.numerator, actual.denominator);
    if (!left || !right) return { equivalent: null, reason: "polynomial-overflow" };
    return {
      equivalent: samePolynomial(left, right),
      reduced: actual.reduced,
      coefficientReduced: actual.coefficientReduced &&
        sameCoefficientScaleUpToSign(actual.coefficientScale, expected.coefficientScale),
      sameDomain: samePolynomial(actual.domain, expected.domain),
      simple: actual.variableDivisions <= 1
    };
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
    equivalent: equivalent,
    analyzeRational: analyzeRational,
    compareReducedRationals: compareReducedRationals
  };
});
