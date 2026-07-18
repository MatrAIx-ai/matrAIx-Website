import {
  MAX_SAFE_SEED,
  MAX_SAMPLE_N,
  SynthesisValidationError,
} from "./sampler.js";

export const DEFAULT_CONTROLS = Object.freeze({
  n: 20,
  seed: 42,
  gammaScale: 1,
  compareBaseline: true,
});
export const MAX_RECIPE_ENTRIES = 12;
export const MAX_MARGINAL_NODE_IDS = 32;
export const MAX_ADJUSTMENT_SCALE = 3;

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const URL_KEYS = new Set(["datasetId", "recipe", "controls"]);
const CONTROL_KEYS = new Set(["n", "seed", "gammaScale", "compareBaseline"]);
const REQUEST_KEYS = new Set([
  "n",
  "seed",
  "gammaScale",
  "compareBaseline",
  "pins",
  "overrides",
  "marginalNodeIds",
]);
const OVERRIDE_KEYS = new Set(["edgeWeights", "nodePriors", "categoryScales"]);
const RECIPE_KEYS = {
  pin: new Set(["kind", "nodeId", "label", "value"]),
  prior: new Set(["kind", "nodeId", "label", "values", "weights"]),
  category: new Set(["kind", "category", "factor"]),
  edge: new Set([
    "kind",
    "source",
    "target",
    "sourceLabel",
    "targetLabel",
    "factor",
  ]),
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const fail = (message, key) => {
  throw new SynthesisValidationError(message, key);
};

const isPlainRecord = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return !Object.keys(value).some((key) => DANGEROUS_KEYS.has(key));
};

const requireRecord = (value, key) => {
  if (!isPlainRecord(value)) fail(`${key} must be a plain object`, key);
  return value;
};

const rejectExtraKeys = (value, allowed, prefix = "") => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`unknown field: ${key}`, prefix ? `${prefix}.${key}` : key);
  }
};

const requireOwnKeys = (value, required, prefix = "") => {
  for (const key of required) {
    if (!hasOwn(value, key)) fail(`missing field: ${key}`, prefix ? `${prefix}.${key}` : key);
  }
};

const validateN = (value, key) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_SAMPLE_N) {
    fail(`n must be an integer between 1 and ${MAX_SAMPLE_N}`, key);
  }
  return value;
};

const validateSeed = (value, key) => {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_SAFE_SEED
  ) {
    fail(`seed must be an integer between 0 and ${MAX_SAFE_SEED}`, key);
  }
  return value;
};

const validateGamma = (value, key) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("gammaScale must be a finite number greater than or equal to 0", key);
  }
  return value;
};

const validateCompareBaseline = (record, key) => {
  if (!hasOwn(record, "compareBaseline")) return true;
  if (typeof record.compareBaseline !== "boolean") {
    fail("compareBaseline must be a boolean", key);
  }
  return record.compareBaseline;
};

const validateRecipeScale = (value, key) => {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > MAX_ADJUSTMENT_SCALE
  ) {
    fail(`scale must be a finite number between 0 and ${MAX_ADJUSTMENT_SCALE}`, key);
  }
  return value;
};

const validateOverrideFactor = (value, key) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("factor must be a finite number greater than or equal to 0", key);
  }
  return value;
};

const validateWeights = (weights, expectedLength, key) => {
  if (!Array.isArray(weights) || weights.length !== expectedLength) {
    fail(`weights must contain ${expectedLength} entries`, key);
  }
  let mass = 0;
  const clone = weights.map((weight) => {
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      fail("weights must be finite non-negative numbers", key);
    }
    mass += weight;
    if (!Number.isFinite(mass)) fail("weight mass must be finite", key);
    return weight;
  });
  if (mass <= 0) fail("weights must have positive mass", key);
  return clone;
};

const coreIndex = (core) => {
  if (!isPlainRecord(core) || !Array.isArray(core.nodes) || !Array.isArray(core.edges)) {
    fail("core is invalid", "core");
  }
  const nodes = new Map();
  const categories = new Set();
  for (const node of core.nodes) {
    if (!isPlainRecord(node) || typeof node.id !== "string" || !Array.isArray(node.values)) {
      fail("core is invalid", "core");
    }
    nodes.set(node.id, node);
    categories.add(node.category);
  }
  const edges = new Set(core.edges.map((edge) => `${edge.source}->${edge.target}`));
  return { nodes, categories, edges };
};

const sameStrings = (actual, expected) => (
  Array.isArray(actual)
  && actual.length === expected.length
  && actual.every((value, index) => typeof value === "string" && value === expected[index])
);

