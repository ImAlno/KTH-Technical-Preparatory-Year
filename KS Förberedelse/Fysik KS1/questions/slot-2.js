(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[2] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

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

  function bodySvg(id, family, row) {
    const label = givensText(row);
    let shape;
    if (family === "sphere") shape = '<circle data-role="sphere-body" cx="260" cy="92" r="55" fill="#dbeafe" stroke="#1d1d1f"/><path d="M205 92 Q260 122 315 92" fill="none" stroke="#6e6e73" stroke-dasharray="5 5"/>' + (row.unknown === "diameter" ? '<line data-role="diameter" x1="205" y1="92" x2="315" y2="92" stroke="#0071e3" stroke-width="3"/><text data-role="diameter-label" x="260" y="82" text-anchor="middle">d</text>' : "");
    else if (family === "cone") shape = '<ellipse cx="260" cy="145" rx="70" ry="18" fill="#dbeafe" stroke="#1d1d1f"/><path d="M190 145 L260 30 L330 145" fill="#dbeafe" stroke="#1d1d1f"/>';
    else if (family === "prism" && row.baseShape === "regular-hexagon") shape = '<path data-role="hex-prism-outline" d="M205 70 L240 48 L285 58 L315 95 L280 118 L235 108 Z M235 108 L235 158 M280 118 L280 168 M315 95 L315 145 M235 158 L280 168 L315 145" fill="#dbeafe" stroke="#1d1d1f"/><line data-role="circumradius" x1="260" y1="83" x2="315" y2="95" stroke="#0071e3" stroke-width="3"/><text data-role="circumradius-label" x="286" y="82">r</text>';
    else if (family === "prism") shape = '<path d="M180 75 L310 75 L350 45 L220 45 Z M180 75 L180 155 L310 155 L310 75 M310 155 L350 125 L350 45" fill="#dbeafe" stroke="#1d1d1f"/>';
    else shape = '<ellipse cx="260" cy="45" rx="65" ry="17" fill="#dbeafe" stroke="#1d1d1f"/><path d="M195 45 L195 145 Q260 178 325 145 L325 45" fill="#dbeafe" stroke="#1d1d1f"/><ellipse cx="260" cy="145" rx="65" ry="17" fill="none" stroke="#1d1d1f"/>';
    return '<svg viewBox="0 0 520 245" role="img" aria-labelledby="' + id + "-svg-title " + id + '-svg-desc"><title id="' + id + '-svg-title">' + row.scenario + ": geometrisk modell</title><desc id=\"" + id + '-svg-desc">Schematisk modell av ' + row.object + ". Angivna data: " + label + '. Måtten kan inte avläsas ur figuren.</desc>' + shape + '<text x="260" y="205" text-anchor="middle">' + label + '</text><text x="260" y="229" text-anchor="middle">Schematisk och inte skalenlig</text></svg>';
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

  function makeQuestion(family, row, familyIndex, rowIndex) {
    const id = "physics-s2-" + family + "-" + String(rowIndex + 1).padStart(2, "0");
    const figures = 3;
    const exactSI = answerSI(family, row);
    const exactTarget = exactSI / UNIT_FACTORS[row.targetUnit];
    const expected = roundSignificant(exactTarget, figures);
    const requestedUnitLabel = UNIT_LABELS[row.targetUnit];
    const quantityPrompt = row.radiusDefinition === "circumradius-center-to-vertex"
      ? "den omskrivna cirkelns radie från sexkantens centrum till ett hörn"
      : QUANTITY_NAMES[row.unknown];
    const answerLabel = row.unknown === "diameter" ? "Diameter" : "Svar";
    return {
      id: id,
      slot: 2,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + row.object.charAt(0).toUpperCase() + row.object.slice(1) + " har " + givensText(row) + ". Bestäm " + quantityPrompt + ". Använd den idealiserade geometrin i figuren.</p>" + bodySvg(id, family, row) + "<p><small>Figuren är schematisk och inte skalenlig; använd enbart de utskrivna måtten.</small></p><p>Svara i " + requestedUnitLabel + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: answerLabel + " (" + requestedUnitLabel + "; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: row.targetUnit, tolerance: tolerance(expected, figures), help: "Ange ett tal i den begärda enheten." }],
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
        scenario: row.scenario
      }
    };
  }

  return FAMILY_ROWS.reduce(function (questions, entry, familyIndex) {
    return questions.concat(entry[1].map(function (row, rowIndex) { return makeQuestion(entry[0], row, familyIndex, rowIndex); }));
  }, []);
});
