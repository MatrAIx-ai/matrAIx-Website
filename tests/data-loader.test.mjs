import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import {
  ArtifactLoadError,
  loadArtifact,
  loadAuxJson,
  loadManifest,
  validateCore,
  validatePack,
} from "../synthesis/data-loader.js";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}

const DATASET_HASH = "a".repeat(64);
const DATASET_ID = `sha256:${DATASET_HASH}`;
const OTHER_DATASET_ID = `sha256:${"e".repeat(64)}`;
const BASE_URL = "https://example.test/";
const MANIFEST_URL = "https://example.test/synthesis/data/manifest.v1.json";
const CORE_PATH = "synthesis/data/graph-core.v1.json";
const PACK_PATH = "synthesis/data/sampler-pack.v2.json";
const DIMENSIONS_PATH = `synthesis/data/dimensions.${"f".repeat(16)}.json`;

const clone = (value) => structuredClone(value);
const encode = (value) => new TextEncoder().encode(
  typeof value === "string" ? value : JSON.stringify(value),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const descriptor = (path, bytes) => ({ path, sha256: sha256(bytes), bytes: bytes.byteLength });

const coreFixture = {
  formatVersion: 1,
  datasetId: DATASET_ID,
  topologicalOrder: ["a", "b", "c"],
  nodes: [
    {
      id: "a", label: "Node <img src=x onerror=alert(1)>", category: "Roots",
      description: "</p><script>alert(2)</script>", values: ["a0", "a1"],
      prior: [0.75, 0.25], emit: true, parents: [],
    },
    {
      id: "b", label: "Node B", category: "Middle", description: "middle",
      values: ["b0", "b1", "b2"], prior: [0.5, 0.3, 0.2], emit: true,
      parents: ["a"],
    },
    {
      id: "c", label: "Node C", category: "Leaves", description: "leaf",
      values: ["c0", "c1"], prior: [0.4, 0.6], emit: false,
      parents: ["a", "b"],
    },
  ],
  edges: [
    { source: "a", target: "b", weight: 1, relation: "drives" },
    { source: "b", target: "c", weight: 0.5, relation: "colors" },
  ],
};

const packFixture = {
  formatVersion: 1,
  datasetId: DATASET_ID,
  edges: [
    {
      source: "a", target: "b", weight: 1,
      matrix: [[0.6, 0.3, 0.1], [0.2, 0.3, 0.5]],
    },
  ],
  cpts: [
    {
      target: "c", parents: ["a", "b"], weight: 1, replace: false,
      rows: [[0, [0.7, 0.3]], [5, [0.1, 0.9]]],
    },
  ],
  masks: [
    {
      mask_id: "mask-1", target: "c", condition: { a: ["a1"] },
      bad_values: ["c0"], bad_value_multiplier: 0.1,
      downweight_values: { c1: 0.5 }, preferred_values: ["c1"],
      penalize_values_outside_preferred_set: true, outside_preferred_multiplier: 0.2,
      constraint_semantics: "test-only",
    },
  ],
};

const dimensionsFixture = {
  dimensions: [{ id: "a", values: ["a0", "a1"] }],
};

const CORE_BYTES = encode(coreFixture);
const PACK_BYTES = encode(packFixture);
const DIMENSIONS_BYTES = encode(dimensionsFixture);

function manifestWithBytes({
  coreBytes = CORE_BYTES,
  packBytes = PACK_BYTES,
  dimensionsBytes = DIMENSIONS_BYTES,
  includePack = true,
  includeDimensions = true,
  releaseId = "v2",
} = {}) {
  return {
    formatVersion: 1,
    releaseId,
    datasetId: DATASET_ID,
    source: {
      repo: "MatrAIx-ai/MatrAIx",
      commit: "b".repeat(40),
      fullDagSha256: DATASET_HASH,
    },
    generator: {
      path: `scripts/build-synthesis-data.${"c".repeat(64)}.mjs`,
      sha256: "c".repeat(64),
      node: "18.19.1",
    },
    artifacts: {
      core: descriptor(CORE_PATH, coreBytes),
      ...(includePack ? { pack: descriptor(PACK_PATH, packBytes) } : {}),
      ...(includeDimensions ? {
        dimensions: descriptor(DIMENSIONS_PATH, dimensionsBytes),
      } : {}),
    },
  };
}

async function rejectsWithCode(action, code) {
  let error;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof ArtifactLoadError, `expected ArtifactLoadError, got ${error}`);
  assert.equal(error.code, code);
  return error;
}

