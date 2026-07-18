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

const artifactFetch = (
  expectedPath,
  bytes,
  { status = 200, cache = "default" } = {},
) => async (url, init) => {
  const expectedUrl = new URL(expectedPath, BASE_URL).href;
  assert.equal(String(url), expectedUrl);
  assert.equal(new URL(String(url)).search, "");
  assert.equal(new URL(String(url)).hash, "");
  assert.equal(init.cache, cache);
  return new Response(bytes, { status });
};

function createCacheStorage({
  entries = new Map(),
  reject = new Set(),
  hooks = {},
} = {}) {
  const calls = [];
  const cache = {
    async match(url) {
      calls.push(["match", String(url)]);
      await hooks.match?.();
      if (reject.has("match")) throw new Error("match failed");
      const entry = entries.get(String(url));
      if (entry === undefined) return undefined;
      if (typeof entry === "function") return entry();
      if (entry instanceof Response) return entry.clone();
      return new Response(entry.slice());
    },
    async put(url, response) {
      calls.push(["put", String(url)]);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await hooks.put?.();
      if (reject.has("put")) throw new Error("put failed");
      entries.set(String(url), bytes);
    },
    async delete(url) {
      calls.push(["delete", String(url)]);
      await hooks.delete?.();
      if (reject.has("delete")) throw new Error("delete failed");
      return entries.delete(String(url));
    },
  };
  return {
    calls,
    entries,
    async open(name) {
      calls.push(["open", name]);
      await hooks.open?.();
      if (reject.has("open")) throw new Error("open failed");
      return cache;
    },
  };
}

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const abortBetweenHelperAndCaller = (controller) => {
  queueMicrotask(() => {
    queueMicrotask(() => {
      queueMicrotask(() => controller.abort());
    });
  });
};

async function loadInvalidCore(mutator) {
  const value = clone(coreFixture);
  mutator(value);
  const bytes = encode(value);
  const manifest = manifestWithBytes({ coreBytes: bytes });
  return rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    cacheMode: "reload",
    fetchImpl: artifactFetch(CORE_PATH, bytes, { cache: "reload" }),
  }), "schema");
}

async function loadInvalidPack(mutator) {
  const value = clone(packFixture);
  mutator(value);
  const bytes = encode(value);
  const manifest = manifestWithBytes({ packBytes: bytes });
  return rejectsWithCode(() => loadArtifact(manifest, "pack", {
    baseUrl: BASE_URL,
    cacheMode: "reload",
    core: coreFixture,
    fetchImpl: artifactFetch(PACK_PATH, bytes, { cache: "reload" }),
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
      assert.equal(init.cache, "default");
      return new Response(JSON.stringify(manifestFixture));
    },
  });

  assert.deepEqual(manifest, manifestFixture);
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.artifacts.core));
});

test("loadManifest uses default and explicit reload cache modes", async () => {
  for (const cacheMode of ["default", "reload"]) {
    await loadManifest(MANIFEST_URL, {
      cacheMode,
      expectedReleaseId: "v1",
      fetchImpl: async (_url, init) => {
        assert.equal(init.cache, cacheMode);
        return new Response(JSON.stringify(manifestFixture));
      },
    });
  }
});

test("loadManifest rejects an invalid cache mode before fetching", async () => {
  let fetches = 0;
  await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
    cacheMode: "no-store",
    fetchImpl: async () => {
      fetches += 1;
      return new Response(JSON.stringify(manifestFixture));
    },
  }), "cache-mode");
  assert.equal(fetches, 0);
});

test("loadArtifact fetches the exact immutable core pathname and verifies it", async () => {
  const manifest = manifestWithBytes();
  const core = await loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
  });
  assert.deepEqual(core, coreFixture);
});

