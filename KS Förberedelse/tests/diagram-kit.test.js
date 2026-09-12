const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const kit = require("../assets/js/diagram-kit.js");

function close(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function normalizedPoint(point, center, radius) {
  return [(point[0] - center[0]) / radius, (point[1] - center[1]) / radius];
}

function assertPhysicalRope(rope, requestedSide) {
  const center = rope.pulley.center;
  const radius = rope.pulley.radius;
  const from = normalizedPoint(rope.from, center, radius);
  const fromTangent = normalizedPoint(rope.fromTangent, center, radius);
  const toTangent = normalizedPoint(rope.toTangent, center, radius);
  const to = normalizedPoint(rope.to, center, radius);
  const crossThree = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const intersectsInterior = (a, b, c, d) => {
    const scale = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(d[0] - c[0], d[1] - c[1]));
    const epsilon = 1e-10 * scale;
    const ab0 = crossThree(a, b, c); const ab1 = crossThree(a, b, d);
    const cd0 = crossThree(c, d, a); const cd1 = crossThree(c, d, b);
    return ab0 * ab1 < -(epsilon * epsilon) && cd0 * cd1 < -(epsilon * epsilon);
  };
  const segmentDistance = (a, b) => {
    const delta = [b[0] - a[0], b[1] - a[1]];
    const squared = delta[0] * delta[0] + delta[1] * delta[1];
    const t = Math.max(0, Math.min(1, -(a[0] * delta[0] + a[1] * delta[1]) / squared));
    return Math.hypot(a[0] + t * delta[0], a[1] + t * delta[1]);
  };
  const unit = (value) => {
    const magnitude = Math.hypot(value[0], value[1]);
    return [value[0] / magnitude, value[1] / magnitude];
  };
  const dotPair = (a, b) => a[0] * b[0] + a[1] * b[1];

  assert.equal(rope.arc.turns, 0);
  assert.ok(rope.arc.delta > 0 && rope.arc.delta <= 2 * Math.PI + 1e-10);
  assert.equal(intersectsInterior(from, fromTangent, toTangent, to), false);
  assert.ok(segmentDistance(from, fromTangent) >= 1 - 1e-9);
  assert.ok(segmentDistance(toTangent, to) >= 1 - 1e-9);

  const incoming = unit([fromTangent[0] - from[0], fromTangent[1] - from[1]]);
  const outgoing = unit([to[0] - toTangent[0], to[1] - toTangent[1]]);
  const firstArc = unit([rope.arc.sweep * -fromTangent[1], rope.arc.sweep * fromTangent[0]]);
  const lastArc = unit([rope.arc.sweep * -toTangent[1], rope.arc.sweep * toTangent[0]]);
  assert.ok(Math.abs(dotPair(fromTangent, incoming)) <= 1e-8);
  assert.ok(Math.abs(dotPair(toTangent, outgoing)) <= 1e-8);
  assert.ok(dotPair(incoming, firstArc) >= 1 - 1e-8);
  assert.ok(dotPair(lastArc, outgoing) >= 1 - 1e-8);

  const expectedLength = Math.hypot(rope.from[0] - rope.fromTangent[0], rope.from[1] - rope.fromTangent[1]) +
    radius * rope.arc.delta + Math.hypot(rope.to[0] - rope.toTangent[0], rope.to[1] - rope.toTangent[1]);
  assert.ok(Math.abs(rope.length - expectedLength) <= 1e-10 * Math.max(radius, expectedLength));

  if (requestedSide) {
    const side = Array.isArray(requestedSide) ? requestedSide : ({ top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] })[requestedSide];
    const start = Math.atan2(fromTangent[1], fromTangent[0]);
    const target = Math.atan2(side[1], side[0]);
    const normalizeAngle = (angle) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const travel = rope.arc.sweep === 1 ? normalizeAngle(target - start) : normalizeAngle(start - target);
    assert.ok(travel <= rope.arc.delta + 1e-9);
  }
}

test("normalizes finite vectors and rejects zero, non-finite, and malformed vectors", () => {
  assert.deepEqual(kit.normalize([3, 4]), [0.6, 0.8]);
  assert.throws(() => kit.normalize([0, 0]), /zero|degenerate/i);
  assert.throws(() => kit.normalize([1, Infinity]), /finite/i);
  assert.throws(() => kit.normalize([1]), /vector/i);
});

