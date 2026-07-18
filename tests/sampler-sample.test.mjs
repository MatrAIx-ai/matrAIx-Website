import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_SAFE_SEED,
  SynthesisValidationError,
  compileSampler,
  computeMarginals,
  decodeRow,
  sample,
} from "../synthesis/sampler.js";
import { createRng } from "../synthesis/rng.js";
import { cmpStr } from "../synthesis/dist-utils.js";
import { buildGraphCore, buildSamplerPack } from "../scripts/build-synthesis-data.mjs";

const core = JSON.parse(readFileSync(
  new URL("../synthesis/data/graph-core.v1.json", import.meta.url),
));
const pack = JSON.parse(readFileSync(
  new URL("../synthesis/data/sampler-pack.v2.json", import.meta.url),
));
const golden = JSON.parse(readFileSync(
  new URL("./fixtures/sampler-marginals.golden.json", import.meta.url),
));

const getError = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("did not throw");
};

const emptyPack = (datasetId) => ({
  formatVersion: 1,
  datasetId,
  edges: [],
  cpts: [],
  masks: [],
});

test("same seed reproduces personas exactly; different seed differs", () => {
  const sampler = compileSampler({ core, pack });
  const a = sample(sampler, 10, { seed: 42 });
  const b = sample(sampler, 10, { seed: 42 });
  const c = sample(sampler, 10, { seed: 43 });
  assert.deepEqual(decodeRow(sampler, a.idx, 3), decodeRow(sampler, b.idx, 3));
  assert.notDeepEqual(
    Array.from({ length: 10 }, (_, i) => decodeRow(sampler, a.idx, i)),
    Array.from({ length: 10 }, (_, i) => decodeRow(sampler, c.idx, i)),
  );
});

test("pins clamp exactly and report helper pins", () => {
  const sampler = compileSampler({ core, pack });
  const scenario = golden.scenarios.find((candidate) => candidate.name === "pins");
  const { idx, helperPins } = sample(sampler, 50, { seed: 1, pins: scenario.pins });
  for (const [nid, valueName] of Object.entries(scenario.pins)) {
    const vi = sampler.vtoi.get(nid).get(valueName);
    assert.ok([...idx.get(nid)].every((value) => value === vi), `pin not clamped: ${nid}`);
  }
  assert.ok(Array.isArray(helperPins));
});

test("helper pins are clamped and returned in Python cmpStr order", () => {
  const sampler = compileSampler({ core, pack });
  const helpers = core.nodes
    .filter((node) => node.emit === false)
    .map((node) => node.id)
    .sort(cmpStr)
    .slice(0, 2);
  assert.equal(helpers.length, 2, "fixture must expose at least two helper nodes");
  const pins = Object.fromEntries(
    [...helpers].reverse().map((nid) => [nid, sampler.values.get(nid)[0]]),
  );
  const { idx, helperPins } = sample(sampler, 5, { seed: 7, pins });
  assert.deepEqual(helperPins, helpers);
  for (const nid of helpers) assert.ok([...idx.get(nid)].every((value) => value === 0));
});

test("marginals statistically match dynamic Python probes via 25 public-size batches", () => {
  for (const scenario of golden.scenarios) {
    const sampler = compileSampler({
      core,
      pack,
      gammaScale: scenario.gammaScale,
      overrides: scenario.overrides,
    });
    const countsByNode = Object.fromEntries(Object.entries(scenario.marginals)
      .map(([nid, fixture]) => [nid, new Array(fixture.values.length).fill(0)]));
    for (const seed of golden.seeds) {
      const { idx } = sample(sampler, golden.batchSize, { seed, pins: scenario.pins });
      for (const [nid, counts] of Object.entries(countsByNode)) {
        for (const valueIndex of idx.get(nid)) counts[valueIndex] += 1;
      }
    }
    for (const [nid, fixture] of Object.entries(scenario.marginals)) {
      const counts = countsByNode[nid];
      fixture.freqs.forEach((frequency, index) => {
        const variance = Math.max(frequency * (1 - frequency), 1 / golden.n);
        const tolerance = Math.max(
          0.012,
          5 * Math.sqrt(2 * variance / golden.n) + 2 / golden.n,
        );
        assert.ok(
          Math.abs(counts[index] / golden.n - frequency) <= tolerance,
          `${scenario.name}:${nid}[${index}] ${counts[index] / golden.n} vs ${frequency}; tol=${tolerance}`,
        );
      });
    }
  }
});

