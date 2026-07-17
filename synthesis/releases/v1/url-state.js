const VERSION = "1";
const DEFAULT_HOPS = 1;

const defaults = () => ({
  selectedCategory: null,
  centerNode: null,
  selectedNode: null,
  up: DEFAULT_HOPS,
  down: DEFAULT_HOPS,
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

  return {
    selectedCategory: knownCategory(one(url.searchParams, "category"), overview),
    centerNode: knownNode(one(url.searchParams, "centerNode"), store),
    selectedNode: knownNode(one(url.searchParams, "selectedNode"), store),
    up: knownHop(one(url.searchParams, "up")),
    down: knownHop(one(url.searchParams, "down")),
  };
}

function appendString(params, key, value) {
  if (typeof value === "string" && value.length > 0) params.append(key, value);
}

function appendHop(params, key, value) {
  if (Number.isInteger(value) && value >= 0 && value <= 4 && value !== DEFAULT_HOPS) {
    params.append(key, String(value));
  }
}

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

  const search = params.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}
