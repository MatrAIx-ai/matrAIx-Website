import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileSampler, SynthesisValidationError } from "../synthesis/sampler.js";
import { buildGraphCore, buildSamplerPack } from "../scripts/build-synthesis-data.mjs";
import { assertDeepClose } from "./helpers.mjs";

const core = JSON.parse(readFileSync(
  new URL("../synthesis/data/graph-core.v1.json", import.meta.url),
));
const pack = JSON.parse(readFileSync(
  new URL("../synthesis/data/sampler-pack.v2.json", import.meta.url),
));
const golden = JSON.parse(readFileSync(
  new URL("./fixtures/sampler-probes.golden.json", import.meta.url),
));

test("probe distributions match Python for every scenario", () => {
  for (const scenario of golden.scenarios) {
    const sampler = compileSampler({
      core,
      pack,
      gammaScale: scenario.gammaScale,
      overrides: scenario.overrides,
    });
    const assignment = { ...golden.assignment };
    for (const [nid, value] of Object.entries(scenario.pins)) {
      assignment[nid] = sampler.vtoi.get(nid).get(value);
    }
    for (const probe of scenario.probes) {
      const dist = sampler.nodeDistribution(probe.nodeId, assignment);
      assertDeepClose(dist, probe.dist, {
        atol: 1e-4,
        path: `${scenario.name}:${probe.nodeId}`,
      });
    }
  }
});

test("observed CPT, mask on/off and replace-suppression branches match", () => {
  for (const scenario of golden.structuralCases) {
    const assignment = { ...golden.assignment, ...scenario.assignmentPatch };
    const sampler = compileSampler({ core, pack });
    assertDeepClose(sampler.nodeDistribution(scenario.nodeId, assignment), scenario.dist, {
      atol: 1e-4,
      path: `${scenario.kind}:${scenario.nodeId}`,
    });
    if (scenario.kind === "replace-suppressed") {
      const [source] = scenario.edgeKey.split("->");
      const plan = sampler.plan.find((node) => node.nid === scenario.nodeId);
      assert.ok(!plan.edges.some((edge) => edge.source === source));
      const overridden = compileSampler({
        core,
        pack,
        overrides: { edgeWeights: { [scenario.edgeKey]: 3 } },
      });
      assertDeepClose(
        overridden.nodeDistribution(scenario.nodeId, assignment),
        scenario.dist,
        { atol: 1e-4, path: scenario.kind },
      );
    }
  }

  const maskCore = {
    formatVersion: 1,
    datasetId: `sha256:${"a".repeat(64)}`,
    topologicalOrder: ["p", "t"],
    nodes: [
      {
        id: "p", label: "Parent", category: "Test", values: ["p0", "p1"],
        prior: [0.5, 0.5], parents: [], emit: false,
      },
      {
        id: "t", label: "Target", category: "Test", values: ["t0", "t1"],
        prior: [0.25, 0.75], parents: ["p"], emit: true,
      },
    ],
    edges: [],
  };
  const maskPack = (condition) => ({
    formatVersion: 1,
    datasetId: maskCore.datasetId,
    edges: [],
    cpts: [],
    masks: [{
      target: "t",
      condition,
      bad_values: ["t0", "t1"],
      preferred_values: [],
      downweight_values: {},
      bad_value_multiplier: 0,
      outside_preferred_multiplier: 1,
      penalize_values_outside_preferred_set: false,
    }],
  });

  const lateParentCore = { ...maskCore, topologicalOrder: ["t", "p"] };
  const skipped = compileSampler({ core: lateParentCore, pack: maskPack({ p: [] }) });
  assertDeepClose(skipped.nodeDistribution("t", {}), [0.25, 0.75]);

  const conditional = compileSampler({ core: maskCore, pack: maskPack({ p: ["p0"] }) });
  assertDeepClose(conditional.nodeDistribution("t", { p: 0 }), [0.5, 0.5]);

  const unconditional = compileSampler({ core: maskCore, pack: maskPack({}) });
  assertDeepClose(unconditional.nodeDistribution("t", { p: 0 }), [1, 0]);
});

test("override validation errors carry keys", () => {
  const getError = (fn) => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    throw new Error("did not throw");
  };

  let error = getError(() => compileSampler({
    core,
    pack,
    overrides: { edgeWeights: { "nope->nada": 2 } },
  }));
  assert.ok(error instanceof SynthesisValidationError);
  assert.equal(error.key, "overrides.edgeWeights.nope->nada");

  error = getError(() => compileSampler({
    core,
    pack,
    overrides: { nodePriors: { [core.nodes[0].id]: [1] } },
  }));
  assert.equal(error.key, `overrides.nodePriors.${core.nodes[0].id}`);

  error = getError(() => compileSampler({
    core,
    pack,
    overrides: { categoryScales: { Bogus: 1 } },
  }));
  assert.equal(error.key, "overrides.categoryScales.Bogus");

  error = getError(() => compileSampler({ core, pack, gammaScale: -1 }));
  assert.equal(error.key, "gammaScale");

  for (const bad of [true, "2", null]) {
    error = getError(() => compileSampler({ core, pack, gammaScale: bad }));
    assert.equal(error.key, "gammaScale");
  }

  error = getError(() => compileSampler({
    core,
    pack,
    overrides: { unknown: {} },
  }));
  assert.equal(error.key, "overrides.unknown");

  error = getError(() => compileSampler({
    core,
    pack,
    overrides: { categoryScales: { [core.nodes[0].category]: "2" } },
  }));
  assert.equal(error.key, `overrides.categoryScales.${core.nodes[0].category}`);
});