function throwsWithCode(action, code) {
  let error;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof ArtifactLoadError, `expected ArtifactLoadError, got ${error}`);
  assert.equal(error.code, code);
  return error;
}

const artifactFetch = (expectedPath, bytes, { status = 200 } = {}) =>
  async (url, init) => {
    const expectedUrl = new URL(expectedPath, BASE_URL).href;
    assert.equal(String(url), expectedUrl);
    assert.equal(new URL(String(url)).search, "");
    assert.equal(new URL(String(url)).hash, "");
    assert.equal(init.cache, "no-store");
    return new Response(bytes, { status });
  };

async function loadInvalidCore(mutator) {
  const value = clone(coreFixture);
  mutator(value);
  const bytes = encode(value);
  const manifest = manifestWithBytes({ coreBytes: bytes });
  return rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl: artifactFetch(CORE_PATH, bytes),
  }), "schema");
}

async function loadInvalidPack(mutator) {
  const value = clone(packFixture);
  mutator(value);
  const bytes = encode(value);
  const manifest = manifestWithBytes({ packBytes: bytes });
  return rejectsWithCode(() => loadArtifact(manifest, "pack", {
    baseUrl: BASE_URL,
    core: coreFixture,
    fetchImpl: artifactFetch(PACK_PATH, bytes),
  }), "schema");
}

const manifestFixture = {
  formatVersion: 1,
  releaseId: "v1",
  datasetId: `sha256:${DATASET_HASH}`,
  source: {
    repo: "MatrAIx-ai/MatrAIx",
    commit: "b".repeat(40),
    fullDagSha256: DATASET_HASH,
  },
  generator: {
    path: `scripts/build-synthesis-data.${"c".repeat(64)}.mjs`,
    sha256: "c".repeat(64),
    node: "18.19.1",
  },
  artifacts: {
    core: {
      path: "synthesis/data/graph-core.v1.json",
      sha256: "d".repeat(64),
      bytes: 42,
    },
  },
};

test("loadManifest fetches and pins a valid release manifest", async () => {
  const manifest = await loadManifest(MANIFEST_URL, {
    expectedReleaseId: "v1",
    fetchImpl: async (url, init) => {
      assert.equal(String(url), MANIFEST_URL);
      assert.equal(init.cache, "no-store");
      return new Response(JSON.stringify(manifestFixture));
    },
  });

  assert.deepEqual(manifest, manifestFixture);
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.artifacts.core));
});

test("loadArtifact fetches the exact immutable core pathname and verifies it", async () => {
  const manifest = manifestWithBytes();
  const core = await loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
  });
  assert.deepEqual(core, coreFixture);
});

test("loadArtifact validates a pack against the exact core", async () => {
  const manifest = manifestWithBytes();
  const pack = await loadArtifact(manifest, "pack", {
    baseUrl: BASE_URL,
    core: coreFixture,
    fetchImpl: artifactFetch(PACK_PATH, PACK_BYTES),
  });
  assert.deepEqual(pack, packFixture);
});

test("loadAuxJson verifies bytes and always runs the caller schema validator", async () => {
  const manifest = manifestWithBytes();
  let validations = 0;
  const dimensions = await loadAuxJson(manifest, "dimensions", {
    baseUrl: BASE_URL,
    fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
    validate(value) {
      validations++;
      assert.deepEqual(value, dimensionsFixture);
    },
  });
  assert.deepEqual(dimensions, dimensionsFixture);
  assert.equal(validations, 1);
  assert.equal(dimensions.formatVersion, undefined);
  assert.equal(dimensions.datasetId, undefined);
});

