import {
  DEFAULT_CONTROLS,
  MAX_ADJUSTMENT_SCALE,
  MAX_MARGINAL_NODE_IDS,
} from "./request-schema.js";

export { DEFAULT_CONTROLS, MAX_MARGINAL_NODE_IDS };

const MAX_SAFE_SEED = Number.MAX_SAFE_INTEGER;

const textElement = (tag, text, className = "") => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
};

const setOwn = (record, key, value) => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const registerFocus = (element, key, targets) => {
  element.setAttribute("data-focus-key", key);
  targets.set(key, element);
  return element;
};

export function recipeKey(entry) {
  switch (entry?.kind) {
    case "pin":
      return `pin:${entry.nodeId}`;
    case "prior":
      return `prior:${entry.nodeId}`;
    case "category":
      return `category:${entry.category}`;
    case "edge":
      return `edge:${entry.source}->${entry.target}`;
    default:
      throw new TypeError("Recipe entry kind is invalid.");
  }
}

export function upsertRecipe(recipe, entry) {
  const current = Array.isArray(recipe) ? recipe : [];
  const key = recipeKey(entry);
  const index = current.findIndex((candidate) => recipeKey(candidate) === key);
  if (index === -1) return [...current, entry];
  const next = [...current];
  next[index] = entry;
  return next;
}

export function removeRecipe(recipe, key) {
  return (Array.isArray(recipe) ? recipe : [])
    .filter((entry) => recipeKey(entry) !== key);
}

export function recipeKeyForErrorKey(errorKey) {
  if (typeof errorKey !== "string") return null;
  const pin = /^pins\.(.+)$/.exec(errorKey);
  if (pin) return `pin:${pin[1]}`;
  const prior = /^overrides\.nodePriors\.(.+)$/.exec(errorKey);
  if (prior) return `prior:${prior[1]}`;
  const category = /^overrides\.categoryScales\.(.+)$/.exec(errorKey);
  if (category) return `category:${category[1]}`;
  const edge = /^overrides\.edgeWeights\.(.+)$/.exec(errorKey);
  if (edge) return `edge:${edge[1]}`;
  return null;
}

export function recipeToRequest(
  recipe,
  controls,
  { marginalNodeIds = [] } = {},
) {
  const pins = {};
  const edgeWeights = {};
  const nodePriors = {};
  const categoryScales = {};
  const marginalIds = [];
  const marginalSeen = new Set();
  const addMarginal = (nodeId) => {
    if (typeof nodeId === "string"
        && !marginalSeen.has(nodeId)
        && marginalIds.length < MAX_MARGINAL_NODE_IDS) {
      marginalSeen.add(nodeId);
      marginalIds.push(nodeId);
    }
  };
  for (const nodeId of marginalNodeIds) addMarginal(nodeId);

  for (const entry of Array.isArray(recipe) ? recipe : []) {
    switch (entry.kind) {
      case "pin":
        setOwn(pins, entry.nodeId, entry.value);
        addMarginal(entry.nodeId);
        break;
      case "prior":
        setOwn(nodePriors, entry.nodeId,
          Array.isArray(entry.weights) ? [...entry.weights] : entry.weights);
        addMarginal(entry.nodeId);
        break;
      case "category":
        setOwn(categoryScales, entry.category, entry.factor);
        break;
      case "edge":
        setOwn(edgeWeights, `${entry.source}->${entry.target}`, entry.factor);
        addMarginal(entry.target);
        break;
      default:
        throw new TypeError("Recipe entry kind is invalid.");
    }
  }

  return {
    n: controls.n,
    seed: controls.seed,
    gammaScale: controls.gammaScale,
    compareBaseline: controls.compareBaseline,
    pins,
    overrides: { edgeWeights, nodePriors, categoryScales },
    marginalNodeIds: marginalIds,
  };
}

function validateSamplingControls(controls) {
  if (!Number.isInteger(controls?.n) || controls.n < 1 || controls.n > 200) {
    return "Personas must be an integer between 1 and 200.";
  }
  if (!Number.isSafeInteger(controls.seed)
      || controls.seed < 0
      || controls.seed > MAX_SAFE_SEED) {
    return `Seed must be a safe integer between 0 and ${MAX_SAFE_SEED}.`;
  }
  if (!Number.isFinite(controls.gammaScale) || controls.gammaScale < 0) {
    return "Gamma must be a finite number greater than or equal to 0.";
  }
  if (typeof controls.compareBaseline !== "boolean") {
    return "Baseline comparison must be on or off.";
  }
  return null;
}

const helperPin = (entry, state) => {
  if (entry.kind !== "pin") return false;
  if (state.store?.nodesById?.get(entry.nodeId)?.emit === false) return true;
  return state.results?.flags?.helperPins?.includes(entry.nodeId) ?? false;
};

