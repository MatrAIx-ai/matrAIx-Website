import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGraphStore } from "../synthesis/graph-store.js";
import { buildOverview } from "../synthesis/graph-views.js";
import { assertDeepClose } from "./helpers.mjs";

const core = JSON.parse(readFileSync(new URL("../synthesis/data/graph-core.v1.json", import.meta.url)));
const golden = JSON.parse(readFileSync(new URL("./fixtures/overview.golden.json", import.meta.url)));

test("buildOverview matches the Python service on the real graph", () => {
  const overview = buildOverview(createGraphStore(core));
  assertDeepClose(overview, golden, { atol: 1e-9 });
});

test("buildOverview keeps distinct category pairs when names contain NUL", () => {
  const collisionCore = {
    nodes: [
      { id: "s1", category: "a" },
      { id: "t1", category: "b\0c" },
      { id: "s2", category: "a\0b" },
      { id: "t2", category: "c" },
    ],
    edges: [
      { source: "s1", target: "t1", weight: 1 },
      { source: "s2", target: "t2", weight: 2 },
    ],
    topologicalOrder: ["s1", "t1", "s2", "t2"],
  };

  assert.deepEqual(buildOverview(createGraphStore(collisionCore)).edges, [
    { source: "a", target: "b\0c", count: 1, weightSum: 1 },
    { source: "a\0b", target: "c", count: 1, weightSum: 2 },
  ]);
});