test("mini DAG end-to-end exercises CPT lookup and conditional mask", () => {
  const graph = JSON.parse(readFileSync(new URL("./fixtures/mini_dag.json", import.meta.url)));
  const datasetId = `sha256:${"c".repeat(64)}`;
  const mini = compileSampler({
    core: buildGraphCore(graph, datasetId),
    pack: buildSamplerPack(graph, datasetId),
  });
  const { idx } = sample(mini, 200, {
    seed: 9,
    pins: { a: "a1", b: "b2", h: "h1", c: "c1" },
  });
  assert.ok([...idx.get("e")].every((value) => value === 1), "mask must eliminate e0");
  const d2 = [...idx.get("d")].filter((value) => value === 2).length / 200;
  assert.ok(Math.abs(d2 - 0.6) < 0.1, `CPT row code 3 not observed: ${d2}`);
});

test("gamma zero keeps prior overrides and conditional masks active", () => {
  const graph = JSON.parse(readFileSync(new URL("./fixtures/mini_dag.json", import.meta.url)));
  const datasetId = `sha256:${"e".repeat(64)}`;
  const zeroGamma = compileSampler({
    core: buildGraphCore(graph, datasetId),
    pack: buildSamplerPack(graph, datasetId),
    gammaScale: 0,
    overrides: { nodePriors: { e: [0.99, 0.01] } },
  });
  const maskOff = sample(zeroGamma, 200, { seed: 17, pins: { c: "c0" } }).idx.get("e");
  assert.ok([...maskOff].filter((value) => value === 0).length > 180,
    "prior override must remain active");
  const maskOn = sample(zeroGamma, 200, { seed: 17, pins: { c: "c1" } }).idx.get("e");
  assert.ok([...maskOn].every((value) => value === 1),
    "mask must remain active at gammaScale=0");
});

test("a conditional all-zero mask falls back to uniform only when its condition matches", () => {
  const datasetId = `sha256:${"4".repeat(64)}`;
  const maskCore = {
    formatVersion: 1,
    datasetId,
    topologicalOrder: ["p", "t"],
    nodes: [
      { id: "p", label: "Parent", values: ["p0", "p1"], prior: [0.5, 0.5], emit: false },
      { id: "t", label: "Target", values: ["t0", "t1"], prior: [0.9, 0.1], emit: true },
    ],
    edges: [],
  };
  const maskPack = {
    ...emptyPack(datasetId),
    masks: [{
      target: "t",
      condition: { p: ["p0"] },
      bad_values: ["t0", "t1"],
      bad_value_multiplier: 0,
      downweight_values: {},
      preferred_values: [],
      penalize_values_outside_preferred_set: false,
      outside_preferred_multiplier: 1,
    }],
  };
  const sampler = compileSampler({ core: maskCore, pack: maskPack });
  const seed = 88;
  const n = 40;
  const rng = createRng(seed);
  const expectedUniform = Array.from({ length: n }, () => (rng() > 0.5 ? 1 : 0));
  const maskOn = sample(sampler, n, { seed, pins: { p: "p0" } }).idx.get("t");
  assert.deepEqual([...maskOn], expectedUniform);

  const maskOff = sample(sampler, n, { seed, pins: { p: "p1" } }).idx.get("t");
  assert.ok([...maskOff].filter((value) => value === 1).length < 10,
    "non-matching rows must retain the 0.9/0.1 prior");
});

