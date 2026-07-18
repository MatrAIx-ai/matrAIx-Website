import { loadArtifact } from "./data-loader.js";
import {
  SynthesisValidationError,
  compileSampler,
  computeMarginals,
  sample,
} from "./sampler.js";
import { validateSampleRequest } from "./request-schema.js";

const GENERIC_ERROR_MESSAGE = "Generation failed. Retry with the verified snapshot.";
const SAFE_ERROR_CODE = /^[a-z][a-z0-9-]{0,31}$/;

export function serializeWorkerError(error) {
  const validation = error instanceof SynthesisValidationError;
  return {
    message: validation ? error.message : GENERIC_ERROR_MESSAGE,
    key: validation ? error.key : null,
    code: typeof error?.code === "string" && SAFE_ERROR_CODE.test(error.code)
      ? error.code
      : "generation",
  };
}

export async function runSamplerJob({ core, pack, request }, cache = {}) {
  const normalizedRequest = validateSampleRequest(request, core);
  const adjusted = compileSampler({
    core,
    pack,
    gammaScale: normalizedRequest.gammaScale,
    overrides: normalizedRequest.overrides,
  });
  const adjustedSample = sample(adjusted, normalizedRequest.n, {
    pins: normalizedRequest.pins,
    seed: normalizedRequest.seed,
  });

  // Map iteration follows the sampler's stable plan-then-priorOnly insertion
  // order and therefore includes every actually sampled required helper.
  const personaNodeIds = [...adjustedSample.idx.keys()];
  const columnCount = personaNodeIds.length;
  const personaCodes = new Uint32Array(normalizedRequest.n * columnCount);
  for (let row = 0; row < normalizedRequest.n; row++) {
    for (let column = 0; column < columnCount; column++) {
      personaCodes[row * columnCount + column] = adjustedSample.idx.get(
        personaNodeIds[column],
      )[row];
    }
  }

  const selectMarginals = (sampler, idx) => computeMarginals(
    sampler,
    idx,
    normalizedRequest.n,
    normalizedRequest.marginalNodeIds,
  );
  const result = {
    n: normalizedRequest.n,
    personaNodeIds,
    personaCodes,
    marginals: selectMarginals(adjusted, adjustedSample.idx),
    baselineMarginals: null,
    effectiveConfig: structuredClone(normalizedRequest),
    flags: { helperPins: [...adjustedSample.helperPins] },
  };

  if (normalizedRequest.compareBaseline) {
    if (!cache.baseline || cache.datasetId !== core.datasetId) {
      cache.baseline = compileSampler({ core, pack });
      cache.datasetId = core.datasetId;
    }
    const baselineSample = sample(cache.baseline, normalizedRequest.n, {
      seed: normalizedRequest.seed,
    });
    result.baselineMarginals = selectMarginals(cache.baseline, baselineSample.idx);
  }
  return result;
}

export function createSamplerWorkerRuntime({
  loadArtifactImpl = loadArtifact,
  postMessage,
} = {}) {
  if (typeof loadArtifactImpl !== "function" || typeof postMessage !== "function") {
    throw new TypeError("Worker runtime dependencies are required.");
  }
  const cache = {};
  let datasetPromise = null;

  const initialize = ({ manifest, baseUrl }) => {
    const pending = (async () => {
      const core = await loadArtifactImpl(manifest, "core", { baseUrl });
      const pack = await loadArtifactImpl(manifest, "pack", { baseUrl, core });
      return { core, pack };
    })();
    datasetPromise = pending;
    // Observe initialization failures even if no run message arrives. A retry
    // must always create a new promise rather than retain a rejected one.
    pending.catch(() => {
      if (datasetPromise === pending) datasetPromise = null;
    });
  };

  const handleMessage = async ({ data } = {}) => {
    if (data?.type === "init") {
      initialize(data);
      return;
    }
    if (data?.type !== "run") return;

    try {
      const pending = datasetPromise;
      if (!pending) throw new Error("worker is not initialized");
      const { core, pack } = await pending;
      const result = await runSamplerJob({ core, pack, request: data.request }, cache);
      postMessage(
        { type: "result", jobId: data.jobId, result },
        [result.personaCodes.buffer],
      );
    } catch (error) {
      postMessage({
        type: "error",
        jobId: data.jobId,
        error: serializeWorkerError(error),
      });
    }
  };

  return { cache, handleMessage };
}

if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  const runtime = createSamplerWorkerRuntime({
    postMessage: (message, transfer) => self.postMessage(message, transfer),
  });
  self.onmessage = runtime.handleMessage;
}
