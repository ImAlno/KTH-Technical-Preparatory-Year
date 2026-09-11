(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[4] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const G = 9.82;
  const SKILL = "vector-equilibrium";
  const FAMILY_ROWS = [
    ["hanging-masses", [
      { scenario: "Sensorparet Alka", object: "två sensormoduler", givens: { upperMassKg: 1.8, lowerMassKg: 3.2 } },
      { scenario: "Lampvikterna Bräken", object: "två dekorvikter", givens: { upperMassKg: 2.6, lowerMassKg: 1.4 } },
      { scenario: "Kalibreringsparet Ceder", object: "två kalibreringskroppar", givens: { upperMassKg: 0.85, lowerMassKg: 2.15 } },
      { scenario: "Mätlodsparet Duv", object: "två mätlod", givens: { upperMassKg: 4.1, lowerMassKg: 2.7 } },
      { scenario: "Provhållarna Eken", object: "två provhållare", givens: { upperMassKg: 1.25, lowerMassKg: 0.95 } }
    ]],
    ["cables-at-angles", [
      { scenario: "Skyltlyftet Fjord", object: "en informationsskylt", givens: { massKg: 12, angleDeg: 38 } },
      { scenario: "Armaturlyftet Glöd", object: "en armatur", givens: { massKg: 7.5, angleDeg: 52 } },
      { scenario: "Planteringsramen Hed", object: "en planteringsram", givens: { massKg: 18, angleDeg: 44 } },
      { scenario: "Akustikpanelen Isop", object: "en akustikpanel", givens: { massKg: 9.6, angleDeg: 31 } },
      { scenario: "Mätplattformen Jaspis", object: "en liten mätplattform", givens: { massKg: 22, angleDeg: 61 } }
    ]],
    ["missing-fourth-force", [
      { scenario: "Kraftnoden Karda", object: "en kopplingsnod", givens: { forces: [{ xN: 4, yN: 0 }, { xN: -1, yN: 3 }, { xN: 0, yN: -1 }] } },
      { scenario: "Styrpunkten Ljung", object: "en styrpunkt", givens: { forces: [{ xN: 5, yN: -1 }, { xN: -2, yN: 4 }, { xN: -1, yN: -2 }] } },
      { scenario: "Ringfästet Mån", object: "ett ringfäste", givens: { forces: [{ xN: -3, yN: 2 }, { xN: 1, yN: 5 }, { xN: 4, yN: -1 }] } },
      { scenario: "Testleden Näver", object: "en testled", givens: { forces: [{ xN: 2, yN: -4 }, { xN: 3, yN: 1 }, { xN: -1, yN: 2 }] } },
      { scenario: "Lastöglan Orre", object: "en lastögla", givens: { forces: [{ xN: -5, yN: -2 }, { xN: 2, yN: -3 }, { xN: 1, yN: 4 }] } }
    ]],
    ["supported-beams", [
      { scenario: "Kanalbalken Pion", object: "en horisontell kanalbalk", givens: { massKg: 16, knownSupportN: 61 } },
      { scenario: "Utställningshyllan Råg", object: "en styv utställningshylla", givens: { massKg: 8.8, knownSupportN: 34 } },
      { scenario: "Solramen Sippa", object: "en horisontell solram", givens: { massKg: 27, knownSupportN: 108 } },
      { scenario: "Kabelbron Tång", object: "en kort kabelbro", givens: { massKg: 11.5, knownSupportN: 47 } },
      { scenario: "Provlisten Uggla", object: "en styv provlist", givens: { massKg: 5.4, knownSupportN: 19 } }
    ]],
    ["frictionless-wall-contact", [
      { scenario: "Väggkulan Vide", object: "en sfärisk armatur", givens: { massKg: 6.2, cableAngleDeg: 47 } },
      { scenario: "Dekorklotet Yra", object: "ett dekorklot", givens: { massKg: 3.8, cableAngleDeg: 35 } },
      { scenario: "Mätbojen Zefyr", object: "en rund mätboj", givens: { massKg: 9.1, cableAngleDeg: 58 } },
      { scenario: "Kontaktkulan Åska", object: "en massiv kontaktkula", givens: { massKg: 14, cableAngleDeg: 42 } },
      { scenario: "Scenklotet Ärt", object: "ett sfäriskt scenföremål", givens: { massKg: 5.5, cableAngleDeg: 64 } }
    ]]
  ];

  function clean(value) {
    return String(Number(value.toFixed(8))).replace(".", ",");
  }

  function roundSignificant(value, figures) {
    if (value === 0) return 0;
    const scale = Math.pow(10, figures - 1 - Math.floor(Math.log10(Math.abs(value))));
    return Math.round((value + Number.EPSILON) * scale) / scale;
  }

  function formatSignificant(value, figures) {
    const exponent = value === 0 ? 0 : Math.floor(Math.log10(Math.abs(value)));
    const decimals = value === 0 ? figures - 1 : Math.max(0, figures - 1 - exponent);
    if (decimals === 0 && Number.isInteger(value) && value % 10 === 0) {
      return (value / Math.pow(10, exponent)).toFixed(figures - 1).replace(".", ",") + "·10<sup>" + exponent + "</sup>";
    }
    return value.toFixed(decimals).replace(".", ",");
  }

  function tolerance(value, figures) {
    const exponent = Math.floor(Math.log10(Math.abs(value))) - figures + 1;
    return { absolute: 0.500001 * Math.pow(10, exponent) };
  }

  function radians(degrees) {
    return degrees * Math.PI / 180;
  }

  function answer(family, p) {
    if (family === "hanging-masses") return (p.upperMassKg + p.lowerMassKg) * G;
    if (family === "cables-at-angles") return p.massKg * G / (2 * Math.sin(radians(p.angleDeg)));
    if (family === "missing-fourth-force") {
      const x = p.forces.reduce(function (sum, force) { return sum + force.xN; }, 0);
      const y = p.forces.reduce(function (sum, force) { return sum + force.yN; }, 0);
      return Math.sqrt(x * x + y * y);
    }
    if (family === "supported-beams") return p.massKg * G - p.knownSupportN;
    return p.massKg * G / Math.sin(radians(p.cableAngleDeg));
  }

  function vectorLines(forces) {
    return forces.map(function (force, index) {
      const magnitude = Math.sqrt(force.xN * force.xN + force.yN * force.yN);
      const endX = 260 + 62 * force.xN / magnitude;
      const endY = 105 - 62 * force.yN / magnitude;
      return '<line x1="260" y1="105" x2="' + endX + '" y2="' + endY + '" stroke="#0071e3" stroke-width="4"/><circle cx="' + endX + '" cy="' + endY + '" r="5" fill="#0071e3"/><text x="' + (endX + 8) + '" y="' + (endY - 5) + '">F' + (index + 1) + " = (" + force.xN + ", " + force.yN + ") N</text>";
    }).join("");
  }

  function situationSvg(id, family, row) {
    const p = row.givens;
    let drawing;
    let desc;
    if (family === "hanging-masses") {
      drawing = '<line x1="260" y1="25" x2="260" y2="65" stroke="#1d1d1f" stroke-width="4"/><rect x="225" y="65" width="70" height="45" fill="#dbeafe" stroke="#1d1d1f"/><line x1="260" y1="110" x2="260" y2="150" stroke="#1d1d1f" stroke-width="4"/><rect x="225" y="150" width="70" height="45" fill="#dbeafe" stroke="#1d1d1f"/><text x="308" y="93">m₁ = ' + clean(p.upperMassKg) + ' kg</text><text x="308" y="178">m₂ = ' + clean(p.lowerMassKg) + " kg</text>";
      desc = "Två kroppar hänger under varandra i två masslösa linor och är i vila. Övre och undre massan är utskrivna.";
    } else if (family === "cables-at-angles") {
      drawing = '<line x1="75" y1="32" x2="445" y2="32" stroke="#1d1d1f" stroke-width="4"/><line x1="125" y1="32" x2="260" y2="145" stroke="#0071e3" stroke-width="4"/><line x1="395" y1="32" x2="260" y2="145" stroke="#0071e3" stroke-width="4"/><rect x="215" y="145" width="90" height="48" fill="#dbeafe" stroke="#1d1d1f"/><text x="260" y="218" text-anchor="middle">m = ' + clean(p.massKg) + " kg, α = " + clean(p.angleDeg) + "° från horisontalen</text>";
      desc = "En kropp hänger symmetriskt i två lika linor. Varje lina bildar den utskrivna vinkeln med horisontalen.";
    } else if (family === "missing-fourth-force") {
      drawing = '<line x1="90" y1="105" x2="430" y2="105" stroke="#d2d2d7"/><line x1="260" y1="25" x2="260" y2="190" stroke="#d2d2d7"/><circle cx="260" cy="105" r="10" fill="#1d1d1f"/>' + vectorLines(p.forces);
      desc = "Tre kända krafter visas med sina x- och y-komposanter. Pilarna visar endast riktning och har avsiktligt samma längd.";
    } else if (family === "supported-beams") {
      drawing = '<rect x="95" y="70" width="330" height="38" fill="#dbeafe" stroke="#1d1d1f"/><path d="M125 155 L165 108 L205 155 Z M315 155 L355 108 L395 155 Z" fill="#f5f5f7" stroke="#1d1d1f"/><line x1="165" y1="108" x2="165" y2="42" stroke="#0071e3" stroke-width="4"/><circle cx="165" cy="42" r="5" fill="#0071e3"/><text x="180" y="48">F₁ = ' + clean(p.knownSupportN) + ' N</text><text x="260" y="194" text-anchor="middle">m = ' + clean(p.massKg) + " kg</text>";
      desc = "En horisontell styv kropp vilar på två stöd. Kroppens massa och den vänstra stödreaktionen är utskrivna.";
    } else {
      drawing = '<line x1="390" y1="25" x2="390" y2="205" stroke="#1d1d1f" stroke-width="5"/><circle cx="335" cy="145" r="40" fill="#dbeafe" stroke="#1d1d1f"/><line x1="335" y1="115" x2="205" y2="35" stroke="#0071e3" stroke-width="4"/><text x="95" y="31">lina, α = ' + clean(p.cableAngleDeg) + '° över horisontalen</text><text x="280" y="213">m = ' + clean(p.massKg) + " kg</text>";
      desc = "En sfärisk kropp ligger mot en friktionsfri lodrät vägg och hålls av en lina med utskriven vinkel över horisontalen.";
    }
    return '<svg viewBox="0 0 520 250" role="img" aria-labelledby="' + id + "-svg-title " + id + '-svg-desc"><title id="' + id + '-svg-title">' + row.scenario + ": kraftsituation</title><desc id=\"" + id + '-svg-desc">' + desc + " Bilden är schematisk och inte skalenlig.</desc>" + drawing + '<text x="260" y="242" text-anchor="middle">Schematisk och inte skalenlig</text></svg>';
  }

  function promptText(family, row) {
    const p = row.givens;
    if (family === "hanging-masses") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massorna " + clean(p.upperMassKg) + " kg och " + clean(p.lowerMassKg) + " kg hänger under varandra i masslösa linor och är i vila. Bestäm spännkraften i den översta linan.";
    if (family === "cables-at-angles") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg hänger symmetriskt i två lika linor. Varje lina bildar vinkeln " + clean(p.angleDeg) + "° med horisontalen. Bestäm spännkraften i en lina.";
    if (family === "missing-fourth-force") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " påverkas av tre kända krafter med komposanterna " + p.forces.map(function (force, index) { return "F" + (index + 1) + " = (" + force.xN + ", " + force.yN + ") N"; }).join(", ") + ". En fjärde kraft håller noden i vila. Bestäm den fjärde kraftens storlek.";
    if (family === "supported-beams") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " har massan " + clean(p.massKg) + " kg och vilar horisontellt på två stöd. Den ena stödreaktionen är " + clean(p.knownSupportN) + " N uppåt. Bestäm den andra stödreaktionen.";
    return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg ligger mot en lodrät, friktionsfri vägg och hålls i vila av en lina. Linan bildar " + clean(p.cableAngleDeg) + "° med horisontalen. Bestäm spännkraften i linan.";
  }

  function solution(family, p, exact, expected, figures) {
    let diagram;
    let equation;
    if (family === "hanging-masses") {
      diagram = "På systemet av båda kropparna verkar den övre spännkraften T uppåt och tyngdkrafterna m₁g och m₂g nedåt.";
      equation = "Jämvikt ger T − (m₁ + m₂)g = 0, så T = (" + clean(p.upperMassKg) + " + " + clean(p.lowerMassKg) + ")·9,82 = " + clean(exact) + " N.";
    } else if (family === "cables-at-angles") {
      diagram = "På kroppen verkar tyngdkraften mg nedåt och två lika spännkrafter T längs linorna; deras horisontella komposanter tar ut varandra.";
      equation = "Jämvikt vertikalt ger 2T sin α − mg = 0, så T = mg/(2 sin α) = " + clean(exact) + " N.";
    } else if (family === "missing-fourth-force") {
      const sumX = p.forces.reduce(function (sum, force) { return sum + force.xN; }, 0);
      const sumY = p.forces.reduce(function (sum, force) { return sum + force.yN; }, 0);
      diagram = "Rita F₄ motsatt resultanten av de tre kända krafterna och märk ut dess x- och y-komposanter.";
      equation = "Summan av de kända krafterna är (" + clean(sumX) + ", " + clean(sumY) + ") N. Därför är F₄ = (" + clean(-sumX) + ", " + clean(-sumY) + ") N och |F₄| = √((" + clean(sumX) + ")² + (" + clean(sumY) + ")²) = " + clean(exact) + " N.";
    } else if (family === "supported-beams") {
      diagram = "På kroppen verkar tyngdkraften mg nedåt och stödreaktionerna F₁ och F₂ uppåt.";
      equation = "Jämvikt vertikalt ger F₁ + F₂ − mg = 0, så F₂ = " + clean(p.massKg) + "·9,82 − " + clean(p.knownSupportN) + " = " + clean(exact) + " N.";
    } else {
      diagram = "På kroppen verkar tyngdkraften mg nedåt, normalkraften N horisontellt från väggen och spännkraften T längs linan.";
      equation = "Jämvikt vertikalt ger T sin α − mg = 0, så T = mg/sin α = " + clean(exact) + " N. Horisontellt balanseras T cos α av N.";
    }
    return "<p><strong>Kraftfigur:</strong> " + diagram + "</p><p><strong>Newtons första lag:</strong> " + equation + "</p><p>Efter avrundning till " + figures + " värdesiffror blir svaret <strong>" + formatSignificant(expected, figures) + " N</strong>.</p>";
  }

  function rubricDiagram(family) {
    if (family === "hanging-masses") return "Kraftfiguren frilägger valt system och visar övre spännkraft uppåt samt båda tyngdkrafterna nedåt.";
    if (family === "cables-at-angles") return "Kraftfiguren visar mg nedåt och två spännkrafter längs linorna; komposanternas riktningar är korrekta.";
    if (family === "missing-fourth-force") return "Vektorfiguren visar att F₄ har komposanter som är motsatta summan av de tre givna krafternas komposanter.";
    if (family === "supported-beams") return "Kraftfiguren visar mg nedåt och de två separata stödreaktionerna uppåt på den frilagda kroppen.";
    return "Kraftfiguren visar mg nedåt, väggens normalkraft horisontellt och spännkraften längs linan.";
  }

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s4-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const exact = answer(family, row.givens);
    const expected = roundSignificant(exact, figures);
    return {
      id: id,
      slot: 4,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + promptText(family, row) + " Använd g = 9,82 m/s².</p>" + situationSvg(id, family, row) + "<p><small>Figuren är schematisk och inte skalenlig; varken pillängd eller avstånd får mätas.</small></p><p>Rita en fullständig kraftfigur. Svara i N. Avrunda till " + figures + " värdesiffror.</p>",
      fields: [
        { id: "diagram", label: "Kraftfigur och resonemang", kind: "self", points: 1, multiline: true, help: "Frilägg rätt kropp/system och namnge vektorer och riktningar." },
        { id: "answer", label: "Svar (N; " + figures + " värdesiffror)", kind: "numeric", points: 1, expected: expected, targetUnit: "N", tolerance: tolerance(expected, figures), help: "Ange den efterfrågade kraftens storlek." }
      ],
      solutionHtml: solution(family, row.givens, exact, expected, figures),
      rubric: [
        { points: 1, text: rubricDiagram(family) },
        { points: 1, text: "Newtons första lag används komponentvis och ger rätt kraftstorlek, enhet och avrundning." }
      ],
      sourceData: {
        skill: SKILL,
        family: family,
        caseNumber: familyIndex * 5 + rowIndex + 1,
        g: G,
        givens: JSON.parse(JSON.stringify(row.givens)),
        significantFigures: figures,
        targetUnit: "N",
        requestedUnitLabel: "N",
        scenario: row.scenario
      }
    };
  }

  return FAMILY_ROWS.reduce(function (questions, entry, familyIndex) {
    return questions.concat(entry[1].map(function (row, rowIndex) { return makeQuestion(entry[0], row, familyIndex, rowIndex); }));
  }, []);
});
