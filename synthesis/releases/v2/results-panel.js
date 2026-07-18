import { loadAuxJson as defaultLoadAuxJson } from "./data-loader.js";
import { validateDimensions } from "./dimensions-schema.js";
import { loadDims, renderPersona } from "./render-persona.js";

export const PERSONAS_PER_PAGE = 10;

const textElement = (tag, text, className = "") => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
};

const ownValue = (record, key, value) => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const coreIndexes = new WeakMap();
const resultIndexes = new WeakMap();

const coreIndex = (core) => {
  if (!core || typeof core !== "object") return new Map();
  if (!coreIndexes.has(core)) {
    coreIndexes.set(core, new Map(
      (Array.isArray(core.nodes) ? core.nodes : []).map((node) => [node.id, node]),
    ));
  }
  return coreIndexes.get(core);
};

const resultIndex = (result) => {
  if (!result || typeof result !== "object") return new Map();
  const nodeIds = Array.isArray(result.personaNodeIds) ? result.personaNodeIds : [];
  const cached = resultIndexes.get(result);
  if (cached?.nodeIds === nodeIds) return cached.index;
  const index = new Map(nodeIds.map((nodeId, column) => [nodeId, column]));
  resultIndexes.set(result, { nodeIds, index });
  return index;
};

export function personaValueAt(result, core, row, nodeId) {
  if (!Number.isInteger(row) || row < 0 || row >= result?.n) return null;
  if (!(result.personaCodes instanceof Uint32Array)) return null;
  const columns = Array.isArray(result.personaNodeIds)
    ? result.personaNodeIds.length
    : 0;
  const column = resultIndex(result).get(nodeId);
  if (!Number.isInteger(column) || columns === 0) return null;
  const node = coreIndex(core).get(nodeId);
  if (!node || !Array.isArray(node.values)) return null;
  const offset = row * columns + column;
  if (offset < 0 || offset >= result.personaCodes.length) return null;
  const code = result.personaCodes[offset];
  return Number.isInteger(code) && code < node.values.length ? node.values[code] : null;
}

export function personaAt(result, core, row) {
  const persona = Object.create(null);
  for (const node of Array.isArray(core?.nodes) ? core.nodes : []) {
    if (!node || node.emit === false) continue;
    const value = personaValueAt(result, core, row, node.id);
    if (value !== null) ownValue(persona, node.id, value);
  }
  return persona;
}

export function createDimensionsLoader({ loadAuxJson = defaultLoadAuxJson } = {}) {
  if (typeof loadAuxJson !== "function") {
    throw new TypeError("A dimensions loader is required.");
  }
  let cachedManifest = null;
  let cachedPromise = null;

  const reset = () => {
    cachedManifest = null;
    cachedPromise = null;
  };

  const getDims = (state) => {
    const manifest = state?.manifest;
    if (!manifest) return Promise.reject(new TypeError("A pinned manifest is required."));
    if (cachedPromise && cachedManifest === manifest) return cachedPromise;
    cachedManifest = manifest;
    const pending = Promise.resolve()
      .then(() => loadAuxJson(manifest, "dimensions", { validate: validateDimensions }))
      .then((data) => loadDims(data));
    const guarded = pending.catch((error) => {
      if (cachedPromise === guarded) reset();
      throw error;
    });
    cachedPromise = guarded;
    return guarded;
  };

  return { getDims, reset };
}

const clampShare = (value) => Number.isFinite(value)
  ? Math.max(0, Math.min(1, value))
  : 0;

const percent = (value) => `${(clampShare(value) * 100).toFixed(1)}%`;

const resultCore = (state) => state.store?.core ?? state.core ?? null;