test("HTTP failures use a safe normalized error", async () => {
  const manifest = manifestWithBytes();
  const error = await rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl: artifactFetch(CORE_PATH, encode("<h1>private upstream body</h1>"), {
      status: 404,
    }),
  }), "http");
  assert.equal(error.message, "Snapshot request failed (404).");
  assert.doesNotMatch(error.message, /private|<h1>/);
});

test("network and body failures are normalized without exposing upstream text", async (t) => {
  await t.test("network", async () => {
    const raw = new Error("https://secret.example/<script>alert(1)</script>");
    const error = await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
      expectedReleaseId: "v1",
      fetchImpl: async () => { throw raw; },
    }), "network");
    assert.equal(error.message, "Snapshot request failed.");
    assert.equal(error.cause, raw);
    assert.doesNotMatch(error.message, /secret|script/);
  });

  await t.test("body", async () => {
    const raw = new Error("raw body reader detail");
    const error = await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
      expectedReleaseId: "v1",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => { throw raw; },
      }),
    }), "body");
    assert.equal(error.message, "Snapshot body could not be read.");
    assert.equal(error.cause, raw);
    assert.doesNotMatch(error.message, /raw body/);
  });
});

test("AbortError is passed through unchanged from fetch and body reads", async (t) => {
  await t.test("fetch", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    await assert.rejects(
      () => loadManifest(MANIFEST_URL, { fetchImpl: async () => { throw abort; } }),
      (error) => error === abort,
    );
  });

  await t.test("body", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    await assert.rejects(
      () => loadManifest(MANIFEST_URL, {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          arrayBuffer: async () => { throw abort; },
        }),
      }),
      (error) => error === abort,
    );
  });
});

test("invalid manifest and artifact JSON use a safe json error", async (t) => {
  await t.test("manifest", async () => {
    const error = await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
      expectedReleaseId: "v1",
      fetchImpl: async () => new Response("{<script>"),
    }), "json");
    assert.equal(error.message, "Manifest is not valid JSON.");
    assert.doesNotMatch(error.message, /script/);
  });

  await t.test("core", async () => {
    const bytes = encode("{not-json");
    const manifest = manifestWithBytes({ coreBytes: bytes });
    const error = await rejectsWithCode(() => loadArtifact(manifest, "core", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(CORE_PATH, bytes),
    }), "json");
    assert.equal(error.message, "core is not valid JSON.");
  });
});

test("manifest and core formatVersion must be exactly 1", async (t) => {
  await t.test("manifest", async () => {
    const value = { ...manifestFixture, formatVersion: "1" };
    await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
      expectedReleaseId: "v1",
      fetchImpl: async () => new Response(JSON.stringify(value)),
    }), "version");
  });

  await t.test("core", async () => {
    const value = { ...coreFixture, formatVersion: 2 };
    const bytes = encode(value);
    const manifest = manifestWithBytes({ coreBytes: bytes });
    await rejectsWithCode(() => loadArtifact(manifest, "core", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(CORE_PATH, bytes),
    }), "version");
  });
});

test("loadManifest requires the exact expected releaseId", async () => {
  await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
    expectedReleaseId: "v2",
    fetchImpl: async () => new Response(JSON.stringify(manifestFixture)),
  }), "release");
});

test("manifest descriptors reject non-contract raw paths", async (t) => {
  const cases = [
    ["query", `${CORE_PATH}?v=123`],
    ["fragment", `${CORE_PATH}#sha`],
    ["bare filename", "graph-core.v1.json"],
    ["same-origin full URL", `https://example.test/${CORE_PATH}`],
    ["same-origin network path", `//example.test/${CORE_PATH}`],
    ["cross-origin", `https://evil.test/${CORE_PATH}`],
    ["non-http scheme", `blob:https://example.test/${CORE_PATH}`],
    ["off-tree", "data/graph-core.v1.json"],
    ["mutable", "synthesis/data/graph-core.json"],
    ["traversal", "synthesis/data/../data/graph-core.v1.json"],
  ];
  for (const [name, path] of cases) {
    await t.test(name, async () => {
      const value = clone(manifestFixture);
      value.artifacts.core.path = path;
      await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
        expectedReleaseId: "v1",
        fetchImpl: async () => new Response(JSON.stringify(value)),
      }), "descriptor");
    });
  }
});