test("loadArtifact awaits a verified cache commit before resolving", async () => {
  const putStarted = deferred();
  const allowPut = deferred();
  const cacheStorage = createCacheStorage({
    hooks: {
      async put() {
        putStarted.resolve();
        await allowPut.promise;
      },
    },
  });
  const modes = [];
  let settled = false;
  const load = loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    cacheStorage,
    fetchImpl: async (url, init) => {
      modes.push(init.cache);
      return artifactFetch(CORE_PATH, CORE_BYTES)(url, init);
    },
  }).finally(() => { settled = true; });
  const firstSettlement = await Promise.race([
    putStarted.promise.then(() => "put-started"),
    load.then(
      () => "load-settled",
      () => "load-settled",
    ),
  ]);
  assert.equal(firstSettlement, "put-started");
  assert.equal(settled, false);
  allowPut.resolve();
  assert.deepEqual(await load, coreFixture);
  assert.deepEqual(modes, ["default"]);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
});

test("loadArtifact revalidates a cached artifact without fetching", async () => {
  const url = new URL(CORE_PATH, BASE_URL).href;
  const cacheStorage = createCacheStorage({
    entries: new Map([[url, CORE_BYTES]]),
  });
  let fetches = 0;
  const value = await loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    cacheStorage,
    fetchImpl: async () => {
      fetches += 1;
      return new Response(CORE_BYTES);
    },
  });
  assert.deepEqual(value, coreFixture);
  assert.equal(fetches, 0);
});

test("sequential loads reuse the committed artifact", async () => {
  const cacheStorage = createCacheStorage();
  let fetches = 0;
  const fetchImpl = async (url, init) => {
    fetches += 1;
    return artifactFetch(CORE_PATH, CORE_BYTES)(url, init);
  };
  const options = { baseUrl: BASE_URL, cacheStorage, fetchImpl };

  assert.deepEqual(await loadArtifact(manifestWithBytes(), "core", options), coreFixture);
  assert.deepEqual(await loadArtifact(manifestWithBytes(), "core", options), coreFixture);
  assert.equal(fetches, 1);
});

test("artifact cache mode fails before cache or fetch", async () => {
  let cacheCalls = 0;
  let fetches = 0;
  await rejectsWithCode(() => loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    cacheMode: "no-store",
    cacheStorage: {
      async open() {
        cacheCalls += 1;
      },
    },
    fetchImpl: async () => {
      fetches += 1;
      return new Response(CORE_BYTES);
    },
  }), "cache-mode");
  assert.equal(cacheCalls, 0);
  assert.equal(fetches, 0);
});

test("pack and dimensions commit only after semantic validation", async (t) => {
  await t.test("invalid pack", async () => {
    const invalidPack = clone(packFixture);
    invalidPack.edges[0].source = "missing";
    const bytes = encode(invalidPack);
    const cacheStorage = createCacheStorage();
    const modes = [];
    await rejectsWithCode(() => loadArtifact(
      manifestWithBytes({ packBytes: bytes }),
      "pack",
      {
        baseUrl: BASE_URL,
        cacheStorage,
        core: coreFixture,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          return new Response(bytes);
        },
      },
    ), "schema");
    assert.deepEqual(modes, ["default", "reload"]);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
  });

  await t.test("valid pack", async () => {
    const cacheStorage = createCacheStorage();
    const value = await loadArtifact(manifestWithBytes(), "pack", {
      baseUrl: BASE_URL,
      cacheStorage,
      core: coreFixture,
      fetchImpl: artifactFetch(PACK_PATH, PACK_BYTES),
    });
    assert.deepEqual(value, packFixture);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
  });

  await t.test("invalid dimensions", async () => {
    const bytes = encode({ dimensions: "invalid" });
    const cacheStorage = createCacheStorage();
    const modes = [];
    await rejectsWithCode(() => loadAuxJson(
      manifestWithBytes({ dimensionsBytes: bytes }),
      "dimensions",
      {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          return new Response(bytes);
        },
        validate(value) {
          if (!Array.isArray(value.dimensions)) throw new TypeError("invalid dimensions");
        },
      },
    ), "schema");
    assert.deepEqual(modes, ["default", "reload"]);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
  });

  await t.test("valid dimensions", async () => {
    const cacheStorage = createCacheStorage();
    const value = await loadAuxJson(manifestWithBytes(), "dimensions", {
      baseUrl: BASE_URL,
      cacheStorage,
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
      validate(candidate) {
        assert.deepEqual(candidate, dimensionsFixture);
      },
    });
    assert.deepEqual(value, dimensionsFixture);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
  });
});

