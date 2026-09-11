(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_CHEMISTRY_SLOTS = root.KS_CHEMISTRY_SLOTS || {};
    root.KS_CHEMISTRY_SLOTS[3] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SKILL = "electron-formulas-and-polarity";
  const ROWS = [
    { molecule: "NH3", name: "ammoniak", scene: "En givare i ett kylrum ska känna igen små mängder ammoniak.", task: "electron", geometry: "trigonal pyramid", structure: "Kväve är centralatom med tre enkla N–H-bindningar och ett fritt elektronpar.", polar: true, explanation: "N–H-bindningarna är polära och den osymmetriska pyramidformen gör att bindningsdipolerna inte tar ut varandra." },
    { molecule: "H2O", name: "vatten", scene: "I en modell av ett mikroskopiskt vattendroppssteg studeras en ensam vattenmolekyl.", task: "geometry", geometry: "vinklad", structure: "Syre har två O–H-bindningar och två fria elektronpar, vilket ger en vinklad molekyl.", polar: true, explanation: "O–H-bindningarna är polära och den vinklade formen ger en nettoladdningsförskjutning." },
    { molecule: "H2S", name: "svavelväte", scene: "Ett slutet luktprov innehåller en liten mängd svavelväte.", task: "electron", geometry: "vinklad", structure: "Svavel är centralatom med två S–H-bindningar och två fria elektronpar.", polar: true, explanation: "Molekylen är vinklad, så de svagt polära S–H-bindningarnas bidrag summeras till ett dipolmoment." },
    { molecule: "SO2", name: "svaveldioxid", scene: "En rökgasmätare analyserar en enskild svaveldioxidmolekyl.", task: "geometry", geometry: "vinklad", structure: "Svavel är centralatom mellan två syreatomer och har ett fritt elektronpar; godtagbara resonansformer visar samma elektronfördelning.", polar: true, explanation: "S–O-bindningarna är polära och den vinklade geometrin gör att deras dipolmoment inte tar ut varandra." },
    { molecule: "CO2", name: "koldioxid", scene: "En klimatkammare visualiserar laddningsfördelningen i en koldioxidmolekyl.", task: "electron", geometry: "linjär", structure: "Elektronformeln är O=C=O; varje syre har två fria elektronpar och kol saknar fria elektronpar.", polar: false, explanation: "C=O-bindningarna är polära men molekylen är linjär och symmetrisk, så bindningsdipolerna tar ut varandra." },
    { molecule: "CH3Cl", name: "klormetan", scene: "I en molekylsimulering byts en väteatom i metan mot klor.", task: "geometry", geometry: "tetraedrisk kring kol", structure: "Kol har fyra enkelbindningar: tre till väte och en till klor; klor har tre fria elektronpar.", polar: true, explanation: "C–Cl-bindningen ger en tydlig laddningsförskjutning och den osymmetriska tetraedern har ett nettodipolmoment." },
    { molecule: "CH2Cl2", name: "diklormetan", scene: "Ett provrör märkt med summaformeln CH2Cl2 ska klassificeras före lagring.", task: "electron", geometry: "tetraedrisk kring kol", structure: "Kol binder två väte och två klor med enkelbindningar; varje klor har tre fria elektronpar.", polar: true, explanation: "De två C–Cl-bindningarnas dipoler pekar inte åt motsatta håll i tetraedern och tar därför inte ut varandra." },
    { molecule: "BF3", name: "bortrifluorid", scene: "En plan molekylmodell med bor i mitten och tre fluoratomer granskas.", task: "geometry", geometry: "trigonal plan", structure: "Bor har tre enkelbindningar till fluor och inget fritt elektronpar; varje fluor har tre fria elektronpar.", polar: false, explanation: "B–F-bindningarna är polära men de tre lika bindningsdipolerna ligger symmetriskt med 120° mellan sig och summan blir noll." },
    { molecule: "CH4", name: "metan", scene: "En modellverkstad bygger en helt symmetrisk metanmolekyl.", task: "electron", geometry: "tetraedrisk", structure: "Kol är centralatom med fyra enkla C–H-bindningar och inga fria elektronpar.", polar: false, explanation: "Den tetraedriska molekylen har fyra likadana bindningar symmetriskt ordnade, så någon permanent laddningsförskjutning uppstår inte." },
    { molecule: "CCl4", name: "tetraklormetan", scene: "Fyra kloratomer placeras symmetriskt runt kol i ett digitalt modellbygge.", task: "geometry", geometry: "tetraedrisk", structure: "Kol binder fyra kloratomer; varje klor har tre fria elektronpar och kol saknar fria par.", polar: false, explanation: "C–Cl-bindningarna är polära men tetraederns fulla symmetri gör att bindningsdipolerna tar ut varandra." },
    { molecule: "PCl3", name: "fosfortriklorid", scene: "En kemikaliekapsel innehåller molekyler med fosfor och tre kloratomer.", task: "electron", geometry: "trigonal pyramid", structure: "Fosfor är centralatom med tre P–Cl-bindningar och ett fritt elektronpar.", polar: true, explanation: "Det fria elektronparet ger en osymmetrisk pyramid och de polära P–Cl-bindningarnas dipoler får en resultant." },
    { molecule: "BeCl2", name: "berylliumklorid", scene: "En gasfasmodell visar en berylliumatom mellan två kloratomer.", task: "geometry", geometry: "linjär", structure: "Beryllium har två enkelbindningar och inga fria elektronpar i den enkla modellen; kloratomerna har fria par.", polar: false, explanation: "De två likadana Be–Cl-bindningarna ligger rakt motsatta och deras dipolmoment tar ut varandra." },
    { molecule: "HCl", name: "väteklorid", scene: "En spektrometer följer en tvåatomig vätekloridmolekyl.", task: "electron", geometry: "linjär", structure: "Väte och klor delar ett bindande elektronpar; klor har dessutom tre fria elektronpar.", polar: true, explanation: "Klor drar starkare i bindningselektronerna än väte, och i en tvåatomig heteronukleär molekyl kan laddningsförskjutningen inte ta ut sig." },
    { molecule: "Cl2", name: "klor", scene: "Två identiska kloratomer kopplas samman i en elektronmodell.", task: "geometry", geometry: "linjär", structure: "Kloratomerna delar ett elektronpar och har vardera tre fria elektronpar.", polar: false, explanation: "Atomerna har samma elektronegativitet, så bindningen saknar permanent laddningsförskjutning och molekylen är inte en dipol." },
    { molecule: "N2", name: "kväve", scene: "En luftmodell isolerar en enda kvävemolekyl från omgivningen.", task: "electron", geometry: "linjär", structure: "Kväveatomerna har en trippelbindning och vardera ett fritt elektronpar.", polar: false, explanation: "De två identiska atomerna delar elektronerna lika; molekylen har därför inget permanent dipolmoment." },
    { molecule: "O2", name: "syre", scene: "En syrgassensor illustrerar elektronparen i en syremolekyl.", task: "geometry", geometry: "linjär", structure: "Syreatomerna binds med en dubbelbindning och har vardera två fria elektronpar.", polar: false, explanation: "Eftersom de båda atomerna är syre finns ingen bestående skillnad i elektrondragande förmåga mellan ändarna." },
    { molecule: "HF", name: "vätefluorid", scene: "En tvåatomig modell används för att jämföra fluors och vätes elektrondragande förmåga.", task: "electron", geometry: "linjär", structure: "Väte och fluor delar ett bindande elektronpar; fluor har tre fria elektronpar.", polar: true, explanation: "Fluor drar bindningselektronerna tydligt mot sig, så fluorsidan blir partiellt negativ och vätesidan partiellt positiv." },
    { molecule: "CS2", name: "koldisulfid", scene: "En rak modell med kol i mitten och svavel i båda ändar ska bedömas.", task: "geometry", geometry: "linjär", structure: "Elektronformeln kan skrivas S=C=S; varje svavel har två fria elektronpar.", polar: false, explanation: "De två lika bindningarnas dipolbidrag är motriktade i den linjära symmetriska molekylen och summan är noll." },
    { molecule: "SiCl4", name: "kiseltetraklorid", scene: "En tredimensionell modell placerar fyra kloratomer runt en kiselatom.", task: "electron", geometry: "tetraedrisk", structure: "Kisel har fyra enkelbindningar till klor; varje klor har tre fria elektronpar.", polar: false, explanation: "Trots polära Si–Cl-bindningar är alla fyra riktningar likvärdiga i tetraedern och bindningsdipolerna tar ut varandra." },
    { molecule: "H2", name: "väte", scene: "En referenscell innehåller endast tvåatomiga vätemolekyler.", task: "geometry", geometry: "linjär", structure: "De två väteatomerna delar ett elektronpar i en enkelbindning.", polar: false, explanation: "Identiska väteatomer drar lika starkt i bindningselektronerna, så ingen permanent laddningsförskjutning finns." }
  ];

  function makeQuestion(row, index) {
    const caseNumber = index + 1;
    const structureRequest = row.task === "electron"
      ? "Rita en elektronformel för " + row.molecule + " och markera fria elektronpar."
      : "Rita eller beskriv molekylens geometri och ange formen med ord.";
    const verdict = row.polar ? "är en dipol" : "är inte en dipol";
    return {
      id: "chemistry-s3-polarity-" + String(caseNumber).padStart(2, "0"),
      slot: 3,
      title: "Molekylkort " + caseNumber + ": " + row.name,
      points: 2,
      promptHtml: "<p>" + row.scene + " Molekylens formel är <strong>" + row.molecule + "</strong>.</p><p>a) " + structureRequest + " b) Avgör om molekylen är en dipol och motivera kort med bindningspolaritet, geometri och om bindningsdipolerna tar ut varandra.</p>",
      fields: [
        { id: "structure", label: "a) Elektronformel eller molekylgeometri", kind: "self", points: 1, multiline: true, help: "Jämför din ritning eller geometribeskrivning med facit efter rättning." },
        { id: "polarity", label: "b) Dipolbedömning med motivering", kind: "self", points: 1, multiline: true, help: "Skriv både slutsats och varför bindningsdipolernas vektorsumma blir eller inte blir noll." }
      ],
      solutionHtml: "<p><strong>a)</strong> " + row.structure + " Den molekylgeometri som ska framgå är <strong>" + row.geometry + "</strong>.</p><p><strong>b)</strong> " + row.molecule + " <strong>" + verdict + "</strong>. " + row.explanation + " En korrekt förklaring kopplar alltså samman bindningarnas polaritet med hela molekylens tredimensionella symmetri.</p>",
      rubric: [
        { points: 1, text: "Elektronformeln visar rätt bindningar och fria elektronpar, eller så anges rätt molekylgeometri med en entydig skiss." },
        { points: 1, text: "Rätt dipolslutsats motiveras med polariserade bindningar samt symmetri eller en nettoladdningsförskjutning i hela molekylen." }
      ],
      sourceData: {
        skill: SKILL,
        family: "molecular-polarity",
        caseNumber: caseNumber,
        molecule: row.molecule,
        name: row.name,
        structureTask: row.task,
        geometry: row.geometry,
        polar: row.polar,
        structureDescription: row.structure,
        polarityExplanation: row.explanation
      }
    };
  }

  return ROWS.map(makeQuestion);
});
