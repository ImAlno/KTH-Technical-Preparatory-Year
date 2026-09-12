(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.KS = root.KS || {};
    root.KS.diagramKit = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const EPSILON = 1e-12;
  const ORIGIN = [0, 0];
  const USED_FRAGMENT_IDS = new Set();
  const LAYERS = ["geometry", "connections", "information", "labels"];
  const ROLES = new Set([
    "line", "support", "ground", "wall", "contact", "body", "circle", "pulley", "rope", "connection",
    "force", "motion", "arrow", "dimension", "measure", "angle", "arc", "axis", "grid", "point", "marker",
    "shape", "label", "decorative"
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
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function mul(a, scalar) { finite(scalar, "scalar"); return [a[0] * scalar, a[1] * scalar]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
  function length(v) { return Math.hypot(v[0], v[1]); }

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
    return {
      kind: "body", role: opts.role || "body", semantic: true,
      id: opts.id,
      line: actualLine,
      tangent,
      outwardNormal: outward,
      bottomCenter: lineUnit,
      bottomLeft,
      bottomRight,
      bottomCorners: [clone(bottomLeft), clone(bottomRight)],
      topRight,
      topLeft,
      corners: [bottomLeft, bottomRight, topRight, topLeft],
      polygon: [bottomLeft, bottomRight, topRight, topLeft]
    };
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

  function ropeAroundCircle(options) {
    const opts = options || {};
    if (opts.side !== undefined && !["top", "bottom", "left", "right", "short", "long"].includes(opts.side) && !Array.isArray(opts.side)) fail("INVALID_SIDE", "rope side must be top, bottom, left, right, short, long, or a vector");
    const from = vector(opts.from, "rope.from");
    const to = vector(opts.to, "rope.to");
    const pulley = circle(opts.pulley || opts.circle);
    const r = positiveRadius(pulley.radius);
    const fromTangent = chooseTangent(tangentPointsFromExternalPoint(from, pulley), pulley.center, opts.side);
    const toTangent = chooseTangent(tangentPointsFromExternalPoint(to, pulley), pulley.center, opts.side);
    const startAngle = Math.atan2(fromTangent[1] - pulley.center[1], fromTangent[0] - pulley.center[0]);
    const endAngle = Math.atan2(toTangent[1] - pulley.center[1], toTangent[0] - pulley.center[0]);
    let delta = normalizeAngle(endAngle - startAngle);
    let sweep = 1;
    if (opts.side === "bottom") { sweep = -1; delta = normalizeAngle(startAngle - endAngle); }
    else if (opts.side === "left") { sweep = -1; delta = normalizeAngle(startAngle - endAngle); }
    else if (opts.side === "short") {
      if (delta > Math.PI) { sweep = -1; delta = Math.PI * 2 - delta; }
    } else if (opts.side === "long") {
      if (delta < Math.PI) { sweep = -1; delta = Math.PI * 2 - delta; }
    } else if (delta > Math.PI) { sweep = -1; delta = Math.PI * 2 - delta; }
    const arc = { kind: "arc", from: clone(fromTangent), to: clone(toTangent), center: clone(pulley.center), radius: r, sweep, largeArc: delta > Math.PI };
    const fromSegment = { kind: "segment", from: clone(from), to: clone(fromTangent) };
    const toSegment = { kind: "segment", from: clone(toTangent), to: clone(to) };
    [fromTangent, toTangent].forEach(function (point, index) {
      const external = index ? to : from;
      if (Math.abs(dot(sub(point, pulley.center), sub(external, point))) > 1e-6) fail("INVARIANT", "rope tangent is not orthogonal to its radius");
    });
    return {
      kind: "rope", role: opts.role || "rope", semantic: true,
      id: opts.id, from, to, pulley: { center: clone(pulley.center), radius: r }, fromTangent, toTangent,
      tangentPoints: [clone(fromTangent), clone(toTangent)], start: clone(fromTangent), end: clone(toTangent), segments: [fromSegment, arc, toSegment], arc,
      length: length(sub(from, fromTangent)) + r * delta + length(sub(to, toTangent))
    };
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
    return {
      kind: "angleArc", role: opts.role || "angle", semantic: true,
      id: opts.id, vertex, fromRay, toRay, radius, start, end, radians,
      startPoint: clone(start), endPoint: clone(end), degrees: radians * 180 / Math.PI, sweep: crossValue >= 0 ? 1 : 0, largeArc: radians > Math.PI,
      path: "M " + start[0] + " " + start[1] + " A " + radius + " " + radius + " 0 " + (radians > Math.PI ? 1 : 0) + " " + (crossValue >= 0 ? 1 : 0) + " " + end[0] + " " + end[1]
    };
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
    return { kind: "dimension", role: opts.role || "dimension", semantic: true, id: opts.id, a, b, tangent, normal, offset, start, end, startAnchor: clone(start), endAnchor: clone(end), anchors: [clone(start), clone(end)], extension: [{ from: clone(a), to: clone(start) }, { from: clone(b), to: clone(end) }], length: length(sub(b, a)), labelAt: mul(add(start, end), 0.5) };
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
    return { kind: "arrow", id: opts.id, role: opts.role || "arrow", from, to, tangent, base, left, right, head: [clone(left), clone(to), clone(right)], path: "M " + from[0] + " " + from[1] + " L " + to[0] + " " + to[1], headLength, headWidth };
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
    if (!(x1 > x0) || !(y1 > y0) || !(pw > 0) || !(ph > 0)) fail("DEGENERATE", "graph domains and plot dimensions must increase");
    function toScreen(point) { const p = vector(point, "graph point"); return [px + (p[0] - x0) / (x1 - x0) * pw, py + ph - (p[1] - y0) / (y1 - y0) * ph]; }
    function fromScreen(point) { const p = vector(point, "screen point"); return [x0 + (p[0] - px) / pw * (x1 - x0), y0 + (py + ph - p[1]) / ph * (y1 - y0)]; }
    const result = { xDomain: [x0, x1], yDomain: [y0, y1], plot: { x: px, y: py, width: pw, height: ph }, xScale: pw / (x1 - x0), yScale: ph / (y1 - y0), toScreen, fromScreen };
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
    return { kind, id: shapeId, role: selectedRole, semantic: selectedRole !== "decorative", attrs: opts };
  }

  function line(options) {
    const s = shapeBase(options, "line", "line");
    s.a = vector(options.a, "line.a"); s.b = vector(options.b, "line.b"); s.strokeWidth = finite(options.strokeWidth === undefined ? 1 : options.strokeWidth, "line.strokeWidth");
    return s;
  }

  function circleShape(options) {
    const s = shapeBase(options, "circle", "circle");
    s.center = vector(options.center, "circle.center"); s.radius = positiveRadius(finite(options.radius, "circle.radius")); s.strokeWidth = finite(options.strokeWidth === undefined ? 1 : options.strokeWidth, "circle.strokeWidth");
    return s;
  }

  function rect(options) {
    const s = shapeBase(options, "rect", options && options.decorative ? "decorative" : "shape");
    s.x = finite(options.x, "rect.x"); s.y = finite(options.y, "rect.y"); s.width = finite(options.width, "rect.width"); s.height = finite(options.height, "rect.height");
    if (!(s.width >= 0) || !(s.height >= 0)) fail("DEGENERATE", "rectangle dimensions must be non-negative");
    s.strokeWidth = finite(options.strokeWidth === undefined ? 1 : options.strokeWidth, "rect.strokeWidth");
    return s;
  }

  function polygon(options) {
    const s = shapeBase(options, "polygon", "shape");
    if (!Array.isArray(options.points) || options.points.length < 3) fail("DEGENERATE", "polygon requires at least three points");
    s.points = options.points.map((p) => vector(p, "polygon.point")); s.strokeWidth = finite(options.strokeWidth === undefined ? 1 : options.strokeWidth, "polygon.strokeWidth");
    return s;
  }

  function polyline(options) {
    const s = shapeBase(options, "polyline", "line");
    if (!Array.isArray(options.points) || options.points.length < 2) fail("DEGENERATE", "polyline requires at least two points");
    s.points = options.points.map((p) => vector(p, "polyline.point")); s.strokeWidth = finite(options.strokeWidth === undefined ? 1 : options.strokeWidth, "polyline.strokeWidth");
    return s;
  }

  function path(options) {
    const s = shapeBase(options, "path", "line");
    if (typeof options.d !== "string" || !options.d.trim() || /(?:NaN|Infinity)/u.test(options.d)) fail("INVALID_PATH", "path requires finite numeric geometry");
    s.d = options.d; s.bbox = options.bbox ? { x: finite(options.bbox.x, "path.bbox.x"), y: finite(options.bbox.y, "path.bbox.y"), width: finite(options.bbox.width, "path.bbox.width"), height: finite(options.bbox.height, "path.bbox.height") } : null;
    s.strokeWidth = finite(options.strokeWidth === undefined ? 1 : options.strokeWidth, "path.strokeWidth");
    return s;
  }

  function label(options) {
    const opts = options || {};
    const s = shapeBase(Object.assign({}, opts, { role: "label" }), "label", "label");
    if (typeof opts.text !== "string" || !opts.text.trim()) fail("MISSING_ACCESSIBILITY", "label text is required");
    s.at = vector(opts.at, "label.at"); s.text = opts.text; s.anchor = opts.anchor || "start";
    if (!["start", "middle", "end"].includes(s.anchor)) fail("INVALID_LABEL", "label anchor must be start, middle, or end");
    s.avoid = (opts.avoid || []).map((value) => id(value, "label.avoid"));
    s.minClearance = finite(opts.minClearance === undefined ? 0 : opts.minClearance, "label.minClearance");
    if (s.minClearance < 0) fail("INVALID_LABEL", "label minClearance must be non-negative");
    s.fontSize = finite(opts.fontSize === undefined ? 14 : opts.fontSize, "label.fontSize");
    if (!(s.fontSize > 0)) fail("DEGENERATE", "label fontSize must be positive");
    s.background = opts.background === true || opts.background === "opaque" ? "opaque" : "none";
    return s;
  }

  function primitiveFromGeometry(geometry, options) {
    const opts = options || {};
    if (geometry && geometry.kind) {
      const s = Object.assign({}, geometry);
      if (opts.id && !s.id) s.id = id(opts.id, "element.id");
      if (!s.id) s.id = id("geometry-" + geometry.kind, "element.id");
      if (opts.role) s.role = opts.role;
      if (s.role && !ROLES.has(s.role)) fail("INVALID_ROLE", "unknown semantic role: " + s.role);
      if (!s.role) s.role = geometry.kind === "arrow" ? "arrow" : "shape";
      if (s.semantic !== false && s.role === "decorative") fail("DECORATIVE_SEMANTIC", "semantic geometry cannot use decorative role");
      s.id = id(s.id, "element.id");
      return s;
    }
    fail("INVALID_ELEMENT", "diagram elements must be kit primitives");
  }

  function bboxOf(s) {
    let points = [];
    if (s.kind === "line" || s.kind === "arrow") points = [s.from || s.a, s.to || s.b, ...(s.kind === "arrow" ? [s.left, s.right] : [])];
    else if (s.kind === "body") points = s.corners;
    else if (s.kind === "dimension") points = [s.a, s.b, s.start, s.end];
    else if (s.kind === "angleArc") points = [s.start, s.end, s.vertex];
    else if (s.kind === "rope") points = [s.from, s.to, s.fromTangent, s.toTangent, s.pulley.center];
    else if (s.kind === "circle") return { x: s.center[0] - s.radius - s.strokeWidth / 2, y: s.center[1] - s.radius - s.strokeWidth / 2, width: 2 * s.radius + s.strokeWidth, height: 2 * s.radius + s.strokeWidth };
    else if (s.kind === "rect") return { x: s.x - s.strokeWidth / 2, y: s.y - s.strokeWidth / 2, width: s.width + s.strokeWidth, height: s.height + s.strokeWidth };
    else if (s.kind === "polygon" || s.kind === "polyline") points = s.points;
    else if (s.kind === "label") {
      const width = Math.max(1, s.text.length * s.fontSize * 0.58);
      const x = s.anchor === "middle" ? s.at[0] - width / 2 : s.anchor === "end" ? s.at[0] - width : s.at[0];
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

  function escapeText(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escapeAttr(value) { return escapeText(value).replace(/"/g, "&quot;"); }
  function number(value) { finite(value); return String(Number(value.toFixed(12))); }
  function pointList(points) { return points.map((p) => number(p[0]) + "," + number(p[1])).join(" "); }

  function attrsFor(s) {
    const data = ' data-role="' + escapeAttr(s.role) + '" data-geometry-id="' + escapeAttr(s.id) + '"';
    if (s.kind === "line") return '<line x1="' + number(s.a[0]) + '" y1="' + number(s.a[1]) + '" x2="' + number(s.b[0]) + '" y2="' + number(s.b[1]) + '" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></line>';
    if (s.kind === "circle") return '<circle cx="' + number(s.center[0]) + '" cy="' + number(s.center[1]) + '" r="' + number(s.radius) + '" stroke="currentColor" fill="none" stroke-width="' + number(s.strokeWidth) + '"' + data + '></circle>';
    if (s.kind === "rect") return '<rect x="' + number(s.x) + '" y="' + number(s.y) + '" width="' + number(s.width) + '" height="' + number(s.height) + '"' + (s.attrs.rx ? ' rx="' + number(finite(s.attrs.rx, "rect.rx")) + '"' : "") + ' fill="' + (s.role === "decorative" ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></rect>';
    if (s.kind === "polygon") return '<polygon points="' + pointList(s.points) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></polygon>';
    if (s.kind === "polyline") return '<polyline points="' + pointList(s.points) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></polyline>';
    if (s.kind === "path") return '<path d="' + escapeAttr(s.d) + '" fill="none" stroke="currentColor" stroke-width="' + number(s.strokeWidth) + '"' + data + '></path>';
    if (s.kind === "arrow") return '<line x1="' + number(s.from[0]) + '" y1="' + number(s.from[1]) + '" x2="' + number(s.to[0]) + '" y2="' + number(s.to[1]) + '" stroke="currentColor" stroke-width="2" marker-end="url(#' + escapeAttr(s._markerId) + ')"' + data + '></line>';
    if (s.kind === "body") return '<polygon points="' + pointList(s.corners) + '" fill="none" stroke="currentColor" stroke-width="1"' + data + '></polygon>';
    if (s.kind === "angleArc") return '<path d="' + escapeAttr(s.path) + '" fill="none" stroke="currentColor" stroke-width="1"' + data + '></path>';
    if (s.kind === "dimension") return '<line x1="' + number(s.start[0]) + '" y1="' + number(s.start[1]) + '" x2="' + number(s.end[0]) + '" y2="' + number(s.end[1]) + '" stroke="currentColor" stroke-width="1"' + data + '></line>';
    if (s.kind === "rope") return '<path d="M ' + number(s.from[0]) + ' ' + number(s.from[1]) + ' L ' + number(s.fromTangent[0]) + ' ' + number(s.fromTangent[1]) + ' A ' + number(s.pulley.radius) + ' ' + number(s.pulley.radius) + ' 0 ' + (s.arc.largeArc ? 1 : 0) + ' ' + s.arc.sweep + ' ' + number(s.toTangent[0]) + ' ' + number(s.toTangent[1]) + ' L ' + number(s.to[0]) + ' ' + number(s.to[1]) + '" fill="none" stroke="currentColor" stroke-width="1"' + data + '></path>';
    if (s.kind === "label") {
      const bg = s.background === "opaque" ? ' data-label-background="opaque"' : ' data-label-background="none"';
      const labelBox = bboxOf(s);
      const backgroundId = s._backgroundId || s.id + "-background";
      const background = s.background === "opaque" ? '<rect id="' + escapeAttr(backgroundId) + '" x="' + number(labelBox.x) + '" y="' + number(labelBox.y) + '" width="' + number(labelBox.width) + '" height="' + number(labelBox.height) + '" fill="currentColor" stroke="none" data-role="decorative" data-geometry-id="' + escapeAttr(backgroundId) + '" data-label-background="opaque"></rect>' : "";
      return background + '<text x="' + number(s.at[0]) + '" y="' + number(s.at[1]) + '" text-anchor="' + escapeAttr(s.anchor) + '" font-size="' + number(s.fontSize) + '" data-label="' + escapeAttr(s.text) + '" data-label-anchor="' + escapeAttr(s.anchor) + '" data-label-avoid="' + escapeAttr(s.avoid.join(",")) + '" data-label-min-clearance="' + number(s.minClearance) + '"' + bg + data + '>' + escapeText(s.text) + '</text>';
    }
    fail("INVALID_ELEMENT", "cannot serialize unknown element kind");
  }

  function validateManifest(manifest) {
    if (!manifest || typeof manifest !== "object") fail("INVALID_MANIFEST", "manifest is required");
    id(manifest.id, "manifest.id");
    if (typeof manifest.title !== "string" || !manifest.title.trim() || typeof manifest.description !== "string" || !manifest.description.trim()) fail("MISSING_ACCESSIBILITY", "manifest title and description are required");
    if (manifest.purpose !== "prompt" && manifest.purpose !== "solution") fail("INVALID_PURPOSE", "manifest purpose must be prompt or solution");
    [manifest.width, manifest.height].forEach((v) => finite(v, "manifest dimension"));
    if (!(manifest.width > 0) || !(manifest.height > 0)) fail("DEGENERATE", "manifest dimensions must be positive");
    if (!Array.isArray(manifest.viewBox) || manifest.viewBox.length !== 4) fail("INVALID_MANIFEST", "manifest viewBox must be four finite numbers");
    manifest.viewBox.forEach((v) => finite(v, "manifest viewBox"));
    if (!manifest.bounds || typeof manifest.bounds !== "object") fail("INVALID_MANIFEST", "manifest bounds are required");
    [manifest.bounds.x, manifest.bounds.y, manifest.bounds.width, manifest.bounds.height].forEach((v) => finite(v, "manifest bounds"));
    if (!Array.isArray(manifest.layers) || manifest.layers.map((layer) => layer.name).join(",") !== LAYERS.join(",")) fail("INVALID_LAYERS", "manifest layers must be geometry, connections, information, labels");
    const seen = new Set();
    const bounds = { x: 0, y: 0, width: manifest.width, height: manifest.height };
    manifest.layers.forEach((layer) => (layer.elements || []).forEach((element) => {
      id(element.id, "element.id");
      if (seen.has(element.id)) fail("DUPLICATE_ID", "duplicate element ID: " + element.id);
      seen.add(element.id);
      if (!element.bbox || typeof element.bbox !== "object") fail("INVALID_MANIFEST", "element requires a bounding box");
      [element.bbox.x, element.bbox.y, element.bbox.width, element.bbox.height].forEach((v) => finite(v, "element bbox"));
      if (element.bbox.x < bounds.x - EPSILON || element.bbox.y < bounds.y - EPSILON || element.bbox.x + element.bbox.width > bounds.width + EPSILON || element.bbox.y + element.bbox.height > bounds.height + EPSILON) fail("VIEWBOX_OVERFLOW", "element overflows the declared viewBox: " + element.id);
      if (!element.role || !ROLES.has(element.role)) fail("INVALID_ROLE", "element has no validated semantic role");
      if (element.role !== "decorative" && element.collision !== true) fail("INVALID_COLLISION", "semantic geometry must remain a collision object");
    }));
    if (manifest.fragmentIds !== undefined && !Array.isArray(manifest.fragmentIds)) fail("INVALID_MANIFEST", "fragmentIds must be an array");
    if (manifest.fragmentIds) {
      manifest.fragmentIds.forEach((fragmentId) => {
        id(fragmentId, "fragment.id");
        if (seen.has(fragmentId)) fail("DUPLICATE_ID", "duplicate fragment ID: " + fragmentId);
        seen.add(fragmentId);
      });
    }
    return true;
  }

  function create(options) {
    const opts = options || {};
    const diagramId = id(opts.id, "diagram.id");
    if (USED_FRAGMENT_IDS.has(diagramId)) fail("DUPLICATE_ID", "duplicate diagram ID: " + diagramId);
    const title = opts.title; const description = opts.description;
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()) fail("MISSING_ACCESSIBILITY", "diagram title and description are required");
    const width = finite(opts.width, "diagram.width"); const height = finite(opts.height, "diagram.height");
    if (!(width > 0) || !(height > 0)) fail("DEGENERATE", "diagram dimensions must be positive");
    const purpose = opts.purpose || "prompt";
    if (purpose !== "prompt" && purpose !== "solution") fail("INVALID_PURPOSE", "diagram purpose must be prompt or solution");
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
        finished = true;
        if (USED_FRAGMENT_IDS.has(diagramId)) fail("DUPLICATE_ID", "duplicate diagram ID: " + diagramId);
        const fragmentIds = [];
        layers.forEach((layer) => layer.elements.forEach((element) => {
          if (element.kind === "arrow") { element._markerId = diagramId + "-marker-arrow"; fragmentIds.push(element._markerId); }
          if (element.kind === "label" && element.background === "opaque") { element._backgroundId = diagramId + "-" + element.id + "-background"; fragmentIds.push(element._backgroundId); }
        }));
        const manifestLayers = layers.map((layer) => ({ name: layer.name, elements: layer.elements.map((element) => {
          const record = { id: element.id, kind: element.kind, role: element.role, bbox: bboxOf(element), collision: element.semantic !== false, strokeWidth: element.strokeWidth || 0 };
          if (element.kind === "line" || element.kind === "arrow") Object.assign(record, { from: clone(element.from || element.a), to: clone(element.to || element.b) });
          if (element.kind === "arrow") Object.assign(record, { arrowhead: { points: element.head.map(clone), headLength: element.headLength, headWidth: element.headWidth } });
          if (element.kind === "circle") Object.assign(record, { center: clone(element.center), radius: element.radius });
          if (element.kind === "body") Object.assign(record, { points: element.corners.map(clone) });
          if (element.kind === "polygon" || element.kind === "polyline") Object.assign(record, { points: element.points.map(clone) });
          if (element.kind === "path" || element.kind === "angleArc" || element.kind === "rope") Object.assign(record, { path: element.d || element.path, segments: element.segments || null });
          if (element.kind === "dimension") Object.assign(record, { anchors: element.anchors.map(clone), extension: element.extension });
          if (element.kind === "label") Object.assign(record, { at: clone(element.at), anchor: element.anchor, text: element.text, avoid: element.avoid.slice(), minClearance: element.minClearance, background: element.background });
          return record;
        }) }));
        const manifest = {
          id: diagramId, title, description, purpose, width, height, viewBox: [0, 0, width, height],
          titleId: diagramId + "-title", descriptionId: diagramId + "-desc", ariaLabelledby: diagramId + "-title " + diagramId + "-desc",
          bounds: { x: 0, y: 0, width, height }, layers: manifestLayers,
          geometry: manifestLayers[0].elements, connections: manifestLayers[1].elements, information: manifestLayers[2].elements, labels: manifestLayers[3].elements,
          elements: manifestLayers.flatMap((layer) => layer.elements.map((element) => Object.assign({ layer: layer.name }, element))),
          strokes: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.strokeWidth > 0).map((element) => ({ id: element.id, layer: layer.name, width: element.strokeWidth }))),
          paths: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.path).map((element) => ({ id: element.id, layer: layer.name, path: element.path }))),
          arrowheads: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.arrowhead).map((element) => Object.assign({ id: element.id, layer: layer.name }, element.arrowhead))),
          backgrounds: manifestLayers[3].elements.filter((element) => element.background === "opaque").map((element) => ({ id: diagramId + "-" + element.id + "-background", labelId: element.id, bbox: element.bbox, role: "decorative" })),
          collisions: manifestLayers.flatMap((layer) => layer.elements.filter((element) => element.collision).map((element) => ({ id: element.id, role: element.role, bbox: element.bbox, layer: layer.name }))),
          fragmentIds: Array.from(new Set(fragmentIds))
        };
        validateManifest(manifest);
        USED_FRAGMENT_IDS.add(diagramId); manifest.fragmentIds.forEach((fragmentId) => USED_FRAGMENT_IDS.add(fragmentId));
        const body = layers.map((layer) => '<g data-layer="' + layer.name + '">' + layer.elements.map(attrsFor).join("") + "</g>").join("");
        const marker = fragmentIds.length ? '<defs><marker id="' + escapeAttr(fragmentIds[0]) + '" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="currentColor"></path></marker></defs>' : "";
        const html = '<svg id="' + escapeAttr(diagramId) + '" viewBox="0 0 ' + number(width) + ' ' + number(height) + '" role="img" aria-labelledby="' + escapeAttr(diagramId + "-title " + diagramId + "-desc") + '"><title id="' + escapeAttr(diagramId + "-title") + '">' + escapeText(title) + '</title><desc id="' + escapeAttr(diagramId + "-desc") + '">' + escapeText(description) + '</desc>' + marker + body + '</svg>';
        return { html, manifest };
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
