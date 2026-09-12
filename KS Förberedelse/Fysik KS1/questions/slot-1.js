(function (root, factory) {
  const diagramKit = typeof module === "object" && module.exports
    ? require("../../assets/js/diagram-kit.js")
    : root && root.KS && root.KS.diagram;
  const bank = factory(diagramKit);
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[1] = bank;
  }
})(typeof window !== "undefined" ? window : null, function (diagramKit) {
  "use strict";

  if (!diagramKit || typeof diagramKit.create !== "function" || typeof diagramKit.validateManifest !== "function") {
    throw new Error("diagram-kit dependency is required before constructing physics slot 1");
  }

  const G = 9.82;
  const SKILL = "graphs-and-contact-equilibrium";

  const GRAPH_ROWS = [
    { graphType: "s-t", graphTask: "slope", scenario: "Leveransroboten Nilo", points: [{ t: 0, y: 0 }, { t: 4, y: 12 }, { t: 8, y: 16 }], segmentIndex: 0, axis: { xMax: 8, yMax: 16, xStep: 2, yStep: 4 }, prompt: "Bestäm robotens hastighet under grafens första räta del." },
    { graphType: "s-t", graphTask: "slope", scenario: "Mätvagnen Prisma", points: [{ t: 0, y: 2 }, { t: 3, y: 8 }, { t: 7, y: 8 }, { t: 10, y: 2 }], segmentIndex: 2, axis: { xMax: 10, yMax: 10, xStep: 2, yStep: 2 }, prompt: "Bestäm vagnens hastighet under den sista räta delen. Tecknet ska visa riktningen." },
    { graphType: "s-t", graphTask: "slope", scenario: "Scenliften Korall", points: [{ t: 0, y: 0 }, { t: 2, y: 4 }, { t: 5, y: 19 }, { t: 8, y: 22 }], segmentIndex: 1, axis: { xMax: 8, yMax: 24, xStep: 2, yStep: 4 }, prompt: "Bestäm liftens hastighet mellan t = 2 s och t = 5 s." },
    { graphType: "s-t", graphTask: "average-speed", scenario: "Inspektionsdrönaren Vega", points: [{ t: 0, y: 0 }, { t: 3, y: 9 }, { t: 6, y: 3 }, { t: 9, y: 12 }], axis: { xMax: 9, yMax: 12, xStep: 3, yStep: 3 }, prompt: "Bestäm drönarens medelfart under hela den redovisade tiden. Räkna med all tillryggalagd sträcka." },
    { graphType: "s-t", graphTask: "average-speed", scenario: "Kulissen Mossa", points: [{ t: 0, y: 5 }, { t: 2, y: 1 }, { t: 5, y: 10 }, { t: 10, y: 0 }], axis: { xMax: 10, yMax: 10, xStep: 2, yStep: 2 }, prompt: "Bestäm kulissens medelfart under intervallet 0–10 s. Räkna även rörelse tillbaka mot origo." },
    { graphType: "v-t", graphTask: "distance", scenario: "Sorteringsbandet Flinta", points: [{ t: 0, y: 0 }, { t: 2, y: 6 }, { t: 5, y: 6 }, { t: 8, y: 0 }], axis: { xMax: 8, yMax: 8, xStep: 2, yStep: 2 }, prompt: "Bestäm hur långt ett paket förflyttas under de åtta sekunderna genom att använda arean under grafen." },
    { graphType: "v-t", graphTask: "distance", scenario: "Testsläden Opal", points: [{ t: 0, y: 4 }, { t: 3, y: 10 }, { t: 7, y: 10 }, { t: 10, y: 4 }], axis: { xMax: 10, yMax: 12, xStep: 2, yStep: 2 }, prompt: "Bestäm slädens sträcka under hela mätningen från arean under v-t-grafen." },
    { graphType: "v-t", graphTask: "distance", scenario: "Arkivroboten Svala", points: [{ t: 0, y: 0 }, { t: 1, y: 8 }, { t: 4, y: 4 }, { t: 6, y: 0 }], axis: { xMax: 6, yMax: 8, xStep: 1, yStep: 2 }, prompt: "Bestäm robotens totala sträcka under de sex sekunder som grafen visar." },
    { graphType: "v-t", graphTask: "acceleration", scenario: "Provkapseln Lumen", points: [{ t: 0, y: 2 }, { t: 3, y: 8 }, { t: 6, y: 8 }], segmentIndex: 0, axis: { xMax: 6, yMax: 8, xStep: 1, yStep: 2 }, prompt: "Bestäm kapselns acceleration under tidsintervallet 0–3 s." },
    { graphType: "v-t", graphTask: "acceleration", scenario: "Servicevagnen Tindra", points: [{ t: 0, y: 12 }, { t: 4, y: 4 }, { t: 7, y: 4 }], segmentIndex: 0, axis: { xMax: 8, yMax: 12, xStep: 2, yStep: 2 }, prompt: "Bestäm vagnens acceleration under de första fyra sekunderna. Ange rätt tecken." }
  ];

  const CONTACT_ROWS = [
    { contactType: "floor-pull", scenario: "Keramiklådan Arkipel", object: "en låda med keramiska provbitar", massKg: 4.6, appliedForceN: 13 },
    { contactType: "floor-pull", scenario: "Batterikassetten Mynta", object: "en batterikassett", massKg: 2.8, appliedForceN: 9.5 },
    { contactType: "floor-pull", scenario: "Verktygsvagnen Dagg", object: "en låg verktygsvagn", massKg: 18, appliedForceN: 46 },
    { contactType: "floor-pull", scenario: "Instrumentfodralet Nova", object: "ett instrumentfodral", massKg: 7.3, appliedForceN: 21 },
    { contactType: "floor-pull", scenario: "Reservdelen Iris", object: "en reservdel i sin hållare", massKg: 1.9, appliedForceN: 6.2 },
    { contactType: "floor-push", scenario: "Pressplattan Atlas", object: "en pressplatta", massKg: 3.4, appliedForceN: 17 },
    { contactType: "floor-push", scenario: "Provburken Eko", object: "en sluten provburk", massKg: 0.86, appliedForceN: 4.1 },
    { contactType: "floor-push", scenario: "Transportpallen Juni", object: "en transportpall", massKg: 24, appliedForceN: 68 },
    { contactType: "floor-push", scenario: "Optiklådan Kisel", object: "en låda med optik", massKg: 6.1, appliedForceN: 12 },
    { contactType: "floor-push", scenario: "Kalibreringsvikten Runa", object: "en kalibreringsvikt", massKg: 11, appliedForceN: 35 },
    { contactType: "two-support", scenario: "Ljusbalken Vide", object: "en jämntjock ljusbalk", massKg: 9.2, knownSupportN: 36 },
    { contactType: "two-support", scenario: "Odlingstråget Embla", object: "ett odlingstråg", massKg: 14, knownSupportN: 58 },
    { contactType: "two-support", scenario: "Kabelrännan Fjäll", object: "en kabelränna", massKg: 5.7, knownSupportN: 22 },
    { contactType: "two-support", scenario: "Modellbron Hassel", object: "en styv modellbro", massKg: 21, knownSupportN: 91 },
    { contactType: "two-support", scenario: "Solpanelen Ymer", object: "en solpanel i horisontellt läge", massKg: 8.4, knownSupportN: 31 }
  ];

  function clean(value) {
    return String(Number(value.toFixed(10))).replace(".", ",");
  }

  function roundSignificant(value, figures) {
    if (value === 0) return 0;
    const power = figures - 1 - Math.floor(Math.log10(Math.abs(value)));
    const scale = Math.pow(10, power);
    return Math.round((value + Number.EPSILON) * scale) / scale;
  }

  function formatSignificant(value, figures) {
    if (value === 0) return "0," + "0".repeat(figures - 1);
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    const decimals = Math.max(0, figures - 1 - exponent);
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

  function addLabel(diagram, shapes, labels, options) {
    const label = diagramKit.label({
      id: options.id,
      at: options.at,
      text: options.text,
      anchorId: options.anchorId,
      avoid: shapes.filter(function (shape) { return shape.id !== options.anchorId; }).map(function (shape) { return shape.id; }),
      minClearance: 6,
      textAnchor: options.textAnchor || "middle",
      fontSize: options.fontSize || 13,
      background: true
    });
    labels.push(label);
    diagram.add("labels", label);
    return label;
  }

  function makeDiagram(id, title, description, purpose, width, height) {
    return diagramKit.create({ id: id, title: title, description: description, purpose: purpose, width: width, height: height });
  }

  function graphAnswer(row) {
    if (row.graphTask === "slope" || row.graphTask === "acceleration") {
      const left = row.points[row.segmentIndex];
      const right = row.points[row.segmentIndex + 1];
      return (right.y - left.y) / (right.t - left.t);
    }
    if (row.graphTask === "average-speed") {
      let distance = 0;
      for (let index = 1; index < row.points.length; index += 1) distance += Math.abs(row.points[index].y - row.points[index - 1].y);
      return distance / (row.points[row.points.length - 1].t - row.points[0].t);
    }
    return row.points.slice(1).reduce(function (area, point, index) {
      const left = row.points[index];
      return area + (point.t - left.t) * (point.y + left.y) / 2;
    }, 0);
  }

  function requestedUnit(row) {
    if (row.graphTask === "distance") return ["m", "m"];
    if (row.graphTask === "acceleration") return ["m/s2", "m/s²"];
    return ["m/s", "m/s"];
  }

  function graphFigure(id, row) {
    const width = 560;
    const height = 350;
    const layout = {
      plot: { x: 82, y: 34, width: 438, height: 232 },
      xTickZone: { x: 74, y: 274, width: 460, height: 26 },
      yTickZone: { x: 18, y: 24, width: 52, height: 250 },
      xTitleZone: { x: 436, y: 316, width: 92, height: 26 },
      yTitleZone: { x: 224, y: 4, width: 92, height: 22 }
    };
    const transform = diagramKit.graphTransform({ xDomain: [0, row.axis.xMax], yDomain: [0, row.axis.yMax], plot: layout.plot });
    const diagram = makeDiagram(
      id + "-diagram",
      row.scenario + ": " + row.graphType + "-graf",
      "Styckvis linjär graf med exakt graderade axlar. Punkterna är " + row.points.map(function (point) { return "(" + point.t + ", " + point.y + ")"; }).join(", ") + ".",
      "prompt", width, height
    );
    const shapes = [];
    const labels = [];
    for (let value = row.axis.xStep; value < row.axis.xMax; value += row.axis.xStep) {
      const screenX = transform.xToScreen(value);
      addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-x-grid-" + value, a: [screenX, layout.plot.y], b: [screenX, layout.plot.y + layout.plot.height], role: "grid", strokeWidth: 1 }));
    }
    for (let value = row.axis.yStep; value < row.axis.yMax; value += row.axis.yStep) {
      const screenY = transform.yToScreen(value);
      addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-y-grid-" + value, a: [layout.plot.x, screenY], b: [layout.plot.x + layout.plot.width, screenY], role: "grid", strokeWidth: 1 }));
    }
    const xAxis = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-x-axis", a: [layout.plot.x, layout.plot.y + layout.plot.height], b: [layout.plot.x + layout.plot.width, layout.plot.y + layout.plot.height], role: "axis", strokeWidth: 2 }));
    const yAxis = addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-y-axis", a: [layout.plot.x, layout.plot.y], b: [layout.plot.x, layout.plot.y + layout.plot.height], role: "axis", strokeWidth: 2 }));
    const dataPoints = row.points.map(function (point) { return transform.toScreen([point.t, point.y]); });
    addShape(diagram, shapes, "information", diagramKit.polyline({ id: id + "-data-line", points: dataPoints, role: "line", strokeWidth: 4 }));
    dataPoints.forEach(function (point, index) {
      addShape(diagram, shapes, "information", diagramKit.circle({ id: id + "-point-" + index, center: point, radius: 4, role: "point", strokeWidth: 2 }));
    });
    for (let value = 0; value <= row.axis.xMax; value += row.axis.xStep) {
      addLabel(diagram, shapes, labels, { id: id + "-x-tick-label-" + value, at: [transform.xToScreen(value), 294], text: String(value), anchorId: xAxis.id, fontSize: 14 });
    }
    for (let value = 0; value <= row.axis.yMax; value += row.axis.yStep) {
      addLabel(diagram, shapes, labels, { id: id + "-y-tick-label-" + value, at: [66, Math.max(40, Math.min(transform.yToScreen(value) + 5, 266))], text: String(value), anchorId: yAxis.id, textAnchor: "end", fontSize: 14 });
    }
    addLabel(diagram, shapes, labels, { id: id + "-x-title", at: [520, 336], text: "t (s)", anchorId: xAxis.id, textAnchor: "end", fontSize: 14 });
    addLabel(diagram, shapes, labels, { id: id + "-y-title", at: [226, 20], text: row.graphType === "s-t" ? "s (m)" : "v (m/s)", anchorId: yAxis.id, textAnchor: "start", fontSize: 14 });
    const result = diagram.finish();
    return { html: result.html.replace("<svg ", '<svg data-scale="exact" data-x-max="' + row.axis.xMax + '" data-y-max="' + row.axis.yMax + '" '), manifest: result.manifest, layout: layout };
  }

  function graphSolution(row, exact, rendered, unitLabel) {
    if (row.graphTask === "slope" || row.graphTask === "acceleration") {
      const left = row.points[row.segmentIndex];
      const right = row.points[row.segmentIndex + 1];
      const symbol = row.graphTask === "acceleration" ? "a = Δv/Δt" : "v = Δs/Δt";
      return "<p><strong>Samband:</strong> " + symbol + ". Välj de markerade brytpunkterna på den raka delen.</p><p>Beräkning: (" + clean(right.y) + " − " + clean(left.y) + ")/(" + clean(right.t) + " − " + clean(left.t) + ") = " + clean(exact) + " " + unitLabel + ".</p><p>Efter avrundning blir svaret <strong>" + rendered + " " + unitLabel + "</strong>.</p>";
    }
    if (row.graphTask === "average-speed") {
      return "<p><strong>Samband:</strong> medelfart = total tillryggalagd sträcka/total tid. Riktningsbyten gör att delsträckornas belopp ska adderas.</p><p>Grafens samtliga delsträckor ger tillsammans " + clean(exact * (row.points[row.points.length - 1].t - row.points[0].t)) + " m under " + row.points[row.points.length - 1].t + " s.</p><p>Efter avrundning blir svaret <strong>" + rendered + " " + unitLabel + "</strong>.</p>";
    }
    return "<p><strong>Samband:</strong> sträckan är arean under en v-t-graf. Dela området vid grafens brytpunkter i trianglar och parallelltrapetser.</p><p>Summan av delareorna är " + clean(exact) + " (m/s)·s = " + clean(exact) + " m.</p><p>Efter avrundning blir svaret <strong>" + rendered + " " + unitLabel + "</strong>.</p>";
  }

  function graphWorkOnPaper(row) {
    const method = row.graphTask === "slope" || row.graphTask === "acceleration"
      ? "läs av två brytpunkter på den relevanta räta delen och beräkna lutningen"
      : row.graphTask === "average-speed"
        ? "läs av alla brytpunkter, summera delsträckornas belopp och dividera med hela tiden"
        : "dela arean under v-t-grafen i trianglar och parallelltrapetser och summera delareorna";
    return {
      title: "Arbeta i räknehäftet",
      instruction: "Arbeta i räknehäftet: " + method + ". Skriv enheter och tecken tydligt. Endast slutsvaret skrivs in digitalt; all avläsning och beräkning görs i räknehäftet.",
      comparison: "Jämför grafavläsning, val av brytpunkter eller delareor, tecken, enhet och avrundning med lösningen."
    };
  }

  function makeGraph(row, index) {
    const id = "physics-s1-graph-" + String(index + 1).padStart(2, "0");
    const figures = 2;
    const unit = requestedUnit(row);
    const exact = graphAnswer(row);
    const expected = roundSignificant(exact, figures);
    const figure = graphFigure(id, row);
    const data = Object.assign({}, row, {
      skill: SKILL,
      family: "graph-interpretation",
      caseNumber: index + 1,
      significantFigures: figures,
      targetUnit: unit[0],
      requestedUnitLabel: unit[1],
      diagram: figure.manifest,
      diagramLayout: figure.layout
    });
    return {
      id: id,
      slot: 1,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>Diagrammet visar " + (row.graphType === "s-t" ? "läge s" : "hastighet v") + " som funktion av tiden för " + row.scenario.toLowerCase() + ". " + row.prompt + "</p>" + figure.html + "<p><small>Grafens rutnät, brytpunkter och axelvärden är exakt skalenliga.</small></p><p>Svara i " + unit[1] + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: "Svar (" + unit[1] + "; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: unit[0], tolerance: tolerance(expected, figures), help: "Du kan skriva talet med eller utan den angivna enheten." }],
      workOnPaper: graphWorkOnPaper(row),
      solutionHtml: graphSolution(row, exact, formatSignificant(expected, figures), unit[1]),
      rubric: [
        { points: 1, text: "Rätt grafisk metod: lutning, total delsträcka eller area väljs och brytpunkternas exakta axelvärden används." },
        { points: 1, text: "Beräkning, tecken, enhet och avrundat slutsvar stämmer." }
      ],
      sourceData: data
    };
  }

  function contactAnswer(row) {
    if (row.contactType === "floor-pull") return row.massKg * G - row.appliedForceN;
    if (row.contactType === "floor-push") return row.massKg * G + row.appliedForceN;
    return row.massKg * G - row.knownSupportN;
  }

  function contactFigure(id, row) {
    const isBeam = row.contactType === "two-support";
    const applied = row.appliedForceN === undefined ? row.knownSupportN : row.appliedForceN;
    const title = row.scenario + ": kontaktsituation";
    const desc = isBeam
      ? "En horisontell kropp vilar på två stöd. Den vänstra stödreaktionen är " + applied + " newton; storleken kan inte avläsas ur pilen."
      : "En kropp ligger kvar mot ett horisontellt golv medan en yttre kraft på " + applied + " newton verkar " + (row.contactType === "floor-pull" ? "uppåt" : "nedåt") + ". Pilarnas längder kodar inte storlek.";
    const diagram = makeDiagram(id + "-diagram", title, desc + " Figuren är schematisk och inte skalenlig.", "prompt", 600, 300);
    const shapes = [];
    const labels = [];
    const baseline = { a: [80, 190], b: [520, 190] };
    addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-body", line: baseline, bottomCenter: [300, 190], width: isBeam ? 360 : 120, height: isBeam ? 50 : 70, outwardNormal: [0, -1], role: "body", strokeWidth: 2 }));
    if (isBeam) {
      const leftContact = [180, 190];
      const rightContact = [420, 190];
      addShape(diagram, shapes, "connections", diagramKit.polygon({ id: id + "-left-support", points: [leftContact, [154, 230], [206, 230]], role: "support", strokeWidth: 2 }));
      addShape(diagram, shapes, "connections", diagramKit.polygon({ id: id + "-right-support", points: [rightContact, [394, 230], [446, 230]], role: "support", strokeWidth: 2 }));
      const force = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-given-force", from: leftContact, to: [180, 70], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      addLabel(diagram, shapes, labels, { id: id + "-given-force-label", at: [245, 67], text: "F₁ = " + clean(applied) + " N", anchorId: force.id, fontSize: 14 });
    } else {
      addShape(diagram, shapes, "geometry", diagramKit.line({ id: id + "-ground", a: baseline.a, b: baseline.b, role: "ground", strokeWidth: 3 }));
      const upward = row.contactType === "floor-pull";
      const force = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-given-force", from: [300, upward ? 120 : 82], to: [300, upward ? 45 : 120], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
      addLabel(diagram, shapes, labels, { id: id + "-given-force-label", at: [385, 58], text: "F = " + clean(applied) + " N", anchorId: force.id, fontSize: 14 });
    }
    const result = diagram.finish();
    return { html: result.html, manifest: result.manifest };
  }

  function contactSolutionFigure(id, row) {
    const isBeam = row.contactType === "two-support";
    const centerX = 300;
    const weightMagnitude = row.massKg * G;
    let weightX = centerX;
    let normalX;
    let appliedX;
    const leftSupportX = 180;
    const rightSupportX = 420;
    if (isBeam) {
      weightX = (row.knownSupportN * leftSupportX + (weightMagnitude - row.knownSupportN) * rightSupportX) / weightMagnitude;
    } else if (row.contactType === "floor-pull") {
      const normalMagnitude = weightMagnitude - row.appliedForceN;
      const scale = Math.max(normalMagnitude, row.appliedForceN);
      normalX = centerX - 40 * row.appliedForceN / scale;
      appliedX = centerX + 40 * normalMagnitude / scale;
    } else {
      const scale = Math.max(weightMagnitude, row.appliedForceN);
      weightX = centerX - 40 * row.appliedForceN / scale;
      normalX = centerX;
      appliedX = centerX + 40 * weightMagnitude / scale;
    }
    const diagram = makeDiagram(
      id + "-solution-diagram",
      row.scenario + ": fullständig kraftfigur",
      isBeam
        ? "Frilagd balk med tyngdkraft nedåt och två stödreaktioner uppåt."
        : "Frilagd kropp med tyngdkraft, normalkraft och den givna yttre kraften i rätt riktning.",
      "solution", 600, 330
    );
    const shapes = [];
    const labels = [];
    const baseline = { a: [100, 190], b: [500, 190] };
    const body = addShape(diagram, shapes, "geometry", diagramKit.bodyOnLine({ id: id + "-isolated-body", line: baseline, bottomCenter: [300, 190], width: isBeam ? 300 : 130, height: 60, outwardNormal: [0, -1], role: "body", strokeWidth: 2 }));
    const weight = addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-weight", from: [weightX, 160], to: [weightX, 286], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 }));
    const forces = [weight];
    if (isBeam) {
      forces.push(addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-support-left", from: [leftSupportX, 160], to: [leftSupportX, 55], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 })));
      forces.push(addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-support-right", from: [rightSupportX, 160], to: [rightSupportX, 55], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 })));
    } else {
      forces.push(addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-normal", from: [normalX, 160], to: [normalX, 50], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 })));
      const upward = row.contactType === "floor-pull";
      forces.push(addShape(diagram, shapes, "information", diagramKit.arrow({ id: id + "-force-applied", from: [appliedX, 160], to: [appliedX, upward ? 65 : 270], role: "force", strokeWidth: 3, headLength: 12, headWidth: 10 })));
    }
    addLabel(diagram, shapes, labels, { id: id + "-force-weight-label", at: [isBeam ? weightX + 65 : weightX - 55, 286], text: "mg", anchorId: weight.id, fontSize: 15 });
    if (isBeam) {
      addLabel(diagram, shapes, labels, { id: id + "-force-support-left-label", at: [145, 48], text: "F₁", anchorId: forces[1].id, fontSize: 15 });
      addLabel(diagram, shapes, labels, { id: id + "-force-support-right-label", at: [455, 48], text: "F₂", anchorId: forces[2].id, fontSize: 15 });
    } else {
      addLabel(diagram, shapes, labels, { id: id + "-force-normal-label", at: [225, 45], text: "N", anchorId: forces[1].id, fontSize: 15 });
      addLabel(diagram, shapes, labels, { id: id + "-force-applied-label", at: [row.contactType === "floor-pull" ? 380 : 415, row.contactType === "floor-pull" ? 60 : 250], text: "F", anchorId: forces[2].id, fontSize: 15 });
    }
    return diagram.finish();
  }

  function contactPrompt(row) {
    if (row.contactType === "floor-pull") return "På ett plant golv står " + row.object + " med massan " + clean(row.massKg) + " kg. En lodrät kraft på " + clean(row.appliedForceN) + " N drar uppåt, men föremålet lämnar inte golvet. Bestäm golvets normalkraft.";
    if (row.contactType === "floor-push") return "På ett plant golv står " + row.object + " med massan " + clean(row.massKg) + " kg. En lodrät kraft på " + clean(row.appliedForceN) + " N pressar nedåt och kroppen är i vila. Bestäm golvets normalkraft.";
    return row.object.charAt(0).toUpperCase() + row.object.slice(1) + " har massan " + clean(row.massKg) + " kg och vilar horisontellt på två stöd. Det vänstra stödet ger kraften " + clean(row.knownSupportN) + " N uppåt. Bestäm kraften från det högra stödet när kroppen är i jämvikt.";
  }

  function contactSolution(row, exact, rendered) {
    if (row.contactType === "floor-pull") return "<p>Kraftfiguren ska visa tyngdkraften mg nedåt, normalkraften N uppåt och dragkraften F uppåt.</p><p><strong>Samband:</strong> jämvikt i vertikalled ger N + F − mg = 0, alltså N = mg − F.</p><p>Insättning: N = " + clean(row.massKg) + "·9,82 − " + clean(row.appliedForceN) + " = " + clean(exact) + " N. Efter avrundning: <strong>" + rendered + " N uppåt</strong>.</p>";
    if (row.contactType === "floor-push") return "<p>Kraftfiguren ska visa tyngdkraften mg och presskraften F nedåt samt normalkraften N uppåt.</p><p><strong>Samband:</strong> jämvikt i vertikalled ger N − mg − F = 0, alltså N = mg + F.</p><p>Insättning: N = " + clean(row.massKg) + "·9,82 + " + clean(row.appliedForceN) + " = " + clean(exact) + " N. Efter avrundning: <strong>" + rendered + " N uppåt</strong>.</p>";
    return "<p>Kraftfiguren ska visa tyngdkraften mg nedåt och de två stödreaktionerna F₁ och F₂ uppåt på balken.</p><p><strong>Samband:</strong> jämvikt i vertikalled ger F₁ + F₂ − mg = 0, alltså F₂ = mg − F₁.</p><p>Insättning: F₂ = " + clean(row.massKg) + "·9,82 − " + clean(row.knownSupportN) + " = " + clean(exact) + " N. Efter avrundning: <strong>" + rendered + " N uppåt</strong>.</p>";
  }

  function contactWorkOnPaper(row) {
    const forces = row.contactType === "two-support"
      ? "frilägg balken och rita tyngdkraften samt båda stödreaktionerna"
      : "frilägg kroppen och rita tyngdkraften, normalkraften och den yttre kraften med rätt riktning";
    return {
      title: "Arbeta i räknehäftet",
      instruction: "Arbeta i räknehäftet: " + forces + ". Ställ upp jämvikt i vertikalled och beräkna normalkraften eller stödreaktionen. Endast slutsvaret skrivs in digitalt; kraftfigur och beräkning görs i räknehäftet.",
      comparison: "Jämför friläggning, kraftpilar och riktningar, jämviktsvillkor, enhet och avrundning med lösningen."
    };
  }

  function makeContact(row, index) {
    const id = "physics-s1-contact-" + String(index + 1).padStart(2, "0");
    const figures = 2;
    const exact = contactAnswer(row);
    const expected = roundSignificant(exact, figures);
    const promptFigure = contactFigure(id, row);
    const solutionFigure = contactSolutionFigure(id, row);
    return {
      id: id,
      slot: 1,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + contactPrompt(row) + "</p>" + promptFigure.html + "<p><small>Figuren är schematisk och inte skalenlig; pilarnas längder får inte användas för mätning.</small></p><p>Rita först en kraftfigur. Svara sedan i N. Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: "Svar (N; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: "N", tolerance: tolerance(expected, figures), help: "Ange normalkraftens eller stödreaktionens storlek." }],
      workOnPaper: contactWorkOnPaper(row),
      solutionHtml: contactSolution(row, exact, formatSignificant(expected, figures)) + solutionFigure.html,
      rubric: [
        { points: 1, text: "Kraftfiguren visar tyngdkraft och samtliga kontakt-/yttre krafter på rätt kropp med rätt riktning." },
        { points: 1, text: "Newtons första lag i vertikalled är korrekt och ger rätt storlek, riktning, enhet och avrundning." }
      ],
      sourceData: Object.assign({}, row, { skill: SKILL, family: "contact-equilibrium", caseNumber: index + 1, g: G, significantFigures: figures, targetUnit: "N", requestedUnitLabel: "N", diagram: promptFigure.manifest, solutionDiagram: solutionFigure.manifest })
    };
  }

  return GRAPH_ROWS.map(makeGraph).concat(CONTACT_ROWS.map(makeContact));
});
