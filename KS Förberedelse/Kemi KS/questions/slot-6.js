(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_CHEMISTRY_SLOTS = root.KS_CHEMISTRY_SLOTS || {};
    root.KS_CHEMISTRY_SLOTS[6] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SKILL = "composition-and-concentration";
  const ATOMIC_MASSES = { H: 1.01, C: 12.0, N: 14.0, O: 16.0, Na: 23.0, Mg: 24.3, Al: 27.0, P: 31.0, S: 32.1, Cl: 35.5, Ca: 40.1, Fe: 55.8, Cu: 63.5 };
  const EMPIRICAL_ROWS = [
    { scene: "En omättad kolvätegas analyseras i en liten provcell.", molecularFormula: "C2H4", atoms: { C: 2, H: 4 }, empiricalFormula: "CH2", percentElement: "C", elementName: "kol" },
    { scene: "En syrehaltig molekyl från en modellblandning har den angivna summaformeln.", molecularFormula: "C5H10O5", atoms: { C: 5, H: 10, O: 5 }, empiricalFormula: "CH2O", percentElement: "O", elementName: "syre" },
    { scene: "Ett slutet referensprov innehåller en molekyl med lika många kol- som väteatomer.", molecularFormula: "C6H6", atoms: { C: 6, H: 6 }, empiricalFormula: "CH", percentElement: "C", elementName: "kol" },
    { scene: "En brun gasmodell beskrivs endast med sin summaformel.", molecularFormula: "N2O4", atoms: { N: 2, O: 4 }, empiricalFormula: "NO2", percentElement: "N", elementName: "kväve" },
    { scene: "Ett fosforoxidprov har fastställd molekylformel men ska rapporteras med enklaste atomförhållande.", molecularFormula: "P4O10", atoms: { P: 4, O: 10 }, empiricalFormula: "P2O5", percentElement: "P", elementName: "fosfor" },
    { scene: "En blek vätska består av molekyler med två väte- och två syreatomer.", molecularFormula: "H2O2", atoms: { H: 2, O: 2 }, empiricalFormula: "HO", percentElement: "O", elementName: "syre" },
    { scene: "En modellmolekyl innehåller kol, väte och syre enligt den givna summaformeln.", molecularFormula: "C2H6O2", atoms: { C: 2, H: 6, O: 2 }, empiricalFormula: "CH3O", percentElement: "O", elementName: "syre" },
    { scene: "Ett neutralt molekylprov ger atomförhållandet som visas av summaformeln.", molecularFormula: "C6H12O3", atoms: { C: 6, H: 12, O: 3 }, empiricalFormula: "C2H4O", percentElement: "C", elementName: "kol" }
  ];
  const FORMULA_UNIT_ROWS = [
    { scene: "Kalciumjoner och nitratjoner ska ge en elektriskt neutral kristall.", cation: "Ca^2+", cationName: "kalciumjon", cationCharge: 2, cationCount: 1, anion: "NO3^-", anionName: "nitratjon", anionCharge: -1, anionCount: 2, formula: "Ca(NO3)2", atoms: { Ca: 1, N: 2, O: 6 } },
    { scene: "Ammoniumjoner kombineras med sulfatjoner till ett neutralt salt.", cation: "NH4^+", cationName: "ammoniumjon", cationCharge: 1, cationCount: 2, anion: "SO4^2-", anionName: "sulfatjon", anionCharge: -2, anionCount: 1, formula: "(NH4)2SO4", atoms: { N: 2, H: 8, S: 1, O: 4 } },
    { scene: "Magnesiumjoner och fosfatjoner ordnas i minsta neutrala heltalsförhållande.", cation: "Mg^2+", cationName: "magnesiumjon", cationCharge: 2, cationCount: 3, anion: "PO4^3-", anionName: "fosfatjon", anionCharge: -3, anionCount: 2, formula: "Mg3(PO4)2", atoms: { Mg: 3, P: 2, O: 8 } },
    { scene: "Järn(III)joner ska paras med kloridjoner utan kvarvarande nettoladdning.", cation: "Fe^3+", cationName: "järn(III)jon", cationCharge: 3, cationCount: 1, anion: "Cl^-", anionName: "kloridjon", anionCharge: -1, anionCount: 3, formula: "FeCl3", atoms: { Fe: 1, Cl: 3 } },
    { scene: "Koppar(II)joner och hydroxidjoner bildar en neutral formelenhet.", cation: "Cu^2+", cationName: "koppar(II)jon", cationCharge: 2, cationCount: 1, anion: "OH^-", anionName: "hydroxidjon", anionCharge: -1, anionCount: 2, formula: "Cu(OH)2", atoms: { Cu: 1, O: 2, H: 2 } },
    { scene: "Natriumjoner kombineras med karbonatjoner i en kristallmodell.", cation: "Na^+", cationName: "natriumjon", cationCharge: 1, cationCount: 2, anion: "CO3^2-", anionName: "karbonatjon", anionCharge: -2, anionCount: 1, formula: "Na2CO3", atoms: { Na: 2, C: 1, O: 3 } }
  ];
  const CONCENTRATION_ROWS = [
    { scene: "Ett blått koppar(II)sulfatpentahydratprov löses och späds till märket.", soluteFormula: "CuSO4·5H2O", atoms: { Cu: 1, S: 1, O: 9, H: 10 }, massG: 24.97, volumeDm3: 0.400, ion: "SO4^2-", ionName: "sulfatjoner", ionMultiplier: 1 },
    { scene: "Magnesiumsulfatheptahydrat vägs in till en ny standardlösning.", soluteFormula: "MgSO4·7H2O", atoms: { Mg: 1, S: 1, O: 11, H: 14 }, massG: 24.654, volumeDm3: 0.250, ion: "Mg^2+", ionName: "magnesiumjoner", ionMultiplier: 1 },
    { scene: "Kalciumkloriddihydrat löses fullständigt i en mätkolv.", soluteFormula: "CaCl2·2H2O", atoms: { Ca: 1, Cl: 2, O: 2, H: 4 }, massG: 14.714, volumeDm3: 0.200, ion: "Cl^-", ionName: "kloridjoner", ionMultiplier: 2 },
    { scene: "Järn(III)kloridhexahydrat används till en färsk laboratorielösning.", soluteFormula: "FeCl3·6H2O", atoms: { Fe: 1, Cl: 3, O: 6, H: 12 }, massG: 27.042, volumeDm3: 0.300, ion: "Fe^3+", ionName: "järn(III)joner", ionMultiplier: 1 },
    { scene: "Natriumkarbonatdekahydrat löses utan spill och lösningen späds noggrant.", soluteFormula: "Na2CO3·10H2O", atoms: { Na: 2, C: 1, O: 13, H: 20 }, massG: 28.620, volumeDm3: 0.500, ion: "Na^+", ionName: "natriumjoner", ionMultiplier: 2 },
    { scene: "Aluminiumnitratnonahydrat bereds till en klar vattenlösning.", soluteFormula: "Al(NO3)3·9H2O", atoms: { Al: 1, N: 3, O: 18, H: 18 }, massG: 37.518, volumeDm3: 0.250, ion: "NO3^-", ionName: "nitratjoner", ionMultiplier: 3 }
  ];

  function molarMass(atoms) {
    return Object.keys(atoms).reduce(function (sum, symbol) { return sum + ATOMIC_MASSES[symbol] * atoms[symbol]; }, 0);
  }

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

  function empiricalQuestion(row, index) {
    const caseNumber = index + 1;
    const figures = 3;
    const mass = molarMass(row.atoms);
    const elementMass = ATOMIC_MASSES[row.percentElement] * row.atoms[row.percentElement];
    const exactPercent = elementMass / mass * 100;
    const expectedPercent = roundSignificant(exactPercent, figures);
    return {
      id: "chemistry-s6-empirical-" + String(caseNumber).padStart(2, "0"),
      slot: 6,
      title: "Sammansättningsprov " + caseNumber,
      points: 3,
      promptHtml: "<p>" + row.scene + " Summaformeln är <strong>" + row.molecularFormula + "</strong>.</p><p>a) Ange den empiriska formeln, alltså minsta heltalsförhållandet mellan atomslagen. b) Beräkna massprocenten " + row.elementName + " i ämnet. Svara i % med 3 värdesiffror och redovisa molmassan.</p>",
      fields: [
        { id: "empirical", label: "a) Empirisk formel", kind: "chemical-formula", purpose: "formula", points: 1, expected: row.empiricalFormula },
        { id: "percent", label: "b) Massprocent (%; 3 värdesiffror)", kind: "numeric", applied: true, points: 2, expected: expectedPercent, targetUnit: "%", requestedUnitLabel: "%", significantFigures: figures, tolerance: tolerance(expectedPercent, figures) }
      ],
      solutionHtml: "<p><strong>a)</strong> Indexen i " + row.molecularFormula + " divideras med deras största gemensamma faktor. Minsta atomförhållandet ger <strong>" + row.empiricalFormula + "</strong>.</p><p><strong>b) Samband:</strong> massprocent = m(atomslag i en mol förening)/M(förening) · 100 %. M(" + row.molecularFormula + ") = " + clean(mass) + " g/mol och " + row.percentElement + " bidrar med " + clean(elementMass) + " g/mol. Andelen blir " + clean(exactPercent) + " %, alltså <strong>" + formatSignificant(expectedPercent, figures) + " %</strong> med 3 värdesiffror.</p>",
      rubric: [
        { points: 1, text: "Alla formelindex förkortas till minsta heltalsförhållande och rätt empirisk formel anges." },
        { points: 1, text: "Molmassan och massbidraget från det efterfrågade atomslaget beräknas med rätt atommassor." },
        { points: 1, text: "Massprocenten beräknas som del genom helhet gånger 100 och anges i % med 3 värdesiffror." }
      ],
      sourceData: { skill: SKILL, family: "empirical", caseNumber: caseNumber, molecularFormula: row.molecularFormula, percentElement: row.percentElement, significantFigures: figures, exactMolarMassGPerMol: mass }
    };
  }

  function formulaUnitQuestion(row, index) {
    const caseNumber = index + 9;
    const figures = 3;
    const mass = molarMass(row.atoms);
    const expectedMass = roundSignificant(mass, figures);
    return {
      id: "chemistry-s6-formula-unit-" + String(caseNumber).padStart(2, "0"),
      slot: 6,
      title: "Jonpar " + (index + 1),
      points: 3,
      promptHtml: "<p>" + row.scene + " Jonerna är " + row.cationName + " <strong>" + row.cation + "</strong> och " + row.anionName + " <strong>" + row.anion + "</strong>.</p><p>a) Skriv saltets formelenhet i minsta heltalsförhållande. b) Beräkna formelenhetens molmassa i g/mol och avrunda till 3 värdesiffror.</p>",
      fields: [
        { id: "formula", label: "a) Neutral formelenhet", kind: "chemical-formula", purpose: "formula", points: 1, expected: row.formula },
        { id: "molar-mass", label: "b) Molmassa (g/mol; 3 värdesiffror)", kind: "numeric", applied: true, points: 2, expected: expectedMass, targetUnit: "g/mol", requestedUnitLabel: "g/mol", significantFigures: figures, tolerance: tolerance(expectedMass, figures) }
      ],
      solutionHtml: "<p><strong>a)</strong> Laddningarna ska summera till noll: " + row.cationCount + "·(" + row.cationCharge + ") + " + row.anionCount + "·(" + row.anionCharge + ") = 0. Det minsta heltalsförhållandet ger <strong>" + row.formula + "</strong>.</p><p><strong>b)</strong> Varje atom räknas med sitt index i formelenheten och atommassorna summeras. M(" + row.formula + ") = " + clean(mass) + " g/mol, vilket med 3 värdesiffror blir <strong>" + formatSignificant(expectedMass, figures) + " g/mol</strong>.</p>",
      rubric: [
        { points: 1, text: "Katjonens och anjonens laddningar balanseras till minsta neutrala heltalsförhållande och rätt formelenhet anges." },
        { points: 1, text: "Rätt antal av varje atom läses ur parenteser och index och rätt atommassor summeras." },
        { points: 1, text: "Molmassan anges i g/mol med korrekt avrundning till 3 värdesiffror." }
      ],
      sourceData: {
        skill: SKILL,
        family: "formula-unit",
        caseNumber: caseNumber,
        cation: row.cation,
        cationCharge: row.cationCharge,
        cationCount: row.cationCount,
        anion: row.anion,
        anionCharge: row.anionCharge,
        anionCount: row.anionCount,
        formula: row.formula,
        exactMolarMassGPerMol: mass,
        significantFigures: figures
      }
    };
  }

  function concentrationQuestion(row, index) {
    const caseNumber = index + 15;
    const figures = 3;
    const mass = molarMass(row.atoms);
    const amount = row.massG / mass;
    const saltConcentration = amount / row.volumeDm3;
    const ionConcentration = saltConcentration * row.ionMultiplier;
    const expectedSalt = roundSignificant(saltConcentration, figures);
    const expectedIon = roundSignificant(ionConcentration, figures);
    return {
      id: "chemistry-s6-concentration-" + String(caseNumber).padStart(2, "0"),
      slot: 6,
      title: "Mätkolv " + (index + 1),
      points: 3,
      promptHtml: "<p>" + row.scene + " " + clean(row.massG) + " g <strong>" + row.soluteFormula + "</strong> löses och lösningens slutvolym är " + clean(row.volumeDm3) + " dm³.</p><p>a) Beräkna saltkoncentrationen i mol/dm³. b) Beräkna koncentrationen av " + row.ionName + " (" + row.ion + ") i mol/dm³. Avrunda båda svaren till 3 värdesiffror.</p>",
      fields: [
        { id: "salt-concentration", label: "a) Saltkoncentration (mol/dm³; 3 värdesiffror)", kind: "numeric", applied: true, points: 1, expected: expectedSalt, targetUnit: "mol/dm3", requestedUnitLabel: "mol/dm³", significantFigures: figures, tolerance: tolerance(expectedSalt, figures) },
        { id: "ion-concentration", label: "b) Jonkoncentration (mol/dm³; 3 värdesiffror)", kind: "numeric", applied: true, points: 2, expected: expectedIon, targetUnit: "mol/dm3", requestedUnitLabel: "mol/dm³", significantFigures: figures, tolerance: tolerance(expectedIon, figures) }
      ],
      solutionHtml: "<p><strong>a) Samband:</strong> n = m/M och c = n/V. Hydratvattnet ingår i molmassan: M(" + row.soluteFormula + ") = " + clean(mass) + " g/mol. n = " + clean(row.massG) + "/" + clean(mass) + " = " + clean(amount) + " mol och c(salt) = " + clean(amount) + "/" + clean(row.volumeDm3) + " = <strong>" + formatSignificant(expectedSalt, figures) + " mol/dm³</strong>.</p><p><strong>b)</strong> Varje formelenhet ger " + row.ionMultiplier + " " + row.ionName + ". Därför blir c(" + row.ion + ") = " + row.ionMultiplier + "·c(salt) = <strong>" + formatSignificant(expectedIon, figures) + " mol/dm³</strong>, avrundat till 3 värdesiffror.</p>",
      rubric: [
        { points: 1, text: "Hydratets fullständiga molmassa används och c = (m/M)/V ger rätt saltkoncentration i mol/dm³." },
        { points: 1, text: "Formelenhetens index ger rätt antal av den efterfrågade jonen per mol salt." },
        { points: 1, text: "Jonkoncentrationen, enheten mol/dm³ och avrundningen till 3 värdesiffror är korrekta." }
      ],
      sourceData: {
        skill: SKILL,
        family: "concentration",
        caseNumber: caseNumber,
        soluteFormula: row.soluteFormula,
        massG: row.massG,
        volumeDm3: row.volumeDm3,
        ion: row.ion,
        ionMultiplier: row.ionMultiplier,
        exactMolarMassGPerMol: mass,
        significantFigures: figures
      }
    };
  }

  return EMPIRICAL_ROWS.map(empiricalQuestion).concat(FORMULA_UNIT_ROWS.map(formulaUnitQuestion), CONCENTRATION_ROWS.map(concentrationQuestion));
});
