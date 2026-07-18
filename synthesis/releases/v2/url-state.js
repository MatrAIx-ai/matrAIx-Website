import { DEFAULT_CONTROLS, validateUrlConfig } from "./request-schema.js";

const VERSION = "1";
const DEFAULT_HOPS = 1;
export const MAX_CFG_CHARS = 8192;

const defaults = () => ({
  selectedCategory: null,
  centerNode: null,
  selectedNode: null,
  up: DEFAULT_HOPS,
  down: DEFAULT_HOPS,
  recipe: [],
  controls: { ...DEFAULT_CONTROLS },
});

function asUrl(locationLike) {
  if (locationLike instanceof URL) return new URL(locationLike.href);
  if (typeof locationLike?.href === "string") return new URL(locationLike.href);
  return new URL(String(locationLike));
}

function one(params, key) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

function knownHop(raw) {
  return typeof raw === "string" && /^[0-4]$/.test(raw) ? Number(raw) : DEFAULT_HOPS;
}

function knownNode(raw, store) {
  return typeof raw === "string" && store?.nodesById?.has(raw) ? raw : null;
}

function knownCategory(raw, overview) {
  if (typeof raw !== "string" || !Array.isArray(overview?.categories)) return null;
  return overview.categories.some((category) => category?.name === raw) ? raw : null;
}

export function decodeUrlState(locationLike, { manifest, store, overview } = {}) {
  const fallback = defaults();
  let url;
  try {
    url = asUrl(locationLike);
  } catch {
    return fallback;
  }

  const version = one(url.searchParams, "v");
  const datasetId = one(url.searchParams, "datasetId");
  if (version !== VERSION
      || typeof manifest?.datasetId !== "string"
      || datasetId !== manifest.datasetId) {
    return fallback;
  }

  const decoded = {
    selectedCategory: knownCategory(one(url.searchParams, "category"), overview),
    centerNode: knownNode(one(url.searchParams, "centerNode"), store),
    selectedNode: knownNode(one(url.searchParams, "selectedNode"), store),
    up: knownHop(one(url.searchParams, "up")),
    down: knownHop(one(url.searchParams, "down")),
    recipe: [],
    controls: { ...DEFAULT_CONTROLS },
  };

  const configs = url.searchParams.getAll("cfg");
  if (configs.length !== 1) return decoded;
  try {
    const raw = JSON.parse(decodeBase64Url(configs[0]));
    const config = validateUrlConfig(raw, {
      manifest,
      core: store?.core,
    });
    decoded.recipe = config.recipe;
    decoded.controls = config.controls;
  } catch {
    // A malformed cfg is isolated from the independently validated browse state.
  }
  return decoded;
}

function appendString(params, key, value) {
  if (typeof value === "string" && value.length > 0) params.append(key, value);
}

function appendHop(params, key, value) {
  if (Number.isInteger(value) && value >= 0 && value <= 4 && value !== DEFAULT_HOPS) {
    params.append(key, String(value));
  }
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  if (typeof value !== "string"
      || value.length === 0
      || value.length > MAX_CFG_CHARS
      || !/^[A-Za-z0-9_-]+$/u.test(value)
      || value.length % 4 === 1) {
    throw new TypeError("cfg is invalid");
  }
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(`${standard}${"=".repeat((4 - standard.length % 4) % 4)}`);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (encodeBase64Url(decoded) !== value) throw new TypeError("cfg is not canonical");
  return decoded;
}

const normalizedControls = (controls = DEFAULT_CONTROLS) => ({
  n: controls.n,
  seed: controls.seed,
  gammaScale: controls.gammaScale,
  compareBaseline: controls.compareBaseline,
});

const canonicalRecipeEntry = (entry) => {
  switch (entry?.kind) {
    case "pin":
      return {
        kind: entry.kind,
        nodeId: entry.nodeId,
        label: entry.label,
        value: entry.value,
      };
    case "prior":
      return {
        kind: entry.kind,
        nodeId: entry.nodeId,
        label: entry.label,
        values: entry.values,
        weights: entry.weights,
      };
    case "category":
      return {
        kind: entry.kind,
        category: entry.category,
        factor: entry.factor,
      };
    case "edge":
      return {
        kind: entry.kind,
        source: entry.source,
        target: entry.target,
        sourceLabel: entry.sourceLabel,
        targetLabel: entry.targetLabel,
        factor: entry.factor,
      };
    default:
      return entry;
  }
};

const hasRecipeConfig = (recipe, controls) => (
  recipe.length > 0
  || controls.n !== DEFAULT_CONTROLS.n
  || controls.seed !== DEFAULT_CONTROLS.seed
  || controls.gammaScale !== DEFAULT_CONTROLS.gammaScale
  || controls.compareBaseline !== DEFAULT_CONTROLS.compareBaseline
);

export function encodeUrlState(locationLike, state = {}) {
  const url = asUrl(locationLike);
  const datasetId = state.manifest?.datasetId ?? state.datasetId;
  if (typeof datasetId !== "string" || datasetId.length === 0) {
    throw new TypeError("A loaded dataset is required to encode URL state.");
  }

  const params = new URLSearchParams();
  params.append("v", VERSION);
  params.append("datasetId", datasetId);
  appendString(params, "category", state.selectedCategory);
  appendString(params, "centerNode", state.centerNode);
  appendString(params, "selectedNode", state.selectedNode);
  appendHop(params, "up", state.up);
  appendHop(params, "down", state.down);
  const recipe = Array.isArray(state.recipe)
    ? state.recipe.map(canonicalRecipeEntry)
    : [];
  const controls = normalizedControls(state.controls);
  if (hasRecipeConfig(recipe, controls)) {
    const cfg = encodeBase64Url(JSON.stringify({ datasetId, recipe, controls }));
    if (cfg.length > MAX_CFG_CHARS) {
      throw new RangeError(`cfg must not exceed ${MAX_CFG_CHARS} characters`);
    }
    params.append("cfg", cfg);
  }

  const search = params.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}