test("an auxiliary validator false result is a schema failure", async () => {
  const cacheStorage = createCacheStorage();
  const modes = [];
  let validations = 0;
  const error = await rejectsWithCode(() => loadAuxJson(
    manifestWithBytes(),
    "dimensions",
    {
      baseUrl: BASE_URL,
      cacheStorage,
      fetchImpl: async (_url, init) => {
        modes.push(init.cache);
        return new Response(DIMENSIONS_BYTES);
      },
      validate() {
        validations += 1;
        return false;
      },
    },
  ), "schema");
  assert.equal(error.message, "dimensions schema validation failed.");
  assert.equal(validations, 2);
  assert.deepEqual(modes, ["default", "reload"]);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
});

test("content failures recover once and preserve the terminal error", async (t) => {
  const hashBytes = CORE_BYTES.slice();
  hashBytes[0] ^= 1;
  const versionBytes = encode({ ...coreFixture, formatVersion: 2 });
  const datasetBytes = encode({ ...coreFixture, datasetId: OTHER_DATASET_ID });
  const schemaValue = clone(coreFixture);
  schemaValue.nodes = [];
  const schemaBytes = encode(schemaValue);
  const contentCases = [
    ["size", encode("short"), manifestWithBytes(), "size"],
    ["hash", hashBytes, manifestWithBytes(), "hash"],
    ["json", encode("{not-json"), null, "json"],
    ["version", versionBytes, null, "version"],
    ["dataset", datasetBytes, null, "dataset"],
    ["schema", schemaBytes, null, "schema"],
  ];

  for (const [name, bytes, suppliedManifest, code] of contentCases) {
    await t.test(name, async () => {
      const manifest = suppliedManifest ?? manifestWithBytes({ coreBytes: bytes });
      const cacheStorage = createCacheStorage();
      const modes = [];
      const error = await rejectsWithCode(() => loadArtifact(manifest, "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          return new Response(bytes);
        },
      }), code);
      assert.equal(error.code, code);
      assert.deepEqual(modes, ["default", "reload"]);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
    });
  }

  await t.test("the second content error is terminal", async () => {
    const cacheStorage = createCacheStorage();
    const modes = [];
    let fetches = 0;
    const error = await rejectsWithCode(() => loadArtifact(
      manifestWithBytes(),
      "core",
      {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          fetches += 1;
          return new Response(fetches === 1 ? hashBytes : encode("short"));
        },
      },
    ), "size");
    assert.equal(error.code, "size");
    assert.equal(fetches, 2);
    assert.deepEqual(modes, ["default", "reload"]);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
  });

  const cachedTransportCases = [
    ["cached http", () => new Response("private", { status: 404 })],
    ["cached body", () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => { throw new Error("private body failure"); },
    })],
  ];
  for (const [name, entry] of cachedTransportCases) {
    await t.test(name, async () => {
      const url = new URL(CORE_PATH, BASE_URL).href;
      const cacheStorage = createCacheStorage({ entries: new Map([[url, entry]]) });
      const modes = [];
      await rejectsWithCode(() => loadArtifact(manifestWithBytes(), "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          return new Response(encode("short"));
        },
      }), "size");
      assert.deepEqual(modes, ["reload"]);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "match").length, 1);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
    });
  }

  const transportCases = [
    ["network http", "http", async () => new Response("private", { status: 404 })],
    ["network failure", "network", async () => { throw new Error("private network"); }],
    ["network body", "body", async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => { throw new Error("private body"); },
    })],
  ];
  for (const [name, code, response] of transportCases) {
    await t.test(name, async () => {
      const cacheStorage = createCacheStorage();
      const modes = [];
      await rejectsWithCode(() => loadArtifact(manifestWithBytes(), "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (url, init) => {
          modes.push(init.cache);
          return response(url, init);
        },
      }), code);
      assert.deepEqual(modes, ["default"]);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 0);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
    });
  }

  await t.test("digest", async () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          async digest() {
            throw new Error("private digest failure");
          },
        },
      },
    });
    const cacheStorage = createCacheStorage();
    const modes = [];
    try {
      await rejectsWithCode(() => loadArtifact(manifestWithBytes(), "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          return new Response(CORE_BYTES);
        },
      }), "digest");
    } finally {
      Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    }
    assert.deepEqual(modes, ["default"]);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 0);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
  });

  await t.test("abort", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    const cacheStorage = createCacheStorage();
    const modes = [];
    await assert.rejects(
      () => loadArtifact(manifestWithBytes(), "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (_url, init) => {
          modes.push(init.cache);
          throw abort;
        },
      }),
      (error) => error === abort,
    );
    assert.deepEqual(modes, ["default"]);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 0);
    assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
  });
});

