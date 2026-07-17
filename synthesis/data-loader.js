export class ArtifactLoadError extends Error {
  constructor(code, message, cause) {
    if (cause === undefined) super(message);
    else super(message, { cause });
    this.name = "ArtifactLoadError";
    this.code = code;
  }
}

const SHA256 = /^[0-9a-f]{64}$/;
const DATASET_ID = /^sha256:[0-9a-f]{64}$/;
const SOURCE_COMMIT = /^[0-9a-f]{40}$/;
const RELEASE_ID = /^v[1-9][0-9]*$/;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ARTIFACT_NAMES = new Set(["core", "pack", "dimensions"]);
const ARTIFACT_FILENAMES = {
  core: /^graph-core\.v[1-9][0-9]*\.json$/,
  pack: /^sampler-pack\.v[1-9][0-9]*\.json$/,
  dimensions: /^dimensions\.[0-9a-f]{16,64}\.json$/,
};

const isAbortError = (error) => error?.name === "AbortError";
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isSafeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const matches = (pattern, value) => typeof value === "string" && pattern.test(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isRecord = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return !Object.keys(value).some((key) => DANGEROUS_KEYS.has(key));
};

const schemaError = (kind) => {
  throw new ArtifactLoadError("schema", `${kind} schema is invalid.`);
};

const requireSchema = (condition, kind) => {
  if (!condition) schemaError(kind);
};

const passKnownError = (error, code, message) => {
  if (isAbortError(error) || error instanceof ArtifactLoadError) throw error;
  throw new ArtifactLoadError(code, message, error);
};

const hex = (buffer) => [...new Uint8Array(buffer)]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const runtimeBaseUrl = () => {
  if (typeof document !== "undefined" && isNonEmptyString(document.baseURI)) {
    return document.baseURI;
  }
  return undefined;
};

const resolveUrl = (value, baseUrl, code = "url") => {
  try {
    return baseUrl === undefined ? new URL(value) : new URL(value, baseUrl);
  } catch (error) {
    throw new ArtifactLoadError(code, "Snapshot URL is invalid.", error);
  }
};

async function responseBytes(url, init, fetchImpl) {
  let response;
  try {
    if (typeof fetchImpl !== "function") throw new TypeError("fetch is unavailable");
    response = await fetchImpl(url, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ArtifactLoadError("network", "Snapshot request failed.", error);
  }

  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? response.status : 0;
    const suffix = status > 0 ? ` (${status})` : "";
    throw new ArtifactLoadError("http", `Snapshot request failed${suffix}.`);
  }

  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ArtifactLoadError("body", "Snapshot body could not be read.", error);
  }
}

const parseJson = (bytes, label) => {
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(source);
  } catch (error) {
    throw new ArtifactLoadError("json", `${label} is not valid JSON.`, error);
  }
};

const deepFreeze = (value) => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const immutableFilename = (key, filename) => {
  const pattern = ARTIFACT_FILENAMES[key];
  return pattern instanceof RegExp && pattern.test(filename);
};

function validateDescriptor(value, key, siteUrl) {
  if (!isRecord(value)
      || !isNonEmptyString(value.path)
      || !matches(SHA256, value.sha256)
      || !Number.isSafeInteger(value.bytes)
      || value.bytes <= 0) {
    throw new ArtifactLoadError("descriptor", "Snapshot descriptor is invalid.");
  }

  const rawPath = value.path;
  const lowerPath = rawPath.toLowerCase();
  if (rawPath.includes("?")
      || rawPath.includes("#")
      || rawPath.includes("\\")
      || rawPath.startsWith("//")
      || /^[a-z][a-z\d+.-]*:/i.test(rawPath)
      || lowerPath.includes("%2e")
      || lowerPath.includes("%2f")
      || lowerPath.includes("%5c")
      || rawPath.split("/").some((part) => part === "." || part === "..")) {
    throw new ArtifactLoadError("descriptor", "Snapshot descriptor path is invalid.");
  }

  const rawMatch = rawPath.match(/(?:^|\/)synthesis\/data\/([^/]+)$/);
  if (!rawMatch || !immutableFilename(key, rawMatch[1])) {
    throw new ArtifactLoadError("descriptor", "Snapshot descriptor path is not immutable.");
  }

  const base = resolveUrl(siteUrl, undefined, "descriptor");
  let resolved;
  try {
    resolved = new URL(rawPath, base);
  } catch (error) {
    throw new ArtifactLoadError("descriptor", "Snapshot descriptor path is invalid.", error);
  }
  if (resolved.origin !== base.origin
      || !["http:", "https:"].includes(base.protocol)
      || resolved.protocol !== base.protocol
      || resolved.username !== ""
      || resolved.password !== ""
      || resolved.search !== ""
      || resolved.hash !== "") {
    throw new ArtifactLoadError("descriptor", "Snapshot descriptor path is invalid.");
  }

  return resolved;
}