test("computes signed point-to-line distance for horizontal, vertical, and arbitrary lines", () => {
  close(kit.signedPointLineDistance([2, 3], { a: [0, 0], b: [4, 0] }), 3);
  close(kit.signedPointLineDistance([2, 3], { a: [0, 0], b: [0, 4] }), -2);
  close(kit.signedPointLineDistance([2, 0], { a: [0, 0], b: [2, 2] }), -Math.sqrt(2));
  assert.throws(() => kit.signedPointLineDistance([1, 2], { a: [0, 0], b: [0, 0] }), /zero|degenerate/i);
  assert.throws(() => kit.signedPointLineDistance([1, 2], { a: [0, 0], b: [1e-14, 0] }), /zero|degenerate/i);
});

test("places both intended bottom corners on an arbitrary incline", () => {
  const body = kit.bodyOnLine({
    id: "incline-body",
    bottomCenter: [4, 4],
    width: 6,
    height: 2,
    line: { a: [0, 0], b: [8, 8] },
    outwardNormal: [-Math.SQRT1_2, Math.SQRT1_2]
  });
  assert.equal(body.bottomLeft.length, 2);
  close(kit.signedPointLineDistance(body.bottomLeft, body.line), 0, 1e-9);
  close(kit.signedPointLineDistance(body.bottomRight, body.line), 0, 1e-9);
  close(Math.hypot(body.topRight[0] - body.bottomRight[0], body.topRight[1] - body.bottomRight[1]), 2);
  assert.throws(() => kit.bodyOnLine({ bottomCenter: [0, 0], width: 1, height: 1, line: { a: [0, 0], b: [0, 0] } }), /zero|degenerate/i);
});

test("solves actual external-point/circle tangents and continuous rope endpoints", () => {
  const tangents = kit.tangentPointsFromExternalPoint([0, 5], { center: [0, 0], radius: 2 });
  assert.equal(tangents.length, 2);
  tangents.forEach((point) => {
    close(Math.hypot(point[0], point[1]), 2, 1e-9);
    close(point[0] * (point[0] - 0) + point[1] * (point[1] - 5), 0, 1e-9);
  });
  const rope = kit.ropeAroundCircle({
    id: "rope",
    from: [-8, 0],
    pulley: { center: [0, 0], radius: 2 },
    to: [8, 0],
    side: "top"
  });
  close(Math.hypot(rope.fromTangent[0], rope.fromTangent[1]), 2, 1e-9);
  close(Math.hypot(rope.toTangent[0], rope.toTangent[1]), 2, 1e-9);
  close(rope.fromTangent[0] * (rope.from[0] - rope.fromTangent[0]) + rope.fromTangent[1] * (rope.from[1] - rope.fromTangent[1]), 0, 1e-9);
  close(rope.toTangent[0] * (rope.to[0] - rope.toTangent[0]) + rope.toTangent[1] * (rope.to[1] - rope.toTangent[1]), 0, 1e-9);
  assert.deepEqual(rope.segments[0].to, rope.segments[1].from);
  assert.deepEqual(rope.segments[1].to, rope.segments[2].from);
  assert.throws(() => kit.tangentPointsFromExternalPoint([1, 0], { center: [0, 0], radius: 2 }), /inside|external|tangent/i);
});

test("creates angle arcs, dimensions, arrows, and graph transforms with finite anchors", () => {
  const arc = kit.angleArc({ vertex: [0, 0], fromRay: [1, 0], toRay: [0, 1], radius: 2 });
  close(Math.hypot(...arc.start), 2);
  close(Math.hypot(...arc.end), 2);
  assert.equal(arc.degrees, 90);
  const dim = kit.dimension({ a: [0, 0], b: [4, 0], offset: 2 });
  assert.deepEqual(dim.start, [0, 2]);
  assert.deepEqual(dim.end, [4, 2]);
  const spacedDim = kit.dimension({ a: [0, 0], b: [4, 0], offset: 10, extensionGap: 5 });
  assert.deepEqual(spacedDim.extension, [
    { from: [0, 5], to: [0, 10] },
    { from: [4, 5], to: [4, 10] }
  ]);
  assert.equal(spacedDim.extensionGap, 5);
  const arrow = kit.arrow({ from: [1, 2], to: [5, 2] });
  assert.deepEqual(arrow.from, [1, 2]);
  assert.deepEqual(arrow.to, [5, 2]);
  const graph = kit.graphTransform({ xDomain: [0, 10], yDomain: [0, 20], plot: { x: 10, y: 20, width: 100, height: 200 } });
  assert.deepEqual(graph.toScreen([0, 0]), [10, 220]);
  assert.deepEqual(graph.toScreen([10, 20]), [110, 20]);
  assert.deepEqual(graph.fromScreen([60, 120]), [5, 10]);
  assert.throws(() => kit.angleArc({ vertex: [0, 0], fromRay: [1, 0], toRay: [2, 0], radius: 2 }), /parallel|degenerate/i);
});

