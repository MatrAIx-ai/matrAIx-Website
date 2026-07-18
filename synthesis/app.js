import { loadManifest, loadArtifact, startArtifactRequest } from "./data-loader.js";
import { createGraphStore } from "./graph-store.js";
import { buildOverview } from "./graph-views.js";
import { decodeUrlState, encodeUrlState } from "./url-state.js";
import { createOverviewRenderer } from "./overview-graph.js";
import { createDrilldownRenderer } from "./drilldown-graph.js";
import { createDetailRail } from "./detail-rail.js";

const $ = (id) => document.getElementById(id);
const rendererSlices = new WeakMap();

const state = {
  manifest: null,
  store: null,
  overview: null,
  selectedCategory: null,
  centerNode: null,
  selectedNode: null,
  up: 1,
  down: 1,
  renderers: [],
};

let debugSnapshot;

function frozenRecord(value) {
  return value === null ? null : Object.freeze({ ...value });
}

function publishDebugSnapshot() {
  const manifest = state.manifest ? frozenRecord({
    formatVersion: state.manifest.formatVersion,
    releaseId: state.manifest.releaseId,
    datasetId: state.manifest.datasetId,
  }) : null;
  const store = state.store ? frozenRecord({
    nodeCount: state.store.nodesById.size,
    edgeCount: state.store.edgeCount,
  }) : null;
  const overview = state.overview ? Object.freeze({
    counts: frozenRecord(state.overview.counts),
  }) : null;
  debugSnapshot = Object.freeze({
    manifest,
    store,
    overview,
    selectedCategory: state.selectedCategory,
    centerNode: state.centerNode,
    selectedNode: state.selectedNode,
    up: state.up,
    down: state.down,
  });
}

publishDebugSnapshot();
Object.defineProperty(window, "__synState", {
  configurable: false,
  enumerable: true,
  get: () => debugSnapshot,
});

let pendingFrame = null;
const pendingSlices = new Set();

function scheduleAffectedRenderers(slices) {
  for (const slice of slices) pendingSlices.add(slice);
  if (pendingFrame !== null) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = null;
    const dirty = new Set(pendingSlices);
    pendingSlices.clear();
    for (const renderer of state.renderers) {
      const observed = rendererSlices.get(renderer);
      if (observed?.size && ![...observed].some((slice) => dirty.has(slice))) continue;
      renderer.render(state);
    }
  });
}

export function registerRenderer(renderer, { slices = [] } = {}) {
  if (!renderer || typeof renderer.render !== "function") {
    throw new TypeError("A renderer with render(state) is required.");
  }
  rendererSlices.set(renderer, new Set(slices));
  state.renderers.push(renderer);
  return () => {
    const index = state.renderers.indexOf(renderer);
    if (index !== -1) state.renderers.splice(index, 1);
    rendererSlices.delete(renderer);
    renderer.destroy?.();
  };
}

function syncUrl(mode) {
  if (!state.manifest) return;
  const url = encodeUrlState(location, state);
  const method = mode === "push" ? "pushState" : "replaceState";
  history[method](null, "", url);
}

export function setState(patch, { historyMode = "replace", dirtySlices } = {}) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("State patch must be an object.");
  }
  Object.assign(state, patch);
  publishDebugSnapshot();
  if (historyMode !== "none") syncUrl(historyMode);
  scheduleAffectedRenderers(dirtySlices ?? Object.keys(patch));
}

function renderStats(counts) {
  const fragment = document.createDocumentFragment();
  for (const [label, value] of [
    ["graph nodes", counts.graphNodes],
    ["attributes", counts.attributes],
    ["helpers", counts.helpers],
    ["directed edges", counts.directedEdges],
    ["categories", counts.categories],
  ]) {
    const item = document.createElement("span");
    item.className = "stat";
    const number = document.createElement("b");
    number.textContent = Number(value).toLocaleString("en-US");
    item.append(number, document.createTextNode(label));
    fragment.append(item);
  }
  $("synStats").replaceChildren(fragment);
}

