(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.units = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const UNIT_DEFINITIONS = {
    "1": { dimension: "dimensionless", factor: 1, aliases: ["1"] },
    "kg": { dimension: "mass", factor: 1, aliases: ["kg"] },
    "g": { dimension: "mass", factor: 1e-3, aliases: ["g", "gram"] },
    "mg": { dimension: "mass", factor: 1e-6, aliases: ["mg"] },
    "m": { dimension: "length", factor: 1, aliases: ["m", "meter"] },
    "cm": { dimension: "length", factor: 1e-2, aliases: ["cm"] },
    "mm": { dimension: "length", factor: 1e-3, aliases: ["mm"] },
    "km": { dimension: "length", factor: 1e3, aliases: ["km"] },
    "m2": { dimension: "area", factor: 1, aliases: ["m2", "m^2", "m²"] },
    "cm2": { dimension: "area", factor: 1e-4, aliases: ["cm2", "cm^2", "cm²"] },
    "mm2": { dimension: "area", factor: 1e-6, aliases: ["mm2", "mm^2", "mm²"] },
    "s": { dimension: "time", factor: 1, aliases: ["s", "sek", "sekund", "sekunder"] },
    "min": { dimension: "time", factor: 60, aliases: ["min", "minut", "minuter"] },
    "h": { dimension: "time", factor: 3600, aliases: ["h", "timme", "timmar"] },
    "m/s": { dimension: "speed", factor: 1, aliases: ["m/s", "ms-1", "m s-1"] },
    "km/h": { dimension: "speed", factor: 1 / 3.6, aliases: ["km/h", "kmh"] },
    "m/s2": { dimension: "acceleration", factor: 1, aliases: ["m/s2", "m/s^2", "m/s²", "ms-2"] },
    "N": { dimension: "force", factor: 1, aliases: ["N", "newton"] },
    "kN": { dimension: "force", factor: 1000, aliases: ["kN"] },
    "Pa": { dimension: "pressure", factor: 1, aliases: ["Pa"] },
    "kPa": { dimension: "pressure", factor: 1000, aliases: ["kPa"] },
    "m3": { dimension: "volume", factor: 1, aliases: ["m3", "m^3", "m³"] },
    "dm3": { dimension: "volume", factor: 1e-3, aliases: ["dm3", "dm^3", "dm³", "L", "liter"] },
    "cm3": { dimension: "volume", factor: 1e-6, aliases: ["cm3", "cm^3", "cm³", "mL", "ml"] },
    "kg/m3": { dimension: "density", factor: 1, aliases: ["kg/m3", "kg/m^3", "kg/m³"] },
    "g/cm3": { dimension: "density", factor: 1000, aliases: ["g/cm3", "g/cm^3", "g/cm³"] },
    "mol": { dimension: "amount", factor: 1, aliases: ["mol"] },
    "mol/dm3": { dimension: "concentration", factor: 1000, aliases: ["mol/dm3", "mol/dm^3", "mol/dm³", "M"] },
    "g/mol": { dimension: "molar-mass", factor: 1, aliases: ["g/mol", "g mol-1", "g·mol⁻¹"] },
    "kg/mol": { dimension: "molar-mass", factor: 1000, aliases: ["kg/mol", "kg mol-1", "kg·mol⁻¹"] },
    "%": { dimension: "percent", factor: 1, aliases: ["%", "procent"] }
  };

  function standardize(raw) {
    return String(raw)
      .normalize("NFC")
      .replace(/[−–—⁻]/g, "-")
      .replace(/¹/g, "1")
      .replace(/²/g, "2")
      .replace(/³/g, "3")
      .replace(/[·×]/g, "")
      .replace(/\s+/g, "")
      .replace(/\^/g, "^");
  }

  const aliases = Object.create(null);
  Object.keys(UNIT_DEFINITIONS).forEach(function (canonical) {
    UNIT_DEFINITIONS[canonical].aliases.forEach(function (alias) {
      aliases[standardize(alias)] = canonical;
    });
  });

  function normalizeUnit(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const value = standardize(raw);
    return aliases[value] || null;
  }

  function convert(value, fromUnit, toUnit) {
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    const numericValue = Number(value);
    if (!from || !to || !Number.isFinite(numericValue)) {
      return { ok: false, reason: "unknown-unit" };
    }
    if (UNIT_DEFINITIONS[from].dimension !== UNIT_DEFINITIONS[to].dimension) {
      return { ok: false, reason: "incompatible-dimension" };
    }
    return { ok: true, value: numericValue * UNIT_DEFINITIONS[from].factor / UNIT_DEFINITIONS[to].factor };
  }

  return { UNIT_DEFINITIONS, normalizeUnit, convert };
});
