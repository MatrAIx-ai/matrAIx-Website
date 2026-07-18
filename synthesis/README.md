# Synthesis Studio

`synthesis.html` is a static, browser-only port of the MatrAIx persona synthesis
graph. It verifies immutable data before rendering, performs sampling in a module
Worker, and publishes a complete runtime graph under `synthesis/releases/v2/`.
There is no API server and no runtime dependency on a mutable source checkout.

## Pinned provenance

| Item | Pinned value |
| --- | --- |
| Upstream repository | `MatrAIx-ai/MatrAIx` |
| Upstream commit | `4dfa4e066b706c6a2d33a10fd41b976efd3f524e` |
| Full DAG SHA-256 | `28822720c6f8beea8f9386ef918df329ff5607eacea9ad16f5b80edc6dc4e166` |
| Dimensions SHA-256 | `109d203ae177b62e872ebc3272d52a7705e02c35575456728f99332f481a4f42` |
| Artifact Node | `18.19.1` |
| Golden Python / NumPy | `3.12.3` / `2.5.1` |

The current snapshot contains 1,308 graph nodes (1,290 emitted attributes and
18 helpers), 6,999 directed proposal edges, 54 full CPTs, 524 conditional
masks, and 6,347 emitted values. The phase-2 fidelity gate checks every source
node/value, aligned edge-matrix cell, CPT row, mask, and rendered dimension. The
locked source-to-artifact comparison has zero missing or extra emitted
dimensions and zero value-order mismatches across all 1,290 dimensions.

## Module map

- `app.js` owns state, URL/history semantics, renderer slices, Worker lifecycle,
  and the synchronous Generate boundary.
- `data-loader.js`, `dimensions-schema.js`, and `request-schema.js` are the
  fail-closed trust boundaries for manifests, artifacts, URL configuration, and
  sample requests.
- `graph-store.js` and `graph-views.js` build the read-only indexes and the
  overview, hop-bounded subgraph, and node-detail views.
- `overview-graph.js`, `drilldown-graph.js`, `detail-rail.js`,
  `adjust-panel.js`, and `results-panel.js` render the five panels with DOM/SVG
  APIs and `textContent`; data-driven HTML injection is not used.
- `dist-utils.js`, `rng.js`, and `sampler.js` contain the browser sampler port.
- `sampler-client.js` implements latest-wins job control. `sampler-worker.js`
  verifies and loads the sampling artifacts, compiles samplers, samples, and
  transfers compact row-major `Uint32Array` result codes.
- `render-persona.js` lazily renders selected result rows into text after the
  dimensions artifact has independently passed its manifest and schema checks.
- `url-state.js` stores browsing state plus a canonical base64url `cfg`; results
  are intentionally not serialized.

The public page loads only query-free files from `synthesis/releases/v2/`.
`scripts/synthesis-runtime-files.json` is the exact sorted allowlist, and
`release-lock.json` binds every runtime byte, manifest/artifact descriptor,
generator snapshot, and the complete v1 predecessor lock.

## Data and failure contract

`manifest.v1.json` pins the phase-1 core. `manifest.v2.json` reuses that core and
adds the sampler pack and content-named dimensions snapshot:

- `graph-core.v1.json`: ordered nodes, values, priors, emit flags, graph edges,
  and topological order.
- `sampler-pack.v2.json`: aligned pairwise matrices, full CPT rows, and
  conditional masks.
- `dimensions.109d203ae177b62e.json`: byte-identical rendering dimensions.

Every descriptor has a canonical repository-relative pathname, byte count, and
SHA-256. Core and pack must also match the manifest dataset ID and each other.
The main thread verifies the manifest and core before enabling the studio. The
Worker independently fetches and verifies core then pack. Persona text performs
a separate lazy verification of dimensions.

Failures are safe and retryable:

- manifest/core failure leaves the graph unavailable and exposes only the fixed
  verification error; Retry keeps the pinned manifest but refetches the failed
  artifact;
- a rejected Worker dataset promise is cleared, the failed Worker is retired,
  and the next Generate creates and initializes a fresh Worker;
- a rejected dimensions promise is cleared and its row-level Retry refetches;
- arbitrary Worker exceptions are reduced to a fixed message without a stack,
  response body, or fetch URL; validated field errors may include only their
  stable message and key.

## Recipe, sampling, and baseline semantics

The persisted recipe has four kinds: pin, prior, category scale, and incoming
edge scale. Keys are derived from the affected node/category/edge, so an upsert
replaces the same adjustment. A recipe and expanded request contain at most 12
adjustments; requested marginals are unique, known, and capped at 32 nodes. The
URL `cfg` is capped at 8,192 base64url characters. Invalid edits never overwrite
the last valid reproducible state or URL.

Generate synchronously performs:

1. `recipeToRequest()` against the click-time recipe and controls;
2. `validateSampleRequest()` against the verified core;
3. `samplerClient.run()` with a detached small request snapshot.

No parsed core or pack is posted with a run. Starting another job terminates an
active Worker and starts a fresh one; messages are accepted only when both the
Worker identity and monotonically increasing job ID match. A successfully idle
Worker may be reused. The result contains adjusted persona codes and requested
marginals, optional baseline marginals, effective config, and helper-pin flags.
It does not contain `baselinePersonas`.

“Baseline” means the default, unadjusted sampler compiled from the same pinned
core/pack and sampled with the same seed and `n`. It uses default gamma and no
recipe overrides or pins; it is not “the adjusted sampler with only overrides
removed.” Only baseline marginals requested by the UI are retained.

