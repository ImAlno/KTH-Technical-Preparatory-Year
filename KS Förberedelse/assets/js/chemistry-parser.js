(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.chemistry = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const ELEMENT_SYMBOLS = new Set((
    "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn " +
    "Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce " +
    "Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn " +
    "Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
  ).split(" "));
  const SUBSCRIPT_DIGITS = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
    "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9"
  };
  const SUPERSCRIPT_DIGITS = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9"
  };

  function replaceCharacters(value, replacements) {
    return Array.from(value).map(function (character) {
      return Object.prototype.hasOwnProperty.call(replacements, character) ? replacements[character] : character;
    }).join("");
  }

  function standardize(raw) {
    if (typeof raw !== "string") return null;
    let value = raw.normalize("NFC");
    value = replaceCharacters(value, SUBSCRIPT_DIGITS);
    value = value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?=[⁺⁻+\-])/g, function (digits) {
      return "^" + replaceCharacters(digits, SUPERSCRIPT_DIGITS);
    });
    return value
      .replace(/⁺/g, "+")
      .replace(/[⁻−–—]/g, "-")
      .replace(/[.⋅•]/g, "·")
      .replace(/\s+/g, "");
  }

  function failure(reason) {
    return { ok: false, reason: reason || "unparseable" };
  }

  function safePositiveInteger(raw) {
    if (!/^[1-9]\d*$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) ? value : null;
  }

  function addCounts(target, source, multiplier) {
    Object.keys(source).forEach(function (symbol) {
      const value = (target[symbol] || 0) + source[symbol] * multiplier;
      if (!Number.isSafeInteger(value)) throw new Error("count-overflow");
      target[symbol] = value;
    });
  }

  function sortedCounts(counts) {
    return Object.keys(counts).sort().reduce(function (sorted, symbol) {
      sorted[symbol] = counts[symbol];
      return sorted;
    }, {});
  }

  function countsKey(counts) {
    return Object.keys(counts).sort().map(function (symbol) {
      return symbol + ":" + counts[symbol];
    }).join(",");
  }

  function parseComponent(raw) {
    let position = 0;

    function readMultiplier() {
      const start = position;
      while (/\d/.test(raw[position] || "")) position += 1;
      if (position === start) return 1;
      const value = safePositiveInteger(raw.slice(start, position));
      if (value === null) throw new Error("invalid-subscript");
      return value;
    }

    function parseSequence(inGroup) {
      const counts = {};
      const identityParts = [];
      let itemCount = 0;

      while (position < raw.length && raw[position] !== ")") {
        let nested;
        let identity;
        if (raw[position] === "(") {
          position += 1;
          nested = parseSequence(true);
          if (raw[position] !== ")") throw new Error("missing-parenthesis");
          position += 1;
          identity = "(" + nested.identity + ")";
        } else if (/[A-Z]/.test(raw[position])) {
          let symbol = raw[position];
          position += 1;
          if (/[a-z]/.test(raw[position] || "")) {
            symbol += raw[position];
            position += 1;
          }
          if (!ELEMENT_SYMBOLS.has(symbol)) throw new Error("unknown-element");
          nested = { elements: {} };
          nested.elements[symbol] = 1;
          identity = symbol;
        } else {
          throw new Error("invalid-token");
        }

        const multiplier = readMultiplier();
        addCounts(counts, nested.elements, multiplier);
        identityParts.push(identity + (multiplier === 1 ? "" : String(multiplier)));
        itemCount += 1;
      }

      if (!itemCount) throw new Error("empty-group");
      if (inGroup && position >= raw.length) throw new Error("missing-parenthesis");
      return { elements: counts, identity: identityParts.join("") };
    }

    try {
      const parsed = parseSequence(false);
      if (position !== raw.length) return failure();
      return { ok: true, elements: sortedCounts(parsed.elements), identity: parsed.identity };
    } catch (error) {
      return failure();
    }
  }

  function parseFormula(raw) {
    try {
      let value = standardize(raw);
      if (!value) return failure(typeof raw === "string" ? "unparseable" : "invalid-input");

      let state = null;
      const stateMatch = value.match(/\((s|l|g|aq)\)$/);
      if (stateMatch) {
        state = stateMatch[1];
        value = value.slice(0, -stateMatch[0].length);
      }

      let charge = 0;
      const caretCharge = value.match(/\^([1-9]\d*)?([+-])$/);
      const singleCharge = caretCharge ? null : value.match(/([+-])$/);
      if (caretCharge) {
        const magnitude = caretCharge[1] ? safePositiveInteger(caretCharge[1]) : 1;
        if (magnitude === null) return failure();
        charge = caretCharge[2] === "+" ? magnitude : -magnitude;
        value = value.slice(0, -caretCharge[0].length);
      } else if (singleCharge) {
        charge = singleCharge[1] === "+" ? 1 : -1;
        value = value.slice(0, -1);
      }
      if (!value || /[+\-^]/.test(value)) return failure();

      const rawComponents = value.split("·");
      if (rawComponents.some(function (component) { return !component; })) return failure();
      const components = [];

      for (let index = 0; index < rawComponents.length; index += 1) {
        let componentRaw = rawComponents[index];
        let multiplier = 1;
        const leading = componentRaw.match(/^([1-9]\d*)(?=[A-Z(])/);
        if (leading) {
          if (index === 0) return failure("coefficient-not-formula");
          multiplier = safePositiveInteger(leading[1]);
          if (multiplier === null) return failure();
          componentRaw = componentRaw.slice(leading[1].length);
        }
        const parsed = parseComponent(componentRaw);
        if (!parsed.ok) return parsed;
        components.push({ multiplier: multiplier, elements: parsed.elements, identity: parsed.identity });
      }

      const elements = {};
      components.forEach(function (component) {
        addCounts(elements, component.elements, component.multiplier);
      });
      const hydrates = components.slice(1).map(function (component) {
        return { multiplier: component.multiplier, elements: component.elements };
      });
      const coreCanonical = countsKey(components[0].elements) + hydrates.map(function (component) {
        return "·" + component.multiplier + "*" + countsKey(component.elements);
      }).join("") + "|charge:" + charge;
      const identityCanonical = components[0].identity + components.slice(1).map(function (component) {
        return "·" + component.multiplier + "*" + component.identity;
      }).join("") + "|charge:" + charge;
      const canonical = identityCanonical + (state ? "|state:" + state : "");

      return {
        ok: true,
        elements: sortedCounts(elements),
        charge: charge,
        state: state,
        hydrates: hydrates,
        coreCanonical: coreCanonical,
        compositionCanonical: coreCanonical + (state ? "|state:" + state : ""),
        identityCanonical: identityCanonical,
        canonical: canonical
      };
    } catch (error) {
      return failure();
    }
  }

  function normalizeFormula(raw) {
    const parsed = parseFormula(raw);
    return parsed.ok ? parsed.canonical : null;
  }

  function parseSpecies(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return failure();
    if (/\s[+-]$/.test(trimmed)) return failure("ambiguous");
    const coefficientMatch = trimmed.match(/^([1-9]\d*)\s*(?=[A-Z(])/);
    let coefficient = 1;
    let formulaRaw = trimmed;
    if (coefficientMatch) {
      coefficient = safePositiveInteger(coefficientMatch[1]);
      if (coefficient === null) return failure();
      formulaRaw = trimmed.slice(coefficientMatch[0].length);
    } else if (/^\d/.test(trimmed)) {
      return failure();
    }
    const formula = parseFormula(formulaRaw);
    return formula.ok ? { ok: true, coefficient: coefficient, formula: formula } : formula;
  }

  function parseSide(raw) {
    const plusPositions = [];
    for (let index = 0; index < raw.length; index += 1) {
      if (raw[index] === "+") plusPositions.push(index);
    }
    if (plusPositions.length > 64) return failure("too-many-species");

    const solutions = [];
    function visit(start, species) {
      if (solutions.length > 1) return;
      const boundaries = plusPositions.filter(function (position) { return position >= start; }).concat([raw.length]);
      boundaries.forEach(function (end) {
        if (solutions.length > 1) return;
        const parsed = parseSpecies(raw.slice(start, end));
        if (!parsed.ok) return;
        const next = species.concat([parsed]);
        if (end === raw.length) {
          solutions.push(next);
        } else {
          visit(end + 1, next);
        }
      });
    }
    visit(0, []);
    return solutions.length === 1 ? { ok: true, species: solutions[0] } : failure(solutions.length ? "ambiguous" : "unparseable");
  }

  function greatestCommonDivisor(left, right) {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    return a;
  }

  function normalizedSide(species, requireStates) {
    const totals = {};
    species.forEach(function (item) {
      const key = item.formula.coreCanonical + (requireStates ? "|state:" + (item.formula.state || "") : "");
      const total = (totals[key] || 0) + item.coefficient;
      if (!Number.isSafeInteger(total)) throw new Error("coefficient-overflow");
      totals[key] = total;
    });
    return totals;
  }

  function normalizedEquation(parsed, requireStates) {
    const reactants = normalizedSide(parsed.reactants, requireStates);
    const products = normalizedSide(parsed.products, requireStates);
    const coefficients = Object.keys(reactants).map(function (key) { return reactants[key]; })
      .concat(Object.keys(products).map(function (key) { return products[key]; }));
    const divisor = coefficients.reduce(greatestCommonDivisor);

    function sideKey(side) {
      return Object.keys(side).sort().map(function (key) {
        return key + "@" + side[key] / divisor;
      }).join("+");
    }
    return sideKey(reactants) + "->" + sideKey(products);
  }

  function parseEquation(raw) {
    try {
      if (typeof raw !== "string" || !raw.trim()) return failure(typeof raw === "string" ? "unparseable" : "invalid-input");
      const arrows = raw.match(/->|→|=|⇌/g) || [];
      if (arrows.length !== 1) return failure();
      const arrowIndex = raw.indexOf(arrows[0]);
      const leftRaw = raw.slice(0, arrowIndex);
      const rightRaw = raw.slice(arrowIndex + arrows[0].length);
      if (!leftRaw.trim() || !rightRaw.trim()) return failure();

      const reactants = parseSide(leftRaw);
      const products = parseSide(rightRaw);
      if (!reactants.ok || !products.ok) return failure(reactants.reason === "ambiguous" || products.reason === "ambiguous" ? "ambiguous" : "unparseable");
      const parsed = { ok: true, reactants: reactants.species, products: products.species };
      parsed.canonical = normalizedEquation(parsed, true);
      return parsed;
    } catch (error) {
      return failure();
    }
  }

  function equivalentEquations(left, right, options) {
    try {
      const settings = options === undefined ? {} : options;
      if (!settings || typeof settings !== "object" || (settings.requireStates !== undefined && typeof settings.requireStates !== "boolean")) {
        return { equivalent: null, reason: "invalid-options" };
      }
      const leftParsed = parseEquation(left);
      const rightParsed = parseEquation(right);
      if (!leftParsed.ok || !rightParsed.ok) return { equivalent: null, reason: "unparseable" };

      const withoutStates = normalizedEquation(leftParsed, false) === normalizedEquation(rightParsed, false);
      if (!withoutStates) return { equivalent: false, reason: "different-equation" };
      if (settings.requireStates && normalizedEquation(leftParsed, true) !== normalizedEquation(rightParsed, true)) {
        return { equivalent: false, reason: "state-mismatch" };
      }
      return { equivalent: true };
    } catch (error) {
      return { equivalent: null, reason: "unparseable" };
    }
  }

  return { normalizeFormula, parseFormula, parseEquation, equivalentEquations };
});
