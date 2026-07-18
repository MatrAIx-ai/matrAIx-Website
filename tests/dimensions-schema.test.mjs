import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateBuildDimensions } from "../scripts/build-synthesis-data.mjs";
import { validateDimensions } from "../synthesis/dimensions-schema.js";

const actualDimensions = JSON.parse(readFileSync(new URL("../dimensions.json", import.meta.url)));

const dimension = (overrides = {}) => ({
  id: "x",
  label: "Dimension X",
  category: "Testing",
  phrase: "has {value}",
  values: ["a", "b", "c"],
  ...overrides,
});

const outcome = (validator, value) => {
  try {
    validator(value);
    return { accepted: true };
  } catch (error) {
    return { accepted: false, code: error?.code, key: error?.key };
  }
};

const assertDifferential = (value, accepted, name) => {
  const browser = outcome(validateDimensions, value);
  const build = outcome(validateBuildDimensions, value);
  assert.deepEqual(build, browser, `${name}: build/browser outcome`);
  assert.equal(browser.accepted, accepted, `${name}: acceptance`);
  if (!accepted) {
    assert.equal(browser.code, "schema", `${name}: error code`);
    assert.equal(typeof browser.key, "string", `${name}: error key`);
    assert.ok(browser.key.length > 0, `${name}: non-empty error key`);
  }
};

test("dimensions validators accept the real schema, optional fields, and known extensions", () => {
  const nullPrototypeRoot = Object.assign(Object.create(null), {
    dimensions: [dimension({ defaultValue: null })],
  });
  const valid = [
    actualDimensions,
    { dimensions: [dimension()] },
    { dimensions: [dimension({ defaultValue: null })] },
    { dimensions: [dimension({ defaultValue: "b" })] },
    { dimensions: [dimension({ defaultValue: [] })] },
    { dimensions: [dimension({ defaultValue: ["a", "c"] })] },
    nullPrototypeRoot,
    {
      schemaVersion: "1.0",
      name: "extended fixture",
      headlineBehaviors: 8_300_000_000,
      targetDimensions: 1,
      note: "top-level website metadata remains allowed",
      reference_sources: [{ source_id: "fixture", dimensions_claimed: 1 }],
      indexConvention: "one-based",
      personaYamlProbeFields: {
        "dimensions.x": { dimensionId: "x", index: 1 },
      },
      dimensions: [dimension({
        description: "optional renderer metadata",
        index: 1,
        defaultValue: ["a"],
        source_origin: {
          source_id: "fixture",
          source_name: "Known source extension",
          dimensions_claimed: 1,
        },
      })],
    },
  ];

  valid.forEach((value, index) => assertDifferential(value, true, `valid[${index}]`));
});

test("dimensions validators reject malformed defaults and structural fields differentially", () => {
  const sparseDimensions = new Array(1);
  const sparseValues = new Array(1);
  const sparseDefault = new Array(1);
  const invalid = [
    [[], "top-level array"],
    [null, "top-level null"],
    [{}, "missing dimensions"],
    [{ dimensions: {} }, "dimensions object"],
    [{ dimensions: sparseDimensions }, "sparse dimensions"],
    [{ dimensions: [null] }, "dimension null"],
    [{ dimensions: [dimension({ id: " " })] }, "empty id"],
    [{ dimensions: [dimension(), dimension()] }, "duplicate id"],
    [{ dimensions: [dimension({ values: [] })] }, "empty values"],
    [{ dimensions: [dimension({ values: sparseValues })] }, "sparse values"],
    [{ dimensions: [dimension({ values: [""] })] }, "empty value string"],
    [{ dimensions: [dimension({ values: [" "] })] }, "whitespace value string"],
    [{ dimensions: [dimension({ values: ["a", "a"] })] }, "duplicate values"],
    [{ dimensions: [dimension({ values: ["a", 2] })] }, "non-string value"],
    [{ dimensions: [dimension({ label: 2 })] }, "label type"],
    [{ dimensions: [dimension({ category: false })] }, "category type"],
    [{ dimensions: [dimension({ phrase: null })] }, "phrase type"],
    [{ dimensions: [dimension({ description: [] })] }, "description type"],
    [{ dimensions: [dimension({ index: "1" })] }, "index type"],
    [{ dimensions: [dimension({ defaultValue: "unknown" })] }, "unknown scalar default"],
    [{ dimensions: [dimension({ defaultValue: ["a", "unknown"] })] },
      "array default unknown member"],
    [{ dimensions: [dimension({ defaultValue: ["a", "a"] })] },
      "array default duplicate member"],
    [{ dimensions: [dimension({ defaultValue: sparseDefault })] }, "sparse array default"],
    [{ dimensions: [dimension({ defaultValue: 1 })] }, "numeric default"],
  ];

  invalid.forEach(([value, name]) => assertDifferential(value, false, name));
});

test("dimensions validators reject prototype-pollution keys and non-finite numbers recursively", () => {
  const dangerousTop = { dimensions: [dimension()] };
  Object.defineProperty(dangerousTop, "__proto__", { enumerable: true, value: {} });
  const dangerousDimension = dimension();
  Object.defineProperty(dangerousDimension, "constructor", { enumerable: true, value: {} });
  const dangerousExtension = dimension({ source_origin: {} });
  Object.defineProperty(dangerousExtension.source_origin, "prototype", {
    enumerable: true,
    value: {},
  });
  const inheritedTop = Object.assign(Object.create({ polluted: true }), {
    dimensions: [dimension()],
  });
  const dangerousValues = ["a", "b"];
  Object.defineProperty(dangerousValues, "prototype", { enumerable: true, value: {} });

  const invalid = [
    [dangerousTop, "dangerous top key"],
    [{ dimensions: [dangerousDimension] }, "dangerous dimension key"],
    [{ dimensions: [dangerousExtension] }, "dangerous nested extension key"],
    [inheritedTop, "non-ordinary top prototype"],
    [{ dimensions: [dimension({ values: dangerousValues })] }, "dangerous array key"],
    [{ headlineBehaviors: Infinity, dimensions: [dimension()] }, "non-finite top number"],
    [{ dimensions: [dimension({ index: NaN })] }, "non-finite dimension number"],
    [{ dimensions: [dimension({ source_origin: { score: -Infinity } })] },
      "non-finite nested extension number"],
  ];

  invalid.forEach(([value, name]) => assertDifferential(value, false, name));
});
