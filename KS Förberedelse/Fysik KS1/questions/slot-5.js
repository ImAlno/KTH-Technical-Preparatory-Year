(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[5] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const G = 9.82;
  const SKILL = "newton-and-friction";
  const FAMILY_ROWS = [
    ["horizontal-pull", [
      { scenario: "Packlådan Alv", object: "en packlåda", givens: { massKg: 8.0, pullForceN: 42, frictionCoefficient: 0.22 } },
      { scenario: "Materialvagnen Bärnsten", object: "en materialvagn", givens: { massKg: 5.5, pullForceN: 31, frictionCoefficient: 0.18 } },
      { scenario: "Provkistan Cumulus", object: "en provkista", givens: { massKg: 12, pullForceN: 58, frictionCoefficient: 0.25 } },
      { scenario: "Kabelboxen Dopping", object: "en kabelbox", givens: { massKg: 3.2, pullForceN: 18, frictionCoefficient: 0.14 } },
      { scenario: "Reservpallen Enbär", object: "en reservdelspall", givens: { massKg: 20, pullForceN: 95, frictionCoefficient: 0.30 } }
    ]],
    ["inclined-plane", [
      { scenario: "Grusvagnen Frost", object: "en grusvagn", givens: { massKg: 65, angleDeg: 18, frictionForceN: 80 } },
      { scenario: "Mätkälken Gnejs", object: "en mätkälke", givens: { massKg: 22, angleDeg: 27, frictionForceN: 43 } },
      { scenario: "Transportsläden Halm", object: "en transportsläde", givens: { massKg: 48, angleDeg: 34, frictionForceN: 110 } },
      { scenario: "Provplattformen Ilex", object: "en provplattform", givens: { massKg: 15, angleDeg: 25, frictionForceN: 27 } },
      { scenario: "Lastpulka Järv", object: "en lastpulka", givens: { massKg: 90, angleDeg: 12, frictionForceN: 100 } }
    ]],
    ["connected-masses", [
      { scenario: "Bordssystemet Klint", object: "två sammanbundna klossar", givens: { tableMassKg: 4.0, hangingMassKg: 2.2, frictionCoefficient: 0.12 } },
      { scenario: "Trådsystemet Lärka", object: "två sammanbundna provkroppar", givens: { tableMassKg: 6.5, hangingMassKg: 3.1, frictionCoefficient: 0.18 } },
      { scenario: "Pulleyprovet Malva", object: "två sammanbundna mätvikter", givens: { tableMassKg: 2.8, hangingMassKg: 1.4, frictionCoefficient: 0.10 } },
      { scenario: "Klossystemet Nektar", object: "två sammanbundna klossar", givens: { tableMassKg: 9.0, hangingMassKg: 4.0, frictionCoefficient: 0.22 } },
      { scenario: "Dragparet Oxel", object: "två sammanbundna kroppar", givens: { tableMassKg: 5.2, hangingMassKg: 2.5, frictionCoefficient: 0.16 } }
    ]],
    ["unknown-pull", [
      { scenario: "Arkivlådan Poppel", object: "en arkivlåda", givens: { massKg: 7.5, accelerationMps2: 1.6, frictionCoefficient: 0.21 } },
      { scenario: "Komponentbrickan Renfana", object: "en komponentbricka", givens: { massKg: 3.8, accelerationMps2: 2.4, frictionCoefficient: 0.16 } },
      { scenario: "Instrumentpallen Sunnan", object: "en instrumentpall", givens: { massKg: 15, accelerationMps2: 0.85, frictionCoefficient: 0.28 } },
      { scenario: "Fältlådan Tistel", object: "en fältlåda", givens: { massKg: 9.2, accelerationMps2: 1.2, frictionCoefficient: 0.12 } },
      { scenario: "Maskinbasen Ume", object: "en maskinbas", givens: { massKg: 24, accelerationMps2: 0.55, frictionCoefficient: 0.32 } }
    ]],
    ["unknown-friction", [
      { scenario: "Rälsvagnen Vete", object: "en rälsvagn", givens: { massKg: 15, driveForceN: 44, finalSpeedMps: 5.0, elapsedS: 4.0 } },
      { scenario: "Testlådan Ymnig", object: "en testlåda", givens: { massKg: 8.0, driveForceN: 35, finalSpeedMps: 6.0, elapsedS: 2.5 } },
      { scenario: "Serviceplattformen Zeta", object: "en serviceplattform", givens: { massKg: 20, driveForceN: 70, finalSpeedMps: 4.5, elapsedS: 3.0 } },
      { scenario: "Sorteringsboxen Ål", object: "en sorteringsbox", givens: { massKg: 5.5, driveForceN: 28, finalSpeedMps: 7.0, elapsedS: 2.0 } },
      { scenario: "Utrustningsvagnen Älv", object: "en utrustningsvagn", givens: { massKg: 12, driveForceN: 56, finalSpeedMps: 8.0, elapsedS: 3.0 } }
    ]]
  ];

  const FAMILY_INFO = {
    "horizontal-pull": { targetUnit: "m/s2", unitLabel: "m/s²" },
    "inclined-plane": { targetUnit: "m/s2", unitLabel: "m/s²" },
    "connected-masses": { targetUnit: "m/s2", unitLabel: "m/s²" },
    "unknown-pull": { targetUnit: "N", unitLabel: "N" },
    "unknown-friction": { targetUnit: "N", unitLabel: "N" }
  };

  function clean(value) {
    return String(Number(value.toFixed(8))).replace(".", ",");
  }

  function radians(degrees) {
    return degrees * Math.PI / 180;
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

  function derived(family, p) {
    if (family === "horizontal-pull") return (p.pullForceN - p.frictionCoefficient * p.massKg * G) / p.massKg;
    if (family === "inclined-plane") return G * Math.sin(radians(p.angleDeg)) - p.frictionForceN / p.massKg;
    if (family === "connected-masses") return (p.hangingMassKg - p.tableMassKg * p.frictionCoefficient) * G / (p.hangingMassKg + p.tableMassKg);
    if (family === "unknown-pull") return p.massKg * (p.accelerationMps2 + p.frictionCoefficient * G);
    return p.driveForceN - p.massKg * p.finalSpeedMps / p.elapsedS;
  }

  function normalForce(family, p) {
    if (family === "inclined-plane") return p.massKg * G * Math.cos(radians(p.angleDeg));
    if (family === "connected-masses") return p.tableMassKg * G;
    return p.massKg * G;
  }

  function frictionForce(family, p) {
    if (family === "inclined-plane") return p.frictionForceN;
    if (family === "connected-masses") return p.frictionCoefficient * p.tableMassKg * G;
    if (family === "unknown-friction") return derived(family, p);
    return p.frictionCoefficient * p.massKg * G;
  }

  function dynamicsSvg(id, family, row) {
    const p = row.givens;
    let drawing;
    let desc;
    if (family === "inclined-plane") {
      drawing = '<path d="M75 190 L440 190 L440 65 Z" fill="#f5f5f7" stroke="#1d1d1f" stroke-width="3"/><rect x="285" y="100" width="75" height="48" fill="#dbeafe" stroke="#1d1d1f" transform="rotate(-19 322 124)"/><path d="M110 188 A45 45 0 0 1 153 173" fill="none" stroke="#6e6e73"/><text x="147" y="174">' + clean(p.angleDeg) + '°</text><text x="210" y="40">m = ' + clean(p.massKg) + ' kg, Fᶠ = ' + clean(p.frictionForceN) + " N</text>";
      desc = "En kropp rör sig nedför ett lutande plan. Massan, lutningsvinkeln och den kinetiska friktionskraften är utskrivna.";
    } else if (family === "connected-masses") {
      drawing = '<line x1="65" y1="135" x2="365" y2="135" stroke="#1d1d1f" stroke-width="4"/><rect data-role="table-body" x="145" y="75" width="85" height="60" fill="#dbeafe" stroke="#1d1d1f"/><circle data-role="pulley" cx="365" cy="105" r="30" fill="#f5f5f7" stroke="#1d1d1f"/><path data-role="rope" d="M230 75 L365 75 A30 30 0 0 1 395 105 L395 160" fill="none" stroke="#0071e3" stroke-width="4"/><rect data-role="hanging-body" x="360" y="160" width="70" height="48" fill="#dbeafe" stroke="#1d1d1f"/><text x="120" y="55">m₁ = ' + clean(p.tableMassKg) + ' kg, μ = ' + clean(p.frictionCoefficient) + '</text><text x="355" y="232">m₂ = ' + clean(p.hangingMassKg) + " kg</text>";
      desc = "En kropp på ett horisontellt bord är kopplad över en ideal trissa till en hängande kropp. Massor och friktionstal är utskrivna.";
    } else {
      const force = family === "horizontal-pull" ? p.pullForceN : family === "unknown-friction" ? p.driveForceN : null;
      drawing = '<line x1="60" y1="165" x2="460" y2="165" stroke="#1d1d1f" stroke-width="4"/><rect x="185" y="95" width="125" height="70" fill="#dbeafe" stroke="#1d1d1f"/><line x1="310" y1="130" x2="410" y2="130" stroke="#0071e3" stroke-width="4"/><path d="M413 130 l-16 -8 v16 z" fill="#0071e3"/><text x="325" y="112">' + (force === null ? "F söks" : "F = " + clean(force) + " N") + '</text><text x="250" y="205" text-anchor="middle">m = ' + clean(p.massKg) + " kg</text>";
      if (family === "horizontal-pull") drawing += '<text x="250" y="228" text-anchor="middle">μ = ' + clean(p.frictionCoefficient) + "</text>";
      if (family === "unknown-pull") drawing += '<text x="250" y="228" text-anchor="middle">a = ' + clean(p.accelerationMps2) + " m/s², μ = " + clean(p.frictionCoefficient) + "</text>";
      if (family === "unknown-friction") drawing += '<text x="250" y="228" text-anchor="middle">0 → ' + clean(p.finalSpeedMps) + " m/s på " + clean(p.elapsedS) + " s</text>";
      desc = "En kropp rör sig åt höger på ett horisontellt underlag. Givna mass-, kraft-, friktions- och rörelsedata är utskrivna.";
    }
    return '<svg viewBox="0 0 520 260" role="img" aria-labelledby="' + id + "-svg-title " + id + '-svg-desc"><title id="' + id + '-svg-title">' + row.scenario + ": dynamiksituation</title><desc id=\"" + id + '-svg-desc">' + desc + " Bilden är schematisk och inte skalenlig; pillängderna kodar inte kraftstorlek.</desc>" + drawing + '<text x="260" y="252" text-anchor="middle">Schematisk och inte skalenlig</text></svg>';
  }

  function promptText(family, row) {
    const p = row.givens;
    if (family === "horizontal-pull") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg dras åt höger av den horisontella kraften " + clean(p.pullForceN) + " N. Det kinetiska friktionstalet är " + clean(p.frictionCoefficient) + ". Bestäm accelerationen.";
    if (family === "inclined-plane") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg glider nedför ett plan som lutar " + clean(p.angleDeg) + "°. Den kinetiska friktionskraften är " + clean(p.frictionForceN) + " N uppför planet. Bestäm accelerationen nedför planet.";
    if (family === "connected-masses") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " är kopplade med en masslös tråd över en ideal trissa. Kroppen på bordet har massan " + clean(p.tableMassKg) + " kg och friktionstalet " + clean(p.frictionCoefficient) + "; den hängande kroppen har massan " + clean(p.hangingMassKg) + " kg. Systemet släpps från vila. Bestäm accelerationens storlek.";
    if (family === "unknown-pull") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg ska accelerera åt höger med " + clean(p.accelerationMps2) + " m/s² på ett horisontellt underlag där det kinetiska friktionstalet är " + clean(p.frictionCoefficient) + ". Bestäm den horisontella dragkraften.";
    return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg startar från vila och påverkas av en konstant drivkraft på " + clean(p.driveForceN) + " N åt höger. Efter " + clean(p.elapsedS) + " s är farten " + clean(p.finalSpeedMps) + " m/s. Bestäm den konstanta kinetiska friktionskraftens storlek.";
  }

  function solution(family, p, exact, expected, figures, unitLabel) {
    let diagram;
    let equation;
    if (family === "horizontal-pull") {
      diagram = "På kroppen verkar mg nedåt, N uppåt, dragkraften F åt höger och friktionen Fᶠ åt vänster.";
      equation = "Jämvikt vertikalt ger N = mg. Då är Fᶠ = μN = μmg och Newton II horisontellt ger a = (F − μmg)/m = " + clean(exact) + " m/s².";
    } else if (family === "inclined-plane") {
      diagram = "På kroppen verkar mg nedåt, N vinkelrätt från planet och Fᶠ uppför planet. Positiv riktning väljs nedför planet.";
      equation = "Normalkraften är N = mg cos α > 0. Newton II längs planet ger mg sin α − Fᶠ = ma, alltså a = g sin α − Fᶠ/m = " + clean(exact) + " m/s².";
    } else if (family === "connected-masses") {
      diagram = "Frilägg båda kropparna: bordskroppen har T åt höger och Fᶠ åt vänster; den hängande kroppen har m₂g nedåt och T uppåt.";
      equation = "Adderade kraftekvationer ger m₂g − μm₁g = (m₁ + m₂)a. Därför a = (m₂ − μm₁)g/(m₁ + m₂) = " + clean(exact) + " m/s².";
    } else if (family === "unknown-pull") {
      diagram = "På kroppen verkar mg nedåt, N uppåt, den sökta dragkraften F åt höger och Fᶠ åt vänster.";
      equation = "N = mg och Fᶠ = μmg. Newton II ger F − μmg = ma, alltså F = m(a + μg) = " + clean(exact) + " N.";
    } else {
      diagram = "På kroppen verkar mg nedåt, N uppåt, drivkraften åt höger och den sökta friktionen åt vänster.";
      equation = "Rörelsen är likformigt accelererad, så a = Δv/Δt = " + clean(p.finalSpeedMps / p.elapsedS) + " m/s². Newton II ger Fᴅ − Fᶠ = ma, alltså Fᶠ = Fᴅ − ma = " + clean(exact) + " N.";
    }
    return "<p><strong>Kraftfigur:</strong> " + diagram + "</p><p><strong>Newtons lagar:</strong> " + equation + "</p><p>Alla kontroller ger positiv normalkraft och rörelse i den angivna riktningen. Efter avrundning till " + figures + " värdesiffror blir svaret <strong>" + formatSignificant(expected, figures) + " " + unitLabel + "</strong>.</p>";
  }

  function rubricDiagram(family) {
    if (family === "inclined-plane") return "Kraftfiguren visar mg, normalkraft och kinetisk friktion med rätt riktningar; positiv riktning längs planet anges.";
    if (family === "connected-masses") return "Två separata kraftfigurer visar tyngd/spännkraft för den hängande kroppen samt N, mg, T och friktion för bordskroppen.";
    return "Kraftfiguren visar mg nedåt, N uppåt samt driv-/dragkraft och kinetisk friktion i motsatta horisontella riktningar.";
  }

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s5-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const info = FAMILY_INFO[family];
    const exact = derived(family, row.givens);
    const expected = roundSignificant(exact, figures);
    const normal = normalForce(family, row.givens);
    const friction = frictionForce(family, row.givens);
    if (!(normal > 0) || !(friction > 0) || !(exact > 0)) throw new Error("Ogiltig fysikparameter i " + row.scenario);
    return {
      id: id,
      slot: 5,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + promptText(family, row) + " Använd g = 9,82 m/s² och försumma övriga motstånd.</p>" + dynamicsSvg(id, family, row) + "<p><small>Figuren är schematisk och inte skalenlig; använd endast utskrivna data.</small></p><p>Rita kraftfigur(er). Svara i " + info.unitLabel + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [
        { id: "diagram", label: "Kraftfigur och resonemang", kind: "self", points: 1, multiline: true, help: "Frilägg varje relevant kropp och ange vald positiv riktning." },
        { id: "answer", label: "Svar (" + info.unitLabel + "; " + figures + " värdesiffror)", kind: "numeric", points: 1, expected: expected, targetUnit: info.targetUnit, tolerance: tolerance(expected, figures), help: "Ange den efterfrågade accelerationens eller kraftens storlek." }
      ],
      solutionHtml: solution(family, row.givens, exact, expected, figures, info.unitLabel),
      rubric: [
        { points: 1, text: rubricDiagram(family) },
        { points: 1, text: "Newtons första/andra lag och friktionssambandet används konsekvent och ger rätt storlek, enhet och avrundning." }
      ],
      sourceData: {
        skill: SKILL,
        family: family,
        caseNumber: familyIndex * 5 + rowIndex + 1,
        g: G,
        givens: Object.assign({}, row.givens),
        normalForceN: normal,
        frictionForceN: friction,
        motionDirection: family === "inclined-plane" ? "down-slope" : family === "connected-masses" ? "hanging-mass-down" : "right",
        significantFigures: figures,
        targetUnit: info.targetUnit,
        requestedUnitLabel: info.unitLabel,
        scenario: row.scenario
      }
    };
  }

  return FAMILY_ROWS.reduce(function (questions, entry, familyIndex) {
    return questions.concat(entry[1].map(function (row, rowIndex) { return makeQuestion(entry[0], row, familyIndex, rowIndex); }));
  }, []);
});
