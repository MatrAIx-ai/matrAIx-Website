import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CONTROLS,
  MAX_MARGINAL_NODE_IDS,
  MAX_RECIPE_ENTRIES,
  validateSampleRequest,
  validateUrlConfig,
} from "../synthesis/request-schema.js";
import * as requestSchema from "../synthesis/request-schema.js";
import { recipeToRequest } from "../synthesis/adjust-panel.js";
import {
  createSamplerWorkerRuntime,
  runSamplerJob,
  serializeWorkerError,
} from "../synthesis/sampler-worker.js";
import { createSamplerClient } from "../synthesis/sampler-client.js";
import {
  MAX_SAFE_SEED,
  SynthesisValidationError,
} from "../synthesis/sampler.js";
import { ArtifactLoadError } from "../synthesis/data-loader.js";
import { buildGraphCore, buildSamplerPack } from "../scripts/build-synthesis-data.mjs";

const datasetId = `sha256:${"a".repeat(64)}`;
const core = {
  formatVersion: 1,
  datasetId,
  topologicalOrder: ["a", "h", "b"],
  nodes: [
    {
      id: "a", label: "Node A", category: "Cat A", description: "", emit: true,
      values: ["a0", "a1"], prior: [0.5, 0.5], parents: [],
    },
    {
      id: "h", label: "Helper H", category: "Cat H", description: "", emit: false,
      values: ["h0", "h1"], prior: [0.5, 0.5], parents: [],
    },
    {
      id: "b", label: "Node B", category: "Cat B", description: "", emit: true,
      values: ["b0", "b1", "b2"], prior: [0.4, 0.35, 0.25], parents: ["a", "h"],
    },
  ],
  edges: [
    { source: "a", target: "b", weight: 1, relation: "drives" },
    { source: "h", target: "b", weight: 1, relation: "helps" },
  ],
};
const manifest = { datasetId };
const realCore = JSON.parse(readFileSync(
  new URL("../synthesis/data/graph-core.v1.json", import.meta.url),
));
const miniGraph = JSON.parse(readFileSync(
  new URL("./fixtures/mini_dag.json", import.meta.url),
));

const validRecipe = () => ([
  { kind: "pin", nodeId: "a", label: "Node A", value: "a1" },
  {
    kind: "prior",
    nodeId: "b",
    label: "Node B",
    values: ["b0", "b1", "b2"],
    weights: [1, 2, 3],
  },
  { kind: "category", category: "Cat H", factor: 0.5 },
  {
    kind: "edge",
    source: "h",
    target: "b",
    sourceLabel: "Helper H",
    targetLabel: "Node B",
    factor: 2,
  },
]);

const validUrlConfig = () => ({
  datasetId,
  recipe: validRecipe(),
  controls: { n: 20, seed: 42, gammaScale: 1 },
});

const validSampleRequest = () => ({
  n: 20,
  seed: 42,
  gammaScale: 1,
  pins: { a: "a1" },
  overrides: {
    edgeWeights: { "h->b": 2 },
    nodePriors: { b: [1, 2, 3] },
    categoryScales: { "Cat H": 0.5 },
  },
  marginalNodeIds: ["a", "b", "h"],
});

const getError = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("did not throw");
};

const expectValidationKey = (fn, key) => {
  const error = getError(fn);
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, key);
};

test("URL config validates all four canonical recipe shapes and returns a detached clone", () => {
  assert.deepEqual(DEFAULT_CONTROLS, {
    n: 20, seed: 42, gammaScale: 1, compareBaseline: true,
  });
  assert.equal(Object.hasOwn(requestSchema, "recipeKey"), false);
  assert.equal(Object.hasOwn(requestSchema, "recipeToRequest"), false);
  const raw = validUrlConfig();
  const normalized = validateUrlConfig(raw, { manifest, core });
  assert.deepEqual(normalized, {
    ...validUrlConfig(),
    controls: { n: 20, seed: 42, gammaScale: 1, compareBaseline: true },
  });
  assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
  assert.equal(Object.getPrototypeOf(normalized.controls), Object.prototype);
  assert.notEqual(normalized.recipe, raw.recipe);
  assert.notEqual(normalized.recipe[1].weights, raw.recipe[1].weights);

  raw.controls.n = 1;
  raw.recipe[0].value = "a0";
  raw.recipe[1].weights[0] = 999;
  assert.equal(normalized.controls.n, 20);
  assert.equal(normalized.recipe[0].value, "a1");
  assert.deepEqual(normalized.recipe[1].weights, [1, 2, 3]);
});

