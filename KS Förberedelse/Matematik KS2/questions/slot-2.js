(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_MATH_SLOTS = root.KS_MATH_SLOTS || {};
    root.KS_MATH_SLOTS[2] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const FAMILY_ROWS = [
    ["abs-linear", [
      { a: 3, b: -4, c: 1, d: 6 }, { a: 2, b: 5, c: -1, d: 8 }, { a: 4, b: 1, c: 2, d: 5 },
      { a: 1, b: 6, c: 2, d: 9 }, { a: 5, b: -9, c: -2, d: 12 }
    ]],
    ["abs-constant", [
      { a: 2, b: -3, k: 7 }, { a: 3, b: 3, k: 6 }, { a: 4, b: -5, k: 3 }, { a: 5, b: 6, k: 9 }, { a: 2, b: 7, k: 5 }
    ]],
    ["scaled-shifted-abs", [
      { m: 2, b: 3, c: 1, d: 11 }, { m: 3, b: -1, c: 2, d: 14 }, { m: 4, b: 5, c: 3, d: 15 },
      { m: 5, b: -4, c: 1, d: 16 }, { m: 2, b: 7, c: 4, d: 22 }
    ]],
    ["abs-equals-abs", [
      { a: 2, b: 3, c: 1, d: 0 }, { a: 3, b: -5, c: 2, d: 5 }, { a: 4, b: 3, c: -1, d: 3 },
      { a: 2, b: -7, c: 3, d: 2 }, { a: 5, b: 9, c: 2, d: -9 }
    ]],
    ["contextual-distance", [
      { center: -4, distance: 6, context: "En markering på en tallinje ligger 6 enheter från koordinaten −4." },
      { center: 3, distance: 9, context: "En rälsvagns signerade läge ligger 9 meter från kontrollpunkten med koordinat 3." },
      { center: 11, distance: 5, context: "Ett mätvärde avviker med 5 steg från referensnivån 11." },
      { center: -8, distance: 7, context: "En kodpunkt ligger 7 skalstreck från talet −8 på en linjär skala." },
      { center: 14, distance: 12, context: "Ett positionsvärde har avståndet 12 enheter till mittvärdet 14." }
    ]]
  ];

  function clean(value) {
    const normalized = Math.abs(value) < 1e-10 ? 0 : value;
    const rendered = Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(8)));
    return rendered.replace(".", ",");
  }

  function workOnPaper(family) {
    const guidance = {
      "abs-linear": [
        "Skriv båda absolutbeloppsgrenarna, lös dem var för sig och gör substitutionskontroll av varje kandidat. Här skriver du endast slutsvaret.",
        "Jämför de två grenarna, kandidaternas insättning och vilka lösningar som godtas med lösningen."
      ],
      "abs-constant": [
        "Skriv båda fallen för absolutbeloppet lika med konstanten, lös dem och kontrollera varje kandidat genom substitution. Här skriver du endast slutsvaret.",
        "Jämför de två teckenfallen, substitutionskontrollerna och den fullständiga lösningsmängden med lösningen."
      ],
      "scaled-shifted-abs": [
        "Isolera det förskjutna absolutbeloppet, skriv båda grenarna, lös dem och kontrollera varje kandidat genom substitution. Här skriver du endast slutsvaret.",
        "Jämför isoleringen, absolutbeloppets två grenar, insättningen och godkända kandidater med lösningen."
      ],
      "abs-equals-abs": [
        "Skriv båda grenarna med plus- och minusfall för absolutbeloppen, lös dem och kontrollera varje kandidat genom substitution. Här skriver du endast slutsvaret.",
        "Jämför plus- och minusfallen, kandidaternas substitutionskontroll och den fullständiga lösningen med lösningen."
      ],
      "contextual-distance": [
        "Skriv de två riktningarna från referenspunkten, lös båda fallen och kontrollera varje kandidat genom substitution i avståndsvillkoret. Här skriver du endast slutsvaret.",
        "Jämför tallinjens två grenar, avståndstolkningen, substitutionskontrollerna och svaret med lösningen."
      ]
    }[family];
    return { title: "Arbeta i räknehäftet", instruction: guidance[0], comparison: guidance[1] };
  }

  function linear(a, b) {
    let value = a === 1 ? "x" : a === -1 ? "−x" : clean(a) + "x";
    if (b > 0) value += " + " + clean(b);
    if (b < 0) value += " − " + clean(-b);
    return value;
  }

  function branchRoots(family, p) {
    if (family === "abs-linear" || family === "abs-equals-abs") {
      const values = [];
      if (Math.abs(p.a - p.c) > 1e-10) values.push((p.d - p.b) / (p.a - p.c));
      if (Math.abs(p.a + p.c) > 1e-10) values.push(-(p.b + p.d) / (p.a + p.c));
      return values;
    }
    if (family === "abs-constant") return [(-p.b - p.k) / p.a, (-p.b + p.k) / p.a];
    if (family === "scaled-shifted-abs") {
      const distance = (p.d - p.c) / p.m;
      return distance < 0 ? [] : [p.b - distance, p.b + distance];
    }
    return [p.center - p.distance, p.center + p.distance];
  }

  function sides(family, p, x) {
    if (family === "abs-equals-abs") return [Math.abs(p.a * x + p.b), Math.abs(p.c * x + p.d)];
    if (family === "scaled-shifted-abs") return [p.m * Math.abs(x - p.b) + p.c, p.d];
    if (family === "contextual-distance") return [Math.abs(x - p.center), p.distance];
    return [Math.abs(p.a * x + p.b), family === "abs-constant" ? p.k : p.c * x + p.d];
  }

  function solve(family, p) {
    return candidatesFor(family, p).filter(function (candidate) {
      const evaluated = sides(family, p, candidate);
      return Number.isFinite(evaluated[0]) && Number.isFinite(evaluated[1]) && Math.abs(evaluated[0] - evaluated[1]) < 1e-8;
    });
  }

  function candidatesFor(family, p) {
    return branchRoots(family, p).map(function (value) { return Number(value.toFixed(10)); })
      .sort(function (left, right) { return left - right; })
      .filter(function (candidate, index, values) {
        return index === 0 || Math.abs(candidate - values[index - 1]) >= 1e-9;
      });
  }

  function presentation(family, p) {
    if (family === "abs-linear") return { prompt: "|" + linear(p.a, p.b) + "| = " + linear(p.c, p.d), split: linear(p.a, p.b) + " = ±(" + linear(p.c, p.d) + ")" };
    if (family === "abs-constant") return { prompt: "|" + linear(p.a, p.b) + "| = " + clean(p.k), split: linear(p.a, p.b) + " = " + clean(p.k) + " eller " + linear(p.a, p.b) + " = −" + clean(p.k) };
    if (family === "scaled-shifted-abs") return { prompt: clean(p.m) + "|x " + (p.b < 0 ? "+ " + clean(-p.b) : "− " + clean(p.b)) + "| + " + clean(p.c) + " = " + clean(p.d), split: "|x " + (p.b < 0 ? "+ " + clean(-p.b) : "− " + clean(p.b)) + "| = " + clean((p.d - p.c) / p.m) };
    if (family === "abs-equals-abs") return { prompt: "|" + linear(p.a, p.b) + "| = |" + linear(p.c, p.d) + "|", split: linear(p.a, p.b) + " = ±(" + linear(p.c, p.d) + ")" };
    return { prompt: "|x " + (p.center < 0 ? "+ " + clean(-p.center) : "− " + clean(p.center)) + "| = " + clean(p.distance), split: "x − (" + clean(p.center) + ") = ±" + clean(p.distance) };
  }

  function makeQuestion(family, parameters, rowIndex) {
    const shown = presentation(family, parameters);
    const candidates = candidatesFor(family, parameters);
    const expected = solve(family, parameters);
    const contextualLead = family === "contextual-distance" ? "<p>" + parameters.context + " Låt <var>x</var> beteckna det okända värdet och bestäm alla möjliga värden på <var>x</var>.</p>" :
      "<p>Lös ekvationen <strong>" + shown.prompt + "</strong>. Svara exakt.</p>";
    const verification = candidates.map(function (candidate) {
      const evaluated = sides(family, parameters, candidate);
      const accepted = Number.isFinite(evaluated[0]) && Number.isFinite(evaluated[1]) && Math.abs(evaluated[0] - evaluated[1]) < 1e-8;
      return "<li><var>x</var> = " + clean(candidate) + ": insättning ger vänsterledet " + clean(evaluated[0]) +
        " och högerledet " + clean(evaluated[1]) + (accepted ? "; kandidaten godtas." : "; leden är inte lika, så kandidaten förkastas.") + "</li>";
    }).join("");
    return {
      id: "math-s2-" + family + "-" + String(rowIndex + 1).padStart(2, "0"),
      slot: 2,
      title: family === "contextual-distance" ? "Avstånd på tallinjen" : "Absolutbeloppsekvation",
      points: 2,
      promptHtml: contextualLead,
      workOnPaper: workOnPaper(family),
      fields: [{
        id: "roots", label: "Lösningsmängd", kind: "solution-set", points: 2, expected: expected, variable: "x",
        tolerance: { absolute: 1e-8, relative: 1e-9 }, help: "Skilj flera värden åt med semikolon."
      }],
      solutionHtml: "<p>Absolutbelopp beskriver avstånd. Ekvationen skrivs som <strong>" + shown.prompt + "</strong>.</p>" +
        "<p>De två möjliga grenarna eller fallen fås av <strong>" + shown.split + "</strong>. När de linjära ekvationerna löses erhålls kandidaterna " + candidates.map(clean).join(" och ") + ".</p>" +
        "<p><strong>Prövning:</strong></p><ul>" + verification + "</ul><p><strong>Svar:</strong> <var>x</var> = " + expected.map(clean).join(", ") + ".</p>",
      rubric: [
        { points: 1, text: "Korrekt uppdelning i två fall eller korrekt avståndstolkning." },
        { points: 1, text: "Korrekt kontroll av villkoren och fullständig lösningsmängd." }
      ],
      sourceData: {
        skill: "absolute-value-equations",
        family: family,
        parameters: Object.assign({}, parameters),
        branchCandidates: candidates.slice(),
        rejectedCandidates: candidates.filter(function (candidate) {
          return !expected.some(function (root) { return Math.abs(root - candidate) < 1e-9; });
        })
      }
    };
  }

  return FAMILY_ROWS.flatMap(function (entry) {
    return entry[1].map(function (parameters, index) { return makeQuestion(entry[0], parameters, index); });
  });
});