function validateGenerator(generator) {
  if (generator === undefined) return;
  if (!isRecord(generator)
      || !isNonEmptyString(generator.path)
      || !matches(SHA256, generator.sha256)
      || !isNonEmptyString(generator.node)) {
    throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
  }
  const match = generator.path.match(/^scripts\/build-synthesis-data\.([0-9a-f]{64})\.mjs$/);
  if (!match || match[1] !== generator.sha256) {
    throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
  }
}

function validateManifest(value, manifestUrl, expectedReleaseId) {
  if (!isRecord(value)) {
    throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
  }
  if (value.formatVersion !== 1) {
    throw new ArtifactLoadError("version", "Manifest schema version is unsupported.");
  }
  if (!matches(RELEASE_ID, value.releaseId)) {
    throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
  }
  if (expectedReleaseId !== undefined && value.releaseId !== expectedReleaseId) {
    throw new ArtifactLoadError("release", "Snapshot release does not match this page.");
  }
  if (!matches(DATASET_ID, value.datasetId)
      || !isRecord(value.source)
      || !isNonEmptyString(value.source.repo)
      || !matches(SOURCE_COMMIT, value.source.commit)
      || !matches(SHA256, value.source.fullDagSha256)
      || value.datasetId !== `sha256:${value.source.fullDagSha256}`
      || !isRecord(value.artifacts)
      || !hasOwn(value.artifacts, "core")) {
    throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
  }
  validateGenerator(value.generator);

  for (const [key, descriptor] of Object.entries(value.artifacts)) {
    if (!ARTIFACT_NAMES.has(key)) {
      throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
    }
    validateDescriptor(descriptor, key, manifestUrl);
  }
  return value;
}