const derivedRecipeKey = (entry) => {
  switch (entry.kind) {
    case "pin": return `pin:${entry.nodeId}`;
    case "prior": return `prior:${entry.nodeId}`;
    case "category": return `category:${entry.category}`;
    case "edge": return `edge:${entry.source}->${entry.target}`;
    default: return null;
  }
};

const validateRecipeEntry = (entry, index, indexes) => {
  const prefix = `recipe.${index}`;
  requireRecord(entry, prefix);
  if (typeof entry.kind !== "string" || !hasOwn(RECIPE_KEYS, entry.kind)) {
    fail("unknown recipe kind", `${prefix}.kind`);
  }
  const allowed = RECIPE_KEYS[entry.kind];
  rejectExtraKeys(entry, allowed, prefix);
  requireOwnKeys(entry, allowed, prefix);

  if (entry.kind === "category") {
    if (typeof entry.category !== "string" || !indexes.categories.has(entry.category)) {
      fail("unknown category", `${prefix}.category`);
    }
    return {
      kind: "category",
      category: entry.category,
      factor: validateRecipeScale(entry.factor, `${prefix}.factor`),
    };
  }

  if (entry.kind === "edge") {
    const source = indexes.nodes.get(entry.source);
    const target = indexes.nodes.get(entry.target);
    if (!source) fail("unknown edge source", `${prefix}.source`);
    if (!target) fail("unknown edge target", `${prefix}.target`);
    if (!indexes.edges.has(`${entry.source}->${entry.target}`)) {
      fail("unknown edge", `${prefix}.source`);
    }
    if (entry.sourceLabel !== source.label) {
      fail("edge source label does not match the snapshot", `${prefix}.sourceLabel`);
    }
    if (entry.targetLabel !== target.label) {
      fail("edge target label does not match the snapshot", `${prefix}.targetLabel`);
    }
    return {
      kind: "edge",
      source: entry.source,
      target: entry.target,
      sourceLabel: entry.sourceLabel,
      targetLabel: entry.targetLabel,
      factor: validateRecipeScale(entry.factor, `${prefix}.factor`),
    };
  }

  const node = indexes.nodes.get(entry.nodeId);
  if (!node) fail("unknown node", `${prefix}.nodeId`);
  if (entry.label !== node.label) {
    fail("node label does not match the snapshot", `${prefix}.label`);
  }
  if (entry.kind === "pin") {
    if (typeof entry.value !== "string" || !node.values.includes(entry.value)) {
      fail("unknown pinned value", `${prefix}.value`);
    }
    return {
      kind: "pin",
      nodeId: entry.nodeId,
      label: entry.label,
      value: entry.value,
    };
  }

  if (!sameStrings(entry.values, node.values)) {
    fail("prior values do not match the snapshot", `${prefix}.values`);
  }
  return {
    kind: "prior",
    nodeId: entry.nodeId,
    label: entry.label,
    values: [...entry.values],
    weights: validateWeights(entry.weights, node.values.length, `${prefix}.weights`),
  };
};

export function validateUrlConfig(raw, { manifest, core } = {}) {
  requireRecord(raw, "config");
  if (!hasOwn(raw, "datasetId")) fail("missing datasetId", "datasetId");
  rejectExtraKeys(raw, URL_KEYS);
  requireOwnKeys(raw, URL_KEYS);
  if (
    typeof raw.datasetId !== "string"
    || raw.datasetId !== manifest?.datasetId
    || raw.datasetId !== core?.datasetId
  ) {
    fail("configuration belongs to another snapshot", "datasetId");
  }

  if (!Array.isArray(raw.recipe) || raw.recipe.length > MAX_RECIPE_ENTRIES) {
    fail(`recipe must contain at most ${MAX_RECIPE_ENTRIES} entries`, "recipe");
  }
  const indexes = coreIndex(core);
  const recipe = [];
  const keys = new Set();
  for (let index = 0; index < raw.recipe.length; index++) {
    const entry = validateRecipeEntry(raw.recipe[index], index, indexes);
    const key = derivedRecipeKey(entry);
    if (keys.has(key)) fail(`duplicate recipe entry: ${key}`, `recipe.${index}`);
    keys.add(key);
    recipe.push(entry);
  }

  requireRecord(raw.controls, "controls");
  rejectExtraKeys(raw.controls, CONTROL_KEYS, "controls");
  requireOwnKeys(raw.controls, new Set(["n", "seed", "gammaScale"]), "controls");
  return {
    datasetId: raw.datasetId,
    recipe,
    controls: {
      n: validateN(raw.controls.n, "controls.n"),
      seed: validateSeed(raw.controls.seed, "controls.seed"),
      gammaScale: validateGamma(raw.controls.gammaScale, "controls.gammaScale"),
      compareBaseline: validateCompareBaseline(raw.controls, "controls.compareBaseline"),
    },
  };
}

