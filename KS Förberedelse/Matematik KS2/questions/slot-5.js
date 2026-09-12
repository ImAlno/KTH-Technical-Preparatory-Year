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

  function labelBox(at, text, textAnchor, fontSize) {
    const textWidth = Math.max(1, text.length * fontSize * 0.58);
    const x = textAnchor === "middle" ? at[0] - textWidth / 2 : textAnchor === "end" ? at[0] - textWidth : at[0];
    return { x: x - 2, y: at[1] - fontSize - 2, width: textWidth + 4, height: fontSize * 1.25 + 4 };
  }

  function boxesOverlap(left, right) {
    return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
  }

  function expandedBox(box, clearance) {
    return { x: box.x - clearance, y: box.y - clearance, width: box.width + 2 * clearance, height: box.height + 2 * clearance };
  }

  function pointInsideBox(point, box) {
    return point[0] >= box.x && point[0] <= box.x + box.width && point[1] >= box.y && point[1] <= box.y + box.height;
  }

  function segmentIntersectsBox(from, to, box) {
    if (pointInsideBox(from, box) || pointInsideBox(to, box)) return true;
    const delta = subtract(to, from);
    let minimum = 0; let maximum = 1;
    const boundaries = [
      [-delta[0], from[0] - box.x],
      [delta[0], box.x + box.width - from[0]],
      [-delta[1], from[1] - box.y],
      [delta[1], box.y + box.height - from[1]]
    ];
    for (let index = 0; index < boundaries.length; index += 1) {
      const direction = boundaries[index][0]; const distance = boundaries[index][1];
      if (Math.abs(direction) <= 1e-12) {
        if (distance < 0) return false;
      } else {
        const ratio = distance / direction;
        if (direction < 0) minimum = Math.max(minimum, ratio);
        else maximum = Math.min(maximum, ratio);
        if (minimum > maximum) return false;
      }
    }
    return true;
  }

  function primitiveStrokes(primitive) {
    if (primitive.kind === "line") return [{ kind: "segment", from: primitive.a, to: primitive.b, strokeWidth: primitive.strokeWidth }];
    if (primitive.kind === "circle") return [{ kind: "circle", center: primitive.center, radius: primitive.radius, strokeWidth: primitive.strokeWidth }];
    if (primitive.kind === "polygon" || primitive.kind === "polyline") {
      const limit = primitive.kind === "polygon" ? primitive.points.length : primitive.points.length - 1;
      return Array.from({ length: limit }, function (_, index) { return { kind: "segment", from: primitive.points[index], to: primitive.points[(index + 1) % primitive.points.length], strokeWidth: primitive.strokeWidth }; });
    }
    if (primitive.kind === "dimension") {
      return [{ kind: "segment", from: primitive.start, to: primitive.end, strokeWidth: primitive.strokeWidth }].concat(primitive.extension.map(function (extension) { return { kind: "segment", from: extension.from, to: extension.to, strokeWidth: primitive.strokeWidth }; }));
    }
    if (primitive.kind === "angleArc") {
      const startAngle = Math.atan2(primitive.start[1] - primitive.vertex[1], primitive.start[0] - primitive.vertex[0]);
      const steps = Math.max(12, Math.ceil(primitive.radians * primitive.radius * 2));
      const points = Array.from({ length: steps + 1 }, function (_, index) {
        const angle = startAngle + primitive.sweep * primitive.radians * index / steps;
        return [primitive.vertex[0] + primitive.radius * Math.cos(angle), primitive.vertex[1] + primitive.radius * Math.sin(angle)];
      });
      return points.slice(1).map(function (point, index) { return { kind: "segment", from: points[index], to: point, strokeWidth: primitive.strokeWidth }; });
    }
    throw new Error("Unsupported label avoidance geometry: " + primitive.kind);
  }

  function strokeIntersectsBox(stroke, box, clearance) {
    if (stroke.kind === "segment") return segmentIntersectsBox(stroke.from, stroke.to, expandedBox(box, clearance + stroke.strokeWidth / 2));
    const protectedBox = expandedBox(box, clearance);
    const closest = [
      Math.max(protectedBox.x, Math.min(stroke.center[0], protectedBox.x + protectedBox.width)),
      Math.max(protectedBox.y, Math.min(stroke.center[1], protectedBox.y + protectedBox.height))
    ];
    return Math.hypot(stroke.center[0] - closest[0], stroke.center[1] - closest[1]) <= stroke.radius + stroke.strokeWidth / 2;
  }

  function primitiveClearsBox(primitive, box, clearance) {
    return primitiveStrokes(primitive).every(function (stroke) { return !strokeIntersectsBox(stroke, box, clearance); });
  }

  function boxCenter(box) {
    return [box.x + box.width / 2, box.y + box.height / 2];
  }

  function angleCenterAllowed(center, placement) {
    const ray = subtract(center, placement.anchorPoint);
    const determinant = placement.fromRay[0] * placement.toRay[1] - placement.fromRay[1] * placement.toRay[0];
    const firstWeight = (ray[0] * placement.toRay[1] - ray[1] * placement.toRay[0]) / determinant;
    const secondWeight = (placement.fromRay[0] * ray[1] - placement.fromRay[1] * ray[0]) / determinant;
    const radius = Math.hypot(ray[0], ray[1]);
    return firstWeight > 0 && secondWeight > 0 && radius >= placement.minDistance && radius <= placement.maxDistance;
  }

  function localCandidateCenters(placement) {
    const candidates = [placement.preferredCenter];
    for (let y = -placement.maxDistance; y <= placement.maxDistance; y += 2) for (let x = -placement.maxDistance; x <= placement.maxDistance; x += 2) {
      if (Math.hypot(x, y) <= placement.maxDistance) candidates.push(add(placement.anchorPoint, [x, y]));
    }
    candidates.sort(function (left, right) {
      const leftDistance = Math.pow(left[0] - placement.preferredCenter[0], 2) + Math.pow(left[1] - placement.preferredCenter[1], 2);
      const rightDistance = Math.pow(right[0] - placement.preferredCenter[0], 2) + Math.pow(right[1] - placement.preferredCenter[1], 2);
      return leftDistance - rightDistance || left[1] - right[1] || left[0] - right[0];
    });
    return candidates;
  }

  const PLACEMENT_STATE = new WeakMap();

  function addShape(diagram, layer, primitive) {
    PLACEMENT_STATE.get(diagram).geometry.set(primitive.id, primitive);
    diagram.add(layer, primitive);
    return primitive;
  }

  function label(diagram, id, suffix, text, anchorId, placement) {
    const anchor = "middle"; const fontSize = placement.fontSize || 14; const clearance = placement.clearance || 6;
    const state = PLACEMENT_STATE.get(diagram);
    const avoid = Array.from(state.geometry.keys()).filter(function (geometryId) { return geometryId !== anchorId; });
    if (!state.geometry.has(anchorId)) throw new Error("Missing label anchor geometry: " + anchorId);
    const placedAt = localCandidateCenters(placement).map(function (center) { return [center[0], center[1] + fontSize * 0.375]; }).find(function (candidate) {
      const box = labelBox(candidate, text, anchor, fontSize); const center = boxCenter(box);
      if (box.x < 0 || box.y < 0 || box.x + box.width > state.width || box.y + box.height > state.height) return false;
      if (Math.hypot(center[0] - placement.anchorPoint[0], center[1] - placement.anchorPoint[1]) > placement.maxDistance + 1e-9) return false;
      if (placement.kind === "angle" && !angleCenterAllowed(center, placement)) return false;
      if (state.labels.some(function (other) { return boxesOverlap(expandedBox(box, clearance), other); })) return false;
      return avoid.every(function (avoidId) {
        const target = state.geometry.get(avoidId);
        if (!target) throw new Error("Missing label avoid geometry: " + avoidId);
        return primitiveClearsBox(target, box, clearance);
      });
    });
    if (!placedAt) throw new Error("No collision-free label placement for " + id + "-" + suffix);
    state.labels.push(labelBox(placedAt, text, anchor, fontSize));
    diagram.add("labels", diagramKit.label({
      id: id + "-" + suffix,
      at: placedAt,
      text: text,
      anchorId: anchorId,
      avoid: avoid,
      minClearance: clearance,
      textAnchor: anchor,
      fontSize: fontSize,
      background: true
    }));
  }

  function makeDiagram(id, title, description, width, height) {
    const diagramWidth = width || 360; const diagramHeight = height || 240;
    const diagram = diagramKit.create({ id: id + "-diagram", title: title, description: description, width: diagramWidth, height: diagramHeight, purpose: "prompt" });
    PLACEMENT_STATE.set(diagram, { geometry: new Map(), labels: [], width: diagramWidth, height: diagramHeight });
    return diagram;
  }

  function localPlacement(kind, anchorPoint, preferredOffset, maxDistance, clearance) {
    return { kind: kind, anchorPoint: anchorPoint, preferredCenter: add(anchorPoint, preferredOffset), maxDistance: maxDistance || 30, clearance: clearance || 6 };
  }

  function dimensionPlacement(dimension, preferredOffset) {
    return localPlacement("dimension", midpoint(dimension.start, dimension.end), preferredOffset || [0, 0], 30);
  }

  function anglePlacement(angle) {
    const direction = unit(add(angle.fromRay, angle.toRay));
    return {
      kind: "angle",
      anchorPoint: angle.vertex,
      preferredCenter: add(angle.vertex, scale(direction, 80)),
      fromRay: angle.fromRay,
      toRay: angle.toRay,
      minDistance: 24,
      maxDistance: 110,
      fontSize: 14
    };
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
    addShape(diagram, "geometry", diagramKit.polygon({ id: outlineId, points: [rightVertex, angleVertex, apex], role: "shape", strokeWidth: 3 }));
    addShape(diagram, "information", diagramKit.polyline({ id: markerId, points: [add(rightVertex, [0, -18]), add(rightVertex, [18, -18]), add(rightVertex, [18, 0])], role: "marker", strokeWidth: 2 }));
    const angle = diagramKit.angleArc({ id: angleId, vertex: angleVertex, fromRay: rightVertex, toRay: apex, radius: 25, role: "angle", strokeWidth: 2 });
    addShape(diagram, "information", angle);
    const adjacentDimension = diagramKit.dimension({ id: dimensionId, a: rightVertex, b: angleVertex, offset: 22, role: "dimension" });
    addShape(diagram, "information", adjacentDimension);
    label(diagram, id, "angle-label", clean(p.angleDegrees) + "°", angleId, anglePlacement(angle));
    label(diagram, id, "adjacent-label", clean(p.adjacent) + " " + p.unit, dimensionId, dimensionPlacement(adjacentDimension));
    label(diagram, id, "height-label", "h", outlineId, localPlacement("side", midpoint(rightVertex, apex), [-20, 0], 30));
    return diagram.finish();
  }

  function areaTriangleFigure(id, p) {
    const diagram = makeDiagram(id, "Triangel med två sidor och mellanliggande vinkel", "En schematisk triangel där två sidlängder och vinkeln mellan dem är markerade.", 500, 340);
    const radians = p.angleDegrees * Math.PI / 180;
    const pixelsPerUnit = 190 / Math.max(p.sideA, p.sideB);
    const vertex = [220, 275];
    const sideAEnd = add(vertex, [p.sideA * pixelsPerUnit, 0]);
    const sideBEnd = add(vertex, [p.sideB * pixelsPerUnit * Math.cos(radians), -p.sideB * pixelsPerUnit * Math.sin(radians)]);
    const outlineId = id + "-outline";
    const sideAId = id + "-side-a-dimension";
    const sideBId = id + "-side-b-dimension";
    const angleId = id + "-included-angle";
    addShape(diagram, "geometry", diagramKit.polygon({ id: outlineId, points: [vertex, sideAEnd, sideBEnd], role: "shape", strokeWidth: 3 }));
    const sideA = diagramKit.dimension({ id: sideAId, a: vertex, b: sideAEnd, offset: 22, role: "dimension" });
    const sideB = diagramKit.dimension({ id: sideBId, a: vertex, b: sideBEnd, offset: -22, role: "dimension" });
    addShape(diagram, "information", sideA);
    addShape(diagram, "information", sideB);
    const angle = diagramKit.angleArc({ id: angleId, vertex: vertex, fromRay: sideAEnd, toRay: sideBEnd, radius: 27, role: "angle", strokeWidth: 2 });
    addShape(diagram, "information", angle);
    label(diagram, id, "angle-label", clean(p.angleDegrees) + "°", angleId, anglePlacement(angle));
    label(diagram, id, "side-a-label", clean(p.sideA) + " " + p.unit.replace("²", ""), sideAId, dimensionPlacement(sideA));
    label(diagram, id, "side-b-label", clean(p.sideB) + " " + p.unit.replace("²", ""), sideBId, dimensionPlacement(sideB));
    return diagram.finish();
  }

  function parallelFigure(id, p) {
    const diagram = makeDiagram(id, "Triangel med ett parallellt tvärsegment", "I triangeln ligger D på AB och E på AC. Segmentet DE är parallellt med BC.", 680, 430);
    const a = [340, 80]; const b = [80, 350]; const c = [600, 350];
    const ratio = p.ad / (p.ad + p.db);
    const d = interpolate(a, b, ratio); const e = interpolate(a, c, ratio);
    const outlineId = id + "-outline"; const transversalId = id + "-transversal";
    addShape(diagram, "geometry", diagramKit.polygon({ id: outlineId, points: [a, b, c], role: "shape", strokeWidth: 3 }));
    [["point-a", a], ["point-b", b], ["point-c", c], ["point-d", d], ["point-e", e]].forEach(function (entry) {
      addShape(diagram, "information", diagramKit.circle({ id: id + "-" + entry[0], center: entry[1], radius: 2.5, role: "point", strokeWidth: 1.5 }));
    });
    addShape(diagram, "connections", diagramKit.line({ id: transversalId, a: d, b: e, role: "connection", strokeWidth: 3 }));
    const dimensions = [
      ["ad-dimension", a, d, 54, "AD = " + clean(p.ad) + " " + p.unit],
      ["db-dimension", d, b, 54, "DB = " + clean(p.db) + " " + p.unit],
      ["ae-dimension", a, e, -54, "AE = " + clean(p.ae) + " " + p.unit],
      ["ec-dimension", e, c, -54, "EC = ?"]
    ].map(function (entry) {
      const dimension = diagramKit.dimension({ id: id + "-" + entry[0], a: entry[1], b: entry[2], offset: entry[3], extensionGap: 35, role: "dimension" });
      addShape(diagram, "information", dimension);
      return { suffix: entry[0].replace("dimension", "label"), text: entry[4], dimension: dimension };
    });
    const pointLabels = [["A", a, [0, -30]], ["B", b, [-26, 18]], ["C", c, [26, 18]], ["D", d, [-30, 0]], ["E", e, [30, 0]]];
    pointLabels.forEach(function (entry) {
      const placement = localPlacement("vertex", entry[1], entry[2], 32, 12);
      placement.fontSize = 14;
      label(diagram, id, "vertex-" + entry[0].toLowerCase(), entry[0], id + "-point-" + entry[0].toLowerCase(), placement);
    });
    dimensions.forEach(function (entry) {
      label(diagram, id, entry.suffix, entry.text, entry.dimension.id, dimensionPlacement(entry.dimension));
    });
    return diagram.finish();
  }

  function compositeFigure(id, p) {
    const diagram = makeDiagram(id, "L-formad sammansatt fyrhörning", "En schematisk ytterrektangel med en rektangulär urtagning i det övre högra hörnet.", 640, 440);
    const pixelsPerUnit = Math.min(400 / p.outerWidth, 250 / p.outerHeight);
    const outerPixelWidth = p.outerWidth * pixelsPerUnit;
    const outerPixelHeight = p.outerHeight * pixelsPerUnit;
    const left = (640 - outerPixelWidth) / 2; const right = left + outerPixelWidth; const bottom = 330; const top = bottom - outerPixelHeight;
    const cutLeft = right - p.cutWidth * pixelsPerUnit;
    const cutBottom = top + p.cutHeight * pixelsPerUnit;
    const outerTopLeft = [left, top]; const cutTopLeft = [cutLeft, top];
    const cutBottomLeft = [cutLeft, cutBottom]; const cutBottomRight = [right, cutBottom];
    const outerBottomRight = [right, bottom]; const outerBottomLeft = [left, bottom]; const removedTopRight = [right, top];
    const outlineId = id + "-outline";
    addShape(diagram, "geometry", diagramKit.polygon({ id: outlineId, points: [outerTopLeft, cutTopLeft, cutBottomLeft, cutBottomRight, outerBottomRight, outerBottomLeft], role: "shape", strokeWidth: 3 }));
    const dimensions = [
      ["outer-width-dimension", outerBottomLeft, outerBottomRight, 30, clean(p.outerWidth) + " " + p.unit.replace("²", "")],
      ["outer-height-dimension", outerTopLeft, outerBottomLeft, 30, clean(p.outerHeight) + " " + p.unit.replace("²", "")],
      ["cut-width-dimension", cutTopLeft, removedTopRight, 32, clean(p.cutWidth) + " " + p.unit.replace("²", "")],
      ["cut-height-dimension", removedTopRight, cutBottomRight, -44, clean(p.cutHeight) + " " + p.unit.replace("²", "")]
    ];
    const placedDimensions = dimensions.map(function (entry) {
      const dimension = diagramKit.dimension({ id: id + "-" + entry[0], a: entry[1], b: entry[2], offset: entry[3], role: "dimension" });
      addShape(diagram, "information", dimension);
      return { name: entry[0], text: entry[4], dimension: dimension };
    });
    placedDimensions.forEach(function (entry) {
      const preferredOffset = entry.name === "outer-height-dimension" ? [-12, 0] : entry.name === "cut-height-dimension" ? [12, 0] : [0, 0];
      label(diagram, id, entry.name.replace("dimension", "label"), entry.text, entry.dimension.id, dimensionPlacement(entry.dimension, preferredOffset));
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
    addShape(diagram, "geometry", diagramKit.polygon({ id: outlineId, points: [apex, baseLeft, baseRight], role: "shape", strokeWidth: 3 }));
    addShape(diagram, "connections", diagramKit.line({ id: heightId, a: apex, b: baseMidpoint, role: "line", strokeWidth: 2 }));
    addShape(diagram, "information", diagramKit.polyline({ id: markerId, points: [add(baseMidpoint, [0, -16]), add(baseMidpoint, [16, -16]), add(baseMidpoint, [16, 0])], role: "marker", strokeWidth: 2 }));
    const baseDimension = diagramKit.dimension({ id: id + "-base-dimension", a: baseLeft, b: baseRight, offset: 18, role: "dimension" });
    const leftDimension = diagramKit.dimension({ id: id + "-equal-left-dimension", a: apex, b: baseLeft, offset: 13, role: "dimension" });
    const rightDimension = diagramKit.dimension({ id: id + "-equal-right-dimension", a: apex, b: baseRight, offset: -13, role: "dimension" });
    addShape(diagram, "information", baseDimension); addShape(diagram, "information", leftDimension); addShape(diagram, "information", rightDimension);
    label(diagram, id, "base-label", clean(p.base) + " " + p.unit, baseDimension.id, dimensionPlacement(baseDimension));
    label(diagram, id, "equal-left-label", clean(p.equalSide) + " " + p.unit, leftDimension.id, dimensionPlacement(leftDimension));
    label(diagram, id, "equal-right-label", clean(p.equalSide) + " " + p.unit, rightDimension.id, dimensionPlacement(rightDimension));
    label(diagram, id, "height-label", "h", heightId, localPlacement("height", midpoint(apex, baseMidpoint), [12, 0], 30));
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
