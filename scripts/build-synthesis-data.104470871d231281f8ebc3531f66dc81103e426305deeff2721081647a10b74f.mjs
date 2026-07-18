#!/usr/bin/env node
// Precomputes the static Synthesis Studio data artifacts from full_dag.json.
// Usage: node scripts/build-synthesis-data.mjs \
//   --graph ../persona/synthesis/graph/full_dag.json \
//   --source-commit <40-hex> --out-dir synthesis/data [--phase 1|2]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SOURCE_COMMIT = "4dfa4e066b706c6a2d33a10fd41b976efd3f524e";
const FULL_DAG_SHA256 = "28822720c6f8beea8f9386ef918df329ff5607eacea9ad16f5b80edc6dc4e166";
const DIMENSIONS_SHA256 = "109d203ae177b62e872ebc3272d52a7705e02c35575456728f99332f481a4f42";
const DIMENSIONS_BYTES = 603_975;

export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function parseBuildJson(bytes, label) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    const error = new Error(`${label} is not valid UTF-8.`, { cause });
    error.name = "BuildInputError";
    error.code = "utf8";
    error.key = label;
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch (cause) {
    const error = new Error(`${label} is not valid JSON.`, { cause });
    error.name = "BuildInputError";
    error.code = "json";
    error.key = label;
    throw error;
  }
}

const assertImmutableCompatible = (path, bytes) => {
  if (existsSync(path) && !readFileSync(path).equals(bytes)) {
    throw new Error(`refusing to overwrite immutable artifact: ${path}`);
  }
};

const writeImmutable = (path, bytes) => {
  assertImmutableCompatible(path, bytes);
  if (existsSync(path)) return;
  writeFileSync(path, bytes);
};

const prec = (digits) => (x) => Number(Number(x).toPrecision(digits));

export function normalizeBuildDist(arr) {
  const out = Array.from(arr, (x) => {
    const v = Number(x);
    return Number.isFinite(v) ? Math.max(v, 0) : 0;
  });
  const max = Math.max(0, ...out);
  if (max === 0) return out.map(() => 1 / out.length);
  const scaled = out.map((x) => x / max);
  const sum = scaled.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0) throw new RangeError("non-finite normalized mass");
  return scaled.map((x) => x / sum);
}

export function alignBuildDist(dist, values, sourceValues = null) {
  if (dist !== null && typeof dist === "object" && !Array.isArray(dist)) {
    return normalizeBuildDist(values.map((v) => Number(dist[v] ?? 0)));
  }
  const list = Array.from(dist ?? [], Number);
  if (sourceValues) {
    const byName = new Map();
    const n = Math.min(sourceValues.length, list.length);
    for (let i = 0; i < n; i++) byName.set(sourceValues[i], list[i]);
    return normalizeBuildDist(values.map((v) => byName.get(v) ?? 0));
  }
  return normalizeBuildDist(list);
}

const BUILD_DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const buildHasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class BuildValidationError extends TypeError {
  constructor(key, kind = "Artifact") {
    super(`${kind} schema is invalid.`);
    this.name = "BuildValidationError";
    this.code = "schema";
    this.key = key;
  }
}

const buildFail = (key, kind) => {
  throw new BuildValidationError(key, kind);
};

const isBuildRecord = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const validateBuildSafeJson = (value, key, seen) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) buildFail(key, "Dimensions");
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) buildFail(key, "Dimensions");
    seen.add(value);
    for (const childKey of Object.keys(value)) {
      if (BUILD_DANGEROUS_KEYS.has(childKey)) {
        buildFail(`${key}.${childKey}`, "Dimensions");
      }
      const childPath = /^(?:0|[1-9][0-9]*)$/.test(childKey)
        ? `${key}[${childKey}]`
        : `${key}.${childKey}`;
      validateBuildSafeJson(value[childKey], childPath, seen);
    }
    return;
  }
  if (!isBuildRecord(value) || seen.has(value)) buildFail(key, "Dimensions");
  seen.add(value);
  for (const childKey of Object.keys(value)) {
    if (BUILD_DANGEROUS_KEYS.has(childKey)) buildFail(`${key}.${childKey}`, "Dimensions");
    validateBuildSafeJson(value[childKey], `${key}.${childKey}`, seen);
  }
};

