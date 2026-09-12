(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_CHEMISTRY_SLOTS = root.KS_CHEMISTRY_SLOTS || {};
    root.KS_CHEMISTRY_SLOTS[2] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SKILL = "reactions-and-stoichiometry";
  const ATOMIC_MASSES = { H: 1.01, C: 12.0, N: 14.0, O: 16.0, Na: 23.0, Mg: 24.3, Al: 27.0, P: 31.0, S: 32.1, Cl: 35.5, K: 39.1, Ca: 40.1, Fe: 55.8, Cu: 63.5, Zn: 65.4, Ag: 107.9, Ba: 137.3 };
  const PRIMARY_ROWS = [
    { family: "hydrate", rotationElement: "copper", context: "En keramikverkstad återfuktar vattenfritt koppar(II)sulfat för en demonstrationsplatta.", equation: "CuSO4(s) + 5 H2O(l) -> CuSO4·5H2O(s)", inputFormula: "CuSO4", inputAtoms: { Cu: 1, S: 1, O: 4 }, inputCoefficient: 1, inputMassG: 73.5, outputFormula: "CuSO4·5H2O", outputAtoms: { Cu: 1, S: 1, O: 9, H: 10 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "magnesium", context: "I ett värmemagasin ska magnesiumsulfatmonohydrat bindas om till heptahydrat.", equation: "MgSO4·H2O(s) + 6 H2O(l) -> MgSO4·7H2O(s)", inputFormula: "MgSO4·H2O", inputAtoms: { Mg: 1, S: 1, O: 5, H: 2 }, inputCoefficient: 1, inputMassG: 52.8, outputFormula: "MgSO4·7H2O", outputAtoms: { Mg: 1, S: 1, O: 11, H: 14 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "calcium", context: "Ett torkskåpstest följer när vattenfritt kalciumklorid övergår till dihydrat.", equation: "CaCl2(s) + 2 H2O(l) -> CaCl2·2H2O(s)", inputFormula: "CaCl2", inputAtoms: { Ca: 1, Cl: 2 }, inputCoefficient: 1, inputMassG: 81.4, outputFormula: "CaCl2·2H2O", outputAtoms: { Ca: 1, Cl: 2, H: 4, O: 2 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "iron", context: "I en sluten provberedning omvandlas järn(III)klorid till sitt hexahydrat.", equation: "FeCl3(s) + 6 H2O(l) -> FeCl3·6H2O(s)", inputFormula: "FeCl3", inputAtoms: { Fe: 1, Cl: 3 }, inputCoefficient: 1, inputMassG: 64.9, outputFormula: "FeCl3·6H2O", outputAtoms: { Fe: 1, Cl: 3, H: 12, O: 6 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "sodium", context: "En kylblandning framställs genom att natriumkarbonat får bilda dekahydrat.", equation: "Na2CO3(s) + 10 H2O(l) -> Na2CO3·10H2O(s)", inputFormula: "Na2CO3", inputAtoms: { Na: 2, C: 1, O: 3 }, inputCoefficient: 1, inputMassG: 43.2, outputFormula: "Na2CO3·10H2O", outputAtoms: { Na: 2, C: 1, O: 13, H: 20 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "copper", context: "En fuktsensor kalibreras när vattenfritt koppar(II)klorid bildar dihydrat.", equation: "CuCl2(s) + 2 H2O(l) -> CuCl2·2H2O(s)", inputFormula: "CuCl2", inputAtoms: { Cu: 1, Cl: 2 }, inputCoefficient: 1, inputMassG: 58.6, outputFormula: "CuCl2·2H2O", outputAtoms: { Cu: 1, Cl: 2, H: 4, O: 2 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "magnesium", context: "Vid lagring binder magnesiumklorid vatten och övergår till hexahydrat.", equation: "MgCl2(s) + 6 H2O(l) -> MgCl2·6H2O(s)", inputFormula: "MgCl2", inputAtoms: { Mg: 1, Cl: 2 }, inputCoefficient: 1, inputMassG: 37.9, outputFormula: "MgCl2·6H2O", outputAtoms: { Mg: 1, Cl: 2, H: 12, O: 6 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "iron", context: "Ett mineralprov får stå i fuktig miljö så att järn(II)sulfat bildar heptahydrat.", equation: "FeSO4(s) + 7 H2O(l) -> FeSO4·7H2O(s)", inputFormula: "FeSO4", inputAtoms: { Fe: 1, S: 1, O: 4 }, inputCoefficient: 1, inputMassG: 91.6, outputFormula: "FeSO4·7H2O", outputAtoms: { Fe: 1, S: 1, O: 11, H: 14 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "calcium", context: "Ett saltprov av kalciumnitrat omvandlas fullständigt till tetrahydrat.", equation: "Ca(NO3)2(s) + 4 H2O(l) -> Ca(NO3)2·4H2O(s)", inputFormula: "Ca(NO3)2", inputAtoms: { Ca: 1, N: 2, O: 6 }, inputCoefficient: 1, inputMassG: 68.7, outputFormula: "Ca(NO3)2·4H2O", outputAtoms: { Ca: 1, N: 2, O: 10, H: 8 }, outputCoefficient: 1 },
    { family: "hydrate", rotationElement: "sodium", context: "I ett värmelager kristalliseras natriumsulfat som dekahydrat.", equation: "Na2SO4(s) + 10 H2O(l) -> Na2SO4·10H2O(s)", inputFormula: "Na2SO4", inputAtoms: { Na: 2, S: 1, O: 4 }, inputCoefficient: 1, inputMassG: 49.7, outputFormula: "Na2SO4·10H2O", outputAtoms: { Na: 2, S: 1, O: 14, H: 20 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "calcium", context: "Kalciummetall får reagera fullständigt med ett överskott av klorgas i en sluten behållare.", equation: "Ca(s) + Cl2(g) -> CaCl2(s)", inputFormula: "Ca", inputAtoms: { Ca: 1 }, inputCoefficient: 1, inputMassG: 16.4, outputFormula: "CaCl2", outputAtoms: { Ca: 1, Cl: 2 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "magnesium", context: "Ett magnesiumband förbränns i klorgas och ger endast magnesiumklorid.", equation: "Mg(s) + Cl2(g) -> MgCl2(s)", inputFormula: "Mg", inputAtoms: { Mg: 1 }, inputCoefficient: 1, inputMassG: 12.8, outputFormula: "MgCl2", outputAtoms: { Mg: 1, Cl: 2 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "copper", context: "Kopparpulver upphettas med syrgas tills koppar(II)oxid har bildats.", equation: "2 Cu(s) + O2(g) -> 2 CuO(s)", inputFormula: "Cu", inputAtoms: { Cu: 1 }, inputCoefficient: 2, inputMassG: 27.6, outputFormula: "CuO", outputAtoms: { Cu: 1, O: 1 }, outputCoefficient: 2 },
    { family: "formation", rotationElement: "iron", context: "Järnfilspån får reagera fullständigt med svavel i överskott och bildar järn(II)sulfid.", equation: "Fe(s) + S(s) -> FeS(s)", inputFormula: "Fe", inputAtoms: { Fe: 1 }, inputCoefficient: 1, inputMassG: 35.2, outputFormula: "FeS", outputAtoms: { Fe: 1, S: 1 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "sodium", context: "Natrium reagerar kontrollerat med svavel och allt natrium omvandlas till natriumsulfid.", equation: "2 Na(s) + S(s) -> Na2S(s)", inputFormula: "Na", inputAtoms: { Na: 1 }, inputCoefficient: 2, inputMassG: 18.7, outputFormula: "Na2S", outputAtoms: { Na: 2, S: 1 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "ammonium", context: "Ammoniak leds in i ett kärl med överskott av väteklorid och fast ammoniumklorid bildas.", equation: "NH3(g) + HCl(g) -> NH4Cl(s)", inputFormula: "NH3", inputAtoms: { N: 1, H: 3 }, inputCoefficient: 1, inputMassG: 9.20, outputFormula: "NH4Cl", outputAtoms: { N: 1, H: 4, Cl: 1 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "calcium", context: "Kalciummetall oxideras i ett slutet reaktionskärl och ger kalciumoxid.", equation: "2 Ca(s) + O2(g) -> 2 CaO(s)", inputFormula: "Ca", inputAtoms: { Ca: 1 }, inputCoefficient: 2, inputMassG: 23.6, outputFormula: "CaO", outputAtoms: { Ca: 1, O: 1 }, outputCoefficient: 2 },
    { family: "formation", rotationElement: "magnesium", context: "Magnesiumpulver reagerar med kvävgas och bildar magnesiumnitrid.", equation: "3 Mg(s) + N2(g) -> Mg3N2(s)", inputFormula: "Mg", inputAtoms: { Mg: 1 }, inputCoefficient: 3, inputMassG: 14.5, outputFormula: "Mg3N2", outputAtoms: { Mg: 3, N: 2 }, outputCoefficient: 1 },
    { family: "formation", rotationElement: "iron", context: "Järn reagerar i överskott av klorgas så att järn(III)klorid är enda järnprodukten.", equation: "2 Fe(s) + 3 Cl2(g) -> 2 FeCl3(s)", inputFormula: "Fe", inputAtoms: { Fe: 1 }, inputCoefficient: 2, inputMassG: 31.9, outputFormula: "FeCl3", outputAtoms: { Fe: 1, Cl: 3 }, outputCoefficient: 2 },
    { family: "formation", rotationElement: "aluminium", context: "I en demonstrationsreaktion bildas aluminiumoxid från aluminium och syrgas.", equation: "4 Al(s) + 3 O2(g) -> 2 Al2O3(s)", inputFormula: "Al", inputAtoms: { Al: 1 }, inputCoefficient: 4, inputMassG: 21.3, outputFormula: "Al2O3", outputAtoms: { Al: 2, O: 3 }, outputCoefficient: 2 }
  ];

  const PRECIPITATION_ROWS = [
    { prompt: "kalciumnitrat och natriumkarbonat", equation: "Ca(NO3)2(aq) + Na2CO3(aq) -> CaCO3(s) + 2 NaNO3(aq)" },
    { prompt: "kalciumklorid och ammoniumkarbonat", equation: "CaCl2(aq) + (NH4)2CO3(aq) -> CaCO3(s) + 2 NH4Cl(aq)" },
    { prompt: "magnesiumnitrat och natriumhydroxid", equation: "Mg(NO3)2(aq) + 2 NaOH(aq) -> Mg(OH)2(s) + 2 NaNO3(aq)" },
    { prompt: "magnesiumklorid och kaliumhydroxid", equation: "MgCl2(aq) + 2 KOH(aq) -> Mg(OH)2(s) + 2 KCl(aq)" },
    { prompt: "koppar(II)nitrat och natriumhydroxid", equation: "Cu(NO3)2(aq) + 2 NaOH(aq) -> Cu(OH)2(s) + 2 NaNO3(aq)" },
    { prompt: "koppar(II)klorid och kaliumhydroxid", equation: "CuCl2(aq) + 2 KOH(aq) -> Cu(OH)2(s) + 2 KCl(aq)" },
    { prompt: "järn(III)nitrat och natriumhydroxid", equation: "Fe(NO3)3(aq) + 3 NaOH(aq) -> Fe(OH)3(s) + 3 NaNO3(aq)" },
    { prompt: "järn(III)klorid och kaliumhydroxid", equation: "FeCl3(aq) + 3 KOH(aq) -> Fe(OH)3(s) + 3 KCl(aq)" },
    { prompt: "silvernitrat och kaliumklorid", equation: "AgNO3(aq) + KCl(aq) -> AgCl(s) + KNO3(aq)" },
    { prompt: "silvernitrat och kalciumklorid", equation: "2 AgNO3(aq) + CaCl2(aq) -> 2 AgCl(s) + Ca(NO3)2(aq)" },
    { prompt: "bariumnitrat och natriumsulfat", equation: "Ba(NO3)2(aq) + Na2SO4(aq) -> BaSO4(s) + 2 NaNO3(aq)" },
    { prompt: "bariumklorid och ammoniumsulfat", equation: "BaCl2(aq) + (NH4)2SO4(aq) -> BaSO4(s) + 2 NH4Cl(aq)" },
    { prompt: "kalciumnitrat och natriumfosfat", equation: "3 Ca(NO3)2(aq) + 2 Na3PO4(aq) -> Ca3(PO4)2(s) + 6 NaNO3(aq)" },
    { prompt: "magnesiumklorid och natriumfosfat", equation: "3 MgCl2(aq) + 2 Na3PO4(aq) -> Mg3(PO4)2(s) + 6 NaCl(aq)" },
    { prompt: "koppar(II)nitrat och natriumfosfat", equation: "3 Cu(NO3)2(aq) + 2 Na3PO4(aq) -> Cu3(PO4)2(s) + 6 NaNO3(aq)" },
    { prompt: "järn(III)sulfat och kaliumhydroxid", equation: "Fe2(SO4)3(aq) + 6 KOH(aq) -> 2 Fe(OH)3(s) + 3 K2SO4(aq)" },
    { prompt: "zinknitrat och natriumhydroxid", equation: "Zn(NO3)2(aq) + 2 NaOH(aq) -> Zn(OH)2(s) + 2 NaNO3(aq)" },
    { prompt: "zinkklorid och kaliumhydroxid", equation: "ZnCl2(aq) + 2 KOH(aq) -> Zn(OH)2(s) + 2 KCl(aq)" },
    { prompt: "aluminiumnitrat och natriumhydroxid", equation: "Al(NO3)3(aq) + 3 NaOH(aq) -> Al(OH)3(s) + 3 NaNO3(aq)" },
    { prompt: "aluminiumklorid och kaliumhydroxid", equation: "AlCl3(aq) + 3 KOH(aq) -> Al(OH)3(s) + 3 KCl(aq)" }
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

  function makeQuestion(row, index) {
    const caseNumber = index + 1;
    const precipitation = PRECIPITATION_ROWS[index];
    const figures = 3;
    const inputMolarMass = molarMass(row.inputAtoms);
    const outputMolarMass = molarMass(row.outputAtoms);
    const inputAmount = row.inputMassG / inputMolarMass;
    const outputAmount = inputAmount * row.outputCoefficient / row.inputCoefficient;
    const exactMass = outputAmount * outputMolarMass;
    const expectedMass = roundSignificant(exactMass, figures);
    const familyLabel = row.family === "hydrate" ? "Hydratserie" : "Bildningsserie";

    return {
      id: "chemistry-s2-" + row.family + "-" + String(caseNumber).padStart(2, "0"),
      slot: 2,
      title: familyLabel + " " + caseNumber,
      points: 7,
      promptHtml: "<p>" + row.context + "</p><p>a) Skriv den balanserade reaktionsformeln med aggregationstillstånd som digitalt slutsvar. b) Utgå från " + clean(row.inputMassG) + " g " + row.inputFormula + " och beräkna massan " + row.outputFormula + " när den andra reaktanten finns i överskott. Gör formelsamband, molmassor och substansmängdsförhållande i räknehäftet; ange endast slutsvaret i g med 3 värdesiffror i appen.</p><p>c) I ett separat prov blandas vattenlösningar av " + precipitation.prompt + ". Skriv en balanserad reaktionsformel med aggregationstillstånd som visar fällningen som digitalt slutsvar.</p>",
      fields: [
        { id: "reaction", label: "a) Balanserad reaktionsformel med tillstånd", kind: "chemical-equation", purpose: "equation", points: 2, expected: row.equation, requireStates: true, statePoints: 1 },
        { id: "mass", label: "b) Produktmassa (g; 3 värdesiffror)", kind: "numeric", applied: true, points: 3, expected: expectedMass, targetUnit: "g", requestedUnitLabel: "g", significantFigures: figures, tolerance: tolerance(expectedMass, figures), help: "Skriv endast slutsvaret här och redovisa beräkningen på papper." },
        { id: "precipitation", label: "c) Fällningsreaktion med tillstånd", kind: "chemical-equation", purpose: "equation", points: 2, expected: precipitation.equation, requireStates: true, statePoints: 1 }
      ],
      workOnPaper: {
        title: "Arbeta i räknehäftet",
        instruction: "Balansera båda reaktionsformlerna och visa molmassor, n = m/M och koefficientförhållanden i räknehäftet. I appen lämnar du endast de färdiga slutsvaren.",
        comparison: "Jämför balansering, aggregationstillstånd och stökiometriska mellanled med lösningen efter rättning."
      },
      solutionHtml: "<p><strong>a) Reaktion:</strong> " + row.equation + ". Koefficienterna ger det minsta heltalsförhållandet och alla ämnen har angivet aggregationstillstånd.</p><p><strong>b) Samband:</strong> n = m/M och m = nM. M(" + row.inputFormula + ") = " + clean(inputMolarMass) + " g/mol, så n = " + clean(row.inputMassG) + "/" + clean(inputMolarMass) + " = " + clean(inputAmount) + " mol. Koefficienterna ger n(" + row.outputFormula + ") = " + row.outputCoefficient + "/" + row.inputCoefficient + " · n(" + row.inputFormula + ") = " + clean(outputAmount) + " mol. Med M(" + row.outputFormula + ") = " + clean(outputMolarMass) + " g/mol fås m = " + clean(exactMass) + " g, alltså <strong>" + formatSignificant(expectedMass, figures) + " g</strong> med 3 värdesiffror.</p><p><strong>c) Fällning:</strong> " + precipitation.equation + ". Produkten märkt (s) är det svårlösliga ämnet; övriga salter är lösta och skrivs (aq).</p>",
      rubric: [
        { points: 1, text: "Rätt reaktanter och produkter samt bevarade atomslag i huvudreaktionen." },
        { points: 1, text: "Minsta balanserade koefficienter och korrekta aggregationstillstånd i huvudreaktionen." },
        { points: 1, text: "Korrekta molmassor från det bifogade periodiska systemet." },
        { points: 1, text: "n = m/M och reaktionskoefficienternas substansmängdsförhållande används korrekt." },
        { points: 1, text: "Rätt produktmassa, enhet g och avrundning till 3 värdesiffror." },
        { points: 1, text: "Fällningsreaktionens formler och koefficienter är korrekta." },
        { points: 1, text: "Samtliga aggregationstillstånd är angivna och den svårlösliga produkten är (s)." }
      ],
      sourceData: {
        skill: SKILL,
        family: row.family,
        caseNumber: caseNumber,
        rotationElement: row.rotationElement,
        primaryEquation: row.equation,
        precipitationEquation: precipitation.equation,
        stoichiometry: {
          inputFormula: row.inputFormula,
          inputMassG: row.inputMassG,
          inputCoefficient: row.inputCoefficient,
          inputMolarMassGPerMol: inputMolarMass,
          outputFormula: row.outputFormula,
          outputCoefficient: row.outputCoefficient,
          outputMolarMassGPerMol: outputMolarMass,
          exactOutputMassG: exactMass,
          significantFigures: figures
        }
      }
    };
  }

  return PRIMARY_ROWS.map(makeQuestion);
});