test("a corrupt cached core is deleted and recovered once with reload", async () => {
  const url = new URL(CORE_PATH, BASE_URL).href;
  const cacheStorage = createCacheStorage({
    entries: new Map([[url, encode("corrupt")]]),
  });
  const modes = [];
  const value = await loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    cacheStorage,
    fetchImpl: async (_url, init) => {
      modes.push(init.cache);
      return new Response(CORE_BYTES);
    },
  });
  assert.deepEqual(value, coreFixture);
  assert.deepEqual(modes, ["reload"]);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
});

test("reload mode consumes the one bypass allowance", async () => {
  const invalid = clone(coreFixture);
  invalid.nodes = [];
  const bytes = encode(invalid);
  const cacheStorage = createCacheStorage();
  const modes = [];
  await rejectsWithCode(() => loadArtifact(
    manifestWithBytes({ coreBytes: bytes }),
    "core",
    {
      baseUrl: BASE_URL,
      cacheMode: "reload",
      cacheStorage,
      fetchImpl: async (_url, init) => {
        modes.push(init.cache);
        return new Response(bytes);
      },
    },
  ), "schema");
  assert.deepEqual(modes, ["reload"]);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
});

test("network transport failures do not retry", async (t) => {
  const cases = [
    ["http", "http", async () => new Response("private", { status: 503 })],
    ["body", "body", async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => { throw new Error("private body"); },
    })],
  ];
  for (const [name, code, response] of cases) {
    await t.test(name, async () => {
      const cacheStorage = createCacheStorage();
      const modes = [];
      await rejectsWithCode(() => loadArtifact(manifestWithBytes(), "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: async (url, init) => {
          modes.push(init.cache);
          return response(url, init);
        },
      }), code);
      assert.deepEqual(modes, ["default"]);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 0);
      assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
    });
  }
});

test("delete rejection does not block verified recovery", async () => {
  const url = new URL(CORE_PATH, BASE_URL).href;
  const cacheStorage = createCacheStorage({
    entries: new Map([[url, encode("corrupt")]]),
    reject: new Set(["delete"]),
  });
  const modes = [];
  const value = await loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    cacheStorage,
    fetchImpl: async (_url, init) => {
      modes.push(init.cache);
      return new Response(CORE_BYTES);
    },
  });
  assert.deepEqual(value, coreFixture);
  assert.deepEqual(modes, ["reload"]);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
});

test("cache open match and put failures degrade to verified loading", async (t) => {
  for (const operation of ["open", "match", "put"]) {
    await t.test(operation, async () => {
      const cacheStorage = createCacheStorage({ reject: new Set([operation]) });
      const value = await loadArtifact(manifestWithBytes(), "core", {
        baseUrl: BASE_URL,
        cacheStorage,
        fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
      });
      assert.deepEqual(value, coreFixture);
      assert.deepEqual(cacheStorage.calls[0], [
        "open",
        "matraix-synthesis-verified-artifacts-v1",
      ]);
    });
  }
});