const factorControl = (entry, label, onUpsert, focusKey, focusTargets) => {
  const wrap = document.createElement("span");
  wrap.className = "syn-factor-control";
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = String(MAX_ADJUSTMENT_SCALE);
  input.step = "0.1";
  input.value = String(entry.factor);
  input.setAttribute("aria-label", label);
  registerFocus(input, focusKey, focusTargets);
  const formatFactor = (value) =>
    `${Number.isFinite(value) ? value.toFixed(1) : String(value)}×`;
  const output = textElement(
    "output",
    formatFactor(Number(entry.factor)),
    "syn-factor-value",
  );
  input.addEventListener("input", () => {
    output.textContent = formatFactor(Number(input.value));
  });
  input.addEventListener("change", () => {
    onUpsert({ ...entry, factor: Number(input.value) });
  });
  wrap.append(input, output);
  return wrap;
};

export function createAdjustPanel({
  rootEl,
  onUpsert = () => {},
  onRemove = () => {},
  onControlsChange = () => {},
  onGenerate = () => {},
}) {
  if (!rootEl) throw new TypeError("Adjust panel root is required.");
  let destroyed = false;

  const entryShell = (entry, state, invalidKey, focusTargets) => {
    const key = recipeKey(entry);
    const item = document.createElement("li");
    const invalid = key === invalidKey;
    item.className = `syn-recipe-entry${invalid ? " invalid" : ""}`;
    item.setAttribute("data-recipe-key", key);
    item.setAttribute("aria-invalid", String(invalid));

    const content = document.createElement("div");
    content.className = "syn-recipe-content";
    if (entry.kind === "pin") {
      content.append(
        textElement("span", "Pin", "syn-recipe-kind"),
        textElement("span", entry.label, "syn-recipe-label"),
        textElement("span", "=", "syn-recipe-equals"),
        textElement("span", entry.value, "syn-recipe-value"),
      );
    } else if (entry.kind === "category") {
      content.append(
        textElement("span", entry.category, "syn-recipe-label"),
        factorControl(
          entry,
          `Influence of ${entry.category}`,
          onUpsert,
          `${key}:factor`,
          focusTargets,
        ),
      );
    } else if (entry.kind === "edge") {
      content.append(
        textElement("span", `${entry.sourceLabel} → ${entry.targetLabel}`, "syn-recipe-label"),
        factorControl(
          entry,
          `Weight factor for ${entry.sourceLabel} to ${entry.targetLabel}`,
          onUpsert,
          `${key}:factor`,
          focusTargets,
        ),
      );
    } else {
      content.append(
        textElement("span", entry.label, "syn-recipe-label"),
        textElement("span", "prior", "syn-recipe-kind"),
      );
      const values = document.createElement("ul");
      values.className = "syn-prior-editor";
      const weights = Array.isArray(entry.weights) ? entry.weights : [];
      const total = weights.reduce((sum, weight) =>
        sum + (Number.isFinite(weight) && weight > 0 ? weight : 0), 0);
      (Array.isArray(entry.values) ? entry.values : []).forEach((value, index) => {
        const rawWeight = weights[index] ?? 0;
        const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0;
        const share = total > 0 ? weight / total : 0;
        const row = document.createElement("li");
        row.append(textElement("span", value, "syn-prior-value"));
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "0.1";
        input.value = String(rawWeight);
        input.setAttribute("aria-label", `Prior weight for ${entry.label} = ${value}`);
        registerFocus(input, `${key}:weight:${index}`, focusTargets);
        input.addEventListener("change", () => {
          const candidate = Number(input.value);
          const nextWeights = [...weights];
          nextWeights[index] = Number.isFinite(candidate) ? Math.max(0, candidate) : 0;
          onUpsert({ ...entry, weights: nextWeights });
        });
        const track = document.createElement("span");
        track.className = "syn-mini-track";
        track.setAttribute("aria-hidden", "true");
        const bar = document.createElement("i");
        bar.style.width = `${Math.round(share * 100)}%`;
        track.append(bar);
        row.append(
          input,
          track,
          textElement("span", `${(share * 100).toFixed(1)}%`, "syn-prior-share"),
        );
        values.append(row);
      });
      content.append(values);
    }
    item.append(content);

    if (helperPin(entry, state)) {
      const warning = textElement("span", "helper pin", "syn-helper-warning");
      warning.setAttribute("data-helper-warning", "true");
      warning.setAttribute("title", "Pinned node is a latent helper (emit: false)");
      item.append(warning);
    }

    const remove = textElement("button", "Remove", "syn-remove-recipe");
    remove.type = "button";
    const removeTarget = entry.kind === "pin"
      ? `pin on ${entry.label}`
      : entry.kind === "prior"
        ? `prior adjustment for ${entry.label}`
        : entry.kind === "category"
          ? `influence scale for ${entry.category}`
          : `weight factor for ${entry.sourceLabel} to ${entry.targetLabel}`;
    remove.setAttribute("aria-label", `Remove ${removeTarget}`);
    registerFocus(remove, `${key}:remove`, focusTargets);
    remove.addEventListener("click", () => onRemove(key));
    item.append(remove);
    return item;
  };

  function render(state) {
    if (destroyed) return;
    const previousFocusKey = rootEl.contains(document.activeElement)
      ? document.activeElement?.dataset?.focusKey ?? null
      : null;
    const focusTargets = new Map();
    const recipe = Array.isArray(state.recipe) ? state.recipe : [];
    const controls = state.controls ?? DEFAULT_CONTROLS;
    const rawErrorKey = state.generateError?.key ?? null;
    const knownKeys = new Set(recipe.map(recipeKey));
    const mappedErrorKey = recipeKeyForErrorKey(rawErrorKey);
    const invalidKey = mappedErrorKey ?? (knownKeys.has(rawErrorKey) ? rawErrorKey : null);

    const wrap = document.createElement("div");
    wrap.className = "syn-adjust-inner";
    const recipeSection = document.createElement("section");
    recipeSection.append(textElement("h3", "Recipe", "syn-section-title"));
    if (recipe.length === 0) {
      recipeSection.append(textElement(
        "p",
        "No adjustments yet — Generate works without a recipe for the baseline model.",
        "syn-empty-copy",
      ));
    } else {
      const list = document.createElement("ul");
      list.className = "syn-recipe-list";
      for (const entry of recipe) {
        list.append(entryShell(entry, state, invalidKey, focusTargets));
      }
      recipeSection.append(list);
    }

    const sampling = document.createElement("section");
    sampling.className = "syn-sampling";
    sampling.append(textElement("h3", "Sampling", "syn-section-title"));
    const controlsRow = document.createElement("div");
    controlsRow.className = "syn-control-row";
    for (const [field, label, min, max, step] of [
      ["n", "Personas", 1, 200, 1],
      ["seed", "Seed", 0, MAX_SAFE_SEED, 1],
      ["gammaScale", "Gamma ×", 0, null, 0.1],
    ]) {
      const controlLabel = document.createElement("label");
      controlLabel.append(textElement("span", label));
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(min);
      if (max !== null) input.max = String(max);
      input.step = String(step);
      input.value = String(controls[field]);
      input.setAttribute("data-control", field);
      registerFocus(input, `control:${field}`, focusTargets);
      input.addEventListener("change", () => {
        onControlsChange({ ...controls, [field]: Number(input.value) });
      });
      controlLabel.append(input);
      controlsRow.append(controlLabel);
    }

    const baselineLabel = document.createElement("label");
    baselineLabel.className = "syn-check-control";
    const baseline = document.createElement("input");
    baseline.type = "checkbox";
    baseline.checked = controls.compareBaseline;
    baseline.setAttribute("data-control", "compareBaseline");
    registerFocus(baseline, "control:compareBaseline", focusTargets);
    baseline.addEventListener("change", () => {
      onControlsChange({ ...controls, compareBaseline: baseline.checked });
    });
    baselineLabel.append(baseline, textElement("span", "Compare with baseline"));
    controlsRow.append(baselineLabel);

    const generate = textElement(
      "button",
      state.generating ? "Restart with latest settings" : "Generate personas",
      "syn-generate",
    );
    generate.type = "button";
    generate.disabled = validateSamplingControls(controls) !== null;
    registerFocus(generate, "generate", focusTargets);
    generate.addEventListener("click", onGenerate);
    controlsRow.append(generate);
    sampling.append(controlsRow);

    const status = textElement(
      "p",
      state.generating
        ? `Generating job ${state.activeJobId ?? "current"}. Restart to use the latest settings.`
        : "Ready to generate.",
      "syn-generation-status",
    );
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    sampling.append(status);
    sampling.append(textElement(
      "p",
      "Pins are do()-interventions: the value is clamped and only downstream attributes react.",
      "syn-helper-copy",
    ));

    const controlsError = validateSamplingControls(controls);
    if (controlsError) {
      const error = textElement("p", controlsError, "syn-inline-error");
      error.setAttribute("role", "alert");
      sampling.append(error);
    }
    if (state.generateError?.message) {
      const error = textElement("p", state.generateError.message, "syn-inline-error");
      error.setAttribute("role", "alert");
      sampling.append(error);
    }

    wrap.append(recipeSection, sampling);
    rootEl.replaceChildren(wrap);
    focusTargets.get(previousFocusKey)?.focus({ preventScroll: true });
  }

  function destroy() {
    destroyed = true;
    rootEl.replaceChildren();
  }

  return { render, destroy };
}
