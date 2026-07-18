import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeUrlState, encodeUrlState } from "../synthesis/url-state.js";

const DATASET_ID = `sha256:${"a".repeat(64)}`;
const manifest = { datasetId: DATASET_ID };
const core = {
  formatVersion: 1,
  datasetId: DATASET_ID,
  nodes: [
    {
      id: "alpha", label: "Alpha", category: "People & Society", description: "",
      values: ["a0", "café"], prior: [0.5, 0.5], parents: [], emit: true,
    },
    {
      id: "node / two", label: "Node Two", category: "Work / Education", description: "",
      values: ["x", "y"], prior: [0.5, 0.5], parents: ["alpha"], emit: true,
    },
  ],
  edges: [{ source: "alpha", target: "node / two", weight: 1, relation: "" }],
  topologicalOrder: ["alpha", "node / two"],
};
const store = {
  core,
  nodesById: new Map(core.nodes.map((node) => [node.id, node])),
};
const overview = {
  categories: [
    { name: "People & Society" },
    { name: "Work / Education" },
  ],
};
const context = { manifest, store, overview };
const DEFAULT_CONTROLS = {
  n: 20,
  seed: 42,
  gammaScale: 1,
  compareBaseline: false,
};
const defaults = {
  selectedCategory: null,
  centerNode: null,
  selectedNode: null,
  up: 1,
  down: 1,
  recipe: [],
  controls: DEFAULT_CONTROLS,
};

function page(search = "") {
  return new URL(`/synthesis.html${search}#studio`, "https://matraix.ai");
}

const base64Url = (value) => Buffer.from(value, "utf8").toString("base64url");

const canonicalRecipe = [
  { kind: "pin", nodeId: "alpha", label: "Alpha", value: "café" },
  {
    kind: "prior",
    nodeId: "alpha",
    label: "Alpha",
    values: ["a0", "café"],
    weights: [1, 3],
  },
  { kind: "category", category: "People & Society", factor: 0.8 },
  {
    kind: "edge",
    source: "alpha",
    target: "node / two",
    sourceLabel: "Alpha",
    targetLabel: "Node Two",
    factor: 1.4,
  },
];

const reorderedRecipe = [
  { value: "café", label: "Alpha", nodeId: "alpha", kind: "pin" },
  {
    weights: [1, 3],
    values: ["a0", "café"],
    label: "Alpha",
    nodeId: "alpha",
    kind: "prior",
  },
  { factor: 0.8, category: "People & Society", kind: "category" },
  {
    factor: 1.4,
    targetLabel: "Node Two",
    sourceLabel: "Alpha",
    target: "node / two",
    source: "alpha",
    kind: "edge",
  },
];

const recipeControls = {
  n: 37,
  seed: 9_007_199_254_740_991,
  gammaScale: 0.7,
  compareBaseline: false,
};

function cfgFor(recipe, controls = recipeControls) {
  const encoded = encodeUrlState(page(), { manifest, recipe, controls });
  return new URL(encoded, "https://matraix.ai").searchParams.get("cfg");
}

function browseWithCfg(cfg) {
  const params = new URLSearchParams({
    v: "1",
    datasetId: DATASET_ID,
    selectedNode: "alpha",
    up: "2",
    cfg,
  });
  return decodeUrlState(page(`?${params}`), context);
}

test("PR-A state round-trips through the versioned canonical URL codec", () => {
  const state = {
    manifest,
    selectedCategory: "People & Society",
    centerNode: "node / two",
    selectedNode: "alpha",
    up: 0,
    down: 4,
  };

  const encoded = encodeUrlState(page("?ignored=old&cfg=future"), state);
  assert.equal(
    encoded,
    `/synthesis.html?v=1&datasetId=${encodeURIComponent(DATASET_ID)}`
      + "&category=People+%26+Society&centerNode=node+%2F+two"
      + "&selectedNode=alpha&up=0&down=4#studio",
  );
  assert.deepEqual(decodeUrlState(new URL(encoded, "https://matraix.ai"), context), {
    selectedCategory: "People & Society",
    centerNode: "node / two",
    selectedNode: "alpha",
    up: 0,
    down: 4,
    recipe: [],
    controls: DEFAULT_CONTROLS,
  });
});

test("absent state and default hops decode closed and encode without cfg", () => {
  assert.deepEqual(decodeUrlState(page(), context), defaults);

  const encoded = encodeUrlState(page("?cfg=reserved"), {
    manifest,
    ...defaults,
  });
  assert.equal(
    encoded,
    `/synthesis.html?v=1&datasetId=${encodeURIComponent(DATASET_ID)}#studio`,
  );
  assert.equal(new URL(encoded, "https://matraix.ai").searchParams.has("cfg"), false);
});

