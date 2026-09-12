(function (root, factory) {
  const bank = factory();
  if (typeof module === "object" && module.exports) module.exports = bank;
  if (root) {
    root.KS_CHEMISTRY_SLOTS = root.KS_CHEMISTRY_SLOTS || {};
    root.KS_CHEMISTRY_SLOTS[4] = bank;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const SKILL = "bonding-and-phase-change";
  const SOLID_ITEMS = [
    ["järn smälter: Fe(s) → Fe(l)", "metallbindning", "metallic"],
    ["natriumklorid smälter: NaCl(s) → NaCl(l)", "jonbindning", "ionic"],
    ["koppar smälter: Cu(s) → Cu(l)", "metallbindning", "metallic"],
    ["magnesiumoxid smälter: MgO(s) → MgO(l)", "jonbindning", "ionic"],
    ["aluminium smälter: Al(s) → Al(l)", "metallbindning", "metallic"],
    ["kalciumklorid smälter: CaCl2(s) → CaCl2(l)", "jonbindning", "ionic"],
    ["natrium smälter: Na(s) → Na(l)", "metallbindning", "metallic"],
    ["kaliumbromid smälter: KBr(s) → KBr(l)", "jonbindning", "ionic"],
    ["zink smälter: Zn(s) → Zn(l)", "metallbindning", "metallic"],
    ["magnesiumklorid smälter: MgCl2(s) → MgCl2(l)", "jonbindning", "ionic"],
    ["silver smälter: Ag(s) → Ag(l)", "metallbindning", "metallic"],
    ["natriumsulfat smälter: Na2SO4(s) → Na2SO4(l)", "jonbindning", "ionic"],
    ["magnesium smälter: Mg(s) → Mg(l)", "metallbindning", "metallic"],
    ["kalciumoxid smälter: CaO(s) → CaO(l)", "jonbindning", "ionic"],
    ["en järntråd övergår till smälta: Fe(s) → Fe(l)", "metallbindning", "metallic"],
    ["kaliumklorid smälter: KCl(s) → KCl(l)", "jonbindning", "ionic"],
    ["en kopparbit övergår till vätska: Cu(s) → Cu(l)", "metallbindning", "metallic"],
    ["natriumkarbonat smälter: Na2CO3(s) → Na2CO3(l)", "jonbindning", "ionic"],
    ["aluminiumfolie smälter: Al(s) → Al(l)", "metallbindning", "metallic"],
    ["kalciumfluorid smälter: CaF2(s) → CaF2(l)", "jonbindning", "ionic"]
  ];
  const MOLECULAR_A = [
    ["vatten förångas: H2O(l) → H2O(g)", "vätebindning", "hydrogen"],
    ["flytande väteklorid förångas: HCl(l) → HCl(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["flytande metan förångas: CH4(l) → CH4(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["flytande ammoniak förångas: NH3(l) → NH3(g)", "vätebindning", "hydrogen"],
    ["flytande svaveldioxid förångas: SO2(l) → SO2(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["torris sublimerar: CO2(s) → CO2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["metanol förångas: CH3OH(l) → CH3OH(g)", "vätebindning", "hydrogen"],
    ["klormetan förångas: CH3Cl(l) → CH3Cl(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["flytande klor förångas: Cl2(l) → Cl2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["etanol förångas: C2H5OH(l) → C2H5OH(g)", "vätebindning", "hydrogen"],
    ["flytande svavelväte förångas: H2S(l) → H2S(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["fast brom sublimerar under lågt tryck: Br2(s) → Br2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["flytande vätefluorid förångas: HF(l) → HF(g)", "vätebindning", "hydrogen"],
    ["diklormetan förångas: CH2Cl2(l) → CH2Cl2(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["flytande kväve förångas: N2(l) → N2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["is sublimerar direkt: H2O(s) → H2O(g)", "vätebindning", "hydrogen"],
    ["fosfortriklorid förångas: PCl3(l) → PCl3(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["flytande syre förångas: O2(l) → O2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["fast ammoniak sublimerar: NH3(s) → NH3(g)", "vätebindning", "hydrogen"],
    ["kiseltetraklorid förångas: SiCl4(l) → SiCl4(g)", "dispersionskraft (van der Waals)", "dispersion"]
  ];
  const MOLECULAR_B = [
    ["ett annat ammoniakprov går till gasfas: NH3(l) → NH3(g)", "vätebindning", "hydrogen"],
    ["svaveldioxid lämnar vätskefasen: SO2(l) → SO2(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["ett koldioxidkorn sublimerar: CO2(s) → CO2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["en vattendroppe kokar: H2O(l) → H2O(g)", "vätebindning", "hydrogen"],
    ["klormetan lämnar en kyld vätska: CH3Cl(l) → CH3Cl(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["metan lämnar vätskefasen: CH4(l) → CH4(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["vätefluorid går från vätska till gas: HF(l) → HF(g)", "vätebindning", "hydrogen"],
    ["väteklorid lämnar vätskefasen: HCl(l) → HCl(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["tetraklormetan förångas: CCl4(l) → CCl4(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["en metanoldroppe förångas: CH3OH(l) → CH3OH(g)", "vätebindning", "hydrogen"],
    ["diklormetan lämnar vätskefasen: CH2Cl2(l) → CH2Cl2(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["koldisulfid förångas: CS2(l) → CS2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["etanol går över i gasfas: C2H5OH(l) → C2H5OH(g)", "vätebindning", "hydrogen"],
    ["svavelväte lämnar vätskefasen: H2S(l) → H2S(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["bortrifluorid lämnar vätskefasen: BF3(l) → BF3(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["ett kylt ammoniakprov förångas: NH3(l) → NH3(g)", "vätebindning", "hydrogen"],
    ["väteklorid förångas i ett slutet rör: HCl(l) → HCl(g)", "dipol–dipolbindning", "dipole-dipole"],
    ["klor sublimerar i ett mycket kallt försök: Cl2(s) → Cl2(g)", "dispersionskraft (van der Waals)", "dispersion"],
    ["ett tunt islager sublimerar: H2O(s) → H2O(g)", "vätebindning", "hydrogen"],
    ["svaveldioxid förångas i en ampull: SO2(l) → SO2(g)", "dipol–dipolbindning", "dipole-dipole"]
  ];
  const REACTION_ITEMS = [
    ["i reaktionen H2 + Cl2 → 2 HCl bryts H–H-bindningen i H2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["i reaktionen 2 H2 + O2 → 2 H2O bryts O=O-bindningen i O2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["i reaktionen N2 + 3 H2 → 2 NH3 bryts N≡N-bindningen i N2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när 2 H2O2 → 2 H2O + O2 sker bryts O–O-bindningen i H2O2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["i reaktionen 2 CO + O2 → 2 CO2 bryts O=O-bindningen i O2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när 2 NH3 → N2 + 3 H2 sker bryts N–H-bindningar i NH3", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid CH4 + 2 O2 → CO2 + 2 H2O bryts C–H-bindningar i CH4", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["i 2 SO2 + O2 → 2 SO3 bryts O=O-bindningen i O2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid 4 P + 5 O2 → 2 P2O5 bryts O=O-bindningen i O2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när 2 HCl → H2 + Cl2 sker bryts H–Cl-bindningar", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid 2 H2O → 2 H2 + O2 bryts O–H-bindningar inne i vattenmolekyler", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när 2 HF → H2 + F2 sker bryts H–F-bindningar", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när Cl2 delas till två kloratomer bryts Cl–Cl-bindningen", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när O2 delas till två syreatomer bryts O=O-bindningen", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när N2 delas till två kväveatomer bryts N≡N-bindningen", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid 2 NO2 → 2 NO + O2 bryts N–O-bindningar", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid CS2 + 3 O2 → CO2 + 2 SO2 bryts C=S-bindningar i CS2", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["när CCl4 sönderdelas och C–Cl-bindningar bryts", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid PCl3 + Cl2 → PCl5 bryts Cl–Cl-bindningar i klorgasen", "kovalent intramolekylär bindning", "covalent-intramolecular"],
    ["vid 2 H2S + 3 O2 → 2 SO2 + 2 H2O bryts S–H-bindningar i H2S", "kovalent intramolekylär bindning", "covalent-intramolecular"]
  ];

  const PHASE_OPTIONS = [
    { value: "metallic", label: "Metallbindning" },
    { value: "ionic", label: "Jonbindning" },
    { value: "hydrogen", label: "Vätebindning" },
    { value: "dipole-dipole", label: "Dipol–dipolbindning" },
    { value: "dispersion", label: "Dispersionskraft" }
  ];
  const REACTION_OPTIONS = [
    { value: "covalent-intramolecular", label: "Kovalent intramolekylär bindning" }
  ];

  function item(tuple, process) {
    return { text: tuple[0], answer: tuple[1], bondType: tuple[2], process: process };
  }

  function makeQuestion(_, index) {
    const caseNumber = index + 1;
    const items = [item(SOLID_ITEMS[index], "phase-change"), item(MOLECULAR_A[index], "phase-change"), item(MOLECULAR_B[index], "phase-change"), item(REACTION_ITEMS[index], "reaction")];
    const promptItems = items.map(function (entry, itemIndex) { return String.fromCharCode(97 + itemIndex) + ") " + entry.text; }).join("<br>");
    const solutionItems = items.map(function (entry, itemIndex) { return "<li><strong>" + String.fromCharCode(97 + itemIndex) + ") " + entry.answer + ".</strong> " + (entry.process === "phase-change" ? "Detta är den dominerande bindningen eller kraften mellan partiklarna. Vid fasövergången övervinns sådan attraktion, medan de kovalenta bindningarna inne i en molekyl är kvar." : "Detta är en kemisk reaktion, så en intramolekylär bindning inne i reaktantens molekyl bryts när nya bindningar bildas.") + "</li>"; }).join("");
    return {
      id: "chemistry-s4-bonding-" + String(caseNumber).padStart(2, "0"),
      slot: 4,
      title: "Bindningskontroll " + caseNumber,
      points: 2,
      promptHtml: "<p>För fasövergångarna a–c väljer du den dominerande bindningen eller intermolekylära kraften mellan partiklarna i ämnet. För den kemiska reaktionen d väljer du typen av intramolekylär bindning som bryts. Välj endast ett digitalt slutsvar för varje del och skriv den korta motiveringen i räknehäftet.</p><p>" + promptItems + "</p>",
      fields: items.map(function (entry, itemIndex) {
        const letter = String.fromCharCode(97 + itemIndex);
        return {
          id: "part-" + letter,
          label: letter + ") Bindning eller kraft",
          kind: "choice",
          points: 0.5,
          expected: entry.bondType,
          options: entry.process === "phase-change" ? PHASE_OPTIONS : REACTION_OPTIONS,
          help: "Välj klassificeringen; skriv förklaringen i räknehäftet."
        };
      }),
      workOnPaper: {
        title: "Arbeta i räknehäftet",
        instruction: "Skriv den korta motiveringen för del a–d i räknehäftet. Skilj mellan dominerande attraktion mellan partiklar vid fasövergång och kovalent bindning inne i reaktantmolekylen; i appen väljer du endast slutsvaren.",
        comparison: "Jämför partikelinteraktioner och intramolekylär bindning med den fyrdelade lösningschecklistan efter rättning."
      },
      solutionHtml: "<ol type=\"a\">" + solutionItems + "</ol><p><strong>Viktig skillnad:</strong> smältning och förångning förändrar avstånd och ordning mellan partiklar. En kemisk reaktion förändrar däremot vilka atomer som är kovalent bundna till varandra.</p>",
      rubric: items.map(function (entry, itemIndex) {
        const letter = String.fromCharCode(97 + itemIndex);
        const distinction = entry.process === "phase-change"
          ? "anges som den dominerande bindningen eller kraften mellan partiklarna i fasövergången"
          : "anges som den intramolekylära bindningstyp som bryts i den kemiska reaktionen";
        return { points: 0.5, text: "Del " + letter + ": " + entry.answer + " " + distinction + "." };
      }),
      sourceData: { skill: SKILL, family: "bond-checklist", caseNumber: caseNumber, items: items }
    };
  }

  return Array.from({ length: 20 }, makeQuestion);
});
