(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.diagram = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const EPSILON = 1e-12;
  const ORIGIN = [0, 0];
  const PRIMITIVE_BRAND = typeof Symbol === "function" ? Symbol("diagram-kit-primitive") : "__diagramKitPrimitive__";
  const DECORATIVE_TOKEN = typeof Symbol === "function" ? Symbol("diagram-kit-decorative") : "__diagramKitDecorative__";
  const PRIMITIVE_META = new WeakMap();
  const MANIFEST_META = new WeakMap();
  const USED_FRAGMENT_IDS = new Set();
  const LAYERS = ["geometry", "connections", "information", "labels"];
  const ROLES = new Set([
    "line", "support", "ground", "wall", "contact", "body", "circle", "pulley", "rope", "connection",
    "force", "motion", "arrow", "dimension", "measure", "angle", "arc", "axis", "grid", "point", "marker",
    "shape", "label", "label-background", "decorative"
  ]);

  function fail(code, message) {
    const error = new Error(message);
    error.name = "DiagramKitError";
    error.code = code;
    throw error;
  }

  function finite(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) fail("NONFINITE", (name || "value") + " must be finite");
    return value;
  }
  function nonnegative(value, name) {
    finite(value, name);
    if (value < 0) fail("NEGATIVE", (name || "value") + " must be non-negative");
    return value;
  }

  function vector(value, name) {
    if (!Array.isArray(value) || value.length !== 2) fail("INVALID_VECTOR", (name || "vector") + " must be a two-number vector");
    return [finite(value[0], (name || "vector") + "[0]"), finite(value[1], (name || "vector") + "[1]")];
  }

  function id(value, name) {
    if (typeof value !== "string" || !value.trim() || !/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(value)) {
      fail("INVALID_ID", (name || "id") + " must be a non-empty XML identifier");
    }
    return value;
  }

  function clone(v) { return [v[0], v[1]]; }
  function snapshotValue(value) {
    if (Array.isArray(value)) return value.map(snapshotValue);
    if (value && typeof value === "object") {
      const result = {};
      Object.keys(value).sort().forEach((key) => {
        if (key === "attrs" || key.charAt(0) === "_") return;
        result[key] = snapshotValue(value[key]);
      });
      return result;
    }
    return value;
  }
  function finalizePrimitive(value, decorative) {
    value[PRIMITIVE_BRAND] = true;
    if (decorative) value[DECORATIVE_TOKEN] = true;
    PRIMITIVE_META.set(value, { snapshot: snapshotValue(value), decorative: !!decorative });
    return value;
  }
  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object") return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value); Object.keys(value).forEach((key) => deepFreeze(value[key], visited));
    return Object.freeze(value);
  }
  function safeVector(value, name) {
    return vector(value, name || "vector");
  }
  function add(a, b) { const left = vector(a, "addition left"); const right = vector(b, "addition right"); return safeVector([left[0] + right[0], left[1] + right[1]], "addition result"); }
  function sub(a, b) { const left = vector(a, "subtraction left"); const right = vector(b, "subtraction right"); return safeVector([left[0] - right[0], left[1] - right[1]], "subtraction result"); }
  function mul(a, scalar) { const left = vector(a, "scale vector"); finite(scalar, "scalar"); return safeVector([left[0] * scalar, left[1] * scalar], "scale result"); }
  function dot(a, b) { const left = vector(a, "dot left"); const right = vector(b, "dot right"); const result = left[0] * right[0] + left[1] * right[1]; return finite(result, "dot product"); }
  function cross(a, b) { const left = vector(a, "cross left"); const right = vector(b, "cross right"); const result = left[0] * right[1] - left[1] * right[0]; return finite(result, "cross product"); }
  function length(v) { const value = vector(v, "magnitude vector"); return finite(Math.hypot(value[0], value[1]), "vector magnitude"); }

  function normalize(value) {
    const v = vector(value);
    const magnitude = length(v);
    if (!(magnitude > EPSILON)) fail("DEGENERATE", "cannot normalize a zero or near-degenerate vector");
    return [v[0] / magnitude, v[1] / magnitude];
  }

  function asLine(line, b) {
    if (Array.isArray(line) && line.length === 2 && Array.isArray(line[0])) return { a: vector(line[0], "line.a"), b: vector(line[1], "line.b") };
    if (line && typeof line === "object" && line.a !== undefined && line.b !== undefined) return { a: vector(line.a, "line.a"), b: vector(line.b, "line.b") };
    return { a: vector(line, "line.a"), b: vector(b, "line.b") };
  }

  function lineTangent(line) {
    const delta = sub(line.b, line.a);
    const magnitude = length(delta);
    if (!(magnitude > EPSILON)) fail("DEGENERATE", "line endpoints form a zero or near-degenerate segment");
    return mul(delta, 1 / magnitude);
  }

  function signedPointLineDistance(point, line, b) {
    const p = vector(point, "point");
    const actualLine = asLine(line, b);
    const tangent = lineTangent(actualLine);
    return cross(tangent, sub(p, actualLine.a));
  }

  function circle(value, radius) {
    if (value && value.center !== undefined) {
      return { center: vector(value.center, "circle.center"), radius: finite(value.radius, "circle.radius") };
    }
    return { center: vector(value, "circle.center"), radius: finite(radius, "circle.radius") };
  }

  function positiveRadius(value) {
    if (!(value > EPSILON)) fail("DEGENERATE", "circle radius must be positive");
    return value;
  }

  function bodyOnLine(options, width, height, line, normal) {
    let opts = options;
    if (Array.isArray(options)) opts = { bottomCenter: options, width, height, line, outwardNormal: normal };
    opts = opts || {};
    const actualLine = asLine(opts.line || [opts.a, opts.b]);
    const tangent = lineTangent(actualLine);
    const chosenNormal = opts.outwardNormal || opts.normal || [-tangent[1], tangent[0]];
    const outward = normalize(chosenNormal);
    if (Math.abs(dot(tangent, outward)) > 1e-8) fail("INVALID_NORMAL", "body normal must be perpendicular to its line");
    const bodyWidth = finite(opts.width, "body.width");
    const bodyHeight = finite(opts.height, "body.height");
    if (!(bodyWidth > EPSILON) || !(bodyHeight > EPSILON)) fail("DEGENERATE", "body width and height must be positive");
    let bottomCenter = opts.bottomCenter || opts.contact || opts.position;
    if (!bottomCenter && opts.center) bottomCenter = sub(vector(opts.center, "body.center"), mul(outward, bodyHeight / 2));
    if (!bottomCenter) fail("INVALID_VECTOR", "body requires bottomCenter or center");
    bottomCenter = vector(bottomCenter, "body.bottomCenter");
    const lineUnit = add(actualLine.a, mul(tangent, dot(sub(bottomCenter, actualLine.a), tangent)));
    const half = mul(tangent, bodyWidth / 2);
    const bottomLeft = sub(lineUnit, half);
    const bottomRight = add(lineUnit, half);
    const topRight = add(bottomRight, mul(outward, bodyHeight));
    const topLeft = add(bottomLeft, mul(outward, bodyHeight));
    return finalizePrimitive({
      kind: "body", role: opts.role || "body", semantic: true, strokeWidth: nonnegative(opts.strokeWidth === undefined ? 1 : opts.strokeWidth, "body.strokeWidth"),
      id: opts.id,
      line: actualLine,
      tangent,
      outwardNormal: outward,
      bottomCenter: lineUnit,
      center: add(lineUnit, mul(outward, bodyHeight / 2)),
      bottomLeft,
      bottomRight,
      bottomCorners: [clone(bottomLeft), clone(bottomRight)],
      topRight,
      topLeft,
      corners: [bottomLeft, bottomRight, topRight, topLeft],
      polygon: [bottomLeft, bottomRight, topRight, topLeft]
    }, false);
  }

  function tangentPointsFromExternalPoint(point, pulley, radius) {
    const p = vector(point, "external point");
    const c = circle(pulley, radius);
    const r = positiveRadius(c.radius);
    const delta = sub(p, c.center);
    const distance = length(delta);
    if (!(distance > r + EPSILON)) fail("NO_TANGENT", "tangent point requires an external point outside the circle");
    const theta = Math.atan2(delta[1], delta[0]);
    const alpha = Math.acos(Math.min(1, r / distance));
    return [
      add(c.center, [r * Math.cos(theta + alpha), r * Math.sin(theta + alpha)]),
      add(c.center, [r * Math.cos(theta - alpha), r * Math.sin(theta - alpha)])
    ];
  }

  function sideVector(side) {
    if (Array.isArray(side)) return normalize(side);
    if (side === "left") return [-1, 0];
    if (side === "right") return [1, 0];
    if (side === "bottom") return [0, 1];
    return [0, -1];
  }

  function chooseTangent(points, center, side) {
    const direction = sideVector(side);
    return points[dot(sub(points[0], center), direction) >= dot(sub(points[1], center), direction) ? 0 : 1];
  }

  function normalizeAngle(value) {
    let angle = value % (Math.PI * 2);
    if (angle < 0) angle += Math.PI * 2;
    return angle;
  }

  function segmentsIntersectInterior(a, b, c, d) {
    const ab = sub(b, a); const cd = sub(d, c); const denominator = cross(ab, cd);
    const abLength = length(ab); const cdLength = length(cd);
    const parallelTolerance = 1e-12 * abLength * cdLength;
    if (Math.abs(denominator) <= parallelTolerance) {
      const ac = sub(c, a);
      const collinearTolerance = 1e-12 * Math.max(1, length(ac) / abLength) * dot(ab, ab);
      if (Math.abs(cross(ac, ab)) > collinearTolerance) return false;
      const squaredLength = dot(ab, ab);
      const t0 = dot(sub(c, a), ab) / squaredLength; const t1 = dot(sub(d, a), ab) / squaredLength;
      const overlapStart = Math.max(0, Math.min(t0, t1)); const overlapEnd = Math.min(1, Math.max(t0, t1));
      return overlapEnd - overlapStart > 1e-12 && overlapEnd > 1e-12 && overlapStart < 1 - 1e-12;
    }
    const delta = sub(c, a);
    const t = cross(delta, cd) / denominator; const u = cross(delta, ab) / denominator;
    return t > 1e-12 && t < 1 - 1e-12 && u > 1e-12 && u < 1 - 1e-12;
  }
  function segmentPenetratesCircle(a, b, center, radius) {
    const segment = sub(b, a); const squaredLength = dot(segment, segment);
    const t = Math.max(0, Math.min(1, dot(sub(center, a), segment) / squaredLength));
    const closest = add(a, mul(segment, t));
    return length(sub(closest, center)) / radius < 1 - 1e-10;
  }

  function ropeAroundCircle(options) {
    const opts = options || {};
    if (opts.side !== undefined && opts.side !== null && !["top", "bottom", "left", "right", "short", "long"].includes(opts.side) && !Array.isArray(opts.side)) fail("INVALID_SIDE", "rope side must be top, bottom, left, right, short, long, or a vector");
    const from = vector(opts.from, "rope.from");
    const to = vector(opts.to, "rope.to");
    const pulley = circle(opts.pulley || opts.circle);
    const r = positiveRadius(pulley.radius);
    const fromCandidates = tangentPointsFromExternalPoint(from, pulley);
    const toCandidates = tangentPointsFromExternalPoint(to, pulley);
    const sideDirection = sideVector(opts.side);
    const requestedSide = opts.side !== undefined && (opts.side === "top" || opts.side === "bottom" || opts.side === "left" || opts.side === "right" || Array.isArray(opts.side));
    const solutions = [];
    for (let i = 0; i < fromCandidates.length; i += 1) for (let j = 0; j < toCandidates.length; j += 1) {
      const fromTangentCandidate = fromCandidates[i]; const toTangentCandidate = toCandidates[j];
      for (const candidateSweep of [1, -1]) {
        const firstIncoming = normalize(sub(fromTangentCandidate, from));
        const firstArc = normalize([candidateSweep * -(fromTangentCandidate[1] - pulley.center[1]), candidateSweep * (fromTangentCandidate[0] - pulley.center[0])]);
        const lastArc = normalize([candidateSweep * -(toTangentCandidate[1] - pulley.center[1]), candidateSweep * (toTangentCandidate[0] - pulley.center[0])]);
        const lastOutgoing = normalize(sub(to, toTangentCandidate));
        const firstContinuity = dot(firstIncoming, firstArc);
        const lastContinuity = dot(lastArc, lastOutgoing);
        if (firstContinuity < 1 - 1e-7 || lastContinuity < 1 - 1e-7) continue;
        const startCandidateAngle = Math.atan2(fromTangentCandidate[1] - pulley.center[1], fromTangentCandidate[0] - pulley.center[0]);
        const endCandidateAngle = Math.atan2(toTangentCandidate[1] - pulley.center[1], toTangentCandidate[0] - pulley.center[0]);
        const candidateDelta = candidateSweep === 1 ? normalizeAngle(endCandidateAngle - startCandidateAngle) : normalizeAngle(startCandidateAngle - endCandidateAngle);
        if (candidateDelta <= EPSILON) continue;
        const midpointAngle = startCandidateAngle + candidateSweep * candidateDelta / 2;
        const midpoint = add(pulley.center, [r * Math.cos(midpointAngle), r * Math.sin(midpointAngle)]);
        const sideScore = dot(sub(midpoint, pulley.center), sideDirection);
        const requestedAngle = Math.atan2(sideDirection[1], sideDirection[0]);
        const directedTravel = candidateSweep === 1 ? normalizeAngle(requestedAngle - startCandidateAngle) : normalizeAngle(startCandidateAngle - requestedAngle);
        if (segmentsIntersectInterior(from, fromTangentCandidate, toTangentCandidate, to) || segmentPenetratesCircle(from, fromTangentCandidate, pulley.center, r) || segmentPenetratesCircle(toTangentCandidate, to, pulley.center, r)) continue;
        solutions.push({ fromTangent: fromTangentCandidate, toTangent: toTangentCandidate, sweep: candidateSweep, delta: candidateDelta, sideScore, firstContinuity, lastContinuity, containsSide: directedTravel <= candidateDelta + 1e-9 });
      }
    }
    if (!solutions.length) fail("INVARIANT", "no continuous tangent rope path exists for the supplied endpoints");
    if (requestedSide) {
      const sideSolutions = solutions.filter((solution) => solution.containsSide);
      if (!sideSolutions.length) fail("NO_SIDE", "no continuous tangent arc reaches the requested rope side");
      solutions.splice(0, solutions.length, ...sideSolutions);
    }
    solutions.sort((a, b) => {
      if (requestedSide) return a.delta - b.delta;
      if (opts.side === "long" || opts.side === "bottom" || opts.side === "left") return b.delta - a.delta;
      return a.delta - b.delta;
    });
    const selected = solutions[0];
    const fromTangent = selected.fromTangent; const toTangent = selected.toTangent; const sweep = selected.sweep;
    const delta = selected.delta;
    const arc = { kind: "arc", from: clone(fromTangent), to: clone(toTangent), center: clone(pulley.center), radius: r, sweep, delta, turns: 0, largeArc: delta > Math.PI };
    const fromSegment = { kind: "segment", from: clone(from), to: clone(fromTangent) };
    const toSegment = { kind: "segment", from: clone(toTangent), to: clone(to) };
    [fromTangent, toTangent].forEach(function (point, index) {
      const external = index ? to : from;
      const radiusDirection = normalize(sub(point, pulley.center));
      const segmentDirection = normalize(sub(external, point));
      if (Math.abs(dot(radiusDirection, segmentDirection)) > 1e-8) fail("INVARIANT", "rope tangent is not orthogonal to its radius");
    });
    if (selected.firstContinuity < 1 - 1e-6 || selected.lastContinuity < 1 - 1e-6) fail("INVARIANT", "rope contacts are not C1 continuous");
    const path = "M " + from[0] + " " + from[1] + " L " + fromTangent[0] + " " + fromTangent[1] + " A " + r + " " + r + " 0 " + (delta > Math.PI ? 1 : 0) + " " + (sweep === 1 ? 1 : 0) + " " + toTangent[0] + " " + toTangent[1] + " L " + to[0] + " " + to[1];
    return finalizePrimitive({
      kind: "rope", role: opts.role || "rope", semantic: true, strokeWidth: nonnegative(opts.strokeWidth === undefined ? 1 : opts.strokeWidth, "rope.strokeWidth"),
      id: opts.id, from, to, pulley: { center: clone(pulley.center), radius: r }, side: opts.side === undefined || opts.side === null ? null : opts.side, fromTangent, toTangent,
      tangentPoints: [clone(fromTangent), clone(toTangent)], start: clone(fromTangent), end: clone(toTangent), segments: [fromSegment, arc, toSegment], arc,
      path, length: length(sub(from, fromTangent)) + r * delta + length(sub(to, toTangent))
    }, false);
  }

  function angleArc(options) {
    const opts = options || {};
    const vertex = vector(opts.vertex, "angle.vertex");
    const fromRay = normalize(sub(vector(opts.fromRay, "angle.fromRay"), vertex));
    const toRay = normalize(sub(vector(opts.toRay, "angle.toRay"), vertex));
    const radius = positiveRadius(finite(opts.radius, "angle.radius"));
    const crossValue = cross(fromRay, toRay);
    const dotValue = Math.max(-1, Math.min(1, dot(fromRay, toRay)));
    if (Math.abs(crossValue) <= EPSILON && dotValue > 0) fail("DEGENERATE", "angle rays are parallel");
    if (Math.abs(crossValue) <= EPSILON) fail("DEGENERATE", "angle rays are opposite and have no unique sector");
    const start = add(vertex, mul(fromRay, radius));
    const end = add(vertex, mul(toRay, radius));
    const radians = Math.acos(dotValue);
    return finalizePrimitive({
      kind: "angleArc", role: opts.role || "angle", semantic: true, strokeWidth: nonnegative(opts.strokeWidth === undefined ? 1 : opts.strokeWidth, "angle.strokeWidth"),
      id: opts.id, vertex, fromRay, toRay, radius, start, end, radians,
      startPoint: clone(start), endPoint: clone(end), degrees: radians * 180 / Math.PI, sweep: crossValue >= 0 ? 1 : -1, largeArc: radians > Math.PI,
      path: "M " + start[0] + " " + start[1] + " A " + radius + " " + radius + " 0 " + (radians > Math.PI ? 1 : 0) + " " + (crossValue >= 0 ? 1 : 0) + " " + end[0] + " " + end[1]
    }, false);
  }

  function dimension(options) {
    const opts = options || {};
    const a = vector(opts.a, "dimension.a");
    const b = vector(opts.b, "dimension.b");
    const tangent = normalize(sub(b, a));
    const normal = opts.normal ? normalize(opts.normal) : [-tangent[1], tangent[0]];
    if (Math.abs(dot(tangent, normal)) > 1e-8) fail("INVALID_NORMAL", "dimension normal must be perpendicular to its anchors");
    const offset = finite(opts.offset === undefined ? 0 : opts.offset, "dimension.offset");
    const start = add(a, mul(normal, offset));
    const end = add(b, mul(normal, offset));
    const extension = [{ from: clone(a), to: clone(start) }, { from: clone(b), to: clone(end) }];
    const path = "M " + start[0] + " " + start[1] + " L " + end[0] + " " + end[1] + " M " + a[0] + " " + a[1] + " L " + start[0] + " " + start[1] + " M " + b[0] + " " + b[1] + " L " + end[0] + " " + end[1];
    return finalizePrimitive({ kind: "dimension", role: opts.role || "dimension", semantic: true, strokeWidth: nonnegative(opts.strokeWidth === undefined ? 1 : opts.strokeWidth, "dimension.strokeWidth"), id: opts.id, a, b, tangent, normal, offset, start, end, startAnchor: clone(start), endAnchor: clone(end), anchors: [clone(start), clone(end)], extension, path, length: length(sub(b, a)), labelAt: mul(add(start, end), 0.5) }, false);
  }

  function arrow(options) {
    const opts = options || {};
    const from = vector(opts.from, "arrow.from");
    const to = vector(opts.to, "arrow.to");
    const tangent = normalize(sub(to, from));
    const headLength = finite(opts.headLength === undefined ? 8 : opts.headLength, "arrow.headLength");
    const headWidth = finite(opts.headWidth === undefined ? 5 : opts.headWidth, "arrow.headWidth");
    if (!(headLength > 0) || !(headWidth > 0)) fail("DEGENERATE", "arrow head dimensions must be positive");
    const base = sub(to, mul(tangent, headLength));
    const normal = [-tangent[1], tangent[0]];
    const left = add(base, mul(normal, headWidth / 2));
    const right = sub(base, mul(normal, headWidth / 2));
    return finalizePrimitive({ kind: "arrow", id: opts.id, role: opts.role || "arrow", semantic: true, strokeWidth: nonnegative(opts.strokeWidth === undefined ? 2 : opts.strokeWidth, "arrow.strokeWidth"), from, to, tangent, base, left, right, head: [clone(left), clone(to), clone(right)], path: "M " + from[0] + " " + from[1] + " L " + to[0] + " " + to[1], headLength, headWidth }, false);
  }

  function graphTransform(options) {
    const opts = options || {};
    const xDomain = opts.xDomain || [0, 1];
    const yDomain = opts.yDomain || [0, 1];
    const plot = opts.plot || { x: finite(opts.x === undefined ? 0 : opts.x, "plot.x"), y: finite(opts.y === undefined ? 0 : opts.y, "plot.y"), width: finite(opts.width === undefined ? 1 : opts.width, "plot.width"), height: finite(opts.height === undefined ? 1 : opts.height, "plot.height") };
    const x0 = finite(xDomain[0], "xDomain[0]"); const x1 = finite(xDomain[1], "xDomain[1]");
    const y0 = finite(yDomain[0], "yDomain[0]"); const y1 = finite(yDomain[1], "yDomain[1]");
    const px = finite(plot.x, "plot.x"); const py = finite(plot.y, "plot.y");
    const pw = finite(plot.width, "plot.width"); const ph = finite(plot.height, "plot.height");
    if (!(x1 - x0 > EPSILON) || !(y1 - y0 > EPSILON) || !(pw > EPSILON) || !(ph > EPSILON)) fail("DEGENERATE", "graph domains and plot dimensions must increase; zero or near-degenerate span");
    function toScreen(point) { const p = vector(point, "graph point"); return safeVector([px + (p[0] - x0) / (x1 - x0) * pw, py + ph - (p[1] - y0) / (y1 - y0) * ph], "screen point"); }
    function fromScreen(point) { const p = vector(point, "screen point"); return safeVector([x0 + (p[0] - px) / pw * (x1 - x0), y0 + (py + ph - p[1]) / ph * (y1 - y0)], "graph point"); }
    const xScale = finite(pw / (x1 - x0), "graph x scale"); const yScale = finite(ph / (y1 - y0), "graph y scale");
    const result = { xDomain: [x0, x1], yDomain: [y0, y1], plot: { x: px, y: py, width: pw, height: ph }, xScale, yScale, toScreen, fromScreen };
    if (opts.point !== undefined) result.point = toScreen(opts.point);
    if (opts.xValue !== undefined && opts.yValue !== undefined) result.point = toScreen([opts.xValue, opts.yValue]);
    result.xToScreen = (value) => toScreen([finite(value, "graph x"), y0])[0];
    result.yToScreen = (value) => toScreen([x0, finite(value, "graph y")])[1];
    return result;
  }

  function shapeBase(options, kind, role) {
    const opts = options || {};
    const shapeId = id(opts.id, "element.id");
    const selectedRole = opts.role || role || kind;
    if (!ROLES.has(selectedRole)) fail("INVALID_ROLE", "unknown semantic role: " + selectedRole);
    if (selectedRole === "decorative") {
      if (kind !== "rect" || opts.decorative !== true || opts.semanticGeometry === true) fail("DECORATIVE_SEMANTIC", "decorative exemption is limited to explicit background rectangles");
    }
    const result = { kind, id: shapeId, role: selectedRole, semantic: selectedRole !== "decorative", attrs: opts };
    return result;
  }

  function line(options) {
    const s = shapeBase(options, "line", "line");
    s.a = vector(options.a, "line.a"); s.b = vector(options.b, "line.b");
    if (length(sub(s.b, s.a)) <= EPSILON) fail("DEGENERATE", "line endpoints form a zero-length segment");
    s.strokeWidth = nonnegative(options.strokeWidth === undefined ? 1 : options.strokeWidth, "line.strokeWidth");
    return finalizePrimitive(s, false);
  }

  function circleShape(options) {
    const s = shapeBase(options, "circle", "circle");
    s.center = vector(options.center, "circle.center"); s.radius = positiveRadius(finite(options.radius, "circle.radius")); s.strokeWidth = nonnegative(options.strokeWidth === undefined ? 1 : options.strokeWidth, "circle.strokeWidth");
    return finalizePrimitive(s, false);
  }

  function rect(options) {
    const s = shapeBase(options, "rect", options && options.decorative ? "decorative" : "shape");
    s.x = finite(options.x, "rect.x"); s.y = finite(options.y, "rect.y"); s.width = finite(options.width, "rect.width"); s.height = finite(options.height, "rect.height");
    if (!(s.width > EPSILON) || !(s.height > EPSILON)) fail("DEGENERATE", "rectangle dimensions must be positive");
    if (options.rx !== undefined) {
      const rx = finite(options.rx, "rect.rx");
      if (rx < 0 || rx > Math.min(s.width, s.height) / 2 + EPSILON) fail("INVALID_GEOMETRY", "rect.rx must be finite, non-negative, and fit the rectangle");
    }
    s.strokeWidth = nonnegative(options.strokeWidth === undefined ? 1 : options.strokeWidth, "rect.strokeWidth");
    return finalizePrimitive(s, s.role === "decorative");
  }

  function polygon(options) {
    const s = shapeBase(options, "polygon", "shape");
    if (!Array.isArray(options.points) || options.points.length < 3) fail("DEGENERATE", "polygon requires at least three points");
    s.points = options.points.map((p) => vector(p, "polygon.point"));
    for (let i = 0; i < s.points.length; i += 1) if (length(sub(s.points[(i + 1) % s.points.length], s.points[i])) <= EPSILON) fail("DEGENERATE", "polygon has a zero-length edge");
    let area = 0; for (let i = 0; i < s.points.length; i += 1) area += cross(s.points[i], s.points[(i + 1) % s.points.length]);
    if (Math.abs(area) <= EPSILON) fail("DEGENERATE", "polygon has zero area");
    s.strokeWidth = nonnegative(options.strokeWidth === undefined ? 1 : options.strokeWidth, "polygon.strokeWidth");
    return finalizePrimitive(s, false);
  }

  function polyline(options) {
    const s = shapeBase(options, "polyline", "line");
    if (!Array.isArray(options.points) || options.points.length < 2) fail("DEGENERATE", "polyline requires at least two points");
    s.points = options.points.map((p) => vector(p, "polyline.point"));
    for (let i = 1; i < s.points.length; i += 1) if (length(sub(s.points[i], s.points[i - 1])) <= EPSILON) fail("DEGENERATE", "polyline has a zero-length segment");
    s.strokeWidth = nonnegative(options.strokeWidth === undefined ? 1 : options.strokeWidth, "polyline.strokeWidth");
    return finalizePrimitive(s, false);
  }

  function parsePathBounds(source) {
    const tokens = [];
    const tokenPattern = /([a-zA-Z])|([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/giu;
    let cursor = 0; let match;
    while ((match = tokenPattern.exec(source))) {
      if (source.slice(cursor, match.index).trim().replace(/,/gu, "")) fail("INVALID_PATH", "path contains unsupported syntax");
      tokens.push(match[1] ? match[1] : finite(Number(match[2]), "path coordinate")); cursor = tokenPattern.lastIndex;
    }
    if (source.slice(cursor).trim().replace(/,/gu, "") || !tokens.length) fail("INVALID_PATH", "path contains unsupported syntax");
    const points = []; let index = 0; let command = null; let current = [0, 0]; let subpath = [0, 0];
    function coordinate(relative, x, y) { return relative ? add(current, [x, y]) : [x, y]; }
    while (index < tokens.length) {
      if (typeof tokens[index] === "string") command = tokens[index++];
      if (!command || !/^[MmLlHhVvZz]$/u.test(command)) fail("INVALID_PATH", "only finite M/L/H/V/Z path commands are supported");
      const relative = command === command.toLowerCase(); const upper = command.toUpperCase();
      if (upper === "Z") { current = clone(subpath); points.push(clone(current)); command = null; continue; }
      const needs = upper === "H" || upper === "V" ? 1 : 2;
      if (index + needs > tokens.length || typeof tokens[index] === "string") fail("INVALID_PATH", "path command has missing coordinates");
      const first = tokens[index++]; const second = needs === 2 ? tokens[index++] : null;
      if (typeof first === "string" || (second !== null && typeof second === "string")) fail("INVALID_PATH", "path command has invalid coordinates");
      let next;
      if (upper === "H") next = relative ? add(current, [first, 0]) : [first, current[1]];
      else if (upper === "V") next = relative ? add(current, [0, first]) : [current[0], first];
      else next = coordinate(relative, first, second);
      if (upper === "M") subpath = clone(next);
      current = next; points.push(clone(current));
      if (upper === "M") command = relative ? "l" : "L";
    }
    if (points.length < 2) fail("DEGENERATE", "path has no painted segment");
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    points.forEach((point) => { minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]); maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]); });
    const result = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    [result.x, result.y, result.width, result.height].forEach((value) => finite(value, "path bounds"));
    return result;
  }
  function pathSignature(source) {
    const tokenPattern = /([a-zA-Z])|([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/giu;
    const signature = []; let match;
    while ((match = tokenPattern.exec(source))) signature.push(match[1] ? match[1] : Number(match[2]));
    return signature;
  }

  function path(options) {
    const s = shapeBase(options, "path", "line");
    if (typeof options.d !== "string" || !options.d.trim() || /(?:NaN|Infinity)/u.test(options.d)) fail("INVALID_PATH", "path requires finite numeric geometry");
    s.d = options.d;
    s.strokeWidth = nonnegative(options.strokeWidth === undefined ? 1 : options.strokeWidth, "path.strokeWidth");
    const rawBounds = parsePathBounds(options.d); const halfStroke = s.strokeWidth / 2;
    s.commands = pathSignature(options.d);
    s.bbox = { x: rawBounds.x - halfStroke, y: rawBounds.y - halfStroke, width: rawBounds.width + s.strokeWidth, height: rawBounds.height + s.strokeWidth };
    Object.values(s.bbox).forEach((value) => finite(value, "path painted bounds"));
    return finalizePrimitive(s, false);
  }

  function label(options) {
    const opts = options || {};
    const s = shapeBase(Object.assign({}, opts, { role: "label" }), "label", "label");
    if (typeof opts.text !== "string" || !opts.text.trim()) fail("MISSING_ACCESSIBILITY", "label text is required");
    s.at = vector(opts.at, "label.at"); s.text = opts.text;
    s.anchorId = opts.anchorId || opts.ownerId;
    if (!s.anchorId || typeof s.anchorId !== "string") fail("INVALID_LABEL", "label anchorId must name an owning geometry");
    s.anchorId = id(s.anchorId, "label.anchorId");
    s.textAnchor = opts.textAnchor || (opts.anchor && ["start", "middle", "end"].includes(opts.anchor) ? opts.anchor : "start");
    if (!["start", "middle", "end"].includes(s.textAnchor)) fail("INVALID_LABEL", "label textAnchor must be start, middle, or end");
    s.avoid = (opts.avoid || []).map((value) => id(value, "label.avoid"));
    s.minClearance = finite(opts.minClearance === undefined ? 0 : opts.minClearance, "label.minClearance");
    if (s.minClearance < 0) fail("INVALID_LABEL", "label minClearance must be non-negative");
    s.fontSize = finite(opts.fontSize === undefined ? 14 : opts.fontSize, "label.fontSize");
    if (!(s.fontSize > 0)) fail("DEGENERATE", "label fontSize must be positive");
    s.background = opts.background === true || opts.background === "opaque" ? "opaque" : "none";
    return finalizePrimitive(s, false);
  }

  function primitiveFromGeometry(geometry, options) {
    const opts = options || {};
    const meta = geometry && PRIMITIVE_META.get(geometry);
    if (geometry && geometry.kind && geometry[PRIMITIVE_BRAND] === true && meta && deepEqual(snapshotValue(geometry), meta.snapshot)) {
      const s = Object.assign({}, geometry);
      if (opts.id && !s.id) s.id = id(opts.id, "element.id");
      if (!s.id) s.id = id("geometry-" + geometry.kind, "element.id");
      if (opts.role) {
        if (opts.role === "decorative" && !(meta.decorative && geometry.kind === "rect" && geometry[DECORATIVE_TOKEN] === true)) fail("DECORATIVE_SEMANTIC", "decorative role requires the explicit decorative rectangle factory");
        s.role = opts.role;
      }
      if (s.role && !ROLES.has(s.role)) fail("INVALID_ROLE", "unknown semantic role: " + s.role);
      if (!s.role) s.role = geometry.kind === "arrow" ? "arrow" : "shape";
      if (s.role === "decorative" && !(meta.decorative && geometry.kind === "rect" && geometry[DECORATIVE_TOKEN] === true)) fail("DECORATIVE_SEMANTIC", "decorative role requires the explicit decorative rectangle factory");
      if (s.semantic !== false && s.role === "decorative") fail("DECORATIVE_SEMANTIC", "semantic geometry cannot use decorative role");
      s.id = id(s.id, "element.id");
    return finalizePrimitive(s, false);
    }
    fail("INVALID_ELEMENT", "diagram elements must be branded kit primitives");
  }

  function bboxOf(s) {
    let points = [];
    if (s.kind === "line" || s.kind === "arrow") points = [s.from || s.a, s.to || s.b, ...(s.kind === "arrow" ? [s.left, s.right] : [])];
    else if (s.kind === "body") points = s.corners;
    else if (s.kind === "dimension") points = [s.a, s.b, s.start, s.end];
    else if (s.kind === "angleArc") return arcBounds(s.vertex, s.radius, Math.atan2(s.start[1] - s.vertex[1], s.start[0] - s.vertex[0]), Math.atan2(s.end[1] - s.vertex[1], s.end[0] - s.vertex[0]), s.sweep, s.strokeWidth);
    else if (s.kind === "rope") {
      const lineOne = bboxOf({ kind: "line", a: s.from, b: s.fromTangent, strokeWidth: s.strokeWidth });
      const lineTwo = bboxOf({ kind: "line", a: s.toTangent, b: s.to, strokeWidth: s.strokeWidth });
      const arcBox = s.arc && s.arc.turns > 0
        ? { x: s.pulley.center[0] - s.pulley.radius - s.strokeWidth / 2, y: s.pulley.center[1] - s.pulley.radius - s.strokeWidth / 2, width: 2 * s.pulley.radius + s.strokeWidth, height: 2 * s.pulley.radius + s.strokeWidth }
        : arcBounds(s.pulley.center, s.pulley.radius, Math.atan2(s.fromTangent[1] - s.pulley.center[1], s.fromTangent[0] - s.pulley.center[0]), Math.atan2(s.toTangent[1] - s.pulley.center[1], s.toTangent[0] - s.pulley.center[0]), s.arc.sweep, s.strokeWidth);
      return unionBounds(unionBounds(lineOne, arcBox), lineTwo);
    }
    else if (s.kind === "circle") return { x: s.center[0] - s.radius - s.strokeWidth / 2, y: s.center[1] - s.radius - s.strokeWidth / 2, width: 2 * s.radius + s.strokeWidth, height: 2 * s.radius + s.strokeWidth };
    else if (s.kind === "rect") return { x: s.x - s.strokeWidth / 2, y: s.y - s.strokeWidth / 2, width: s.width + s.strokeWidth, height: s.height + s.strokeWidth };
    else if (s.kind === "polygon" || s.kind === "polyline") points = s.points;
    else if (s.kind === "label") {
      const width = Math.max(1, s.text.length * s.fontSize * 0.58);
      const x = s.textAnchor === "middle" ? s.at[0] - width / 2 : s.textAnchor === "end" ? s.at[0] - width : s.at[0];
      const extra = s.background === "opaque" ? 2 : 0;
      return { x: x - extra, y: s.at[1] - s.fontSize - extra, width: width + extra * 2, height: s.fontSize * 1.25 + extra * 2 };
    } else if (s.bbox) return Object.assign({}, s.bbox);
    points = points.filter(Boolean);
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
    const stroke = (s.strokeWidth || 0) / 2;
    const minX = Math.min(...xs) - stroke; const maxX = Math.max(...xs) + stroke;
    const minY = Math.min(...ys) - stroke; const maxY = Math.max(...ys) + stroke;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  function canonicalGeometry(element) {
    const strokeWidth = nonnegative(element.strokeWidth, "element.strokeWidth");
    let shape;
    if (element.kind === "line") shape = line({ id: element.id, a: element.a || element.from, b: element.b || element.to, role: element.role, strokeWidth });
    else if (element.kind === "arrow") shape = arrow({ id: element.id, from: element.from, to: element.to, role: element.role, strokeWidth, headLength: element.arrowhead && element.arrowhead.headLength, headWidth: element.arrowhead && element.arrowhead.headWidth });
    else if (element.kind === "circle") shape = circleShape({ id: element.id, center: element.center, radius: element.radius, role: element.role, strokeWidth });
    else if (element.kind === "rect") {
      const raw = { id: element.id, x: element.x, y: element.y, width: element.width, height: element.height, role: element.role === "decorative" ? "decorative" : "shape", decorative: element.role === "decorative", strokeWidth };
      if (element.rx !== undefined) raw.rx = element.rx;
      shape = rect(raw);
    } else if (element.kind === "polygon") shape = polygon({ id: element.id, points: element.points, role: element.role, strokeWidth });
    else if (element.kind === "polyline") shape = polyline({ id: element.id, points: element.points, role: element.role, strokeWidth });
    else if (element.kind === "path") shape = path({ id: element.id, d: element.path, role: element.role, strokeWidth });
    else if (element.kind === "body") shape = bodyOnLine({ id: element.id, bottomCenter: element.bottomCenter, width: element.width, height: element.height, line: element.line, outwardNormal: element.outwardNormal, role: element.role, strokeWidth });
    else if (element.kind === "dimension") shape = dimension({ id: element.id, a: element.a, b: element.b, normal: element.normal, offset: element.offset, role: element.role, strokeWidth });
    else if (element.kind === "angleArc") shape = angleArc({ id: element.id, vertex: element.vertex, fromRay: add(element.vertex, element.fromRay), toRay: add(element.vertex, element.toRay), radius: element.radius, role: element.role, strokeWidth });
    else if (element.kind === "rope") shape = ropeAroundCircle({ id: element.id, from: element.from, to: element.to, pulley: element.pulley, side: element.side, role: element.role, strokeWidth });
    else if (element.kind === "label") {
      [element.at, element.anchorId, element.textAnchor, element.text, element.avoid, element.minClearance, element.fontSize].forEach((value) => { if (value === undefined) fail("INVALID_MANIFEST", "label geometry is incomplete"); });
      vector(element.at, "label.at"); id(element.anchorId, "label.anchorId"); id(element.textAnchor, "label.textAnchor");
      if (!Array.isArray(element.avoid)) fail("INVALID_MANIFEST", "label avoid must be an array");
      element.avoid.forEach((value) => id(value, "label.avoid"));
      finite(element.minClearance, "label.minClearance"); finite(element.fontSize, "label.fontSize");
      if (element.background !== "none" && element.background !== "opaque") fail("INVALID_MANIFEST", "label background is invalid");
      return { bbox: bboxOf(element), strokeWidth, geometry: { at: element.at, anchorId: element.anchorId, textAnchor: element.textAnchor, text: element.text, avoid: element.avoid, minClearance: element.minClearance, fontSize: element.fontSize, background: element.background } };
    } else if (element.role === "label-background") {
      [element.x, element.y, element.width, element.height].forEach((value) => finite(value, "background geometry"));
      if (!(element.width > EPSILON) || !(element.height > EPSILON)) fail("DEGENERATE", "background dimensions must be positive");
      return { bbox: { x: element.x, y: element.y, width: element.width, height: element.height }, strokeWidth: 0, geometry: { x: element.x, y: element.y, width: element.width, height: element.height } };
    } else fail("INVALID_MANIFEST", "unsupported canonical element kind: " + element.kind);
    const result = { bbox: bboxOf(shape), strokeWidth: shape.strokeWidth };
    if (shape.kind === "line") result.geometry = { from: shape.a, to: shape.b };
    if (shape.kind === "arrow") result.geometry = { from: shape.from, to: shape.to, head: shape.head };
    if (shape.kind === "circle") result.geometry = { center: shape.center, radius: shape.radius };
    if (shape.kind === "rect") result.geometry = { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: element.rx };
    if (shape.kind === "polygon" || shape.kind === "polyline") result.geometry = { points: shape.points };
    if (shape.kind === "path") result.geometry = { d: shape.d, commands: pathSignature(shape.d) };
    if (shape.kind === "body") result.geometry = { points: shape.corners, line: shape.line, outwardNormal: shape.outwardNormal, bottomCenter: shape.bottomCenter, width: length(sub(shape.bottomRight, shape.bottomLeft)), height: length(sub(shape.topLeft, shape.bottomLeft)) };
    if (shape.kind === "dimension") result.geometry = { a: shape.a, b: shape.b, normal: shape.normal, offset: shape.offset, extension: shape.extension };
    if (shape.kind === "angleArc") result.geometry = { vertex: shape.vertex, fromRay: shape.fromRay, toRay: shape.toRay, radius: shape.radius, sweep: shape.sweep };
    if (shape.kind === "rope") result.geometry = { from: shape.from, to: shape.to, pulley: shape.pulley, side: shape.side, fromTangent: shape.fromTangent, toTangent: shape.toTangent, arc: shape.arc };
    if (["path", "angleArc", "rope", "dimension"].includes(shape.kind)) result.path = shape.d !== undefined ? shape.d : shape.path;
    if (shape.kind === "arrow") result.arrowhead = { points: shape.head.map(clone), headLength: shape.headLength, headWidth: shape.headWidth };
    return result;
  }
  function recordGeometry(element) {
    if (element.kind === "line") return { from: element.from, to: element.to };
    if (element.kind === "arrow") return { from: element.from, to: element.to, head: element.arrowhead && element.arrowhead.points };
    if (element.kind === "circle") return { center: element.center, radius: element.radius };
    if (element.kind === "rect") return { x: element.x, y: element.y, width: element.width, height: element.height, rx: element.rx };
    if (element.kind === "polygon" || element.kind === "polyline") return { points: element.points };
    if (element.kind === "path") return { d: element.path, commands: element.commands };
    if (element.kind === "body") return { points: element.points, line: element.line, outwardNormal: element.outwardNormal, bottomCenter: element.bottomCenter, width: element.width, height: element.height };
    if (element.kind === "dimension") return { a: element.a, b: element.b, normal: element.normal, offset: element.offset, extension: element.extension };
    if (element.kind === "angleArc") return { vertex: element.vertex, fromRay: element.fromRay, toRay: element.toRay, radius: element.radius, sweep: element.sweep };
    if (element.kind === "rope") return { from: element.from, to: element.to, pulley: element.pulley, side: element.side, fromTangent: element.fromTangent, toTangent: element.toTangent, arc: element.arc };
    if (element.kind === "label") return { at: element.at, anchorId: element.anchorId, textAnchor: element.textAnchor, text: element.text, avoid: element.avoid, minClearance: element.minClearance, fontSize: element.fontSize, background: element.background };
    if (element.role === "label-background") return { x: element.x, y: element.y, width: element.width, height: element.height };
    return {};
  }

  function escapeText(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escapeAttr(value) { return escapeText(value).replace(/"/g, "&quot;"); }
  function number(value) { finite(value); return String(Number(value.toFixed(12))); }
  function pointList(points) { return points.map((p) => number(p[0]) + "," + number(p[1])).join(" "); }

  function angleOnArc(angle, start, delta, sweep) {
    const travelled = sweep === 1 ? normalizeAngle(angle - start) : normalizeAngle(start - angle);
    return travelled <= delta + 1e-9;
  }
  function arcBounds(center, radius, start, end, sweep, strokeWidth) {
    const delta = sweep === 1 ? normalizeAngle(end - start) : normalizeAngle(start - end);
    const angles = [start, end, 0, Math.PI / 2, Math.PI, Math.PI * 1.5].filter((angle) => angleOnArc(angle, start, delta, sweep));
    const points = angles.map((angle) => add(center, [radius * Math.cos(angle), radius * Math.sin(angle)]));
    const xs = points.map((point) => point[0]); const ys = points.map((point) => point[1]); const stroke = (strokeWidth || 0) / 2;
    return { x: Math.min(...xs) - stroke, y: Math.min(...ys) - stroke, width: Math.max(...xs) - Math.min(...xs) + stroke * 2, height: Math.max(...ys) - Math.min(...ys) + stroke * 2 };
  }
  function unionBounds(first, second) {
    const minX = Math.min(first.x, second.x); const minY = Math.min(first.y, second.y);
    return { x: minX, y: minY, width: Math.max(first.x + first.width, second.x + second.width) - minX, height: Math.max(first.y + first.height, second.y + second.height) - minY };
  }
  function deepEqual(left, right) {
    if (left === right) return true;
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
    const leftKeys = Object.keys(left).sort(); const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  function geometryEqual(left, right) {
    if (typeof left === "number" && typeof right === "number") return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
    if (typeof left === "string" && typeof right === "string" && /[MLHVZ]/iu.test(left) && /[MLHVZ]/iu.test(right)) {
      const tokenize = (value) => value.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu) || [];
      const a = tokenize(left); const b = tokenize(right);
      return a.length === b.length && a.every((token, index) => /[a-zA-Z]/u.test(token) ? token === b[index] : geometryEqual(Number(token), Number(b[index])));
    }
    if (left === right) return true;
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
    const leftKeys = Object.keys(left).sort(); const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
    return leftKeys.every((key) => geometryEqual(left[key], right[key]));
  }

  function attrsFor(s) {
    const data = ' id="' + escapeAttr(s.id) + '" data-role="' + escapeAttr(s.role) + '" data-geometry-id="' + escapeAttr(s.id) + '"';
    if (s.kind === "line") return '<line x1="' + number(s.a[0]) + '" y1="' + number(s.a[1]) + '" x2="' + number(s.b[0]) + '" y2="' + number(s.b[1]) + '" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></line>';
    if (s.kind === "circle") return '<circle cx="' + number(s.center[0]) + '" cy="' + number(s.center[1]) + '" r="' + number(s.radius) + '" stroke="currentColor" fill="none" stroke-width="' + number(s.strokeWidth) + '"' + data + '></circle>';
    if (s.kind === "rect") return '<rect x="' + number(s.x) + '" y="' + number(s.y) + '" width="' + number(s.width) + '" height="' + number(s.height) + '"' + (s.attrs.rx !== undefined ? ' rx="' + number(nonnegative(s.attrs.rx, "rect.rx")) + '"' : "") + ' fill="' + (s.role === "decorative" ? "#FBF8EF" : "none") + '" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></rect>';
    if (s.kind === "polygon") return '<polygon points="' + pointList(s.points) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></polygon>';
    if (s.kind === "polyline") return '<polyline points="' + pointList(s.points) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></polyline>';
    if (s.kind === "path") return '<path d="' + escapeAttr(s.d) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></path>';
    if (s.kind === "arrow") return '<line x1="' + number(s.from[0]) + '" y1="' + number(s.from[1]) + '" x2="' + number(s.to[0]) + '" y2="' + number(s.to[1]) + '" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '" marker-end="url(#' + escapeAttr(s._markerId) + ')"' + data + '></line>';
    if (s.kind === "body") return '<polygon points="' + pointList(s.corners) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></polygon>';
    if (s.kind === "angleArc") return '<path d="' + escapeAttr(s.path) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></path>';
    if (s.kind === "dimension") return '<path d="' + escapeAttr(s.path) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></path>';
    if (s.kind === "rope") return '<path d="' + escapeAttr(s.path) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></path>';
    if (s.kind === "label") {
      const bg = s.background === "opaque" ? ' data-label-background="opaque"' : ' data-label-background="none"';
      const labelBox = bboxOf(s);
      const backgroundId = s._backgroundId || s.id + "-background";
      const background = s.background === "opaque" ? '<rect id="' + escapeAttr(backgroundId) + '" x="' + number(labelBox.x) + '" y="' + number(labelBox.y) + '" width="' + number(labelBox.width) + '" height="' + number(labelBox.height) + '" fill="#FBF8EF" stroke="none" data-role="label-background" data-geometry-id="' + escapeAttr(backgroundId) + '" data-label-background="opaque"></rect>' : "";
      return background + '<text x="' + number(s.at[0]) + '" y="' + number(s.at[1]) + '" text-anchor="' + escapeAttr(s.textAnchor) + '" font-size="' + number(s.fontSize) + '" data-label="' + escapeAttr(s.text) + '" data-label-anchor="' + escapeAttr(s.anchorId) + '" data-label-avoid="' + escapeAttr(s.avoid.join(",")) + '" data-label-min-clearance="' + number(s.minClearance) + '"' + bg + data + '>' + escapeText(s.text) + '</text>';
    }
    fail("INVALID_ELEMENT", "cannot serialize unknown element kind");
  }

  function validateManifestStructure(manifest) {
    if (!manifest || typeof manifest !== "object") fail("INVALID_MANIFEST", "manifest is required");
    id(manifest.id, "manifest.id");
    if (typeof manifest.title !== "string" || !manifest.title.trim() || typeof manifest.description !== "string" || !manifest.description.trim()) fail("MISSING_ACCESSIBILITY", "manifest title and description are required");
    if (manifest.purpose !== "prompt" && manifest.purpose !== "solution") fail("INVALID_PURPOSE", "manifest purpose must be prompt or solution");
    const titleId = manifest.id + "-title"; const descriptionId = manifest.id + "-desc"; const aria = titleId + " " + descriptionId;
    if (manifest.titleId !== titleId || manifest.descriptionId !== descriptionId || manifest.ariaLabelledby !== aria) fail("MISSING_ACCESSIBILITY", "manifest accessibility IDs must reference its own title and description");
    [manifest.width, manifest.height].forEach((v) => finite(v, "manifest dimension"));
    if (!(manifest.width > 0) || !(manifest.height > 0)) fail("DEGENERATE", "manifest dimensions must be positive");
    if (!Array.isArray(manifest.viewBox) || manifest.viewBox.length !== 4) fail("INVALID_MANIFEST", "manifest viewBox must be four finite numbers");
    manifest.viewBox.forEach((v) => finite(v, "manifest viewBox"));
    if (manifest.viewBox[0] !== 0 || manifest.viewBox[1] !== 0 || manifest.viewBox[2] !== manifest.width || manifest.viewBox[3] !== manifest.height) fail("INVALID_MANIFEST", "manifest viewBox must match declared dimensions");
    if (!manifest.bounds || typeof manifest.bounds !== "object") fail("INVALID_MANIFEST", "manifest bounds are required");
    [manifest.bounds.x, manifest.bounds.y, manifest.bounds.width, manifest.bounds.height].forEach((v) => nonnegative(v, "manifest bounds"));
    if (manifest.bounds.x !== manifest.viewBox[0] || manifest.bounds.y !== manifest.viewBox[1] || manifest.bounds.width !== manifest.width || manifest.bounds.height !== manifest.height) fail("INVALID_MANIFEST", "manifest bounds must match viewBox");
    if (!Array.isArray(manifest.layers) || manifest.layers.map((layer) => layer.name).join(",") !== LAYERS.join(",")) fail("INVALID_LAYERS", "manifest layers must be geometry, connections, information, labels");
    const seen = new Set();
    const bounds = { x: 0, y: 0, width: manifest.width, height: manifest.height };
    const layerElements = [];
    manifest.layers.forEach((layer) => {
      if (!layer || !Array.isArray(layer.elements)) fail("INVALID_MANIFEST", "each layer requires an element array");
      layer.elements.forEach((element) => {
      id(element.id, "element.id");
      if (seen.has(element.id)) fail("DUPLICATE_ID", "duplicate element ID: " + element.id);
      seen.add(element.id);
      if (!element.bbox || typeof element.bbox !== "object") fail("INVALID_MANIFEST", "element requires a bounding box");
      [element.bbox.x, element.bbox.y, element.bbox.width, element.bbox.height].forEach((v) => nonnegative(v, "element bbox"));
      finite(element.strokeWidth, "element stroke width");
      if (element.bbox.width < 0 || element.bbox.height < 0 || element.strokeWidth < 0) fail("NEGATIVE", "manifest extents and strokes must be non-negative");
      if (element.bbox.x < bounds.x - EPSILON || element.bbox.y < bounds.y - EPSILON || element.bbox.x + element.bbox.width > bounds.width + EPSILON || element.bbox.y + element.bbox.height > bounds.height + EPSILON) fail("VIEWBOX_OVERFLOW", "element overflows the declared viewBox: " + element.id);
      if (!element.role || !ROLES.has(element.role)) fail("INVALID_ROLE", "element has no validated semantic role");
      if (element.role === "decorative") { if (element.collision !== false) fail("INVALID_COLLISION", "decorative exemptions must be explicitly non-colliding"); }
      else if (element.collision !== true) fail("INVALID_COLLISION", "every semantic painted element must remain a collision object");
      if (element.kind === "label") {
        if (!element.anchorId || typeof element.anchorId !== "string") fail("INVALID_LABEL", "label anchorId is required");
        if (!element.avoid || !Array.isArray(element.avoid)) fail("INVALID_LABEL", "label avoid IDs are required");
      }
      layerElements.push(Object.assign({ layer: layer.name }, element));
    });
    });
    layerElements.forEach((element) => {
      const canonical = canonicalGeometry(element);
      if (!geometryEqual(element.bbox, canonical.bbox) || !geometryEqual(element.strokeWidth, canonical.strokeWidth)) fail("INVALID_MANIFEST", "canonical geometry extents were tampered: " + element.id);
      if (!geometryEqual(recordGeometry(element), canonical.geometry)) fail("INVALID_MANIFEST", "canonical geometry was tampered: " + element.id);
      if (canonical.path !== undefined && !geometryEqual(element.path, canonical.path)) fail("INVALID_MANIFEST", "canonical path was tampered: " + element.id);
      if (canonical.arrowhead !== undefined) {
        const arrowhead = Object.assign({}, element.arrowhead);
        delete arrowhead.markerId; delete arrowhead.markerPathId;
        if (!geometryEqual(arrowhead, canonical.arrowhead)) fail("INVALID_MANIFEST", "canonical arrowhead was tampered: " + element.id);
      }
    });
    if (!Array.isArray(manifest.elements)) fail("INVALID_MANIFEST", "manifest elements are required");
    const expectedElements = layerElements.concat((manifest.backgrounds || []).map((background) => Object.assign({ layer: "labels", kind: "rect", collision: true, strokeWidth: 0, x: background.x, y: background.y, width: background.width, height: background.height }, background)));
    if (manifest.elements.length !== expectedElements.length) fail("INVALID_MANIFEST", "manifest elements do not reconcile with painted layers");
    const byId = new Map(manifest.elements.map((element) => [element.id, element]));
    expectedElements.forEach((element) => {
      const actual = byId.get(element.id);
      if (!actual || actual.kind !== element.kind || actual.layer !== element.layer || actual.collision !== element.collision) fail("INVALID_MANIFEST", "manifest painted element reconciliation failed: " + element.id);
      if (!deepEqual(actual, element)) fail("INVALID_MANIFEST", "manifest canonical element was tampered: " + element.id);
    });
    const layerAlias = { geometry: manifest.geometry, connections: manifest.connections, information: manifest.information, labels: manifest.labels };
    LAYERS.forEach((name, index) => { if (!Array.isArray(layerAlias[name]) || !deepEqual(layerAlias[name], manifest.layers[index].elements)) fail("INVALID_MANIFEST", "manifest layer alias was tampered: " + name); });
    const elementIds = new Set(manifest.elements.map((element) => element.id));
    manifest.elements.forEach((element) => {
      if (!element.bbox || typeof element.bbox !== "object") fail("INVALID_MANIFEST", "painted element bbox is invalid");
      [element.bbox.x, element.bbox.y, element.bbox.width, element.bbox.height].forEach((value) => nonnegative(value, "painted element bbox"));
      finite(element.strokeWidth, "painted element stroke width");
      if (element.bbox.x + element.bbox.width > manifest.width + EPSILON || element.bbox.y + element.bbox.height > manifest.height + EPSILON) fail("VIEWBOX_OVERFLOW", "painted element overflows the viewBox: " + element.id);
    });
    manifest.elements.filter((element) => element.role === "label-background").forEach((element) => {
      const canonical = canonicalGeometry(element);
      if (!geometryEqual(element.bbox, canonical.bbox) || !geometryEqual(element.strokeWidth, canonical.strokeWidth)) fail("INVALID_MANIFEST", "canonical background was tampered: " + element.id);
    });
    manifest.elements.filter((element) => element.kind === "label").forEach((element) => {
      const anchor = byId.get(element.anchorId);
      if (!anchor || anchor.id === element.id || ["label", "label-background", "decorative"].includes(anchor.role) || anchor.collision !== true) fail("INVALID_LABEL", "label anchorId must reference semantic anchorable geometry: " + element.id);
      element.avoid.forEach((avoidId) => { const avoided = byId.get(avoidId); if (!avoided || avoided.id === element.id || ["label", "label-background", "decorative"].includes(avoided.role)) fail("INVALID_LABEL", "label avoid ID must reference semantic geometry: " + avoidId); });
    });
    const exactIds = (items, name) => {
      if (!Array.isArray(items)) fail("INVALID_MANIFEST", name + " must be an array");
      items.forEach((item) => { if (!item || !elementIds.has(item.id)) fail("INVALID_MANIFEST", name + " references an unrelated ID"); });
    };
    exactIds(manifest.collisions, "collisions");
    if (new Set(manifest.collisions.map((item) => item.id)).size !== manifest.elements.filter((element) => element.collision).length) fail("INVALID_COLLISION", "every colliding painted element needs exactly one collision record");
    exactIds(manifest.paths, "paths"); exactIds(manifest.strokes, "strokes"); exactIds(manifest.arrowheads, "arrowheads");
    exactIds(manifest.backgrounds, "backgrounds");
    manifest.paths.forEach((item) => { if (typeof item.path !== "string" || !item.path.trim()) fail("INVALID_MANIFEST", "painted path is missing its path data"); });
    manifest.strokes.forEach((item) => nonnegative(item.width, "stroke width"));
    manifest.backgrounds.forEach((item) => { if (item.fill !== "#FBF8EF") fail("INVALID_MANIFEST", "opaque label background must use paper fill"); });
    const pathIds = new Set(manifest.elements.filter((element) => element.path).map((element) => element.id));
    const strokeIds = new Set(manifest.elements.filter((element) => element.strokeWidth > 0).map((element) => element.id));
    const arrowIds = new Set(manifest.elements.filter((element) => element.arrowhead).map((element) => element.id));
    const backgroundIds = new Set(manifest.elements.filter((element) => element.role === "label-background").map((element) => element.id));
    const canonicalCollisions = manifest.elements.filter((element) => element.collision).map((element) => ({ id: element.id, role: element.role, bbox: element.bbox, layer: element.layer, minClearance: element.minClearance || 0 }));
    if (!deepEqual(manifest.collisions, canonicalCollisions)) fail("INVALID_MANIFEST", "collision records were tampered");
    const canonicalStrokes = manifest.elements.filter((element) => element.strokeWidth > 0).map((element) => ({ id: element.id, layer: element.layer, width: element.strokeWidth }));
    if (!deepEqual(manifest.strokes, canonicalStrokes)) fail("INVALID_MANIFEST", "stroke records were tampered");
    const canonicalPaths = manifest.elements.filter((element) => element.path).map((element) => ({ id: element.id, layer: element.layer, path: element.path }));
    if (!deepEqual(manifest.paths, canonicalPaths)) fail("INVALID_MANIFEST", "path records were tampered");
    const canonicalArrows = manifest.elements.filter((element) => element.arrowhead).map((element) => Object.assign({ id: element.id, layer: element.layer }, element.arrowhead));
    if (!deepEqual(manifest.arrowheads, canonicalArrows)) fail("INVALID_MANIFEST", "arrowhead records were tampered");
    const canonicalBackgrounds = manifest.elements.filter((element) => element.role === "label-background").map((element) => ({ id: element.id, labelId: element.labelId, x: element.x, y: element.y, width: element.width, height: element.height, bbox: element.bbox, role: element.role, collision: true, fill: element.fill }));
    if (!deepEqual(manifest.backgrounds, canonicalBackgrounds)) fail("INVALID_MANIFEST", "background records were tampered");
    if (new Set(manifest.paths.map((item) => item.id)).size !== pathIds.size || manifest.paths.some((item) => !pathIds.has(item.id))) fail("INVALID_MANIFEST", "paths do not reconcile with painted paths");
    if (new Set(manifest.strokes.map((item) => item.id)).size !== strokeIds.size || manifest.strokes.some((item) => !strokeIds.has(item.id))) fail("INVALID_MANIFEST", "strokes do not reconcile with painted strokes");
    if (new Set(manifest.arrowheads.map((item) => item.id)).size !== arrowIds.size || manifest.arrowheads.some((item) => !arrowIds.has(item.id))) fail("INVALID_MANIFEST", "arrowheads do not reconcile with painted arrows");
    if (new Set(manifest.backgrounds.map((item) => item.id)).size !== backgroundIds.size || manifest.backgrounds.some((item) => !backgroundIds.has(item.id))) fail("INVALID_MANIFEST", "backgrounds do not reconcile with painted backgrounds");
    if (!Array.isArray(manifest.domIds)) fail("INVALID_MANIFEST", "domIds are required");
    if (manifest.arrowheads.some((item) => !item.markerId || !item.markerPathId || !(manifest.fragmentIds || []).includes(item.markerId) || !(manifest.fragmentIds || []).includes(item.markerPathId))) fail("INVALID_MANIFEST", "arrowhead marker IDs are not declared");
    const domIds = new Set(manifest.domIds); const declaredIds = new Set([manifest.id, titleId, descriptionId].concat(manifest.elements.map((element) => element.id), manifest.fragmentIds || []));
    if (domIds.size !== manifest.domIds.length || domIds.size !== declaredIds.size || !manifest.domIds.every((fragmentId) => declaredIds.has(fragmentId)) || !domIds.has(manifest.id) || !domIds.has(titleId) || !domIds.has(descriptionId)) fail("DUPLICATE_ID", "manifest DOM IDs are not unique or complete");
    if (manifest.fragmentIds !== undefined && !Array.isArray(manifest.fragmentIds)) fail("INVALID_MANIFEST", "fragmentIds must be an array");
    if (manifest.fragmentIds) {
      manifest.fragmentIds.forEach((fragmentId) => {
        id(fragmentId, "fragment.id");
        if (seen.has(fragmentId)) fail("DUPLICATE_ID", "duplicate fragment ID: " + fragmentId);
        seen.add(fragmentId);
      });
    }
    const expectedFragments = new Set(manifest.elements.filter((element) => element.role === "label-background").map((element) => element.id).concat(manifest.arrowheads.flatMap((item) => [item.markerId, item.markerPathId])));
    if (expectedFragments.size !== (manifest.fragmentIds || []).length || (manifest.fragmentIds || []).some((fragmentId) => !expectedFragments.has(fragmentId))) fail("INVALID_MANIFEST", "fragment IDs do not reconcile with painted marker/background fragments");
    return true;
  }

  function validateManifest(manifest) {
    if (!manifest || typeof manifest !== "object") fail("INVALID_MANIFEST", "manifest is required");
    const provenance = MANIFEST_META.get(manifest);
    if (!provenance || !deepEqual(manifest, provenance.snapshot)) fail("INVALID_MANIFEST", "manifest provenance invalid; accessibility aria/canonical geometry/path tamper detected");
    return validateManifestStructure(manifest);
  }

  function create(options) {
    const opts = options || {};
    const diagramId = id(opts.id, "diagram.id");
    const title = opts.title; const description = opts.description;
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()) fail("MISSING_ACCESSIBILITY", "diagram title and description are required");
    const width = finite(opts.width, "diagram.width"); const height = finite(opts.height, "diagram.height");
    if (!(width > 0) || !(height > 0)) fail("DEGENERATE", "diagram dimensions must be positive");
    const purpose = opts.purpose;
    if (purpose !== "prompt" && purpose !== "solution") fail("INVALID_PURPOSE", "diagram purpose must be prompt or solution");
    const rootIds = [diagramId, diagramId + "-title", diagramId + "-desc"];
    const layers = LAYERS.map((name) => ({ name, elements: [] }));
    const elementIds = new Set(); let finished = false;
    const builder = {
      add(layerName, element) {
        if (finished) fail("FINISHED", "cannot add elements after finish");
        if (!LAYERS.includes(layerName)) fail("INVALID_LAYERS", "unknown diagram layer: " + layerName);
        const shape = primitiveFromGeometry(element, {});
        if (elementIds.has(shape.id)) fail("DUPLICATE_ID", "duplicate element ID: " + shape.id);
        elementIds.add(shape.id); layers[LAYERS.indexOf(layerName)].elements.push(shape); return builder;
      },
      finish() {
        if (finished) fail("FINISHED", "diagram has already been finished");
        const fragmentIds = [];
        layers.forEach((layer) => layer.elements.forEach((element) => {
          if (element.kind === "arrow") { element._markerId = diagramId + "-marker-" + element.id; element._markerPathId = element._markerId + "-path"; fragmentIds.push(element._markerId, element._markerPathId); }
          if (element.kind === "label" && element.background === "opaque") { element._backgroundId = diagramId + "-" + element.id + "-background"; fragmentIds.push(element._backgroundId); }
        }));
        const allDomIds = rootIds.concat(layers.flatMap((layer) => layer.elements.map((element) => element.id)), fragmentIds);
        const manifestLayers = layers.map((layer) => ({ name: layer.name, elements: layer.elements.map((element) => {
          const record = { id: element.id, kind: element.kind, role: element.role, bbox: bboxOf(element), collision: element.semantic !== false, strokeWidth: element.strokeWidth || 0 };
          if (element.kind === "line" || element.kind === "arrow") Object.assign(record, { from: clone(element.from || element.a), to: clone(element.to || element.b) });
          if (element.kind === "arrow") Object.assign(record, { arrowhead: { points: element.head.map(clone), headLength: element.headLength, headWidth: element.headWidth, markerId: element._markerId, markerPathId: element._markerPathId } });
          if (element.kind === "circle") Object.assign(record, { center: clone(element.center), radius: element.radius });
          if (element.kind === "body") Object.assign(record, { points: element.corners.map(clone), line: { a: clone(element.line.a), b: clone(element.line.b) }, outwardNormal: clone(element.outwardNormal), bottomCenter: clone(element.bottomCenter), width: length(sub(element.bottomRight, element.bottomLeft)), height: length(sub(element.topLeft, element.bottomLeft)) });
          if (element.kind === "polygon" || element.kind === "polyline") Object.assign(record, { points: element.points.map(clone) });
          if (element.kind === "rect") Object.assign(record, { x: element.x, y: element.y, width: element.width, height: element.height, rx: element.attrs.rx });
          if (element.kind === "path" || element.kind === "angleArc" || element.kind === "rope" || element.kind === "dimension") Object.assign(record, { path: element.d || element.path, segments: element.segments || null });
          if (element.kind === "path") record.commands = element.commands.slice();
          if (element.kind === "dimension") Object.assign(record, { a: clone(element.a), b: clone(element.b), normal: clone(element.normal), offset: element.offset, anchors: element.anchors.map(clone), extension: element.extension });
          if (element.kind === "angleArc") Object.assign(record, { vertex: clone(element.vertex), fromRay: clone(element.fromRay), toRay: clone(element.toRay), radius: element.radius, sweep: element.sweep });
          if (element.kind === "rope") Object.assign(record, { from: clone(element.from), to: clone(element.to), pulley: { center: clone(element.pulley.center), radius: element.pulley.radius }, side: element.side, fromTangent: clone(element.fromTangent), toTangent: clone(element.toTangent), arc: Object.assign({}, element.arc) });
          if (element.kind === "label") Object.assign(record, { at: clone(element.at), anchorId: element.anchorId, textAnchor: element.textAnchor, text: element.text, avoid: element.avoid.slice(), minClearance: element.minClearance, fontSize: element.fontSize, background: element.background });
          return record;
        }) }));
        const backgroundRecords = manifestLayers[3].elements.filter((element) => element.background === "opaque").map((element) => ({ id: element._backgroundId || diagramId + "-" + element.id + "-background", kind: "rect", role: "label-background", x: element.bbox.x, y: element.bbox.y, width: element.bbox.width, height: element.bbox.height, bbox: element.bbox, collision: true, strokeWidth: 0, fill: "#FBF8EF", labelId: element.id }));
        const paintedElements = manifestLayers.flatMap((layer) => layer.elements.map((element) => Object.assign({ layer: layer.name }, element))).concat(backgroundRecords.map((element) => Object.assign({ layer: "labels" }, element)));
        const manifest = {
          id: diagramId, title, description, purpose, width, height, viewBox: [0, 0, width, height],
          titleId: diagramId + "-title", descriptionId: diagramId + "-desc", ariaLabelledby: diagramId + "-title " + diagramId + "-desc",
          bounds: { x: 0, y: 0, width, height }, layers: manifestLayers,
          geometry: manifestLayers[0].elements, connections: manifestLayers[1].elements, information: manifestLayers[2].elements, labels: manifestLayers[3].elements,
          elements: paintedElements,
          strokes: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.strokeWidth > 0).map((element) => ({ id: element.id, layer: layer.name, width: element.strokeWidth }))),
          paths: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.path).map((element) => ({ id: element.id, layer: layer.name, path: element.path }))),
          arrowheads: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.arrowhead).map((element) => Object.assign({ id: element.id, layer: layer.name }, element.arrowhead))),
          backgrounds: backgroundRecords.map((element) => ({ id: element.id, labelId: element.labelId, x: element.x, y: element.y, width: element.width, height: element.height, bbox: element.bbox, role: element.role, collision: true, fill: element.fill })),
          collisions: paintedElements.filter((element) => element.collision).map((element) => ({ id: element.id, role: element.role, bbox: element.bbox, layer: element.layer, minClearance: element.minClearance || 0 })),
          fragmentIds: Array.from(new Set(fragmentIds))
        };
        manifest.domIds = allDomIds;
        validateManifestStructure(manifest);
        const body = layers.map((layer) => '<g data-layer="' + layer.name + '">' + layer.elements.map(attrsFor).join("") + "</g>").join("");
        const arrowElements = layers.flatMap((layer) => layer.elements).filter((element) => element.kind === "arrow");
        const marker = arrowElements.length ? '<defs>' + arrowElements.map((arrowElement) => '<marker id="' + escapeAttr(arrowElement._markerId) + '" viewBox="0 0 ' + number(arrowElement.headLength) + ' ' + number(arrowElement.headWidth) + '" markerWidth="' + number(arrowElement.headLength) + '" markerHeight="' + number(arrowElement.headWidth) + '" markerUnits="userSpaceOnUse" refX="' + number(arrowElement.headLength) + '" refY="' + number(arrowElement.headWidth / 2) + '" orient="auto"><path id="' + escapeAttr(arrowElement._markerPathId) + '" d="M0,0 L' + number(arrowElement.headLength) + ',' + number(arrowElement.headWidth / 2) + ' L0,' + number(arrowElement.headWidth) + ' z" fill="currentColor" data-role="marker" data-geometry-id="' + escapeAttr(arrowElement._markerPathId) + '"></path></marker>').join("") + '</defs>' : "";
        const html = '<svg id="' + escapeAttr(diagramId) + '" viewBox="0 0 ' + number(width) + ' ' + number(height) + '" role="img" aria-labelledby="' + escapeAttr(diagramId + "-title " + diagramId + "-desc") + '"><title id="' + escapeAttr(diagramId + "-title") + '">' + escapeText(title) + '</title><desc id="' + escapeAttr(diagramId + "-desc") + '">' + escapeText(description) + '</desc>' + marker + body + '</svg>';
        const parsedIds = [];
        const idPattern = /\sid="([A-Za-z_][A-Za-z0-9_.:-]*)"/gu; let idMatch;
        while ((idMatch = idPattern.exec(html))) parsedIds.push(idMatch[1]);
        if (new Set(parsedIds).size !== parsedIds.length || parsedIds.length !== allDomIds.length || parsedIds.some((value) => !allDomIds.includes(value))) fail("INVALID_MANIFEST", "serialized DOM IDs do not reconcile with manifest.domIds");
        const localIds = new Set();
        allDomIds.forEach((fragmentId) => {
          id(fragmentId, "fragment.id");
          if (localIds.has(fragmentId) || USED_FRAGMENT_IDS.has(fragmentId)) fail("DUPLICATE_ID", "duplicate emitted DOM ID: " + fragmentId);
          localIds.add(fragmentId);
        });
        finished = true;
        allDomIds.forEach((fragmentId) => USED_FRAGMENT_IDS.add(fragmentId));
        const canonicalSnapshot = snapshotValue(manifest);
        deepFreeze(manifest);
        const frozenManifest = new Proxy(manifest, {
          set() { fail("FROZEN_MANIFEST", "manifest is read-only and frozen"); },
          deleteProperty() { fail("FROZEN_MANIFEST", "manifest is read-only and frozen"); },
          defineProperty() { fail("FROZEN_MANIFEST", "manifest is read-only and frozen"); }
        });
        MANIFEST_META.set(frozenManifest, { snapshot: canonicalSnapshot });
        return { html, manifest: frozenManifest };
      }
    };
    return builder;
  }

  return {
    EPSILON, normalize, normalizeVector: normalize, add, subtract: sub, sub, scale: mul, dot, cross, magnitude: length,
    signedPointLineDistance,
    pointLineDistance: signedPointLineDistance, signedDistanceToLine: signedPointLineDistance,
    bodyOnLine, tangentPointsFromExternalPoint, tangentPoints: tangentPointsFromExternalPoint, ropeAroundCircle,
    angleArc, dimension, arrow, graphTransform, line, circle: circleShape, rect, polygon, polyline, path, label,
    create, validateManifest
  };
});
