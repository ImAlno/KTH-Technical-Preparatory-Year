(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_PHYSICS_SLOTS = root.KS_PHYSICS_SLOTS || {};
    root.KS_PHYSICS_SLOTS[1] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

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

  function graphSvg(id, row) {
    const width = 520;
    const height = 292;
    const left = 58;
    const right = 492;
    const top = 20;
    const bottom = 242;
    const x = function (value) { return left + value / row.axis.xMax * (right - left); };
    const y = function (value) { return bottom - value / row.axis.yMax * (bottom - top); };
    let grid = "";
    for (let value = 0; value <= row.axis.xMax; value += row.axis.xStep) {
      grid += '<line x1="' + x(value) + '" y1="' + top + '" x2="' + x(value) + '" y2="' + bottom + '" stroke="#d2d2d7"/><text x="' + x(value) + '" y="262" text-anchor="middle">' + value + "</text>";
    }
    for (let value = 0; value <= row.axis.yMax; value += row.axis.yStep) {
      grid += '<line x1="' + left + '" y1="' + y(value) + '" x2="' + right + '" y2="' + y(value) + '" stroke="#d2d2d7"/><text x="48" y="' + (y(value) + 4) + '" text-anchor="end">' + value + "</text>";
    }
    const polyline = row.points.map(function (point) { return x(point.t) + "," + y(point.y); }).join(" ");
    const yLabel = row.graphType === "s-t" ? "s (m)" : "v (m/s)";
    return '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-labelledby="' + id + "-svg-title " + id + '-svg-desc" data-scale="exact" data-x-max="' + row.axis.xMax + '" data-y-max="' + row.axis.yMax + '">' +
      '<title id="' + id + '-svg-title">' + row.scenario + ": " + row.graphType + "-graf</title>" +
      '<desc id="' + id + '-svg-desc">Styckvis linjär graf med exakt graderade axlar. Punkterna är ' + row.points.map(function (point) { return "(" + point.t + ", " + point.y + ")"; }).join(", ") + ".</desc>" +
      grid + '<line x1="' + left + '" y1="' + bottom + '" x2="' + right + '" y2="' + bottom + '" stroke="#1d1d1f" stroke-width="2"/><line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + bottom + '" stroke="#1d1d1f" stroke-width="2"/>' +
      '<polyline points="' + polyline + '" fill="none" stroke="#0071e3" stroke-width="4" stroke-linejoin="round"/>' +
      '<text x="' + right + '" y="284" text-anchor="end">t (s)</text><text x="10" y="16">' + yLabel + "</text></svg>";
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

  function makeGraph(row, index) {
    const id = "physics-s1-graph-" + String(index + 1).padStart(2, "0");
    const figures = 2;
    const unit = requestedUnit(row);
    const exact = graphAnswer(row);
    const expected = roundSignificant(exact, figures);
    const data = Object.assign({}, row, {
      skill: SKILL,
      family: "graph-interpretation",
      caseNumber: index + 1,
      significantFigures: figures,
      targetUnit: unit[0],
      requestedUnitLabel: unit[1]
    });
    return {
      id: id,
      slot: 1,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>Diagrammet visar " + (row.graphType === "s-t" ? "läge s" : "hastighet v") + " som funktion av tiden för " + row.scenario.toLowerCase() + ". " + row.prompt + "</p>" + graphSvg(id, row) + "<p><small>Grafens rutnät, brytpunkter och axelvärden är exakt skalenliga.</small></p><p>Svara i " + unit[1] + ". Avrunda till " + figures + " värdesiffror.</p>",
      fields: [{ id: "answer", label: "Svar (" + unit[1] + "; " + figures + " värdesiffror)", kind: "numeric", points: 2, expected: expected, targetUnit: unit[0], tolerance: tolerance(expected, figures), help: "Du kan skriva talet med eller utan den angivna enheten." }],
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

  function contactSvg(id, row) {
    const isBeam = row.contactType === "two-support";
    const applied = row.appliedForceN === undefined ? row.knownSupportN : row.appliedForceN;
    const title = row.scenario + ": kontaktsituation";
    const desc = isBeam
      ? "En horisontell kropp vilar på två stöd. Den vänstra stödreaktionen är " + applied + " newton; storleken kan inte avläsas ur pilen."
      : "En kropp ligger kvar mot ett horisontellt golv medan en yttre kraft på " + applied + " newton verkar " + (row.contactType === "floor-pull" ? "uppåt" : "nedåt") + ". Pilarnas längder kodar inte storlek.";
    if (isBeam) {
      return '<svg viewBox="0 0 520 210" role="img" aria-labelledby="' + id + "-svg-title " + id + '-svg-desc"><title id="' + id + '-svg-title">' + title + '</title><desc id="' + id + '-svg-desc">' + desc + '</desc><rect x="100" y="72" width="320" height="35" fill="#dbeafe" stroke="#1d1d1f"/><path d="M145 145 L180 107 L215 145 Z M305 145 L340 107 L375 145 Z" fill="#f5f5f7" stroke="#1d1d1f"/><line x1="180" y1="108" x2="180" y2="42" stroke="#0071e3" stroke-width="4"/><path d="M180 42 l-8 15 h16 z" fill="#0071e3"/><text x="190" y="48">F₁ = ' + applied + ' N</text><text x="260" y="184" text-anchor="middle">Schematisk och inte skalenlig</text></svg>';
    }
    const upward = row.contactType === "floor-pull";
    return '<svg viewBox="0 0 520 210" role="img" aria-labelledby="' + id + "-svg-title " + id + '-svg-desc"><title id="' + id + '-svg-title">' + title + '</title><desc id="' + id + '-svg-desc">' + desc + '</desc><line x1="90" y1="145" x2="430" y2="145" stroke="#1d1d1f" stroke-width="3"/><rect x="205" y="82" width="110" height="63" rx="4" fill="#dbeafe" stroke="#1d1d1f"/><line x1="260" y1="' + (upward ? 82 : 30) + '" x2="260" y2="' + (upward ? 30 : 82) + '" stroke="#0071e3" stroke-width="4"/><path d="M260 ' + (upward ? 28 : 84) + " l-8 " + (upward ? 15 : -15) + " h16 z\" fill=\"#0071e3\"/><text x=\"278\" y=\"58\">F = " + applied + ' N</text><text x="260" y="184" text-anchor="middle">Schematisk och inte skalenlig</text></svg>';
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

  function makeContact(row, index) {
    const id = "physics-s1-contact-" + String(index + 1).padStart(2, "0");
    const figures = 2;
    const exact = contactAnswer(row);
    const expected = roundSignificant(exact, figures);
    return {
      id: id,
      slot: 1,
      title: row.scenario,
      points: 2,
      promptHtml: "<p>" + contactPrompt(row) + "</p>" + contactSvg(id, row) + "<p><small>Figuren är schematisk och inte skalenlig; pilarnas längder får inte användas för mätning.</small></p><p>Rita först en kraftfigur. Svara sedan i N. Avrunda till " + figures + " värdesiffror.</p>",
      fields: [
        { id: "diagram", label: "Kraftfigur och resonemang", kind: "self", points: 1, multiline: true, help: "Beskriv eller rita alla krafter på den frilagda kroppen och ange riktning." },
        { id: "answer", label: "Svar (N; " + figures + " värdesiffror)", kind: "numeric", points: 1, expected: expected, targetUnit: "N", tolerance: tolerance(expected, figures), help: "Ange normalkraftens eller stödreaktionens storlek." }
      ],
      solutionHtml: contactSolution(row, exact, formatSignificant(expected, figures)),
      rubric: [
        { points: 1, text: "Kraftfiguren visar tyngdkraft och samtliga kontakt-/yttre krafter på rätt kropp med rätt riktning." },
        { points: 1, text: "Newtons första lag i vertikalled är korrekt och ger rätt storlek, riktning, enhet och avrundning." }
      ],
      sourceData: Object.assign({}, row, { skill: SKILL, family: "contact-equilibrium", caseNumber: index + 1, g: G, significantFigures: figures, targetUnit: "N", requestedUnitLabel: "N" })
    };
  }

  return GRAPH_ROWS.map(makeGraph).concat(CONTACT_ROWS.map(makeContact));
});
