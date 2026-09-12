(function (root, factory) {
  const diagramKit = typeof module === "object" && module.exports
    ? require("../../assets/js/diagram-kit.js")
    : root && root.KS && root.KS.diagram;
  const bank = factory(diagramKit);
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_MATH_SLOTS = root.KS_MATH_SLOTS || {};
    root.KS_MATH_SLOTS[5] = bank;
  }
})(typeof window !== "undefined" ? window : null, function (diagramKit) {
  "use strict";

  if (!diagramKit || typeof diagramKit.create !== "function" || typeof diagramKit.validateManifest !== "function") {
    throw new Error("diagram-kit dependency is required before constructing mathematics slot 5");
  }

  const FAMILY_ROWS = [
    ["right-triangle", [
      { adjacent: 7.4, angleDegrees: 33, decimals: 1, unit: "m" },
      { adjacent: 12.5, angleDegrees: 41, decimals: 1, unit: "cm" },
      { adjacent: 8.2, angleDegrees: 58, decimals: 2, unit: "m" },
      { adjacent: 15.3, angleDegrees: 26, decimals: 1, unit: "cm" },
      { adjacent: 9.7, angleDegrees: 67, decimals: 2, unit: "m" }
    ]],
    ["non-right-triangle-area", [
      { sideA: 8.4, sideB: 5.7, angleDegrees: 74, decimals: 1, unit: "m²" },
      { sideA: 12.2, sideB: 9.5, angleDegrees: 43, decimals: 1, unit: "cm²" },
      { sideA: 7.8, sideB: 11.6, angleDegrees: 108, decimals: 2, unit: "m²" },
      { sideA: 14.3, sideB: 6.9, angleDegrees: 132, decimals: 1, unit: "cm²" },
      { sideA: 10.7, sideB: 13.4, angleDegrees: 51, decimals: 2, unit: "m²" }
    ]],
    ["parallel-transversal", [
      { ad: 4.2, db: 6.3, ae: 3.5, decimals: 1, unit: "cm" },
      { ad: 5.6, db: 8.4, ae: 7.2, decimals: 2, unit: "m" },
      { ad: 7.5, db: 4.8, ae: 6.1, decimals: 1, unit: "cm" },
      { ad: 3.8, db: 9.1, ae: 4.6, decimals: 2, unit: "m" },
      { ad: 8.2, db: 5.5, ae: 9.4, decimals: 1, unit: "cm" }
    ]],
    ["composite-quadrilateral", [
      { outerWidth: 8.6, outerHeight: 6.4, cutWidth: 3.1, cutHeight: 2.7, decimals: 1, unit: "m²" },
      { outerWidth: 14.5, outerHeight: 9.2, cutWidth: 5.8, cutHeight: 4.1, decimals: 2, unit: "cm²" },
      { outerWidth: 11.3, outerHeight: 7.9, cutWidth: 2.6, cutHeight: 3.8, decimals: 1, unit: "m²" },
      { outerWidth: 16.8, outerHeight: 12.4, cutWidth: 7.3, cutHeight: 5.6, decimals: 2, unit: "cm²" },
      { outerWidth: 9.7, outerHeight: 8.5, cutWidth: 4.2, cutHeight: 2.9, decimals: 1, unit: "m²" }
    ]],
    ["symmetric-construction", [
      { base: 8.6, equalSide: 7.3, decimals: 1, unit: "m" },
      { base: 13.2, equalSide: 9.8, decimals: 2, unit: "cm" },
      { base: 10.4, equalSide: 12.1, decimals: 1, unit: "m" },
      { base: 17.6, equalSide: 11.5, decimals: 2, unit: "cm" },
      { base: 6.8, equalSide: 9.4, decimals: 1, unit: "m" }
    ]]
  ];

  function clean(value) {
    return (Number.isInteger(value) ? String(value) : String(value)).replace(".", ",");
  }

  function fixedDecimal(value, decimals) {
    return Number(value).toFixed(decimals).replace(".", ",");
  }

  function roundingText(decimals) {
    return decimals === 1 ? "en decimal" : "två decimaler";
  }

  function workOnPaper(family) {
    const guidance = {
      "right-triangle": [
        "Skriv det trigonometriska sambandet, rita en märkt skiss med vinkel och kateter och visa beräkningen med rätt enhet. Här skriver du endast slutsvaret.",
        "Jämför det trigonometriska sambandet, den märkta skissen, insättningen, enheten och avrundningen med lösningen."
      ],
      "non-right-triangle-area": [
        "Skriv areasambandet med sinus, rita en märkt skiss över de två sidorna och mellanliggande vinkel och visa beräkningen med areaenhet. Här skriver du endast slutsvaret.",
        "Jämför areasamband, märkt skiss, vinkelplacering, beräkning, areaenhet och avrundning med lösningen."
      ],
      "parallel-transversal": [
        "Skriv likformighets- och proportionalitetssambandet, rita en märkt skiss med parallella segment och visa beräkningen av den sökta sträckan. Här skriver du endast slutsvaret.",
        "Jämför likformighetsrelation, parallellmarkering i skissen, proportion, beräkning och enhet med lösningen."
      ],
      "composite-quadrilateral": [
        "Rita en märkt skiss av ytterrektangeln och urtagningen, skriv area-sambandet och visa beräkningen med rätt areaenhet. Här skriver du endast slutsvaret.",
        "Jämför den märkta skissen, uppdelningen i ytterarea minus urtagning, beräkningen, enheten och avrundningen med lösningen."
      ],
      "symmetric-construction": [
        "Rita en märkt skiss med symmetriaxel och halverad bas, skriv Pythagoras samband och visa beräkningen av höjden. Här skriver du endast slutsvaret.",
        "Jämför den märkta skissen, basens halvering, Pythagoras samband, beräkningen och enheten med lösningen."
      ]
    }[family];
    return { title: "Arbeta i räknehäftet", instruction: guidance[0], comparison: guidance[1] };
  }

  function round(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function exactValue(family, p) {
    const radians = function (degrees) { return degrees * Math.PI / 180; };
    if (family === "right-triangle") return p.adjacent * Math.tan(radians(p.angleDegrees));
    if (family === "non-right-triangle-area") return 0.5 * p.sideA * p.sideB * Math.sin(radians(p.angleDegrees));
    if (family === "parallel-transversal") return p.ae * p.db / p.ad;
    if (family === "composite-quadrilateral") return p.outerWidth * p.outerHeight - p.cutWidth * p.cutHeight;
    return Math.sqrt(p.equalSide * p.equalSide - Math.pow(p.base / 2, 2));
  }

  function add(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
  }

  function scale(vector, factor) {
    return [vector[0] * factor, vector[1] * factor];
  }

  function midpoint(a, b) {
    return scale(add(a, b), 0.5);
  }

  function interpolate(a, b, ratio) {
    return add(a, scale(subtract(b, a), ratio));
  }

  function unit(vector) {
    const length = Math.hypot(vector[0], vector[1]);
    return scale(vector, 1 / length);
  }

  function label(diagram, id, suffix, at, text, anchorId, avoid, textAnchor) {
    diagram.add("labels", diagramKit.label({
      id: id + "-" + suffix,
      at: at,
      text: text,
      anchorId: anchorId,
      avoid: avoid,
      minClearance: 6,
      textAnchor: textAnchor || "middle",
      fontSize: 14,
      background: true
    }));
  }

  function makeDiagram(id, title, description) {
    return diagramKit.create({ id: id + "-diagram", title: title, description: description, width: 360, height: 240, purpose: "prompt" });
  }

  function rightTriangleFigure(id, p) {
    const diagram = makeDiagram(id, "Rätvinklig triangel med markerad vinkel", "En schematisk rätvinklig triangel där den närliggande kateten och en spetsig vinkel är kända.");
    const radians = p.angleDegrees * Math.PI / 180;
    const adjacentPixels = Math.min(235, 140 / Math.tan(radians));
    const rightVertex = [55, 185];
    const angleVertex = [55 + adjacentPixels, 185];
    const apex = [55, 185 - adjacentPixels * Math.tan(radians)];
    const outlineId = id + "-outline";
    const dimensionId = id + "-adjacent-dimension";
    const markerId = id + "-right-marker";
    const angleId = id + "-given-angle";
    diagram.add("geometry", diagramKit.polygon({ id: outlineId, points: [rightVertex, angleVertex, apex], role: "shape", strokeWidth: 3 }));
    diagram.add("information", diagramKit.polyline({ id: markerId, points: [add(rightVertex, [0, -18]), add(rightVertex, [18, -18]), add(rightVertex, [18, 0])], role: "marker", strokeWidth: 2 }));
    diagram.add("information", diagramKit.angleArc({ id: angleId, vertex: angleVertex, fromRay: rightVertex, toRay: apex, radius: 25, role: "angle", strokeWidth: 2 }));
    const adjacentDimension = diagramKit.dimension({ id: dimensionId, a: rightVertex, b: angleVertex, offset: 22, role: "dimension" });
    diagram.add("information", adjacentDimension);
    const angleDirection = unit(add(unit(subtract(rightVertex, angleVertex)), unit(subtract(apex, angleVertex))));
    label(diagram, id, "angle-label", add(angleVertex, scale(angleDirection, 43)), clean(p.angleDegrees) + "°", angleId, [outlineId, angleId, markerId]);
    label(diagram, id, "adjacent-label", add(midpoint(adjacentDimension.start, adjacentDimension.end), [0, 20]), clean(p.adjacent) + " " + p.unit, dimensionId, [outlineId, dimensionId, markerId]);
    label(diagram, id, "height-label", [35, (rightVertex[1] + apex[1]) / 2], "h", outlineId, [outlineId, markerId]);
    return diagram.finish();
  }

  function areaTriangleFigure(id, p) {
    const diagram = makeDiagram(id, "Triangel med två sidor och mellanliggande vinkel", "En schematisk triangel där två sidlängder och vinkeln mellan dem är markerade.");
    const radians = p.angleDegrees * Math.PI / 180;
    const pixelsPerUnit = 115 / Math.max(p.sideA, p.sideB);
    const vertex = [170, 180];
    const sideAEnd = add(vertex, [p.sideA * pixelsPerUnit, 0]);
    const sideBEnd = add(vertex, [p.sideB * pixelsPerUnit * Math.cos(radians), -p.sideB * pixelsPerUnit * Math.sin(radians)]);
    const outlineId = id + "-outline";
    const sideAId = id + "-side-a-dimension";
    const sideBId = id + "-side-b-dimension";
    const angleId = id + "-included-angle";
    diagram.add("geometry", diagramKit.polygon({ id: outlineId, points: [vertex, sideAEnd, sideBEnd], role: "shape", strokeWidth: 3 }));
    const sideA = diagramKit.dimension({ id: sideAId, a: vertex, b: sideAEnd, offset: 22, role: "dimension" });
    const sideB = diagramKit.dimension({ id: sideBId, a: vertex, b: sideBEnd, offset: -18, role: "dimension" });
    diagram.add("information", sideA);
    diagram.add("information", sideB);
    diagram.add("information", diagramKit.angleArc({ id: angleId, vertex: vertex, fromRay: sideAEnd, toRay: sideBEnd, radius: 27, role: "angle", strokeWidth: 2 }));
    const angleDirection = unit(add(unit(subtract(sideAEnd, vertex)), unit(subtract(sideBEnd, vertex))));
    label(diagram, id, "angle-label", add(vertex, scale(angleDirection, 45)), clean(p.angleDegrees) + "°", angleId, [outlineId, angleId, sideAId, sideBId]);
    label(diagram, id, "side-a-label", add(midpoint(sideA.start, sideA.end), [0, 20]), clean(p.sideA) + " " + p.unit.replace("²", ""), sideAId, [outlineId, sideAId, angleId]);
    label(diagram, id, "side-b-label", add(midpoint(sideB.start, sideB.end), scale(sideB.normal, -10)), clean(p.sideB) + " " + p.unit.replace("²", ""), sideBId, [outlineId, sideBId, angleId]);
    return diagram.finish();
  }

  function parallelFigure(id, p) {
    const diagram = makeDiagram(id, "Triangel med ett parallellt tvärsegment", "I triangeln ligger D på AB och E på AC. Segmentet DE är parallellt med BC.");
    const a = [180, 32]; const b = [48, 185]; const c = [312, 185];
    const ratio = p.ad / (p.ad + p.db);
    const d = interpolate(a, b, ratio); const e = interpolate(a, c, ratio);
    const outlineId = id + "-outline"; const transversalId = id + "-transversal";
    diagram.add("geometry", diagramKit.polygon({ id: outlineId, points: [a, b, c], role: "shape", strokeWidth: 3 }));
    [["point-a", a], ["point-b", b], ["point-c", c], ["point-d", d], ["point-e", e]].forEach(function (entry) {
      diagram.add("information", diagramKit.circle({ id: id + "-" + entry[0], center: entry[1], radius: 2.5, role: "point", strokeWidth: 1.5 }));
    });
    diagram.add("connections", diagramKit.line({ id: transversalId, a: d, b: e, role: "connection", strokeWidth: 3 }));
    [
      ["ad-dimension", a, d, 13, "AD = " + clean(p.ad) + " " + p.unit],
      ["db-dimension", d, b, 13, "DB = " + clean(p.db) + " " + p.unit],
      ["ae-dimension", a, e, -13, "AE = " + clean(p.ae) + " " + p.unit],
      ["ec-dimension", e, c, -13, "EC = ?"]
    ].forEach(function (entry) {
      const dimension = diagramKit.dimension({ id: id + "-" + entry[0], a: entry[1], b: entry[2], offset: entry[3], role: "dimension" });
      diagram.add("information", dimension);
      label(diagram, id, entry[0].replace("dimension", "label"), midpoint(dimension.start, dimension.end), entry[4], dimension.id, [outlineId, transversalId, dimension.id], "middle");
    });
    const pointLabels = [["A", a, [0, -10]], ["B", b, [-12, 16]], ["C", c, [12, 16]], ["D", d, [-10, 4]], ["E", e, [10, 4]]];
    pointLabels.forEach(function (entry) {
      label(diagram, id, "vertex-" + entry[0].toLowerCase(), add(entry[1], entry[2]), entry[0], id + "-point-" + entry[0].toLowerCase(), [outlineId, transversalId], "middle");
    });
    return diagram.finish();
  }

  function compositeFigure(id, p) {
    const diagram = makeDiagram(id, "L-formad sammansatt fyrhörning", "En schematisk ytterrektangel med en rektangulär urtagning i det övre högra hörnet.");
    const pixelsPerUnit = Math.min(250 / p.outerWidth, 145 / p.outerHeight);
    const outerPixelWidth = p.outerWidth * pixelsPerUnit;
    const outerPixelHeight = p.outerHeight * pixelsPerUnit;
    const left = (360 - outerPixelWidth) / 2; const right = left + outerPixelWidth; const bottom = 185; const top = bottom - outerPixelHeight;
    const cutLeft = right - p.cutWidth * pixelsPerUnit;
    const cutBottom = top + p.cutHeight * pixelsPerUnit;
    const outerTopLeft = [left, top]; const cutTopLeft = [cutLeft, top];
    const cutBottomLeft = [cutLeft, cutBottom]; const cutBottomRight = [right, cutBottom];
    const outerBottomRight = [right, bottom]; const outerBottomLeft = [left, bottom]; const removedTopRight = [right, top];
    const outlineId = id + "-outline";
    diagram.add("geometry", diagramKit.polygon({ id: outlineId, points: [outerTopLeft, cutTopLeft, cutBottomLeft, cutBottomRight, outerBottomRight, outerBottomLeft], role: "shape", strokeWidth: 3 }));
    const dimensions = [
      ["outer-width-dimension", outerBottomLeft, outerBottomRight, 18, clean(p.outerWidth) + " " + p.unit.replace("²", "")],
      ["outer-height-dimension", outerTopLeft, outerBottomLeft, 18, clean(p.outerHeight) + " " + p.unit.replace("²", "")],
      ["cut-width-dimension", cutTopLeft, removedTopRight, 14, clean(p.cutWidth) + " " + p.unit.replace("²", "")],
      ["cut-height-dimension", removedTopRight, cutBottomRight, 14, clean(p.cutHeight) + " " + p.unit.replace("²", "")]
    ];
    dimensions.forEach(function (entry) {
      const dimension = diagramKit.dimension({ id: id + "-" + entry[0], a: entry[1], b: entry[2], offset: entry[3], role: "dimension" });
      diagram.add("information", dimension);
      const labelOffset = entry[0] === "outer-width-dimension" ? [0, 20] : [0, 5];
      label(diagram, id, entry[0].replace("dimension", "label"), add(midpoint(dimension.start, dimension.end), labelOffset), entry[4], dimension.id, [outlineId, dimension.id], "middle");
    });
    return diagram.finish();
  }

  function symmetricFigure(id, p) {
    const diagram = makeDiagram(id, "Likbent triangulär konstruktion", "En schematisk likbent triangel med höjden dragen från toppen till basens mittpunkt.");
    const physicalHalfBase = p.base / 2;
    const physicalHeight = Math.sqrt(p.equalSide * p.equalSide - physicalHalfBase * physicalHalfBase);
    const halfWidth = Math.min(120, 140 * physicalHalfBase / physicalHeight);
    const heightPixels = halfWidth * physicalHeight / physicalHalfBase;
    const baseMidpoint = [180, 185]; const apex = [180, 185 - heightPixels];
    const baseLeft = [180 - halfWidth, 185]; const baseRight = [180 + halfWidth, 185];
    const outlineId = id + "-outline"; const heightId = id + "-height"; const markerId = id + "-right-marker";
    diagram.add("geometry", diagramKit.polygon({ id: outlineId, points: [apex, baseLeft, baseRight], role: "shape", strokeWidth: 3 }));
    diagram.add("connections", diagramKit.line({ id: heightId, a: apex, b: baseMidpoint, role: "line", strokeWidth: 2 }));
    diagram.add("information", diagramKit.polyline({ id: markerId, points: [add(baseMidpoint, [0, -16]), add(baseMidpoint, [16, -16]), add(baseMidpoint, [16, 0])], role: "marker", strokeWidth: 2 }));
    const baseDimension = diagramKit.dimension({ id: id + "-base-dimension", a: baseLeft, b: baseRight, offset: 18, role: "dimension" });
    const leftDimension = diagramKit.dimension({ id: id + "-equal-left-dimension", a: apex, b: baseLeft, offset: 13, role: "dimension" });
    const rightDimension = diagramKit.dimension({ id: id + "-equal-right-dimension", a: apex, b: baseRight, offset: -13, role: "dimension" });
    diagram.add("information", baseDimension); diagram.add("information", leftDimension); diagram.add("information", rightDimension);
    label(diagram, id, "base-label", add(midpoint(baseDimension.start, baseDimension.end), [0, 20]), clean(p.base) + " " + p.unit, baseDimension.id, [outlineId, baseDimension.id, heightId]);
    label(diagram, id, "equal-left-label", midpoint(leftDimension.start, leftDimension.end), clean(p.equalSide) + " " + p.unit, leftDimension.id, [outlineId, leftDimension.id, heightId]);
    label(diagram, id, "equal-right-label", midpoint(rightDimension.start, rightDimension.end), clean(p.equalSide) + " " + p.unit, rightDimension.id, [outlineId, rightDimension.id, heightId]);
    label(diagram, id, "height-label", add(midpoint(apex, baseMidpoint), [12, 0]), "h", heightId, [outlineId, heightId, markerId], "start");
    return diagram.finish();
  }

  function presentation(family, p, id) {
    const rounding = "Avrunda svaret till " + roundingText(p.decimals) + " och ange det i " + p.unit + ".";
    if (family === "right-triangle") {
      const figure = rightTriangleFigure(id, p);
      return {
      prompt: "En mättriangel har en känd katet intill vinkeln " + clean(p.angleDegrees) + "°. Kateten är " + clean(p.adjacent) + " " + p.unit + ". Bestäm den motstående kateten <var>h</var>. " + rounding,
      figure: figure.html,
      diagram: figure.manifest,
      relation: "I en rätvinklig triangel gäller tan(v) = motstående katet/närliggande katet.",
      calculation: "h = " + clean(p.adjacent) + " · tan(" + clean(p.angleDegrees) + "°)"
      };
    }
    if (family === "non-right-triangle-area") {
      const figure = areaTriangleFigure(id, p);
      return {
      prompt: "En triangulär skiva har två sidor som är " + clean(p.sideA) + " och " + clean(p.sideB) + " " + p.unit.replace("²", "") + ". Vinkeln mellan sidorna är " + clean(p.angleDegrees) + "°. Bestäm skivans area. " + rounding,
      figure: figure.html,
      diagram: figure.manifest,
      relation: "För två sidor och deras mellanliggande vinkel gäller A = ab · sin(v)/2.",
      calculation: "A = " + clean(p.sideA) + " · " + clean(p.sideB) + " · sin(" + clean(p.angleDegrees) + "°)/2"
      };
    }
    if (family === "parallel-transversal") {
      const figure = parallelFigure(id, p);
      return {
      prompt: "I triangeln ligger D på sidan AB och E på sidan AC, med DE parallell med BC. Längderna är AD = " + clean(p.ad) + " " + p.unit + ", DB = " + clean(p.db) + " " + p.unit + " och AE = " + clean(p.ae) + " " + p.unit + ". Bestäm EC. " + rounding,
      figure: figure.html,
      diagram: figure.manifest,
      relation: "Eftersom DE ∥ BC är trianglarna ADE och ABC likformiga. Delarna på de två sidorna är därför proportionella: EC/AE = DB/AD.",
      calculation: "EC = AE · DB/AD = " + clean(p.ae) + " · " + clean(p.db) + "/" + clean(p.ad)
      };
    }
    if (family === "composite-quadrilateral") {
      const figure = compositeFigure(id, p);
      return {
      prompt: "En L-formad platta kan ses som en rektangel med bredd " + clean(p.outerWidth) + " och höjden " + clean(p.outerHeight) + " " + p.unit.replace("²", "") + ", där ett rektangulärt hörn på " + clean(p.cutWidth) + " × " + clean(p.cutHeight) + " " + p.unit.replace("²", "") + " har tagits bort. Bestäm plattans area. " + rounding,
      figure: figure.html,
      diagram: figure.manifest,
      relation: "Arean av den sammansatta fyrhörningen är ytterrektangelns area minus urtagningens area.",
      calculation: "A = " + clean(p.outerWidth) + " · " + clean(p.outerHeight) + " − " + clean(p.cutWidth) + " · " + clean(p.cutHeight)
      };
    }
    const figure = symmetricFigure(id, p);
    return {
      prompt: "En symmetrisk triangulär ram har basen " + clean(p.base) + " " + p.unit + " och två lika långa sidor på " + clean(p.equalSide) + " " + p.unit + ". Bestäm ramens vinkelräta höjd <var>h</var>. " + rounding,
      figure: figure.html,
      diagram: figure.manifest,
      relation: "Symmetriaxeln halverar basen och bildar en rät vinkel. Pythagoras sats ger h² + (bas/2)² = sida².",
      calculation: "h = √(" + clean(p.equalSide) + "² − (" + clean(p.base) + "/2)²)"
    };
  }

  function makeQuestion(family, input, rowIndex) {
    const p = Object.assign({}, input);
    const id = "math-s5-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const shown = presentation(family, p, id);
    const exact = exactValue(family, p);
    const expected = round(exact, p.decimals);
    const area = family === "non-right-triangle-area" || family === "composite-quadrilateral";
    return {
      id: id,
      slot: 5,
      title: area ? "Geometrisk area" : "Geometrisk längd",
      points: 2,
      promptHtml: "<p>" + shown.prompt + "</p>" + shown.figure + "<p class=\"figure-note\">Figuren är schematisk och inte skalenlig; använd endast de angivna måtten.</p>",
      workOnPaper: workOnPaper(family),
      fields: [{
        id: "value", label: area ? "Svar i " + p.unit + " (skriv endast talet)" : "Svar i " + p.unit,
        kind: "numeric", points: 2, expected: expected, targetUnit: p.unit,
        tolerance: { absolute: p.decimals === 1 ? 0.051 : 0.0051, relative: 0 },
        help: area ? "Skriv endast det avrundade talet." : "Enheten kan skrivas tillsammans med talet."
      }],
      solutionHtml: "<p><strong>Samband:</strong> " + shown.relation + "</p>" +
        "<p>Sätt in de givna värdena: <strong>" + shown.calculation + " = " + clean(Number(exact.toFixed(6))) + " " + p.unit + "</strong>.</p>" +
        "<p>Efter avrundning till " + roundingText(p.decimals) + " blir svaret <strong>" + fixedDecimal(expected, p.decimals) + " " + p.unit + "</strong>.</p>",
      rubric: [
        { points: 1, text: "Korrekt geometriskt samband och korrekt insatta värden." },
        { points: 1, text: "Korrekt beräkning, enhet och avrundning." }
      ],
      sourceData: {
        skill: "geometry",
        family: family,
        parameters: p,
        decimals: p.decimals,
        unit: p.unit,
        diagram: shown.diagram
      }
    };
  }

  return FAMILY_ROWS.flatMap(function (entry) {
    return entry[1].map(function (parameters, index) { return makeQuestion(entry[0], parameters, index); });
  });
});
