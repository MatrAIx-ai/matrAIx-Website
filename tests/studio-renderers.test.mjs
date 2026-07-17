import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGraphStore } from "../synthesis/graph-store.js";
import { createDrilldownRenderer } from "../synthesis/drilldown-graph.js";
import { createDetailRail } from "../synthesis/detail-rail.js";

const savedGlobals = {
  document: globalThis.document,
  ResizeObserver: globalThis.ResizeObserver,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
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
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.clientWidth = 320;
    this.clientHeight = 180;
    this.scrollCalls = [];
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
      const key = name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const enabled = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (enabled) this.setAttribute(name, "");
    else this.removeAttribute(name);
    return enabled;
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
      shiftKey: Boolean(init.shiftKey),
      detail: init.detail ?? 1,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  focus(options) {
    this.ownerDocument.activeElement = this;
    this.lastFocusOptions = options;
  }

  scrollTo(options) {
    this.scrollCalls.push({ ...options });
    this.scrollLeft = options.left;
    this.scrollTop = options.top;
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

  createElement(localName) { return new FakeElement(localName, this); }
  createElementNS(_namespace, localName) { return new FakeElement(localName, this); }
  getElementById(id) { return this.ids.get(id) ?? null; }
}

let document;
let resizeObservers;
let frames;
let canceledFrames;
let timers;
let nextWorkId;

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    this.disconnected = false;
    resizeObservers.push(this);
  }

  observe(target) { this.observed.push(target); }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback(); }
}

