import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  alignBuildDist,
  buildGraphCore,
  buildManifest,
  normalizeBuildDist,
  sha256Hex,
} from "../scripts/build-synthesis-data.mjs";
import { alignDist, normalizeDist } from "../synthesis/dist-utils.js";
import { assertDeepClose } from "./helpers.mjs";

const graph = JSON.parse(readFileSync(new URL("./fixtures/mini_dag.json", import.meta.url)));
const datasetId = "sha256:" + "a".repeat(64);

test("graph-core: nodes carry aligned priors and emit flags", () => {
  const core = buildGraphCore(graph, datasetId);
  assert.equal(core.formatVersion, 1);
  assert.equal(core.datasetId, datasetId);
  assert.deepEqual(core.topologicalOrder, ["a", "b", "h", "c", "e", "d"]);
  const a = core.nodes.find((n) => n.id === "a");
  assertDeepClose(a.prior, [0.75, 0.25]);
  assert.equal(a.emit, true);
  assert.equal(core.nodes.find((n) => n.id === "h").emit, false);
  assert.deepEqual(Object.keys(a).sort(),
    ["category", "description", "emit", "id", "label", "parents", "prior", "values"]);
});

test("graph-core: edges keep weight/relation, drop cpd", () => {
  const core = buildGraphCore(graph, datasetId);
  assert.equal(core.edges.length, 4);
  const edge = core.edges.find((x) => x.source === "a" && x.target === "c");
  assert.deepEqual(edge, { source: "a", target: "c", weight: 2.0, relation: "drives" });
});

test("manifest binds source, dataset, core bytes and hash", () => {
  const coreBytes = Buffer.from('{"formatVersion":1}');
  const manifest = buildManifest({
    releaseId: "v1",
    sourceCommit: "4dfa4e066b706c6a2d33a10fd41b976efd3f524e",
    fullDagSha256: "a".repeat(64),
    coreBytes,
    generatorSha256: "b".repeat(64),
  });
  assert.equal(manifest.datasetId, datasetId);
  assert.equal(manifest.releaseId, "v1");
  assert.equal(manifest.artifacts.core.path, "synthesis/data/graph-core.v1.json");
  assert.equal(manifest.generator.path,
    `scripts/build-synthesis-data.${"b".repeat(64)}.mjs`);
  assert.equal(manifest.artifacts.core.sha256, sha256Hex(coreBytes));
  assert.equal(manifest.artifacts.core.bytes, coreBytes.byteLength);
  assert.equal(manifest.artifacts.pack, undefined);
});

const moduleSpecifiers = (source) => {
  const staticImport = /\bimport\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  const reExport = /\bexport\s+[^"'`;]*?\s+from\s+["']([^"']+)["']/g;
  const dynamicImport = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const dynamicTokens = [...source.matchAll(/\bimport\s*\(/g)];
  const dynamic = [...source.matchAll(dynamicImport)];
  assert.equal(dynamic.length, dynamicTokens.length, "non-literal dynamic import must be rejected");
  return [staticImport, reExport].flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1]))
    .concat(dynamic.map((match) => match[1]));
};

test("generator is self-contained apart from node built-ins", () => {
  const source = readFileSync(new URL("../scripts/build-synthesis-data.mjs", import.meta.url), "utf8");
  const fixture = `
    import "./side-effect.js";
    import { x } from "node:test";
    export { x } from "./re-export.js";
    export * from "./star-export.js";
    void import("./dynamic.js");`;
  assert.deepEqual(moduleSpecifiers(fixture).sort(),
    ["./dynamic.js", "./re-export.js", "./side-effect.js", "./star-export.js", "node:test"].sort());
  assert.throws(() => moduleSpecifiers("import(specifier)"), /non-literal/);
  const specs = moduleSpecifiers(source);
  assert.ok(specs.length > 0);
  assert.ok(specs.every((spec) => spec.startsWith("node:")), specs.join(", "));
});

test("build-time normalize copy conforms for overflow and invalid values", () => {
  const corpus = [
    [3, 1],
    [0, 0, 0],
    [-1, NaN, 2],
    [Infinity, -Infinity, "2", "invalid"],
    [Number.MAX_VALUE, Number.MAX_VALUE],
    [Number.MAX_VALUE, Number.MAX_VALUE / 2, 1],
    [],
  ];
  for (const input of corpus) {
    assertDeepClose(normalizeBuildDist(input), normalizeDist(input));
  }
});

test("build-time align copy conforms for dict, list, sourceValues, overflow, and invalid values", () => {
  const corpus = [
    [{ b: 1, a: 3 }, ["a", "b"], null],
    [[2, 2], ["x", "y"], null],
    [[0.75, 0.25], ["c0", "c1"], ["c1", "c0"]],
    [[0.9], ["x", "y"], ["y"]],
    [[Number.MAX_VALUE, Number.MAX_VALUE], ["x", "y"], null],
    [{ x: NaN, y: Infinity, z: -1, q: "2" }, ["x", "y", "z", "q"], null],
    [[NaN, Infinity, -1, "2"], ["x", "y", "z", "q"], null],
    [null, ["x", "y"], null],
  ];
  for (const [dist, values, sourceValues] of corpus) {
    assertDeepClose(
      alignBuildDist(dist, values, sourceValues),
      alignDist(dist, values, sourceValues),
    );
  }
});