export function validateBuildDimensions(data) {
  if (!isBuildRecord(data)) buildFail("$", "Dimensions");
  validateBuildSafeJson(data, "$", new WeakSet());
  if (!Array.isArray(data.dimensions)) buildFail("dimensions", "Dimensions");

  const ids = new Set();
  for (let index = 0; index < data.dimensions.length; index++) {
    const dimension = data.dimensions[index];
    const key = `dimensions[${index}]`;
    if (!isBuildRecord(dimension)) buildFail(key, "Dimensions");
    if (typeof dimension.id !== "string" || dimension.id.trim().length === 0
        || ids.has(dimension.id)) {
      buildFail(`${key}.id`, "Dimensions");
    }
    ids.add(dimension.id);

    for (const field of ["label", "category", "description", "phrase"]) {
      if (buildHasOwn(dimension, field) && typeof dimension[field] !== "string") {
        buildFail(`${key}.${field}`, "Dimensions");
      }
    }
    if (buildHasOwn(dimension, "index") && typeof dimension.index !== "number") {
      buildFail(`${key}.index`, "Dimensions");
    }

    if (!Array.isArray(dimension.values) || dimension.values.length === 0) {
      buildFail(`${key}.values`, "Dimensions");
    }
    const values = new Set();
    for (let valueIndex = 0; valueIndex < dimension.values.length; valueIndex++) {
      const value = dimension.values[valueIndex];
      if (typeof value !== "string" || value.trim().length === 0 || values.has(value)) {
        buildFail(`${key}.values[${valueIndex}]`, "Dimensions");
      }
      values.add(value);
    }

    if (buildHasOwn(dimension, "defaultValue") && dimension.defaultValue !== null) {
      const defaultValue = dimension.defaultValue;
      if (typeof defaultValue === "string") {
        if (!values.has(defaultValue)) buildFail(`${key}.defaultValue`, "Dimensions");
      } else {
        if (!Array.isArray(defaultValue)) buildFail(`${key}.defaultValue`, "Dimensions");
        const defaults = new Set();
        for (let valueIndex = 0; valueIndex < defaultValue.length; valueIndex++) {
          const value = defaultValue[valueIndex];
          if (typeof value !== "string" || defaults.has(value) || !values.has(value)) {
            buildFail(`${key}.defaultValue[${valueIndex}]`, "Dimensions");
          }
          defaults.add(value);
        }
      }
    }
  }
  return data;
}

const BUILD_DATASET_ID = /^sha256:[0-9a-f]{64}$/;
const BUILD_SHA256 = /^[0-9a-f]{64}$/;
const BUILD_SOURCE_COMMIT = /^[0-9a-f]{40}$/;
const isBuildFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isBuildNonEmptyString = (value) => (
  typeof value === "string" && value.trim().length > 0
);
const isBuildSafeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const isBuildArtifactRecord = (value) => (
  isBuildRecord(value)
  && !Object.keys(value).some((key) => BUILD_DANGEROUS_KEYS.has(key))
);
const requireBuildSchema = (condition, kind) => {
  if (!condition) buildFail("schema", kind);
};

