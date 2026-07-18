import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  alignBuildDist,
  buildGraphCore,
  buildManifest,
  buildSamplerPack,
  parseBuildJson,
  sha256Hex,
  validateBuildCore,
  validateBuildManifest,
  validateBuildPack,
} from "../scripts/build-synthesis-data.mjs";
import {
  validateCore,
  validatePack,
} from "../synthesis/data-loader.js";
import { alignDist } from "../synthesis/dist-utils.js";
import { assertDeepClose } from "./helpers.mjs";

const graph = JSON.parse(readFileSync(new URL("./fixtures/mini_dag.json", import.meta.url)));
const datasetId = "sha256:" + "a".repeat(64);

test("pack edges: aligned matrix rows in canonical source order", () => {
  const pack = buildSamplerPack(graph, datasetId);
  assert.equal(pack.formatVersion, 1);
  assert.equal(pack.datasetId, datasetId);
  assert.equal(pack.edges.length, 4);
  const ac = pack.edges.find((edge) => edge.source === "a" && edge.target === "c");
  assertDeepClose(ac.matrix[0], [0.7, 0.3], { atol: 1e-6 });
  assertDeepClose(ac.matrix[1], [0.25, 0.75], { atol: 1e-6 });
});

test("pack cpts: codes computed over canonical value orders, bogus rows dropped", () => {
  const pack = buildSamplerPack(graph, datasetId);
  assert.equal(pack.cpts.length, 1);
  const cpt = pack.cpts[0];
  assert.deepEqual(cpt.parents, ["c", "h"]);
  assert.deepEqual(cpt.rows.map(([code]) => code).sort(), [0, 3]);
  assertDeepClose(cpt.rows.find(([code]) => code === 3)[1], [0.1, 0.3, 0.6], {
    atol: 1e-6,
  });
});

test("pack masks passed through", () => {
  const pack = buildSamplerPack(graph, datasetId);
  assert.equal(pack.masks.length, 1);
  assert.equal(pack.masks[0].target, "e");
});

test("pack cpts use last row for duplicate canonical codes", () => {
  const duplicate = structuredClone(graph);
  duplicate.full_cpts[0].rows.push({
    parent_assignment: { c: "c0", h: "h0" },
    distribution: { d0: 0, d1: 0, d2: 1 },
  });

  const rows = buildSamplerPack(duplicate, datasetId).cpts[0].rows;
  assert.deepEqual(rows.map(([code]) => code), [0, 3]);
  assertDeepClose(rows[0][1], [0, 0, 1], { atol: 1e-6 });
});

test("pack masks preserve unknown bad/preferred aliases", () => {
  const aliases = structuredClone(graph);
  aliases.conditional_masks[0].bad_values.push("legacy-bad-alias");
  aliases.conditional_masks[0].preferred_values.push("legacy-preferred-alias");

  const [mask] = buildSamplerPack(aliases, datasetId).masks;
  assert.ok(mask.bad_values.includes("legacy-bad-alias"));
  assert.ok(mask.preferred_values.includes("legacy-preferred-alias"));
});

test("build-time align copy matches the browser port over a seeded random corpus", () => {
  let state = 0x5eed1234;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const sample = (items) => items[Math.floor(random() * items.length)];
  const dirtyNumbers = [
    -Infinity,
    -3,
    -0,
    0,
    0.25,
    7,
    Number.MAX_VALUE,
    Infinity,
    NaN,
    "2",
    "invalid",
    null,
  ];

  for (let iteration = 0; iteration < 512; iteration++) {
    const valueCount = 1 + Math.floor(random() * 7);
    const values = Array.from({ length: valueCount }, (_, index) => `v${index}`);
    let dist;
    let sourceValues = null;
    if (random() < 0.45) {
      dist = {};
      for (const value of values) {
        if (random() < 0.75) dist[value] = sample(dirtyNumbers);
      }
      if (random() < 0.3) dist.extra = sample(dirtyNumbers);
    } else {
      const rawCount = Math.floor(random() * 9);
      dist = Array.from({ length: rawCount }, () => sample(dirtyNumbers));
      if (random() < 0.6) {
        sourceValues = Array.from({ length: rawCount }, () => sample(values));
      }
    }
    assertDeepClose(
      alignBuildDist(dist, values, sourceValues),
      alignDist(dist, values, sourceValues),
      { path: `iteration[${iteration}]` },
    );
  }

  assertDeepClose(alignBuildDist([1], ["v0"], []), alignDist([1], ["v0"], []));
});