const validatePins = (pins, indexes) => {
  requireRecord(pins, "pins");
  const entries = Object.entries(pins);
  const out = [];
  for (const [nid, value] of entries) {
    const key = `pins.${nid}`;
    const node = indexes.nodes.get(nid);
    if (!node || typeof value !== "string" || !node.values.includes(value)) {
      fail(`unknown pinned value for ${nid}`, key);
    }
    out.push([nid, value]);
  }
  return out;
};

const validateOverrides = (overrides, indexes) => {
  requireRecord(overrides, "overrides");
  rejectExtraKeys(overrides, OVERRIDE_KEYS, "overrides");
  requireOwnKeys(overrides, OVERRIDE_KEYS, "overrides");
  const edgeWeights = requireRecord(overrides.edgeWeights, "overrides.edgeWeights");
  const nodePriors = requireRecord(overrides.nodePriors, "overrides.nodePriors");
  const categoryScales = requireRecord(
    overrides.categoryScales,
    "overrides.categoryScales",
  );

  const edgeEntries = Object.entries(edgeWeights).map(([edge, factor]) => {
    const key = `overrides.edgeWeights.${edge}`;
    if (!indexes.edges.has(edge)) fail(`unknown edge: ${edge}`, key);
    return [edge, validateOverrideFactor(factor, key)];
  });
  const priorEntries = Object.entries(nodePriors).map(([nid, weights]) => {
    const key = `overrides.nodePriors.${nid}`;
    const node = indexes.nodes.get(nid);
    if (!node) fail(`unknown node: ${nid}`, key);
    return [nid, validateWeights(weights, node.values.length, key)];
  });
  const categoryEntries = Object.entries(categoryScales).map(([category, factor]) => {
    const key = `overrides.categoryScales.${category}`;
    if (!indexes.categories.has(category)) fail(`unknown category: ${category}`, key);
    return [category, validateOverrideFactor(factor, key)];
  });
  return { edgeEntries, priorEntries, categoryEntries };
};

const validateMarginalNodeIds = (value, indexes) => {
  if (!Array.isArray(value)) fail("marginalNodeIds must be an array", "marginalNodeIds");
  if (value.length > MAX_MARGINAL_NODE_IDS) {
    fail(
      `marginalNodeIds must contain at most ${MAX_MARGINAL_NODE_IDS} nodes`,
      "marginalNodeIds",
    );
  }
  const seen = new Set();
  return value.map((nid, index) => {
    const key = `marginalNodeIds.${index}`;
    if (typeof nid !== "string" || !indexes.nodes.has(nid) || seen.has(nid)) {
      fail("marginal node must be known and unique", key);
    }
    seen.add(nid);
    return nid;
  });
};

export function validateSampleRequest(raw, core) {
  requireRecord(raw, "request");
  rejectExtraKeys(raw, REQUEST_KEYS);
  requireOwnKeys(
    raw,
    new Set(["n", "seed", "gammaScale", "pins", "overrides", "marginalNodeIds"]),
  );
  const indexes = coreIndex(core);
  const pinEntries = validatePins(raw.pins, indexes);
  const { edgeEntries, priorEntries, categoryEntries } = validateOverrides(
    raw.overrides,
    indexes,
  );
  if (
    pinEntries.length
    + edgeEntries.length
    + priorEntries.length
    + categoryEntries.length
    > MAX_RECIPE_ENTRIES
  ) {
    fail(`request must contain at most ${MAX_RECIPE_ENTRIES} adjustments`, "adjustments");
  }

  return {
    n: validateN(raw.n, "n"),
    seed: validateSeed(raw.seed, "seed"),
    gammaScale: validateGamma(raw.gammaScale, "gammaScale"),
    compareBaseline: validateCompareBaseline(raw, "compareBaseline"),
    pins: Object.fromEntries(pinEntries),
    overrides: {
      edgeWeights: Object.fromEntries(edgeEntries),
      nodePriors: Object.fromEntries(priorEntries),
      categoryScales: Object.fromEntries(categoryEntries),
    },
    marginalNodeIds: validateMarginalNodeIds(raw.marginalNodeIds, indexes),
  };
}