test("URL and sample validators reject each other's shapes", () => {
  expectValidationKey(
    () => validateUrlConfig(validSampleRequest(), { manifest, core }),
    "datasetId",
  );
  expectValidationKey(
    () => validateSampleRequest(validUrlConfig(), core),
    "datasetId",
  );
});

test("URL config rejects non-plain records, extra keys, and dataset drift", () => {
  expectValidationKey(() => validateUrlConfig([], { manifest, core }), "config");
  expectValidationKey(
    () => validateUrlConfig(new (class Config {})(), { manifest, core }),
    "config",
  );

  let candidate = validUrlConfig();
  candidate.extra = true;
  expectValidationKey(() => validateUrlConfig(candidate, { manifest, core }), "extra");

  candidate = validUrlConfig();
  candidate.controls.extra = 1;
  expectValidationKey(
    () => validateUrlConfig(candidate, { manifest, core }),
    "controls.extra",
  );

  candidate = validUrlConfig();
  candidate.recipe[0].extra = "x";
  expectValidationKey(
    () => validateUrlConfig(candidate, { manifest, core }),
    "recipe.0.extra",
  );

  candidate = validUrlConfig();
  candidate.datasetId = `sha256:${"b".repeat(64)}`;
  expectValidationKey(() => validateUrlConfig(candidate, { manifest, core }), "datasetId");
  expectValidationKey(
    () => validateUrlConfig(validUrlConfig(), {
      manifest: { datasetId: `sha256:${"b".repeat(64)}` },
      core,
    }),
    "datasetId",
  );
});

test("URL controls use strict numeric and boolean types with stable keys", () => {
  const cases = [
    ["n", 0], ["n", 201], ["n", 1.5], ["n", "20"], ["n", true],
    ["seed", -1], ["seed", MAX_SAFE_SEED + 1], ["seed", 1.5],
    ["seed", "42"], ["seed", true],
    ["gammaScale", -1], ["gammaScale", Infinity], ["gammaScale", "1"],
    ["gammaScale", true], ["compareBaseline", "false"], ["compareBaseline", 1],
  ];
  for (const [field, value] of cases) {
    const candidate = validUrlConfig();
    candidate.controls[field] = value;
    expectValidationKey(
      () => validateUrlConfig(candidate, { manifest, core }),
      `controls.${field}`,
    );
  }
});

test("URL recipe enforces the cap, unique derived keys, canonical data, and finite scales", () => {
  assert.equal(MAX_RECIPE_ENTRIES, 12);
  let candidate = validUrlConfig();
  candidate.recipe = Array.from({ length: MAX_RECIPE_ENTRIES + 1 }, (_, index) => ({
    kind: "category",
    category: `category-${index}`,
    factor: 1,
  }));
  expectValidationKey(() => validateUrlConfig(candidate, { manifest, core }), "recipe");

  candidate = validUrlConfig();
  candidate.recipe.push({ ...candidate.recipe[0] });
  expectValidationKey(
    () => validateUrlConfig(candidate, { manifest, core }),
    `recipe.${candidate.recipe.length - 1}`,
  );

  const mutations = [
    [(entry) => { entry.nodeId = "missing"; }, "recipe.0.nodeId"],
    [(entry) => { entry.label = "wrong"; }, "recipe.0.label"],
    [(entry) => { entry.value = "missing"; }, "recipe.0.value"],
    [(entry) => { entry.values = ["b1", "b0", "b2"]; }, "recipe.1.values"],
    [(entry) => { entry.weights = [1, 2]; }, "recipe.1.weights"],
    [(entry) => { entry.weights = [0, 0, 0]; }, "recipe.1.weights"],
    [(entry) => { entry.weights = [1, NaN, 3]; }, "recipe.1.weights"],
    [(entry) => { entry.category = "missing"; }, "recipe.2.category"],
    [(entry) => { entry.factor = 3.1; }, "recipe.2.factor"],
    [(entry) => { entry.factor = "2"; }, "recipe.2.factor"],
    [(entry) => { entry.source = "missing"; }, "recipe.3.source"],
    [(entry) => { entry.targetLabel = "wrong"; }, "recipe.3.targetLabel"],
    [(entry) => { entry.factor = -1; }, "recipe.3.factor"],
  ];
  for (const [mutate, key] of mutations) {
    candidate = validUrlConfig();
    const index = Number(key.split(".")[1]);
    mutate(candidate.recipe[index]);
    expectValidationKey(() => validateUrlConfig(candidate, { manifest, core }), key);
  }

  candidate = validUrlConfig();
  candidate.recipe[0] = { ...candidate.recipe[0], kind: "bogus" };
  expectValidationKey(() => validateUrlConfig(candidate, { manifest, core }), "recipe.0.kind");
});

