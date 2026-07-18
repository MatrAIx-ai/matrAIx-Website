import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadDims, renderPersona } from "../synthesis/render-persona.js";

const dimensionsData = JSON.parse(readFileSync(
  new URL("../data/dimensions.json", import.meta.url),
));
const dims = loadDims(dimensionsData);
const golden = JSON.parse(readFileSync(
  new URL("./fixtures/render.golden.json", import.meta.url),
));

const dimension = ({
  id,
  value,
  category = "Personality",
  phrase = `${id} is {value}`,
  ...extra
}) => ({
  id,
  label: id,
  values: [value],
  category,
  phrase,
  ...extra,
});

const schemaError = (key) => (error) => (
  error?.name === "DimensionsSchemaError"
  && error.code === "schema"
  && error.key === key
);

test("rendered text matches Python render() byte-for-byte", () => {
  for (const [index, entry] of golden.entries()) {
    assert.equal(
      renderPersona(entry.attributes, dims),
      entry.text,
      `persona #${index}`,
    );
  }
});

test("article correction matches Python for words and uppercase initialisms", () => {
  const articleDims = loadDims({
    dimensions: [
      dimension({ id: "mba", value: "MBA", category: "Expertise", phrase: "holds a {value}" }),
      dimension({ id: "user", value: "user", category: "Expertise", phrase: "is an {value}" }),
      dimension({ id: "cpu", value: "CPU", category: "Expertise", phrase: "uses an {value}" }),
      dimension({ id: "title", value: "MBA", category: "Expertise", phrase: "A {value} specialist" }),
    ],
  });

  assert.equal(
    renderPersona({ mba: "MBA", user: "user", cpu: "CPU", title: "MBA" }, articleDims),
    "Skills & tools: holds an MBA; is an user; uses a CPU; An MBA specialist.",
  );
});

test("defaultValue filters scalar and array defaults but not null or missing defaults", () => {
  const defaultDims = loadDims({
    dimensions: [
      dimension({ id: "scalar", value: "None", defaultValue: "None" }),
      {
        id: "array",
        label: "array",
        values: ["Unknown", "Shown"],
        category: "Personality",
        phrase: "array is {value}",
        defaultValue: ["Unknown"],
      },
      dimension({ id: "null_default", value: "None", defaultValue: null }),
      dimension({ id: "missing_default", value: "Present" }),
    ],
  });

  assert.equal(
    renderPersona({
      scalar: "None",
      array: "Unknown",
      null_default: "None",
      missing_default: "Present",
    }, defaultDims),
    "Personality & values: null_default is None; missing_default is Present.",
  );
  assert.equal(
    renderPersona({ array: "Shown" }, defaultDims),
    "Personality & values: array is Shown.",
  );
});

test("core and bucket order, exclusions, insertion order, and bucket caps match Python", () => {
  const orderingDims = loadDims({
    dimensions: [
      dimension({ id: "gender_identity", value: "X", category: "Demographic", phrase: "identifying as {value}" }),
      dimension({ id: "age_bracket", value: "30", category: "Demographic", phrase: "aged {value}" }),
      dimension({ id: "learn", value: "L", category: "Learning" }),
      dimension({ id: "health", value: "H", category: "Health" }),
      dimension({ id: "p1", value: "V1" }),
      dimension({ id: "p2", value: "V2" }),
      dimension({ id: "p3", value: "V3" }),
      dimension({ id: "defaulted", value: "skip", defaultValue: "skip" }),
      dimension({ id: "external", value: "skip", category: "External: Imported" }),
      dimension({ id: "wiki_hidden", value: "skip" }),
      dimension({ id: "intent", value: "skip" }),
      dimension({ id: "other", value: "skip", category: "Unbucketed" }),
    ],
  });
  const assignment = {
    learn: "L",
    gender_identity: "X",
    p3: "V3",
    health: "H",
    age_bracket: "30",
    wiki_hidden: "skip",
    external: "skip",
    intent: "skip",
    unknown: "skip",
    defaulted: "skip",
    other: "skip",
    p1: "V1",
    p2: "V2",
  };

  assert.equal(
    renderPersona(assignment, orderingDims, { maxClausesPerBucket: 2 }),
    [
      "A persona aged 30, identifying as X.",
      "Personality & values: p3 is V3; p1 is V1; and 1 more salient attributes.",
      "Lifestyle & health: health is H.",
      "Learning: learn is L.",
    ].join("\n"),
  );
  assert.equal(
    renderPersona(assignment, orderingDims, { maxClausesPerBucket: null }),
    [
      "A persona aged 30, identifying as X.",
      "Personality & values: p3 is V3; p1 is V1; p2 is V2.",
      "Lifestyle & health: health is H.",
      "Learning: learn is L.",
    ].join("\n"),
  );
});

test("loadDims delegates to the strict dimensions schema and preserves valid extensions", () => {
  assert.throws(() => loadDims(null), schemaError("$"));
  assert.throws(() => loadDims({}), schemaError("dimensions"));
  assert.throws(
    () => loadDims({
      dimensions: [
        dimension({ id: "duplicate", value: "x" }),
        dimension({ id: "duplicate", value: "y" }),
      ],
    }),
    schemaError("dimensions[1].id"),
  );
  assert.throws(
    () => loadDims({ dimensions: [dimension({ id: "phrase", value: "x", phrase: 1 })] }),
    schemaError("dimensions[0].phrase"),
  );
  assert.throws(
    () => loadDims({
      dimensions: [{
        id: "scalar_default",
        values: ["known"],
        defaultValue: "unknown",
      }],
    }),
    schemaError("dimensions[0].defaultValue"),
  );
  assert.throws(
    () => loadDims({
      dimensions: [{
        id: "array_default",
        values: ["known"],
        defaultValue: ["known", "unknown"],
      }],
    }),
    schemaError("dimensions[0].defaultValue[1]"),
  );
  assert.throws(
    () => loadDims({ dimensions: [dimension({ id: "finite", value: "x", score: Infinity })] }),
    schemaError("$.dimensions[0].score"),
  );
  assert.throws(
    () => loadDims(JSON.parse('{"dimensions":[],"__proto__":{}}')),
    schemaError("$.__proto__"),
  );

  const extended = dimension({ id: "extended", value: "x", extension: { enabled: true } });
  const loaded = loadDims({ dimensions: [extended], metadata: { version: 1 } });
  assert.equal(loaded.size, 1);
  assert.equal(loaded.get("extended"), extended);
});