const validateBuildUniqueStrings = (values, { nonEmpty = false } = {}) => {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) return false;
  const seen = new Set();
  for (const value of values) {
    if (!isBuildNonEmptyString(value) || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
};

const validateBuildDistribution = (values, expectedLength) => {
  if (!Array.isArray(values) || values.length !== expectedLength || values.length === 0) {
    return false;
  }
  let mass = 0;
  for (const value of values) {
    if (!isBuildFiniteNumber(value) || value < 0) return false;
    mass += value;
  }
  return Number.isFinite(mass) && mass > 0;
};

function validateBuildCoreInternal(core) {
  requireBuildSchema(isBuildArtifactRecord(core), "Core");
  requireBuildSchema(core.formatVersion === 1, "Core");
  requireBuildSchema(typeof core.datasetId === "string"
    && BUILD_DATASET_ID.test(core.datasetId), "Core");
  requireBuildSchema(Array.isArray(core.nodes) && core.nodes.length > 0, "Core");
  requireBuildSchema(Array.isArray(core.edges), "Core");
  requireBuildSchema(Array.isArray(core.topologicalOrder), "Core");

  const nodes = new Map();
  for (const node of core.nodes) {
    requireBuildSchema(isBuildArtifactRecord(node), "Core");
    requireBuildSchema(isBuildNonEmptyString(node.id) && !nodes.has(node.id), "Core");
    requireBuildSchema(typeof node.label === "string", "Core");
    requireBuildSchema(typeof node.category === "string", "Core");
    requireBuildSchema(typeof node.description === "string", "Core");
    requireBuildSchema(typeof node.emit === "boolean", "Core");
    requireBuildSchema(validateBuildUniqueStrings(node.values, { nonEmpty: true }), "Core");
    requireBuildSchema(validateBuildDistribution(node.prior, node.values.length), "Core");
    requireBuildSchema(validateBuildUniqueStrings(node.parents), "Core");
    nodes.set(node.id, node);
  }

  requireBuildSchema(core.topologicalOrder.length === nodes.size, "Core");
  requireBuildSchema(validateBuildUniqueStrings(core.topologicalOrder), "Core");
  for (const id of core.topologicalOrder) requireBuildSchema(nodes.has(id), "Core");
  for (const node of core.nodes) {
    for (const parent of node.parents) requireBuildSchema(nodes.has(parent), "Core");
  }
  for (const edge of core.edges) {
    requireBuildSchema(isBuildArtifactRecord(edge), "Core");
    requireBuildSchema(isBuildNonEmptyString(edge.source) && nodes.has(edge.source), "Core");
    requireBuildSchema(isBuildNonEmptyString(edge.target) && nodes.has(edge.target), "Core");
    requireBuildSchema(isBuildFiniteNumber(edge.weight) && edge.weight >= 0, "Core");
    requireBuildSchema(typeof edge.relation === "string", "Core");
  }
  return core;
}

export function validateBuildCore(core) {
  return validateBuildCoreInternal(core);
}

const validateBuildMask = (mask, nodes) => {
  requireBuildSchema(isBuildArtifactRecord(mask), "Pack");
  requireBuildSchema(isBuildNonEmptyString(mask.target) && nodes.has(mask.target), "Pack");

  requireBuildSchema(isBuildArtifactRecord(mask.condition), "Pack");
  requireBuildSchema(Object.keys(mask.condition).length > 0, "Pack");
  for (const [parent, values] of Object.entries(mask.condition)) {
    requireBuildSchema(isBuildNonEmptyString(parent) && nodes.has(parent), "Pack");
    requireBuildSchema(validateBuildUniqueStrings(values), "Pack");
    requireBuildSchema(values.length > 0, "Pack");
  }

  requireBuildSchema(validateBuildUniqueStrings(mask.bad_values), "Pack");
  requireBuildSchema(validateBuildUniqueStrings(mask.preferred_values), "Pack");
  requireBuildSchema(isBuildArtifactRecord(mask.downweight_values), "Pack");
  for (const [value, multiplier] of Object.entries(mask.downweight_values)) {
    requireBuildSchema(isBuildNonEmptyString(value), "Pack");
    requireBuildSchema(isBuildFiniteNumber(multiplier) && multiplier >= 0, "Pack");
  }
  requireBuildSchema(isBuildFiniteNumber(mask.bad_value_multiplier)
    && mask.bad_value_multiplier >= 0, "Pack");
  requireBuildSchema(isBuildFiniteNumber(mask.outside_preferred_multiplier)
    && mask.outside_preferred_multiplier >= 0, "Pack");
  requireBuildSchema(typeof mask.penalize_values_outside_preferred_set === "boolean", "Pack");

  if (buildHasOwn(mask, "source")) {
    requireBuildSchema(isBuildNonEmptyString(mask.source) && nodes.has(mask.source), "Pack");
  }
  if (buildHasOwn(mask, "parent")) {
    requireBuildSchema(isBuildNonEmptyString(mask.parent) && nodes.has(mask.parent), "Pack");
  }
  if (buildHasOwn(mask, "parents")) {
    requireBuildSchema(validateBuildUniqueStrings(mask.parents), "Pack");
    for (const parent of mask.parents) requireBuildSchema(nodes.has(parent), "Pack");
  }
};

export function validateBuildPack(pack, core) {
  validateBuildCoreInternal(core);
  requireBuildSchema(isBuildArtifactRecord(pack), "Pack");
  requireBuildSchema(pack.formatVersion === 1, "Pack");
  requireBuildSchema(typeof pack.datasetId === "string"
    && BUILD_DATASET_ID.test(pack.datasetId)
    && pack.datasetId === core.datasetId, "Pack");
  requireBuildSchema(Array.isArray(pack.edges), "Pack");
  requireBuildSchema(Array.isArray(pack.cpts), "Pack");
  requireBuildSchema(Array.isArray(pack.masks), "Pack");

  const nodes = new Map(core.nodes.map((node) => [node.id, node]));
  for (const edge of pack.edges) {
    requireBuildSchema(isBuildArtifactRecord(edge), "Pack");
    requireBuildSchema(isBuildNonEmptyString(edge.source) && nodes.has(edge.source), "Pack");
    requireBuildSchema(isBuildNonEmptyString(edge.target) && nodes.has(edge.target), "Pack");
    requireBuildSchema(isBuildFiniteNumber(edge.weight) && edge.weight >= 0, "Pack");
    requireBuildSchema(Array.isArray(edge.matrix)
      && edge.matrix.length === nodes.get(edge.source).values.length, "Pack");
    for (const row of edge.matrix) {
      requireBuildSchema(
        validateBuildDistribution(row, nodes.get(edge.target).values.length),
        "Pack",
      );
    }
  }

  for (const cpt of pack.cpts) {
    requireBuildSchema(isBuildArtifactRecord(cpt), "Pack");
    requireBuildSchema(isBuildNonEmptyString(cpt.target) && nodes.has(cpt.target), "Pack");
    requireBuildSchema(validateBuildUniqueStrings(cpt.parents), "Pack");
    requireBuildSchema(isBuildFiniteNumber(cpt.weight) && cpt.weight >= 0, "Pack");
    requireBuildSchema(typeof cpt.replace === "boolean", "Pack");
    requireBuildSchema(Array.isArray(cpt.rows), "Pack");

    let combinations = 1;
    for (const parent of cpt.parents) {
      requireBuildSchema(nodes.has(parent), "Pack");
      combinations *= nodes.get(parent).values.length;
      requireBuildSchema(Number.isSafeInteger(combinations), "Pack");
    }
    for (const row of cpt.rows) {
      requireBuildSchema(Array.isArray(row) && row.length === 2, "Pack");
      requireBuildSchema(isBuildSafeInteger(row[0]) && row[0] < combinations, "Pack");
      requireBuildSchema(
        validateBuildDistribution(row[1], nodes.get(cpt.target).values.length),
        "Pack",
      );
    }
  }

  for (const mask of pack.masks) validateBuildMask(mask, nodes);
  return pack;
}

export function buildGraphCore(graph, datasetId) {
  const p9 = prec(9);
  return {
    formatVersion: 1,
    datasetId,
    topologicalOrder: graph.proposal_view?.topological_order ?? graph.nodes.map((n) => n.id),
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label ?? n.id,
      category: n.category ?? "Uncategorized",
      description: n.description ?? "",
      values: n.values ?? [],
      prior: alignBuildDist(n.prior ?? {}, n.values ?? []).map(p9),
      emit: n.emit !== false,
      parents: n.parents ?? [],
    })),
    edges: graph.directed_proposal_edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      weight: Number(edge.edge_weight ?? 1),
      relation: edge.relation ?? "",
    })),
  };
}

