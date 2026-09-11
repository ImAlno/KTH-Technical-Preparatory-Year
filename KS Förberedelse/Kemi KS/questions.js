(function (root, factory) {
  const isCommonJS = typeof module === "object" && module.exports && typeof require === "function";
  const configApi = isCommonJS ? require("../assets/js/subject-config.js") : root && root.KS && root.KS.subjectConfig;
  const slotSource = isCommonJS ? {
    1: require("./questions/slot-1.js"),
    2: require("./questions/slot-2.js"),
    3: require("./questions/slot-3.js"),
    4: require("./questions/slot-4.js"),
    5: require("./questions/slot-5.js"),
    6: require("./questions/slot-6.js")
  } : root && root.KS_CHEMISTRY_SLOTS;
  const subjectData = factory(configApi, slotSource);
  if (isCommonJS) module.exports = subjectData;
  if (root) root.KS_SUBJECT_DATA = subjectData;
})(typeof window !== "undefined" ? window : null, function (configApi, slotSource) {
  "use strict";

  if (!configApi || !configApi.SUBJECTS || !configApi.SUBJECTS.chemistry) {
    throw new Error("Kemi KS requires the shared subject configuration");
  }
  if (!slotSource || [1, 2, 3, 4, 5, 6].some(function (slot) { return !Array.isArray(slotSource[slot]); })) {
    throw new Error("Kemi KS requires all six question slot scripts before questions.js");
  }

  return {
    config: configApi.SUBJECTS.chemistry,
    slots: {
      1: slotSource[1],
      2: slotSource[2],
      3: slotSource[3],
      4: slotSource[4],
      5: slotSource[5],
      6: slotSource[6]
    },
    formulaSheetUrl: "assets/formelblad-ks.png",
    atomicMasses: {
      H: 1.01,
      B: 10.8,
      C: 12.0,
      N: 14.0,
      O: 16.0,
      F: 19.0,
      Na: 23.0,
      Mg: 24.3,
      Al: 27.0,
      Si: 28.1,
      P: 31.0,
      S: 32.1,
      Cl: 35.5,
      K: 39.1,
      Ca: 40.1,
      Fe: 55.8,
      Cu: 63.5,
      Zn: 65.4,
      Ag: 107.9,
      Ba: 137.3
    }
  };
});