test("sample request normalizes compareBaseline and returns detached canonical objects", () => {
  const raw = validSampleRequest();
  const normalized = validateSampleRequest(raw, core);
  assert.deepEqual(normalized, { ...validSampleRequest(), compareBaseline: true });
  assert.notEqual(normalized, raw);
  assert.notEqual(normalized.pins, raw.pins);
  assert.notEqual(normalized.overrides, raw.overrides);
  assert.notEqual(normalized.overrides.nodePriors.b, raw.overrides.nodePriors.b);
  assert.notEqual(normalized.marginalNodeIds, raw.marginalNodeIds);

  raw.pins.a = "a0";
  raw.overrides.nodePriors.b[0] = 999;
  raw.marginalNodeIds.length = 0;
  assert.equal(normalized.pins.a, "a1");
  assert.deepEqual(normalized.overrides.nodePriors.b, [1, 2, 3]);
  assert.deepEqual(normalized.marginalNodeIds, ["a", "b", "h"]);
});

test("sample request rejects non-plain records, extras, missing sections, and coercion", () => {
  expectValidationKey(() => validateSampleRequest(null, core), "request");

  let candidate = validSampleRequest();
  candidate.extra = true;
  expectValidationKey(() => validateSampleRequest(candidate, core), "extra");

  candidate = validSampleRequest();
  candidate.pins = [];
  expectValidationKey(() => validateSampleRequest(candidate, core), "pins");

  candidate = validSampleRequest();
  candidate.overrides.extra = {};
  expectValidationKey(() => validateSampleRequest(candidate, core), "overrides.extra");

  candidate = validSampleRequest();
  delete candidate.overrides.nodePriors;
  expectValidationKey(
    () => validateSampleRequest(candidate, core),
    "overrides.nodePriors",
  );

  const cases = [
    ["n", true], ["n", "20"], ["n", 0], ["n", 201], ["n", 1.5],
    ["seed", true], ["seed", "42"], ["seed", -1], ["seed", MAX_SAFE_SEED + 1],
    ["gammaScale", true], ["gammaScale", "1"], ["gammaScale", -1],
    ["gammaScale", Infinity], ["compareBaseline", "false"],
  ];
  for (const [field, value] of cases) {
    candidate = validSampleRequest();
    candidate[field] = value;
    expectValidationKey(() => validateSampleRequest(candidate, core), field);
  }
});