export function buildSamplerPack(graph, datasetId) {
  const p6 = prec(6);
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const valuesOf = (nodeId) => nodes.get(nodeId)?.values ?? [];
  const priorOf = new Map(graph.nodes.map((node) => [
    node.id,
    alignBuildDist(node.prior ?? {}, node.values ?? []),
  ]));

  const edges = [];
  for (const edge of graph.directed_proposal_edges ?? []) {
    const { source, target } = edge;
    if (!nodes.has(source) || !nodes.has(target)) continue;
    const cpd = edge.cpd ?? {};
    if (cpd.type !== "pairwise_conditional_matrix") continue;
    const rows = new Map();
    (cpd.source_values ?? []).forEach((sourceValue, index) => {
      const raw = (cpd.P_target_given_source ?? [])[index];
      if (raw !== undefined) {
        rows.set(sourceValue, alignBuildDist(raw, valuesOf(target), cpd.target_values ?? null));
      }
    });
    edges.push({
      source,
      target,
      weight: Number(edge.edge_weight ?? 1),
      matrix: valuesOf(source).map((sourceValue) => (
        rows.get(sourceValue) ?? priorOf.get(target)
      ).map(p6)),
    });
  }

  const cpts = [];
  for (const cpt of graph.full_cpts ?? []) {
    const target = cpt.target;
    if (!nodes.has(target)) continue;
    const parents = (cpt.parents ?? []).filter((parent) => nodes.has(parent));
    const multipliers = [];
    let multiplier = 1;
    for (const parent of parents) {
      multipliers.push(multiplier);
      multiplier *= valuesOf(parent).length;
    }
    const valueIndexes = new Map(parents.map((parent) => [
      parent,
      new Map(valuesOf(parent).map((value, index) => [value, index])),
    ]));
    const rowsByCode = new Map();
    for (const row of cpt.rows ?? []) {
      const assignment = row.parent_assignment ?? {};
      let code = 0;
      let valid = true;
      parents.forEach((parent, index) => {
        const valueIndex = valueIndexes.get(parent).get(assignment[parent]);
        if (valueIndex === undefined) valid = false;
        else code += valueIndex * multipliers[index];
      });
      if (!valid) continue;
      rowsByCode.set(
        code,
        alignBuildDist(row.distribution ?? {}, valuesOf(target)).map(p6),
      );
    }
    cpts.push({
      target,
      parents,
      weight: Number(cpt.cpt_weight ?? 1),
      replace: Boolean(cpt.replace_pairwise_parent_edges),
      rows: [...rowsByCode],
    });
  }

  const masks = (graph.conditional_masks ?? []).filter((mask) => nodes.has(mask.target));
  return { formatVersion: 1, datasetId, edges, cpts, masks };
}