test("serializes ordered semantic layers, labels, collision metadata, and accessible root", () => {
  const diagram = kit.create({ id: "kit-order", title: "<Titel>", description: "Beskrivning & kontroll", width: 120, height: 80, purpose: "prompt" });
  diagram.add("geometry", kit.line({ id: "base", a: [5, 10], b: [115, 10], role: "support" }));
  diagram.add("connections", kit.circle({ id: "pulley", center: [60, 40], radius: 12, role: "pulley" }));
  diagram.add("information", kit.arrow({ id: "force", from: [60, 40], to: [60, 20], role: "force" }));
  diagram.add("labels", kit.label({ id: "label", at: [60, 70], text: "F < 2", anchorId: "pulley", textAnchor: "middle", avoid: ["pulley"], minClearance: 6, background: true }));
  const result = diagram.finish();
  assert.match(result.html, /<svg[^>]+role="img"/);
  assert.match(result.html, /aria-labelledby="kit-order-title kit-order-desc"/);
  assert.match(result.html, /&lt;Titel&gt;/);
  assert.match(result.html, /F &lt; 2/);
  assert.deepEqual(result.manifest.layers.map((layer) => layer.name), ["geometry", "connections", "information", "labels"]);
  assert.equal(result.manifest.collisions.length, 5);
  assert.equal(result.manifest.labels[0].minClearance, 6);
  assert.match(result.html, /data-label-anchor="pulley"/);
  assert.match(result.html, /text-anchor="middle"/);
  assert.match(result.html, /data-label-background="opaque"/);
});

test("serializes geometry objects returned by the higher-level primitives", () => {
  const diagram = kit.create({ id: "kit-primitives", title: "Primitiver", description: "Geometri", width: 200, height: 160, purpose: "solution" });
  diagram.add("geometry", kit.bodyOnLine({ id: "body", bottomCenter: [70, 80], width: 30, height: 20, line: { a: [10, 80], b: [190, 80] } }));
  diagram.add("connections", kit.ropeAroundCircle({ id: "rope-shape", from: [20, 40], pulley: { center: [100, 40], radius: 10 }, to: [180, 40], side: "top" }));
  diagram.add("information", kit.angleArc({ id: "arc", vertex: [100, 120], fromRay: [1, 0], toRay: [0, -1], radius: 15 }));
  diagram.add("information", kit.dimension({ id: "dimension", a: [20, 140], b: [180, 140], offset: -8 }));
  const result = diagram.finish();
  assert.match(result.html, /data-geometry-id="body"/);
  assert.match(result.html, /data-geometry-id="rope-shape"/);
  assert.equal(result.manifest.collisions.length, 4);
});

test("rejects duplicate IDs, overflow, missing accessibility, unsafe decorations, and non-finite attributes", () => {
  const duplicate = kit.create({ id: "kit-duplicate", title: "A", description: "B", width: 20, height: 20, purpose: "prompt" });
  duplicate.add("geometry", kit.line({ id: "same", a: [1, 1], b: [2, 2], role: "line" }));
  assert.throws(() => duplicate.add("geometry", kit.line({ id: "same", a: [1, 2], b: [2, 3], role: "line" })), /duplicate/i);
  const overflow = kit.create({ id: "kit-overflow", title: "A", description: "B", width: 20, height: 20, purpose: "prompt" });
  overflow.add("geometry", kit.line({ id: "too-far", a: [1, 1], b: [21, 1], role: "line" }));
  assert.throws(() => overflow.finish(), /overflow|viewBox/i);
  assert.throws(() => kit.create({ id: "kit-no-a11y", title: "", description: "B", width: 20, height: 20, purpose: "prompt" }), /title|accessible/i);
  assert.throws(() => kit.line({ id: "kit-decorative-line", a: [1, 1], b: [2, 2], role: "decorative" }), /decorative|semantic/i);
  assert.throws(() => kit.circle({ id: "kit-infinite", center: [Infinity, 1], radius: 2, role: "circle" }), /finite/i);
  assert.throws(() => kit.path({ id: "kit-path-nan", d: "M 0 0 L NaN 1", role: "line" }), /finite|path/i);
});

