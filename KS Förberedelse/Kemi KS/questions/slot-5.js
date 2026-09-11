(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_CHEMISTRY_SLOTS = root.KS_CHEMISTRY_SLOTS || {};
    root.KS_CHEMISTRY_SLOTS[5] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SKILL = "stoichiometry-and-gas-law";
  const R = 8.314;
  const ATOMIC_MASSES = { H: 1.01, C: 12.0, N: 14.0, O: 16.0, Na: 23.0, Mg: 24.3, Cl: 35.5, K: 39.1, Ca: 40.1, Fe: 55.8, Cu: 63.5, Zn: 65.4, Ag: 107.9 };
  const ROWS = [
    { scene: "Ett prov av kalksten upphettas i en analysugn.", reaction: "CaCO3(s) -> CaO(s) + CO2(g)", inputType: "mass", inputFormula: "CaCO3", inputAtoms: { Ca: 1, C: 1, O: 3 }, inputMassG: 12.5, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 98500, temperatureK: 296.15, targetUnit: "dm3" },
    { scene: "Magnesiumkarbonat sönderdelas i ett förslutet försöksrör och koldioxiden samlas upp.", reaction: "MgCO3(s) -> MgO(s) + CO2(g)", inputType: "mass", inputFormula: "MgCO3", inputAtoms: { Mg: 1, C: 1, O: 3 }, inputMassG: 18.2, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 104000, temperatureK: 301.15, targetUnit: "m3" },
    { scene: "Ett grönt koppar(II)karbonatprov värms tills endast koppar(II)oxid återstår.", reaction: "CuCO3(s) -> CuO(s) + CO2(g)", inputType: "mass", inputFormula: "CuCO3", inputAtoms: { Cu: 1, C: 1, O: 3 }, inputMassG: 24.6, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 94300, temperatureK: 289.15, targetUnit: "dm3" },
    { scene: "Zinkkarbonat sönderdelas fullständigt och den torra koldioxiden leds till en gaspåse.", reaction: "ZnCO3(s) -> ZnO(s) + CO2(g)", inputType: "mass", inputFormula: "ZnCO3", inputAtoms: { Zn: 1, C: 1, O: 3 }, inputMassG: 17.8, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 87500, temperatureK: 307.15, targetUnit: "m3" },
    { scene: "Väteperoxid sönderdelas med en katalysator och syrgasen samlas efter att vattnet avskilts.", reaction: "2 H2O2(l) -> 2 H2O(l) + O2(g)", inputType: "mass", inputFormula: "H2O2", inputAtoms: { H: 2, O: 2 }, inputMassG: 8.75, inputCoefficient: 2, gasFormula: "O2", gasCoefficient: 1, pressurePa: 101500, temperatureK: 298.15, targetUnit: "dm3" },
    { scene: "Silveroxid sönderdelas vid upphettning och den bildade syrgasen förs till en mätkolv för gas.", reaction: "2 Ag2O(s) -> 4 Ag(s) + O2(g)", inputType: "mass", inputFormula: "Ag2O", inputAtoms: { Ag: 2, O: 1 }, inputMassG: 31.4, inputCoefficient: 2, gasFormula: "O2", gasCoefficient: 1, pressurePa: 112000, temperatureK: 315.15, targetUnit: "m3" },
    { scene: "Magnesium reagerar fullständigt med ett överskott av utspädd vätekloridlösning.", reaction: "Mg(s) + 2 HCl(aq) -> MgCl2(aq) + H2(g)", inputType: "mass", inputFormula: "Mg", inputAtoms: { Mg: 1 }, inputMassG: 6.20, inputCoefficient: 1, gasFormula: "H2", gasCoefficient: 1, pressurePa: 96700, temperatureK: 292.15, targetUnit: "dm3" },
    { scene: "Zinkkorn får reagera klart med vätekloridlösning och vätgasen samlas utan läckage.", reaction: "Zn(s) + 2 HCl(aq) -> ZnCl2(aq) + H2(g)", inputType: "mass", inputFormula: "Zn", inputAtoms: { Zn: 1 }, inputMassG: 9.85, inputCoefficient: 1, gasFormula: "H2", gasCoefficient: 1, pressurePa: 90500, temperatureK: 303.15, targetUnit: "m3" },
    { scene: "Järn reagerar med väteklorid så att järn(II)klorid och vätgas bildas.", reaction: "Fe(s) + 2 HCl(aq) -> FeCl2(aq) + H2(g)", inputType: "mass", inputFormula: "Fe", inputAtoms: { Fe: 1 }, inputMassG: 11.2, inputCoefficient: 1, gasFormula: "H2", gasCoefficient: 1, pressurePa: 109000, temperatureK: 284.15, targetUnit: "dm3" },
    { scene: "I en syntesreaktor förbrukas en uppmätt substansmängd kväve medan vätgas finns i överskott.", reaction: "N2(g) + 3 H2(g) -> 2 NH3(g)", inputType: "amount", inputFormula: "N2", inputAtoms: { N: 2 }, inputAmountMol: 0.420, inputCoefficient: 1, gasFormula: "NH3", gasCoefficient: 2, pressurePa: 125000, temperatureK: 333.15, targetUnit: "m3" },
    { scene: "Ammoniak sönderdelas fullständigt och den bildade vätgasen separeras från kvävet.", reaction: "2 NH3(g) -> N2(g) + 3 H2(g)", inputType: "mass", inputFormula: "NH3", inputAtoms: { N: 1, H: 3 }, inputMassG: 13.6, inputCoefficient: 2, gasFormula: "H2", gasCoefficient: 3, pressurePa: 118000, temperatureK: 321.15, targetUnit: "dm3" },
    { scene: "Rent kol förbränns fullständigt i syrgas och koldioxiden kyls till mättemperaturen.", reaction: "C(s) + O2(g) -> CO2(g)", inputType: "mass", inputFormula: "C", inputAtoms: { C: 1 }, inputMassG: 7.50, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 102000, temperatureK: 295.15, targetUnit: "m3" },
    { scene: "Kolmonoxid oxideras fullständigt i en katalytisk behållare med syrgas i överskott.", reaction: "2 CO(g) + O2(g) -> 2 CO2(g)", inputType: "amount", inputFormula: "CO", inputAtoms: { C: 1, O: 1 }, inputAmountMol: 0.335, inputCoefficient: 2, gasFormula: "CO2", gasCoefficient: 2, pressurePa: 99000, temperatureK: 310.15, targetUnit: "dm3" },
    { scene: "Metan förbränns fullständigt; vattnet kondenseras bort innan koldioxiden mäts.", reaction: "CH4(g) + 2 O2(g) -> CO2(g) + 2 H2O(l)", inputType: "amount", inputFormula: "CH4", inputAtoms: { C: 1, H: 4 }, inputAmountMol: 0.275, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 107000, temperatureK: 300.15, targetUnit: "m3" },
    { scene: "Natriumkarbonat reagerar med väteklorid och den frigjorda koldioxiden samlas torr.", reaction: "Na2CO3(s) + 2 HCl(aq) -> 2 NaCl(aq) + H2O(l) + CO2(g)", inputType: "mass", inputFormula: "Na2CO3", inputAtoms: { Na: 2, C: 1, O: 3 }, inputMassG: 15.9, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 93200, temperatureK: 287.15, targetUnit: "dm3" },
    { scene: "Natriumvätekarbonat upphettas och vattenångan kondenseras innan koldioxiden mäts.", reaction: "2 NaHCO3(s) -> Na2CO3(s) + H2O(g) + CO2(g)", inputType: "mass", inputFormula: "NaHCO3", inputAtoms: { Na: 1, H: 1, C: 1, O: 3 }, inputMassG: 21.7, inputCoefficient: 2, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 83600, temperatureK: 308.15, targetUnit: "m3" },
    { scene: "Ammoniumkarbonat sönderdelas; koldioxiden separeras från ammoniak och vattenånga.", reaction: "(NH4)2CO3(s) -> 2 NH3(g) + CO2(g) + H2O(g)", inputType: "amount", inputFormula: "(NH4)2CO3", inputAtoms: { N: 2, H: 8, C: 1, O: 3 }, inputAmountMol: 0.460, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 115000, temperatureK: 340.15, targetUnit: "dm3" },
    { scene: "Järn(II)karbonat sönderdelas och den bildade koldioxiden förs till ett separat kärl.", reaction: "FeCO3(s) -> FeO(s) + CO2(g)", inputType: "mass", inputFormula: "FeCO3", inputAtoms: { Fe: 1, C: 1, O: 3 }, inputMassG: 14.8, inputCoefficient: 1, gasFormula: "CO2", gasCoefficient: 1, pressurePa: 78000, temperatureK: 318.15, targetUnit: "m3" },
    { scene: "Kaliumnitrat värms kontrollerat och syrgasen samlas upp separat.", reaction: "2 KNO3(s) -> 2 KNO2(s) + O2(g)", inputType: "mass", inputFormula: "KNO3", inputAtoms: { K: 1, N: 1, O: 3 }, inputMassG: 22.6, inputCoefficient: 2, gasFormula: "O2", gasCoefficient: 1, pressurePa: 106000, temperatureK: 326.15, targetUnit: "dm3" },
    { scene: "Natriumnitrat sönderdelas i ett slutet system och en känd substansmängd används.", reaction: "2 NaNO3(s) -> 2 NaNO2(s) + O2(g)", inputType: "amount", inputFormula: "NaNO3", inputAtoms: { Na: 1, N: 1, O: 3 }, inputAmountMol: 0.720, inputCoefficient: 2, gasFormula: "O2", gasCoefficient: 1, pressurePa: 89000, temperatureK: 279.15, targetUnit: "m3" }
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
    const figures = 3;
    const hasOtherReactants = row.reaction.slice(0, row.reaction.indexOf("->")).includes("+");
    const reactionAssumption = {
      kind: hasOtherReactants ? "named-input-limiting" : "complete-decomposition",
      namedInputFormula: row.inputFormula,
      namedInputFullyConsumed: true,
      otherReactantsInExcess: hasOtherReactants
    };
    const assumptionText = hasOtherReactants
      ? "Alla övriga reaktanter finns i överskott, och den angivna mängden " + row.inputFormula + " förbrukas fullständigt."
      : "Anta att sönderdelningen är fullständig, så hela den angivna mängden " + row.inputFormula + " omvandlas.";
    const inputMolarMass = molarMass(row.inputAtoms);
    const inputMoles = row.inputType === "mass" ? row.inputMassG / inputMolarMass : row.inputAmountMol;
    const gasAmount = inputMoles * row.gasCoefficient / row.inputCoefficient;
    const volumeM3 = gasAmount * R * row.temperatureK / row.pressurePa;
    const requestedValue = row.targetUnit === "dm3" ? volumeM3 * 1000 : volumeM3;
    const expected = roundSignificant(requestedValue, figures);
    const unitLabel = row.targetUnit === "dm3" ? "dm³" : "m³";
    const inputDescription = row.inputType === "mass"
      ? clean(row.inputMassG) + " g " + row.inputFormula
      : clean(row.inputAmountMol) + " mol " + row.inputFormula;
    const amountStep = row.inputType === "mass"
      ? "M(" + row.inputFormula + ") = " + clean(inputMolarMass) + " g/mol och n = m/M = " + clean(row.inputMassG) + "/" + clean(inputMolarMass) + " = " + clean(inputMoles) + " mol."
      : "Den givna substansmängden är n(" + row.inputFormula + ") = " + clean(inputMoles) + " mol.";
    return {
      id: "chemistry-s5-gas-" + String(caseNumber).padStart(2, "0"),
      slot: 5,
      title: "Gasinsamling " + caseNumber,
      points: 2,
      promptHtml: "<p>" + row.scene + " Den balanserade reaktionen är <strong>" + row.reaction + "</strong></p><p>Utgå från " + inputDescription + ". " + assumptionText + " Gasen " + row.gasFormula + " mäts vid " + clean(row.pressurePa / 1000) + " kPa och " + clean(row.temperatureK - 273.15) + " °C. Beräkna med pV = nRT den slutliga volymen i " + unitLabel + " och avrunda till 3 värdesiffror.</p>",
      fields: [{ id: "volume", label: "Gasvolym (" + unitLabel + "; 3 värdesiffror)", kind: "numeric", applied: true, points: 2, expected: expected, targetUnit: row.targetUnit, requestedUnitLabel: unitLabel, significantFigures: figures, tolerance: tolerance(expected, figures), help: "Du kan skriva talet med eller utan den angivna volymenheten." }],
      solutionHtml: "<p><strong>Reaktionsantagande:</strong> " + assumptionText + "</p><p><strong>Substansmängd:</strong> " + amountStep + " Reaktionskoefficienterna ger n(" + row.gasFormula + ") = " + row.gasCoefficient + "/" + row.inputCoefficient + " · " + clean(inputMoles) + " = " + clean(gasAmount) + " mol.</p><p><strong>Allmänna gaslagen:</strong> p = " + clean(row.pressurePa) + " Pa och T = " + clean(row.temperatureK) + " K. V = nRT/p = " + clean(gasAmount) + "·8,314·" + clean(row.temperatureK) + "/" + clean(row.pressurePa) + " = " + clean(volumeM3) + " m³. Efter dimensionssäker omvandling och avrundning blir svaret <strong>" + formatSignificant(expected, figures) + " " + unitLabel + "</strong> (3 värdesiffror).</p>",
      rubric: [
        { points: 1, text: "Substansmängden gas bestäms med rätt molmassa vid behov och rätt koefficientförhållande ur den balanserade reaktionen." },
        { points: 1, text: "p anges i Pa, T i K och pV = nRT ger rätt volym, enhet och avrundning till 3 värdesiffror." }
      ],
      sourceData: {
        skill: SKILL,
        family: "gas-yield",
        caseNumber: caseNumber,
        reaction: row.reaction,
        reactionAssumption: reactionAssumption,
        inputType: row.inputType,
        inputFormula: row.inputFormula,
        inputMassG: row.inputMassG,
        inputAmountMol: row.inputAmountMol,
        inputMolarMassGPerMol: inputMolarMass,
        inputCoefficient: row.inputCoefficient,
        gasFormula: row.gasFormula,
        gasCoefficient: row.gasCoefficient,
        gasAmountMol: gasAmount,
        pressurePa: row.pressurePa,
        temperatureK: row.temperatureK,
        gasConstantJPerMolK: R,
        volumeM3: volumeM3,
        targetUnit: row.targetUnit,
        significantFigures: figures
      }
    };
  }

  return ROWS.map(makeQuestion);
});