function validateUniqueStrings(values, { nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) return false;
  const seen = new Set();
  for (const value of values) {
    if (!isNonEmptyString(value) || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

function validateDistribution(values, expectedLength) {
  if (!Array.isArray(values) || values.length !== expectedLength || values.length === 0) {
    return false;
  }
  let mass = 0;
  for (const value of values) {
    if (!isFiniteNumber(value) || value < 0) return false;
    mass += value;
  }
  return Number.isFinite(mass) && mass > 0;
}

function validateCoreInternal(core) {
  requireSchema(isRecord(core), "Core");
  requireSchema(core.formatVersion === 1, "Core");
  requireSchema(matches(DATASET_ID, core.datasetId), "Core");
  requireSchema(Array.isArray(core.nodes) && core.nodes.length > 0, "Core");
  requireSchema(Array.isArray(core.edges), "Core");
  requireSchema(Array.isArray(core.topologicalOrder), "Core");

  const nodes = new Map();
  for (const node of core.nodes) {
    requireSchema(isRecord(node), "Core");
    requireSchema(isNonEmptyString(node.id) && !nodes.has(node.id), "Core");
    requireSchema(typeof node.label === "string", "Core");
    requireSchema(typeof node.category === "string", "Core");
    requireSchema(typeof node.description === "string", "Core");
    requireSchema(typeof node.emit === "boolean", "Core");
    requireSchema(validateUniqueStrings(node.values, { nonEmpty: true }), "Core");
    requireSchema(validateDistribution(node.prior, node.values.length), "Core");
    requireSchema(validateUniqueStrings(node.parents), "Core");
    nodes.set(node.id, node);
  }

  requireSchema(core.topologicalOrder.length === nodes.size, "Core");
  requireSchema(validateUniqueStrings(core.topologicalOrder), "Core");
  for (const id of core.topologicalOrder) requireSchema(nodes.has(id), "Core");

  for (const node of core.nodes) {
    for (const parent of node.parents) requireSchema(nodes.has(parent), "Core");
  }
  for (const edge of core.edges) {
    requireSchema(isRecord(edge), "Core");
    requireSchema(isNonEmptyString(edge.source) && nodes.has(edge.source), "Core");
    requireSchema(isNonEmptyString(edge.target) && nodes.has(edge.target), "Core");
    requireSchema(isFiniteNumber(edge.weight) && edge.weight >= 0, "Core");
    requireSchema(typeof edge.relation === "string", "Core");
  }
  return core;
}

export function validateCore(core) {
  try {
    return validateCoreInternal(core);
  } catch (error) {
    passKnownError(error, "schema", "Core schema is invalid.");
  }
}

function validateMask(mask, nodes) {
  requireSchema(isRecord(mask), "Pack");
  requireSchema(isNonEmptyString(mask.target) && nodes.has(mask.target), "Pack");

  requireSchema(isRecord(mask.condition), "Pack");
  requireSchema(Object.keys(mask.condition).length > 0, "Pack");
  for (const [parent, values] of Object.entries(mask.condition)) {
    requireSchema(isNonEmptyString(parent) && nodes.has(parent), "Pack");
    requireSchema(validateUniqueStrings(values), "Pack");
    requireSchema(values.length > 0, "Pack");
  }

  requireSchema(validateUniqueStrings(mask.bad_values), "Pack");
  requireSchema(validateUniqueStrings(mask.preferred_values), "Pack");
  requireSchema(isRecord(mask.downweight_values), "Pack");
  for (const [value, multiplier] of Object.entries(mask.downweight_values)) {
    requireSchema(isNonEmptyString(value), "Pack");
    requireSchema(isFiniteNumber(multiplier) && multiplier >= 0, "Pack");
  }
  requireSchema(isFiniteNumber(mask.bad_value_multiplier)
    && mask.bad_value_multiplier >= 0, "Pack");
  requireSchema(isFiniteNumber(mask.outside_preferred_multiplier)
    && mask.outside_preferred_multiplier >= 0, "Pack");
  requireSchema(typeof mask.penalize_values_outside_preferred_set === "boolean", "Pack");

  if (hasOwn(mask, "source")) {
    requireSchema(isNonEmptyString(mask.source) && nodes.has(mask.source), "Pack");
  }
  if (hasOwn(mask, "parent")) {
    requireSchema(isNonEmptyString(mask.parent) && nodes.has(mask.parent), "Pack");
  }
  if (hasOwn(mask, "parents")) {
    requireSchema(validateUniqueStrings(mask.parents), "Pack");
    for (const parent of mask.parents) requireSchema(nodes.has(parent), "Pack");
  }
}

function validatePackInternal(pack, core) {
  validateCoreInternal(core);
  requireSchema(isRecord(pack), "Pack");
  requireSchema(pack.formatVersion === 1, "Pack");
  requireSchema(matches(DATASET_ID, pack.datasetId) && pack.datasetId === core.datasetId, "Pack");
  requireSchema(Array.isArray(pack.edges), "Pack");
  requireSchema(Array.isArray(pack.cpts), "Pack");
  requireSchema(Array.isArray(pack.masks), "Pack");

  const nodes = new Map(core.nodes.map((node) => [node.id, node]));
  for (const edge of pack.edges) {
    requireSchema(isRecord(edge), "Pack");
    requireSchema(isNonEmptyString(edge.source) && nodes.has(edge.source), "Pack");
    requireSchema(isNonEmptyString(edge.target) && nodes.has(edge.target), "Pack");
    requireSchema(isFiniteNumber(edge.weight) && edge.weight >= 0, "Pack");
    requireSchema(Array.isArray(edge.matrix)
      && edge.matrix.length === nodes.get(edge.source).values.length, "Pack");
    for (const row of edge.matrix) {
      requireSchema(validateDistribution(row, nodes.get(edge.target).values.length), "Pack");
    }
  }

  for (const cpt of pack.cpts) {
    requireSchema(isRecord(cpt), "Pack");
    requireSchema(isNonEmptyString(cpt.target) && nodes.has(cpt.target), "Pack");
    requireSchema(validateUniqueStrings(cpt.parents), "Pack");
    requireSchema(isFiniteNumber(cpt.weight) && cpt.weight >= 0, "Pack");
    requireSchema(typeof cpt.replace === "boolean", "Pack");
    requireSchema(Array.isArray(cpt.rows), "Pack");

    let combinations = 1;
    for (const parent of cpt.parents) {
      requireSchema(nodes.has(parent), "Pack");
      combinations *= nodes.get(parent).values.length;
      requireSchema(Number.isSafeInteger(combinations), "Pack");
    }
    for (const row of cpt.rows) {
      requireSchema(Array.isArray(row) && row.length === 2, "Pack");
      requireSchema(isSafeInteger(row[0]) && row[0] < combinations, "Pack");
      requireSchema(validateDistribution(row[1], nodes.get(cpt.target).values.length), "Pack");
    }
  }

  for (const mask of pack.masks) validateMask(mask, nodes);
  return pack;
}

export function validatePack(pack, core) {
  try {
    return validatePackInternal(pack, core);
  } catch (error) {
    passKnownError(error, "schema", "Pack schema is invalid.");
  }
}

async function verifyDescriptorBytes(descriptor, key, url, options) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const bytes = await responseBytes(
    url,
    { cache: "no-store", signal: options.signal },
    fetchImpl,
  );
  if (bytes.byteLength !== descriptor.bytes) {
    throw new ArtifactLoadError("size", `${key} size mismatch.`);
  }

  let digest;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || typeof subtle.digest !== "function") throw new TypeError("Web Crypto unavailable");
    digest = hex(await subtle.digest("SHA-256", bytes));
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ArtifactLoadError("digest", `${key} could not be verified.`, error);
  }
  if (digest !== descriptor.sha256) {
    throw new ArtifactLoadError("hash", `${key} integrity check failed.`);
  }
  return bytes;
}

