# PR 14/15 Loading Performance Design

**Date:** 2026-07-17

**Status:** Design approved; awaiting written-spec review

**Scope:** Existing draft PRs 14 and 15

## Summary

PR 14 and PR 15 will be rebased onto the current upstream `main`, repaired for
the site's relocated shared assets, and updated in place with performance fixes.
The selected approach keeps the static GitHub Pages deployment and the existing
release-lock model. It does not introduce a bundler or Service Worker.

The performance work has four parts:

1. preload the eager JavaScript module graph;
2. start the manifest and core-data requests concurrently;
3. persist only fully verified artifact bytes in Cache Storage so the Window and
   PR 15 Worker can share them;
4. make baseline comparison opt-in in PR 15.

All current artifact checks remain mandatory on every cache read: byte length,
SHA-256, JSON parsing, schema, dataset binding, and pack-to-core validation.

## Evidence

The merged PR snapshots currently have correctness and performance problems.

- Both snapshots refer to shared files at their old root paths. After the
  current `main` relocation, favicon, site CSS, theme JavaScript, and performance
  JavaScript requests return 404. The result is an unstyled page and extra failed
  requests.
- PR 15 build and schema tests still read the old root `dimensions.json` path;
  current `main` stores it under `data/`.
- The initial app waits for the complete ES module graph, then the manifest,
  then the 1,315,948-byte core JSON. The core is about 112 KB with gzip, but
  1.3 MB on a server that does not compress JSON.
- `data-loader.js` uses `cache: "no-store"` for manifests and artifacts, so
  navigation, reload, Window, and Worker cannot reuse a verified download.
- PR 15 creates its Worker lazily. The Worker downloads core and pack in
  sequence even though the Window already loaded core.
- PR 15 baseline comparison defaults to enabled. A default Generate therefore
  compiles and samples both the adjusted and baseline models.

Measured locally with a 150 ms RTT, 1.6 Mbps throughput, and 4x CPU slowdown:

| Scenario | No JSON compression | Pages-like gzip |
| --- | ---: | ---: |
| PR 14 verified initial load | 8.34 s | 2.10 s |
| PR 15 verified initial load | 9.18 s | 2.36 s |
| PR 15 first Generate | 29.3 s | 3.58 s |

GitHub Pages serves the JSON with gzip, so the no-compression numbers explain
especially slow local previews rather than production behavior. The request
waterfall, duplicate Worker download, default baseline work, and broken paths
remain real in production.

## Goals

- Preserve PR 14 and PR 15 URLs and update their existing fork branches.
- Remove all merged-snapshot 404s caused by the `main` asset relocation.
- Begin the cold core request without waiting for manifest completion.
- Avoid network transfer of a core or pack that this origin has already fetched
  and fully verified.
- Keep the Window and Worker trust boundaries: the Worker receives the small
  manifest/base-URL initialization payload and independently verifies bytes.
- Preserve immutable, reproducible v1/v2 runtime releases and their lock checks.
- Keep baseline comparison available while removing it from the default path.
- Add stable structural performance tests instead of timing-sensitive CI gates.

## Non-goals

- No bundler, package-manager dependency, Service Worker, CDN migration, or
  hosting change.
- No change to graph, sampler, or artifact schemas.
- No transfer of parsed core data from the Window to the Worker.
- No persistent caching of the manifest in Cache Storage.
- No font-system redesign or unrelated site-wide performance refactor.
- No hard millisecond budget in CI; throttled timings are reported as benchmark
  evidence only.

## Branch And Release Strategy

### PR 14

Record the remote PR 14 and PR 15 heads before changing either branch and create
local backup refs. Rebase PR 14 onto the latest `origin/main`, resolve the shared
asset relocation semantically, then add the v1 performance changes and tests.

```bash
git fetch origin
git fetch fork
OLD_PR14=$(git rev-parse fork/feature/synthesis-studio-phase1)
OLD_PR15=$(git rev-parse fork/feature/synthesis-studio-phase2)
git branch "backup/pr14-$OLD_PR14" "$OLD_PR14"
git branch "backup/pr15-$OLD_PR15" "$OLD_PR15"
```