test("descriptor loading is consistent under a subpath deployment", async () => {
  const deploymentBase = "https://example.test/app/";
  const manifestUrl = `${deploymentBase}synthesis/data/manifest.v2.json`;
  const manifestValue = manifestWithBytes();

  const manifest = await loadManifest(manifestUrl, {
    expectedReleaseId: "v2",
    fetchImpl: async (url, init) => {
      assert.equal(String(url), manifestUrl);
      assert.equal(init.cache, "no-store");
      return new Response(JSON.stringify(manifestValue));
    },
  });
  const core = await loadArtifact(manifest, "core", {
    baseUrl: deploymentBase,
    fetchImpl: async (url, init) => {
      assert.equal(String(url), `${deploymentBase}${CORE_PATH}`);
      assert.equal(init.cache, "no-store");
      assert.equal(new URL(String(url)).search, "");
      assert.equal(new URL(String(url)).hash, "");
      return new Response(CORE_BYTES);
    },
  });

  assert.deepEqual(core, coreFixture);
});

test("loadArtifact rechecks descriptor origin against the trusted base URL", async () => {
  const manifest = manifestWithBytes();
  manifest.artifacts.core.path = `https://evil.test/${CORE_PATH}`;
  let calls = 0;
  await rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl: async () => {
      calls++;
      return new Response(CORE_BYTES);
    },
  }), "descriptor");
  assert.equal(calls, 0);
});

test("manifest source and descriptor numeric/hash types are strict", async (t) => {
  await t.test("dataset/source binding", async () => {
    const value = clone(manifestFixture);
    value.datasetId = OTHER_DATASET_ID;
    await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
      expectedReleaseId: "v1",
      fetchImpl: async () => new Response(JSON.stringify(value)),
    }), "manifest");
  });

  await t.test("descriptor bytes", async () => {
    const value = clone(manifestFixture);
    value.artifacts.core.bytes = "42";
    await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
      expectedReleaseId: "v1",
      fetchImpl: async () => new Response(JSON.stringify(value)),
    }), "descriptor");
  });

  const nonStringCases = [
    ["releaseId", (value) => { value.releaseId = ["v1"]; }, "manifest"],
    ["datasetId", (value) => { value.datasetId = [DATASET_ID]; }, "manifest"],
    ["source commit", (value) => { value.source.commit = ["b".repeat(40)]; }, "manifest"],
    ["source hash", (value) => {
      value.source.fullDagSha256 = [DATASET_HASH];
    }, "manifest"],
    ["descriptor hash", (value) => {
      value.artifacts.core.sha256 = ["d".repeat(64)];
    }, "descriptor"],
  ];
  for (const [name, mutate, code] of nonStringCases) {
    await t.test(`${name} rejects array coercion`, async () => {
      const value = clone(manifestFixture);
      mutate(value);
      await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
        fetchImpl: async () => new Response(JSON.stringify(value)),
      }), code);
    });
  }
});

test("artifact bytes and SHA-256 must match the pinned descriptor", async (t) => {
  await t.test("size", async () => {
    const manifest = manifestWithBytes();
    manifest.artifacts.core.bytes++;
    await rejectsWithCode(() => loadArtifact(manifest, "core", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
    }), "size");
  });

  await t.test("hash", async () => {
    const manifest = manifestWithBytes();
    manifest.artifacts.core.sha256 = "0".repeat(64);
    await rejectsWithCode(() => loadArtifact(manifest, "core", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
    }), "hash");
  });
});