export function createResultsPanel({
  rootEl,
  onOverlayIndexChange = () => {},
  personaDecoder = personaAt,
  loadAuxJson = defaultLoadAuxJson,
  dimensionsLoader = null,
}) {
  if (!rootEl) throw new TypeError("Results panel root is required.");
  if (typeof personaDecoder !== "function") throw new TypeError("Persona decoder is required.");
  const dimsLoader = dimensionsLoader ?? createDimensionsLoader({ loadAuxJson });
  let destroyed = false;
  let lastState = null;
  let currentResult = null;
  let resultInitialized = false;
  let page = 0;
  let selectedOverlayIndex = null;
  const expandedRows = new Set();
  const textStates = new Map();
  const rowControls = new Map();

  const rerender = () => {
    if (!destroyed && lastState) render(lastState);
  };

  const renderText = (row, persona, state, result) => {
    textStates.set(row, { status: "loading" });
    rerender();
    void dimsLoader.getDims(state).then((dims) => {
      if (destroyed || currentResult !== result) return;
      const text = renderPersona(persona, dims);
      textStates.set(row, { status: "ready", text });
      rerender();
    }).catch(() => {
      if (destroyed || currentResult !== result) return;
      textStates.set(row, { status: "error" });
      rerender();
    });
  };

  const renderAttributeList = (persona, core, row, expanded) => {
    const index = coreIndex(core);
    const attributes = Object.entries(persona);
    const visible = expanded ? attributes : attributes.slice(0, 3);
    const wrap = document.createElement("div");
    wrap.className = "syn-persona-attributes";
    wrap.setAttribute("data-persona-attributes", String(row));
    for (const [nodeId, value] of visible) {
      const attribute = document.createElement("span");
      attribute.className = "syn-persona-attribute";
      attribute.append(
        textElement("b", index.get(nodeId)?.label ?? nodeId),
        textElement("span", value),
      );
      wrap.append(attribute);
    }
    return { wrap, total: attributes.length };
  };

  const renderTextControl = (row, persona, state, result) => {
    const number = row + 1;
    const wrap = document.createElement("div");
    wrap.className = "syn-persona-text";
    const textState = textStates.get(row);
    if (!textState) {
      const button = textElement("button", "Render text", "syn-secondary-action");
      button.type = "button";
      button.setAttribute("aria-label", `Render text for persona #${number}`);
      button.addEventListener("click", () => renderText(row, persona, state, result));
      wrap.append(button);
    } else if (textState.status === "loading") {
      const status = textElement("span", "Rendering persona text…", "syn-text-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      wrap.append(status);
    } else if (textState.status === "error") {
      const status = textElement(
        "span",
        "Persona text dimensions could not be verified.",
        "syn-text-error",
      );
      status.setAttribute("role", "status");
      const retry = textElement("button", "Retry", "syn-secondary-action");
      retry.type = "button";
      retry.setAttribute("aria-label", `Retry persona text for persona #${number}`);
      retry.addEventListener("click", () => renderText(row, persona, state, result));
      wrap.append(status, retry);
    } else {
      const text = textElement("p", textState.text, "syn-rendered-persona");
      wrap.append(text);
    }
    return wrap;
  };

  const renderDistribution = (result) => {
    const section = document.createElement("section");
    section.className = "syn-distributions";
    section.append(textElement("h3", "Distribution comparison", "syn-section-title"));
    if (!result.baselineMarginals) {
      section.append(textElement(
        "p",
        "Enable baseline comparison before generating to compare distributions.",
        "syn-empty-copy",
      ));
      return section;
    }
    section.append(textElement(
      "p",
      "Baseline uses the same seed with the default unadjusted sampler. Grey: baseline · blue: adjusted.",
      "syn-distribution-note",
    ));
    const cards = document.createElement("div");
    cards.className = "syn-distribution-grid";
    for (const [nodeId, adjusted] of Object.entries(result.marginals ?? {})) {
      const baseline = result.baselineMarginals[nodeId];
      if (!baseline || !Array.isArray(adjusted?.values) || !Array.isArray(adjusted.freqs)) {
        continue;
      }
      const card = document.createElement("section");
      card.className = "syn-dist-card";
      card.append(textElement("h4", adjusted.label ?? nodeId));
      const list = document.createElement("ul");
      adjusted.values.forEach((value, index) => {
        const before = baseline.freqs?.[index] ?? 0;
        const after = adjusted.freqs[index] ?? 0;
        const row = document.createElement("li");
        row.append(textElement("span", value, "syn-dist-value"));
        const series = document.createElement("span");
        series.className = "syn-dist-series";
        for (const [name, share] of [["baseline", before], ["adjusted", after]]) {
          const track = document.createElement("span");
          track.className = "syn-dist-track";
          const bar = document.createElement("i");
          bar.setAttribute("data-series", name);
          bar.style.width = `${Math.round(clampShare(share) * 100)}%`;
          track.append(bar);
          series.append(track);
        }
        series.setAttribute("aria-hidden", "true");
        row.append(
          series,
          textElement("span", `${percent(before)} → ${percent(after)}`, "syn-dist-numbers"),
        );
        list.append(row);
      });
      card.append(list);
      cards.append(card);
    }
    if (cards.children.length === 0) {
      cards.append(textElement(
        "p",
        "No requested distributions were available in both samples.",
        "syn-empty-copy",
      ));
    }
    section.append(cards);
    return section;
  };

  function render(state) {
    if (destroyed) return;
    lastState = state;
    const result = state.results ?? null;
    if (!resultInitialized || result !== currentResult) {
      resultInitialized = true;
      currentResult = result;
      page = 0;
      selectedOverlayIndex = Number.isInteger(state.overlayIndex)
        ? state.overlayIndex
        : null;
      expandedRows.clear();
      textStates.clear();
    }

    const wrap = document.createElement("div");
    wrap.className = "syn-results-inner";
    if (state.generateError?.message) {
      const banner = textElement("div", state.generateError.message, "syn-results-error");
      banner.setAttribute("role", "alert");
      wrap.append(banner);
    }

    const core = resultCore(state);
    if (!result || !core) {
      wrap.append(textElement(
        "p",
        "Generate a batch in the panel above to see personas here.",
        "syn-empty",
      ));
      rootEl.replaceChildren(wrap);
      return;
    }

    const config = result.effectiveConfig ?? {};
    wrap.append(textElement(
      "p",
      `Generated ${result.n} personas · seed ${config.seed ?? "—"} · gamma ${config.gammaScale ?? "—"}×`,
      "syn-results-summary",
    ));

    const columns = Array.isArray(result.personaNodeIds) ? result.personaNodeIds.length : 0;
    const availableRows = columns > 0 && result.personaCodes instanceof Uint32Array
      ? Math.min(result.n, Math.floor(result.personaCodes.length / columns))
      : 0;
    const totalPages = Math.max(1, Math.ceil(availableRows / PERSONAS_PER_PAGE));
    page = Math.min(page, totalPages - 1);
    const start = page * PERSONAS_PER_PAGE;
    const end = Math.min(availableRows, start + PERSONAS_PER_PAGE);

    const table = document.createElement("table");
    table.className = "syn-persona-table";
    const caption = textElement(
      "caption",
      `Generated personas ${availableRows ? start + 1 : 0}–${end} of ${availableRows}`,
    );
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const label of ["Persona", "Attributes", "Actions"]) {
      const heading = textElement("th", label);
      heading.setAttribute("scope", "col");
      headerRow.append(heading);
    }
    head.append(headerRow);
    const body = document.createElement("tbody");
    rowControls.clear();
    for (let row = start; row < end; row++) {
      const persona = personaDecoder(result, core, row);
      const item = document.createElement("tr");
      if (selectedOverlayIndex === row) item.className = "selected";
      const number = row + 1;
      const numberCell = textElement("th", `#${number}`);
      numberCell.setAttribute("scope", "row");
      const attributesCell = document.createElement("td");
      const expanded = expandedRows.has(row);
      const attributes = renderAttributeList(persona, core, row, expanded);
      attributesCell.append(attributes.wrap);
      if (attributes.total > 3) {
        const toggle = textElement(
          "button",
          expanded ? "Show summary" : "Show all attributes",
          "syn-secondary-action",
        );
        toggle.type = "button";
        toggle.setAttribute(
          "aria-label",
          `${expanded ? "Show attribute summary" : "Show all attributes"} for persona #${number}`,
        );
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.addEventListener("click", () => {
          if (expandedRows.has(row)) expandedRows.delete(row);
          else expandedRows.add(row);
          rerender();
        });
        attributesCell.append(toggle);
      }

      const actions = document.createElement("td");
      actions.className = "syn-persona-actions";
      const select = textElement(
        "button",
        selectedOverlayIndex === row ? "Selected for graph" : "Select for graph",
        "syn-select-persona",
      );
      select.type = "button";
      select.setAttribute("aria-label", `Select persona #${number}`);
      select.setAttribute("aria-pressed", String(selectedOverlayIndex === row));
      select.addEventListener("click", () => {
        const next = selectedOverlayIndex === row ? null : row;
        selectedOverlayIndex = next;
        for (const [candidateRow, controls] of rowControls) {
          const selected = candidateRow === next;
          controls.item.className = selected ? "selected" : "";
          controls.button.setAttribute("aria-pressed", String(selected));
          controls.button.textContent = selected ? "Selected for graph" : "Select for graph";
        }
        onOverlayIndexChange(next);
      });
      rowControls.set(row, { item, button: select });
      actions.append(select, renderTextControl(row, persona, state, result));
      item.append(numberCell, attributesCell, actions);
      body.append(item);
    }
    table.append(caption, head, body);
    wrap.append(table);

    if (totalPages > 1) {
      const nav = document.createElement("nav");
      nav.className = "syn-results-pages";
      nav.setAttribute("aria-label", "Persona result pages");
      const previous = textElement("button", "Previous");
      previous.type = "button";
      previous.disabled = page === 0;
      previous.setAttribute("aria-label", "Previous result page");
      previous.addEventListener("click", () => {
        page = Math.max(0, page - 1);
        rerender();
      });
      const next = textElement("button", "Next");
      next.type = "button";
      next.disabled = page >= totalPages - 1;
      next.setAttribute("aria-label", "Next result page");
      next.addEventListener("click", () => {
        page = Math.min(totalPages - 1, page + 1);
        rerender();
      });
      nav.append(
        previous,
        textElement("span", `${start + 1}–${end} of ${availableRows}`),
        next,
      );
      wrap.append(nav);
    }
    wrap.append(renderDistribution(result));
    rootEl.replaceChildren(wrap);
  }

  function destroy() {
    destroyed = true;
    lastState = null;
    dimsLoader.reset?.();
    rootEl.replaceChildren();
  }

  return { render, destroy };
}