PR 14 is still a draft and v1 has not shipped from `main`, so changed v1 runtime
bytes may be rebuilt. Before doing so, the implementation must prove that
`synthesis/releases/v1` is absent from `origin/main`. The existing v1 directory
is preserved by the backup ref, removed as a complete directory from the working
tree, and recreated from scratch through `scripts/build-synthesis-runtime.mjs`.
The builder's no-overwrite rule remains intact; release files and
`release-lock.json` are never partially replaced or hand-edited. The newly
generated directory must pass v1 `--check` and v1 `--check-source` before it is
staged.

After `range-diff` and the full test suite pass, update the existing fork branch
with an explicit lease tied to the recorded old SHA:

```bash
git push fork HEAD:refs/heads/feature/synthesis-studio-phase1 \
  --force-with-lease=refs/heads/feature/synthesis-studio-phase1:$OLD_PR14
```

### PR 15

Freeze the tested PR 14 head as `NEW_PR14`, then restack only the original
Phase 2 commits onto it with `git rebase --onto`. PR 15 inherits PR 14's v1 bytes
unchanged. Before every PR 15 push, an external process gate compares PR 15 with
that exact immutable commit, not with a moving branch. The compared paths are
the complete `synthesis/releases/v1` directory plus the v1 manifest, artifacts,
and hashed generator enumerated by that release lock. Any difference fails the
restack.

Apply Phase 2-specific changes to source, v2, tests, and documentation. Rebuild
v2 and its predecessor metadata through the same draft-only full-directory
process: first prove v2 is absent from `origin/main`, preserve it through the
backup ref, remove the existing v2 directory, and let the builder recreate it.
PR 15 runs v1 `--check` but not v1 `--check-source`, because mutable source now
corresponds to v2. It runs both v2 `--check` and v2 `--check-source`. Verify the
Phase 2 range with `range-diff`, then update the existing PR 15 branch with an
explicit lease tied to its recorded old SHA.

PR 15 must remain based on upstream `main` while PR 14 is open because an
upstream PR cannot use a branch from the contributor fork as its base. PR 15's
GitHub diff will therefore temporarily include Phase 1.

Merge PR 14 first. After that merge, rebase the Phase 2-only range from the new
PR 14 head onto the updated upstream `main`, verify it again, and safely update
PR 15. At that point PR 15 must show only Phase 2 commits and no v1 diff.

Every PR 14 head change before merge requires another PR 15 restack from the
previous frozen PR 14 head to the new one. If the v1 lock digest changes, v2 and
its predecessor metadata are rebuilt again from scratch. The final tested PR 14
head is frozen and recorded before merge so the post-merge `rebase --onto`
excludes the correct Phase 1 range regardless of GitHub's merge method.

If either fork branch changes after its expected SHA is recorded, the lease must
reject the push. Each later push, including the post-merge PR 15 restack and any
rollback, first records the then-current remote SHA and uses that SHA as its new
explicit lease. Do not replace it with an unqualified `--force`.

## Shared Asset And Data Paths

After the rebase, `synthesis.html` follows the current site layout:

- favicons under `Assets/icons/`;
- shared styles under `css/`, including the current navigation stylesheet;
- theme and site-performance scripts under `js/`;
- the current standardized navigation markup from `main`.

PR 15 build scripts, tests, and documentation use `data/dimensions.json` for the
source dimensions file. Versioned synthesis artifacts remain under
`synthesis/data/`; this source-path repair does not rename immutable artifacts.

A static test resolves every local `synthesis.html` stylesheet, icon, script,
module entry, and module-preload URL against the repository root and requires a
real file. This prevents another semantic merge that is textually clean but
broken when deployed.

## Module Scheduling

`synthesis.html` adds `<link rel="modulepreload">` entries after critical CSS and
before the module entry script. The list covers the eager static-import closure
for the selected runtime release: currently 9 JavaScript modules in v1 and 17 in
v2. The lazy `sampler-worker.js` entry is excluded. Shared modules that are part
of the eager main-thread closure remain eligible.

Preloading does not add new bytes; these modules are already required. It lets
the browser discover requests without waiting through two or three import-graph
round trips. CSS remains ahead of module preload so the larger parallel request
set does not demote render-blocking styles.