test("loads as a browser UMD script and exports the same kit", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../assets/js/diagram-kit.js"), "utf8");
  const context = { window: {}, console };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.KS.diagram.create, "function");
  assert.equal(typeof context.window.KS.diagram.normalize, "function");
});

test("couples rope tangent pair and arc so both contacts are C1 and side-specific", () => {
  for (const side of ["top", "bottom"]) {
    let rope;
    try { rope = kit.ropeAroundCircle({ id: "rope-asymmetric-" + side, from: [0, -10], pulley: { center: [0, 0], radius: 2 }, to: [8, 0], side }); } catch (error) {
      if (side === "top" && error.code === "NO_SIDE") continue;
      throw error;
    }
    for (const point of [rope.fromTangent, rope.toTangent]) close(Math.hypot(point[0], point[1]), 2, 1e-9);
    const firstIncoming = kit.normalize([rope.fromTangent[0] - rope.from[0], rope.fromTangent[1] - rope.from[1]]);
    const firstArc = kit.normalize([rope.arc.sweep * -(rope.fromTangent[1]), rope.arc.sweep * rope.fromTangent[0]]);
    const lastArc = kit.normalize([rope.arc.sweep * -(rope.toTangent[1]), rope.arc.sweep * rope.toTangent[0]]);
    const lastOutgoing = kit.normalize([rope.to[0] - rope.toTangent[0], rope.to[1] - rope.toTangent[1]]);
    close(kit.dot(firstIncoming, firstArc), 1, 1e-7);
    close(kit.dot(lastArc, lastOutgoing), 1, 1e-7);
    assert.deepEqual(rope.segments[0].to, rope.segments[1].from);
    assert.deepEqual(rope.segments[1].to, rope.segments[2].from);
  }
  assert.throws(() => kit.ropeAroundCircle({ id: "rope-inside", from: [0, 1], pulley: { center: [0, 0], radius: 2 }, to: [8, 0], side: "top" }), /external|tangent|inside/i);
  assert.throws(() => kit.ropeAroundCircle({ id: "rope-side", from: [0, -10], pulley: { center: [0, 0], radius: 2 }, to: [8, 0], side: "diagonal" }), /side/i);
});

