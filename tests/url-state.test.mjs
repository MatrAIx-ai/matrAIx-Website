import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeUrlState, encodeUrlState } from "../synthesis/url-state.js";

const DATASET_ID = `sha256:${"a".repeat(64)}`;
const manifest = { datasetId: DATASET_ID };
const store = {
  nodesById: new Map([
    ["alpha", { id: "alpha" }],
    ["node / two", { id: "node / two" }],
  ]),
};
const overview = {
  categories: [
    { name: "People & Society" },
    { name: "Work / Education" },
  ],
};
const context = { manifest, store, overview };
const defaults = {
  selectedCategory: null,
  centerNode: null,
  selectedNode: null,
  up: 1,
  down: 1,
};

function page(search = "") {
  return new URL(`/synthesis.html${search}#studio`, "https://matraix.ai");
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

test("cfg remains reserved for a future codec and cannot override PR-A fields", () => {
  const cfg = Buffer.from(JSON.stringify({ selectedNode: "missing", up: 4 })).toString("base64url");
  const params = new URLSearchParams({
    v: "1",
    datasetId: DATASET_ID,
    selectedNode: "alpha",
    up: "2",
    cfg,
  });
  assert.deepEqual(decodeUrlState(page(`?${params}`), context), {
    selectedCategory: null,
    centerNode: null,
    selectedNode: "alpha",
    up: 2,
    down: 1,
  });
});
