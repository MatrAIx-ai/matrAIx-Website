import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGraphStore } from "../synthesis/graph-store.js";
import { subgraph, nodeDetail, UnknownNodeError } from "../synthesis/graph-views.js";
import { assertDeepClose } from "./helpers.mjs";

const core = JSON.parse(readFileSync(new URL("../synthesis/data/graph-core.v1.json", import.meta.url)));
const store = createGraphStore(core);
const subGolden = JSON.parse(readFileSync(new URL("./fixtures/subgraphs.golden.json", import.meta.url)));
const detailGolden = JSON.parse(readFileSync(new URL("./fixtures/node-details.golden.json", import.meta.url)));

test("subgraph matches Python service for all probes", () => {
  for (const { nodeId, up, down, result } of subGolden) {
    assertDeepClose(subgraph(store, nodeId, { up, down }), result, { atol: 1e-9 });
  }
});

test("nodeDetail matches Python service for all probes", () => {
  for (const { nodeId, result } of detailGolden) {
    assertDeepClose(nodeDetail(store, nodeId), result, { atol: 1e-9 });
  }
});

test("unknown node throws UnknownNodeError", () => {
  assert.throws(() => subgraph(store, "nope"), UnknownNodeError);
  assert.throws(() => nodeDetail(store, "nope"), UnknownNodeError);
});

test("subgraph rejects a cycle in the induced graph", () => {
  const cycleStore = createGraphStore({
    nodes: [{ id: "center" }, { id: "neighbor" }],
    edges: [
      { source: "center", target: "neighbor" },
      { source: "neighbor", target: "center" },
    ],
    topologicalOrder: ["center", "neighbor"],
  });

  assert.throws(
    () => subgraph(cycleStore, "center", { up: 1, down: 1 }),
    /induced subgraph around center contains a cycle/,
  );
});

test("subgraph caps upstream and downstream walks independently at 60 nodes", () => {
  for (const extra of [0, 1]) {
    const count = 60 + extra;
    const upstream = Array.from({ length: count }, (_, i) => `up-${i}`);
    const downstream = Array.from({ length: count }, (_, i) => `down-${i}`);
    const fanStore = createGraphStore({
      nodes: [
        ...upstream.map((id) => ({ id })),
        { id: "center" },
        ...downstream.map((id) => ({ id })),
      ],
      edges: [
        ...upstream.map((source) => ({ source, target: "center" })),
        ...downstream.map((target) => ({ source: "center", target })),
      ],
      topologicalOrder: [...upstream, "center", ...downstream],
    });

    const result = subgraph(fanStore, "center", { up: 1, down: 1 });
    assert.equal(result.truncated, extra === 1);
    assert.equal(result.nodes.filter(({ id }) => id.startsWith("up-")).length, 60);
    assert.equal(result.nodes.filter(({ id }) => id.startsWith("down-")).length, 60);
  }
});

test("nodeDetail keeps equal-weight edge order before applying the 20-edge cap", () => {
  const sourceOrder = Array.from({ length: 22 }, (_, i) => `source-${21 - i}`);
  const detailStore = createGraphStore({
    nodes: [{ id: "center" }, ...sourceOrder.map((id) => ({ id }))],
    edges: sourceOrder.map((source) => ({ source, target: "center", weight: 0.5 })),
    topologicalOrder: [...sourceOrder, "center"],
  });

  const detail = nodeDetail(detailStore, "center");
  assert.equal(detail.inDegree, 22);
  assert.deepEqual(detail.inEdges.map(({ id }) => id), sourceOrder.slice(0, 20));
});

test("subgraph retains parallel edges without double-counting layer indegree", () => {
  const parallelStore = createGraphStore({
    nodes: [{ id: "source" }, { id: "center" }, { id: "target" }],
    edges: [
      { source: "source", target: "center", relation: "first" },
      { source: "source", target: "center", relation: "second" },
      { source: "center", target: "target", relation: "third" },
    ],
    topologicalOrder: ["source", "center", "target"],
  });

  const result = subgraph(parallelStore, "center", { up: 1, down: 1 });
  assert.deepEqual(
    result.edges.filter(({ source, target }) => source === "source" && target === "center")
      .map(({ relation }) => relation),
    ["first", "second"],
  );
});