test("unsupported version or mismatched dataset rejects the whole configuration", () => {
  const validFields = "&category=People+%26+Society&centerNode=alpha&selectedNode=alpha&up=2&down=3";
  assert.deepEqual(
    decodeUrlState(page(`?v=2&datasetId=${encodeURIComponent(DATASET_ID)}${validFields}`), context),
    defaults,
  );
  assert.deepEqual(
    decodeUrlState(page(`?v=1&datasetId=sha256%3A${"b".repeat(64)}${validFields}`), context),
    defaults,
  );
  assert.deepEqual(
    decodeUrlState(page(`?v=1${validFields}`), context),
    defaults,
  );
});

test("invalid category, nodes, and hop values fail closed per field", () => {
  const params = new URLSearchParams({
    v: "1",
    datasetId: DATASET_ID,
    category: "not a category",
    centerNode: "missing",
    selectedNode: "alpha",
    up: "2.0",
    down: "3",
  });
  assert.deepEqual(decodeUrlState(page(`?${params}`), context), {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 1,
    down: 3,
    recipe: [],
    controls: DEFAULT_CONTROLS,
  });

  for (const invalid of ["-1", "5", "01", "1e0", "", "NaN"]) {
    const url = page(`?v=1&datasetId=${encodeURIComponent(DATASET_ID)}&up=${encodeURIComponent(invalid)}`);
    assert.equal(decodeUrlState(url, context).up, 1, `up=${JSON.stringify(invalid)}`);
  }
});

test("canonical encoding is stable, ignores unknown state, and does not mutate the location", () => {
  const location = page("?down=0&v=99&unknown=1");
  const original = location.href;
  const state = {
    down: 2,
    selectedNode: "alpha",
    manifest,
    unknown: "not serialized",
  };

  const first = encodeUrlState(location, state);
  const second = encodeUrlState(new URL(first, location), { ...state });
  assert.equal(first, second);
  assert.equal(location.href, original);
  assert.equal(
    first,
    `/synthesis.html?v=1&datasetId=${encodeURIComponent(DATASET_ID)}&selectedNode=alpha&down=2#studio`,
  );
});

test("cfg round-trips a canonical UTF-8 recipe and controls without overriding browse fields", () => {
  const recipe = [
    { kind: "pin", nodeId: "alpha", label: "Alpha", value: "café" },
    {
      kind: "edge", source: "alpha", target: "node / two",
      sourceLabel: "Alpha", targetLabel: "Node Two", factor: 1.4,
    },
  ];
  const controls = { n: 37, seed: 9_007_199_254_740_991, gammaScale: 0.7,
    compareBaseline: false };
  const encoded = encodeUrlState(page("?ignored=old"), {
    manifest,
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
    recipe,
    controls,
  });
  const url = new URL(encoded, "https://matraix.ai");
  const encodedCfg = url.searchParams.get("cfg");
  assert.ok(encodedCfg);
  assert.deepEqual(
    JSON.parse(Buffer.from(encodedCfg, "base64url").toString("utf8")),
    { datasetId: DATASET_ID, recipe, controls },
  );
  assert.deepEqual(decodeUrlState(url, context), {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
    recipe,
    controls,
  });
  assert.equal(encodeUrlState(url, {
    manifest, selectedNode: "alpha", up: 2, recipe, controls,
  }), encoded, "canonical cfg encoding must be stable");
});

test("invalid, duplicate, or overlong cfg fails closed without discarding valid browse state", () => {
  const browse = {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
    recipe: [],
    controls: DEFAULT_CONTROLS,
  };
  const base = new URLSearchParams({
    v: "1", datasetId: DATASET_ID, selectedNode: "alpha", up: "2",
  });
  const invalidConfigs = [
    "%%%",
    Buffer.from("{}", "utf8").toString("base64url"),
    Buffer.from(JSON.stringify({
      datasetId: `sha256:${"b".repeat(64)}`,
      recipe: [],
      controls: DEFAULT_CONTROLS,
    }), "utf8").toString("base64url"),
    "a".repeat(8193),
  ];
  for (const cfg of invalidConfigs) {
    const params = new URLSearchParams(base);
    params.append("cfg", cfg);
    assert.deepEqual(decodeUrlState(page(`?${params}`), context), browse);
  }

  const duplicate = new URLSearchParams(base);
  duplicate.append("cfg", Buffer.from(JSON.stringify({
    datasetId: DATASET_ID, recipe: [], controls: DEFAULT_CONTROLS,
  })).toString("base64url"));
  duplicate.append("cfg", duplicate.get("cfg"));
  assert.deepEqual(decodeUrlState(page(`?${duplicate}`), context), browse);
});

