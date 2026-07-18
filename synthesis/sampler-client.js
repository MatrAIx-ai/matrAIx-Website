const GENERIC_ERROR = Object.freeze({
  message: "Generation failed. Retry with the verified snapshot.",
  key: null,
  code: "worker",
});

const noop = () => {};

const normalizeWorkerError = (error) => {
  if (
    error !== null
    && typeof error === "object"
    && typeof error.message === "string"
    && (typeof error.key === "string" || error.key === null)
    && typeof error.code === "string"
  ) {
    return { message: error.message, key: error.key, code: error.code };
  }
  return { ...GENERIC_ERROR };
};

export function createSamplerClient({
  createWorker,
  dataset,
  onStart = noop,
  onResult = noop,
  onError = noop,
} = {}) {
  if (typeof createWorker !== "function") {
    throw new TypeError("A sampler Worker factory is required.");
  }
  if (dataset === null || typeof dataset !== "object") {
    throw new TypeError("Sampler dataset metadata is required.");
  }
  for (const callback of [onStart, onResult, onError]) {
    if (typeof callback !== "function") throw new TypeError("Sampler callbacks must be functions.");
  }

  // Pin only the small immutable initialization payload. Any parsed core/pack
  // properties on the caller's dataset object are deliberately ignored.
  const manifest = structuredClone(dataset.manifest);
  const baseUrl = dataset.baseUrl;
  const bindings = new WeakMap();
  let worker = null;
  let active = false;
  let activeJobId = 0;
  let nextJobId = 0;
  let destroyed = false;

  const retire = (target) => {
    if (!target) return;
    const binding = bindings.get(target);
    if (binding) {
      target.removeEventListener("message", binding.message);
      target.removeEventListener("error", binding.error);
      bindings.delete(target);
    }
    target.terminate();
    if (worker === target) worker = null;
  };

  const createInitializedWorker = () => {
    const candidate = createWorker();
    if (
      candidate === null
      || typeof candidate !== "object"
      || typeof candidate.addEventListener !== "function"
      || typeof candidate.removeEventListener !== "function"
      || typeof candidate.postMessage !== "function"
      || typeof candidate.terminate !== "function"
    ) {
      throw new TypeError("Sampler Worker factory returned an invalid Worker.");
    }

    const message = ({ data } = {}) => {
      if (
        destroyed
        || candidate !== worker
        || !active
        || data?.jobId !== activeJobId
      ) return;
      if (data.type === "result") {
        active = false;
        onResult(activeJobId, data.result);
        return;
      }
      if (data.type === "error") {
        const jobId = activeJobId;
        active = false;
        retire(candidate);
        onError(jobId, normalizeWorkerError(data.error));
      }
    };
    const error = (event) => {
      if (destroyed || candidate !== worker || !active) return;
      event?.preventDefault?.();
      const jobId = activeJobId;
      active = false;
      retire(candidate);
      onError(jobId, { ...GENERIC_ERROR });
    };
    bindings.set(candidate, { message, error });
    candidate.addEventListener("message", message);
    candidate.addEventListener("error", error);
    worker = candidate;
    try {
      candidate.postMessage({
        type: "init",
        baseUrl,
        manifest: structuredClone(manifest),
      });
    } catch (error_) {
      retire(candidate);
      throw error_;
    }
    return candidate;
  };

  const run = (request) => {
    if (destroyed) throw new Error("Sampler client has been destroyed.");

    // Capture the click-time value before terminating an active calculation.
    const snapshot = structuredClone(request);
    const jobId = ++nextJobId;
    if (active && worker) retire(worker);
    activeJobId = jobId;
    active = true;
    try {
      onStart(jobId, structuredClone(snapshot));
    } catch (error) {
      if (!destroyed && active && activeJobId === jobId) {
        active = false;
        retire(worker);
      }
      throw error;
    }
    if (destroyed || !active || activeJobId !== jobId) return jobId;

    let target = null;
    try {
      target = worker ?? createInitializedWorker();
      // A synchronous Worker callback or a reentrant callback may already have
      // completed, restarted, errored, or destroyed this job.
      if (
        destroyed
        || !active
        || activeJobId !== jobId
        || worker !== target
      ) return jobId;
      target.postMessage({ type: "run", jobId, request: snapshot });
    } catch {
      if (
        destroyed
        || !active
        || activeJobId !== jobId
        || (target !== null && worker !== target)
      ) return jobId;
      active = false;
      retire(worker);
      onError(jobId, { ...GENERIC_ERROR });
    }
    return jobId;
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    active = false;
    retire(worker);
  };

  return { run, destroy };
}
