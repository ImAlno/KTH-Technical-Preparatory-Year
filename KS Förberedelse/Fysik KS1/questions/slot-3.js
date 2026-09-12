(function (root, factory) {
  const diagramKit = typeof module === "object" && module.exports
    ? require("../../assets/js/diagram-kit.js")
    : root && root.KS && root.KS.diagram;
  const bank = factory(diagramKit);
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[3] = bank;
  }
})(typeof window !== "undefined" ? window : null, function (diagramKit) {
  "use strict";

  if (!diagramKit || typeof diagramKit.create !== "function" || typeof diagramKit.validateManifest !== "function") {
    throw new Error("diagram-kit dependency is required before constructing physics slot 3");
  }

  const G = 9.82;
  const SKILL = "vertical-motion";
  const FAMILY_ROWS = [
    ["time-to-apex", [
      { scenario: "Ljusmarkören Aster", object: "en ljusmarkör", givens: { initialSpeedMps: 5.4 } },
      { scenario: "Provkulan Bambu", object: "en liten provkula", givens: { initialSpeedMps: 8.7 } },
      { scenario: "Mätsonden Cirrus", object: "en kompakt mätsond", givens: { initialSpeedMps: 12.3 } },
      { scenario: "Scenbollen Dun", object: "en tung scenboll", givens: { initialSpeedMps: 16.2 } },
      { scenario: "Spårkroppen Elda", object: "en spårbar testkropp", givens: { initialSpeedMps: 21.0 } }
    ]],
    ["maximum-height", [
      { scenario: "Startplattan Fura", object: "en märkt metallkula", givens: { initialHeightM: 0, initialSpeedMps: 7.8 } },
      { scenario: "Arbetsbordet Glimmer", object: "en gummikropp", givens: { initialHeightM: 1.4, initialSpeedMps: 6.2 } },
      { scenario: "Servicebryggan Humle", object: "en instrumentkapsel", givens: { initialHeightM: 4.5, initialSpeedMps: 10.1 } },
      { scenario: "Golvmärket Idun", object: "en kompakt boll", givens: { initialHeightM: 0, initialSpeedMps: 13.6 } },
      { scenario: "Lastkajen Juno", object: "en kalibreringskropp", givens: { initialHeightM: 2.2, initialSpeedMps: 4.9 } }
    ]],
    ["initial-speed", [
      { scenario: "Höjdmätaren Komet", object: "en mätkula", givens: { laterVelocityMps: -2.4, elapsedS: 2.1 } },
      { scenario: "Fotocellen Lava", object: "en liten tät kula", givens: { laterVelocityMps: 1.8, elapsedS: 1.4 } },
      { scenario: "Radarprovet Myr", object: "en reflektorförsedd kropp", givens: { laterVelocityMps: -5.2, elapsedS: 2.6 } },
      { scenario: "Tidsporten Norr", object: "en spårkula", givens: { laterVelocityMps: 0.6, elapsedS: 1.1 } },
      { scenario: "Laserbanan Odon", object: "en mörk testkropp", givens: { laterVelocityMps: -8.0, elapsedS: 3.2 } }
    ]],
    ["impact-speed", [
      { scenario: "Mätplattformen Pärla", object: "en kompakt sensorboll", givens: { initialHeightM: 8.5, flightTimeS: 2.4 } },
      { scenario: "Utsiktsdäcket Rönn", object: "en provkapsel", givens: { initialHeightM: 12.5, flightTimeS: 3.0 } },
      { scenario: "Lagerhyllan Sälg", object: "en stum gummikula", givens: { initialHeightM: 6.2, flightTimeS: 2.0 } },
      { scenario: "Mastkorgen Timjan", object: "en datalogger", givens: { initialHeightM: 18.0, flightTimeS: 3.4 } },
      { scenario: "Rampavsatsen Ulv", object: "en liten metallkropp", givens: { initialHeightM: 4.0, flightTimeS: 1.6 } }
    ]],
    ["flight-time", [
      { scenario: "Planmarken Vass", object: "en märkt boll", givens: { initialHeightM: 0, initialSpeedMps: 9.5 } },
      { scenario: "Podiet Ylle", object: "en kompakt skumkula", givens: { initialHeightM: 2.5, initialSpeedMps: 7.2 } },
      { scenario: "Trappavsatsen Zinnia", object: "en liten mätkropp", givens: { initialHeightM: 6.8, initialSpeedMps: 4.6 } },
      { scenario: "Testbocken Åker", object: "en tung boll", givens: { initialHeightM: 1.2, initialSpeedMps: 12.5 } },
      { scenario: "Takgården Äng", object: "en signalboll", givens: { initialHeightM: 9.0, initialSpeedMps: 3.0 } }
    ]]
  ];

  const FAMILY_INFO = {
    "time-to-apex": { targetUnit: "s", unitLabel: "s", question: "Bestäm tiden från kastet tills kroppen når sin högsta punkt." },
    "maximum-height": { targetUnit: "m", unitLabel: "m", question: "Bestäm kroppens största höjd över marknivån." },
    "initial-speed": { targetUnit: "m/s", unitLabel: "m/s", question: "Bestäm utgångshastigheten, med positiv riktning uppåt." },
    "impact-speed": { targetUnit: "m/s", unitLabel: "m/s", question: "Bestäm farten precis före träffen med marken." },
    "flight-time": { targetUnit: "s", unitLabel: "s", question: "Bestäm tiden från kastet tills kroppen når marken." }
  };

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

  function addShape(diagram, shapes, layer, shape) {
    shapes.push(shape);
    diagram.add(layer, shape);
    return shape;
  }

  function addLabel(diagram, shapes, options) {
    const label = diagramKit.label({
      id: options.id,
      at: options.at,
      text: options.text,
      anchorId: options.anchorId,
      avoid: shapes.filter(function (shape) { return shape.id !== options.anchorId; }).map(function (shape) { return shape.id; }),
      minClearance: 6,
      textAnchor: options.textAnchor || "middle",
      fontSize: options.fontSize || 14,
      background: true
    });
    diagram.add("labels", label);
    return label;
  }

  function answer(family, p) {
    if (family === "time-to-apex") return p.initialSpeedMps / G;
    if (family === "maximum-height") return p.initialHeightM + p.initialSpeedMps * p.initialSpeedMps / (2 * G);
    if (family === "initial-speed") return p.laterVelocityMps + G * p.elapsedS;
    if (family === "impact-speed") {
      const initialSpeed = (-p.initialHeightM + G * p.flightTimeS * p.flightTimeS / 2) / p.flightTimeS;
      return Math.abs(initialSpeed - G * p.flightTimeS);
    }
    return (p.initialSpeedMps + Math.sqrt(p.initialSpeedMps * p.initialSpeedMps + 2 * G * p.initialHeightM)) / G;
  }

  function givensText(family, p) {
    if (family === "time-to-apex") return "utgångshastigheten " + clean(p.initialSpeedMps) + " m/s rakt uppåt";
    if (family === "maximum-height") return "utgångshastigheten " + clean(p.initialSpeedMps) + " m/s från höjden " + clean(p.initialHeightM) + " m över marken";
    if (family === "initial-speed") return "hastigheten " + clean(p.laterVelocityMps) + " m/s efter " + clean(p.elapsedS) + " s (ett minustecken betyder nedåt)";
    if (family === "impact-speed") return "utgångspunkten " + clean(p.initialHeightM) + " m över marken och flygtiden " + clean(p.flightTimeS) + " s";
    return "utgångshastigheten " + clean(p.initialSpeedMps) + " m/s från höjden " + clean(p.initialHeightM) + " m över marken";
  }

  function motionFigure(id, row, family) {
    const p = row.givens;
    const diagram = diagramKit.create({
      id: id + "-diagram",
      title: row.scenario + ": vertikal rörelse",
      description: "En kropp kastas vertikalt längs en namngiven bana från en markerad marknivå. Positiv riktning är uppåt och figurens längder är inte skalenliga.",
      purpose: "prompt",
      width: 620,
      height: 340
    });
    const shapes = [];
    const ground = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-ground", a: [65, 270], b: [555, 270], role: "ground", strokeWidth: 3 }));
    const trajectory = addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-trajectory", a: [300, 52], b: [300, 270], role: "motion", strokeWidth: 2 }));
    const origin = addShape(diagram, shapes, "information", diagramKit.circle({ id: id + "-origin", center: [300, 270], radius: 4, role: "point", strokeWidth: 2 }));
    const heightScale = 8;
    const bodyRadius = 17;
    const bodyBottomY = p.initialHeightM !== undefined ? ground.a[1] - p.initialHeightM * heightScale : 205;
    const body = addShape(diagram, shapes, "geometry", diagramKit.circle({ id: id + "-body", center: [300, bodyBottomY - bodyRadius], radius: bodyRadius, role: "body", strokeWidth: 2.5 }));
    const motion = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-motion-arrow", from: body.center, to: [300, Math.max(trajectory.a[1], body.center[1] - 96)], role: "motion", strokeWidth: 3, headLength: 12, headWidth: 10 }));
    const positive = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-positive-arrow", from: [112, 232], to: [112, 105], role: "axis", strokeWidth: 2.5, headLength: 11, headWidth: 9 }));
    let height;
    if (p.initialHeightM > 0) height = addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-height-measure", a: [350, ground.a[1]], b: [350, bodyBottomY], role: "measure", strokeWidth: 1.5 }));

    addLabel(diagram, shapes, { id: id + "-positive-label", at: [82, 102], text: "+y", anchorId: positive.id, fontSize: 15 });
    addLabel(diagram, shapes, { id: id + "-origin-label", at: [190, 304], text: p.initialHeightM === 0 ? "y₀ = 0 (marknivå)" : "y = 0 (marknivå)", anchorId: origin.id, fontSize: 13 });
    if (p.initialSpeedMps !== undefined) addLabel(diagram, shapes, { id: id + "-velocity-v0-label", at: [390, 78], text: "v₀ = " + clean(p.initialSpeedMps) + " m/s", anchorId: motion.id, textAnchor: "start", fontSize: 14 });
    if (p.laterVelocityMps !== undefined) addLabel(diagram, shapes, { id: id + "-velocity-later-label", at: [390, 112], text: "v = " + clean(p.laterVelocityMps) + " m/s efter " + clean(p.elapsedS) + " s", anchorId: motion.id, textAnchor: "start", fontSize: 13 });
    if (p.flightTimeS !== undefined) addLabel(diagram, shapes, { id: id + "-velocity-time-label", at: [390, 148], text: "t = " + clean(p.flightTimeS) + " s till marken", anchorId: motion.id, textAnchor: "start", fontSize: 13 });
    if (height) addLabel(diagram, shapes, { id: id + "-height-label", at: [402, 233], text: "y₀ = " + clean(p.initialHeightM) + " m", anchorId: height.id, textAnchor: "start", fontSize: 14 });
    const result = diagram.finish();
    return {
      html: result.html,
      manifest: result.manifest,
      layout: {
        sign: { x: 35, y: 82, width: 245, height: 230 },
        velocity: { x: 380, y: 56, width: 225, height: 108 },
        height: { x: 390, y: 210, width: 180, height: 42 }
      }
    };
  }

  function solution(family, p, exact, expected, unitLabel, figures) {
    let work;
    if (family === "time-to-apex") {
      work = "I vändläget är v = 0. Sambandet v = v₀ + at ger t = v₀/g = " + clean(p.initialSpeedMps) + "/9,82 = " + clean(exact) + " s.";
    } else if (family === "maximum-height") {
      work = "I vändläget är v = 0. Ur v² = v₀² + 2aΔy fås Δy = v₀²/(2g). Markhöjden blir yₘₐₓ = y₀ + Δy = " + clean(exact) + " m.";
    } else if (family === "initial-speed") {
      work = "Sambandet v = v₀ + at ger v₀ = v + gt = " + clean(p.laterVelocityMps) + " + 9,82·" + clean(p.elapsedS) + " = " + clean(exact) + " m/s.";
    } else if (family === "impact-speed") {
      const initialSpeed = (-p.initialHeightM + G * p.flightTimeS * p.flightTimeS / 2) / p.flightTimeS;
      const impactVelocity = initialSpeed - G * p.flightTimeS;
      work = "Till marken är förflyttningen Δy = −" + clean(p.initialHeightM) + " m. Ur Δy = v₀t − gt²/2 fås v₀ = " + clean(initialSpeed) + " m/s. Sedan ger v = v₀ − gt = " + clean(impactVelocity) + " m/s, alltså farten |v| = " + clean(exact) + " m/s.";
    } else {
      work = "Marken motsvarar Δy = −y₀. Ekvationen −y₀ = v₀t − gt²/2 har den positiva roten t = (v₀ + √(v₀² + 2gy₀))/g = " + clean(exact) + " s.";
    }
    return "<p><strong>Teckenval:</strong> Positiv riktning: uppåt. Då är a = −9,82 m/s² under hela rörelsen och marknivån används som y = 0.</p><p><strong>Insättning och samband:</strong> " + work + "</p><p>Efter avrundning till " + figures + " värdesiffror blir svaret <strong>" + formatSignificant(expected, figures) + " " + unitLabel + "</strong>.</p>";
  }

  function motionWorkOnPaper(family) {
    const method = family === "time-to-apex"
      ? "sätt v = 0 i högsta punkten och lös ut tiden"
      : family === "maximum-height"
        ? "sätt v = 0 i vändläget och lös ut den största höjden"
        : family === "initial-speed"
          ? "använd den uppåt positiva hastighetsekvationen och lös ut utgångshastigheten"
          : family === "impact-speed"
            ? "använd lägesekvationen med konsekventa tecken och välj fartens belopp före markträffen"
            : "ställ upp lägesekvationen till marknivån och välj den positiva, fysikaliskt giltiga flygtidsroten";
    return {
      title: "Arbeta i räknehäftet",
      instruction: "Arbeta i räknehäftet: välj uppåt som positiv riktning, använd a = −g och " + method + ". Validera tecken, enhet och att vald rot eller fart är fysikaliskt giltig. Endast slutsvaret skrivs in digitalt; teckenval och hela beräkningen görs i räknehäftet.",
      comparison: "Jämför positiv riktning, a = −g, rörelseekvation, rot-/beloppsval, fysikalisk kontroll, enhet och avrundning med lösningen."
    };
  }

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s3-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const info = FAMILY_INFO[family];
    const exact = answer(family, row.givens);
    const expected = roundSignificant(exact, figures);
    const figure = motionFigure(id, row, family);
    return {
      id: id,
      slot: 3,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + row.object.charAt(0).toUpperCase() + row.object.slice(1) + " kastas vertikalt. Givet är " + givensText(family, row.givens) + ". Luftmotståndet försummas och g = 9,82 m/s². " + info.question + "</p>" + figure.html + "<p><small>Figuren är schematisk och inte skalenlig; använd tecken och utskrivna värden, inte pilarnas längder.</small></p><p>Svara i " + info.unitLabel + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: "Svar (" + info.unitLabel + "; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: info.targetUnit, tolerance: tolerance(expected, figures), help: "Ange den positiva tid, höjd eller fart som efterfrågas." }],
      workOnPaper: motionWorkOnPaper(family),
      solutionHtml: solution(family, row.givens, exact, expected, info.unitLabel, figures),
      rubric: [
        { points: 1, text: "Positiv riktning definieras, a = −g används och rätt rörelseekvation ställs upp med konsekventa tecken." },
        { points: 1, text: "Insättning, val av fysikaliskt giltig rot/belopp, enhet och avrundat slutsvar är korrekta." }
      ],
      sourceData: {
        skill: SKILL,
        family: family,
        caseNumber: familyIndex * 5 + rowIndex + 1,
        g: G,
        givens: Object.assign({}, row.givens),
        significantFigures: figures,
        targetUnit: info.targetUnit,
        requestedUnitLabel: info.unitLabel,
        scenario: row.scenario,
        diagram: figure.manifest,
        diagramLayout: figure.layout
      }
    };
  }

  return FAMILY_ROWS.reduce(function (questions, entry, familyIndex) {
    return questions.concat(entry[1].map(function (row, rowIndex) { return makeQuestion(entry[0], row, familyIndex, rowIndex); }));
  }, []);
});