test("sample request validates pins and every override section before compile", () => {
  const mutations = [
    [(request) => { request.pins.missing = "x"; }, "pins.missing"],
    [(request) => { request.pins.a = "missing"; }, "pins.a"],
    [(request) => { request.pins.a = true; }, "pins.a"],
    [(request) => { request.overrides.edgeWeights["a->h"] = 1; }, "overrides.edgeWeights.a->h"],
    [(request) => { request.overrides.edgeWeights["h->b"] = "2"; }, "overrides.edgeWeights.h->b"],
    [(request) => { request.overrides.edgeWeights["h->b"] = Infinity; }, "overrides.edgeWeights.h->b"],
    [(request) => { request.overrides.categoryScales.missing = 1; }, "overrides.categoryScales.missing"],
    [(request) => { request.overrides.categoryScales["Cat H"] = -1; }, "overrides.categoryScales.Cat H"],
    [(request) => { request.overrides.nodePriors.missing = [1]; }, "overrides.nodePriors.missing"],
    [(request) => { request.overrides.nodePriors.b = [1, 2]; }, "overrides.nodePriors.b"],
    [(request) => { request.overrides.nodePriors.b = [0, 0, 0]; }, "overrides.nodePriors.b"],
    [(request) => { request.overrides.nodePriors.b = [1, true, 3]; }, "overrides.nodePriors.b"],
  ];
  for (const [mutate, key] of mutations) {
    const candidate = validSampleRequest();
    mutate(candidate);
    expectValidationKey(() => validateSampleRequest(candidate, core), key);
  }
});

test("sample override factors accept every finite non-negative value beyond the UI slider", () => {
  const candidate = validSampleRequest();
  candidate.overrides.edgeWeights["h->b"] = 4.25;
  candidate.overrides.categoryScales["Cat H"] = Number.MAX_VALUE;
  const normalized = validateSampleRequest(candidate, core);
  assert.equal(normalized.overrides.edgeWeights["h->b"], 4.25);
  assert.equal(normalized.overrides.categoryScales["Cat H"], Number.MAX_VALUE);
});

test("sample request caps total adjustments and marginal node ids", () => {
  const pinHeavy = {
    n: 1,
    seed: 0,
    gammaScale: 1,
    compareBaseline: false,
    pins: Object.fromEntries(realCore.nodes.slice(0, MAX_RECIPE_ENTRIES + 1)
      .map((node) => [node.id, node.values[0]])),
    overrides: { edgeWeights: {}, nodePriors: {}, categoryScales: {} },
    marginalNodeIds: [],
  };
  expectValidationKey(() => validateSampleRequest(pinHeavy, realCore), "adjustments");

  assert.equal(MAX_MARGINAL_NODE_IDS, 32);
  let candidate = validSampleRequest();
  candidate.marginalNodeIds = ["a", "a"];
  expectValidationKey(() => validateSampleRequest(candidate, core), "marginalNodeIds.1");

  candidate = validSampleRequest();
  candidate.marginalNodeIds = ["missing"];
  expectValidationKey(() => validateSampleRequest(candidate, core), "marginalNodeIds.0");

  candidate = {
    n: 1,
    seed: 0,
    gammaScale: 1,
    compareBaseline: false,
    pins: {},
    overrides: { edgeWeights: {}, nodePriors: {}, categoryScales: {} },
    marginalNodeIds: realCore.nodes.slice(0, MAX_MARGINAL_NODE_IDS + 1)
      .map((node) => node.id),
  };
  expectValidationKey(() => validateSampleRequest(candidate, realCore), "marginalNodeIds");
});

test("validated URL recipe expands to the same normalized direct Generate request", () => {
  const config = validateUrlConfig(validUrlConfig(), { manifest, core });
  const fromRecipe = validateSampleRequest(recipeToRequest(
    config.recipe,
    config.controls,
    { marginalNodeIds: ["h", "a"] },
  ), core);
  const direct = validateSampleRequest({
    n: 20,
    seed: 42,
    gammaScale: 1,
    compareBaseline: true,
    pins: { a: "a1" },
    overrides: {
      edgeWeights: { "h->b": 2 },
      nodePriors: { b: [1, 2, 3] },
      categoryScales: { "Cat H": 0.5 },
    },
    marginalNodeIds: ["h", "a", "b"],
  }, core);
  assert.deepEqual(fromRecipe, direct);
});

const miniDatasetId = `sha256:${"c".repeat(64)}`;
const miniCore = buildGraphCore(miniGraph, miniDatasetId);
const miniPack = buildSamplerPack(miniGraph, miniDatasetId);
const miniRequest = (overrides = {}) => ({
  n: 12,
  seed: 91,
  gammaScale: 1,
  compareBaseline: true,
  pins: { a: "a1", h: "h1" },
  overrides: { edgeWeights: {}, nodePriors: {}, categoryScales: {} },
  marginalNodeIds: ["h", "d", "e"],
  ...overrides,
});

