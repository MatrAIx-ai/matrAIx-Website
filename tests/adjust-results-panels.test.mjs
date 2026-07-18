import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateDimensions } from "../synthesis/dimensions-schema.js";

const savedDocument = globalThis.document;

class FakeElement {
  constructor(localName, ownerDocument) {
    this.localName = localName.toLowerCase();
    this.tagName = localName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.checked = false;
    this.type = "";
    this._text = "";
  }

  set id(value) { this.setAttribute("id", value); }
  get id() { return this.getAttribute("id") ?? ""; }
  set className(value) { this.setAttribute("class", value); }
  get className() { return this.getAttribute("class") ?? ""; }

  set textContent(value) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this._text = String(value ?? "");
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === "id") this.ownerDocument.ids.set(stringValue, this);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g,
        (_match, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(...nodes) {
    for (const value of nodes) {
      const node = value instanceof FakeElement
        ? value
        : this.ownerDocument.createTextNode(String(value));
      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this._text = "";
    this.append(...nodes);
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((item) => item !== listener));
  }

  dispatch(type, init = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      key: init.key,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

class FakeDocument {
  constructor() {
    this.ids = new Map();
    this.body = new FakeElement("body", this);
    this.activeElement = this.body;
  }

  createElement(localName) { return new FakeElement(localName, this); }
  createTextNode(text) {
    const node = new FakeElement("#text", this);
    node._text = String(text);
    return node;
  }
  getElementById(id) { return this.ids.get(id) ?? null; }
}

let document;

beforeEach(() => {
  document = new FakeDocument();
  globalThis.document = document;
});

after(() => {
  if (savedDocument === undefined) delete globalThis.document;
  else globalThis.document = savedDocument;
});

const descendants = (root) => {
  const found = [];
  const visit = (node) => {
    for (const child of node.children) {
      found.push(child);
      visit(child);
    }
  };
  visit(root);
  return found;
};

const elements = (root, localName) => descendants(root)
  .filter((node) => node.localName === localName.toLowerCase());

const byAttribute = (root, name, value) => descendants(root)
  .filter((node) => node.getAttribute(name) === String(value));

const oneByAttribute = (root, name, value) => {
  const matches = byAttribute(root, name, value);
  assert.equal(matches.length, 1, `expected one [${name}="${value}"], got ${matches.length}`);
  return matches[0];
};

const buttonNamed = (root, name) => {
  const matches = elements(root, "button").filter((button) =>
    button.getAttribute("aria-label") === name || button.textContent === name);
  assert.equal(matches.length, 1, `expected one button named ${name}, got ${matches.length}`);
  return matches[0];
};

const flushAsyncRender = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};

function makeCore() {
  const nodes = [
    {
      id: "a", label: "Alpha <script>alert(1)</script>", category: "Personality",
      description: "", values: ["a0", "a1"], prior: [0.5, 0.5], emit: true, parents: [],
    },
    {
      id: "helper", label: "Hidden helper", category: "Latent", description: "",
      values: ["h0", "h1"], prior: [0.5, 0.5], emit: false, parents: [],
    },
    {
      id: "b", label: "Beta", category: "Skills", description: "",
      values: ["b0", "b1"], prior: [0.5, 0.5], emit: true, parents: [],
    },
    {
      id: "c", label: "Gamma", category: "Lifestyle", description: "",
      values: ["c0", "c1"], prior: [0.5, 0.5], emit: true, parents: [],
    },
    {
      id: "d", label: "Delta", category: "Learning", description: "",
      values: ["d0", "d1"], prior: [0.5, 0.5], emit: true, parents: [],
    },
  ];
  return {
    formatVersion: 1,
    datasetId: `sha256:${"a".repeat(64)}`,
    nodes,
    edges: [],
    topologicalOrder: nodes.map((node) => node.id),
  };
}

function makeResult(n = 12) {
  const personaNodeIds = ["a", "helper", "b", "c", "d"];
  const personaCodes = new Uint32Array(n * personaNodeIds.length);
  for (let row = 0; row < n; row++) {
    for (let column = 0; column < personaNodeIds.length; column++) {
      personaCodes[row * personaNodeIds.length + column] = (row + column) % 2;
    }
  }
  return {
    n,
    personaNodeIds,
    personaCodes,
    marginals: {
      a: {
        label: "Alpha <img src=x>",
        values: ["a0", "a1"],
        freqs: [0.4, 0.6],
      },
    },
    baselineMarginals: {
      a: {
        label: "Alpha <img src=x>",
        values: ["a0", "a1"],
        freqs: [0.2, 0.8],
      },
    },
    effectiveConfig: {
      n,
      seed: 9,
      gammaScale: 1,
      compareBaseline: true,
      pins: { a: "a0" },
      overrides: { edgeWeights: {}, nodePriors: {}, categoryScales: {} },
      marginalNodeIds: ["a"],
    },
    flags: { helperPins: ["helper"] },
  };
}

const dimensions = {
  dimensions: ["a", "b", "c", "d", "helper"].map((id) => ({
    id,
    label: `Dimension ${id}`,
    category: id === "helper" ? "External" : "Personality",
    values: [`${id}0`, `${id}1`],
  })),
};

test("recipe helpers preserve the four upstream entry kinds and exact request shape", async () => {
  const {
    DEFAULT_CONTROLS,
    recipeKey,
    recipeKeyForErrorKey,
    recipeToRequest,
    removeRecipe,
    upsertRecipe,
  } = await import("../synthesis/adjust-panel.js");

  assert.deepEqual(DEFAULT_CONTROLS,
    { n: 20, seed: 42, gammaScale: 1, compareBaseline: false });
  const pin = { kind: "pin", nodeId: "p", label: "Pin", value: "yes" };
  const prior = {
    kind: "prior", nodeId: "q", label: "Prior", values: ["x", "y"], weights: [1, 2],
  };
  const category = { kind: "category", category: "Work", factor: 1.2 };
  const edge = {
    kind: "edge", source: "s", target: "t", sourceLabel: "S", targetLabel: "T", factor: 0.7,
  };
  assert.deepEqual([pin, prior, category, edge].map(recipeKey),
    ["pin:p", "prior:q", "category:Work", "edge:s->t"]);

  let recipe = [pin, prior, category, edge];
  recipe = upsertRecipe(recipe, { ...pin, value: "no" });
  assert.equal(recipe.length, 4);
  assert.equal(recipe[0].value, "no");
  assert.deepEqual(removeRecipe(recipe, "prior:q").map(recipeKey),
    ["pin:p", "category:Work", "edge:s->t"]);
  assert.equal(recipeKeyForErrorKey("pins.p"), "pin:p");
  assert.equal(recipeKeyForErrorKey("overrides.nodePriors.q"), "prior:q");
  assert.equal(recipeKeyForErrorKey("overrides.categoryScales.Work"), "category:Work");
  assert.equal(recipeKeyForErrorKey("overrides.edgeWeights.s->t"), "edge:s->t");
  assert.equal(recipeKeyForErrorKey("controls.n"), null);

  assert.deepEqual(recipeToRequest(recipe, DEFAULT_CONTROLS, {
    marginalNodeIds: ["center", "p", "center"],
  }), {
    n: 20,
    seed: 42,
    gammaScale: 1,
    compareBaseline: false,
    pins: { p: "no" },
    overrides: {
      edgeWeights: { "s->t": 0.7 },
      nodePriors: { q: [1, 2] },
      categoryScales: { Work: 1.2 },
    },
    marginalNodeIds: ["center", "p", "q", "t"],
  });

  const manyPins = Array.from({ length: 40 }, (_value, index) => ({
    kind: "pin", nodeId: `node-${index}`, label: `Node ${index}`, value: "on",
  }));
  const capped = recipeToRequest(manyPins, DEFAULT_CONTROLS, {
    marginalNodeIds: ["center", "center"],
  });
  assert.equal(capped.marginalNodeIds.length, 32);
  assert.deepEqual(capped.marginalNodeIds,
    ["center", ...Array.from({ length: 31 }, (_value, index) => `node-${index}`)]);
});

test("Adjust is controlled, safe, highlights validation, and keeps restart actionable", async () => {
  const { createAdjustPanel } = await import("../synthesis/adjust-panel.js");
  const rootEl = document.createElement("div");
  document.body.append(rootEl);
  const upserts = [];
  const removals = [];
  const controlsChanges = [];
  let generates = 0;
  const renderer = createAdjustPanel({
    rootEl,
    onUpsert: (entry) => upserts.push(entry),
    onRemove: (key) => removals.push(key),
    onControlsChange: (controls) => controlsChanges.push(controls),
    onGenerate: () => { generates++; },
  });
  const recipe = [
    { kind: "pin", nodeId: "helper", label: "Helper <img src=x>", value: "h1" },
    { kind: "category", category: "Work <script>", factor: 1.2 },
    {
      kind: "edge", source: "s", target: "t", sourceLabel: "Source", targetLabel: "Target",
      factor: 0.7,
    },
    {
      kind: "prior", nodeId: "a", label: "Alpha", values: ["a0", "a1"], weights: [1, 3],
    },
  ];
  const controls = { n: 20, seed: 42, gammaScale: 1, compareBaseline: false };
  renderer.render({
    recipe,
    controls,
    generating: true,
    activeJobId: 7,
    generateError: { message: "The request is invalid.", key: "overrides.edgeWeights.s->t" },
    store: { nodesById: new Map([["helper", { id: "helper", emit: false }]]) },
    results: null,
  });

  assert.equal(elements(rootEl, "script").length, 0);
  assert.equal(elements(rootEl, "img").length, 0);
  assert.match(rootEl.textContent, /Helper <img src=x>/);
  assert.equal(oneByAttribute(rootEl, "data-helper-warning", "true").textContent, "helper pin");
  const invalid = oneByAttribute(rootEl, "data-recipe-key", "edge:s->t");
  assert.equal(invalid.getAttribute("aria-invalid"), "true");
  assert.match(invalid.className, /invalid/);

  const categorySlider = oneByAttribute(rootEl, "aria-label", "Influence of Work <script>");
  assert.equal(categorySlider.type, "range");
  assert.equal(categorySlider.value, "1.2");
  assert.equal(categorySlider.min, "0");
  assert.equal(categorySlider.max, "3");
  categorySlider.focus();
  categorySlider.value = "2.3";
  categorySlider.dispatch("input");
  assert.equal(upserts.length, 0,
    "range input must stay local so a RAF rerender cannot break pointer capture mid-drag");
  assert.match(categorySlider.parentElement.textContent, /2\.3×/);
  categorySlider.dispatch("change");
  assert.deepEqual(upserts.pop(), { ...recipe[1], factor: 2.3 });
  assert.equal(categorySlider.value, "2.3");
  renderer.render({
    recipe,
    controls,
    generating: true,
    activeJobId: 7,
    generateError: null,
    store: { nodesById: new Map([["helper", { id: "helper", emit: false }]]) },
  });
  const controlledCategorySlider = oneByAttribute(
    rootEl,
    "aria-label",
    "Influence of Work <script>",
  );
  assert.equal(controlledCategorySlider.value, "1.2",
    "render(state) must restore the controlled state value");
  assert.notEqual(controlledCategorySlider, categorySlider);
  assert.equal(document.activeElement, controlledCategorySlider,
    "controlled rerenders must restore the keyed input focus");

  const priorWeight = oneByAttribute(rootEl, "aria-label", "Prior weight for Alpha = a0");
  priorWeight.value = "-4";
  priorWeight.dispatch("change");
  assert.deepEqual(upserts.pop().weights, [0, 3]);
  assert.match(rootEl.textContent, /25\.0%/);
  assert.match(rootEl.textContent, /75\.0%/);

  const nInput = oneByAttribute(rootEl, "data-control", "n");
  assert.equal(nInput.value, "20");
  nInput.value = "33";
  nInput.dispatch("change");
  assert.deepEqual(controlsChanges.pop(), { ...controls, n: 33 });
  const baseline = oneByAttribute(rootEl, "data-control", "compareBaseline");
  baseline.checked = true;
  baseline.dispatch("change");
  assert.deepEqual(controlsChanges.pop(), { ...controls, compareBaseline: true });

  const restart = buttonNamed(rootEl, "Restart with latest settings");
  assert.equal(restart.disabled, false);
  restart.dispatch("click");
  assert.equal(generates, 1);
  assert.match(oneByAttribute(rootEl, "role", "status").textContent, /job 7/i);
  assert.match(rootEl.textContent, /Pins are do\(\)-interventions/i);
  buttonNamed(rootEl, "Remove pin on Helper <img src=x>").dispatch("click");
  assert.deepEqual(removals, ["pin:helper"]);

  renderer.render({
    recipe: [], controls, generating: false, activeJobId: null, generateError: null,
    store: { nodesById: new Map() },
  });
  assert.match(rootEl.textContent, /No adjustments yet/);
  assert.equal(buttonNamed(rootEl, "Generate personas").disabled, false);

  renderer.destroy();
  assert.equal(rootEl.children.length, 0);
});

test("persona decoding keeps helpers available by id but filters them from result personas", async () => {
  const { personaAt, personaValueAt } = await import("../synthesis/results-panel.js");
  const core = makeCore();
  const result = makeResult(2);
  assert.equal(personaValueAt(result, core, 0, "helper"), "h1");
  assert.equal(personaValueAt(result, core, 1, "a"), "a1");
  assert.equal(personaValueAt(result, core, 0, "not-sampled"), null);
  assert.equal(personaValueAt(result, core, 99, "a"), null);
  assert.deepEqual({ ...personaAt(result, core, 0) },
    { a: "a0", b: "b0", c: "c1", d: "d0" });
  assert.equal(Object.getPrototypeOf(personaAt(result, core, 0)), null);

  result.personaNodeIds = ["d", "helper", "b", "a", "c"];
  result.personaCodes = new Uint32Array([1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual(Object.keys(personaAt(result, core, 0)), ["a", "b", "c", "d"],
    "assignment insertion order must follow core.nodes, not transferable column order");
});

test("Results decodes only the current page, selects with buttons, retains errors, and labels distributions", async () => {
  const { createResultsPanel, personaAt } = await import("../synthesis/results-panel.js");
  const rootEl = document.createElement("div");
  document.body.append(rootEl);
  const core = makeCore();
  const result = makeResult();
  const manifest = { datasetId: core.datasetId, artifacts: { dimensions: {} } };
  const decodedRows = [];
  const selected = [];
  const loads = [];
  const renderer = createResultsPanel({
    rootEl,
    onOverlayIndexChange: (row) => selected.push(row),
    personaDecoder(currentResult, currentCore, row) {
      decodedRows.push(row);
      return personaAt(currentResult, currentCore, row);
    },
    async loadAuxJson(currentManifest, key, options) {
      loads.push({ currentManifest, key, validate: options.validate });
      options.validate(dimensions);
      return dimensions;
    },
  });
  const state = {
    results: result,
    generateError: null,
    store: { core },
    manifest,
    overlayIndex: null,
  };
  renderer.render(state);

  assert.deepEqual(decodedRows, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(elements(rootEl, "table").length, 1);
  assert.ok(elements(rootEl, "thead")[0].children[0].children
    .every((heading) => heading.getAttribute("scope") === "col"));
  assert.equal(elements(rootEl, "tbody")[0].children.length, 10);
  assert.equal(elements(rootEl, "script").length, 0);
  assert.equal(elements(rootEl, "img").length, 0);
  assert.doesNotMatch(rootEl.textContent, /Hidden helper|h0|h1/);
  assert.match(rootEl.textContent, /Alpha <script>alert\(1\)<\/script>/);

  const selectFirst = buttonNamed(rootEl, "Select persona #1");
  const firstRow = elements(rootEl, "tbody")[0].children[0];
  assert.equal(selectFirst.getAttribute("aria-pressed"), "false");
  selectFirst.focus();
  decodedRows.length = 0;
  selectFirst.dispatch("click");
  assert.deepEqual(selected, [0]);
  assert.deepEqual(decodedRows, [], "selection must not decode or rebuild the results table");
  assert.ok(descendants(rootEl).includes(selectFirst), "selection must preserve button identity and focus");
  assert.equal(document.activeElement, selectFirst);
  assert.equal(selectFirst.getAttribute("aria-pressed"), "true");
  assert.equal(selectFirst.textContent, "Selected for graph");
  assert.match(firstRow.className, /selected/);

  const firstAttributes = oneByAttribute(rootEl, "data-persona-attributes", "0");
  assert.equal(firstAttributes.children.length, 3);
  buttonNamed(rootEl, "Show all attributes for persona #1").dispatch("click");
  assert.equal(oneByAttribute(rootEl, "data-persona-attributes", "0").children.length, 4);

  assert.equal(loads.length, 0, "persona text must be lazy");
  buttonNamed(rootEl, "Render text for persona #1").dispatch("click");
  await flushAsyncRender();
  assert.equal(loads.length, 1);
  assert.equal(loads[0].currentManifest, manifest);
  assert.equal(loads[0].key, "dimensions");
  assert.equal(loads[0].validate, validateDimensions);
  assert.match(rootEl.textContent, /Personality & values:/);
  assert.doesNotMatch(rootEl.textContent, /Dimension helper/);

  decodedRows.length = 0;
  buttonNamed(rootEl, "Next result page").dispatch("click");
  assert.deepEqual(decodedRows, [10, 11]);
  assert.equal(elements(rootEl, "tbody")[0].children.length, 2);

  renderer.render({
    ...state,
    generateError: { message: "Generation failed. Retry with the verified snapshot.", key: null },
  });
  assert.equal(oneByAttribute(rootEl, "role", "alert").textContent,
    "Generation failed. Retry with the verified snapshot.");
  assert.equal(elements(rootEl, "tbody")[0].children.length, 2,
    "a later failure must preserve the previous successful result");
  assert.match(rootEl.textContent, /20\.0% → 40\.0%/);
  assert.match(rootEl.textContent, /80\.0% → 60\.0%/);
  assert.equal(byAttribute(rootEl, "data-series", "baseline").length, 2);
  assert.equal(byAttribute(rootEl, "data-series", "adjusted").length, 2);
  renderer.destroy();
});

test("dimension rejection is not cached and Retry loads and renders again", async () => {
  const { createResultsPanel } = await import("../synthesis/results-panel.js");
  const rootEl = document.createElement("div");
  const core = makeCore();
  const manifest = { datasetId: core.datasetId, artifacts: { dimensions: {} } };
  let attempts = 0;
  const renderer = createResultsPanel({
    rootEl,
    onOverlayIndexChange() {},
    async loadAuxJson(_manifest, _key, options) {
      attempts++;
      if (attempts === 1) throw new Error("private URL and stack");
      options.validate(dimensions);
      return dimensions;
    },
  });
  renderer.render({
    results: makeResult(1),
    generateError: null,
    store: { core },
    manifest,
    overlayIndex: null,
  });
  buttonNamed(rootEl, "Render text for persona #1").dispatch("click");
  await flushAsyncRender();
  assert.equal(attempts, 1);
  assert.match(rootEl.textContent, /Persona text dimensions could not be verified\./);
  assert.doesNotMatch(rootEl.textContent, /private URL|stack/);
  buttonNamed(rootEl, "Retry persona text for persona #1").dispatch("click");
  await flushAsyncRender();
  assert.equal(attempts, 2);
  assert.match(rootEl.textContent, /Personality & values:/);
  renderer.render({
    results: null,
    generateError: null,
    store: { core },
    manifest,
    overlayIndex: null,
  });
  assert.match(rootEl.textContent, /Generate a batch in the panel above/);
  renderer.destroy();
});

test("HTML has exactly five independent expandable panels on immutable runtime v2", () => {
  const html = readFileSync(new URL("../synthesis.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../synthesis.css", import.meta.url), "utf8");
  const adjustSource = readFileSync(new URL("../synthesis/adjust-panel.js", import.meta.url), "utf8");
  const resultsSource = readFileSync(new URL("../synthesis/results-panel.js", import.meta.url), "utf8");

  assert.equal((html.match(/<section class="syn-panel"/g) ?? []).length, 5);
  assert.match(html, /id="panelGenerate"[\s\S]*?id="adjustPanel"/);
  assert.match(html, /data-panel="panelGenerate"[\s\S]*?aria-controls="generatePanelBody"/);
  assert.match(html, /id="panelResults"[\s\S]*?id="resultsPanel"/);
  assert.match(html, /data-panel="panelResults"[\s\S]*?aria-controls="resultsPanelBody"/);
  assert.match(html, /href="synthesis\/releases\/v2\/synthesis\.css"/);
  assert.match(html, /src="synthesis\/releases\/v2\/app\.js"/);
  assert.doesNotMatch(html, /releases\/v1|(?:src|href)="synthesis\/(?:app\.js|synthesis\.css)"/);
  assert.match(css, /\.syn-adjust\s*\{/);
  assert.match(css, /\.syn-results\s*\{/);
  assert.match(css, /\.syn-dist-series\s*\{/);
  assert.doesNotMatch(adjustSource, /\.innerHTML\b/);
  assert.doesNotMatch(resultsSource, /\.innerHTML\b/);
});