test("cfg encoder rebuilds every recipe kind in one fixed field order", () => {
  const canonical = cfgFor(canonicalRecipe);
  const reordered = cfgFor(reorderedRecipe, {
    compareBaseline: false,
    gammaScale: 0.7,
    seed: 9_007_199_254_740_991,
    n: 37,
  });
  assert.equal(reordered, canonical,
    "semantically equal recipes must not depend on object insertion order");

  const payload = JSON.parse(Buffer.from(reordered, "base64url").toString("utf8"));
  assert.deepEqual(payload.recipe, canonicalRecipe);
  assert.deepEqual(payload.recipe.map(Object.keys), [
    ["kind", "nodeId", "label", "value"],
    ["kind", "nodeId", "label", "values", "weights"],
    ["kind", "category", "factor"],
    ["kind", "source", "target", "sourceLabel", "targetLabel", "factor"],
  ]);
});

test("cfg decoder accepts arbitrary legal key order and returns normalized entries", () => {
  const raw = {
    controls: {
      compareBaseline: false,
      gammaScale: 0.7,
      seed: 9_007_199_254_740_991,
      n: 37,
    },
    recipe: reorderedRecipe,
    datasetId: DATASET_ID,
  };
  assert.deepEqual(browseWithCfg(base64Url(JSON.stringify(raw))), {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
    recipe: canonicalRecipe,
    controls: recipeControls,
  });
});

test("cfg defaults omitted baseline comparison to false and preserves explicit true", () => {
  const omitted = {
    datasetId: DATASET_ID,
    recipe: [],
    controls: { n: 20, seed: 42, gammaScale: 1 },
  };
  assert.equal(
    browseWithCfg(base64Url(JSON.stringify(omitted))).controls.compareBaseline,
    false,
  );

  const explicitTrue = { ...DEFAULT_CONTROLS, compareBaseline: true };
  const encoded = encodeUrlState(page(), {
    manifest,
    recipe: [],
    controls: explicitTrue,
  });
  assert.equal(
    decodeUrlState(new URL(encoded, "https://matraix.ai"), context)
      .controls.compareBaseline,
    true,
  );
});

test("padded, noncanonical, and invalid UTF-8 cfg encodings fail closed", () => {
  const browse = {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
    recipe: [],
    controls: DEFAULT_CONTROLS,
  };
  const raw = JSON.stringify({
    datasetId: DATASET_ID,
    recipe: [],
    controls: DEFAULT_CONTROLS,
  });
  const canonical = base64Url(raw);

  let sourceWithTail = raw;
  let canonicalWithTail = canonical;
  while (canonicalWithTail.length % 4 === 0) {
    sourceWithTail += " ";
    canonicalWithTail = base64Url(sourceWithTail);
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const lastIndex = alphabet.indexOf(canonicalWithTail.at(-1));
  const noncanonical = `${canonicalWithTail.slice(0, -1)}${alphabet[lastIndex + 1]}`;
  assert.deepEqual(
    Buffer.from(noncanonical, "base64url"),
    Buffer.from(canonicalWithTail, "base64url"),
    "fixture must alter only unused base64 bits",
  );

  for (const cfg of [
    `${canonical}=`,
    noncanonical,
    Buffer.from([0xc3, 0x28]).toString("base64url"),
  ]) {
    assert.deepEqual(browseWithCfg(cfg), browse);
  }
});

test("a schema-invalid thirteenth recipe entry falls back without losing browse state", () => {
  const raw = {
    datasetId: DATASET_ID,
    recipe: Array.from({ length: 13 }, () => ({
      kind: "pin",
      nodeId: "alpha",
      label: "Alpha",
      value: "a0",
    })),
    controls: DEFAULT_CONTROLS,
  };
  assert.deepEqual(browseWithCfg(base64Url(JSON.stringify(raw))), {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
    recipe: [],
    controls: DEFAULT_CONTROLS,
  });
});

test("cfg encoder rejects output longer than 8192 characters", () => {
  assert.throws(() => encodeUrlState(page(), {
    manifest,
    recipe: [{
      kind: "pin",
      nodeId: "alpha",
      label: "x".repeat(7_000),
      value: "a0",
    }],
    controls: recipeControls,
  }), {
    name: "RangeError",
    message: /8192/,
  });
});