beforeEach(() => {
  document = new FakeDocument();
  resizeObservers = [];
  frames = new Map();
  canceledFrames = [];
  timers = new Map();
  nextWorkId = 1;
  globalThis.document = document;
  globalThis.ResizeObserver = FakeResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextWorkId++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    canceledFrames.push(id);
    frames.delete(id);
  };
  globalThis.setTimeout = (callback, delay) => {
    const id = nextWorkId++;
    timers.set(id, { callback, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
});

after(() => {
  for (const [name, value] of Object.entries(savedGlobals)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
});

function flushFrames() {
  const queued = [...frames.values()];
  frames.clear();
  for (const callback of queued) callback();
}

function flushTimers() {
  const queued = [...timers.values()];
  timers.clear();
  for (const { callback } of queued) callback();
}

function makeStore() {
  return createGraphStore({
    nodes: [
      { id: "a", label: "Root <script>alert(1)</script>", category: "Origin & input",
        description: "Description </p><img src=x>", values: ["yes", "no"],
        prior: [0.75, 0.25], emit: true },
      { id: "h", label: "Helper zero", category: "Latent", description: "hidden",
        values: [], prior: [], emit: false },
      { id: "b", label: "Selected B with a deliberately long label", category: "Middle",
        values: ["only"], prior: [1], emit: true },
      { id: "c", label: "Leaf C", category: "Outcome", values: ["c0", "c1"],
        prior: [0.4, 0.6], emit: true },
    ],
    edges: [
      { source: "a", target: "h", weight: 0.5, relation: "primes helper" },
      { source: "a", target: "b", weight: 2, relation: "strongly drives" },
      { source: "h", target: "c", weight: 1, relation: "reveals" },
    ],
    topologicalOrder: ["a", "h", "b", "c"],
  });
}

function mountDrilldown(callbacks = {}) {
  const heading = document.createElement("h2");
  heading.id = "drilldownTitle";
  const panel = document.createElement("div");
  panel.clientWidth = 240;
  panel.clientHeight = 100;
  const emptyEl = document.createElement("div");
  const truncatedEl = document.createElement("span");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  panel.append(emptyEl, svg);
  document.body.append(heading, truncatedEl, panel);
  const selected = [];
  const centered = [];
  const renderer = createDrilldownRenderer({
    svg,
    emptyEl,
    truncatedEl,
    onSelectNode: callbacks.onSelectNode ?? ((id) => selected.push(id)),
    onCenterNode: callbacks.onCenterNode ?? ((id) => centered.push(id)),
  });
  return { heading, panel, emptyEl, truncatedEl, svg, renderer, selected, centered };
}

function mountDetail(callbacks = {}) {
  const heading = document.createElement("h2");
  heading.id = "detailTitle";
  const rootEl = document.createElement("div");
  document.body.append(heading, rootEl);
  const selected = [];
  const centered = [];
  const renderer = createDetailRail({
    rootEl,
    onSelectNode: callbacks.onSelectNode ?? ((id) => selected.push(id)),
    onCenterNode: callbacks.onCenterNode ?? ((id) => centered.push(id)),
  });
  return { heading, rootEl, renderer, selected, centered };
}

function drillState(overrides = {}) {
  return { store: makeStore(), centerNode: "a", selectedNode: "c", up: 0, down: 2, ...overrides };
}

function nodeGroup(svg, id) {
  return svg.querySelectorAll(".syn-dd-node")
    .find((node) => node.dataset.focusKey === `node:${id}`);
}

test("drilldown clears stale canvas and detail remains strictly selected-only", () => {
  const drill = mountDrilldown();
  drill.renderer.render(drillState());
  assert.ok(drill.svg.children.length > 0);
  assert.equal(drill.emptyEl.hidden, true);

  const focused = nodeGroup(drill.svg, "c");
  focused.focus();
  focused.dispatch("click");
  assert.equal(timers.size, 1);
  assert.equal(frames.size, 1);
  drill.renderer.render(drillState({ centerNode: null, selectedNode: null }));
  assert.equal(drill.svg.children.length, 0);
  assert.equal(drill.svg.getAttribute("viewBox"), null);
  assert.equal(drill.svg.getAttribute("width"), null);
  assert.equal(drill.svg.style.width, "");
  assert.equal(drill.svg.hidden, true);
  assert.equal(drill.emptyEl.hidden, false);
  assert.equal(drill.truncatedEl.hidden, true);
  assert.equal(timers.size, 0);
  assert.equal(frames.size, 0);
  assert.equal(document.activeElement, drill.heading);

  const detail = mountDetail();
  detail.renderer.render({ store: makeStore(), centerNode: "a", selectedNode: null });
  assert.equal(detail.rootEl.textContent, "Select a node to inspect priors and edges.");
  assert.equal(detail.rootEl.querySelectorAll("h3").length, 0);
});

test("drilldown renders deterministic intrinsic geometry, ordered layers, weighted arrows, and real truncation", () => {
  const { svg, truncatedEl, renderer } = mountDrilldown();
  renderer.render(drillState());

  assert.equal(svg.getAttribute("viewBox"), "0 0 672 128");
  assert.equal(svg.getAttribute("width"), "672");
  assert.equal(svg.getAttribute("height"), "128");
  assert.equal(svg.style.width, "672px");
  assert.equal(svg.style.height, "128px");
  assert.deepEqual(svg.querySelectorAll(".syn-dd-node").map((node) => node.dataset.focusKey),
    ["node:a", "node:h", "node:b", "node:c"]);

  const marker = svg.querySelectorAll("marker")[0];
  assert.equal(marker.id, "syn-drilldown-arrow");
  assert.equal(marker.querySelectorAll(".syn-edge-arrow").length, 1);
  const edges = svg.querySelectorAll(".syn-edge");
  assert.equal(edges.length, 3);
  assert.ok(edges.every((edge) => edge.getAttribute("marker-end") === "url(#syn-drilldown-arrow)"));
  assert.deepEqual(edges.map((edge) => edge.getAttribute("stroke-width")), ["2.50", "1.00", "1.50"]);
  assert.ok(edges.every((edge) => Number(edge.dataset.sourceLayer) < Number(edge.dataset.targetLayer)));
  assert.match(edges[0].querySelectorAll("title")[0].textContent,
    /Root <script>alert\(1\)<\/script> → Selected B.*w=2.*strongly drives/);
  assert.match(edges[0].getAttribute("d"), /C/);

  const core = JSON.parse(readFileSync(new URL("../synthesis/data/graph-core.v1.json", import.meta.url)));
  renderer.render({ store: createGraphStore(core), centerNode: "domain", selectedNode: null, up: 3, down: 3 });
  assert.equal(svg.querySelectorAll(".syn-dd-node").length, 61);
  assert.equal(svg.querySelectorAll(".syn-edge").length, 60);
  assert.equal(svg.getAttribute("viewBox"), "0 0 434 2796");
  assert.equal(svg.style.width, "434px");
  assert.equal(svg.style.height, "2796px");
  assert.equal(truncatedEl.hidden, false);
  assert.equal(truncatedEl.textContent, "truncated to 60/direction");
});

test("drilldown exposes independent center, selected, helper, hit-target, full-text, and safe DOM semantics", () => {
  const { svg, renderer } = mountDrilldown();
  renderer.render(drillState({ centerNode: "h", selectedNode: "c", up: 1, down: 1 }));

  const center = nodeGroup(svg, "h");
  const selected = nodeGroup(svg, "c");
  const helper = nodeGroup(svg, "h");
  assert.match(center.className, /\bcenter\b/);
  assert.doesNotMatch(center.className, /\bselected\b/);
  assert.equal(center.getAttribute("aria-current"), "true");
  assert.equal(center.getAttribute("aria-pressed"), "false");
  assert.match(center.getAttribute("aria-label"), /latent\/helper/);
  assert.match(center.getAttribute("aria-label"), /current center/);
  assert.match(selected.className, /\bselected\b/);
  assert.equal(selected.getAttribute("aria-current"), null);
  assert.equal(selected.getAttribute("aria-pressed"), "true");
  assert.equal(helper.querySelectorAll(".syn-dd-mark")[0].getAttribute("stroke-dasharray"), "3 3");
  assert.ok(Number(selected.querySelectorAll(".syn-dd-hit")[0].getAttribute("height")) >= 44);
  assert.equal(selected.querySelectorAll(".syn-dd-mark")[0].getAttribute("height"), "34");

  const title = svg.querySelectorAll("title")[0];
  const desc = svg.querySelectorAll("desc")[0];
  assert.match(title.textContent, /Drill-down around Helper zero/);
  assert.match(desc.textContent, /select.*double-click.*recenter/i);
  assert.match(selected.getAttribute("aria-label"),
    /Leaf C; Outcome; 2 values; in 1; out 0; layer 1/);
  assert.match(selected.querySelectorAll("title")[0].textContent, /Leaf C/);
  assert.equal(svg.querySelectorAll("script").length, 0);
  assert.equal(svg.querySelectorAll("img").length, 0);
});

test("pointer single and double clicks are exclusive while keyboard selection is immediate", () => {
  const { svg, renderer, selected, centered } = mountDrilldown();
  renderer.render(drillState());
  let control = nodeGroup(svg, "b");

  control.dispatch("click", { detail: 1 });
  assert.deepEqual(selected, []);
  assert.equal([...timers.values()][0].delay, 240);
  flushTimers();
  assert.deepEqual(selected, ["b"]);
  assert.deepEqual(centered, []);

  control = nodeGroup(svg, "b");
  control.dispatch("click", { detail: 1 });
  control.dispatch("click", { detail: 2 });
  control.dispatch("dblclick", { detail: 2 });
  flushTimers();
  assert.deepEqual(selected, ["b"]);
  assert.deepEqual(centered, ["b"]);

  const enter = control.dispatch("keydown", { key: "Enter" });
  const space = control.dispatch("keydown", { key: " " });
  const legacySpace = control.dispatch("keydown", { key: "Spacebar" });
  const shiftEnter = control.dispatch("keydown", { key: "Enter", shiftKey: true });
  const arrow = control.dispatch("keydown", { key: "ArrowRight" });
  assert.deepEqual(selected, ["b", "b", "b", "b"]);
  assert.deepEqual(centered, ["b", "b"]);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(space.defaultPrevented, true);
  assert.equal(legacySpace.defaultPrevented, true);
  assert.equal(shiftEnter.defaultPrevented, true);
  assert.equal(arrow.defaultPrevented, false);
});

test("every observed-state rerender cancels a pending pointer selection from the old graph", () => {
  const store = makeStore();
  const initialState = drillState({ store });
  const rerenders = [
    ["selected node", () => ({ ...initialState, selectedNode: "b" })],
    ["center hop", () => ({ ...initialState, centerNode: "h", selectedNode: null })],
    ["up/down depth", () => ({ ...initialState, up: 1, down: 1 })],
    ["popstate-equivalent render", () => ({ ...initialState })],
    ["replacement store", () => ({ ...initialState, store: makeStore() })],
  ];

  for (const [label, nextState] of rerenders) {
    timers.clear();
    const { svg, renderer, selected } = mountDrilldown();
    renderer.render(initialState);
    nodeGroup(svg, "b").dispatch("click", { detail: 1 });
    assert.equal(timers.size, 1, `${label}: click must start pending selection`);

    renderer.render(nextState());
    assert.equal(timers.size, 0, `${label}: rerender must cancel the old selection`);
    flushTimers();
    assert.deepEqual(selected, [], `${label}: stale timer must not select or add history`);
    renderer.destroy();
  }
});

test("rapid pointer clicks without a rerender remain last-click-wins", () => {
  const { svg, renderer, selected } = mountDrilldown();
  renderer.render(drillState());

  nodeGroup(svg, "a").dispatch("click", { detail: 1 });
  nodeGroup(svg, "b").dispatch("click", { detail: 1 });
  assert.equal(timers.size, 1);
  flushTimers();
  assert.deepEqual(selected, ["b"]);
});

test("drilldown restores keyed focus and falls back when a node disappears", () => {
  const { heading, svg, renderer } = mountDrilldown();
  renderer.render(drillState());
  const before = nodeGroup(svg, "b");
  before.focus();

  renderer.render(drillState({ selectedNode: "b" }));
  const after = nodeGroup(svg, "b");
  assert.notEqual(after, before);
  assert.equal(document.activeElement, after);
  assert.deepEqual(after.lastFocusOptions, { preventScroll: true });

  renderer.render(drillState({ centerNode: "c", selectedNode: "c", up: 0, down: 0 }));
  assert.equal(document.activeElement, heading);
});

test("drilldown centers only for initial/layout/resize, coalesces RAF, and destroy cancels work", () => {
  const { panel, svg, renderer } = mountDrilldown();
  renderer.render(drillState());
  assert.equal(resizeObservers.length, 1);
  assert.deepEqual(resizeObservers[0].observed, [panel]);
  assert.equal(frames.size, 1);
  flushFrames();
  assert.equal(panel.scrollCalls.length, 1);

  panel.scrollLeft = 17;
  panel.scrollTop = 33;
  renderer.render(drillState({ selectedNode: "b" }));
  assert.equal(frames.size, 0);
  assert.equal(panel.scrollLeft, 17);
  assert.equal(panel.scrollTop, 33);
  assert.equal(panel.scrollCalls.length, 1);

  renderer.render(drillState({ down: 1 }));
  renderer.render(drillState({ down: 1, selectedNode: "h" }));
  assert.equal(frames.size, 1);
  flushFrames();
  assert.equal(panel.scrollCalls.length, 2);

  resizeObservers[0].trigger();
  resizeObservers[0].trigger();
  assert.equal(frames.size, 1);
  flushFrames();
  assert.equal(panel.scrollCalls.length, 3);

  nodeGroup(svg, "h").dispatch("click");
  resizeObservers[0].trigger();
  const pendingFrame = [...frames.keys()][0];
  renderer.destroy();
  assert.equal(resizeObservers[0].disconnected, true);
  assert.deepEqual(canceledFrames, [pendingFrame]);
  assert.equal(frames.size, 0);
  assert.equal(timers.size, 0);
});

test("detail renders metadata, absolute priors, edges, accessible callbacks, and helper zero values", () => {
  const { rootEl, renderer, selected, centered } = mountDetail();
  const store = makeStore();
  renderer.render({ store, centerNode: "h", selectedNode: "a" });

  assert.equal(rootEl.querySelectorAll("header")[0].querySelectorAll("h3")[0].textContent,
    "Root <script>alert(1)</script>");
  assert.match(rootEl.querySelectorAll(".syn-detail-meta")[0].textContent,
    /Origin & input · attribute · in 0 \/ out 2/);
  assert.match(rootEl.querySelectorAll(".syn-detail-desc")[0].textContent, /<img src=x>/);
  assert.equal(rootEl.querySelectorAll("script").length, 0);
  assert.equal(rootEl.querySelectorAll("img").length, 0);

  const center = rootEl.querySelectorAll("button")[0];
  assert.equal(center.textContent, "Center graph here");
  assert.equal(center.dataset.focusKey, "center:a");
  center.dispatch("click");
  assert.deepEqual(centered, ["a"]);

  const rows = rootEl.querySelectorAll(".syn-prior-list")[0].querySelectorAll("li");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelectorAll(".prior-val")[0].textContent, "75.0%");
  assert.equal(rows[0].querySelectorAll("i")[0].style.width, "75%");
  assert.equal(rows[1].querySelectorAll(".prior-val")[0].textContent, "25.0%");

  const outgoing = rootEl.querySelectorAll(".syn-edge-list")[0].querySelectorAll("button");
  assert.equal(outgoing.length, 2);
  assert.match(outgoing[0].getAttribute("aria-label"),
    /outgoing.*Selected B with a deliberately long label.*weight 2.*strongly drives/i);
  assert.match(outgoing[1].getAttribute("aria-label"),
    /outgoing.*Helper zero.*weight 0\.5.*primes helper/i);
  outgoing[0].dispatch("click");
  assert.deepEqual(selected, ["b"]);

  renderer.render({ store, centerNode: "a", selectedNode: "h" });
  assert.equal(rootEl.querySelectorAll(".syn-prior-list").length, 0);
  assert.doesNotMatch(rootEl.textContent, /Prior \(0 values\)/);
  assert.equal(rootEl.querySelectorAll(".syn-edge-list").length, 2);
  assert.equal(rootEl.querySelectorAll("button")[0].textContent, "Center graph here");
  const incoming = rootEl.querySelectorAll(".syn-edge-list")[0].querySelectorAll("button")[0];
  assert.match(incoming.getAttribute("aria-label"),
    /incoming.*Root <script>alert\(1\)<\/script>.*weight 0\.5.*primes helper/i);
});

test("detail restores enabled keyed focus and otherwise falls back to its heading", () => {
  const { heading, rootEl, renderer } = mountDetail();
  const store = makeStore();
  renderer.render({ store, centerNode: "h", selectedNode: "a" });
  const edge = rootEl.querySelectorAll(".syn-edge-list")[0].querySelectorAll("button")[0];
  edge.focus();
  renderer.render({ store, centerNode: "h", selectedNode: "a" });
  const restored = rootEl.querySelectorAll(".syn-edge-list")[0].querySelectorAll("button")[0];
  assert.notEqual(restored, edge);
  assert.equal(document.activeElement, restored);
  assert.deepEqual(restored.lastFocusOptions, { preventScroll: true });

  const center = rootEl.querySelectorAll("button")[0];
  center.focus();
  renderer.render({ store, centerNode: "a", selectedNode: "a" });
  assert.equal(rootEl.querySelectorAll("button")[0].disabled, true);
  assert.equal(document.activeElement, heading);

  renderer.render({ store, centerNode: "a", selectedNode: null });
  assert.equal(document.activeElement, heading);
});

test("app, CSS, and truncation markup register the approved renderer and accessibility contracts", () => {
  const app = readFileSync(new URL("../synthesis/app.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../synthesis.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../synthesis.html", import.meta.url), "utf8");

  assert.match(app, /^import \{ createDrilldownRenderer \} from "\.\/drilldown-graph\.js";$/m);
  assert.match(app, /^import \{ createDetailRail \} from "\.\/detail-rail\.js";$/m);
  assert.match(app,
    /registerRenderer\(createDrilldownRenderer\([\s\S]*?slices: \["store", "centerNode", "selectedNode", "up", "down"\]/);
  assert.match(app,
    /registerRenderer\(createDetailRail\([\s\S]*?slices: \["store", "centerNode", "selectedNode"\]/);
  assert.equal((app.match(/addEventListener\("change"/g) ?? []).length, 2);

  assert.match(css, /\.syn-dd-node\.selected \.syn-dd-mark\s*\{[^}]*stroke:\s*var\(--syn-ink\)/);
  const selectedRule = css.indexOf(".syn-dd-node.selected .syn-dd-mark");
  const focusOverrides = [...css.matchAll(
    /\.syn-dd-node:focus-visible \.syn-dd-mark\s*\{[^}]*stroke:\s*var\(--syn-ink\);[^}]*stroke-width:\s*3;/g,
  )];
  assert.ok(selectedRule >= 0 && focusOverrides.some((match) => match.index > selectedRule),
    "drilldown focus must override selected state with a visible 3px ink stroke");
  assert.match(css, /\.syn-dd-hit\s*\{[^}]*pointer-events:\s*all/);
  assert.match(css, /\.syn-body \[hidden\]\s*\{\s*display:\s*none !important;\s*\}/);
  assert.match(css, /\.syn-prior-list li\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /\.syn-edge-list/);
  assert.match(css, /\.syn-detail button:focus-visible[\s\S]*?outline:\s*2px solid var\(--syn-ink\)/);
  assert.match(html,
    /id="truncatedFlag"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden>truncated to 60\/direction<\/span>/);
});
