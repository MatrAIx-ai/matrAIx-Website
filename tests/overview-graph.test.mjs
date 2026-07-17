import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOverviewRenderer } from "../synthesis/overview-graph.js";

const savedGlobals = {
  document: globalThis.document,
  ResizeObserver: globalThis.ResizeObserver,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
};

class FakeElement {
  constructor(localName, ownerDocument) {
    this.localName = localName.toLowerCase();
    this.tagName = localName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.rect = { width: 0, height: 0 };
    this._text = "";
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

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
      const key = name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  append(...nodes) {
    for (const node of nodes) {
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

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, init = {}) {
    const event = {
      type,
      key: init.key,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  focus(options) {
    this.ownerDocument.activeElement = this;
    this.lastFocusOptions = options;
  }

  getBoundingClientRect() {
    return { ...this.rect };
  }
}

function matchesSelector(node, selector) {
  if (selector === "[data-focus-key]") return typeof node.dataset.focusKey === "string";
  if (selector.startsWith(".")) {
    return node.className.split(/\s+/).filter(Boolean).includes(selector.slice(1));
  }
  return node.localName === selector.toLowerCase();
}

class FakeDocument {
  constructor() {
    this.ids = new Map();
    this.body = new FakeElement("body", this);
    this.activeElement = this.body;
  }

  createElement(localName) {
    return new FakeElement(localName, this);
  }

  createElementNS(_namespace, localName) {
    return new FakeElement(localName, this);
  }

  getElementById(id) {
    return this.ids.get(id) ?? null;
  }
}

let document;
let resizeObservers;
let frames;
let canceledFrames;
let nextFrameId;

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    this.disconnected = false;
    resizeObservers.push(this);
  }

  observe(target) {
    this.observed.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger() {
    this.callback();
  }
}

beforeEach(() => {
  document = new FakeDocument();
  resizeObservers = [];
  frames = new Map();
  canceledFrames = [];
  nextFrameId = 1;
  globalThis.document = document;
  globalThis.ResizeObserver = FakeResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    canceledFrames.push(id);
    frames.delete(id);
  };
});

after(() => {
  for (const [name, value] of Object.entries(savedGlobals)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
});

const LONG_CATEGORY = "Category with a deliberately long name";

function makeCategory(name, attributeCount, helperCount = 0) {
  return {
    name,
    nodeCount: attributeCount + helperCount,
    attributeCount,
    helperCount,
    avgTopo: 0,
    internalEdgeCount: attributeCount + 3,
    attributes: Array.from({ length: attributeCount }, (_unused, index) => ({
      id: name + "-attr-" + (index + 1),
      label: index === 0 ? "Full attribute <label> one" : "Attribute " + (index + 1),
      valuesCount: index + 2,
      degree: index + 5,
    })),
  };
}

function makeOverview() {
  const categories = [
    makeCategory(LONG_CATEGORY, 16, 2),
    makeCategory("Beta", 9, 1),
    makeCategory("Gamma", 4, 0),
    makeCategory("Uncategorized", 0, 3),
  ];
  const edges = Array.from({ length: 82 }, (_unused, index) => ({
    source: categories[index % 3].name,
    target: categories[(index + 1) % 3].name,
    count: 100 - index,
    weightSum: 200 - index,
  }));
  return { categories, edges, counts: {} };
}

function mount(callbacks = {}) {
  const heading = document.createElement("h2");
  heading.id = "overviewTitle";
  const container = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.rect = { width: 400, height: 200 };
  const listEl = document.createElement("aside");
  container.append(svg, listEl);
  document.body.append(heading, container);

  const selectedCategories = [];
  const selectedNodes = [];
  const renderer = createOverviewRenderer({
    svg,
    listEl,
    onSelectCategory: callbacks.onSelectCategory ?? ((name) => selectedCategories.push(name)),
    onSelectNode: callbacks.onSelectNode ?? ((id) => selectedNodes.push(id)),
  });
  return { heading, container, svg, listEl, renderer, selectedCategories, selectedNodes };
}

function state(overrides = {}) {
  return {
    overview: makeOverview(),
    selectedCategory: null,
    centerNode: null,
    ...overrides,
  };
}

function flushFrames() {
  const queued = [...frames.entries()];
  frames.clear();
  for (const [_id, callback] of queued) callback();
}

test("renders safe empty states before data and for selected or unselected empty categories", () => {
  const { svg, listEl, renderer } = mount();

  assert.doesNotThrow(() => renderer.render({ overview: null }));
  assert.equal(svg.children.length, 0);
  assert.equal(listEl.querySelectorAll(".syn-empty")[0].textContent,
    "Select a category to list its attributes.");

  renderer.render(state({ selectedCategory: "missing" }));
  assert.equal(listEl.querySelectorAll(".syn-empty")[0].textContent,
    "Select a category to list its attributes.");

  renderer.render(state({ selectedCategory: "Uncategorized" }));
  assert.equal(listEl.querySelectorAll("h3")[0].textContent, "Uncategorized · 0");
  assert.equal(listEl.querySelectorAll("button").length, 0);
  assert.equal(listEl.querySelectorAll(".syn-empty")[0].textContent,
    "This category has no attributes.");
});

test("renders deterministic finite geometry, capped weighted edges, and complete category semantics", () => {
  const { svg, renderer } = mount();
  const overview = makeOverview();
  renderer.render(state({ overview }));

  assert.equal(svg.getAttribute("viewBox"), "0 0 400 200");
  const edges = svg.querySelectorAll(".syn-edge");
  assert.equal(edges.length, 80);
  assert.equal(svg.querySelectorAll("defs").length, 1);
  const marker = svg.querySelectorAll("marker")[0];
  assert.equal(marker.id, "syn-overview-arrow");
  assert.equal(marker.querySelectorAll(".syn-edge-arrow").length, 1);
  assert.ok(edges.every((edge) =>
    edge.getAttribute("marker-end") === "url(#syn-overview-arrow)"));
  assert.equal(edges[0].getAttribute("stroke-width"), "3.00");
  assert.equal(edges[0].querySelectorAll("title")[0].textContent,
    LONG_CATEGORY + " → Beta · 100 edges");
  assert.doesNotMatch(edges.map((edge) => edge.getAttribute("d")).join(" "), /NaN|Infinity/);

  const groups = svg.querySelectorAll(".syn-cat-node");
  assert.equal(groups.length, 4);
  const first = groups[0];
  assert.equal(first.getAttribute("role"), "button");
  assert.equal(first.getAttribute("tabindex"), "0");
  assert.equal(first.getAttribute("aria-label"),
    LONG_CATEGORY + ": 18 nodes, 16 attributes, 2 helpers, 19 internal edges");
  assert.equal(first.getAttribute("aria-pressed"), "false");
  assert.equal(first.dataset.focusKey, "category:" + LONG_CATEGORY);

  const mark = first.querySelectorAll(".syn-cat-mark")[0];
  const hit = first.querySelectorAll(".syn-cat-hit")[0];
  assert.equal(Number(mark.getAttribute("r")), 22);
  assert.ok(Number(hit.getAttribute("r")) >= 20);
  assert.match(hit.getAttribute("style"), /fill:\s*transparent/);
  assert.match(hit.getAttribute("style"), /stroke:\s*transparent/);
  assert.match(hit.getAttribute("style"), /pointer-events:\s*all/);
  assert.equal(first.querySelectorAll("text")[0].textContent,
    LONG_CATEGORY.slice(0, 21) + "…");
  assert.equal(first.querySelectorAll("title")[0].textContent,
    LONG_CATEGORY + "\n18 nodes · 16 attributes · 2 helpers · 19 internal edges");

  const betaMark = groups[1].querySelectorAll(".syn-cat-mark")[0];
  const endpoint = edges[0].getAttribute("d").trim().split(/\s+/).slice(-2).map(Number);
  assert.notDeepEqual(endpoint, [
    Number(betaMark.getAttribute("cx")),
    Number(betaMark.getAttribute("cy")),
  ]);

  const firstPath = edges[0].getAttribute("d");
  const firstX = mark.getAttribute("cx");
  renderer.render(state({ overview }));
  assert.equal(svg.querySelectorAll(".syn-edge")[0].getAttribute("d"), firstPath);
  assert.equal(svg.querySelectorAll(".syn-cat-mark")[0].getAttribute("cx"), firstX);
});

test("shortens only visible labels for a 390px dense layout", () => {
  const { svg, renderer } = mount();
  const denseCategories = Array.from({ length: 44 }, (_unused, index) =>
    makeCategory(index === 0 ? LONG_CATEGORY : "Category " + index, 1, 0));
  const overview = { categories: denseCategories, edges: [], counts: {} };

  svg.rect = { width: 1200, height: 620 };
  renderer.render(state({ overview }));
  const wideLabel = svg.querySelectorAll(".syn-cat-node")[0]
    .querySelectorAll("text")[0].textContent;

  svg.rect = { width: 390, height: 620 };
  renderer.render(state({ overview }));
  const first = svg.querySelectorAll(".syn-cat-node")[0];
  const narrowLabel = first.querySelectorAll("text")[0].textContent;

  assert.ok(narrowLabel.length < wideLabel.length);
  assert.ok(narrowLabel.endsWith("…"));
  assert.equal(first.getAttribute("aria-label"),
    LONG_CATEGORY + ": 1 node, 1 attribute, 0 helpers, 4 internal edges");
  assert.equal(first.querySelectorAll("title")[0].textContent,
    LONG_CATEGORY + "\n1 node · 1 attribute · 0 helpers · 4 internal edges");
});

test("category controls send click and keyboard payloads with Enter and Space prevention", () => {
  const { svg, renderer, selectedCategories } = mount();
  renderer.render(state());
  const control = svg.querySelectorAll(".syn-cat-node")[1];

  control.dispatch("click");
  const enter = control.dispatch("keydown", { key: "Enter" });
  const space = control.dispatch("keydown", { key: " " });
  const arrow = control.dispatch("keydown", { key: "ArrowDown" });

  assert.deepEqual(selectedCategories, ["Beta", "Beta", "Beta"]);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(space.defaultPrevented, true);
  assert.equal(arrow.defaultPrevented, false);
});

test("selected category and centered attribute expose redundant state and full list metadata", () => {
  const overview = makeOverview();
  const centeredId = overview.categories[0].attributes[0].id;
  const { svg, listEl, renderer, selectedNodes } = mount();
  renderer.render(state({
    overview,
    selectedCategory: LONG_CATEGORY,
    centerNode: centeredId,
  }));

  const groups = svg.querySelectorAll(".syn-cat-node");
  assert.equal(groups[0].getAttribute("aria-pressed"), "true");
  assert.equal(groups[1].getAttribute("aria-pressed"), "false");
  assert.equal(listEl.querySelectorAll("h3")[0].textContent, LONG_CATEGORY + " · 16");

  const buttons = listEl.querySelectorAll("button");
  assert.equal(buttons.length, 16);
  assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
  assert.equal(buttons[0].className, "active");
  assert.equal(buttons[0].textContent, "Full attribute <label> one2v · 5°");
  assert.equal(buttons[1].getAttribute("aria-pressed"), "false");

  buttons[0].dispatch("click");
  assert.deepEqual(selectedNodes, [centeredId]);
});

test("restores keyed focus across redraw and falls back to the overview heading when a key disappears", () => {
  const overview = makeOverview();
  const { heading, svg, listEl, renderer } = mount();
  renderer.render(state({ overview, selectedCategory: LONG_CATEGORY }));

  const beta = svg.querySelectorAll(".syn-cat-node")[1];
  beta.focus();
  renderer.render(state({ overview, selectedCategory: LONG_CATEGORY }));
  const restoredBeta = svg.querySelectorAll(".syn-cat-node")[1];
  assert.notEqual(restoredBeta, beta);
  assert.equal(document.activeElement, restoredBeta);
  assert.deepEqual(restoredBeta.lastFocusOptions, { preventScroll: true });

  const attribute = listEl.querySelectorAll("button")[0];
  attribute.focus();
  renderer.render(state({ overview, selectedCategory: "Beta" }));
  assert.equal(document.activeElement, heading);
  assert.deepEqual(heading.lastFocusOptions, { preventScroll: true });

  const gamma = svg.querySelectorAll(".syn-cat-node")[2];
  gamma.focus();
  renderer.render(state({
    overview: { ...overview, categories: overview.categories.slice(0, 2) },
    selectedCategory: null,
  }));
  assert.equal(document.activeElement, heading);
});

test("coalesces resize redraws, clamps zero-size geometry, and cancels pending work on destroy", () => {
  const { container, svg, renderer } = mount();
  svg.rect = { width: 0, height: 0 };
  renderer.render(state());

  assert.equal(resizeObservers.length, 1);
  assert.deepEqual(resizeObservers[0].observed, [container]);
  assert.equal(svg.getAttribute("viewBox"), "0 0 1 1");
  assert.doesNotMatch(svg.querySelectorAll(".syn-edge")
    .map((edge) => edge.getAttribute("d")).join(" "), /NaN|Infinity/);

  svg.rect = { width: 300, height: 120 };
  resizeObservers[0].trigger();
  resizeObservers[0].trigger();
  assert.equal(frames.size, 1);
  assert.equal(svg.getAttribute("viewBox"), "0 0 1 1");
  flushFrames();
  assert.equal(svg.getAttribute("viewBox"), "0 0 300 120");

  resizeObservers[0].trigger();
  const pendingId = [...frames.keys()][0];
  renderer.destroy();
  assert.equal(resizeObservers[0].disconnected, true);
  assert.deepEqual(canceledFrames, [pendingId]);
  assert.equal(frames.size, 0);
});

test("keeps a 620px mobile graph canvas and styles visible edge arrows", () => {
  const css = readFileSync(new URL("../synthesis.css", import.meta.url), "utf8");
  assert.match(css, /\.syn-edge-arrow\s*\{/);
  assert.match(css,
    /\.syn-cat-node:focus-visible circle,[\s\S]*?\{[^}]*stroke:\s*var\(--syn-ink\);[^}]*stroke-width:\s*3;/);
  assert.match(css,
    /@media \(max-width: 860px\)[\s\S]*?\.syn-overview-layout\s*\{[^}]*height:\s*auto;[^}]*grid-template-rows:\s*minmax\(620px,\s*auto\)/);
  assert.match(css,
    /@media \(max-width: 860px\)[\s\S]*?\.syn-overview-layout > \.syn-svg\s*\{[^}]*min-height:\s*620px;/);
});

test("app statically imports and registers only the overview renderer slices", () => {
  const app = readFileSync(new URL("../synthesis/app.js", import.meta.url), "utf8");
  assert.match(app,
    /^import \{ createOverviewRenderer \} from "\.\/overview-graph\.js";$/m);
  assert.match(app, /registerRenderer\(createOverviewRenderer\(\{/);
  assert.match(app,
    /setState\(\{ centerNode: id, selectedNode: id \}, \{ historyMode: "push" \}\)/);
  assert.match(app,
    /\}\), \{ slices: \["overview", "selectedCategory", "centerNode"\] \}\);/);
});