export function buildManifest({
  releaseId,
  sourceCommit,
  fullDagSha256,
  coreBytes,
  generatorSha256,
  packBytes = null,
  dimensionsBytes = null,
}) {
  const artifact = (path, bytes) => ({
    path,
    sha256: sha256Hex(bytes),
    bytes: bytes.byteLength,
  });
  return {
    formatVersion: 1,
    releaseId,
    datasetId: `sha256:${fullDagSha256}`,
    source: {
      repo: "MatrAIx-ai/MatrAIx",
      commit: sourceCommit,
      fullDagSha256,
    },
    generator: {
      path: `scripts/build-synthesis-data.${generatorSha256}.mjs`,
      sha256: generatorSha256,
      node: process.versions.node,
    },
    artifacts: {
      core: artifact("synthesis/data/graph-core.v1.json", coreBytes),
      ...(packBytes ? { pack: artifact("synthesis/data/sampler-pack.v2.json", packBytes) } : {}),
      ...(dimensionsBytes ? {
        dimensions: artifact("synthesis/data/dimensions.109d203ae177b62e.json", dimensionsBytes),
      } : {}),
    },
  };
}

class BuildManifestError extends TypeError {
  constructor(key) {
    super("Manifest artifact binding is invalid.");
    this.name = "BuildManifestError";
    this.code = "manifest";
    this.key = key;
  }
}

const requireBuildManifest = (condition, key) => {
  if (!condition) throw new BuildManifestError(key);
};