test("abort before cache open prevents cache and network I/O", async () => {
  const controller = new AbortController();
  controller.abort();
  let cacheCalls = 0;
  let fetches = 0;
  await assert.rejects(
    () => loadArtifact(manifestWithBytes(), "core", {
      baseUrl: BASE_URL,
      signal: controller.signal,
      cacheStorage: {
        async open() {
          cacheCalls += 1;
        },
      },
      fetchImpl: async () => {
        fetches += 1;
        return new Response(CORE_BYTES);
      },
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(cacheCalls, 0);
  assert.equal(fetches, 0);
});

test("abort while cache match is paused prevents fetching or exposing a value", async () => {
  const controller = new AbortController();
  const matchStarted = deferred();
  const allowMatch = deferred();
  const cacheStorage = createCacheStorage({
    hooks: {
      async match() {
        matchStarted.resolve();
        await allowMatch.promise;
      },
    },
  });
  let fetches = 0;
  const load = loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    signal: controller.signal,
    cacheStorage,
    fetchImpl: async () => {
      fetches += 1;
      return new Response(CORE_BYTES);
    },
  });
  await matchStarted.promise;
  controller.abort();
  allowMatch.resolve();
  await assert.rejects(load, (error) => error?.name === "AbortError");
  assert.equal(fetches, 0);
});

test("abort after auxiliary validation prevents a cache commit", async () => {
  const controller = new AbortController();
  const cacheStorage = createCacheStorage();
  await assert.rejects(
    () => loadAuxJson(manifestWithBytes(), "dimensions", {
      baseUrl: BASE_URL,
      signal: controller.signal,
      cacheStorage,
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES),
      validate() {
        controller.abort();
        return true;
      },
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 0);
});

test("abort while cache put is paused prevents exposing a parsed value", async () => {
  const controller = new AbortController();
  const putStarted = deferred();
  const allowPut = deferred();
  const cacheStorage = createCacheStorage({
    hooks: {
      async put() {
        putStarted.resolve();
        await allowPut.promise;
      },
    },
  });
  const load = loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    signal: controller.signal,
    cacheStorage,
    fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
  });
  await putStarted.promise;
  controller.abort();
  allowPut.resolve();
  await assert.rejects(load, (error) => error?.name === "AbortError");
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
});