test("runSamplerJob returns deterministic transferable row-major codes and selected marginals", async () => {
  const first = await runSamplerJob({
    core: miniCore,
    pack: miniPack,
    request: miniRequest(),
  }, {});
  const second = await runSamplerJob({
    core: miniCore,
    pack: miniPack,
    request: miniRequest(),
  }, {});

  assert.equal(first.n, 12);
  assert.ok(first.personaCodes instanceof Uint32Array);
  assert.equal(first.personaCodes.length, first.n * first.personaNodeIds.length);
  assert.equal(first.personaCodes.byteLength, first.n * first.personaNodeIds.length * 4);
  assert.deepEqual(first.personaNodeIds, second.personaNodeIds);
  assert.deepEqual(first.personaCodes, second.personaCodes);
  assert.deepEqual(first.marginals, second.marginals);
  assert.deepEqual(Object.keys(first.marginals), ["h", "d", "e"]);
  assert.deepEqual(Object.keys(first.baselineMarginals), ["h", "d", "e"]);
  assert.equal(Object.hasOwn(first, "personas"), false);
  assert.equal(Object.hasOwn(first, "baselinePersonas"), false);
  assert.deepEqual(first.flags.helperPins, ["h"]);

  const nodes = new Map(miniCore.nodes.map((node) => [node.id, node]));
  const helperColumn = first.personaNodeIds.indexOf("h");
  assert.ok(helperColumn >= 0, "required helper must be packed for drilldown overlay");
  assert.equal(nodes.get("h").emit, false);
  for (let row = 0; row < first.n; row++) {
    for (let column = 0; column < first.personaNodeIds.length; column++) {
      const nid = first.personaNodeIds[column];
      const code = first.personaCodes[row * first.personaNodeIds.length + column];
      assert.ok(code < nodes.get(nid).values.length, `${nid} code must decode exactly`);
    }
    assert.equal(first.personaCodes[row * first.personaNodeIds.length + helperColumn], 1);
  }
});

test("runSamplerJob packs every actually sampled prior-only node after plan nodes", async () => {
  const priorDatasetId = `sha256:${"d".repeat(64)}`;
  const priorCore = {
    formatVersion: 1,
    datasetId: priorDatasetId,
    topologicalOrder: ["a"],
    nodes: [
      {
        id: "a", label: "A", category: "Cat", description: "", emit: true,
        values: ["a0", "a1"], prior: [0.5, 0.5], parents: [],
      },
      {
        id: "b", label: "B", category: "Cat", description: "", emit: true,
        values: ["b0", "b1"], prior: [0.5, 0.5], parents: [],
      },
    ],
    edges: [],
  };
  const priorPack = {
    formatVersion: 1, datasetId: priorDatasetId, edges: [], cpts: [], masks: [],
  };
  const result = await runSamplerJob({
    core: priorCore,
    pack: priorPack,
    request: {
      n: 2,
      seed: 3,
      gammaScale: 1,
      compareBaseline: false,
      pins: {},
      overrides: { edgeWeights: {}, nodePriors: {}, categoryScales: {} },
      marginalNodeIds: ["b"],
    },
  });
  assert.deepEqual(result.personaNodeIds, ["a", "b"]);
  assert.equal(result.personaCodes.length, 4);
  assert.equal(result.baselineMarginals, null);
});

test("runSamplerJob reuses baseline per dataset and invalidates it on dataset change", async () => {
  const cache = {};
  await runSamplerJob({ core: miniCore, pack: miniPack, request: miniRequest() }, cache);
  const originalBaseline = cache.baseline;
  await runSamplerJob({
    core: miniCore,
    pack: miniPack,
    request: miniRequest({ seed: 92 }),
  }, cache);
  assert.equal(cache.baseline, originalBaseline);
  assert.equal(cache.datasetId, miniDatasetId);

  const nextDatasetId = `sha256:${"e".repeat(64)}`;
  const nextCore = buildGraphCore(miniGraph, nextDatasetId);
  const nextPack = buildSamplerPack(miniGraph, nextDatasetId);
  await runSamplerJob({ core: nextCore, pack: nextPack, request: miniRequest() }, cache);
  assert.notEqual(cache.baseline, originalBaseline);
  assert.equal(cache.datasetId, nextDatasetId);
});

