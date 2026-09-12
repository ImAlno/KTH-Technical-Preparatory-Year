(function (root, factory) {
  const diagramKit = typeof module === "object" && module.exports
    ? require("../../assets/js/diagram-kit.js")
    : root && root.KS && root.KS.diagram;
  const bank = factory(diagramKit);
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[4] = bank;
  }
})(typeof window !== "undefined" ? window : null, function (diagramKit) {
  "use strict";

  if (!diagramKit || typeof diagramKit.create !== "function" || typeof diagramKit.validateManifest !== "function") {
    throw new Error("diagram-kit dependency is required before constructing physics slot 4");
  }

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

  function makeDiagram(id, title, description, purpose, width, height) {
    return diagramKit.create({ id: id, title: title, description: description, purpose: purpose, width: width, height: height });
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

  function situationFigure(id, family, row) {
    const p = row.givens;
    const desc = family === "hanging-masses"
      ? "Två kroppar hänger under varandra i två masslösa linor och är i vila. Övre och undre massan är utskrivna."
      : family === "cables-at-angles"
        ? "En kropp hänger symmetriskt i två lika linor. Varje lina bildar den utskrivna vinkeln med horisontalen."
        : family === "missing-fourth-force"
          ? "Tre kända krafter visas med sina x- och y-komposanter. Pilarna visar endast riktning och har avsiktligt samma längd."
          : family === "supported-beams"
            ? "En horisontell styv kropp vilar på två stöd. Kroppens massa och den vänstra stödreaktionen är utskrivna."
            : "En sfärisk kropp ligger mot en friktionsfri lodrät vägg och hålls av en lina med utskriven vinkel över horisontalen.";
    const diagram = makeDiagram(id + "-diagram", row.scenario + ": kraftsituation", desc + " Figuren är schematisk, inte skalenlig och visar inte den fullständiga kraftfiguren.", "prompt", 660, 400);
    const shapes = [];
    const labelZones = [];
    function label(options, type, zone) {
      const item = addLabel(diagram, shapes, options);
      labelZones.push({ type: type, bounds: zone, labelIds: [item.id] });
      return item;
    }
    if (family === "hanging-masses") {
      const ceiling = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-ceiling", a: [220, 30], b: [440, 30], role: "support", strokeWidth: 4 }));
      const upper = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-upper-body", x: 285, y: 90, width: 90, height: 55, role: "body", strokeWidth: 2.5 }));
      const lower = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-lower-body", x: 285, y: 205, width: 90, height: 55, role: "body", strokeWidth: 2.5 }));
      addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-upper-rope", a: [330, 30], b: [330, upper.y], role: "rope", strokeWidth: 3 }));
      addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-lower-rope", a: [330, upper.y + upper.height], b: [330, lower.y], role: "rope", strokeWidth: 3 }));
      label({ id: id + "-upper-mass-label", at: [435, 122], text: "m₁ = " + clean(p.upperMassKg) + " kg", anchorId: upper.id, textAnchor: "start" }, "given", { x: 425, y: 100, width: 190, height: 38 });
      label({ id: id + "-lower-mass-label", at: [435, 237], text: "m₂ = " + clean(p.lowerMassKg) + " kg", anchorId: lower.id, textAnchor: "start" }, "given", { x: 425, y: 215, width: 190, height: 38 });
    } else if (family === "cables-at-angles") {
      const body = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-body", x: 280, y: 300, width: 100, height: 55, role: "body", strokeWidth: 2.5 }));
      const rise = 160 * Math.tan(radians(p.angleDeg));
      const leftAnchor = [120, body.y - rise];
      const rightAnchor = [540, body.y - rise];
      addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-ceiling", a: [70, leftAnchor[1]], b: [590, leftAnchor[1]], role: "support", strokeWidth: 4 }));
      const leftCable = addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-left-cable", a: leftAnchor, b: [body.x, body.y], role: "rope", strokeWidth: 3 }));
      addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-right-cable", a: rightAnchor, b: [body.x + body.width, body.y], role: "rope", strokeWidth: 3 }));
      addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-horizontal-reference", a: [body.x - 90, body.y], b: [body.x, body.y], role: "line", strokeWidth: 1.5 }));
      const angle = addShape(diagram, shapes, "information", diagramKit.angleArc({ id: id + "-cable-angle", vertex: [body.x, body.y], fromRay: [body.x - 60, body.y], toRay: leftAnchor, radius: 45, role: "angle", strokeWidth: 2 }));
      label({ id: id + "-angle-label", at: [210, 336], text: "α = " + clean(p.angleDeg) + "°", anchorId: angle.id }, "angle", { x: 170, y: 315, width: 105, height: 42 });
      label({ id: id + "-mass-label", at: [470, 335], text: "m = " + clean(p.massKg) + " kg", anchorId: body.id, textAnchor: "start" }, "given", { x: 460, y: 310, width: 150, height: 40 });
    } else if (family === "missing-fourth-force") {
      addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-x-axis", a: [80, 190], b: [580, 190], role: "axis", strokeWidth: 1.5 }));
      addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-y-axis", a: [330, 45], b: [330, 330], role: "axis", strokeWidth: 1.5 }));
      const node = addShape(diagram, shapes, "geometry", diagramKit.circle({ id: id + "-node", center: [330, 190], radius: 9, role: "point", strokeWidth: 2 }));
      const vectors = p.forces.map(function (force, index) {
        const magnitude = Math.hypot(force.xN, force.yN);
        return addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-given-vector-" + (index + 1), from: node.center, to: [node.center[0] + 82 * force.xN / magnitude, node.center[1] - 82 * force.yN / magnitude], role: "arrow", strokeWidth: 3, headLength: 11, headWidth: 9 }));
      });
      p.forces.forEach(function (force, index) {
        const vector = vectors[index];
        label({ id: id + "-given-vector-" + (index + 1) + "-label", at: [455, 78 + index * 42], text: "F" + (index + 1) + " = (" + force.xN + ", " + force.yN + ") N", anchorId: vector.id, textAnchor: "start", fontSize: 13 }, "given-vector", { x: 445, y: 58 + index * 42, width: 185, height: 32 });
      });
    } else if (family === "supported-beams") {
      const baseline = { a: [90, 220], b: [570, 220] };
      const body = addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-body", line: baseline, bottomCenter: [330, 220], width: 400, height: 60, outwardNormal: [0, -1], role: "body", strokeWidth: 2.5 }));
      const leftContact = [190, 220]; const rightContact = [470, 220];
      addShape(diagram, shapes, "connections", diagramKit.polygon({ id: id + "-left-support", points: [leftContact, [158, 270], [222, 270]], role: "support", strokeWidth: 2 }));
      addShape(diagram, shapes, "connections", diagramKit.polygon({ id: id + "-right-support", points: [rightContact, [438, 270], [502, 270]], role: "support", strokeWidth: 2 }));
      const force = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-given-support-force", from: leftContact, to: [190, 70], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      label({ id: id + "-given-support-force-label", at: [230, 72], text: "F₁ = " + clean(p.knownSupportN) + " N", anchorId: force.id, textAnchor: "start" }, "given-force", { x: 220, y: 50, width: 160, height: 34 });
      label({ id: id + "-mass-label", at: [470, 135], text: "m = " + clean(p.massKg) + " kg", anchorId: body.id, textAnchor: "start" }, "given", { x: 460, y: 112, width: 150, height: 35 });
    } else {
      const wallX = 500;
      const centerX = 420;
      const centerY = 220;
      const radius = 80;
      const angle = radians(p.cableAngleDeg);
      const attachmentX = centerX + radius * Math.cos(angle);
      const attachmentY = centerY - radius * Math.sin(angle);
      const anchorY = centerY - (wallX - centerX) * Math.tan(angle);
      const wall = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-wall", a: [wallX, 35], b: [wallX, 340], role: "wall", strokeWidth: 5 }));
      const sphere = addShape(diagram, shapes, "geometry", diagramKit.circle({ id: id + "-sphere", center: [centerX, centerY], radius: radius, role: "circle", strokeWidth: 2.5 }));
      const cable = addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-cable", a: [attachmentX, attachmentY], b: [wallX, anchorY], role: "rope", strokeWidth: 3 }));
      addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-horizontal-reference", a: sphere.center, b: [wallX, centerY], role: "line", strokeWidth: 1.5 }));
      const arc = addShape(diagram, shapes, "information", diagramKit.angleArc({ id: id + "-cable-angle", vertex: sphere.center, fromRay: [wallX, centerY], toRay: [wallX, anchorY], radius: 42, role: "angle", strokeWidth: 2 }));
      label({ id: id + "-angle-label", at: [335, 125], text: "α = " + clean(p.cableAngleDeg) + "°", anchorId: arc.id, fontSize: 13 }, "angle", { x: 300, y: 105, width: 75, height: 38 });
      label({ id: id + "-mass-label", at: [245, 332], text: "m = " + clean(p.massKg) + " kg", anchorId: sphere.id, textAnchor: "start" }, "given", { x: 235, y: 310, width: 150, height: 36 });
    }
    const result = diagram.finish();
    return { html: result.html, manifest: result.manifest, labelZones: labelZones, description: desc };
  }

  function solutionFigure(id, family, row) {
    const p = row.givens;
    const diagram = makeDiagram(id + "-solution-diagram", row.scenario + ": fullständig kraftfigur", "Fullständig friläggning med alla krafter, angreppspunkter och riktningar som används i lösningens jämviktsekvationer.", "solution", 660, 420);
    const shapes = [];
    const labelZones = [];
    function label(options, type, zone) {
      const item = addLabel(diagram, shapes, options);
      labelZones.push({ type: type, bounds: zone, labelIds: [item.id] });
      return item;
    }
    if (family === "hanging-masses") {
      const body = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-isolated-system", x: 235, y: 150, width: 190, height: 90, role: "body", strokeWidth: 2.5 }));
      const upperX = 275; const lowerX = 385;
      const tensionX = (p.upperMassKg * upperX + p.lowerMassKg * lowerX) / (p.upperMassKg + p.lowerMassKg);
      const tension = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-tension", from: [tensionX, 195], to: [tensionX, 55], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const upperWeight = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-upper-weight", from: [upperX, 195], to: [upperX, 355], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const lowerWeight = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-lower-weight", from: [lowerX, 195], to: [lowerX, 355], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      label({ id: id + "-force-tension-label", at: [tensionX + 38, 58], text: "T", anchorId: tension.id }, "force", { x: tensionX + 20, y: 40, width: 38, height: 30 });
      label({ id: id + "-force-upper-weight-label", at: [upperX - 42, 362], text: "m₁g", anchorId: upperWeight.id }, "force", { x: upperX - 65, y: 344, width: 46, height: 30 });
      label({ id: id + "-force-lower-weight-label", at: [lowerX + 44, 362], text: "m₂g", anchorId: lowerWeight.id }, "force", { x: lowerX + 20, y: 344, width: 48, height: 30 });
    } else if (family === "cables-at-angles") {
      const body = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-isolated-body", x: 280, y: 190, width: 100, height: 60, role: "body", strokeWidth: 2.5 }));
      const angle = radians(p.angleDeg);
      const leftTo = [body.x - 120 * Math.cos(angle), body.y - 120 * Math.sin(angle)];
      const rightTo = [body.x + body.width + 120 * Math.cos(angle), body.y - 120 * Math.sin(angle)];
      const left = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-left-tension", from: [body.x, body.y], to: leftTo, role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const right = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-right-tension", from: [body.x + body.width, body.y], to: rightTo, role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const weight = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-weight", from: [330, 220], to: [330, 365], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      label({ id: id + "-force-left-tension-label", at: [leftTo[0] - 28, leftTo[1] - 4], text: "T", anchorId: left.id }, "force", { x: 110, y: 40, width: 105, height: 95 });
      label({ id: id + "-force-right-tension-label", at: [rightTo[0] + 28, rightTo[1] - 4], text: "T", anchorId: right.id }, "force", { x: 445, y: 40, width: 105, height: 95 });
      label({ id: id + "-force-weight-label", at: [375, 370], text: "mg", anchorId: weight.id }, "force", { x: 355, y: 350, width: 50, height: 32 });
    } else if (family === "missing-fourth-force") {
      const node = addShape(diagram, shapes, "geometry", diagramKit.circle({ id: id + "-isolated-node", center: [330, 205], radius: 10, role: "point", strokeWidth: 2.5 }));
      const sum = p.forces.reduce(function (value, force) { return [value[0] + force.xN, value[1] + force.yN]; }, [0, 0]);
      const complete = p.forces.concat([{ xN: -sum[0], yN: -sum[1] }]);
      const arrows = complete.map(function (force, index) {
        const magnitude = Math.hypot(force.xN, force.yN);
        const end = [node.center[0] + 118 * force.xN / magnitude, node.center[1] - 118 * force.yN / magnitude];
        return { force: force, end: end, arrow: addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-" + (index + 1), from: node.center, to: end, role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 })) };
      });
      arrows.forEach(function (item, index) {
        const force = item.force; const end = item.end; const arrow = item.arrow;
        const offsetX = force.xN >= 0 ? 25 : -25;
        label({ id: id + "-force-" + (index + 1) + "-label", at: [end[0] + offsetX, end[1] + (force.yN >= 0 ? -8 : 18)], text: "F" + ["₁", "₂", "₃", "₄"][index], anchorId: arrow.id }, "force", { x: Math.max(20, end[0] + offsetX - 30), y: Math.max(20, end[1] - 28), width: 60, height: 60 });
      });
    } else if (family === "supported-beams") {
      const baseline = { a: [100, 240], b: [560, 240] };
      addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-isolated-body", line: baseline, bottomCenter: [330, 240], width: 360, height: 60, outwardNormal: [0, -1], role: "body", strokeWidth: 2.5 }));
      const leftX = 190; const rightX = 470;
      const weight = p.massKg * G;
      const rightForce = weight - p.knownSupportN;
      const weightX = (p.knownSupportN * leftX + rightForce * rightX) / weight;
      const left = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-support-left", from: [leftX, 240], to: [leftX, 65], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const right = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-support-right", from: [rightX, 240], to: [rightX, 65], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const gravity = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-weight", from: [weightX, 210], to: [weightX, 370], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      label({ id: id + "-force-support-left-label", at: [150, 67], text: "F₁", anchorId: left.id }, "force", { x: 125, y: 48, width: 50, height: 30 });
      label({ id: id + "-force-support-right-label", at: [510, 67], text: "F₂", anchorId: right.id }, "force", { x: 485, y: 48, width: 50, height: 30 });
      label({ id: id + "-force-weight-label", at: [weightX + 46, 374], text: "mg", anchorId: gravity.id }, "force", { x: weightX + 25, y: 354, width: 50, height: 32 });
    } else {
      const sphere = addShape(diagram, shapes, "geometry", diagramKit.circle({ id: id + "-isolated-sphere", center: [330, 210], radius: 62, role: "circle", strokeWidth: 2.5 }));
      const angle = radians(p.cableAngleDeg);
      const tensionTo = [sphere.center[0] + 145 * Math.cos(angle), sphere.center[1] - 145 * Math.sin(angle)];
      const tension = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-tension", from: sphere.center, to: tensionTo, role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const normal = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-normal", from: sphere.center, to: [155, 210], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      const gravity = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-weight", from: sphere.center, to: [330, 375], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      label({ id: id + "-force-tension-label", at: [tensionTo[0] + 28, tensionTo[1] - 5], text: "T", anchorId: tension.id }, "force", { x: 400, y: 45, width: 125, height: 85 });
      label({ id: id + "-force-normal-label", at: [132, 215], text: "N", anchorId: normal.id }, "force", { x: 112, y: 195, width: 42, height: 32 });
      label({ id: id + "-force-weight-label", at: [372, 380], text: "mg", anchorId: gravity.id }, "force", { x: 350, y: 360, width: 48, height: 32 });
    }
    const result = diagram.finish();
    return { html: result.html, manifest: result.manifest, labelZones: labelZones };
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

  function equilibriumWorkOnPaper(family) {
    const method = family === "hanging-masses"
      ? "frilägg det valda systemet med tyngdkrafter och spännkraft"
      : family === "cables-at-angles"
        ? "rita tyngdkraften och de två spännkrafterna längs linorna, och dela upp dem i komponenter"
        : family === "missing-fourth-force"
          ? "rita kraftvektorerna med komponentaxlar och låt den fjärde kraften balansera resultanten"
          : family === "supported-beams"
            ? "frilägg balken med tyngdkraften och de två separata stödreaktionerna"
            : "frilägg kroppen med tyngdkraft, väggens normalkraft och spännkraften längs linan";
    return {
      title: "Arbeta i räknehäftet",
      instruction: "Arbeta i räknehäftet: " + method + ". Ange riktningar, välj axlar och ställ upp jämvikt komponentvis innan du räknar. Endast slutsvaret skrivs in digitalt; fullständig kraftfigur och beräkning görs i räknehäftet.",
      comparison: "Jämför frilagd kropp/system, alla kraftpilar och riktningar, komponenter, jämviktsvillkor, enhet och avrundning med lösningen."
    };
  }

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s4-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const exact = answer(family, row.givens);
    const expected = roundSignificant(exact, figures);
    const promptFigure = situationFigure(id, family, row);
    const answerFigure = solutionFigure(id, family, row);
    return {
      id: id,
      slot: 4,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + promptText(family, row) + " Använd g = 9,82 m/s².</p>" + promptFigure.html + "<p><small>Figuren är schematisk och inte skalenlig; varken pillängd eller avstånd får mätas.</small></p><p>Rita en fullständig kraftfigur. Svara i N. Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: "Svar (N; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: "N", tolerance: tolerance(expected, figures), help: "Ange den efterfrågade kraftens storlek." }],
      workOnPaper: equilibriumWorkOnPaper(family),
      solutionHtml: solution(family, row.givens, exact, expected, figures) + answerFigure.html,
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
