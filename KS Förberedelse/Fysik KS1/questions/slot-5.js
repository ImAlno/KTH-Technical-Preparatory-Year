(function (root, factory) {
  const diagramKit = typeof module === "object" && module.exports
    ? require("../../assets/js/diagram-kit.js")
    : root && root.KS && root.KS.diagram;
  const bank = factory(diagramKit);
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[5] = bank;
  }
})(typeof window !== "undefined" ? window : null, function (diagramKit) {
  "use strict";

  if (!diagramKit || typeof diagramKit.create !== "function" || typeof diagramKit.validateManifest !== "function") {
    throw new Error("diagram-kit dependency is required before constructing physics slot 5");
  }

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

  function addShape(diagram, shapes, layer, shape) {
    shapes.push(shape);
    diagram.add(layer, shape);
    return shape;
  }

  function makeDiagram(id, title, description, purpose, width, height) {
    return diagramKit.create({ id: id, title: title, description: description, purpose: purpose, width: width, height: height });
  }

  function finishFigure(diagram, shapes, labelSpecs) {
    const labelZones = [];
    labelSpecs.forEach(function (spec) {
      const label = diagramKit.label({
        id: spec.id,
        at: spec.at,
        text: spec.text,
        anchorId: spec.anchorId,
        avoid: shapes.filter(function (shape) { return shape.id !== spec.anchorId; }).map(function (shape) { return shape.id; }),
        minClearance: 6,
        textAnchor: spec.textAnchor || "middle",
        fontSize: spec.fontSize || 14,
        background: true
      });
      diagram.add("labels", label);
      labelZones.push({ type: spec.type, bounds: spec.zone, labelIds: [label.id] });
    });
    const result = diagram.finish();
    return { html: result.html, manifest: result.manifest, labelZones: labelZones };
  }

  function angleLabelAt(arc, distance, fontSize) {
    const start = Math.atan2(arc.fromRay[1], arc.fromRay[0]);
    const end = Math.atan2(arc.toRay[1], arc.toRay[0]);
    let delta = end - start;
    if (arc.sweep === 1 && delta < 0) delta += Math.PI * 2;
    if (arc.sweep === -1 && delta > 0) delta -= Math.PI * 2;
    const angle = start + delta / 2;
    return [arc.vertex[0] + distance * Math.cos(angle), arc.vertex[1] + distance * Math.sin(angle) + fontSize * 0.375];
  }

  function situationFigure(id, family, row) {
    const p = row.givens;
    const description = family === "inclined-plane"
      ? "En kropp ligger med hela nederkanten mot ett lutande plan och rör sig nedför planet. Vinkel, massa och kinetisk friktionskraft är utskrivna."
      : family === "connected-masses"
        ? "En kropp vilar på ett bord och är kopplad med ett sammanhängande tangentrep över en ideal trissa till en hängande kropp. Rörelseriktningar, massor och kinetiskt friktionstal är utskrivna."
        : "En kropp ligger med hela nederkanten mot ett horisontellt underlag och rör sig åt höger. Endast givna rörelse- och kraftdata visas.";
    const diagram = makeDiagram(id + "-diagram", row.scenario + ": dynamiksituation", description + " Figuren är schematisk och inte skalenlig och visar inte den fullständiga kraftfiguren.", "prompt", family === "connected-masses" ? 700 : 660, family === "inclined-plane" ? 420 : family === "connected-masses" ? 440 : 390);
    const shapes = [];
    const labels = [];

    if (family === "inclined-plane") {
      const theta = radians(p.angleDeg);
      const vertex = [70, 320];
      const tangent = [Math.cos(theta), -Math.sin(theta)];
      const outward = [-Math.sin(theta), -Math.cos(theta)];
      const planeEnd = [vertex[0] + 530 * tangent[0], vertex[1] + 530 * tangent[1]];
      const supportStart = [vertex[0] + 500 * tangent[0], vertex[1] + 500 * tangent[1]];
      const plane = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-plane", a: vertex, b: planeEnd, role: "support", strokeWidth: 3 }));
      addShape(diagram, shapes, "geometry", diagramKit.polygon({ id: id + "-plane-support", points: [supportStart, planeEnd, [planeEnd[0], supportStart[1]]], role: "support", strokeWidth: 2 }));
      const body = addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-body", line: { a: vertex, b: planeEnd }, bottomCenter: [vertex[0] + 350 * tangent[0], vertex[1] + 350 * tangent[1]], width: 105, height: 65, outwardNormal: outward, role: "body", strokeWidth: 2.5 }));
      const horizontal = addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-horizontal-reference", a: vertex, b: [210, vertex[1]], role: "line", strokeWidth: 1.5 }));
      const angle = addShape(diagram, shapes, "information", diagramKit.angleArc({ id: id + "-incline-angle", vertex: vertex, fromRay: horizontal.b, toRay: plane.b, radius: 55, role: "angle", strokeWidth: 2 }));
      const motionFrom = body.topLeft;
      const motion = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-motion-arrow", from: motionFrom, to: [motionFrom[0] - 92 * tangent[0], motionFrom[1] - 92 * tangent[1]], role: "motion", strokeWidth: 2.5, headLength: 11, headWidth: 9 }));
      labels.push(
        { id: id + "-angle-label", at: angleLabelAt(angle, 214, 14), text: clean(p.angleDeg) + "°", anchorId: angle.id, fontSize: 14, type: "angle", zone: { x: 220, y: 230, width: 90, height: 95 } },
        { id: id + "-motion-label", at: [motion.to[0] + 10 * outward[0], motion.to[1] + 10 * outward[1]], text: "rörelse nedför", anchorId: motion.id, fontSize: 14, type: "motion", zone: { x: 125, y: 55, width: 250, height: 155 } },
        { id: id + "-mass-label", at: [vertex[0] + 300 * tangent[0] - 60 * outward[0], vertex[1] + 300 * tangent[1] - 60 * outward[1] + 5.25], text: "m = " + clean(p.massKg) + " kg", anchorId: body.id, type: "given", zone: { x: 300, y: 165, width: 125, height: 190 } },
        { id: id + "-friction-label", at: [vertex[0] + 410 * tangent[0] - 60 * outward[0], vertex[1] + 410 * tangent[1] - 60 * outward[1] + 5.25], text: "Fᶠ = " + clean(p.frictionForceN) + " N", anchorId: plane.id, type: "given", zone: { x: 390, y: 105, width: 165, height: 225 } }
      );
    } else if (family === "connected-masses") {
      const tabletop = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-tabletop", a: [65, 250], b: [520, 250], role: "support", strokeWidth: 4 }));
      const tableBody = addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-table-body", line: { a: tabletop.a, b: tabletop.b }, bottomCenter: [265, 250], width: 150, height: 126, outwardNormal: [0, -1], role: "table-body", strokeWidth: 2.5 }));
      const hangingBody = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-hanging-body", x: 528, y: 285, width: 80, height: 70, role: "hanging-body", strokeWidth: 2.5 }));
      const pulley = addShape(diagram, shapes, "connections", diagramKit.circle({ id: id + "-pulley", center: [520, 172], radius: 48, role: "pulley", strokeWidth: 3 }));
      addShape(diagram, shapes, "connections", diagramKit.ropeAroundCircle({ id: id + "-rope", from: tableBody.topRight, to: [568, hangingBody.y], pulley: { center: pulley.center, radius: pulley.radius }, side: "top", role: "rope", strokeWidth: 3 }));
      const tableMotion = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-table-motion-arrow", from: [tableBody.bottomRight[0], 205], to: [425, 205], role: "motion", strokeWidth: 2.5, headLength: 11, headWidth: 9 }));
      const hangingMotion = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-hanging-motion-arrow", from: [568, hangingBody.y + hangingBody.height], to: [568, 405], role: "motion", strokeWidth: 2.5, headLength: 11, headWidth: 9 }));
      labels.push(
        { id: id + "-table-motion-label", at: [390, 108], text: "rörelse åt höger", anchorId: tableMotion.id, fontSize: 14, type: "motion", zone: { x: 300, y: 75, width: 180, height: 45 } },
        { id: id + "-hanging-motion-label", at: [635, 425], text: "rörelse nedåt", anchorId: hangingMotion.id, fontSize: 14, type: "motion", zone: { x: 575, y: 395, width: 120, height: 42 } },
        { id: id + "-table-mass-label", at: [155, 330], text: "m₁ = " + clean(p.tableMassKg) + " kg", anchorId: tableBody.id, type: "given", zone: { x: 75, y: 300, width: 165, height: 45 } },
        { id: id + "-friction-label", at: [350, 330], text: "μₖ = " + clean(p.frictionCoefficient), anchorId: tabletop.id, type: "given", zone: { x: 285, y: 300, width: 135, height: 45 } },
        { id: id + "-hanging-mass-label", at: [635, 260], text: "m₂ = " + clean(p.hangingMassKg) + " kg", anchorId: hangingBody.id, type: "given", zone: { x: 585, y: 225, width: 110, height: 45 } }
      );
    } else {
      const ground = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-ground", a: [70, 260], b: [590, 260], role: "ground", strokeWidth: 4 }));
      const body = addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-body", line: { a: ground.a, b: ground.b }, bottomCenter: [300, 260], width: 150, height: 82, outwardNormal: [0, -1], role: "body", strokeWidth: 2.5 }));
      let primaryArrow;
      if (family === "horizontal-pull") {
        primaryArrow = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-applied-force", from: [body.bottomRight[0], 219], to: [525, 219], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
        labels.push({ id: id + "-applied-force-label", at: [500, 190], text: "F = " + clean(p.pullForceN) + " N", anchorId: primaryArrow.id, type: "given-force", zone: { x: 430, y: 155, width: 155, height: 48 } });
      } else if (family === "unknown-pull") {
        primaryArrow = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-motion-arrow", from: [body.bottomRight[0], 219], to: [525, 219], role: "motion", strokeWidth: 2.5, headLength: 11, headWidth: 9 }));
        labels.push({ id: id + "-motion-label", at: [485, 190], text: "a = " + clean(p.accelerationMps2) + " m/s²", anchorId: primaryArrow.id, type: "motion", zone: { x: 400, y: 155, width: 180, height: 48 } });
      } else {
        primaryArrow = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-drive-force", from: [body.bottomRight[0], 219], to: [525, 219], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
        const motion = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-motion-arrow", from: [300, body.topLeft[1]], to: [430, body.topLeft[1]], role: "motion", strokeWidth: 2.5, headLength: 11, headWidth: 9 }));
        labels.push(
          { id: id + "-drive-force-label", at: [505, 190], text: "Fᴅ = " + clean(p.driveForceN) + " N", anchorId: primaryArrow.id, type: "given-force", zone: { x: 435, y: 155, width: 150, height: 48 } },
          { id: id + "-motion-label", at: [350, 145], text: "0 → " + clean(p.finalSpeedMps) + " m/s på " + clean(p.elapsedS) + " s", anchorId: motion.id, fontSize: 14, type: "motion", zone: { x: 245, y: 110, width: 220, height: 48 } }
        );
      }
      labels.push(
        { id: id + "-mass-label", at: [150, 340], text: "m = " + clean(p.massKg) + " kg", anchorId: body.id, type: "given", zone: { x: 65, y: 310, width: 175, height: 45 } },
        { id: id + "-friction-data-label", at: [455, 340], text: family === "unknown-friction" ? "friktionen söks" : "μₖ = " + clean(p.frictionCoefficient), anchorId: ground.id, type: "given", zone: { x: 365, y: 310, width: 185, height: 45 } }
      );
    }
    return finishFigure(diagram, shapes, labels);
  }

  function solutionFigure(id, family, row) {
    const p = row.givens;
    const diagram = makeDiagram(id + "-solution-diagram", row.scenario + ": fullständig kraftfigur", "Fullständig friläggning med alla krafter, angreppspunkter och riktningar som används i Newtons andra lag. Pillängderna kodar inte kraftstorlek.", "solution", 700, 440);
    const shapes = [];
    const labels = [];
    function force(arrowId, from, to) {
      return addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-" + arrowId, from: from, to: to, role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
    }
    function forceLabel(labelId, at, text, owner, zone) {
      labels.push({ id: id + "-" + labelId, at: at, text: text, anchorId: owner.id, type: "force", zone: zone });
    }

    if (family === "connected-masses") {
      const tableBody = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-isolated-table-body", x: 180, y: 185, width: 100, height: 70, role: "body", strokeWidth: 2.5 }));
      const hangingBody = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-isolated-hanging-body", x: 470, y: 185, width: 100, height: 70, role: "body", strokeWidth: 2.5 }));
      const tableCenter = [230, 220];
      const hangingCenter = [520, 220];
      const tableNormal = force("table-force-normal", tableCenter, [230, 65]);
      const tableWeight = force("table-force-weight", tableCenter, [230, 390]);
      const tableTension = force("table-force-tension", tableCenter, [405, 220]);
      const tableFriction = force("table-force-friction", tableCenter, [65, 220]);
      const hangingTension = force("hanging-force-tension", hangingCenter, [520, 65]);
      const hangingWeight = force("hanging-force-weight", hangingCenter, [520, 390]);
      forceLabel("table-force-normal-label", [255, 70], "N", tableNormal, { x: 240, y: 45, width: 45, height: 35 });
      forceLabel("table-force-weight-label", [255, 400], "m₁g", tableWeight, { x: 235, y: 375, width: 55, height: 40 });
      forceLabel("table-force-tension-label", [420, 205], "T", tableTension, { x: 405, y: 180, width: 45, height: 35 });
      forceLabel("table-force-friction-label", [50, 205], "Fᶠ", tableFriction, { x: 30, y: 180, width: 45, height: 35 });
      forceLabel("hanging-force-tension-label", [545, 70], "T", hangingTension, { x: 530, y: 45, width: 45, height: 35 });
      forceLabel("hanging-force-weight-label", [545, 400], "m₂g", hangingWeight, { x: 525, y: 375, width: 55, height: 40 });
      void tableBody; void hangingBody;
    } else if (family === "inclined-plane") {
      const theta = radians(p.angleDeg);
      const tangent = [Math.cos(theta), -Math.sin(theta)];
      const outward = [-Math.sin(theta), -Math.cos(theta)];
      const line = { a: [160, 320], b: [160 + 430 * tangent[0], 320 + 430 * tangent[1]] };
      const body = addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-isolated-body", line: line, bottomCenter: [160 + 180 * tangent[0], 320 + 180 * tangent[1]], width: 110, height: 70, outwardNormal: outward, role: "body", strokeWidth: 2.5 }));
      const center = body.center;
      const weight = force("force-weight", center, [center[0], center[1] + 140]);
      const normal = force("force-normal", center, [center[0] + 125 * outward[0], center[1] + 125 * outward[1]]);
      const friction = force("force-friction", center, [center[0] + 145 * tangent[0], center[1] + 145 * tangent[1]]);
      forceLabel("force-weight-label", [weight.to[0] + 30, weight.to[1] + 5], "mg", weight, { x: 285, y: 310, width: 100, height: 95 });
      forceLabel("force-normal-label", [normal.to[0] - 20, normal.to[1] - 8], "N", normal, { x: 175, y: 35, width: 130, height: 115 });
      forceLabel("force-friction-label", [friction.to[0] + 25, friction.to[1] - 8], "Fᶠ", friction, { x: 390, y: 70, width: 155, height: 170 });
    } else {
      const body = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-isolated-body", x: 280, y: 180, width: 120, height: 80, role: "body", strokeWidth: 2.5 }));
      const center = [340, 220];
      const normal = force("force-normal", center, [340, 60]);
      const weight = force("force-weight", center, [340, 385]);
      const applied = force("force-applied", center, [565, 220]);
      const friction = force("force-friction", center, [105, 220]);
      const appliedText = family === "unknown-friction" ? "Fᴅ" : "F";
      forceLabel("force-normal-label", [365, 65], "N", normal, { x: 350, y: 40, width: 45, height: 35 });
      forceLabel("force-weight-label", [370, 395], "mg", weight, { x: 350, y: 370, width: 55, height: 40 });
      forceLabel("force-applied-label", [590, 200], appliedText, applied, { x: 570, y: 175, width: 55, height: 40 });
      forceLabel("force-friction-label", [75, 200], "Fᶠ", friction, { x: 50, y: 175, width: 55, height: 40 });
      void body;
    }
    return finishFigure(diagram, shapes, labels);
  }

  function promptText(family, row) {
    const p = row.givens;
    if (family === "horizontal-pull") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg dras åt höger av den horisontella kraften " + clean(p.pullForceN) + " N. Det kinetiska friktionstalet är " + clean(p.frictionCoefficient) + ". Bestäm accelerationen.";
    if (family === "inclined-plane") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " med massan " + clean(p.massKg) + " kg glider nedför ett plan som lutar " + clean(p.angleDeg) + "°. Den kinetiska friktionskraften är " + clean(p.frictionForceN) + " N uppför planet. Bestäm accelerationen nedför planet.";
    if (family === "connected-masses") return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " är kopplade med en masslös tråd över en ideal trissa. Kroppen på bordet har massan " + clean(p.tableMassKg) + " kg, och det kinetiska friktionstalet mellan kroppen och bordet är " + clean(p.frictionCoefficient) + "; den hängande kroppen har massan " + clean(p.hangingMassKg) + " kg. Den hängande kroppen börjar röra sig nedåt och bordskroppen börjar samtidigt glida åt höger. Bestäm accelerationens storlek.";
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
      diagram = "Frilägg båda kropparna sedan rörelsen har börjat: bordskroppen har T åt höger och kinetisk friktion Fᶠ åt vänster; den hängande kroppen har m₂g nedåt och T uppåt.";
      equation = "Den kinetiska friktionen är Fᶠ = μₖm₁g. Adderade kraftekvationer ger m₂g − μₖm₁g = (m₁ + m₂)a. Därför a = (m₂ − μₖm₁)g/(m₁ + m₂) = " + clean(exact) + " m/s².";
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
    if (family === "connected-masses") return "Två separata kraftfigurer visar tyngd/spännkraft för den hängande kroppen samt N, mg, T och kinetisk friktion för den glidande bordskroppen.";
    return "Kraftfiguren visar mg nedåt, N uppåt samt driv-/dragkraft och kinetisk friktion i motsatta horisontella riktningar.";
  }

  function dynamicsWorkOnPaper(family) {
    const method = family === "inclined-plane"
      ? "rita en kraftfigur på planet, välj positiv riktning nedför och dela tyngdkraften i komponenter"
      : family === "connected-masses"
        ? "rita separata friläggningar för båda kropparna, med spännkraft och kinetisk friktion i rätt riktningar"
        : "frilägg kroppen med tyngdkraft, normalkraft, driv-/dragkraft och kinetisk friktion";
    return {
      title: "Arbeta i räknehäftet",
      instruction: "Arbeta i räknehäftet: " + method + ". Ställ upp Newtons andra lag längs vald riktning och kontrollera normalkraft, friktion och tecken. Endast slutsvaret skrivs in digitalt; fullständig kraftfigur och beräkning görs i räknehäftet.",
      comparison: "Jämför friläggning(ar), kraftpilar och riktningar, komponenter eller friktionsmodell, Newtons lag, fysikalisk kontroll, enhet och avrundning med lösningen."
    };
  }

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s5-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const info = FAMILY_INFO[family];
    const exact = derived(family, row.givens);
    const expected = roundSignificant(exact, figures);
    const normal = normalForce(family, row.givens);
    const friction = frictionForce(family, row.givens);
    const promptFigure = situationFigure(id, family, row);
    const answerFigure = solutionFigure(id, family, row);
    if (!(normal > 0) || !(friction > 0) || !(exact > 0)) throw new Error("Ogiltig fysikparameter i " + row.scenario);
    return {
      id: id,
      slot: 5,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + promptText(family, row) + " Använd g = 9,82 m/s² och försumma övriga motstånd.</p>" + promptFigure.html + "<p><small>Figuren är schematisk och inte skalenlig; använd endast utskrivna data.</small></p><p>Rita kraftfigur(er). Svara i " + info.unitLabel + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: "Svar (" + info.unitLabel + "; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: info.targetUnit, tolerance: tolerance(expected, figures), help: "Ange den efterfrågade accelerationens eller kraftens storlek." }],
      workOnPaper: dynamicsWorkOnPaper(family),
      solutionHtml: solution(family, row.givens, exact, expected, figures, info.unitLabel) + answerFigure.html,
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
        startsMoving: family === "connected-masses" ? true : undefined,
        frictionCoefficientType: family === "connected-masses" ? "kinetic" : undefined,
        motionDirection: family === "inclined-plane" ? "down-slope" : family === "connected-masses" ? "hanging-mass-down" : "right",
        significantFigures: figures,
        targetUnit: info.targetUnit,
        requestedUnitLabel: info.unitLabel,
        scenario: row.scenario,
        diagram: promptFigure.manifest,
        solutionDiagram: answerFigure.manifest,
        diagramLabelZones: promptFigure.labelZones,
        solutionLabelZones: answerFigure.labelZones
      }
    };
  }

  return FAMILY_ROWS.reduce(function (questions, entry, familyIndex) {
    return questions.concat(entry[1].map(function (row, rowIndex) { return makeQuestion(entry[0], row, familyIndex, rowIndex); }));
  }, []);
});