test("unconditional all-zero mask keeps Python zero-CDF index-zero behavior", () => {
  const graph = JSON.parse(readFileSync(new URL("./fixtures/mini_dag.json", import.meta.url)));
  graph.conditional_masks.push({
    target: "b",
    condition: {},
    bad_values: ["b0", "b1", "b2"],
    bad_value_multiplier: 0,
    downweight_values: {},
    preferred_values: [],
    penalize_values_outside_preferred_set: false,
    outside_preferred_multiplier: 1,
  });
  const datasetId = `sha256:${"f".repeat(64)}`;
  const sampler = compileSampler({
    core: buildGraphCore(graph, datasetId),
    pack: buildSamplerPack(graph, datasetId),
  });
  assert.deepEqual(sampler.nodeDistribution("b", {}), [1, 0, 0]);
  assert.ok([...sample(sampler, 20, { seed: 3 }).idx.get("b")]
    .every((value) => value === 0));
});

test("plan nodes consume RNG before prior-only nodes and pins consume no draws", () => {
  const datasetId = `sha256:${"1".repeat(64)}`;
  const tinyCore = {
    formatVersion: 1,
    datasetId,
    topologicalOrder: ["a"],
    nodes: [
      { id: "a", label: "A", values: ["a0", "a1"], prior: [0.5, 0.5], emit: true },
      { id: "b", label: "B", values: ["b0", "b1"], prior: [0.5, 0.5], emit: true },
      { id: "c", label: "C", values: ["c0", "c1"], prior: [0.5, 0.5], emit: true },
    ],
    edges: [],
  };
  const sampler = compileSampler({ core: tinyCore, pack: emptyPack(datasetId) });
  assert.deepEqual(sampler.plan.map(({ nid }) => nid), ["a"]);
  assert.deepEqual(sampler.priorOnlyNodes, ["b", "c"]);

  const expectedIndex = (random) => (random > 0.5 ? 1 : 0);
  const rng = createRng(123);
  const draws = Array.from({ length: 9 }, () => expectedIndex(rng()));
  const unpinned = sample(sampler, 3, { seed: 123 }).idx;
  assert.deepEqual([...unpinned.get("a")], draws.slice(0, 3));
  assert.deepEqual([...unpinned.get("b")], draws.slice(3, 6));
  assert.deepEqual([...unpinned.get("c")], draws.slice(6, 9));

  const pinned = sample(sampler, 3, { seed: 123, pins: { a: "a1" } }).idx;
  assert.deepEqual([...pinned.get("a")], [1, 1, 1]);
  assert.deepEqual([...pinned.get("b")], draws.slice(0, 3));
  assert.deepEqual([...pinned.get("c")], draws.slice(3, 6));

  const priorPinned = sample(sampler, 3, { seed: 123, pins: { b: "b1" } }).idx;
  assert.deepEqual([...priorPinned.get("a")], draws.slice(0, 3));
  assert.deepEqual([...priorPinned.get("b")], [1, 1, 1]);
  assert.deepEqual([...priorPinned.get("c")], draws.slice(3, 6));

  const overridden = compileSampler({
    core: tinyCore,
    pack: emptyPack(datasetId),
    overrides: { nodePriors: { b: [1, 0] } },
  });
  const overrideIdx = sample(overridden, 3, { seed: 123 }).idx;
  assert.deepEqual([...overrideIdx.get("b")], [0, 0, 0]);
  assert.deepEqual([...overrideIdx.get("c")], draws.slice(6, 9));
});

test("an unconditional zero-CDF plan node still consumes one RNG draw per row", () => {
  const datasetId = `sha256:${"2".repeat(64)}`;
  const zeroCore = {
    formatVersion: 1,
    datasetId,
    topologicalOrder: ["z", "y"],
    nodes: [
      { id: "z", label: "Zero", values: ["z0", "z1"], prior: [0.5, 0.5], emit: true },
      { id: "y", label: "After", values: ["y0", "y1"], prior: [0.5, 0.5], emit: true },
    ],
    edges: [],
  };
  const zeroPack = {
    ...emptyPack(datasetId),
    masks: [{
      target: "z",
      condition: {},
      bad_values: ["z0", "z1"],
      bad_value_multiplier: 0,
      downweight_values: {},
      preferred_values: [],
      penalize_values_outside_preferred_set: false,
      outside_preferred_multiplier: 1,
    }],
  };
  const sampler = compileSampler({ core: zeroCore, pack: zeroPack });
  const rng = createRng(77);
  const expected = Array.from({ length: 6 }, () => (rng() > 0.5 ? 1 : 0));
  const idx = sample(sampler, 3, { seed: 77 }).idx;
  assert.deepEqual([...idx.get("z")], [0, 0, 0]);
  assert.deepEqual([...idx.get("y")], expected.slice(3));
});