const moduleSpecifiers = (source) => {
  const staticImport = /\bimport\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  const reExport = /\bexport\s+[^"'`;]*?\s+from\s+["']([^"']+)["']/g;
  const dynamicImport = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const dynamicTokens = [...source.matchAll(/\bimport\s*\(/g)];
  const dynamic = [...source.matchAll(dynamicImport)];
  assert.equal(dynamic.length, dynamicTokens.length, "non-literal dynamic import must be rejected");
  return [staticImport, reExport].flatMap((pattern) => (
    [...source.matchAll(pattern)].map((match) => match[1])
  )).concat(dynamic.map((match) => match[1]));
};

test("phase-2 generator remains self-contained apart from node built-ins", () => {
  const source = readFileSync(new URL("../scripts/build-synthesis-data.mjs", import.meta.url), "utf8");
  const specifiers = moduleSpecifiers(source);
  assert.ok(specifiers.length > 0);
  assert.ok(specifiers.every((specifier) => specifier.startsWith("node:")), specifiers.join(", "));
});

const workflowSource = readFileSync(
  new URL("../.github/workflows/synthesis-studio.yml", import.meta.url),
  "utf8",
);

const workflowStep = (name) => {
  const marker = `      - name: ${name}`;
  const start = workflowSource.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = workflowSource.indexOf("\n      - name:", start + marker.length);
  return workflowSource.slice(start, next === -1 ? workflowSource.length : next);
};

const assertFragmentsInOrder = (source, fragments) => {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    assert.ok(next > cursor, `missing or out-of-order workflow fragment: ${fragment}`);
    cursor = next;
  }
};

test("reproducibility workflow pins the artifact toolchain and detached source", () => {
  assert.match(
    workflowSource,
    /MATRAIX_SOURCE_COMMIT: 4dfa4e066b706c6a2d33a10fd41b976efd3f524e/,
  );
  assert.match(
    workflowStep("Set up artifact-generation Node"),
    /uses: actions\/setup-node@v6[\s\S]*node-version: 18\.19\.1/,
  );
  assert.match(
    workflowStep("Set up artifact-generation Python"),
    /uses: actions\/setup-python@v6[\s\S]*python-version: 3\.12\.3/,
  );
  assert.match(
    workflowStep("Install artifact-generation Python dependencies"),
    /python -m pip install[^\n]*\bnumpy==2\.5\.1\b/,
  );

  const checkout = workflowStep("Check out pinned MatrAIx source");
  assert.match(checkout, /ref: 4dfa4e066b706c6a2d33a10fd41b976efd3f524e/);
  const verify = workflowStep("Verify pinned source checkout");
  assert.match(verify, /actual_commit=.*rev-parse HEAD/);
  assert.match(verify, /\[\[ "\$actual_commit" != "\$MATRAIX_SOURCE_COMMIT" \]\]/);
  assert.match(verify, /symbolic-ref --quiet HEAD/);
});

test("reproducibility workflow rebuilds both phases from manifest-pinned snapshots", () => {
  const step = workflowStep("Rebuild and verify phase 1 and phase 2 artifacts");
  const v2Start = step.indexOf('V2_GENERATOR="$(node -e');
  assert.ok(v2Start > 0, "missing V2 generator manifest lookup");
  const v1 = step.slice(0, v2Start);
  const v2 = step.slice(v2Start);

  for (const [phase, source] of [[1, v1], [2, v2]]) {
    const prefix = `V${phase}`;
    assert.match(source, new RegExp(`manifest\\.v${phase}\\.json`));
    assert.match(source, /process\.stdout\.write\(m\.generator\.path\)/);
    assert.match(source, /process\.stdout\.write\(m\.generator\.sha256\)/);
    assert.ok(source.includes(
      `[[ "$${prefix}_GENERATOR" =~ ^scripts/build-synthesis-data\\.[0-9a-f]{64}\\.mjs$ ]]`,
    ));
    assert.ok(source.includes(`[[ "$${prefix}_GENERATOR_SHA256" =~ ^[0-9a-f]{64}$ ]]`));
    assert.ok(source.includes(
      `[[ "$${prefix}_GENERATOR" == "scripts/build-synthesis-data.\${${prefix}_GENERATOR_SHA256}.mjs" ]]`,
    ));
    assert.ok(source.includes(
      `printf '%s  %s\\n' "$${prefix}_GENERATOR_SHA256" "$${prefix}_GENERATOR" | sha256sum -c -`,
    ));
    assert.ok(source.includes(`node "$${prefix}_GENERATOR"`));
    assert.ok(source.includes(`--phase ${phase}`));
  }

  assert.ok(v2.includes("--dimensions dimensions.json"));
  assert.doesNotMatch(step, /\bscripts\/build-synthesis-data\.mjs\b/);
});