export function validateBuildManifest(manifest, {
  releaseId,
  sourceCommit,
  fullDagSha256,
  generatorBytes,
  coreBytes,
  packBytes = null,
  dimensionsBytes = null,
}) {
  requireBuildManifest(isBuildArtifactRecord(manifest), "manifest");
  requireBuildManifest(manifest.formatVersion === 1, "formatVersion");
  requireBuildManifest(releaseId === "v1" || releaseId === "v2", "releaseId");
  requireBuildManifest(typeof sourceCommit === "string"
    && BUILD_SOURCE_COMMIT.test(sourceCommit), "source.commit");
  requireBuildManifest(typeof fullDagSha256 === "string"
    && BUILD_SHA256.test(fullDagSha256), "source.fullDagSha256");
  requireBuildManifest(manifest.releaseId === releaseId, "releaseId");
  const datasetId = `sha256:${fullDagSha256}`;
  requireBuildManifest(manifest.datasetId === datasetId, "datasetId");

  requireBuildManifest(isBuildArtifactRecord(manifest.source), "source");
  requireBuildManifest(manifest.source.repo === "MatrAIx-ai/MatrAIx", "source.repo");
  requireBuildManifest(manifest.source.commit === sourceCommit, "source.commit");
  requireBuildManifest(manifest.source.fullDagSha256 === fullDagSha256,
    "source.fullDagSha256");

  const generatorSha256 = sha256Hex(generatorBytes);
  requireBuildManifest(isBuildArtifactRecord(manifest.generator), "generator");
  requireBuildManifest(
    manifest.generator.path === `scripts/build-synthesis-data.${generatorSha256}.mjs`,
    "generator.path",
  );
  requireBuildManifest(manifest.generator.sha256 === generatorSha256, "generator.sha256");
  requireBuildManifest(manifest.generator.node === process.versions.node, "generator.node");

  requireBuildManifest(isBuildArtifactRecord(manifest.artifacts), "artifacts");
  const expected = [
    ["core", "synthesis/data/graph-core.v1.json", coreBytes],
  ];
  if (releaseId === "v2") {
    requireBuildManifest(packBytes !== null, "artifacts.pack");
    requireBuildManifest(dimensionsBytes !== null, "artifacts.dimensions");
    requireBuildManifest(dimensionsBytes.byteLength === DIMENSIONS_BYTES,
      "artifacts.dimensions.bytes");
    requireBuildManifest(sha256Hex(dimensionsBytes) === DIMENSIONS_SHA256,
      "artifacts.dimensions.sha256");
    expected.push(
      ["pack", "synthesis/data/sampler-pack.v2.json", packBytes],
      ["dimensions", "synthesis/data/dimensions.109d203ae177b62e.json", dimensionsBytes],
    );
  } else {
    requireBuildManifest(packBytes === null && dimensionsBytes === null, "artifacts");
  }
  requireBuildManifest(Object.keys(manifest.artifacts).length === expected.length,
    "artifacts");

  for (const [key, path, bytes] of expected) {
    const descriptor = manifest.artifacts[key];
    requireBuildManifest(isBuildArtifactRecord(descriptor), `artifacts.${key}`);
    requireBuildManifest(Object.keys(descriptor).length === 3,
      `artifacts.${key}`);
    requireBuildManifest(descriptor.path === path, `artifacts.${key}.path`);
    requireBuildManifest(descriptor.sha256 === sha256Hex(bytes),
      `artifacts.${key}.sha256`);
    requireBuildManifest(descriptor.bytes === bytes.byteLength && descriptor.bytes > 0,
      `artifacts.${key}.bytes`);
  }

  const core = parseBuildJson(coreBytes, "graph-core.v1.json");
  validateBuildCore(core);
  requireBuildManifest(core.datasetId === datasetId, "artifacts.core.datasetId");
  if (releaseId === "v2") {
    const pack = parseBuildJson(packBytes, "sampler-pack.v2.json");
    validateBuildPack(pack, core);
    requireBuildManifest(pack.datasetId === datasetId, "artifacts.pack.datasetId");
    validateBuildDimensions(parseBuildJson(
      dimensionsBytes,
      "dimensions.109d203ae177b62e.json",
    ));
  }
  return manifest;
}