Tests require every preload URL to be query-free, present in the selected
release lock, and part of the entry module's eager closure. A stale, missing, or
extra preload fails the test.

## Concurrent Manifest And Core Start

The fixed release app knows both its immutable manifest URL and its core URL.
It starts an opaque core-byte request handle immediately before calling the
existing, structurally pinned `loadManifest(...)`. The core request and manifest
request then run concurrently.

`data-loader.js` owns the request handle. The handle records the normalized URL
and an always-observed settled result; callers do not parse or trust its bytes.
This avoids an unhandled rejection if manifest validation fails while the core
request is still in flight.

After manifest validation, `loadArtifact(manifest, "core", ...)`:

1. validates the descriptor and resolves its trusted same-origin URL;
2. requires exact URL equality with the speculative request handle;
3. obtains the bytes from that handle;
4. performs the existing size, SHA-256, JSON, version, dataset, and core-schema
   checks;
5. exposes the parsed core only after every check succeeds.

An URL mismatch is a hard release-binding failure. The speculative response is
never accepted for a different descriptor. The app actively aborts the attempt
on manifest/core failure, and the shared AbortController cancels both network
requests when an attempt fails or is superseded. Non-abortable Cache Storage
operations follow the signal checkpoints defined below.

The runtime builder's app/data binding gate is extended to bind the app to one
literal manifest URL, one literal speculative core URL, and the expected release
ID. The builder first parses and validates the manifest, then passes the exact
`artifacts.core.path` to the app-binding gate; it must not derive a core filename
from the release ID. This is required because v2 intentionally reuses
`graph-core.v1.json`. A fixture locks that reuse behavior. The gate catches drift
during release generation rather than only in a browser.

## Verified Artifact Cache

### Storage Model

`data-loader.js` contains a small cache adapter; no extra runtime module is added.
It uses `globalThis.caches` with a format-versioned namespace such as
`matraix-synthesis-verified-artifacts-v1`. Window and Dedicated Worker contexts
on the same origin can use the same Cache Storage namespace without a Service
Worker.

The cache key is the exact normalized, validated, same-origin artifact URL. The
value is raw response bytes. Parsed objects and Promises are never persisted.
The namespace version describes the cache format, not the synthesis release.

Manifest fetches use `cache: "default"` on the first attempt because each release
URL is immutable. A failed manifest load or validation causes the next explicit
page Retry to use `cache: "reload"`; a successfully validated manifest remains
pinned for that page attempt as it does today. Manifests continue to receive
schema, release-ID, origin, and path validation. They are not placed in the
verified artifact cache because the current runtime does not carry a separately
trusted manifest digest. This keeps the existing manifest trust model unchanged.

### Read And Commit Rules

Both `loadArtifact` and `loadAuxJson` use one verification pipeline:

1. resolve and validate the descriptor URL;
2. attempt an exact Cache Storage match;
3. on a miss, fetch the URL with `cache: "default"`;
4. verify descriptor byte length and SHA-256;
5. parse JSON and verify format version and dataset binding;
6. run core, pack-with-core, or supplied auxiliary schema validation;
7. only after all validation succeeds, start and await a best-effort write of the
   raw bytes before returning the parsed value.

Every cache hit repeats steps 4 through 6. Cache presence is never proof of
integrity. A same-origin script that writes arbitrary cache bytes therefore
cannot bypass artifact validation.

If Cache Storage is absent, blocked, over quota, or throws during open or match,
the loader falls back to a normally cached HTTP response followed by the same
full verification. Cache availability must not determine whether correct data
can load. A cache write failure is recorded as a cache miss for performance
expectations but is not a page or Generate correctness failure.

If bytes from either Cache Storage or a normal HTTP response fail an integrity
or semantic check, the loader best-effort deletes the Cache Storage entry and,
within the same call, makes exactly one bypassing request with `cache: "reload"`.
Only a fully verified reload may replace the entry or produce output. This
recovery works even if Cache Storage deletion fails; the current call never
reads that key twice. If the forced response also fails, the loader fails closed
and the existing UI Retry starts a new attempt. HTTP or network failures do not
trigger an automatic second request and are left to the explicit Retry.

Call-contract failures such as an unsupported artifact key, a missing core for
pack validation, or a missing auxiliary validator fail before cache access.
They neither evict a valid entry nor trigger a recovery fetch.