test("reproducibility workflow regenerates goldens, tests, then checks the full diff", () => {
  const step = workflowStep("Rebuild and verify phase 1 and phase 2 artifacts");
  assertFragmentsInOrder(step, [
    'node "$V1_GENERATOR"',
    'node "$V2_GENERATOR"',
    "python scripts/generate-synthesis-goldens-p1.py",
    "python scripts/generate-synthesis-goldens-p2.py",
    "node --test tests/",
    "git diff --exit-code -- synthesis/data tests/fixtures",
  ]);
});

const validationOutcome = (validator, ...args) => {
  try {
    validator(...args);
    return { accepted: true };
  } catch (error) {
    return { accepted: false, code: error?.code };
  }
};

const assertValidatorParity = (buildValidator, browserValidator, args, accepted, name) => {
  const build = validationOutcome(buildValidator, ...args);
  const browser = validationOutcome(browserValidator, ...args);
  assert.deepEqual(build, browser, `${name}: build/browser outcome`);
  assert.equal(browser.accepted, accepted, `${name}: acceptance`);
  if (!accepted) assert.equal(browser.code, "schema", `${name}: error code`);
};

test("build-time core validator differentially matches the browser boundary", () => {
  const core = buildGraphCore(graph, datasetId);
  assertValidatorParity(validateBuildCore, validateCore, [core], true, "valid core");

  const dangerous = structuredClone(core);
  Object.defineProperty(dangerous.nodes[0], "__proto__", { enumerable: true, value: {} });
  const inherited = Object.assign(Object.create({ polluted: true }), structuredClone(core));
  const invalid = [
    [[], "top array"],
    [{ ...structuredClone(core), datasetId: [datasetId] }, "coerced dataset"],
    [{ ...structuredClone(core), nodes: [] }, "empty nodes"],
    [{ ...structuredClone(core), topologicalOrder: core.topologicalOrder.slice(1) },
      "topology coverage"],
    [dangerous, "dangerous node key"],
    [inherited, "inherited top prototype"],
  ];

  const emptyValues = structuredClone(core);
  emptyValues.nodes[0].values = [];
  invalid.push([emptyValues, "empty values"]);
  const duplicateValues = structuredClone(core);
  duplicateValues.nodes[0].values = ["a0", "a0"];
  invalid.push([duplicateValues, "duplicate values"]);
  const nonfinitePrior = structuredClone(core);
  nonfinitePrior.nodes[0].prior[0] = Infinity;
  invalid.push([nonfinitePrior, "non-finite prior"]);
  const zeroPrior = structuredClone(core);
  zeroPrior.nodes[0].prior = zeroPrior.nodes[0].prior.map(() => 0);
  invalid.push([zeroPrior, "zero prior mass"]);
  const unknownParent = structuredClone(core);
  unknownParent.nodes[0].parents = ["ghost"];
  invalid.push([unknownParent, "unknown parent"]);
  const unknownEndpoint = structuredClone(core);
  unknownEndpoint.edges[0].target = "ghost";
  invalid.push([unknownEndpoint, "unknown endpoint"]);
  const nonfiniteWeight = structuredClone(core);
  nonfiniteWeight.edges[0].weight = NaN;
  invalid.push([nonfiniteWeight, "non-finite edge weight"]);

  invalid.forEach(([value, name]) => (
    assertValidatorParity(validateBuildCore, validateCore, [value], false, name)
  ));
});