test("plan-node inverse CDF uses left insertion at an exact boundary", () => {
  const seed = 321;
  const firstDraw = createRng(seed)();
  const boundarySampler = {
    plan: [{
      nid: "z",
      k: 2,
      logprior: [0, 0],
      cpts: [],
      edges: [],
      masks: [{ conds: null, valueMult: [firstDraw, 1 - firstDraw] }],
    }],
    priorOnlyNodes: [],
    priorEff: new Map([["z", [firstDraw, 1 - firstDraw]]]),
    nodesById: new Map([["z", { id: "z", emit: true }]]),
    values: new Map([["z", ["z0", "z1"]]]),
    vtoi: new Map([["z", new Map([["z0", 0], ["z1", 1]])]]),
    emitNodes: ["z"],
  };
  assert.equal(sample(boundarySampler, 1, { seed }).idx.get("z")[0], 0);
});

test("prior-only inverse CDF uses right insertion at an exact boundary", () => {
  const seed = 321;
  const firstDraw = createRng(seed)();
  const boundarySampler = {
    plan: [],
    priorOnlyNodes: ["z"],
    priorEff: new Map([["z", [firstDraw, 1 - firstDraw]]]),
    nodesById: new Map([["z", { id: "z", emit: true }]]),
    values: new Map([["z", ["z0", "z1"]]]),
    vtoi: new Map([["z", new Map([["z0", 0], ["z1", 1]])]]),
    emitNodes: ["z"],
  };
  assert.equal(sample(boundarySampler, 1, { seed }).idx.get("z")[0], 1);
});

test("sample validates n, seed, pins, and pin values with exact keys", () => {
  const sampler = compileSampler({ core, pack });
  for (const badN of [0, 201, -1, 1.5, NaN, Infinity, "5", true, null]) {
    const error = getError(() => sample(sampler, badN, { seed: 1 }));
    assert.ok(error instanceof SynthesisValidationError, `n=${String(badN)}`);
    assert.equal(error.key, "n", `n=${String(badN)}`);
  }
  for (const badSeed of [-1, MAX_SAFE_SEED + 1, 1.5, NaN, Infinity, "1", true, null]) {
    const error = getError(() => sample(sampler, 5, { seed: badSeed }));
    assert.ok(error instanceof SynthesisValidationError, `seed=${String(badSeed)}`);
    assert.equal(error.key, "seed", `seed=${String(badSeed)}`);
  }
  for (const badPins of [null, [], "pins", true, new Map()]) {
    const error = getError(() => sample(sampler, 5, { seed: 1, pins: badPins }));
    assert.ok(error instanceof SynthesisValidationError);
    assert.equal(error.key, "pins");
  }

  let error = getError(() => sample(sampler, 5, { seed: 1, pins: { nope: "x" } }));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, "pins.nope");

  const nid = sampler.emitNodes[0];
  for (const badValue of ["not-a-value", 0, true, null]) {
    error = getError(() => sample(sampler, 5, { seed: 1, pins: { [nid]: badValue } }));
    assert.ok(error instanceof SynthesisValidationError);
    assert.equal(error.key, `pins.${nid}`);
  }
});