function parseArgs(argv) {
  const args = {
    graph: null,
    sourceCommit: null,
    dimensions: null,
    outDir: resolve(REPO_ROOT, "synthesis/data"),
    phase: 1,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--graph") args.graph = resolve(argv[++i]);
    else if (argv[i] === "--source-commit") args.sourceCommit = argv[++i];
    else if (argv[i] === "--dimensions") args.dimensions = resolve(argv[++i]);
    else if (argv[i] === "--out-dir") args.outDir = resolve(argv[++i]);
    else if (argv[i] === "--phase") args.phase = Number(argv[++i]);
    else throw new Error(`unknown arg: ${argv[i]}`);
  }
  if (!args.graph || !args.sourceCommit) throw new Error("--graph and --source-commit are required");
  if (args.sourceCommit !== SOURCE_COMMIT) throw new Error("unexpected source commit");
  if (process.versions.node !== "18.19.1") {
    throw new Error("artifact generation requires Node 18.19.1");
  }
  if (!Number.isInteger(args.phase) || ![1, 2].includes(args.phase)) {
    throw new Error("--phase must be exactly 1 or 2");
  }
  if (args.phase === 2 && !args.dimensions) throw new Error("--dimensions is required for phase 2");
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv);
  const graphBytes = readFileSync(args.graph);
  const fullDagSha256 = sha256Hex(graphBytes);
  if (fullDagSha256 !== FULL_DAG_SHA256) throw new Error("full_dag.json SHA-256 mismatch");

  const datasetId = `sha256:${fullDagSha256}`;
  const graph = parseBuildJson(graphBytes, "full_dag.json");
  const generatorBytes = readFileSync(SCRIPT_PATH);
  const generatorSha256 = sha256Hex(generatorBytes);
  let dimensions = null;
  let dimensionsBytes = null;
  if (args.phase === 2) {
    dimensionsBytes = readFileSync(args.dimensions);
    if (dimensionsBytes.byteLength !== DIMENSIONS_BYTES) {
      throw new Error("dimensions bytes mismatch");
    }
    if (sha256Hex(dimensionsBytes) !== DIMENSIONS_SHA256) {
      throw new Error("dimensions SHA-256 mismatch");
    }
    dimensions = parseBuildJson(dimensionsBytes, "dimensions.json");
  }
  const core = buildGraphCore(graph, datasetId);
  const coreBytes = Buffer.from(JSON.stringify(core));
  const pack = args.phase === 2 ? buildSamplerPack(graph, datasetId) : null;
  const packBytes = pack === null ? null : Buffer.from(JSON.stringify(pack));
  const releaseId = args.phase === 1 ? "v1" : "v2";

  validateBuildCore(core);
  if (args.phase === 2) {
    validateBuildPack(pack, core);
    validateBuildDimensions(dimensions);
  }
  const manifest = buildManifest({
    releaseId,
    sourceCommit: args.sourceCommit,
    fullDagSha256,
    coreBytes,
    generatorSha256,
    packBytes,
    dimensionsBytes,
  });
  validateBuildManifest(manifest, {
    releaseId,
    sourceCommit: args.sourceCommit,
    fullDagSha256,
    generatorBytes,
    coreBytes,
    packBytes,
    dimensionsBytes,
  });
  const manifestBytes = Buffer.from(JSON.stringify(manifest));

  const writes = [
    [resolve(args.outDir, "graph-core.v1.json"), coreBytes],
    [resolve(dirname(SCRIPT_PATH), `build-synthesis-data.${generatorSha256}.mjs`),
      generatorBytes],
  ];
  if (args.phase === 2) {
    writes.push(
      [resolve(args.outDir, "sampler-pack.v2.json"), packBytes],
      [resolve(args.outDir, "dimensions.109d203ae177b62e.json"), dimensionsBytes],
      [resolve(args.outDir, "manifest.v2.json"), manifestBytes],
    );
  } else {
    writes.push([resolve(args.outDir, "manifest.v1.json"), manifestBytes]);
  }

  for (const [path, bytes] of writes) assertImmutableCompatible(path, bytes);
  mkdirSync(args.outDir, { recursive: true });
  for (const [path, bytes] of writes) writeImmutable(path, bytes);

  console.log(`graph-core.v1.json: ${core.nodes.length} nodes, ${core.edges.length} edges`);
  if (pack !== null) {
    console.log(`sampler-pack.v2.json: ${pack.edges.length} edges, `
      + `${pack.cpts.length} CPTs, ${pack.masks.length} masks`);
  }
}
