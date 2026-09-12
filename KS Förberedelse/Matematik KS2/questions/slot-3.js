(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_MATH_SLOTS = root.KS_MATH_SLOTS || {};
    root.KS_MATH_SLOTS[3] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const FAMILY_ROWS = [
    ["factor-cancellation", [
      { r: 2, s: 5, t: 7 }, { r: 3, s: 8, t: 1 }, { r: 4, s: 9, t: 6 }, { r: 6, s: 2, t: 10 }, { r: 7, s: 11, t: 3 }
    ]],
    ["difference-of-squares", [
      { a: 2, b: 5 }, { a: 3, b: 7 }, { a: 4, b: 9 }, { a: 6, b: 11 }, { a: 8, b: 13 }
    ]],
    ["complex-fraction", [
      { r: 2, s: 5, k: 3 }, { r: 3, s: 8, k: 4 }, { r: 4, s: 10, k: 5 }, { r: 6, s: 1, k: 2 }, { r: 7, s: 12, k: 6 }
    ]],
    ["unlike-denominators", [
      { a: 2, b: 3, r: 1, s: 5 }, { a: 4, b: 1, r: 2, s: 7 }, { a: 3, b: 5, r: 4, s: 9 },
      { a: 6, b: 2, r: 3, s: 11 }, { a: 5, b: 4, r: 6, s: 13 }
    ]],
    ["sign-handling", [
      { r: 2, s: 6, t: 9 }, { r: 3, s: 7, t: 11 }, { r: 5, s: 1, t: 8 }, { r: 6, s: 10, t: 4 }, { r: 8, s: 12, t: 3 }
    ]]
  ];

  function signedTerm(coefficient, variable) {
    if (!coefficient) return "";
    const magnitude = Math.abs(coefficient);
    const factor = magnitude === 1 && variable ? "" : String(magnitude);
    return (coefficient > 0 ? " + " : " - ") + factor + variable;
  }

  function polynomial(a, b, c) {
    let value = a === 1 ? "x^2" : String(a) + "*x^2";
    value += signedTerm(b, "x");
    value += signedTerm(c, "");
    return value;
  }

  function pretty(raw) {
    return raw.replace(/\*/g, "·").replace(/\^2/g, "²").replace(/-/g, "−");
  }

  function workOnPaper(family) {
    const guidance = {
      "factor-cancellation": [
        "Faktorisera täljare och nämnare, visa eventuell förkortning och skriv de ursprungliga definitionsuteslutningarna. Här skriver du endast slutsvaret.",
        "Jämför faktorerna som förkortas, den förenklade formen och alla ursprungliga uteslutningar med lösningen."
      ],
      "difference-of-squares": [
        "Använd konjugatregeln för att faktorisera differensen av kvadrater, visa förkortningen och bevara den ursprungliga definitionsmängden. Här skriver du endast slutsvaret.",
        "Jämför konjugatfaktorer, förkortning och de ursprungliga uteslutna värdena med lösningen."
      ],
      "complex-fraction": [
        "Skriv om den komplexa kvoten med gemensam nämnare, faktorisera och förkorta försiktigt; ange alla ursprungliga definitionsuteslutningar. Här skriver du endast slutsvaret.",
        "Jämför gemensam nämnare, faktorisering, tillåtna förkortningar och ursprungliga uteslutningar med lösningen."
      ],
      "unlike-denominators": [
        "Gör bråken liknämniga, faktorisera den gemensamma nämnaren och förenkla utan att tappa de ursprungliga definitionsuteslutningarna. Här skriver du endast slutsvaret.",
        "Jämför liknämnighet, faktorisering, förenkling och samtliga ursprungliga uteslutningar med lösningen."
      ],
      "sign-handling": [
        "Faktorisera med särskild kontroll av minustecknet, visa eventuell förkortning och skriv de ursprungliga definitionsuteslutningarna. Här skriver du endast slutsvaret.",
        "Jämför teckenhantering, förkortning, förenklad kvot och ursprungliga uteslutningar med lösningen."
      ]
    }[family];
    return { title: "Arbeta i räknehäftet", instruction: guidance[0], comparison: guidance[1] };
  }

  function dataFor(family, p) {
    if (family === "factor-cancellation") {
      return {
        original: "(" + polynomial(1, -(p.r + p.s), p.r * p.s) + ")/(" + polynomial(1, -(p.r + p.t), p.r * p.t) + ")",
        expected: "(x-" + p.s + ")/(x-" + p.t + ")",
        exclusions: [p.r, p.t],
        factorization: "[(x − " + p.r + ")(x − " + p.s + ")]/[(x − " + p.r + ")(x − " + p.t + ")]"
      };
    }
    if (family === "difference-of-squares") {
      return {
        original: "(" + polynomial(1, 0, -p.a * p.a) + ")/(" + polynomial(1, p.b - p.a, -p.a * p.b) + ")",
        expected: "(x+" + p.a + ")/(x+" + p.b + ")",
        exclusions: [p.a, -p.b],
        factorization: "[(x − " + p.a + ")(x + " + p.a + ")]/[(x − " + p.a + ")(x + " + p.b + ")]"
      };
    }
    if (family === "complex-fraction") {
      return {
        original: "((1/(x-" + p.r + "))+(1/(x-" + p.s + ")))/(" + p.k + "/(x-" + p.r + "))",
        expected: "(2*x-" + (p.r + p.s) + ")/(" + p.k + "*(x-" + p.s + "))",
        exclusions: [p.r, p.s],
        factorization: "[(2x − " + (p.r + p.s) + ")/((x − " + p.r + ")(x − " + p.s + "))] · [(x − " + p.r + ")/" + p.k + "]"
      };
    }
    if (family === "unlike-denominators") {
      return {
        original: p.a + "/(x-" + p.r + ")+" + p.b + "/(x-" + p.s + ")",
        expected: "(" + (p.a + p.b) + "*x-" + (p.a * p.s + p.b * p.r) + ")/((x-" + p.r + ")*(x-" + p.s + "))",
        exclusions: [p.r, p.s],
        factorization: "[" + p.a + "(x − " + p.s + ") + " + p.b + "(x − " + p.r + ")]/[(x − " + p.r + ")(x − " + p.s + ")]"
      };
    }
    return {
      original: "(" + polynomial(1, -(p.r + p.s), p.r * p.s) + ")/(" + polynomial(-1, p.r + p.t, -p.r * p.t) + ")",
      expected: "-(x-" + p.s + ")/(x-" + p.t + ")",
      exclusions: [p.r, p.t],
      factorization: "[(x − " + p.r + ")(x − " + p.s + ")]/[−(x − " + p.r + ")(x − " + p.t + ")]"
    };
  }

  function makeQuestion(family, parameters, rowIndex) {
    const values = dataFor(family, parameters);
    return {
      id: "math-s3-" + family + "-" + String(rowIndex + 1).padStart(2, "0"),
      slot: 3,
      title: "Förenkla rationellt uttryck",
      points: 2,
      promptHtml: "<p>Förenkla uttrycket <strong>" + pretty(values.original) + "</strong> så långt som möjligt. Ange även de värden som inte ingår i uttryckets ursprungliga definitionsmängd.</p>",
      workOnPaper: workOnPaper(family),
      fields: [{
        id: "expression", label: "Förenklat uttryck", kind: "simplified-expression", points: 1,
        expected: values.expected, variables: ["x"], exclude: values.exclusions,
        help: "Använd * för multiplikation och / för division vid behov."
      }, {
        id: "exclusions", label: "Uteslutna x-värden", kind: "solution-set", points: 1,
        expected: values.exclusions.slice().sort(function (left, right) { return left - right; }), variable: "x",
        tolerance: { absolute: 1e-8, relative: 1e-9 },
        help: "Skriv värdena med semikolon, t.ex. 2; 7."
      }],
      solutionHtml: "<p><strong>Definitionsmängd:</strong> nämnarna i ursprungsuttrycket ger <var>x</var> ≠ " + values.exclusions.join(" och x ≠ ") + ". Dessa begränsningar gäller även efter förkortning.</p>" +
        "<p>Faktorisera och gör uttrycket liknämnigt där det behövs: <strong>" + values.factorization + "</strong>. Gemensamma faktorer kan sedan förkortas, men bara inom den angivna definitionsmängden.</p>" +
        "<p><strong>Svar:</strong> " + pretty(values.expected) + ", med <var>x</var> ≠ " + values.exclusions.join(" och x ≠ ") + ".</p>",
      rubric: [
        { points: 1, text: "Korrekt faktorisering, liknämnighet eller hantering av den komplexa kvoten." },
        { points: 1, text: "Fullständigt förenklat uttryck med ursprungliga definitionsbegränsningar." }
      ],
      sourceData: {
        skill: "rational-simplification",
        family: family,
        parameters: Object.assign({}, parameters),
        originalExpression: values.original,
        exclusions: values.exclusions.slice()
      }
    };
  }

  return FAMILY_ROWS.flatMap(function (entry) {
    return entry[1].map(function (parameters, index) { return makeQuestion(entry[0], parameters, index); });
  });
});
