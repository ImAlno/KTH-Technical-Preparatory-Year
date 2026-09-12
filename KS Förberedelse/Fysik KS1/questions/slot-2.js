(function (root, factory) {
  const diagramKit = typeof module === "object" && module.exports
    ? require("../../assets/js/diagram-kit.js")
    : root && root.KS && root.KS.diagram;
  const bank = factory(diagramKit);
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[2] = bank;
  }
})(typeof window !== "undefined" ? window : null, function (diagramKit) {
  "use strict";

  if (!diagramKit || typeof diagramKit.create !== "function" || typeof diagramKit.validateManifest !== "function") {
    throw new Error("diagram-kit dependency is required before constructing physics slot 2");
  }

  const SKILL = "density-and-geometric-bodies";
  const HEXAGON_FACTOR = 3 * Math.sqrt(3) / 2;
  const FAMILY_ROWS = [
    ["cylinder", [
      { unknown: "mass", scenario: "Kylstaven Bris", object: "en massiv cylindrisk kylstav", givens: { densityKgM3: 2700, radiusM: 0.036, heightM: 0.12 }, displayUnits: { density: "kg/m3", radius: "cm", height: "cm" }, targetUnit: "g" },
      { unknown: "density", scenario: "Valsen Cello", object: "en homogen cylindrisk vals", givens: { massKg: 2.75, radiusM: 0.025, heightM: 0.18 }, displayUnits: { mass: "kg", radius: "mm", height: "cm" }, targetUnit: "kg/m3" },
      { unknown: "radius", scenario: "Bussningen Glänta", object: "en massiv cylindrisk bussning", givens: { massKg: 0.84, densityKgM3: 8400, heightM: 0.070 }, displayUnits: { mass: "g", density: "g/cm3", height: "mm" }, targetUnit: "mm" },
      { unknown: "height", scenario: "Polymercylindern Lin", object: "ett cylindriskt polymerprov", givens: { massKg: 1.24, densityKgM3: 1180, radiusM: 0.045 }, displayUnits: { mass: "kg", density: "kg/m3", radius: "cm" }, targetUnit: "cm" },
      { unknown: "volume", scenario: "Mässingsformen Ormbunke", object: "en cylindrisk gjutform", givens: { radiusM: 0.032, heightM: 0.14 }, displayUnits: { radius: "mm", height: "cm" }, targetUnit: "cm3" }
    ]],
    ["cone", [
      { unknown: "density", scenario: "Scenkonen Pil", object: "en massiv konformad scenrekvisita", givens: { massKg: 0.327, radiusM: 0.028, heightM: 0.090 }, displayUnits: { mass: "g", radius: "cm", height: "cm" }, targetUnit: "kg/m3" },
      { unknown: "radius", scenario: "Lodkonen Kvarts", object: "ett homogent koniskt lod", givens: { massKg: 0.52, densityKgM3: 2700, heightM: 0.11 }, displayUnits: { mass: "g", density: "g/cm3", height: "cm" }, targetUnit: "cm" },
      { unknown: "height", scenario: "Bronskonen Riff", object: "en massiv kon av bronslegering", givens: { massKg: 0.76, densityKgM3: 8900, radiusM: 0.027 }, displayUnits: { mass: "g", density: "kg/m3", radius: "mm" }, targetUnit: "mm" },
      { unknown: "volume", scenario: "Signalkonen Salvia", object: "en idealiserad massiv kon", givens: { radiusM: 0.045, heightM: 0.13 }, displayUnits: { radius: "cm", height: "cm" }, targetUnit: "cm3" },
      { unknown: "mass", scenario: "Stenkonen Tussilago", object: "en konformad stenmodell", givens: { densityKgM3: 2400, radiusM: 0.038, heightM: 0.16 }, displayUnits: { density: "g/cm3", radius: "mm", height: "cm" }, targetUnit: "g" }
    ]],
    ["sphere", [
      { unknown: "radius", scenario: "Ventilkulan Umbra", object: "en massiv sfärisk ventilkula", givens: { massKg: 0.62, densityKgM3: 8050 }, displayUnits: { mass: "g", density: "kg/m3" }, targetUnit: "mm" },
      { unknown: "diameter", diameterDefinition: "sphere-height", scenario: "Flytkroppen Vinga", object: "en homogen sfärisk flytkropp", givens: { massKg: 1.15, densityKgM3: 4500 }, displayUnits: { mass: "kg", density: "g/cm3" }, targetUnit: "cm" },
      { unknown: "volume", scenario: "Sfärformen Alun", object: "en sfärisk form med radien angiven", givens: { radiusM: 0.042 }, displayUnits: { radius: "mm" }, targetUnit: "cm3" },
      { unknown: "mass", scenario: "Motvikten Björk", object: "en sfärisk motvikt", givens: { densityKgM3: 11300, radiusM: 0.021 }, displayUnits: { density: "g/cm3", radius: "cm" }, targetUnit: "g" },
      { unknown: "density", scenario: "Provkulan Cikoria", object: "en homogen provkula", givens: { massKg: 0.53, radiusM: 0.031 }, displayUnits: { mass: "g", radius: "mm" }, targetUnit: "g/cm3" }
    ]],
    ["prism", [
      { unknown: "height", scenario: "Korkblocket Dis", object: "ett rätblock av pressad kork", baseShape: "rectangle", givens: { massKg: 3.2, densityKgM3: 720, lengthM: 0.18, widthM: 0.12 }, displayUnits: { mass: "kg", density: "kg/m3", length: "cm", width: "cm" }, targetUnit: "cm" },
      { unknown: "volume", scenario: "Mätblocket En", object: "ett rätblock", baseShape: "rectangle", givens: { lengthM: 0.12, widthM: 0.080, heightM: 0.055 }, displayUnits: { length: "cm", width: "mm", height: "cm" }, targetUnit: "cm3" },
      { unknown: "mass", scenario: "Skumprismat Fenix", object: "ett homogent rätblock av skummaterial", baseShape: "rectangle", givens: { densityKgM3: 1350, lengthM: 0.24, widthM: 0.090, heightM: 0.045 }, displayUnits: { density: "g/cm3", length: "cm", width: "cm", height: "mm" }, targetUnit: "kg" },
      { unknown: "density", scenario: "Stenprismat Granit", object: "ett homogent rätblock", baseShape: "rectangle", givens: { massKg: 2.7, lengthM: 0.16, widthM: 0.11, heightM: 0.075 }, displayUnits: { mass: "kg", length: "cm", width: "cm", height: "mm" }, targetUnit: "kg/m3" },
      { unknown: "radius", radiusDefinition: "circumradius-center-to-vertex", scenario: "Hexprismat Hjortron", object: "ett regelbundet sexkantigt prisma", baseShape: "regular-hexagon", givens: { massKg: 1.6, densityKgM3: 7800, heightM: 0.060 }, displayUnits: { mass: "kg", density: "g/cm3", height: "mm" }, targetUnit: "mm" }
    ]],
    ["liquid-column", [
      { unknown: "volume", scenario: "Regnkolonnen Is", object: "en vätskekolonn i ett cylindriskt kärl", givens: { radiusM: 0.035, heightM: 0.22 }, displayUnits: { radius: "cm", height: "cm" }, targetUnit: "dm3" },
      { unknown: "mass", scenario: "Vattenkärlet Järpe", object: "en vattenkolonn i ett cylindriskt kärl", givens: { densityKgM3: 998, radiusM: 0.055, heightM: 0.18 }, displayUnits: { density: "kg/m3", radius: "cm", height: "mm" }, targetUnit: "kg" },
      { unknown: "density", scenario: "Sirapsprovet Klöver", object: "en vätskekolonn med okänd densitet", givens: { massKg: 0.91, radiusM: 0.040, heightM: 0.12 }, displayUnits: { mass: "g", radius: "mm", height: "cm" }, targetUnit: "g/cm3" },
      { unknown: "radius", scenario: "Glycerinkärlet Lyra", object: "en vätskekolonn i ett smalt cylindriskt kärl", givens: { massKg: 1.25, densityKgM3: 1260, heightM: 0.24 }, displayUnits: { mass: "kg", density: "g/cm3", height: "cm" }, targetUnit: "cm" },
      { unknown: "height", scenario: "Oljekärlet Måra", object: "en oljekolonn i ett cylindriskt kärl", givens: { massKg: 0.74, densityKgM3: 920, radiusM: 0.030 }, displayUnits: { mass: "g", density: "kg/m3", radius: "mm" }, targetUnit: "cm" }
    ]]
  ];

  const UNIT_FACTORS = { kg: 1, g: 1e-3, m: 1, cm: 1e-2, mm: 1e-3, m3: 1, dm3: 1e-3, cm3: 1e-6, "kg/m3": 1, "g/cm3": 1000 };
  const UNIT_LABELS = { kg: "kg", g: "g", m: "m", cm: "cm", mm: "mm", m3: "m³", dm3: "dm³", cm3: "cm³", "kg/m3": "kg/m³", "g/cm3": "g/cm³" };
  const QUANTITY_NAMES = { mass: "massan", density: "densiteten", radius: "radien", diameter: "diametern (sfärens höjd)", height: "höjden", volume: "volymen" };

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

  function canonicalUnit(unknown) {
    return { mass: "kg", density: "kg/m3", radius: "m", diameter: "m", height: "m", volume: "m3" }[unknown];
  }

  function toDisplay(value, unit) {
    return value / UNIT_FACTORS[unit];
  }

  function displayed(value, unit) {
    const converted = toDisplay(value, unit);
    const decimals = Math.abs(converted) >= 100 ? 0 : Math.abs(converted) >= 10 ? 1 : 3;
    return String(Number(converted.toFixed(decimals))).replace(".", ",") + " " + UNIT_LABELS[unit];
  }

  function volume(family, row) {
    const p = row.givens;
    if (family === "cylinder" || family === "liquid-column") return Math.PI * p.radiusM * p.radiusM * p.heightM;
    if (family === "cone") return Math.PI * p.radiusM * p.radiusM * p.heightM / 3;
    if (family === "sphere") return 4 * Math.PI * Math.pow(p.radiusM, 3) / 3;
    if (row.baseShape === "regular-hexagon") return HEXAGON_FACTOR * p.radiusM * p.radiusM * p.heightM;
    return p.lengthM * p.widthM * p.heightM;
  }

  function answerSI(family, row) {
    const p = row.givens;
    const matterVolume = p.massKg / p.densityKgM3;
    if (row.unknown === "mass") return p.densityKgM3 * volume(family, row);
    if (row.unknown === "density") return p.massKg / volume(family, row);
    if (row.unknown === "volume") return volume(family, row);
    if (row.unknown === "radius") {
      if (family === "cone") return Math.sqrt(3 * matterVolume / (Math.PI * p.heightM));
      if (family === "sphere") return Math.pow(3 * matterVolume / (4 * Math.PI), 1 / 3);
      if (family === "prism") return Math.sqrt(matterVolume / (HEXAGON_FACTOR * p.heightM));
      return Math.sqrt(matterVolume / (Math.PI * p.heightM));
    }
    if (row.unknown === "diameter" && family === "sphere") return 2 * Math.pow(3 * matterVolume / (4 * Math.PI), 1 / 3);
    if (row.unknown === "height" && family === "cone") return 3 * matterVolume / (Math.PI * p.radiusM * p.radiusM);
    if (row.unknown === "height" && family === "prism") return matterVolume / (p.lengthM * p.widthM);
    if (row.unknown === "height") return matterVolume / (Math.PI * p.radiusM * p.radiusM);
    throw new Error("Okänd sökt storhet: " + row.unknown);
  }

  function geometryFormula(family, row) {
    if (family === "cone") return "V = πr²h/3";
    if (family === "sphere") return "V = 4πr³/3";
    if (family === "prism" && row.baseShape === "regular-hexagon") return "V = (3√3/2)r²h";
    if (family === "prism") return "V = lbh";
    return "V = πr²h";
  }

  function givensText(row) {
    const p = row.givens;
    const units = row.displayUnits;
    const values = [];
    if (p.massKg !== undefined) values.push("massa " + displayed(p.massKg, units.mass));
    if (p.densityKgM3 !== undefined) values.push("densitet " + displayed(p.densityKgM3, units.density));
    if (p.radiusM !== undefined) values.push("radie " + displayed(p.radiusM, units.radius));
    if (p.heightM !== undefined) values.push("höjd " + displayed(p.heightM, units.height));
    if (p.lengthM !== undefined) values.push("längd " + displayed(p.lengthM, units.length));
    if (p.widthM !== undefined) values.push("bredd " + displayed(p.widthM, units.width));
    return values.join(", ");
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

  function dimensionText(row, key, symbol) {
    if (row.givens[key] === undefined) return row.unknown === key.replace("M", "") ? symbol + " = ?" : symbol;
    const unitKey = key.replace("M", "");
    return symbol + " = " + displayed(row.givens[key], row.displayUnits[unitKey]);
  }

  function bodyFigure(id, family, row) {
    const diagram = diagramKit.create({
      id: id + "-diagram",
      title: row.scenario + ": geometrisk modell",
      description: "Schematisk modell av " + row.object + ". Angivna data: " + givensText(row) + ". Måtten kan inte avläsas ur figuren.",
      purpose: "prompt",
      width: 620,
      height: 390
    });
    const shapes = [];
    const dimensionSpecs = [];
    const sourcePoints = [];
    function remember(points) { points.forEach(function (point) { sourcePoints.push(point.slice()); }); }
    function addDimension(name, a, b, offset, text) {
      const dimension = addShape(diagram, shapes, "information", diagramKit.dimension({ id: id + "-" + name, a: a, b: b, offset: offset, role: "dimension", strokeWidth: 1.5 }));
      dimensionSpecs.push({ id: dimension.id, a: a.slice(), b: b.slice() });
      remember([a, b]);
      return { dimension: dimension, text: text };
    }
    let solid;
    const dimensions = [];
    if (family === "sphere") {
      const center = [280, 165];
      const radius = 82;
      solid = addShape(diagram, shapes, "geometry", diagramKit.circle({ id: id + "-sphere-body", center: center, radius: radius, role: "body", strokeWidth: 2.5 }));
      const diameter = addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-diameter", a: [center[0] - radius, center[1]], b: [center[0] + radius, center[1]], role: "measure", strokeWidth: 2 }));
      remember([diameter.a, diameter.b, center]);
      if (row.unknown === "diameter") {
        dimensions.push(addDimension("diameter-dimension", diameter.a, diameter.b, -108, "d = ?"));
      } else {
        const radiusLine = addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-radius", a: center, b: diameter.b, role: "measure", strokeWidth: 2 }));
        dimensions.push(addDimension("radius-dimension", radiusLine.a, radiusLine.b, -108, dimensionText(row, "radiusM", "r")));
      }
    } else if (family === "cone") {
      const apex = [285, 48]; const left = [205, 250]; const right = [365, 250]; const baseCenter = [285, 250];
      solid = addShape(diagram, shapes, "geometry", diagramKit.polygon({ id: id + "-solid", points: [apex, left, right], role: "body", strokeWidth: 2.5 }));
      remember([apex, left, right, baseCenter]);
      dimensions.push(addDimension("height-dimension", apex, baseCenter, 112, dimensionText(row, "heightM", "h")));
      dimensions.push(addDimension("radius-dimension", baseCenter, right, 34, dimensionText(row, "radiusM", "r")));
    } else if (family === "prism" && row.baseShape === "regular-hexagon") {
      const center = [250, 175]; const radius = 65; const extrusion = [82, -58];
      const face = Array.from({ length: 6 }, function (_, index) {
        const angle = index * Math.PI / 3;
        return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
      });
      const backFace = face.map(function (point) { return [point[0] + extrusion[0], point[1] + extrusion[1]]; });
      solid = addShape(diagram, shapes, "geometry", diagramKit.polygon({ id: id + "-hex-face", points: face, role: "body", strokeWidth: 2.5 }));
      addShape(diagram, shapes, "geometry", diagramKit.polygon({ id: id + "-hex-back-face", points: backFace, role: "body", strokeWidth: 2 }));
      [0, 1, 5].forEach(function (index) {
        addShape(diagram, shapes, "connections", diagramKit.line({ id: id + "-hex-edge-" + index, a: face[index], b: backFace[index], role: "connection", strokeWidth: 2 }));
      });
      remember(face.concat(backFace, [center]));
      addShape(diagram, shapes, "information", diagramKit.line({ id: id + "-circumradius", a: center, b: face[0], role: "measure", strokeWidth: 2 }));
      dimensions.push(addDimension("height-dimension", face[1], backFace[1], 80, dimensionText(row, "heightM", "h")));
    } else if (family === "prism") {
      const topLeft = [190, 80]; const topRight = [380, 80]; const bottomRight = [380, 250]; const bottomLeft = [190, 250];
      solid = addShape(diagram, shapes, "geometry", diagramKit.polygon({ id: id + "-solid", points: [topLeft, topRight, bottomRight, bottomLeft], role: "body", strokeWidth: 2.5 }));
      remember([topLeft, topRight, bottomRight, bottomLeft]);
      dimensions.push(addDimension("length-dimension", bottomLeft, bottomRight, 38, dimensionText(row, "lengthM", "l")));
      dimensions.push(addDimension("height-dimension", topLeft, bottomLeft, 48, dimensionText(row, "heightM", "h")));
      dimensions.push(addDimension("width-dimension", topLeft, topRight, -38, dimensionText(row, "widthM", "b")));
    } else {
      const topLeft = [210, 72]; const topRight = [360, 72]; const bottomRight = [360, 250]; const bottomLeft = [210, 250]; const topCenter = [285, 72];
      solid = addShape(diagram, shapes, "geometry", diagramKit.rect({ id: id + "-solid", x: topLeft[0], y: topLeft[1], width: topRight[0] - topLeft[0], height: bottomLeft[1] - topLeft[1], role: "body", strokeWidth: 2.5, rx: family === "liquid-column" ? 3 : 0 }));
      remember([topLeft, topRight, bottomRight, bottomLeft, topCenter]);
      dimensions.push(addDimension("height-dimension", topLeft, bottomLeft, 54, dimensionText(row, "heightM", "h")));
      dimensions.push(addDimension("radius-dimension", topCenter, topRight, -38, dimensionText(row, "radiusM", "r")));
    }
    dimensions.forEach(function (entry) {
      const midpoint = [(entry.dimension.start[0] + entry.dimension.end[0]) / 2, (entry.dimension.start[1] + entry.dimension.end[1]) / 2];
      addLabel(diagram, shapes, { id: entry.dimension.id + "-label", at: [midpoint[0], midpoint[1] + 5], text: entry.text, anchorId: entry.dimension.id, fontSize: 13, textAnchor: "middle" });
    });
    if (family === "prism" && row.baseShape === "regular-hexagon") {
      addLabel(diagram, shapes, { id: id + "-circumradius-label", at: [250, 175], text: "r = ?", anchorId: id + "-circumradius", fontSize: 13, textAnchor: "middle" });
    }
    if (row.givens.massKg !== undefined) addLabel(diagram, shapes, { id: id + "-mass-label", at: [590, 105], text: "m = " + displayed(row.givens.massKg, row.displayUnits.mass), anchorId: solid.id, textAnchor: "end", fontSize: 13 });
    if (row.givens.densityKgM3 !== undefined) addLabel(diagram, shapes, { id: id + "-density-label", at: [590, 142], text: "ρ = " + displayed(row.givens.densityKgM3, row.displayUnits.density), anchorId: solid.id, textAnchor: "end", fontSize: 13 });
    const result = diagram.finish();
    return { html: result.html, manifest: result.manifest, geometry: { dimensions: dimensionSpecs, sourcePoints: sourcePoints } };
  }

  function solutionText(family, row, exactSI, expected, figures) {
    const siUnit = canonicalUnit(row.unknown);
    const formula = geometryFormula(family, row);
    let rearrangement;
    if (row.unknown === "mass") rearrangement = "m = ρV";
    else if (row.unknown === "density") rearrangement = "ρ = m/V";
    else if (row.unknown === "volume") rearrangement = formula;
    else if (row.unknown === "radius" && family === "sphere") rearrangement = "r = ∛(3m/(4πρ))";
    else if (row.unknown === "radius" && family === "cone") rearrangement = "r = √(3m/(πρh))";
    else if (row.unknown === "radius" && family === "prism") rearrangement = "r = √(m/(ρ(3√3/2)h))";
    else if (row.unknown === "radius") rearrangement = "r = √(m/(ρπh))";
    else if (row.unknown === "diameter" && family === "sphere") rearrangement = "d = 2∛(3m/(4πρ))";
    else if (family === "cone") rearrangement = "h = 3m/(ρπr²)";
    else if (family === "prism") rearrangement = "h = m/(ρlb)";
    else rearrangement = "h = m/(ρπr²)";
    const definition = row.unknown === "diameter"
      ? " Sfärens höjd är diametern d = 2r."
      : row.radiusDefinition === "circumradius-center-to-vertex"
        ? " I formeln är r den omskrivna cirkelns radie, mätt från centrum till hörn."
        : "";
    return "<p><strong>Samband:</strong> densitet definieras som ρ = m/V och kroppens volym ges av " + formula + "." + definition + " Alla givna mått omvandlas först till SI.</p><p>För den sökta storheten fås <strong>" + rearrangement + "</strong>. Insättning ger " + formatSignificant(exactSI, 6) + " " + UNIT_LABELS[siUnit] + ".</p><p>Omräknat till begärd enhet och avrundat till " + figures + " värdesiffror blir svaret <strong>" + formatSignificant(expected, figures) + " " + UNIT_LABELS[row.targetUnit] + "</strong>.</p>";
  }

  function geometryWorkOnPaper(family, row) {
    const shape = family === "cylinder"
      ? "cylinderns volymformel V = πr²h"
      : family === "cone"
        ? "konens volymformel V = πr²h/3"
        : family === "sphere"
          ? "sfärens volymformel V = 4πr³/3"
          : family === "prism" && row.baseShape === "regular-hexagon"
            ? "den regelbundna sexkantens basarea och volymformel V = (3√3/2)r²h"
            : family === "prism"
              ? "prismats volymformel V = lbh"
              : "vätskepelarens cylindriska volymformel V = πr²h";
    return {
      title: "Arbeta i räknehäftet",
      instruction: "Arbeta i räknehäftet: skriv om alla givna mått till SI-enheter, välj " + shape + ", och lös ut den sökta storheten stegvis. Kontrollera dimensionerna och avrundningen. Endast slutsvaret skrivs in digitalt; alla enhetsbyten, geometri och beräkningar görs i räknehäftet.",
      comparison: "Jämför SI-omvandlingar, vald volymformel, geometrisk definition, algebraisk omskrivning, enhet och tre värdesiffror med lösningen."
    };
  }

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s2-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const exactSI = answerSI(family, row);
    const exactTarget = exactSI / UNIT_FACTORS[row.targetUnit];
    const expected = roundSignificant(exactTarget, figures);
    const requestedUnitLabel = UNIT_LABELS[row.targetUnit];
    const figure = bodyFigure(id, family, row);
    const quantityPrompt = row.radiusDefinition === "circumradius-center-to-vertex"
      ? "den omskrivna cirkelns radie från sexkantens centrum till ett hörn"
      : QUANTITY_NAMES[row.unknown];
    const answerLabel = row.unknown === "diameter" ? "Diameter" : "Svar";
    return {
      id: id,
      slot: 2,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + row.object.charAt(0).toUpperCase() + row.object.slice(1) + " har " + givensText(row) + ". Bestäm " + quantityPrompt + ". Använd den idealiserade geometrin i figuren.</p>" + figure.html + "<p><small>Figuren är schematisk och inte skalenlig; använd enbart de utskrivna måtten.</small></p><p>Svara i " + requestedUnitLabel + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: answerLabel + " (" + requestedUnitLabel + "; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: row.targetUnit, tolerance: tolerance(expected, figures), help: "Ange ett tal i den begärda enheten." }],
      workOnPaper: geometryWorkOnPaper(family, row),
      solutionHtml: solutionText(family, row, exactSI, expected, figures),
      rubric: [
        { points: 1, text: "Rätt densitets- och volymsamband väljs och samtliga längder/massor omvandlas dimensionsriktigt till SI." },
        { points: 1, text: "Den sökta storheten löses ut och slutsvaret har rätt enhet samt tre värdesiffror." }
      ],
      sourceData: {
        skill: SKILL,
        family: family,
        caseNumber: familyIndex * 5 + rowIndex + 1,
        unknown: row.unknown,
        diameterDefinition: row.diameterDefinition || null,
        radiusDefinition: row.radiusDefinition || null,
        baseShape: row.baseShape || null,
        givens: Object.assign({}, row.givens),
        displayUnits: Object.assign({}, row.displayUnits),
        significantFigures: figures,
        targetUnit: row.targetUnit,
        requestedUnitLabel: requestedUnitLabel,
        scenario: row.scenario,
        diagram: figure.manifest,
        diagramGeometry: figure.geometry
      }
    };
  }

  return FAMILY_ROWS.reduce(function (questions, entry, familyIndex) {
    return questions.concat(entry[1].map(function (row, rowIndex) { return makeQuestion(entry[0], row, familyIndex, rowIndex); }));
  }, []);
});
