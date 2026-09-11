(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.timer = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  function clone(state) {
    return {
      durationMs: state.durationMs,
      elapsedMs: state.elapsedMs,
      runningSince: state.runningSince
    };
  }

  function create(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) throw new TypeError("durationMs must be a non-negative finite number");
    return { durationMs: durationMs, elapsedMs: 0, runningSince: null };
  }

  function start(state, now) {
    const next = clone(state);
    if (next.runningSince !== null || !Number.isFinite(now)) return next;
    next.runningSince = now;
    return next;
  }

  function pause(state, now) {
    const next = clone(state);
    if (next.runningSince === null || !Number.isFinite(now)) return next;
    next.elapsedMs = Math.min(next.durationMs, Math.max(0, next.elapsedMs + Math.max(0, now - next.runningSince)));
    next.runningSince = null;
    return next;
  }

  function reset(state) {
    return create(state.durationMs);
  }

  function remaining(state, now) {
    const runningElapsed = state.runningSince !== null && Number.isFinite(now)
      ? Math.max(0, now - state.runningSince)
      : 0;
    return Math.min(state.durationMs, Math.max(0, state.durationMs - state.elapsedMs - runningElapsed));
  }

  return { create: create, start: start, pause: pause, reset: reset, remaining: remaining };
});