function artifactRequest(manifest, key, baseUrl) {
  if (!isRecord(manifest) || !isRecord(manifest.artifacts)) {
    throw new ArtifactLoadError("manifest", "Manifest schema is invalid.");
  }
  const descriptor = manifest.artifacts[key];
  if (descriptor === undefined) {
    throw new ArtifactLoadError("missing-artifact", `${key} is unavailable in this snapshot.`);
  }
  const base = baseUrl ?? runtimeBaseUrl();
  if (base === undefined) {
    throw new ArtifactLoadError("url", "Snapshot base URL is unavailable.");
  }
  const trustedBase = resolveUrl(base, runtimeBaseUrl(), "descriptor");
  const requestUrl = validateDescriptor(descriptor, key, trustedBase);
  return { descriptor, requestUrl };
}

export async function loadManifest(url, options = {}) {
  try {
    const bytes = await responseBytes(
      url,
      { cache: "no-store", signal: options.signal },
      options.fetchImpl ?? globalThis.fetch,
    );
    const value = parseJson(bytes, "Manifest");
    const manifestUrl = resolveUrl(url, runtimeBaseUrl(), "manifest");
    validateManifest(value, manifestUrl, options.expectedReleaseId);
    return deepFreeze(value);
  } catch (error) {
    passKnownError(error, "manifest", "Manifest could not be loaded.");
  }
}

export async function loadArtifact(manifest, key, options = {}) {
  try {
    if (key !== "core" && key !== "pack") {
      throw new ArtifactLoadError("artifact-key", "Snapshot artifact type is unsupported.");
    }
    const { descriptor, requestUrl } = artifactRequest(manifest, key, options.baseUrl);
    const bytes = await verifyDescriptorBytes(descriptor, key, requestUrl, options);
    const value = parseJson(bytes, key);
    if (!isRecord(value)) schemaError(key === "core" ? "Core" : "Pack");
    if (value.formatVersion !== 1) {
      throw new ArtifactLoadError("version", `${key} schema version is unsupported.`);
    }
    if (value.datasetId !== manifest.datasetId) {
      throw new ArtifactLoadError("dataset", `${key} belongs to another snapshot.`);
    }
    if (key === "core") validateCore(value);
    else {
      if (!options.core) {
        throw new ArtifactLoadError("missing-core", "Core is required to verify pack.");
      }
      validatePack(value, options.core);
    }
    return value;
  } catch (error) {
    passKnownError(error, "artifact", "Snapshot artifact could not be loaded.");
  }
}

export async function loadAuxJson(manifest, key, options = {}) {
  try {
    if (key !== "dimensions") {
      throw new ArtifactLoadError("artifact-key", "Snapshot artifact type is unsupported.");
    }
    if (typeof options.validate !== "function") {
      throw new ArtifactLoadError("missing-validator", "dimensions validator is required.");
    }
    const { descriptor, requestUrl } = artifactRequest(manifest, key, options.baseUrl);
    const bytes = await verifyDescriptorBytes(descriptor, key, requestUrl, options);
    const value = parseJson(bytes, key);
    try {
      const result = await options.validate(value);
      if (result === false) throw new TypeError("validator returned false");
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new ArtifactLoadError(
        "schema",
        "dimensions schema validation failed.",
        error,
      );
    }
    return value;
  } catch (error) {
    passKnownError(error, "artifact", "Snapshot artifact could not be loaded.");
  }
}