test("decodeRow returns emit values and fails closed on malformed idx", () => {
  const sampler = compileSampler({ core, pack });
  const { idx } = sample(sampler, 3, { seed: 19 });
  const decoded = decodeRow(sampler, idx, 2);
  assert.deepEqual(Object.keys(decoded), sampler.emitNodes);
  assert.ok(Object.values(decoded).every((value) => typeof value === "string"));
  assert.ok(core.nodes.filter((node) => node.emit === false)
    .every((node) => !Object.hasOwn(decoded, node.id)));

  let error = getError(() => decodeRow(sampler, idx, -1));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, "i");

  const nid = sampler.emitNodes[0];
  const missing = new Map(idx);
  missing.delete(nid);
  error = getError(() => decodeRow(sampler, missing, 0));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, `idx.${nid}`);

  const short = new Map(idx);
  short.set(nid, new Int32Array(1));
  error = getError(() => decodeRow(sampler, short, 2));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, `idx.${nid}`);

  const outOfRange = new Map(idx);
  outOfRange.set(nid, Int32Array.of(sampler.values.get(nid).length, 0, 0));
  error = getError(() => decodeRow(sampler, outOfRange, 0));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, `idx.${nid}.0`);
});

test("computeMarginals visits only requested nodes and fails closed on bad codes", () => {
  const sampler = compileSampler({ core, pack });
  const { idx } = sample(sampler, 20, { seed: 5 });
  const nid = sampler.emitNodes[0];
  const other = sampler.emitNodes[1];

  const all = computeMarginals(sampler, idx, 20);
  assert.deepEqual(Object.keys(all), sampler.emitNodes);

  const malformedUnrequested = new Map(idx);
  malformedUnrequested.set(other, Int32Array.of(-1));
  const selected = computeMarginals(sampler, malformedUnrequested, 20, [nid]);
  assert.deepEqual(Object.keys(selected), [nid]);
  const first = selected[nid];
  assert.ok(first.label && Array.isArray(first.values) && Array.isArray(first.freqs));
  assert.ok(Math.abs(first.freqs.reduce((sum, frequency) => sum + frequency, 0) - 1) < 0.01);

  const tieCodes = new Int32Array(160).fill(1);
  tieCodes.fill(0, 0, 7);
  const tie = computeMarginals(sampler, new Map([[nid, tieCodes]]), 160, [nid]);
  assert.equal(tie[nid].freqs[0], 0.0437, "must use Python binary64 half-even rounding");

  let error = getError(() => computeMarginals(sampler, idx, 20, ["not-a-node"]));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, "nodeIds.0");

  error = getError(() => computeMarginals(sampler, idx, 20, sampler.emitNodes.slice(0, 33)));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, "nodeIds");

  const short = new Map(idx);
  short.set(nid, new Int32Array(19));
  error = getError(() => computeMarginals(sampler, short, 20, [nid]));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, `idx.${nid}`);

  const invalidCode = new Map(idx);
  invalidCode.set(nid, new Int32Array(20).fill(-1));
  error = getError(() => computeMarginals(sampler, invalidCode, 20, [nid]));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, `idx.${nid}.0`);
});

test("computeMarginals omits a known helper that is outside the compiled required set", () => {
  const datasetId = `sha256:${"3".repeat(64)}`;
  const sparseCore = {
    formatVersion: 1,
    datasetId,
    topologicalOrder: ["a", "unused"],
    nodes: [
      { id: "a", label: "A", values: ["a0", "a1"], prior: [0.5, 0.5], emit: true },
      {
        id: "unused",
        label: "Unused helper",
        values: ["u0", "u1"],
        prior: [0.5, 0.5],
        emit: false,
      },
    ],
    edges: [],
  };
  const sampler = compileSampler({ core: sparseCore, pack: emptyPack(datasetId) });
  assert.deepEqual(sampler.plan.map(({ nid }) => nid), ["a"]);
  const { idx } = sample(sampler, 4, { seed: 8 });
  assert.equal(idx.has("unused"), false);
  assert.deepEqual(computeMarginals(sampler, idx, 4, ["unused"]), {});
  assert.deepEqual(Object.keys(computeMarginals(sampler, idx, 4, ["a", "unused"])), ["a"]);
});