test("snapshot and finite arithmetic fail closed", () => {
  assert.throws(
    () => compileSampler({ core, pack: { ...pack, datasetId: "sha256:other" } }),
    SynthesisValidationError,
  );

  const [key] = Object.keys(golden.scenarios.find(
    (scenario) => scenario.name === "edge_boost",
  ).overrides.edgeWeights);
  assert.throws(
    () => compileSampler({
      core,
      pack,
      gammaScale: 2,
      overrides: { edgeWeights: { [key]: Number.MAX_VALUE } },
    }),
    SynthesisValidationError,
  );

  const badMaskPack = structuredClone(pack);
  const maskTarget = badMaskPack.masks[0].target;
  badMaskPack.masks[0].condition = { missing_parent: ["x"] };
  let maskError;
  try {
    compileSampler({ core, pack: badMaskPack });
  } catch (error) {
    maskError = error;
  }
  assert.ok(maskError instanceof SynthesisValidationError);
  assert.equal(maskError.key, `pack.masks.${maskTarget}.condition.missing_parent`);

  const coercionCases = [
    (candidate) => { candidate.edges[0].weight = true; },
    (candidate) => { candidate.edges[0].matrix[0][0] = "0.5"; },
    (candidate) => { candidate.cpts[0].weight = null; },
    (candidate) => { candidate.cpts[0].rows[0][1][0] = "0.5"; },
    (candidate) => { candidate.masks[0].bad_value_multiplier = "0.1"; },
  ];
  for (const mutate of coercionCases) {
    const candidate = structuredClone(pack);
    mutate(candidate);
    assert.throws(() => compileSampler({ core, pack: candidate }), SynthesisValidationError);
  }

  const maskTargetId = pack.masks[0].target;
  const nullMaskCases = [
    ["condition", `pack.masks.${maskTargetId}.condition`],
    ["bad_value_multiplier", `pack.masks.${maskTargetId}.bad_value_multiplier`],
    ["outside_preferred_multiplier", `pack.masks.${maskTargetId}.outside_preferred_multiplier`],
    ["bad_values", `pack.masks.${maskTargetId}.bad_values`],
    ["preferred_values", `pack.masks.${maskTargetId}.preferred_values`],
    ["downweight_values", `pack.masks.${maskTargetId}.downweight_values`],
  ];
  for (const [field, expectedKey] of nullMaskCases) {
    const candidate = structuredClone(pack);
    candidate.masks[0][field] = null;
    let error;
    try {
      compileSampler({ core, pack: candidate });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof SynthesisValidationError, field);
    assert.equal(error.key, expectedKey, field);
  }

  const zeroPriorCore = structuredClone(core);
  zeroPriorCore.nodes[0].prior.fill(0);
  assert.throws(
    () => compileSampler({ core: zeroPriorCore, pack }),
    SynthesisValidationError,
  );

  const zeroMatrixPack = structuredClone(pack);
  zeroMatrixPack.edges[0].matrix[0].fill(0);
  assert.throws(
    () => compileSampler({ core, pack: zeroMatrixPack }),
    SynthesisValidationError,
  );
});

test("compile rejects aggregate evidence overflow before any assignment is sampled", () => {
  const graph = JSON.parse(readFileSync(
    new URL("./fixtures/mini_dag.json", import.meta.url),
  ));
  const datasetId = `sha256:${"d".repeat(64)}`;
  const dangerousCore = buildGraphCore(graph, datasetId);
  dangerousCore.nodes.find((node) => node.id === "c").prior = [0.99, 0.01];
  const dangerousPack = buildSamplerPack(graph, datasetId);
  for (const edge of dangerousPack.edges.filter((item) => item.target === "c")) {
    edge.weight = 1;
    edge.matrix = edge.matrix.map(() => [0.1, 0.9]);
  }
  const huge = 5e307;

  assert.doesNotThrow(() => compileSampler({
    core: dangerousCore,
    pack: dangerousPack,
    overrides: { edgeWeights: { "a->c": huge, "b->c": 0 } },
  }));

  let aggregateError;
  try {
    compileSampler({
      core: dangerousCore,
      pack: dangerousPack,
      overrides: { edgeWeights: { "a->c": huge, "b->c": huge } },
    });
  } catch (error) {
    aggregateError = error;
  }
  assert.ok(aggregateError instanceof SynthesisValidationError);
  assert.equal(aggregateError.key, "aggregate.c");

  const factorCore = buildGraphCore(graph, datasetId);
  const factorPack = buildSamplerPack(graph, datasetId);
  factorPack.cpts.push({
    target: "c",
    parents: [],
    weight: 1e154,
    replace: false,
    rows: [[0, [0.7, 0.3]]],
  });
  const sourceCategory = factorCore.nodes.find((node) => node.id === "a").category;
  let factorError;
  try {
    compileSampler({
      core: factorCore,
      pack: factorPack,
      overrides: {
        edgeWeights: { "a->c": 1e308 },
        categoryScales: { [sourceCategory]: 2 },
      },
    });
  } catch (error) {
    factorError = error;
  }
  assert.ok(factorError instanceof SynthesisValidationError);
  assert.equal(factorError.key, "edges.a->c");
});
