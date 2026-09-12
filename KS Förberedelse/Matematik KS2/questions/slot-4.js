(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_MATH_SLOTS = root.KS_MATH_SLOTS || {};
    root.KS_MATH_SLOTS[4] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const FAMILY_ROWS = [
    ["rational-one-exclusion", [
      { r: 5, leftNumerator: 7, rightNumerator: 7 },
      { r: 7, leftNumerator: 14, rightNumerator: 4 },
      { r: 3, leftNumerator: 2, rightNumerator: 12 },
      { r: -1, leftNumerator: 5, rightNumerator: 17 },
      { r: 9, leftNumerator: 26, rightNumerator: 6 }
    ]],
    ["rational-two-exclusions", [
      { numeratorRoots: [2, 6], denominatorRoots: [-3, 2] },
      { numeratorRoots: [-4, 5], denominatorRoots: [1, 7] },
      { numeratorRoots: [3, 8], denominatorRoots: [-2, 4] },
      { numeratorRoots: [-5, -1], denominatorRoots: [-1, 6] },
      { numeratorRoots: [4, 9], denominatorRoots: [0, 7] }
    ]],
    ["biquadratic", [
      { squareRoots: [4, 25] }, { squareRoots: [9, 49] }, { squareRoots: [16, 64] },
      { squareRoots: [1, 36] }, { squareRoots: [25, 81] }
    ]],
    ["factorable-cubic", [
      { roots: [-3, 2, 5] }, { roots: [-4, 1, 6] }, { roots: [-2, 3, 7] },
      { roots: [-5, -1, 4] }, { roots: [1, 4, 8] }
    ]],
    ["quadratic-substitution", [
      { linearCoefficient: 1, first: 6, second: 20 },
      { linearCoefficient: 2, first: 8, second: 24 },
      { linearCoefficient: -1, first: 6, second: 20 },
      { linearCoefficient: 3, first: 10, second: 28 },
      { linearCoefficient: -2, first: 3, second: 24 }
    ]]
  ];

  function clean(value) {
    const normalized = Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10));
    return (Number.isInteger(normalized) ? String(normalized) : String(normalized)).replace(".", ",");
  }

  function sortedUnique(values) {
    return values.map(function (value) { return Number(value.toFixed(10)); })
      .sort(function (left, right) { return left - right; })
      .filter(function (value, index, list) { return index === 0 || Math.abs(value - list[index - 1]) > 1e-9; });
  }

  function quadraticRoots(a, b, c) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -1e-10) return [];
    if (Math.abs(discriminant) < 1e-10) return [-b / (2 * a)];
    const squareRoot = Math.sqrt(discriminant);
    return sortedUnique([(-b - squareRoot) / (2 * a), (-b + squareRoot) / (2 * a)]);
  }

  function coefficientsFromRoots(roots) {
    if (roots.length === 2) return [1, -(roots[0] + roots[1]), roots[0] * roots[1]];
    return [1, -(roots[0] + roots[1] + roots[2]), roots[0] * roots[1] + roots[0] * roots[2] + roots[1] * roots[2], -roots[0] * roots[1] * roots[2]];
  }

  function term(coefficient, power, first) {
    if (!coefficient) return "";
    const sign = coefficient < 0 ? "−" : "+";
    const magnitude = Math.abs(coefficient);
    const variable = power === 2 ? "x²" : power === 1 ? "x" : "";
    const number = variable && magnitude === 1 ? "" : clean(magnitude);
    return (first ? (sign === "−" ? "−" : "") : " " + sign + " ") + number + variable;
  }

  function polynomial(coefficients) {
    const degree = coefficients.length - 1;
    let rendered = "";
    coefficients.forEach(function (coefficient, index) {
      const power = degree - index;
      if (power > 2) {
        if (!coefficient) return;
        const sign = coefficient < 0 ? "−" : "+";
        const magnitude = Math.abs(coefficient);
        rendered += (rendered ? " " + sign + " " : sign === "−" ? "−" : "") + (magnitude === 1 ? "" : clean(magnitude)) + "x³";
      } else {
        rendered += term(coefficient, power, !rendered);
      }
    });
    return rendered || "0";
  }

  function denominator(r) {
    return r < 0 ? "(x + " + clean(-r) + ")" : "(x − " + clean(r) + ")";
  }

  function workOnPaper(family) {
    const guidance = {
      "rational-one-exclusion": [
        "Skriv nämnarens definitionsvillkor, multiplicera med den tillåtna nämnaren, lös ekvationen och validera rötterna i originalet. Här skriver du endast slutsvaret.",
        "Jämför definitionsbegränsningen, multiplikationen, kandidaternas insättning och rotvalideringen med lösningen."
      ],
      "rational-two-exclusions": [
        "Skriv båda nämnarvillkoren, faktorisera täljaren, lös kandidaterna och kontrollera varje rot mot de ursprungliga nämnarna. Här skriver du endast slutsvaret.",
        "Jämför nämnarrestriktioner, nollproduktmetod, substitutionskontroll och förkastade rötter med lösningen."
      ],
      "biquadratic": [
        "Skriv definitionsvillkoren, använd substitutionen y = x², lös i y och validera de återfunna rötterna i originalekvationen. Här skriver du endast slutsvaret.",
        "Jämför substitutionen, återgången från y till x, kandidatinsättningen och rotvalideringen med lösningen."
      ],
      "factorable-cubic": [
        "Sök och kontrollera en rot, faktorisera polynomet och validera alla återfunna rötter i originalekvationen. Här skriver du endast slutsvaret.",
        "Jämför rotprövning, polynomdivision, fortsatt faktorisering och validering av hela lösningsmängden med lösningen."
      ],
      "quadratic-substitution": [
        "Använd den angivna substitutionen, lös först den resulterande andragradsekvationen och validera sedan varje x-rot i originalekvationen. Här skriver du endast slutsvaret.",
        "Jämför substitution, de två nivåerna av andragradsekvationer, insättning och slutlig rotvalidering med lösningen."
      ]
    }[family];
    return { title: "Arbeta i räknehäftet", instruction: guidance[0], comparison: guidance[1] };
  }

  function details(family, input) {
    if (family === "rational-one-exclusion") {
      const p = Object.assign({}, input);
      const coefficients = [1, -p.r, p.leftNumerator - p.rightNumerator];
      const candidates = quadraticRoots.apply(null, coefficients);
      const exclusions = [p.r];
      const expected = candidates.filter(function (value) { return Math.abs(value - p.r) > 1e-9; });
      return {
        parameters: p,
        exclusions: exclusions,
        candidates: candidates,
        expected: expected,
        prompt: "x + " + clean(p.leftNumerator) + "/" + denominator(p.r) + " = " + clean(p.rightNumerator) + "/" + denominator(p.r),
        method: "Multiplicera båda led med " + denominator(p.r) + ". Då fås den generella andragradsekvationen " + polynomial(coefficients) + " = 0.",
        factorization: "Kandidaterna från andragradsekvationen är " + candidates.map(clean).join(" och ") + "."
      };
    }

    if (family === "rational-two-exclusions") {
      const numeratorCoefficients = coefficientsFromRoots(input.numeratorRoots);
      const denominatorCoefficients = coefficientsFromRoots(input.denominatorRoots);
      const exclusions = sortedUnique(input.denominatorRoots);
      const candidates = sortedUnique(input.numeratorRoots);
      const expected = candidates.filter(function (value) {
        return !exclusions.some(function (excluded) { return Math.abs(value - excluded) < 1e-9; });
      });
      return {
        parameters: { numeratorCoefficients: numeratorCoefficients, denominatorCoefficients: denominatorCoefficients },
        exclusions: exclusions,
        candidates: candidates,
        expected: expected,
        prompt: "(" + polynomial(numeratorCoefficients) + ")/(" + polynomial(denominatorCoefficients) + ") = 0",
        method: "En rationell kvot är noll när täljaren är noll och nämnaren samtidigt är skild från noll. Faktorisera därför täljaren med nollproduktmetoden.",
        factorization: "Täljaren har nollställena " + candidates.map(clean).join(" och ") + "; dessa måste jämföras med definitionsmängden."
      };
    }

    if (family === "biquadratic") {
      const first = input.squareRoots[0];
      const second = input.squareRoots[1];
      const coefficients = [1, 0, -(first + second), 0, first * second];
      const expected = sortedUnique(input.squareRoots.flatMap(function (square) { return [-Math.sqrt(square), Math.sqrt(square)]; }));
      return {
        parameters: { coefficients: coefficients }, exclusions: [], candidates: expected, expected: expected,
        prompt: "x⁴ " + (coefficients[2] < 0 ? "− " + clean(-coefficients[2]) : "+ " + clean(coefficients[2])) + "x² + " + clean(coefficients[4]) + " = 0",
        method: "Gör substitutionen y = x². Den generella metoden ger y² − " + clean(first + second) + "y + " + clean(first * second) + " = 0.",
        factorization: "Nollproduktformen är (y − " + clean(first) + ")(y − " + clean(second) + ") = 0, alltså y = " + clean(first) + " eller y = " + clean(second) + "."
      };
    }

    if (family === "factorable-cubic") {
      const coefficients = coefficientsFromRoots(input.roots);
      const expected = sortedUnique(input.roots);
      return {
        parameters: { coefficients: coefficients }, exclusions: [], candidates: expected, expected: expected,
        prompt: polynomial(coefficients) + " = 0",
        method: "Sök en heltalsrot och dividera sedan polynomet med motsvarande linjära faktor. Fortsatt faktorisering ger en fullständig nollprodukt.",
        factorization: "Nollproduktformen är " + input.roots.map(function (root) { return denominator(root); }).join("") + " = 0."
      };
    }

    const p = Object.assign({}, input);
    const substitutedValues = [p.first, p.second];
    const expected = sortedUnique(substitutedValues.flatMap(function (value) { return quadraticRoots(1, p.linearCoefficient, -value); }));
    const middle = p.linearCoefficient < 0 ? " − " + clean(-p.linearCoefficient) + "x" : " + " + clean(p.linearCoefficient) + "x";
    const substituted = "x²" + middle;
    return {
      parameters: p, exclusions: [], candidates: expected, expected: expected,
      prompt: "(" + substituted + ")² − " + clean(p.first + p.second) + "(" + substituted + ") + " + clean(p.first * p.second) + " = 0",
      method: "Använd substitutionen y = " + substituted + ". Då blir ekvationen (y − " + clean(p.first) + ")(y − " + clean(p.second) + ") = 0.",
      factorization: "Nollproduktmetoden ger y = " + clean(p.first) + " eller y = " + clean(p.second) + "; lös sedan de två andragradsekvationerna i x."
    };
  }

  function makeQuestion(family, input, rowIndex) {
    const data = details(family, input);
    const rejected = data.candidates.filter(function (candidate) {
      return data.exclusions.some(function (excluded) { return Math.abs(candidate - excluded) < 1e-9; });
    });
    const checks = data.candidates.map(function (candidate) {
      const isRejected = rejected.some(function (value) { return Math.abs(value - candidate) < 1e-9; });
      return "<li><var>x</var> = " + clean(candidate) + (isRejected
        ? " är inte tillåtet eftersom värdet gör en ursprunglig nämnare noll och måste förkastas."
        : " är tillåtet och uppfyller den ursprungliga ekvationen.") + "</li>";
    }).join("");
    const sourceParameters = Object.assign({}, data.parameters);
    return {
      id: "math-s4-" + family + "-" + String(rowIndex + 1).padStart(2, "0"),
      slot: 4,
      title: family.indexOf("rational") === 0 ? "Rationell ekvation" : "Polynomekvation",
      points: 2,
      promptHtml: "<p>Lös ekvationen <strong>" + data.prompt + "</strong>. Ange alla reella lösningar.</p>",
      workOnPaper: workOnPaper(family),
      fields: [{
        id: "roots", label: "Lösningsmängd", kind: "solution-set", points: 2, expected: data.expected,
        variable: "x", tolerance: { absolute: 1e-8, relative: 1e-9 }, help: "Skilj flera lösningar åt med semikolon."
      }],
      solutionHtml: "<p><strong>Definitionsmängd:</strong> " + (data.exclusions.length
        ? data.exclusions.map(function (value) { return "x ≠ " + clean(value); }).join(" och ")
        : "alla reella tal; ekvationen innehåller ingen nämnare med variabel") + ".</p>" +
        "<p><strong>Generell metod:</strong> " + data.method + " " + data.factorization + "</p>" +
        "<p><strong>Kontroll av kandidater:</strong></p><ul>" + checks + "</ul>" +
        "<p><strong>Svar:</strong> <var>x</var> = " + data.expected.map(clean).join(", ") + ".</p>",
      rubric: [
        { points: 1, text: "Korrekt generell metod, faktorisering eller substitution med samtliga kandidater." },
        { points: 1, text: "Korrekt kontroll av definitionsmängden och fullständig lösningsmängd." }
      ],
      sourceData: {
        skill: "rational-polynomial-equations",
        family: family,
        parameters: sourceParameters,
        exclusions: data.exclusions.slice(),
        rejectedCandidates: rejected
      }
    };
  }

  return FAMILY_ROWS.flatMap(function (entry) {
    return entry[1].map(function (parameters, index) { return makeQuestion(entry[0], parameters, index); });
  });
});
