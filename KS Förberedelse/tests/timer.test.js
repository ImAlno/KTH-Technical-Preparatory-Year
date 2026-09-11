const test = require("node:test");
const assert = require("node:assert/strict");
const timer = require("../assets/js/timer.js");

test("timer survives time passing while the page is closed", () => {
  let state = timer.start(timer.create(60_000), 1_000);
  assert.equal(timer.remaining(state, 21_000), 40_000);
  state = timer.pause(state, 21_000);
  assert.equal(timer.remaining(state, 99_000), 40_000);
});
test("timer starts stopped and transitions without mutating prior states", () => {
  const created = timer.create(90_000);
  const started = timer.start(created, 5_000);
  const startedAgain = timer.start(started, 8_000);
  const paused = timer.pause(startedAgain, 15_000);
  const pausedAgain = timer.pause(paused, 80_000);

  assert.deepEqual(created, { durationMs: 90_000, elapsedMs: 0, runningSince: null });
  assert.deepEqual(started, { durationMs: 90_000, elapsedMs: 0, runningSince: 5_000 });
  assert.deepEqual(startedAgain, started);
  assert.notEqual(startedAgain, started);
  assert.deepEqual(paused, { durationMs: 90_000, elapsedMs: 10_000, runningSince: null });
  assert.deepEqual(pausedAgain, paused);
  assert.notEqual(pausedAgain, paused);
});

test("remaining time clamps and reset preserves duration", () => {
  const expired = timer.start(timer.create(1_000), 500);
  const futureStart = timer.start(timer.create(1_000), 2_000);

  assert.equal(timer.remaining(expired, 5_000), 0);
  assert.equal(timer.remaining(futureStart, 1_000), 1_000);
  assert.deepEqual(timer.reset(timer.pause(expired, 5_000)), { durationMs: 1_000, elapsedMs: 0, runningSince: null });
});

test("timer validates duration and tolerates invalid timestamps without corrupting state", () => {
  assert.throws(() => timer.create(-1), /duration/i);
  const state = timer.create(1_000);
  assert.deepEqual(timer.start(state, NaN), state);
  assert.deepEqual(timer.pause(state, NaN), state);
});
