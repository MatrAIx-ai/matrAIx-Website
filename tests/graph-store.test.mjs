import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGraphCore } from "../scripts/build-synthesis-data.mjs";
import { createGraphStore } from "../synthesis/graph-store.js";

const core = buildGraphCore(
  JSON.parse(readFileSync(new URL("./fixtures/mini_dag.json", import.meta.url))),
  "sha256:" + "a".repeat(64));

test("store indexes nodes and adjacency", () => {
  const store = createGraphStore(core);
  assert.equal(store.nodesById.size, 6);
  assert.equal(store.edgeCount, 4);
  assert.deepEqual(store.outEdges.get("a").map((e) => e.target), ["h", "c"]);
  assert.deepEqual(store.inEdges.get("c").map((e) => e.source), ["a", "b"]);
  assert.deepEqual(store.inEdges.get("a"), []);
  assert.equal(store.topo("a"), 0);
  assert.equal(store.topo("d"), 5);
  assert.equal(store.topo("nope"), 6);
});

test("store drops edges with unknown endpoints", () => {
  const dirty = structuredClone(core);
  dirty.edges.push({ source: "a", target: "ghost", weight: 1, relation: "" });
  const store = createGraphStore(dirty);
  assert.equal(store.edgeCount, 4);
});
