(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_CHEMISTRY_SLOTS = root.KS_CHEMISTRY_SLOTS || {};
    root.KS_CHEMISTRY_SLOTS[1] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SKILL = "atomic-structure";
  const ROWS = [
    { isotope: "kväve-15", symbol: "N", atomicNumber: 7, massNumber: 15, comparisonMass: 14, isotopeTask: "neutrons", termPrompt: "Vilken term används för varianter av ett grundämne när deras masstal skiljer sig?", term: "isotoper", aliases: ["isotop"], termExplanation: "De har samma antal protoner men olika antal neutroner.", shells: [2, 5], ion: "N^3-", ionReason: "tar upp tre elektroner" },
    { isotope: "syre-18", symbol: "O", atomicNumber: 8, massNumber: 18, comparisonMass: 16, isotopeTask: "difference", termPrompt: "Vad kallas summan av protoner och neutroner i kärnan?", term: "masstal", aliases: ["masstalet"], termExplanation: "Masstalet är antalet nukleoner, alltså protoner plus neutroner.", shells: [2, 6], ion: "O^2-", ionReason: "tar upp två elektroner" },
    { isotope: "magnesium-25", symbol: "Mg", atomicNumber: 12, massNumber: 25, comparisonMass: 24, isotopeTask: "neutrons", termPrompt: "Vad kallas antalet protoner i kärnan?", term: "atomnummer", aliases: ["atomnumret"], termExplanation: "Atomnumret identifierar grundämnet och är lika med protonantalet.", shells: [2, 8, 2], ion: "Mg^2+", ionReason: "avger två elektroner" },
    { isotope: "klor-37", symbol: "Cl", atomicNumber: 17, massNumber: 37, comparisonMass: 35, isotopeTask: "difference", termPrompt: "Vad kallas en negativt laddad jon?", term: "anjon", aliases: ["en anjon"], termExplanation: "En anjon har tagit upp en eller flera elektroner.", shells: [2, 8, 7], ion: "Cl^-", ionReason: "tar upp en elektron" },
    { isotope: "natrium-23", symbol: "Na", atomicNumber: 11, massNumber: 23, comparisonMass: 22, isotopeTask: "neutrons", termPrompt: "Vad kallas elektronerna i atomens yttersta besatta skal?", term: "valenselektroner", aliases: ["valenselektron", "valenselektronerna"], termExplanation: "Valenselektronerna deltar när bindningar och joner bildas.", shells: [2, 8, 1], ion: "Na^+", ionReason: "avger en elektron" },
    { isotope: "aluminium-27", symbol: "Al", atomicNumber: 13, massNumber: 27, comparisonMass: 26, isotopeTask: "difference", termPrompt: "Vad kallas en positivt laddad jon?", term: "katjon", aliases: ["en katjon"], termExplanation: "En katjon har avgett en eller flera elektroner.", shells: [2, 8, 3], ion: "Al^3+", ionReason: "avger tre elektroner" },
    { isotope: "fosfor-31", symbol: "P", atomicNumber: 15, massNumber: 31, comparisonMass: 32, isotopeTask: "neutrons", termPrompt: "Vad kallas en laddad atom eller atomgrupp?", term: "jon", aliases: ["en jon"], termExplanation: "En jon har olika antal protoner och elektroner och får därför nettoladdning.", shells: [2, 8, 5], ion: "P^3-", ionReason: "tar upp tre elektroner" },
    { isotope: "fluor-19", symbol: "F", atomicNumber: 9, massNumber: 19, comparisonMass: 18, isotopeTask: "difference", termPrompt: "Vad kallas området runt kärnan där elektroner med liknande energi placeras i Bohrs modell?", term: "elektronskal", aliases: ["elektronskalet", "skal"], termExplanation: "I Bohrs modell ordnas elektronerna i elektronskal runt kärnan.", shells: [2, 7], ion: "F^-", ionReason: "tar upp en elektron" },
    { isotope: "svavel-34", symbol: "S", atomicNumber: 16, massNumber: 34, comparisonMass: 32, isotopeTask: "neutrons", termPrompt: "Vad kallas partiklarna i kärnan gemensamt?", term: "nukleoner", aliases: ["nukleon"], termExplanation: "Protoner och neutroner kallas tillsammans nukleoner.", shells: [2, 8, 6], ion: "S^2-", ionReason: "tar upp två elektroner" },
    { isotope: "kalium-41", symbol: "K", atomicNumber: 19, massNumber: 41, comparisonMass: 39, isotopeTask: "difference", termPrompt: "Vad kallas en atom med fullt yttersta elektronskal?", term: "ädelgasstruktur", aliases: ["ädelgaskonfiguration", "ädelgasstruktur"], termExplanation: "Ädelgasstruktur betyder att det yttersta besatta skalet är fullt.", shells: [2, 8, 8, 1], ion: "K^+", ionReason: "avger en elektron" },
    { isotope: "kol-13", symbol: "C", atomicNumber: 6, massNumber: 13, comparisonMass: 12, isotopeTask: "neutrons", termPrompt: "Vad kallas den oladdade partikeln i atomkärnan?", term: "neutron", aliases: ["en neutron"], termExplanation: "Neutronen finns i kärnan och saknar elektrisk nettoladdning.", valence: 4, concentration: 0.240, volumeDm3: 0.0350 },
    { isotope: "kisel-29", symbol: "Si", atomicNumber: 14, massNumber: 29, comparisonMass: 28, isotopeTask: "difference", termPrompt: "Vad kallas den positivt laddade partikeln i atomkärnan?", term: "proton", aliases: ["en proton"], termExplanation: "Protonen finns i kärnan och dess antal bestämmer atomnumret.", valence: 4, concentration: 0.175, volumeDm3: 0.0800 },
    { isotope: "bor-11", symbol: "B", atomicNumber: 5, massNumber: 11, comparisonMass: 10, isotopeTask: "neutrons", termPrompt: "Vad kallas den negativt laddade partikeln runt kärnan?", term: "elektron", aliases: ["en elektron"], termExplanation: "Elektronerna är negativt laddade och finns i skal runt kärnan.", valence: 3, concentration: 0.325, volumeDm3: 0.0120 },
    { isotope: "kalcium-44", symbol: "Ca", atomicNumber: 20, massNumber: 44, comparisonMass: 40, isotopeTask: "difference", termPrompt: "Vad kallas de lodräta kolumnerna i periodiska systemet?", term: "grupper", aliases: ["grupp", "grundämnesgrupper"], termExplanation: "Grundämnen i samma grupp har liknande valenselektronstruktur.", valence: 2, concentration: 0.0950, volumeDm3: 0.250 },
    { isotope: "litium-7", symbol: "Li", atomicNumber: 3, massNumber: 7, comparisonMass: 6, isotopeTask: "neutrons", termPrompt: "Vad kallas de vågräta raderna i periodiska systemet?", term: "perioder", aliases: ["period", "grundämnesperioder"], termExplanation: "Periodnumret hänger samman med antalet besatta elektronskal.", valence: 1, concentration: 0.440, volumeDm3: 0.0180 },
    { isotope: "neon-22", symbol: "Ne", atomicNumber: 10, massNumber: 22, comparisonMass: 20, isotopeTask: "difference", termPrompt: "Vad kallas en atom som inte har någon nettoladdning?", term: "neutral atom", aliases: ["oladdad atom", "neutral"], termExplanation: "En neutral atom har lika många protoner som elektroner.", valence: 8, concentration: 0.0820, volumeDm3: 0.600 },
    { isotope: "järn-57", symbol: "Fe", atomicNumber: 26, massNumber: 57, comparisonMass: 56, isotopeTask: "neutrons", termPrompt: "Vad kallas kärnans positiva nettoladdning?", term: "kärnladdning", aliases: ["kärnans laddning"], termExplanation: "Kärnladdningen bestäms av antalet positivt laddade protoner.", valence: 2, shells: [2, 8, 14, 2], electronCountDefinition: "outermost-occupied-shell", concentration: 0.138, volumeDm3: 0.0450 },
    { isotope: "koppar-65", symbol: "Cu", atomicNumber: 29, massNumber: 65, comparisonMass: 63, isotopeTask: "difference", termPrompt: "Vad kallas ett ämne som består av endast ett slags atomer?", term: "grundämne", aliases: ["ett grundämne"], termExplanation: "Ett grundämne innehåller atomer med samma atomnummer.", valence: 1, shells: [2, 8, 18, 1], electronCountDefinition: "outermost-occupied-shell", concentration: 0.515, volumeDm3: 0.0220 },
    { isotope: "zink-68", symbol: "Zn", atomicNumber: 30, massNumber: 68, comparisonMass: 64, isotopeTask: "neutrons", termPrompt: "Vad kallas det yttersta besatta elektronskalet?", term: "valensskal", aliases: ["valensskalet", "yttersta skalet"], termExplanation: "Valensskalet innehåller atomens valenselektroner.", valence: 2, shells: [2, 8, 18, 2], electronCountDefinition: "outermost-occupied-shell", concentration: 0.0640, volumeDm3: 0.750 },
    { isotope: "väte-2", symbol: "H", atomicNumber: 1, massNumber: 2, comparisonMass: 1, isotopeTask: "difference", termPrompt: "Vad kallas en bestämd mängd av ett ämne mätt i mol?", term: "substansmängd", aliases: ["substansmängden"], termExplanation: "Substansmängd betecknas n och anges i enheten mol.", valence: 1, concentration: 0.285, volumeDm3: 0.160 }
  ];

  function clean(value) {
    return String(Number(value.toFixed(12))).replace(".", ",");
  }

  function roundSignificant(value, figures) {
    if (value === 0) return 0;
    const power = figures - 1 - Math.floor(Math.log10(Math.abs(value)));
    const scale = Math.pow(10, power);
    return Math.round((value + Number.EPSILON) * scale) / scale;
  }

  function tolerance(value, figures) {
    const exponent = Math.floor(Math.log10(Math.abs(value))) - figures + 1;
    return { absolute: 0.500001 * Math.pow(10, exponent) };
  }

  function formatSignificant(value, figures) {
    if (value === 0) return "0," + "0".repeat(figures - 1);
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    return value.toFixed(Math.max(0, figures - 1 - exponent)).replace(".", ",");
  }

  function isotopePrompt(row) {
    return row.isotopeTask === "neutrons"
      ? "Isotopen " + row.isotope + " har atomnummer " + row.atomicNumber + ". Hur många neutroner finns i kärnan?"
      : "Hur många enheter skiljer masstalen mellan " + row.isotope + " och " + row.symbol + "-" + row.comparisonMass + "?";
  }

  function isotopeAnswer(row) {
    return row.isotopeTask === "neutrons" ? row.massNumber - row.atomicNumber : Math.abs(row.massNumber - row.comparisonMass);
  }

  function shellAliases(shells) {
    const canonical = shells.join(",");
    return Array.from(new Set([
      canonical.replaceAll(",", "-"),
      canonical.replaceAll(",", "–"),
      canonical.replaceAll(",", ", "),
      canonical.replaceAll(",", " , "),
      canonical.replaceAll(",", " - "),
      canonical.replaceAll(",", " – ")
    ]));
  }

  function makeQuestion(row, index) {
    const caseNumber = index + 1;
    const hasBohr = index < 10;
    const definesOutermostShell = row.electronCountDefinition === "outermost-occupied-shell";
    const isotopeExpected = isotopeAnswer(row);
    const fields = [
      { id: "isotope", label: "a) Heltal", kind: "numeric", points: 1, expected: isotopeExpected, targetUnit: "1", tolerance: { absolute: 0 } },
      { id: "term", label: "b) Kemisk term", kind: "aliases", purpose: "terminology", points: 1, expected: row.term, aliases: row.aliases }
    ];
    if (hasBohr) {
      fields.push({
        id: "shells", label: "c) Elektronfördelning från innersta till yttersta skal", kind: "aliases", purpose: "bohr-shell-distribution", points: 1,
        expected: row.shells.join(","), aliases: shellAliases(row.shells), help: "Ange endast skalens elektronantal här; rita hela Bohrmodellen i räknehäftet."
      });
      fields.push({
        id: "ion", label: "d) Jonbeteckning", kind: "chemical-formula", purpose: "jonbeteckning-formula", points: 1,
        expected: row.ion, aliases: row.ion.includes("^") ? [row.ion.replace("^", "")] : []
      });
    } else {
      const figures = 3;
      const amount = roundSignificant(row.concentration * row.volumeDm3, figures);
      fields.push({ id: "valence", label: definesOutermostShell ? "c) Elektroner i det yttersta besatta skalet" : "c) Antal valenselektroner", kind: "numeric", points: 1, expected: row.valence, targetUnit: "1", tolerance: { absolute: 0 } });
      fields.push({ id: "amount", label: "d) Substansmängd (mol; 3 värdesiffror)", kind: "numeric", applied: true, points: 1, expected: amount, targetUnit: "mol", requestedUnitLabel: "mol", significantFigures: figures, tolerance: tolerance(amount, figures), help: "Du kan skriva talet med eller utan den angivna enheten." });
    }

    const thirdPrompt = hasBohr
      ? "c) Rita en neutral " + row.symbol + "-atom enligt Bohrs modell i räknehäftet. Ange endast elektronfördelningen från innersta till yttersta skal som digitalt slutsvar. d) Ange den vanligaste enkla jon som atomen bildar."
      : (definesOutermostShell
        ? "c) Ange antalet elektroner i det yttersta besatta skalet hos en neutral " + row.symbol + "-atom; här avses skalet med högst huvudkvanttal. "
        : "c) Ange antalet valenselektroner hos en neutral " + row.symbol + "-atom. ") + "d) En lösning har koncentrationen " + clean(row.concentration) + " mol/dm³ och volymen " + clean(row.volumeDm3) + " dm³. Beräkna n = cV i räknehäftet och ange endast slutsvaret i mol med 3 värdesiffror digitalt.";
    const isotopeSolution = row.isotopeTask === "neutrons"
      ? "Antalet neutroner är A − Z = " + row.massNumber + " − " + row.atomicNumber + " = " + isotopeExpected + "."
      : "Skillnaden i masstal är |" + row.massNumber + " − " + row.comparisonMass + "| = " + isotopeExpected + ". Isotoperna har samma protonantal men olika neutronantal.";
    const structureSolution = hasBohr
      ? "En neutral " + row.symbol + "-atom har " + row.atomicNumber + " protoner och " + row.atomicNumber + " elektroner. Elektronfördelningen från innersta skalet är " + row.shells.join("–") + ". Atomen " + row.ionReason + " och bildar därför <strong>" + row.ion + "</strong>."
      : (definesOutermostShell
        ? "Elektronfördelningen från innersta skalet är " + row.shells.join("–") + ". Det yttersta besatta skalet innehåller därför <strong>" + row.valence + " elektron" + (row.valence === 1 ? "" : "er") + "</strong>. "
        : "Grundämnets plats i periodiska systemet ger <strong>" + row.valence + " valenselektron" + (row.valence === 1 ? "" : "er") + "</strong>. ") + "För lösningen används n = cV: " + clean(row.concentration) + " mol/dm³ · " + clean(row.volumeDm3) + " dm³ = <strong>" + formatSignificant(roundSignificant(row.concentration * row.volumeDm3, 3), 3) + " mol</strong> (3 värdesiffror).";

    return {
      id: "chemistry-s1-atomic-" + String(caseNumber).padStart(2, "0"),
      slot: 1,
      title: "Atomstation " + caseNumber + ": " + row.isotope,
      points: 4,
      promptHtml: "<p>Ett laboratorium jämför två isotoper och arbetar samtidigt med en lösning eller jon av samma grundämne.</p><p>a) " + isotopePrompt(row) + " b) " + row.termPrompt + " " + thirdPrompt + "</p>",
      fields: fields,
      workOnPaper: {
        title: "Arbeta i räknehäftet",
        instruction: hasBohr
          ? "Rita den fullständiga Bohrmodellen med kärna och elektroner i räknehäftet. I appen anger du endast skalens elektronfördelning."
          : "Visa definitionsvillkor och mellanled för n = cV i räknehäftet. I appen anger du endast slutsvaren.",
        comparison: "Jämför isotopresonemang, elektronfördelning och beräkning med lösningen efter rättning."
      },
      solutionHtml: "<p><strong>a)</strong> " + isotopeSolution + "</p><p><strong>b)</strong> Rätt term är <strong>" + row.term + "</strong>. " + row.termExplanation + "</p><p><strong>c–d)</strong> " + structureSolution + "</p>",
      rubric: [
        { points: 1, text: "Isotopjämförelsen använder atomnummer och masstal korrekt." },
        { points: 1, text: "Den efterfrågade kemiska termen är korrekt." },
        { points: 1, text: hasBohr ? "Kärnan och rätt antal elektroner visas, och elektronerna är fördelade på rätt skal." : (definesOutermostShell ? "Elektronfördelningen leder till rätt antal elektroner i det yttersta besatta skalet." : "Antalet valenselektroner är korrekt.") },
        { points: 1, text: hasBohr ? "Jonens grundämnessymbol och laddning är korrekta." : "n = cV används med volym i dm³ och svaret anges i mol med 3 värdesiffror." }
      ],
      sourceData: Object.assign({}, row, {
        skill: SKILL,
        family: "atomic-group",
        caseNumber: caseNumber,
        subtopics: hasBohr
          ? ["isotope-comparison", "terminology", "bohr-model", "ion-notation"]
          : ["isotope-comparison", "terminology", "valence-electrons", "amount-from-concentration"],
        significantFigures: hasBohr ? null : 3
      })
    };
  }

  return ROWS.map(makeQuestion);
});
