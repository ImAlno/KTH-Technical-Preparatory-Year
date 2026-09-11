(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_MATH_SLOTS = root.KS_MATH_SLOTS || {};
    root.KS_MATH_SLOTS[5] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

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

  function svgShell(id, title, description, body) {
    return '<svg class="question-figure" viewBox="0 0 360 220" role="img" aria-labelledby="' + id + '-title ' + id + '-desc">' +
      '<title id="' + id + '-title">' + title + '</title>' +
      '<desc id="' + id + '-desc">' + description + '</desc>' + body + '</svg>';
  }

  function rightTriangleFigure(id, p) {
    return svgShell(id, "Rätvinklig triangel med markerad vinkel", "En schematisk rätvinklig triangel där den närliggande kateten och en spetsig vinkel är kända.",
      '<path d="M55 180 L305 180 L55 45 Z" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M55 160 L75 160 L75 180" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M270 180 A35 35 0 0 0 276 163" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<text x="245" y="164" font-size="15">' + clean(p.angleDegrees) + '°</text>' +
      '<text x="145" y="204" font-size="15">' + clean(p.adjacent) + ' ' + p.unit + '</text>' +
      '<text x="24" y="112" font-size="16">h</text>');
  }

  function areaTriangleFigure(id, p) {
    return svgShell(id, "Triangel med två sidor och mellanliggande vinkel", "En schematisk triangel där två sidlängder och vinkeln mellan dem är markerade.",
      '<path d="M55 180 L315 180 L142 45 Z" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M86 180 A31 31 0 0 1 75 155" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<text x="85" y="156" font-size="15">' + clean(p.angleDegrees) + '°</text>' +
      '<text x="80" y="105" font-size="15">' + clean(p.sideA) + ' ' + p.unit.replace("²", "") + '</text>' +
      '<text x="185" y="204" font-size="15">' + clean(p.sideB) + ' ' + p.unit.replace("²", "") + '</text>');
  }

  function parallelFigure(id, p) {
    return svgShell(id, "Triangel med ett parallellt tvärsegment", "I triangeln ligger D på AB och E på AC. Segmentet DE är parallellt med BC.",
      '<path d="M180 28 L42 190 L330 190 Z" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M112 108 L252 108" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<text x="175" y="22" font-size="15">A</text><text x="27" y="207" font-size="15">B</text><text x="334" y="207" font-size="15">C</text>' +
      '<text x="94" y="109" font-size="15">D</text><text x="257" y="109" font-size="15">E</text>' +
      '<text x="125" y="67" font-size="13">AD = ' + clean(p.ad) + ' ' + p.unit + '</text>' +
      '<text x="62" y="151" font-size="13">DB = ' + clean(p.db) + ' ' + p.unit + '</text>' +
      '<text x="213" y="67" font-size="13">AE = ' + clean(p.ae) + ' ' + p.unit + '</text>' +
      '<text x="268" y="151" font-size="14">EC = ?</text>');
  }

  function compositeFigure(id, p) {
    return svgShell(id, "L-formad sammansatt fyrhörning", "En schematisk ytterrektangel med en rektangulär urtagning i det övre högra hörnet.",
      '<path d="M45 32 H225 V112 H315 V190 H45 Z" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M225 32 H315 V112" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="6 5"/>' +
      '<text x="145" y="211" font-size="14">' + clean(p.outerWidth) + ' ' + p.unit.replace("²", "") + '</text>' +
      '<text x="6" y="116" font-size="14">' + clean(p.outerHeight) + ' ' + p.unit.replace("²", "") + '</text>' +
      '<text x="242" y="24" font-size="13">' + clean(p.cutWidth) + ' ' + p.unit.replace("²", "") + '</text>' +
      '<text x="319" y="78" font-size="13">' + clean(p.cutHeight) + ' ' + p.unit.replace("²", "") + '</text>');
  }

  function symmetricFigure(id, p) {
    return svgShell(id, "Likbent triangulär konstruktion", "En schematisk likbent triangel med höjden dragen från toppen till basens mittpunkt.",
      '<path d="M180 30 L42 190 L318 190 Z" fill="none" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M180 30 V190" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="7 5"/>' +
      '<path d="M180 173 H197 V190" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<text x="89" y="104" font-size="14">' + clean(p.equalSide) + ' ' + p.unit + '</text>' +
      '<text x="235" y="104" font-size="14">' + clean(p.equalSide) + ' ' + p.unit + '</text>' +
      '<text x="145" y="211" font-size="14">' + clean(p.base) + ' ' + p.unit + '</text><text x="186" y="112" font-size="16">h</text>');
  }

  function presentation(family, p, id) {
    const rounding = "Avrunda svaret till " + roundingText(p.decimals) + " och ange det i " + p.unit + ".";
    if (family === "right-triangle") return {
      prompt: "En mättriangel har en känd katet intill vinkeln " + clean(p.angleDegrees) + "°. Kateten är " + clean(p.adjacent) + " " + p.unit + ". Bestäm den motstående kateten <var>h</var>. " + rounding,
      figure: rightTriangleFigure(id, p),
      relation: "I en rätvinklig triangel gäller tan(v) = motstående katet/närliggande katet.",
      calculation: "h = " + clean(p.adjacent) + " · tan(" + clean(p.angleDegrees) + "°)"
    };
    if (family === "non-right-triangle-area") return {
      prompt: "En triangulär skiva har två sidor som är " + clean(p.sideA) + " och " + clean(p.sideB) + " " + p.unit.replace("²", "") + ". Vinkeln mellan sidorna är " + clean(p.angleDegrees) + "°. Bestäm skivans area. " + rounding,
      figure: areaTriangleFigure(id, p),
      relation: "För två sidor och deras mellanliggande vinkel gäller A = ab · sin(v)/2.",
      calculation: "A = " + clean(p.sideA) + " · " + clean(p.sideB) + " · sin(" + clean(p.angleDegrees) + "°)/2"
    };
    if (family === "parallel-transversal") return {
      prompt: "I triangeln ligger D på sidan AB och E på sidan AC, med DE parallell med BC. Längderna är AD = " + clean(p.ad) + " " + p.unit + ", DB = " + clean(p.db) + " " + p.unit + " och AE = " + clean(p.ae) + " " + p.unit + ". Bestäm EC. " + rounding,
      figure: parallelFigure(id, p),
      relation: "Eftersom DE ∥ BC är trianglarna ADE och ABC likformiga. Delarna på de två sidorna är därför proportionella: EC/AE = DB/AD.",
      calculation: "EC = AE · DB/AD = " + clean(p.ae) + " · " + clean(p.db) + "/" + clean(p.ad)
    };
    if (family === "composite-quadrilateral") return {
      prompt: "En L-formad platta kan ses som en rektangel med bredd " + clean(p.outerWidth) + " och höjden " + clean(p.outerHeight) + " " + p.unit.replace("²", "") + ", där ett rektangulärt hörn på " + clean(p.cutWidth) + " × " + clean(p.cutHeight) + " " + p.unit.replace("²", "") + " har tagits bort. Bestäm plattans area. " + rounding,
      figure: compositeFigure(id, p),
      relation: "Arean av den sammansatta fyrhörningen är ytterrektangelns area minus urtagningens area.",
      calculation: "A = " + clean(p.outerWidth) + " · " + clean(p.outerHeight) + " − " + clean(p.cutWidth) + " · " + clean(p.cutHeight)
    };
    return {
      prompt: "En symmetrisk triangulär ram har basen " + clean(p.base) + " " + p.unit + " och två lika långa sidor på " + clean(p.equalSide) + " " + p.unit + ". Bestäm ramens vinkelräta höjd <var>h</var>. " + rounding,
      figure: symmetricFigure(id, p),
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
        unit: p.unit
      }
    };
  }

  return FAMILY_ROWS.flatMap(function (entry) {
    return entry[1].map(function (parameters, index) { return makeQuestion(entry[0], parameters, index); });
  });
});