test("build-time pack validator differentially matches the browser boundary", () => {
  const core = buildGraphCore(graph, datasetId);
  const pack = buildSamplerPack(graph, datasetId);
  assertValidatorParity(validateBuildPack, validatePack, [pack, core], true, "valid pack");

  const aliasPack = structuredClone(pack);
  aliasPack.masks[0].bad_values.push("legacy-bad-alias");
  aliasPack.masks[0].preferred_values.push("legacy-preferred-alias");
  assertValidatorParity(validateBuildPack, validatePack, [aliasPack, core], true, "mask aliases");

  const dangerous = structuredClone(pack);
  Object.defineProperty(dangerous.edges[0], "constructor", { enumerable: true, value: {} });
  const invalid = [
    [[], "top array"],
    [{ ...structuredClone(pack), datasetId: "sha256:" + "b".repeat(64) }, "dataset mismatch"],
    [dangerous, "dangerous edge key"],
  ];
  const unknownEdge = structuredClone(pack);
  unknownEdge.edges[0].source = "ghost";
  invalid.push([unknownEdge, "unknown edge endpoint"]);
  const matrixRows = structuredClone(pack);
  matrixRows.edges[0].matrix.pop();
  invalid.push([matrixRows, "matrix row count"]);
  const matrixColumns = structuredClone(pack);
  matrixColumns.edges[0].matrix[0].push(0.1);
  invalid.push([matrixColumns, "matrix column count"]);
  const nonfiniteEdge = structuredClone(pack);
  nonfiniteEdge.edges[0].weight = Infinity;
  invalid.push([nonfiniteEdge, "non-finite edge weight"]);
  const unknownCptParent = structuredClone(pack);
  unknownCptParent.cpts[0].parents[0] = "ghost";
  invalid.push([unknownCptParent, "unknown CPT parent"]);
  const unsafeCode = structuredClone(pack);
  unsafeCode.cpts[0].rows[0][0] = Number.MAX_SAFE_INTEGER + 1;
  invalid.push([unsafeCode, "unsafe CPT code"]);
  const nonfiniteCpt = structuredClone(pack);
  nonfiniteCpt.cpts[0].rows[0][1][0] = NaN;
  invalid.push([nonfiniteCpt, "non-finite CPT distribution"]);
  const unknownMaskTarget = structuredClone(pack);
  unknownMaskTarget.masks[0].target = "ghost";
  invalid.push([unknownMaskTarget, "unknown mask target"]);
  const nonfiniteMask = structuredClone(pack);
  nonfiniteMask.masks[0].bad_value_multiplier = -Infinity;
  invalid.push([nonfiniteMask, "non-finite mask multiplier"]);

  invalid.forEach(([value, name]) => (
    assertValidatorParity(validateBuildPack, validatePack, [value, core], false, name)
  ));
});

const sourceCommit = "4dfa4e066b706c6a2d33a10fd41b976efd3f524e";
const lockedDimensionsSha = "109d203ae177b62e872ebc3272d52a7705e02c35575456728f99332f481a4f42";
const lockedDimensionsBytes = 603_975;
const dimensionsBytes = readFileSync(new URL("../dimensions.json", import.meta.url));
const dimensions = JSON.parse(dimensionsBytes.toString("utf8"));

test("build JSON parsing is fatal UTF-8 and distinguishes malformed JSON", () => {
  const invalidUtf8 = Buffer.from([
    0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d,
  ]);
  assert.throws(
    () => parseBuildJson(invalidUtf8, "fixture"),
    (error) => error?.code === "utf8",
  );
  assert.throws(
    () => parseBuildJson(Buffer.from("{"), "fixture"),
    (error) => error?.code === "json",
  );
  assert.deepEqual(parseBuildJson(Buffer.from('{"ok":true}'), "fixture"), { ok: true });
});