test("artifacts must carry the manifest datasetId", async () => {
  const value = { ...coreFixture, datasetId: OTHER_DATASET_ID };
  const bytes = encode(value);
  const manifest = manifestWithBytes({ coreBytes: bytes });
  await rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl: artifactFetch(CORE_PATH, bytes),
  }), "dataset");
});

test("validateCore rejects empty/duplicate values and invalid topology/endpoints", async (t) => {
  await t.test("empty values", () => {
    const core = clone(coreFixture);
    core.nodes[0].values = [];
    core.nodes[0].prior = [];
    throwsWithCode(() => validateCore(core), "schema");
  });

  await t.test("duplicate values", () => {
    const core = clone(coreFixture);
    core.nodes[0].values = ["a0", "a0"];
    throwsWithCode(() => validateCore(core), "schema");
  });

  await t.test("topology does not cover ids", () => {
    const core = clone(coreFixture);
    core.topologicalOrder = ["a", "b", "b"];
    throwsWithCode(() => validateCore(core), "schema");
  });

  await t.test("unknown parent", () => {
    const core = clone(coreFixture);
    core.nodes[1].parents = ["missing"];
    throwsWithCode(() => validateCore(core), "schema");
  });

  await t.test("unknown edge endpoint", () => {
    const core = clone(coreFixture);
    core.edges[0].target = "missing";
    throwsWithCode(() => validateCore(core), "schema");
  });
});

test("validateCore rejects non-finite, negative, zero-mass, and coerced numbers", async (t) => {
  const cases = [
    ["non-finite prior", (core) => { core.nodes[0].prior[0] = Infinity; }],
    ["negative prior", (core) => { core.nodes[0].prior[0] = -1; }],
    ["zero prior mass", (core) => { core.nodes[0].prior = [0, 0]; }],
    ["string prior", (core) => { core.nodes[0].prior[0] = "0.75"; }],
    ["non-finite edge weight", (core) => { core.edges[0].weight = NaN; }],
    ["boolean edge weight", (core) => { core.edges[0].weight = true; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const core = clone(coreFixture);
      mutate(core);
      throwsWithCode(() => validateCore(core), "schema");
    });
  }
});

test("validators reject array-coerced dataset IDs", () => {
  const core = clone(coreFixture);
  core.datasetId = [DATASET_ID];
  throwsWithCode(() => validateCore(core), "schema");

  const pack = clone(packFixture);
  pack.datasetId = core.datasetId;
  throwsWithCode(() => validatePack(pack, core), "schema");
});

test("loadArtifact requires core for pack and reports an absent pack", async (t) => {
  await t.test("missing core", async () => {
    const manifest = manifestWithBytes();
    await rejectsWithCode(() => loadArtifact(manifest, "pack", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(PACK_PATH, PACK_BYTES),
    }), "missing-core");
  });

  await t.test("manifest has no pack", async () => {
    const manifest = manifestWithBytes({ includePack: false });
    let calls = 0;
    await rejectsWithCode(() => loadArtifact(manifest, "pack", {
      baseUrl: BASE_URL,
      core: coreFixture,
      fetchImpl: async () => { calls++; },
    }), "missing-artifact");
    assert.equal(calls, 0);
  });
});

test("validatePack rejects unknown edge, CPT, and mask endpoints", async (t) => {
  const cases = [
    ["edge source", (pack) => { pack.edges[0].source = "missing"; }],
    ["edge target", (pack) => { pack.edges[0].target = "missing"; }],
    ["CPT target", (pack) => { pack.cpts[0].target = "missing"; }],
    ["CPT parent", (pack) => { pack.cpts[0].parents[0] = "missing"; }],
    ["mask target", (pack) => { pack.masks[0].target = "missing"; }],
    ["mask condition parent", (pack) => {
      pack.masks[0].condition = { missing: ["a0"] };
    }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => loadInvalidPack(mutate));
  }
});