test("worker errors expose validation detail but redact arbitrary failures", async () => {
  await assert.rejects(
    () => runSamplerJob({
      core: miniCore,
      pack: { ...miniPack, datasetId: `sha256:${"f".repeat(64)}` },
      request: miniRequest(),
    }),
    (error) => error instanceof SynthesisValidationError && error.key === "datasetId",
  );

  const validation = serializeWorkerError(
    new SynthesisValidationError("bad pin", "pins.a"),
  );
  assert.deepEqual(validation, { message: "bad pin", key: "pins.a", code: "generation" });

  const secret = new Error("secret https://internal.example/snapshot");
  secret.stack = "TOP SECRET STACK";
  assert.deepEqual(serializeWorkerError(secret), {
    message: "Generation failed. Retry with the verified snapshot.",
    key: null,
    code: "generation",
  });
  assert.equal(JSON.stringify(serializeWorkerError(secret)).includes("secret"), false);

  const loadError = new ArtifactLoadError("http", "Snapshot request failed (404).");
  assert.deepEqual(serializeWorkerError(loadError), {
    message: "Generation failed. Retry with the verified snapshot.",
    key: null,
    code: "http",
  });
});

test("worker runtime clears a rejected dataset load and retries core then pack", async () => {
  const calls = [];
  const posted = [];
  let coreAttempts = 0;
  const loadArtifactImpl = async (receivedManifest, key, options) => {
    calls.push({ receivedManifest, key, options });
    if (key === "core") {
      coreAttempts += 1;
      if (coreAttempts === 1) throw new ArtifactLoadError("http", "secret 404 URL");
      return miniCore;
    }
    assert.equal(options.core, miniCore);
    return miniPack;
  };
  const runtime = createSamplerWorkerRuntime({
    loadArtifactImpl,
    postMessage: (message, transfer = []) => posted.push({ message, transfer }),
  });
  const init = { type: "init", baseUrl: "https://example.test/app/", manifest: { datasetId } };

  runtime.handleMessage({ data: init });
  await runtime.handleMessage({ data: { type: "run", jobId: 1, request: miniRequest() } });
  assert.equal(posted.at(-1).message.type, "error");
  assert.equal(posted.at(-1).message.jobId, 1);
  assert.equal(posted.at(-1).message.error.message,
    "Generation failed. Retry with the verified snapshot.");

  runtime.handleMessage({ data: init });
  await runtime.handleMessage({ data: { type: "run", jobId: 2, request: miniRequest() } });
  assert.equal(posted.at(-1).message.type, "result");
  assert.equal(posted.at(-1).message.jobId, 2);
  assert.deepEqual(posted.at(-1).transfer, [posted.at(-1).message.result.personaCodes.buffer]);
  assert.deepEqual(calls.map(({ key }) => key), ["core", "core", "pack"]);
  assert.equal(calls[1].options.baseUrl, init.baseUrl);
  assert.equal(calls[2].options.baseUrl, init.baseUrl);
});

