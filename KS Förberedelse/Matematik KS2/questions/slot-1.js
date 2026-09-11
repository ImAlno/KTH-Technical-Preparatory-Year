(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_MATH_SLOTS = root.KS_MATH_SLOTS || {};
    root.KS_MATH_SLOTS[1] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const FAMILY_ROWS = [
    ["sqrt-equals-linear", [
      { b: 8, c: 4 }, { b: 14, c: 6 }, { b: 65, c: 7 }, { b: 51, c: 5 }, { b: 22, c: 8 }
    ]],
    ["linear-plus-sqrt", [
      { a: 2, b: 10, c: 7 }, { a: 3, b: 30, c: 8 }, { a: 4, b: 53, c: 6 }, { a: 2, b: 28, c: 10 }, { a: 5, b: 59, c: 9 }
    ]],
    ["scaled-sqrt-plus-linear", [
      { k: 2, b: -1, c: 9 }, { k: 3, b: 0, c: 10 }, { k: 4, b: 1, c: 11 }, { k: 2, b: 1, c: 14 }, { k: 3, b: -3, c: 7 }
    ]],
    ["sqrt-minus-constant", [
      { a: 10, b: 19, d: 4 }, { a: 14, b: 25, d: 5 }, { a: 9, b: 19, d: 3 }, { a: 11, b: 42, d: 6 }, { a: 11, b: 34, d: 4 }
    ]],
    ["sqrt-equals-scaled-linear", [
      { k: 0.5, b: -9, d: -4.5 }, { k: 0.5, b: -4.75, d: -2 }, { k: 0.5, b: -0.75, d: 0 }, { k: 1, b: -5, d: -5 }, { k: 1, b: 2, d: 2 }
    ]]
  ];

  function clean(value) {
    const normalized = Math.abs(value) < 1e-10 ? 0 : value;
    const rendered = Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(8)));
    return rendered.replace(".", ",");
  }

  function linear(a, b) {
    let value = a === 1 ? "x" : a === -1 ? "-x" : clean(a) + "x";
    if (b > 0) value += " + " + clean(b);
    if (b < 0) value += " - " + clean(-b);
    return value;
  }

  function quadratic(a, b, c) {
    let value = a === 1 ? "x²" : clean(a) + "x²";
    if (b > 0) value += " + " + clean(b) + "x";
    if (b < 0) value += " - " + clean(-b) + "x";
    if (c > 0) value += " + " + clean(c);
    if (c < 0) value += " - " + clean(-c);
    return value + " = 0";
  }

  function roots(a, b, c) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -1e-10) return [];
    const squareRoot = Math.sqrt(Math.max(0, discriminant));
    const values = discriminant < 1e-10 ? [-b / (2 * a)] : [(-b - squareRoot) / (2 * a), (-b + squareRoot) / (2 * a)];
    return values.map(function (value) { return Number(value.toFixed(10)); }).sort(function (left, right) { return left - right; });
  }

  function equationParts(family, p) {
    if (family === "sqrt-equals-linear") {
      return {
        equation: "√(" + linear(1, p.b) + ") = " + linear(-1, p.c),
        isolated: "√(" + linear(1, p.b) + ") = " + linear(-1, p.c),
        domain: linear(1, p.b) + " ≥ 0 och " + linear(-1, p.c) + " ≥ 0",
        coefficients: [1, -(2 * p.c + 1), p.c * p.c - p.b]
      };
    }
    if (family === "linear-plus-sqrt") {
      return {
        equation: "x + √(" + linear(p.a, p.b) + ") = " + clean(p.c),
        isolated: "√(" + linear(p.a, p.b) + ") = " + linear(-1, p.c),
        domain: linear(p.a, p.b) + " ≥ 0 och efter isolering " + linear(-1, p.c) + " ≥ 0",
        coefficients: [1, -(2 * p.c + p.a), p.c * p.c - p.b]
      };
    }
    if (family === "scaled-sqrt-plus-linear") {
      return {
        equation: clean(p.k) + "√(" + linear(1, p.b) + ") + x = " + clean(p.c),
        isolated: clean(p.k) + "√(" + linear(1, p.b) + ") = " + linear(-1, p.c),
        domain: linear(1, p.b) + " ≥ 0 och efter isolering " + linear(-1, p.c) + " ≥ 0",
        coefficients: [1, -(2 * p.c + p.k * p.k), p.c * p.c - p.k * p.k * p.b]
      };
    }
    if (family === "sqrt-minus-constant") {
      return {
        equation: "√(" + linear(p.a, p.b) + ") - " + clean(p.d) + " = x",
        isolated: "√(" + linear(p.a, p.b) + ") = " + linear(1, p.d),
        domain: linear(p.a, p.b) + " ≥ 0 och efter isolering " + linear(1, p.d) + " ≥ 0",
        coefficients: [1, 2 * p.d - p.a, p.d * p.d - p.b]
      };
    }
    return {
      equation: "√(" + linear(1, p.b) + ") = " + linear(p.k, p.d),
      isolated: "√(" + linear(1, p.b) + ") = " + linear(p.k, p.d),
      domain: linear(1, p.b) + " ≥ 0 och " + linear(p.k, p.d) + " ≥ 0",
      coefficients: [p.k * p.k, 2 * p.k * p.d - 1, p.d * p.d - p.b]
    };
  }

  function sides(family, p, x) {
    if (family === "sqrt-equals-linear") return [Math.sqrt(x + p.b), p.c - x, x + p.b >= -1e-9];
    if (family === "linear-plus-sqrt") return [x + Math.sqrt(p.a * x + p.b), p.c, p.a * x + p.b >= -1e-9];
    if (family === "scaled-sqrt-plus-linear") return [p.k * Math.sqrt(x + p.b) + x, p.c, x + p.b >= -1e-9];
    if (family === "sqrt-minus-constant") return [Math.sqrt(p.a * x + p.b) - p.d, x, p.a * x + p.b >= -1e-9];
    return [Math.sqrt(x + p.b), p.k * x + p.d, x + p.b >= -1e-9];
  }

  function solve(family, parameters) {
    const parts = equationParts(family, parameters);
    return roots(parts.coefficients[0], parts.coefficients[1], parts.coefficients[2]).filter(function (candidate) {
      const evaluated = sides(family, parameters, candidate);
      return evaluated[2] && Number.isFinite(evaluated[0]) && Math.abs(evaluated[0] - evaluated[1]) < 1e-8;
    });
  }

  function makeQuestion(family, parameters, rowIndex) {
    const parts = equationParts(family, parameters);
    const candidates = roots(parts.coefficients[0], parts.coefficients[1], parts.coefficients[2]);
    const expected = solve(family, parameters);
    const checks = candidates.map(function (candidate) {
      const evaluated = sides(family, parameters, candidate);
      const valid = evaluated[2] && Number.isFinite(evaluated[0]) && Math.abs(evaluated[0] - evaluated[1]) < 1e-8;
      return "<li><var>x</var> = " + clean(candidate) + ": vänsterledet blir " + clean(evaluated[0]) +
        " och högerledet " + clean(evaluated[1]) + (valid ? ", alltså godtas kandidaten." : ", alltså förkastas kandidaten.") + "</li>";
    }).join("");
    const answer = expected.length ? expected.map(clean).join(", ") : "inga reella lösningar";
    return {
      id: "math-s1-" + family + "-" + String(rowIndex + 1).padStart(2, "0"),
      slot: 1,
      title: "Rotekvation",
      points: 2,
      promptHtml: "<p>Lös ekvationen <strong>" + parts.equation + "</strong>. Svara med samtliga reella lösningar.</p>",
      fields: [{
        id: "roots",
        label: "Lösningsmängd",
        kind: "solution-set",
        points: 2,
        expected: expected,
        variable: "x",
        tolerance: { absolute: 1e-8, relative: 1e-9 },
        help: "Skriv exempelvis x = -2; x = 3."
      }],
      solutionHtml: "<p><strong>Definitionsvillkor:</strong> " + parts.domain + ".</p>" +
        "<p>Isolera roten: " + parts.isolated + ". <strong>Kvadrering</strong> av båda led ger andragradsekvationen " +
        quadratic(parts.coefficients[0], parts.coefficients[1], parts.coefficients[2]) + ", med kandidaterna " + candidates.map(clean).join(" och ") + ".</p>" +
        "<p><strong>Prövning i ursprungsekvationen:</strong></p><ul>" + checks + "</ul><p><strong>Svar:</strong> <var>x</var> = " + answer + ".</p>",
      rubric: [
        { points: 1, text: "Korrekt isolering och ledvis kvadrering till en andragradsekvation." },
        { points: 1, text: "Korrekt prövning i ursprungsekvationen och fullständig lösningsmängd." }
      ],
      sourceData: {
        skill: "radical-equations",
        family: family,
        parameters: Object.assign({}, parameters)
      }
    };
  }

  return FAMILY_ROWS.flatMap(function (entry) {
    return entry[1].map(function (parameters, index) { return makeQuestion(entry[0], parameters, index); });
  });
});
