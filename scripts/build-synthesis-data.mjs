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

export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

const writeImmutable = (path, bytes) => {
  if (existsSync(path)) {
    if (!readFileSync(path).equals(bytes)) {
      throw new Error(`refusing to overwrite immutable artifact: ${path}`);
    }
    return;
  }
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
  const graph = JSON.parse(graphBytes.toString("utf8"));
  mkdirSync(args.outDir, { recursive: true });

  const core = buildGraphCore(graph, datasetId);
  const coreBytes = Buffer.from(JSON.stringify(core));
  const generatorBytes = readFileSync(SCRIPT_PATH);
  const generatorSha256 = sha256Hex(generatorBytes);

  writeImmutable(
    resolve(dirname(SCRIPT_PATH), `build-synthesis-data.${generatorSha256}.mjs`),
    generatorBytes,
  );
  writeImmutable(resolve(args.outDir, "graph-core.v1.json"), coreBytes);
  console.log(`graph-core.v1.json: ${core.nodes.length} nodes, ${core.edges.length} edges`);

  if (args.phase === 1) {
    const manifest = buildManifest({
      releaseId: "v1",
      sourceCommit: args.sourceCommit,
      fullDagSha256,
      coreBytes,
      generatorSha256,
    });
    writeImmutable(
      resolve(args.outDir, "manifest.v1.json"),
      Buffer.from(JSON.stringify(manifest)),
    );
  } else {
    // Task 10 fills this in (sampler-pack.v2.json + manifest.v2.json).
  }
}