test("validatePack enforces matrix and CPT dimensions against core.values", async (t) => {
  const cases = [
    ["matrix source rows", (pack) => { pack.edges[0].matrix.pop(); }],
    ["matrix target columns", (pack) => { pack.edges[0].matrix[0].pop(); }],
    ["CPT distribution", (pack) => { pack.cpts[0].rows[0][1].pop(); }],
    ["CPT code range", (pack) => { pack.cpts[0].rows[0][0] = 6; }],
    ["CPT unsafe code", (pack) => {
      pack.cpts[0].rows[0][0] = Number.MAX_SAFE_INTEGER + 1;
    }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => loadInvalidPack(mutate));
  }
});

test("validatePack rejects non-finite/coerced weights, distributions, and mask multipliers", async (t) => {
  const cases = [
    ["edge weight", (pack) => { pack.edges[0].weight = Infinity; }],
    ["matrix value", (pack) => { pack.edges[0].matrix[0][0] = "0.6"; }],
    ["CPT weight", (pack) => { pack.cpts[0].weight = true; }],
    ["CPT distribution", (pack) => { pack.cpts[0].rows[0][1][0] = NaN; }],
    ["mask multiplier", (pack) => { pack.masks[0].bad_value_multiplier = "0.1"; }],
    ["mask target value type", (pack) => { pack.masks[0].preferred_values = [true]; }],
    ["mask condition value type", (pack) => { pack.masks[0].condition.a = [1]; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const pack = clone(packFixture);
      mutate(pack);
      throwsWithCode(() => validatePack(pack, coreFixture), "schema");
    });
  }
});

test("validatePack preserves pass-through mask value aliases", () => {
  const pack = clone(packFixture);
  pack.masks[0].condition.a = ["legacy-a-value"];
  pack.masks[0].bad_values = ["legacy-bad-value"];
  pack.masks[0].preferred_values = ["legacy-preferred-value"];
  pack.masks[0].downweight_values = { "legacy-downweight-value": 0.25 };

  assert.equal(validatePack(pack, coreFixture), pack);
});

test("dimensions integrity and schema failures are fail-closed and safe", async (t) => {
  await t.test("hash", async () => {
    const manifest = manifestWithBytes();
    manifest.artifacts.dimensions.sha256 = "0".repeat(64);
    await rejectsWithCode(() => loadAuxJson(manifest, "dimensions", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
      validate() {},
    }), "hash");
  });

  await t.test("schema", async () => {
    const raw = new Error("bad field <img src=x onerror=alert(1)>");
    const error = await rejectsWithCode(() => loadAuxJson(manifestWithBytes(), "dimensions", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
      validate() { throw raw; },
    }), "schema");
    assert.equal(error.message, "dimensions schema validation failed.");
    assert.equal(error.cause, raw);
    assert.doesNotMatch(error.message, /bad field|img/);
  });

  await t.test("schema ArtifactLoadError is also normalized", async () => {
    const raw = new ArtifactLoadError("schema", "unsafe <script>alert(1)</script>");
    const error = await rejectsWithCode(() => loadAuxJson(manifestWithBytes(), "dimensions", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
      validate() { throw raw; },
    }), "schema");
    assert.equal(error.message, "dimensions schema validation failed.");
    assert.equal(error.cause, raw);
    assert.doesNotMatch(error.message, /script/);
  });

  await t.test("validator is required", async () => {
    await rejectsWithCode(() => loadAuxJson(manifestWithBytes(), "dimensions", {
      baseUrl: BASE_URL,
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
    }), "missing-validator");
  });
});

test("a rejected request is not cached and the next attempt refetches successfully", async () => {
  const manifest = manifestWithBytes();
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    assert.equal(String(url), new URL(CORE_PATH, BASE_URL).href);
    assert.equal(init.cache, "no-store");
    if (calls === 1) throw new Error("temporary private failure");
    return new Response(CORE_BYTES);
  };

  await rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl,
  }), "network");
  const core = await loadArtifact(manifest, "core", { baseUrl: BASE_URL, fetchImpl });
  assert.deepEqual(core, coreFixture);
  assert.equal(calls, 2);
});
