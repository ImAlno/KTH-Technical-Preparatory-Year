const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const kit = require("../assets/js/diagram-kit.js");

function close(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
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
  diagram.add("labels", kit.label({ id: "label", at: [60, 70], text: "F < 2", anchor: "middle", avoid: ["pulley"], minClearance: 6, background: true }));
  const result = diagram.finish();
  assert.match(result.html, /<svg[^>]+role="img"/);
  assert.match(result.html, /aria-labelledby="kit-order-title kit-order-desc"/);
  assert.match(result.html, /&lt;Titel&gt;/);
  assert.match(result.html, /F &lt; 2/);
  assert.deepEqual(result.manifest.layers.map((layer) => layer.name), ["geometry", "connections", "information", "labels"]);
  assert.equal(result.manifest.collisions.length, 4);
  assert.equal(result.manifest.labels[0].minClearance, 6);
  assert.match(result.html, /data-label-anchor="middle"/);
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
  const duplicate = kit.create({ id: "kit-duplicate", title: "A", description: "B", width: 20, height: 20 });
  duplicate.add("geometry", kit.line({ id: "same", a: [1, 1], b: [2, 2], role: "line" }));
  assert.throws(() => duplicate.add("geometry", kit.line({ id: "same", a: [1, 2], b: [2, 3], role: "line" })), /duplicate/i);
  const overflow = kit.create({ id: "kit-overflow", title: "A", description: "B", width: 20, height: 20 });
  overflow.add("geometry", kit.line({ id: "too-far", a: [1, 1], b: [21, 1], role: "line" }));
  assert.throws(() => overflow.finish(), /overflow|viewBox/i);
  assert.throws(() => kit.create({ id: "kit-no-a11y", title: "", description: "B", width: 20, height: 20 }), /title|accessible/i);
  assert.throws(() => kit.line({ id: "kit-decorative-line", a: [1, 1], b: [2, 2], role: "decorative" }), /decorative|semantic/i);
  assert.throws(() => kit.circle({ id: "kit-infinite", center: [Infinity, 1], radius: 2, role: "circle" }), /finite/i);
});

test("loads as a browser UMD script and exports the same kit", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../assets/js/diagram-kit.js"), "utf8");
  const context = { window: {}, console };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.KS.diagramKit.create, "function");
  assert.equal(typeof context.window.KS.diagramKit.normalize, "function");
});