class FakeWorker {
  constructor({ throwOnType = null } = {}) {
    this.messages = [];
    this.listeners = new Map();
    this.terminated = false;
    this.throwOnType = throwOnType;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message) {
    if (message.type === this.throwOnType) {
      this.throwOnType = null;
      throw new Error(`synthetic ${message.type} post failure`);
    }
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  listener(type) {
    return [...(this.listeners.get(type) ?? [])][0];
  }
}

const makeClientHarness = () => {
  const workers = [];
  const starts = [];
  const results = [];
  const errors = [];
  const manifest = { datasetId: miniDatasetId, releaseId: "v2" };
  const dataset = {
    manifest,
    baseUrl: "https://example.test/subpath/",
    core: { forbidden: "parsed core must not cross the boundary" },
  };
  const client = createSamplerClient({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    dataset,
    onStart: (jobId, request) => starts.push({ jobId, request }),
    onResult: (jobId, result) => results.push({ jobId, result }),
    onError: (jobId, error) => errors.push({ jobId, error }),
  });
  return { client, dataset, errors, manifest, results, starts, workers };
};

test("sampler client snapshots requests and enforces worker-identity plus jobId latest-wins", () => {
  const harness = makeClientHarness();
  const firstRequest = miniRequest({ seed: 1 });
  const firstId = harness.client.run(firstRequest);
  assert.equal(firstId, 1);
  assert.equal(harness.workers.length, 1);
  const firstWorker = harness.workers[0];
  const staleMessageHandler = firstWorker.listener("message");
  assert.deepEqual(firstWorker.messages[0], {
    type: "init",
    baseUrl: harness.dataset.baseUrl,
    manifest: harness.manifest,
  });
  assert.deepEqual(Object.keys(firstWorker.messages[0]).sort(), ["baseUrl", "manifest", "type"]);
  assert.equal(Object.hasOwn(firstWorker.messages[0], "core"), false);
  assert.deepEqual(Object.keys(firstWorker.messages[1]).sort(), ["jobId", "request", "type"]);
  assert.equal(Object.hasOwn(firstWorker.messages[1], "manifest"), false);
  assert.equal(Object.hasOwn(firstWorker.messages[1], "core"), false);

  firstRequest.seed = 999;
  firstRequest.pins.a = "a0";
  assert.equal(firstWorker.messages[1].request.seed, 1);
  assert.equal(firstWorker.messages[1].request.pins.a, "a1");
  assert.notEqual(firstWorker.messages[1].request, firstRequest);

  const secondId = harness.client.run(miniRequest({ seed: 2 }));
  const thirdId = harness.client.run(miniRequest({ seed: 3 }));
  assert.deepEqual([secondId, thirdId], [2, 3]);
  assert.equal(firstWorker.terminated, true);
  assert.equal(harness.workers[1].terminated, true);
  assert.equal(harness.workers.length, 3);
  assert.deepEqual(harness.starts.map(({ jobId, request }) => [jobId, request.seed]), [
    [1, 1], [2, 2], [3, 3],
  ]);

  staleMessageHandler({ data: { type: "result", jobId: 1, result: { seed: 1 } } });
  harness.workers[2].emit("message", {
    data: { type: "result", jobId: 2, result: { seed: 2 } },
  });
  assert.deepEqual(harness.results, []);
  harness.workers[2].emit("message", {
    data: { type: "result", jobId: 3, result: { seed: 3 } },
  });
  assert.deepEqual(harness.results, [{ jobId: 3, result: { seed: 3 } }]);
  assert.deepEqual(harness.errors, []);
});

test("sampler client reuses an idle success worker but errors force a fresh initialized retry", () => {
  const harness = makeClientHarness();
  harness.client.run(miniRequest({ seed: 10 }));
  const firstWorker = harness.workers[0];
  firstWorker.emit("message", {
    data: { type: "result", jobId: 1, result: { seed: 10 } },
  });

  harness.client.run(miniRequest({ seed: 11 }));
  assert.equal(harness.workers.length, 1, "idle worker must retain its verified dataset cache");
  assert.deepEqual(firstWorker.messages.map(({ type }) => type), ["init", "run", "run"]);
  firstWorker.emit("message", {
    data: {
      type: "error",
      jobId: 2,
      error: { message: "bad request", key: "pins.a", code: "generation" },
    },
  });
  assert.equal(firstWorker.terminated, true);
  assert.deepEqual(harness.errors, [{
    jobId: 2,
    error: { message: "bad request", key: "pins.a", code: "generation" },
  }]);

  harness.client.run(miniRequest({ seed: 12 }));
  assert.equal(harness.workers.length, 2);
  assert.deepEqual(harness.workers[1].messages.map(({ type }) => type), ["init", "run"]);
  harness.workers[1].emit("error", { message: "secret browser error" });
  assert.equal(harness.workers[1].terminated, true);
  assert.deepEqual(harness.errors.at(-1), {
    jobId: 3,
    error: {
      message: "Generation failed. Retry with the verified snapshot.",
      key: null,
      code: "worker",
    },
  });

  harness.client.run(miniRequest({ seed: 13 }));
  assert.equal(harness.workers.length, 3);
  assert.deepEqual(harness.workers[2].messages.map(({ type }) => type), ["init", "run"]);
});

test("sampler client destroy removes handlers, terminates, and rejects future runs", () => {
  const harness = makeClientHarness();
  harness.client.run(miniRequest());
  const worker = harness.workers[0];
  const messageHandler = worker.listener("message");
  harness.client.destroy();
  assert.equal(worker.terminated, true);
  assert.equal(worker.listeners.get("message").size, 0);
  assert.equal(worker.listeners.get("error").size, 0);
  messageHandler({ data: { type: "result", jobId: 1, result: { stale: true } } });
  assert.deepEqual(harness.results, []);
  assert.throws(() => harness.client.run(miniRequest()), /destroyed/i);
});

test("sampler client reports synchronous init/run post failures and retries with a fresh worker", () => {
  for (const failingType of ["init", "run"]) {
    const workers = [];
    const starts = [];
    const errors = [];
    const client = createSamplerClient({
      createWorker: () => {
        const worker = new FakeWorker({
          throwOnType: workers.length === 0 ? failingType : null,
        });
        workers.push(worker);
        return worker;
      },
      dataset: { manifest: { datasetId: miniDatasetId }, baseUrl: "https://example.test/" },
      onStart: (jobId) => starts.push(jobId),
      onError: (jobId, error) => errors.push({ jobId, error }),
    });

    assert.equal(client.run(miniRequest({ seed: 31 })), 1);
    assert.deepEqual(starts, [1], failingType);
    assert.equal(workers[0].terminated, true, failingType);
    assert.deepEqual(errors, [{
      jobId: 1,
      error: {
        message: "Generation failed. Retry with the verified snapshot.",
        key: null,
        code: "worker",
      },
    }], failingType);

    assert.equal(client.run(miniRequest({ seed: 32 })), 2);
    assert.equal(workers.length, 2, failingType);
    assert.deepEqual(workers[1].messages.map(({ type }) => type), ["init", "run"]);
    client.destroy();
  }
});

test("sampler client onStart reentrant run or destroy cannot post or clobber the superseded job", () => {
  const workers = [];
  const starts = [];
  const results = [];
  const errors = [];
  let client;
  client = createSamplerClient({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    dataset: { manifest: { datasetId: miniDatasetId }, baseUrl: "https://example.test/" },
    onStart: (jobId) => {
      starts.push(jobId);
      if (jobId === 1) client.run(miniRequest({ seed: 42 }));
    },
    onResult: (jobId, result) => results.push({ jobId, result }),
    onError: (jobId, error) => errors.push({ jobId, error }),
  });
  assert.equal(client.run(miniRequest({ seed: 41 })), 1);
  assert.deepEqual(starts, [1, 2]);
  assert.equal(workers.length, 1, "superseded outer run must not create a worker");
  assert.deepEqual(workers[0].messages.map(({ type }) => type), ["init", "run"]);
  assert.equal(workers[0].messages[1].jobId, 2);
  workers[0].emit("message", {
    data: { type: "result", jobId: 2, result: { seed: 42 } },
  });
  assert.deepEqual(results, [{ jobId: 2, result: { seed: 42 } }]);
  assert.deepEqual(errors, []);
  client.destroy();

  const destroyWorkers = [];
  let destroyClient;
  destroyClient = createSamplerClient({
    createWorker: () => {
      const worker = new FakeWorker();
      destroyWorkers.push(worker);
      return worker;
    },
    dataset: { manifest: { datasetId: miniDatasetId }, baseUrl: "https://example.test/" },
    onStart: () => destroyClient.destroy(),
  });
  assert.equal(destroyClient.run(miniRequest()), 1);
  assert.deepEqual(destroyWorkers, [], "destroy in onStart must prevent worker creation");
  assert.throws(() => destroyClient.run(miniRequest()), /destroyed/i);
});