test("abort after cachedCandidate settles prevents reading cached bytes", async () => {
  const controller = new AbortController();
  const url = new URL(CORE_PATH, BASE_URL).href;
  let reads = 0;
  let fetches = 0;
  const cacheStorage = createCacheStorage({
    entries: new Map([[url, () => ({
      ok: true,
      status: 200,
      async arrayBuffer() {
        reads += 1;
        return CORE_BYTES.buffer.slice(
          CORE_BYTES.byteOffset,
          CORE_BYTES.byteOffset + CORE_BYTES.byteLength,
        );
      },
    })]]),
    hooks: {
      match() {
        abortBetweenHelperAndCaller(controller);
      },
    },
  });
  await assert.rejects(
    () => loadArtifact(manifestWithBytes(), "core", {
      baseUrl: BASE_URL,
      signal: controller.signal,
      cacheStorage,
      fetchImpl: async () => {
        fetches += 1;
        return new Response(CORE_BYTES);
      },
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(reads, 0);
  assert.equal(fetches, 0);
});

test("abort after bestEffortDelete settles prevents a reload fetch", async () => {
  const controller = new AbortController();
  const url = new URL(CORE_PATH, BASE_URL).href;
  let fetches = 0;
  const cacheStorage = createCacheStorage({
    entries: new Map([[url, encode("corrupt")]]),
    hooks: {
      delete() {
        abortBetweenHelperAndCaller(controller);
      },
    },
  });
  await assert.rejects(
    () => loadArtifact(manifestWithBytes(), "core", {
      baseUrl: BASE_URL,
      signal: controller.signal,
      cacheStorage,
      fetchImpl: async () => {
        fetches += 1;
        return new Response(CORE_BYTES);
      },
    }),
    (error) => error?.name === "AbortError",
  );
  assert.equal(cacheStorage.entries.has(url), false);
  assert.equal(fetches, 0);
});

test("abort after bestEffortCommit settles prevents exposing a parsed value", async () => {
  const controller = new AbortController();
  const url = new URL(CORE_PATH, BASE_URL).href;
  const cacheStorage = createCacheStorage({
    hooks: {
      put() {
        abortBetweenHelperAndCaller(controller);
      },
    },
  });
  await assert.rejects(
    () => loadArtifact(manifestWithBytes(), "core", {
      baseUrl: BASE_URL,
      signal: controller.signal,
      cacheStorage,
      fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
    }),
    (error) => error?.name === "AbortError",
  );
  assert.deepEqual(cacheStorage.entries.get(url), CORE_BYTES);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
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
      cacheMode: "reload",
      fetchImpl: artifactFetch(CORE_PATH, bytes, { cache: "reload" }),
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
      cacheMode: "reload",
      fetchImpl: artifactFetch(CORE_PATH, bytes, { cache: "reload" }),
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
    ["leading space relative path", ` ${CORE_PATH}`],
    ["trailing space relative path", `${CORE_PATH} `],
    ["leading tab relative path", `\t${CORE_PATH}`],
    ["trailing newline relative path", `${CORE_PATH}\n`],
    ["space-padded full URL", ` https://example.test/${CORE_PATH} `],
    ["tab-prefixed full URL", `\thttps://example.test/${CORE_PATH}`],
    ["newline-prefixed full URL", `\nhttps://example.test/${CORE_PATH}`],
    ["space-padded network path", ` //example.test/${CORE_PATH} `],
    ["tab-prefixed network path", `\t//example.test/${CORE_PATH}`],
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
      assert.equal(init.cache, "default");
      return new Response(JSON.stringify(manifestValue));
    },
  });
  const core = await loadArtifact(manifest, "core", {
    baseUrl: deploymentBase,
    fetchImpl: async (url, init) => {
      assert.equal(String(url), `${deploymentBase}${CORE_PATH}`);
      assert.equal(init.cache, "default");
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
      cacheMode: "reload",
      fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES, { cache: "reload" }),
    }), "size");
  });

  await t.test("hash", async () => {
    const manifest = manifestWithBytes();
    manifest.artifacts.core.sha256 = "0".repeat(64);
    await rejectsWithCode(() => loadArtifact(manifest, "core", {
      baseUrl: BASE_URL,
      cacheMode: "reload",
      fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES, { cache: "reload" }),
    }), "hash");
  });
});

test("artifacts must carry the manifest datasetId", async () => {
  const value = { ...coreFixture, datasetId: OTHER_DATASET_ID };
  const bytes = encode(value);
  const manifest = manifestWithBytes({ coreBytes: bytes });
  await rejectsWithCode(() => loadArtifact(manifest, "core", {
    baseUrl: BASE_URL,
    cacheMode: "reload",
    fetchImpl: artifactFetch(CORE_PATH, bytes, { cache: "reload" }),
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

test("pack and dimensions preconditions fail before artifact I/O", async () => {
  let fetches = 0;
  await rejectsWithCode(() => loadArtifact(
    manifestWithBytes(),
    "pack",
    { baseUrl: BASE_URL, fetchImpl: async () => { fetches += 1; } },
  ), "missing-core");
  await rejectsWithCode(() => loadAuxJson(
    manifestWithBytes(),
    "dimensions",
    { baseUrl: BASE_URL, fetchImpl: async () => { fetches += 1; } },
  ), "missing-validator");
  assert.equal(fetches, 0);
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
      cacheMode: "reload",
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES, { cache: "reload" }),
      validate() {},
    }), "hash");
  });

  await t.test("schema", async () => {
    const raw = new Error("bad field <img src=x onerror=alert(1)>");
    const error = await rejectsWithCode(() => loadAuxJson(manifestWithBytes(), "dimensions", {
      baseUrl: BASE_URL,
      cacheMode: "reload",
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES, { cache: "reload" }),
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
      cacheMode: "reload",
      fetchImpl: artifactFetch(DIMENSIONS_PATH, DIMENSIONS_BYTES, { cache: "reload" }),
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
    assert.equal(init.cache, "default");
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