The Results table decodes emitted attributes for its current ten visible rows.
Selecting a row overlays that exact persona on the drill-down graph, including
sampled helper values. A graph node outside the sampler's required set is marked
“not sampled in this result”; a marginal mode is never presented as a persona.

## Regeneration

Use a detached checkout of the pinned upstream commit and a clean website tree:

```bash
export SOURCE_WORKTREE=/path/to/MatrAIx-at-4dfa4e066b706c6a2d33a10fd41b976efd3f524e
export SOURCE_COMMIT=4dfa4e066b706c6a2d33a10fd41b976efd3f524e
export NODE18=/absolute/path/to/node-v18.19.1
export PYTHON_P2=/absolute/path/to/python3.12.3-with-numpy-2.5.1
test "$(git -C "$SOURCE_WORKTREE" rev-parse HEAD)" = "$SOURCE_COMMIT"
test -z "$(git -C "$SOURCE_WORKTREE" status --porcelain)"
test "$("$NODE18" --version)" = "v18.19.1"
"$PYTHON_P2" - <<'PY'
import platform, numpy
assert platform.python_version() == "3.12.3"
assert numpy.__version__ == "2.5.1"
PY

V1_GENERATOR=$("$NODE18" -e \
  "const m=require('./synthesis/data/manifest.v1.json');process.stdout.write(m.generator.path)")
V2_GENERATOR=$("$NODE18" -e \
  "const m=require('./synthesis/data/manifest.v2.json');process.stdout.write(m.generator.path)")
for manifest in synthesis/data/manifest.v1.json synthesis/data/manifest.v2.json; do
  expected=$("$NODE18" -e "const m=require('./$manifest');process.stdout.write(m.generator.sha256)")
  path=$("$NODE18" -e "const m=require('./$manifest');process.stdout.write(m.generator.path)")
  printf '%s  %s\n' "$expected" "$path" | sha256sum -c -
done

"$NODE18" "$V1_GENERATOR" \
  --graph "$SOURCE_WORKTREE/persona/synthesis/graph/full_dag.json" \
  --source-commit "$SOURCE_COMMIT" --out-dir synthesis/data --phase 1
"$NODE18" "$V2_GENERATOR" \
  --graph "$SOURCE_WORKTREE/persona/synthesis/graph/full_dag.json" \
  --source-commit "$SOURCE_COMMIT" --dimensions data/dimensions.json \
  --out-dir synthesis/data --phase 2
```

Regenerate the two independent upstream comparisons with Python 3.12.3. Phase
2 additionally requires `numpy==2.5.1`:

```bash
"$PYTHON_P2" scripts/generate-synthesis-goldens-p1.py \
  --matraix-root "$SOURCE_WORKTREE" \
  --full-dag "$SOURCE_WORKTREE/persona/synthesis/graph/full_dag.json"
"$PYTHON_P2" scripts/generate-synthesis-goldens-p2.py \
  --matraix-root "$SOURCE_WORKTREE" \
  --full-dag "$SOURCE_WORKTREE/persona/synthesis/graph/full_dag.json"
```

Phase 1 locks overview/subgraph/detail behavior. Phase 2 reconstructs the graph
from the rounded core/pack, runs the original upstream sampler and renderer, and
locks compile probes, dynamic 25×200 marginals, seeded personas, and rendered
text. Finish with:

```bash
"$NODE18" --test tests/
"$NODE18" scripts/build-synthesis-runtime.mjs --release v2 --check
"$NODE18" scripts/build-synthesis-runtime.mjs --release v2 --check-source
"$NODE18" scripts/build-synthesis-runtime.mjs --release v1 --check
npm --prefix tests/browser test
git diff --exit-code -- synthesis/data tests/fixtures
```

To create an unpublished successor runtime after source bytes change, remove
the unpublished release directory, run the builder with `--write`, then run all
three checks above. Never overwrite a release that has been published.

## Upstream correspondence and deliberate differences

The graph views correspond to the upstream persona synthesis service; sampler
compilation/sampling correspond to `PersonaForwardSampler`; persona text
corresponds to upstream `render.py`; UI recipe shapes correspond to the upstream
Synthesis Studio components and `recipe.ts`.

The following differences are intentional and tested:

- browser arithmetic is binary64/float64 with finite fail-closed guards;
- the browser RNG is deterministic for the full JavaScript-safe 53-bit seed
  range, but its stream is not NumPy-stream compatible;
- upstream multiprocessing and its precomputed `codes`/`static_cdf`
  representations are not ported;
- hop controls are bounded to 0–4;
- graph center and detail selection are separate state;
- the page has five independent panels;
- overlay is an explicitly selected concrete persona, not a marginal maximum;
- baseline is the same-seed default unadjusted sampler defined above;
- `baselinePersonas` are neither generated nor retained.

## Stacked release and rollback

Phase 2 is stacked on the immutable phase-1 runtime/data contract. If phase 1
changes before phase 2 is published, regenerate the entire v2 artifact, golden,
and runtime set and confirm the v1 release remains byte-identical. Do not patch
manifest hashes by hand.

Rollback is also a complete snapshot operation: point `synthesis.html` back to
the query-free v1 CSS/app pair and revert the v2 runtime, v2 manifest, pack,
dimensions snapshot, phase-2 generator, modules, tests, and documentation in one
reviewed revert. Keep `synthesis/releases/v1/`, `manifest.v1.json`,
`graph-core.v1.json`, and the v1 generator unchanged, then run the v1 release
check and the full Node/browser suites.
