(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.storage = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const memory = new Map();
  const PREFIX = "ks-practice:v1:";
  const DEFAULT_HISTORY = Object.freeze({ schemaVersion: 1, slots: Object.freeze({}) });

  function copy(value) {
    return value === null ? null : JSON.parse(JSON.stringify(value));
  }

  function createStore(adapter, namespace) {
    if (typeof namespace !== "string" || !namespace.trim()) throw new TypeError("A storage namespace is required");

    const keys = {
      active: PREFIX + namespace + ":active",
      history: PREFIX + namespace + ":history"
    };
    let available = Boolean(adapter);
    let warning = available ? "" : "Lokal lagring är inte tillgänglig. Provet sparas bara i minnet.";
    let activeReadStatus = "unread";

    function fail(message) {
      available = false;
      warning = message;
    }

    function read(name, fallback) {
      const key = keys[name];
      let raw;
      if (available) {
        try {
          raw = adapter.getItem(key);
        } catch (error) {
          fail("Lokal lagring är inte tillgänglig. Provet sparas bara i minnet.");
        }
      }
      if (!available) raw = memory.has(key) ? memory.get(key) : null;
      if (raw === null || raw === undefined) {
        if (name === "active") activeReadStatus = "missing";
        return copy(fallback);
      }
      try {
        const parsed = JSON.parse(raw);
        if (name === "active") activeReadStatus = "ok";
        return parsed;
      } catch (error) {
        if (name === "active") activeReadStatus = "corrupt";
        warning = "Sparad data är skadad och kunde inte läsas. Den ersätts först när nya data sparas.";
        return copy(fallback);
      }
    }

    function write(name, value) {
      const key = keys[name];
      const raw = JSON.stringify(value);
      memory.set(key, raw);
      if (available) {
        try {
          adapter.setItem(key, raw);
          return { ok: true, persisted: true };
        } catch (error) {
          fail("Lokal lagring är inte tillgänglig. Provet sparas bara i minnet.");
        }
      }
      return { ok: false, persisted: false };
    }

    function remove(name) {
      const key = keys[name];
      memory.delete(key);
      if (available) {
        try {
          adapter.removeItem(key);
          return { ok: true, persisted: true };
        } catch (error) {
          fail("Lokal lagring är inte tillgänglig. Ändringen gäller bara i minnet.");
        }
      }
      return { ok: false, persisted: false };
    }

    return {
      loadActive: function () { return read("active", null); },
      saveActive: function (snapshot) { return write("active", snapshot); },
      loadHistory: function () { return read("history", DEFAULT_HISTORY); },
      saveHistory: function (history) { return write("history", history); },
      clearHistory: function () { return remove("history"); },
      get activeReadStatus() { return activeReadStatus; },
      get persistenceAvailable() { return available; },
      get warning() { return warning; }
    };
  }

  return { createStore: createStore };
});
