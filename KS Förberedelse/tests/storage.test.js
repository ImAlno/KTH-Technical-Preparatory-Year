const test = require("node:test");
const assert = require("node:assert/strict");
const storage = require("../assets/js/storage.js");

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

test("store isolates each subject namespace and versions its keys", () => {
  const adapter = memoryStorage();
  storage.createStore(adapter, "math-ks2").saveHistory({ schemaVersion: 1, slots: { 1: { queue: ["m1"], lastId: null } } });

  assert.deepEqual(storage.createStore(adapter, "physics-ks1").loadHistory(), { schemaVersion: 1, slots: {} });
  assert.equal(adapter.value("ks-practice:v1:math-ks2:history"), JSON.stringify({ schemaVersion: 1, slots: { 1: { queue: ["m1"], lastId: null } } }));
});

test("active snapshots round-trip and history can be cleared independently", () => {
  const adapter = memoryStorage();
  const store = storage.createStore(adapter, "math-ks2");
  const snapshot = { schemaVersion: 1, subjectId: "math-ks2", answers: { q1: { answer: "4" } } };
  store.saveActive(snapshot);
  store.saveHistory({ schemaVersion: 1, slots: { 1: { queue: ["q2"], lastId: "q1" } } });

  assert.deepEqual(store.loadActive(), snapshot);
  store.clearHistory();
  assert.deepEqual(store.loadHistory(), { schemaVersion: 1, slots: {} });
  assert.deepEqual(store.loadActive(), snapshot);
});

test("adapter failures fall back to memory and expose a Swedish warning", () => {
  const adapter = {
    getItem() { throw new Error("disabled"); },
    setItem() { throw new Error("disabled"); },
    removeItem() { throw new Error("disabled"); }
  };
  const store = storage.createStore(adapter, "chemistry-ks");
  const snapshot = { schemaVersion: 1, subjectId: "chemistry-ks", examId: "offline" };

  assert.deepEqual(store.saveActive(snapshot), { ok: false, persisted: false });
  assert.deepEqual(store.loadActive(), snapshot);
  assert.equal(store.persistenceAvailable, false);
  assert.match(store.warning, /kunde inte sparas|inte tillgänglig/i);
});

test("corrupted JSON is isolated to its subject and falls back safely", () => {
  const adapter = memoryStorage({
    "ks-practice:v1:math-ks2:active": "{broken",
    "ks-practice:v1:physics-ks1:active": JSON.stringify({ schemaVersion: 1, subjectId: "physics-ks1", examId: "good" })
  });
  const mathStore = storage.createStore(adapter, "math-ks2");
  const physicsStore = storage.createStore(adapter, "physics-ks1");

  assert.equal(mathStore.loadActive(), null);
  assert.equal(mathStore.activeReadStatus, "corrupt");
  assert.equal(adapter.value("ks-practice:v1:math-ks2:active"), "{broken");
  assert.equal(mathStore.persistenceAvailable, true);
  assert.match(mathStore.warning, /skadad|kunde inte läsas/i);
  assert.equal(physicsStore.loadActive().examId, "good");
  assert.equal(physicsStore.activeReadStatus, "ok");
  assert.equal(physicsStore.persistenceAvailable, true);
});

test("active reads distinguish unread, missing and valid data", () => {
  const adapter = memoryStorage();
  const store = storage.createStore(adapter, "read-status");

  assert.equal(store.activeReadStatus, "unread");
  assert.equal(store.loadActive(), null);
  assert.equal(store.activeReadStatus, "missing");
  store.saveActive({ schemaVersion: 1, subjectId: "read-status" });
  assert.equal(store.loadActive().subjectId, "read-status");
  assert.equal(store.activeReadStatus, "ok");
});