test("vector rope sides select sampled arc on the requested side", () => {
  let top;
  try { top = kit.ropeAroundCircle({ id: "rope-vector-top", from: [0, -10], pulley: { center: [0, 0], radius: 2 }, to: [8, 0], side: [0, -1] }); } catch (error) {
    assert.equal(error.code, "NO_SIDE");
    top = null;
  }
  const bottom = kit.ropeAroundCircle({ id: "rope-vector-bottom", from: [0, -10], pulley: { center: [0, 0], radius: 2 }, to: [8, 0], side: [0, 1] });
  const contains = (rope, side) => {
    const start = Math.atan2(rope.fromTangent[1], rope.fromTangent[0]);
    const target = Math.atan2(side[1], side[0]);
    const travel = rope.arc.sweep === 1 ? ((target - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) : ((start - target) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return travel <= rope.arc.delta + 1e-9;
  };
  if (!top) return;
  assert.notDeepEqual(top.tangentPoints, bottom.tangentPoints);
  assert.equal(top.arc.turns, 0);
  assert.equal(bottom.arc.turns, 0);
  assert.ok(top.arc.delta <= 2 * Math.PI + 1e-9);
  assert.ok(bottom.arc.delta <= 2 * Math.PI + 1e-9);
  assert.ok(contains(top, [0, -1]));
  assert.ok(contains(bottom, [0, 1]));
  for (const rope of [top, bottom]) {
    const expectedLength = Math.hypot(rope.from[0] - rope.fromTangent[0], rope.from[1] - rope.fromTangent[1]) + Math.hypot(rope.to[0] - rope.toTangent[0], rope.to[1] - rope.toTangent[1]) + rope.pulley.radius * rope.arc.delta;
    assert.ok(Math.abs(rope.length - expectedLength) < 1e-9);
  }
});

test("requires branded semantic primitives and rejects raw collision bypasses", () => {
  const diagram = kit.create({ id: "kit-brand", title: "Brand", description: "Brand", width: 40, height: 40, purpose: "prompt" });
  assert.throws(() => diagram.add("geometry", { kind: "line", id: "raw", a: [1, 1], b: [2, 2], role: "decorative", semantic: false }), /primitive|brand|element/i);
  const mutated = kit.line({ id: "mutated-line", a: [1, 1], b: [2, 2], role: "line" });
  mutated.role = "decorative"; mutated.semantic = false;
  assert.throws(() => diagram.add("geometry", mutated), /decorative|primitive|brand|semantic/i);
  assert.throws(() => diagram.add("geometry", kit.line({ id: "negative-stroke", a: [1, 1], b: [2, 2], role: "line", strokeWidth: -1 })), /stroke|negative/i);
});

test("requires explicit purpose and globally reserves every emitted fragment id", () => {
  assert.throws(() => kit.create({ id: "kit-purpose-missing", title: "A", description: "B", width: 10, height: 10 }), /purpose/i);
  const first = kit.create({ id: "kit-global-foo", title: "A", description: "B", width: 20, height: 20, purpose: "prompt" });
  first.finish();
  assert.throws(() => kit.create({ id: "kit-global-foo-title", title: "A", description: "B", width: 20, height: 20, purpose: "prompt" }).finish(), /duplicate/i);
  const labelDiagram = kit.create({ id: "kit-global-label", title: "A", description: "B", width: 80, height: 80, purpose: "prompt" });
  labelDiagram.add("geometry", kit.line({ id: "owner-label", a: [10, 20], b: [70, 20], role: "line" }));
  labelDiagram.add("labels", kit.label({ id: "opaque", at: [40, 60], text: "X", anchorId: "owner-label", background: true }));
  const output = labelDiagram.finish();
  assert.match(output.html, /kit-global-label-opaque-background/);
  assert.doesNotMatch(output.html, /marker-end/);
});

test("validateManifest independently rejects tampering, unrelated IDs, and out-of-view painted extents", () => {
  const diagram = kit.create({ id: "kit-tamper", title: "A", description: "B", width: 80, height: 80, purpose: "solution" });
  diagram.add("geometry", kit.line({ id: "tamper-line", a: [10, 10], b: [70, 10], role: "line", strokeWidth: 2 }));
  const result = diagram.finish();
  const tampered = JSON.parse(JSON.stringify(result.manifest));
  tampered.ariaLabelledby = "other-title other-desc";
  assert.throws(() => kit.validateManifest(tampered), /aria|access/i);
  const tamperedExtent = JSON.parse(JSON.stringify(result.manifest));
  tamperedExtent.elements[0].bbox.width = -1;
  assert.throws(() => kit.validateManifest(tamperedExtent), /bbox|negative|finite|canonical/i);
  const unrelated = JSON.parse(JSON.stringify(result.manifest));
  unrelated.paths.push({ id: "unrelated" });
  assert.throws(() => kit.validateManifest(unrelated), /path|reconcil|ID/i);
});

test("vector outputs reject MAX_VALUE overflow and degenerate polygons", () => {
  assert.throws(() => kit.add([Number.MAX_VALUE, 0], [Number.MAX_VALUE, 0]), /finite|overflow/i);
  assert.throws(() => kit.scale([Number.MAX_VALUE, 1], 2), /finite|overflow/i);
  assert.throws(() => kit.line({ id: "zero-line", a: [1, 1], b: [1, 1], role: "line" }), /zero|degenerate/i);
  assert.throws(() => kit.polygon({ id: "flat-polygon", points: [[0, 0], [1, 1], [2, 2]], role: "shape" }), /zero|degenerate/i);
  assert.throws(() => kit.polyline({ id: "zero-polyline", points: [[0, 0], [0, 0]], role: "line" }), /zero|degenerate/i);
  assert.throws(() => kit.graphTransform({ xDomain: [0, 1e-14], yDomain: [0, 1], plot: { x: 0, y: 0, width: 100, height: 100 } }), /zero|degenerate/i);
});

test("uses distinct arrow markers with exact custom head geometry and reconciled paint", () => {
  const diagram = kit.create({ id: "kit-arrows", title: "Arrows", description: "Two arrows", width: 100, height: 100, purpose: "prompt" });
  diagram.add("information", kit.arrow({ id: "arrow-a", from: [20, 50], to: [80, 50], headLength: 10, headWidth: 8 }));
  diagram.add("information", kit.arrow({ id: "arrow-b", from: [50, 20], to: [50, 80], headLength: 4, headWidth: 3 }));
  const output = diagram.finish();
  assert.equal(new Set(output.manifest.arrowheads.map((item) => item.markerId)).size, 2);
  assert.match(output.html, /markerUnits="userSpaceOnUse"/g);
  assert.equal(output.manifest.arrowheads.length, 2);
  assert.throws(() => { const far = kit.create({ id: "kit-arrow-overflow", title: "A", description: "B", width: 20, height: 20, purpose: "prompt" }); far.add("information", kit.arrow({ id: "far-arrow", from: [5, 5], to: [21, 5], headLength: 8, headWidth: 8 })); far.finish(); }, /viewBox|overflow/i);
});

test("emits an exact DOM ID set and rejects path/rectangle overflow before reservation", () => {
  const diagram = kit.create({ id: "kit-dom-id-set", title: "A", description: "B", width: 100, height: 100, purpose: "prompt" });
  diagram.add("geometry", kit.rect({ id: "rounded", x: 10, y: 10, width: 20, height: 20, rx: 4 }));
  diagram.add("information", kit.arrow({ id: "id-arrow", from: [20, 50], to: [80, 50] }));
  const result = diagram.finish();
  const parsed = [...result.html.matchAll(/\sid="([A-Za-z_][A-Za-z0-9_.:-]*)"/g)].map((match) => match[1]);
  assert.deepEqual(new Set(parsed), new Set(result.manifest.domIds));
  assert.throws(() => kit.path({ id: "path-overflow", d: "M 1e308 0 L -1e308 0", strokeWidth: 1 }), /finite|overflow/i);
  assert.throws(() => kit.rect({ id: "zero-rect", x: 0, y: 0, width: 1e-14, height: 1, rx: Infinity }), /finite|degenerate|rectangle/i);
});

test("finishes a finite raw M/L/H/V/Z path and rejects command-letter tampering", () => {
  const diagram = kit.create({ id: "kit-raw-path", title: "A", description: "B", width: 20, height: 20, purpose: "prompt" });
  diagram.add("geometry", kit.path({ id: "raw-path", d: "M 2 2 L 8 2 H 12 V 8 L 2 8 Z", role: "line", strokeWidth: 1 }));
  const output = diagram.finish();
  assert.equal(output.manifest.paths[0].path, "M 2 2 L 8 2 H 12 V 8 L 2 8 Z");
  const tampered = JSON.parse(JSON.stringify(output.manifest));
  const replaceCommands = (value) => typeof value === "string" ? value.replace(/L/gu, "M") : value;
  tampered.layers[0].elements[0].path = replaceCommands(tampered.layers[0].elements[0].path);
  tampered.geometry[0].path = replaceCommands(tampered.geometry[0].path);
  tampered.elements[0].path = replaceCommands(tampered.elements[0].path);
  tampered.paths[0].path = replaceCommands(tampered.paths[0].path);
  assert.throws(() => kit.validateManifest(tampered), /path|command|canonical|tamper/i);
});

test("omitted rope side stays omitted and successful ropes are physically non-crossing", () => {
  const omitted = kit.ropeAroundCircle({ id: "rope-omitted-side", from: [0, -10], pulley: { center: [0, 0], radius: 2 }, to: [8, 0] });
  assert.equal(omitted.side, null);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const intersectsInterior = (a, b, c, d) => {
    const ab = cross(a, b, c); const ab2 = cross(a, b, d); const cd = cross(c, d, a); const cd2 = cross(c, d, b);
    return ab * ab2 < -1e-10 && cd * cd2 < -1e-10;
  };
  let seed = 0x5eed;
  for (let i = 0; i < 250; i += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0; const a = seed / 0xffffffff * Math.PI * 2;
    seed = (1664525 * seed + 1013904223) >>> 0; const b = seed / 0xffffffff * Math.PI * 2;
    const from = [8 * Math.cos(a), 8 * Math.sin(a)]; const to = [8 * Math.cos(b), 8 * Math.sin(b)];
    if (Math.hypot(from[0] - to[0], from[1] - to[1]) < 1e-6) continue;
    let rope;
    try { rope = kit.ropeAroundCircle({ id: "rope-fuzz-" + i, from, pulley: { center: [0, 0], radius: 2 }, to }); } catch (error) { continue; }
    assert.equal(rope.arc.turns, 0);
    assert.ok(!intersectsInterior(rope.from, rope.fromTangent, rope.toTangent, rope.to));
  }
});

test("finished manifests are provenance-bound and deeply frozen", () => {
  const diagram = kit.create({ id: "kit-provenance", title: "A", description: "B", width: 30, height: 30, purpose: "prompt" });
  diagram.add("geometry", kit.line({ id: "prov-line", a: [2, 2], b: [20, 2] }));
  const output = diagram.finish();
  assert.doesNotThrow(() => kit.validateManifest(output.manifest));
  assert.throws(() => kit.validateManifest(JSON.parse(JSON.stringify(output.manifest))), /provenance|origin|manifest/i);
  assert.throws(() => { output.manifest.width = 999; }, /read only|frozen|strict/i);
  assert.equal(output.manifest.width, 30);
});

test("no public validateManifest argument bypasses closure-private provenance", () => {
  const diagram = kit.create({ id: "kit-unforgeable-provenance", title: "A", description: "B", width: 30, height: 30, purpose: "prompt" });
  diagram.add("geometry", kit.line({ id: "unforgeable-line", a: [2, 2], b: [20, 2] }));
  const output = diagram.finish();
  assert.doesNotThrow(() => kit.validateManifest(output.manifest));
  for (const publicArgument of [true, 1, {}, Symbol("internal")]) {
    const clone = JSON.parse(JSON.stringify(output.manifest));
    assert.throws(() => kit.validateManifest(clone, publicArgument), /provenance|origin|manifest/i);
    clone.width = 29;
    assert.throws(() => kit.validateManifest(clone, publicArgument), /provenance|origin|manifest/i);
  }
});

test("scaled asymmetric ropes never leak INVARIANT and deterministic multi-scale fuzz stays physical", () => {
  const asymmetricScale = 1e-6;
  for (const side of [undefined, "top", "bottom", [0, -1], [0, 1]]) {
    const options = { id: "rope-asymmetric-scaled", from: [0, -10 * asymmetricScale], pulley: { center: [0, 0], radius: 2 * asymmetricScale }, to: [8 * asymmetricScale, 0] };
    if (side !== undefined) options.side = side;
    try {
      assertPhysicalRope(kit.ropeAroundCircle(options), side);
    } catch (error) {
      assert.equal(error.code, "NO_SIDE", `scaled asymmetric side ${JSON.stringify(side)} leaked ${error.code}`);
    }
  }

  let seed = 0x8badf00d;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const samples = Array.from({ length: 80 }, () => ({
    fromAngle: random() * 2 * Math.PI,
    toAngle: random() * 2 * Math.PI,
    fromRadius: 3 + random() * 12,
    toRadius: 3 + random() * 12
  }));
  const modes = [
    { name: "omitted", minimum: 75 },
    { name: "named-top", side: "top", minimum: 20 },
    { name: "named-bottom", side: "bottom", minimum: 20 },
    { name: "vector-right", side: [1, 0], minimum: 18 },
    { name: "vector-bottom", side: [0, 1], minimum: 20 }
  ];
  for (const scale of [1e-6, 1, 1e6]) {
    for (const mode of modes) {
      let successes = 0;
      samples.forEach((sample, index) => {
        const options = {
          id: `rope-multiscale-${mode.name}-${scale}-${index}`,
          from: [scale * sample.fromRadius * Math.cos(sample.fromAngle), scale * sample.fromRadius * Math.sin(sample.fromAngle)],
          pulley: { center: [0, 0], radius: 2 * scale },
          to: [scale * sample.toRadius * Math.cos(sample.toAngle), scale * sample.toRadius * Math.sin(sample.toAngle)]
        };
        if (mode.side !== undefined) options.side = mode.side;
        try {
          const rope = kit.ropeAroundCircle(options);
          assertPhysicalRope(rope, mode.side);
          successes += 1;
        } catch (error) {
          assert.equal(error.code, "NO_SIDE", `${mode.name} at scale ${scale} leaked ${error.code}`);
        }
      });
      assert.ok(successes >= mode.minimum, `${mode.name} at scale ${scale}: ${successes} successes, expected at least ${mode.minimum}`);
    }
  }
});

test("path and dimension paint records include exact stroke extents and one dimension path", () => {
  const pathDiagram = kit.create({ id: "kit-path-boundary", title: "A", description: "B", width: 10, height: 10, purpose: "prompt" });
  pathDiagram.add("geometry", kit.path({ id: "boundary", d: "M .5 2 L 8 2", role: "line", strokeWidth: 2 }));
  assert.throws(() => pathDiagram.finish(), /overflow|viewBox|non-negative/i);
  const dimensionDiagram = kit.create({ id: "kit-dimension-path", title: "A", description: "B", width: 100, height: 100, purpose: "prompt" });
  dimensionDiagram.add("information", kit.dimension({ id: "dim", a: [20, 20], b: [80, 20], offset: 10 }));
  const output = dimensionDiagram.finish();
  assert.match(output.html, /<path[^>]+data-geometry-id="dim"/);
  assert.equal(output.manifest.paths.filter((item) => item.id === "dim").length, 1);
});

test("deep manifest reconciliation rejects safe tampering and invalid semantic label references", () => {
  const diagram = kit.create({ id: "kit-deep-manifest", title: "A", description: "B", width: 100, height: 100, purpose: "prompt" });
  diagram.add("geometry", kit.line({ id: "owner", a: [10, 10], b: [90, 10], role: "line" }));
  diagram.add("labels", kit.label({ id: "valid-label", at: [50, 50], text: "L", anchorId: "owner", avoid: ["owner"] }));
  const output = diagram.finish();
  for (const mutate of [
    (m) => { m.elements[0].bbox.width += 1; },
    (m) => { m.collisions[0].bbox.width += 1; },
    (m) => { m.strokes[0].width = 999; },
    (m) => { m.paths.push({ id: "owner", path: "M 0 0 L 1 1" }); },
    (m) => { m.geometry = []; }
  ]) {
    const tampered = JSON.parse(JSON.stringify(output.manifest)); mutate(tampered);
    assert.throws(() => kit.validateManifest(tampered), /reconcil|canonical|bbox|stroke|path|layer|alias|paint|tamper/i);
  }
  const self = kit.create({ id: "kit-label-self", title: "A", description: "B", width: 40, height: 40, purpose: "prompt" });
  self.add("labels", kit.label({ id: "self", at: [10, 20], text: "X", anchorId: "self" }));
  assert.throws(() => self.finish(), /anchor|semantic/i);
  const invalidAvoid = kit.create({ id: "kit-label-avoid", title: "A", description: "B", width: 40, height: 40, purpose: "prompt" });
  invalidAvoid.add("geometry", kit.line({ id: "avoid-owner", a: [2, 2], b: [30, 2], role: "line" }));
  invalidAvoid.add("labels", kit.label({ id: "label-avoid-test", at: [10, 20], text: "X", anchorId: "avoid-owner", avoid: ["label-avoid-test"] }));
  assert.throws(() => invalidAvoid.finish(), /anchor|avoid|semantic/i);
});

test("failed finishes do not reserve IDs and explicit nonsemantic rectangles remain auditable", () => {
  const failed = kit.create({ id: "kit-retry", title: "A", description: "B", width: 10, height: 10, purpose: "prompt" });
  failed.add("geometry", kit.line({ id: "retry-line", a: [1, 1], b: [11, 1], role: "line" }));
  assert.throws(() => failed.finish(), /overflow/i);
  const retry = kit.create({ id: "kit-retry", title: "A", description: "B", width: 10, height: 10, purpose: "prompt" });
  retry.add("geometry", kit.rect({ id: "paper", x: 1, y: 1, width: 2, height: 2, role: "decorative", decorative: true }));
  const output = retry.finish();
  assert.equal(output.manifest.elements[0].collision, false);
  assert.equal(output.manifest.collisions.length, 0);
});