function wireExpandButtons() {
  const cleanups = [];
  for (const button of document.querySelectorAll(".syn-expand")) {
    const onClick = () => {
      const panel = $(button.dataset.panel);
      if (!panel) return;
      const expanded = panel.classList.toggle("expanded");
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = expanded ? "Restore" : "Expand";
      const title = panel.querySelector("h2")?.textContent ?? "panel";
      button.setAttribute("aria-label", `${expanded ? "Restore" : "Expand"} ${title}`);
    };
    button.addEventListener("click", onClick);
    cleanups.push(() => button.removeEventListener("click", onClick));
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

function wireMobileNav() {
  const nav = document.querySelector(".mx-nav");
  const menu = nav?.querySelector(".mx-menu");
  const links = nav?.querySelector(".mx-links");
  if (!nav || !menu || !links) return () => {};

  const close = ({ returnFocus = false } = {}) => {
    const wasOpen = nav.classList.contains("open");
    nav.classList.remove("open");
    menu.classList.remove("active");
    menu.setAttribute("aria-expanded", "false");
    if (returnFocus && wasOpen) menu.focus({ preventScroll: true });
  };
  const onMenu = () => {
    const opening = !nav.classList.contains("open");
    if (!opening) {
      close();
      return;
    }
    nav.classList.add("open");
    menu.classList.add("active");
    menu.setAttribute("aria-expanded", "true");
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close({ returnFocus: true });
  };
  const onResize = () => {
    if (window.innerWidth > 850) close();
  };
  const onLink = () => close();

  menu.addEventListener("click", onMenu);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  const navLinks = [...links.querySelectorAll("a")];
  for (const link of navLinks) link.addEventListener("click", onLink);

  return () => {
    menu.removeEventListener("click", onMenu);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
    for (const link of navLinks) link.removeEventListener("click", onLink);
  };
}

function syncControlsFromState() {
  $("hopsUp").value = String(state.up);
  $("hopsDown").value = String(state.down);
}

function wireHopControls() {
  const up = $("hopsUp");
  const down = $("hopsDown");
  const onUp = () => setState(
    { up: Number(up.value), selectedNode: null },
    { historyMode: "replace", dirtySlices: ["up", "selectedNode"] },
  );
  const onDown = () => setState(
    { down: Number(down.value), selectedNode: null },
    { historyMode: "replace", dirtySlices: ["down", "selectedNode"] },
  );
  up.addEventListener("change", onUp);
  down.addEventListener("change", onDown);
  return () => {
    up.removeEventListener("change", onUp);
    down.removeEventListener("change", onDown);
  };
}

function restoreFromUrl() {
  if (!state.store) return;
  Object.assign(state, decodeUrlState(location, state));
  publishDebugSnapshot();
  syncControlsFromState();
  scheduleAffectedRenderers([
    "selectedCategory",
    "centerNode",
    "selectedNode",
    "up",
    "down",
  ]);
}

async function boot() {
  const cleanups = [wireExpandButtons(), wireMobileNav(), wireHopControls()];
  registerRenderer(createOverviewRenderer({
    svg: $("overviewSvg"),
    listEl: $("attrList"),
    onSelectCategory: (name) =>
      setState(
        {
          selectedCategory: state.selectedCategory === name ? null : name,
          selectedNode: null,
        },
        { historyMode: "push" },
      ),
    onSelectNode: (id) =>
      setState({ centerNode: id, selectedNode: id }, { historyMode: "push" }),
  }), { slices: ["overview", "selectedCategory", "centerNode"] });
  registerRenderer(createDrilldownRenderer({
    svg: $("drilldownSvg"),
    emptyEl: $("drilldownEmpty"),
    truncatedEl: $("truncatedFlag"),
    onSelectNode: (id) => setState({ selectedNode: id }, { historyMode: "push" }),
    onCenterNode: (id) =>
      setState({ centerNode: id, selectedNode: id }, { historyMode: "push" }),
  }), { slices: ["store", "centerNode", "selectedNode", "up", "down"] });
  registerRenderer(createDetailRail({
    rootEl: $("detailRail"),
    onSelectNode: (id) => setState({ selectedNode: id }, { historyMode: "push" }),
    onCenterNode: (id) =>
      setState({ centerNode: id, selectedNode: id }, { historyMode: "push" }),
  }), { slices: ["store", "centerNode", "selectedNode"] });
  let controller = null;
  let attemptId = 0;
  let pinnedManifest = null;
  let reloadManifest = false;
  let reloadCore = false;

  const attempt = async () => {
    const id = ++attemptId;
    controller?.abort();
    const attemptController = new AbortController();
    controller = attemptController;
    const { signal } = attemptController;
    $("synLoadStatus").setAttribute("role", "status");
    $("synLoadMessage").textContent = "Loading verified graph snapshot…";
    $("synRetry").hidden = true;

    try {
      const coreRequest = startArtifactRequest("synthesis/data/graph-core.v1.json", {
        baseUrl: document.baseURI,
        cacheMode: reloadCore ? "reload" : "default",
        signal,
      });
      let manifest = pinnedManifest;
      if (!manifest) {
        manifest = await loadManifest("synthesis/data/manifest.v1.json", {
          cacheMode: reloadManifest ? "reload" : "default",
          signal,
          expectedReleaseId: "v1",
        });
        if (id !== attemptId) return;
        pinnedManifest = manifest;
        reloadManifest = false;
      }
      const core = await loadArtifact(manifest, "core", {
        baseUrl: document.baseURI,
        requestHandle: coreRequest,
        signal,
      });
      if (id !== attemptId) return;
      reloadCore = false;

      const store = createGraphStore(core);
      const overview = buildOverview(store);
      const restored = decodeUrlState(location, { manifest, store, overview });
      Object.assign(state, { manifest, store, overview, ...restored });
      publishDebugSnapshot();
      syncControlsFromState();
      renderStats(overview.counts);
      syncUrl("replace");
      $("synLoadStatus").setAttribute("role", "status");
      $("synLoadMessage").textContent = `Verified snapshot ${manifest.datasetId.slice(7, 19)}.`;
      $("synRetry").hidden = true;
      scheduleAffectedRenderers([
        "store",
        "overview",
        "selectedCategory",
        "centerNode",
        "selectedNode",
        "up",
        "down",
      ]);
    } catch (error) {
      attemptController.abort();
      if (id !== attemptId || error?.name === "AbortError") return;
      reloadCore = true;
      if (pinnedManifest === null) reloadManifest = true;
      $("synLoadStatus").setAttribute("role", "alert");
      $("synLoadMessage").textContent = "The graph snapshot could not be verified.";
      $("synRetry").hidden = false;
    }
  };

  const onRetry = () => { void attempt(); };
  const onPopstate = () => restoreFromUrl();
  $("synRetry").addEventListener("click", onRetry);
  window.addEventListener("popstate", onPopstate);

  const onPageHide = (event) => {
    if (event.persisted) return;
    window.removeEventListener("pagehide", onPageHide);
    attemptId += 1;
    controller?.abort();
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    pendingSlices.clear();
    $("synRetry").removeEventListener("click", onRetry);
    window.removeEventListener("popstate", onPopstate);
    for (const cleanup of cleanups) cleanup();
    for (const renderer of [...state.renderers]) {
      const index = state.renderers.indexOf(renderer);
      if (index !== -1) state.renderers.splice(index, 1);
      rendererSlices.delete(renderer);
      renderer.destroy?.();
    }
  };
  window.addEventListener("pagehide", onPageHide);

  await attempt();
}

void boot();