Successful cache commit is a synchronization point: `loadArtifact` does not
return until `cache.put()` has settled. A rejected put is swallowed only after
the loader knows that no cross-context reuse guarantee can be made. This prevents
the Window from reporting core ready while a promptly created Worker can still
race an in-progress core commit.

Cache Storage operations do not accept `AbortSignal`. The loader checks the
signal before and after every Cache Storage await and before exposing a parsed
value. Network fetches share the attempt's signal and are actively aborted when
the manifest/core attempt fails or is superseded. The loader never starts a
cache write after observing an abort. If abort arrives during an already-started
put, that put may finish because the platform cannot cancel it; the bytes were
fully verified before the put began, and the aborted attempt still exposes no
value. Network, HTTP, integrity, parse, and schema failures never start a write.

### Cold, Warm, And Worker Flow

On a cold page load, module preloads start early while manifest and core begin in
parallel. Core is fetched once, verified, committed, and rendered.

On a warm page load after a successful commit, the core bytes come from Cache
Storage but are independently hashed, parsed, and schema-validated before
rendering. This removes transfer time without weakening validation.

In PR 15, the first Generate still initializes a fresh Worker with only manifest
and base URL. After a successful awaited Window commit, the Worker loads core
through the same loader, hits the Window-populated cache, and independently
re-verifies it. It then fetches and verifies pack and waits for its commit. A
later Worker or page reload reuses both raw artifacts while repeating all
validation.

Cache Storage does not provide cross-context single-flight. Two tabs or Workers
that start before the first successful commit may both fetch the same artifact.
The no-repeat guarantee applies to sequential consumers after an awaited commit,
not to concurrent cold consumers. Adding Web Locks or BroadcastChannel
coordination is outside this design.

The Worker retains its current rejected-initialization cleanup. A failed data
Promise is never reused by a later Generate.

## Baseline Default In PR 15

`DEFAULT_CONTROLS.compareBaseline` becomes `false`. The checkbox remains visible
and a user can explicitly enable it. Requests that explicitly contain
`compareBaseline: true` preserve current behavior and output. URL state that
omits the control now resolves to the new false default; explicit shared URLs
remain authoritative.

The sampler algorithm and baseline implementation do not change. This only
removes the second compile/sample pass from the default Generate path.

## Error Handling

- A failed or superseding attempt aborts manifest and speculative core network
  work together; non-abortable cache operations honor before/after checkpoints.
- Manifest schema, release-ID, path, or origin failures remain fail-closed and do
  not pin a manifest.
- A speculative-core URL mismatch fails before its bytes are parsed or cached.
- Cached corruption is best-effort evicted and bypassed by one forced reload in
  the same call. Only a failed forced response reaches the page or Worker error
  surface; explicit Retry then starts a new attempt.
- Cache API and quota failures degrade to verified network loading.
- Artifact HTTP, digest, JSON, schema, dataset, and pack/core errors retain safe
  user-facing messages and detailed internal error codes used by tests.
- A Worker initialization or sampling error causes the existing client to
  discard that Worker; the next Generate creates and initializes a fresh one.

## Testing

Implementation follows test-first changes at each boundary.

### Unit Tests

`tests/data-loader.test.mjs` gains injected Cache Storage coverage for:

- miss, verified network load, and commit;
- hit with repeated size, digest, JSON, schema, and dataset checks;
- core, pack, and auxiliary validation before commit;
- corrupted entry eviction, delete failure, and same-call forced reload;
- no writes after HTTP, parse, digest, schema, or dataset failure;
- unavailable Cache API and rejected open/match/delete/put operations;
- abort before put prevents a write; abort during an in-progress verified put may
  finish the put but exposes no parsed value;
- awaited put completion before a successful load returns;
- speculative URL equality, concurrent start, cancellation, and observed failure;
- no reuse of a rejected byte request.

PR 15 Worker, request-schema, URL-state, and browser-model tests cover the false
baseline default, explicit true behavior, and fresh Worker retry semantics.

### Release And Static Tests

`tests/runtime-release.test.mjs` and runtime-builder fixtures cover:

- literal manifest/core/release-ID binding;
- manifest-derived core binding, including v2 reuse of `graph-core.v1.json`;
- exact preload closure and locked paths;
- reproducible v1/v2 bytes and lock files;
- predecessor metadata;
- PR 14 v1 `--check` and `--check-source`;
- PR 15 v1 `--check`, v2 `--check`, and v2 `--check-source`;
- PR 15's external v1 path equality against the frozen PR 14 commit.

A repository-path test requires all local assets referenced by `synthesis.html`
to exist after the rebase.

### Browser Tests

Playwright uses a clean Cache Storage namespace for cold cases and the same
browser context for warm cases. Cache-reuse request assertions run only after
the test has observed a successful cache commit. Request instrumentation
verifies:

- zero local-resource 404s and styled navigation/page output;
- each eager module, manifest, and cold core is requested once;
- core starts before the delayed manifest response completes;
- after the Window core commit, PR 15 first Generate makes no network core
  request and one pack request;
- after both commits, sequential reload and Worker recreation transfer neither
  verified core nor pack again;
- a planted corrupt cache entry is never used, attempts deletion, and performs
  one forced reload even when deletion fails;
- forced-reload failure reaches the error UI and a later explicit Retry can
  recover;
- unavailable Cache Storage or rejected put still produces verified output but
  does not promise zero duplicate transfers;
- failure, abort, and retry UI behavior remains intact.

### Performance Report

The same Pages-like gzip server and throttling profile used in diagnosis records
five cold and five warm runs for both PRs. The report includes medians for
verified initial load and PR 15 first Generate plus request/transfer counts.
Timing is diagnostic because shared CI runners are noisy; request counts, cache
behavior, integrity checks, and 404 absence are blocking assertions.

## Acceptance Criteria

- PR 14 and PR 15 merged snapshots contain no missing local resource requests.
- A cold page transfers core at most once.
- Manifest and core network intervals overlap on a cold load.
- With Cache Storage available and the Window core commit successful, PR 15
  first Generate transfers no core and at most one pack.
- With both commits successful and retained, sequential reload and Worker
  recreation transfer neither core nor pack.
- With Cache Storage unavailable or a commit rejected, loading remains correct
  and fully verified; duplicate-transfer guarantees do not apply.
- Every cache read still executes all descriptor and semantic validation.
- Corrupt cached data cannot render or generate output; it is best-effort evicted
  and bypassed by a forced verified response even if deletion fails.
- Default PR 15 Generate does not compute baseline; explicit opt-in still does.
- Runtime/data builders, lock checks, Node tests, and Playwright tests pass for
  both rebased PR heads.
- `range-diff` shows only intended rebasing, path repair, performance, tests,
  documentation, and generated lock changes.

## Rollback

Because both PRs remain drafts, rollback before merge records the current remote
head as the expected lease and pushes the selected backup SHA under that lease.
After merge, the performance changes are separable:
module-preload links, speculative core start, Cache Storage adapter, and baseline
default can each be reverted while retaining the path repair.

Cache entries require no migration. Removing or versioning the namespace makes
old entries unreachable; browser eviction cleans them over time. Correctness
never depends on cache persistence.

## Alternatives Considered

### Native HTTP Cache Only

Changing `no-store` to `default` or `force-cache` is smaller, but reuse remains
dependent on server TTL, browser eviction, and Worker cache decisions. It does
not provide deterministic cross-Window/Worker request behavior. The selected
design still permits normal HTTP caching for manifests and artifact misses, but
only a successful awaited Cache Storage commit provides the sequential
cross-Window/Worker reuse guarantee.

### Transfer Core From Window To Worker

Transferring raw or parsed core would avoid one Worker read, but it expands the
Worker message contract, requires ownership/copy decisions for 1.3 MB, does not
solve pack or navigation reuse, and weakens the current independent-loading
boundary. Shared verified bytes solve the duplicate transfer without that
coupling.

### Bundle And Service Worker

Bundling would reduce module requests, but the repository has no bundler and its
release model currently locks source-equal per-file runtime bytes. A bundler
would require a new dependency supply chain and deterministic-output model.
A Service Worker adds lifecycle, update, and offline-cache invalidation behavior
that this static page does not need. Module preload and Cache Storage capture the
needed benefits with a smaller, testable change.