test("v2 manifest descriptors are recomputed against the exact in-memory artifacts", () => {
  assert.equal(dimensionsBytes.byteLength, lockedDimensionsBytes);
  assert.equal(sha256Hex(dimensionsBytes), lockedDimensionsSha);

  const core = buildGraphCore(graph, datasetId);
  const pack = buildSamplerPack(graph, datasetId);
  const coreBytes = Buffer.from(JSON.stringify(core));
  const packBytes = Buffer.from(JSON.stringify(pack));
  const generatorBytes = readFileSync(new URL("../scripts/build-synthesis-data.mjs", import.meta.url));
  const generatorSha256 = sha256Hex(generatorBytes);
  const manifest = buildManifest({
    releaseId: "v2",
    sourceCommit,
    fullDagSha256: "a".repeat(64),
    coreBytes,
    generatorSha256,
    packBytes,
    dimensionsBytes,
  });
  const options = {
    releaseId: "v2",
    sourceCommit,
    fullDagSha256: "a".repeat(64),
    generatorBytes,
    core,
    coreBytes,
    pack,
    packBytes,
    dimensions,
    dimensionsBytes,
  };

  assert.equal(validateBuildManifest(manifest, options), manifest);
  assert.deepEqual(Object.keys(manifest.artifacts), ["core", "pack", "dimensions"]);

  const tamper = [
    ["release", (value) => { value.releaseId = "v3"; }],
    ["dataset", (value) => { value.datasetId = "sha256:" + "b".repeat(64); }],
    ["source", (value) => { value.source.fullDagSha256 = "b".repeat(64); }],
    ["generator path", (value) => { value.generator.path = "scripts/build-synthesis-data.mjs"; }],
    ["generator hash", (value) => { value.generator.sha256 = "b".repeat(64); }],
    ["generator node", (value) => { value.generator.node = "20.0.0"; }],
    ["core path", (value) => { value.artifacts.core.path = "synthesis/data/graph-core.v2.json"; }],
    ["core hash", (value) => { value.artifacts.core.sha256 = "b".repeat(64); }],
    ["core bytes", (value) => { value.artifacts.core.bytes += 1; }],
    ["pack path", (value) => { value.artifacts.pack.path = "synthesis/data/sampler-pack.v3.json"; }],
    ["pack hash", (value) => { value.artifacts.pack.sha256 = "b".repeat(64); }],
    ["pack bytes", (value) => { value.artifacts.pack.bytes += 1; }],
    ["dimensions path", (value) => {
      value.artifacts.dimensions.path = "synthesis/data/dimensions.0000000000000000.json";
    }],
    ["dimensions hash", (value) => { value.artifacts.dimensions.sha256 = "b".repeat(64); }],
    ["dimensions bytes", (value) => { value.artifacts.dimensions.bytes += 1; }],
    ["extra artifact", (value) => { value.artifacts.extra = structuredClone(value.artifacts.core); }],
  ];
  for (const [name, mutate] of tamper) {
    const dirty = structuredClone(manifest);
    mutate(dirty);
    assert.throws(
      () => validateBuildManifest(dirty, options),
      (error) => error?.code === "manifest" && typeof error?.key === "string",
      name,
    );
  }

  const malformedCommit = buildManifest({
    releaseId: "v2",
    sourceCommit: "not-a-commit",
    fullDagSha256: "a".repeat(64),
    coreBytes,
    generatorSha256,
    packBytes,
    dimensionsBytes,
  });
  assert.throws(
    () => validateBuildManifest(malformedCommit, {
      ...options,
      sourceCommit: "not-a-commit",
    }),
    (error) => error?.code === "manifest" && error?.key === "source.commit",
  );

  const malformedDagHash = "a".repeat(63);
  const malformedCore = { ...structuredClone(core), datasetId: `sha256:${malformedDagHash}` };
  const malformedPack = { ...structuredClone(pack), datasetId: `sha256:${malformedDagHash}` };
  const malformedCoreBytes = Buffer.from(JSON.stringify(malformedCore));
  const malformedPackBytes = Buffer.from(JSON.stringify(malformedPack));
  const malformedDag = buildManifest({
    releaseId: "v2",
    sourceCommit,
    fullDagSha256: malformedDagHash,
    coreBytes: malformedCoreBytes,
    generatorSha256,
    packBytes: malformedPackBytes,
    dimensionsBytes,
  });
  assert.throws(
    () => validateBuildManifest(malformedDag, {
      ...options,
      fullDagSha256: malformedDagHash,
      coreBytes: malformedCoreBytes,
      packBytes: malformedPackBytes,
    }),
    (error) => error?.code === "manifest" && error?.key === "source.fullDagSha256",
  );
});

test("phase-2 CLI rejects dimensions drift before creating its output directory", () => {
  const root = mkdtempSync(join(tmpdir(), "synthesis-phase2-invalid-"));
  const outDir = join(root, "out");
  const dimensionsPath = join(root, "dimensions.json");
  writeFileSync(dimensionsPath, '{"dimensions":[]}');
  try {
    const result = spawnSync("/usr/bin/node", [
      new URL("../scripts/build-synthesis-data.mjs", import.meta.url).pathname,
      "--graph",
      "/data2/zonglin/MatrAIx-worktrees/synthesis-4dfa4e066b7/persona/synthesis/graph/full_dag.json",
      "--source-commit",
      sourceCommit,
      "--dimensions",
      dimensionsPath,
      "--out-dir",
      outDir,
      "--phase",
      "2",
    ], { encoding: "utf8" });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /dimensions.*(?:SHA-256|bytes).*mismatch/i);
    assert.equal(existsSync(outDir), false, "preflight failure must not create the output dir");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
