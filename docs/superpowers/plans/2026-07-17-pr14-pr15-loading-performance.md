# PR 14/15 Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the existing PR 14 and PR 15 branches so their merged snapshots have no missing assets, start verified data sooner, reuse verified artifacts across Window and Worker contexts, and keep baseline comparison out of PR 15's default Generate path.

**Architecture:** Keep the static GitHub Pages and immutable runtime-release model. The v1/v2 apps preload their eager module closures, start an opaque core-byte request alongside manifest loading, and use a Cache Storage adapter inside `data-loader.js`; every cache hit still passes size, SHA-256, JSON, version, dataset, and schema checks. PR 15 remains stacked on the finalized PR 14 head until PR 14 merges, then its Phase 2-only range is rebased onto upstream `main`.

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules, Cache Storage, Web Crypto, Dedicated Worker, Node 18+ `node:test`, deterministic Node runtime builder, Playwright 1.61.0, GitHub Pages static hosting.

## Global Constraints

- Update the existing fork branches `feature/synthesis-studio-phase1` and `feature/synthesis-studio-phase2`; do not open replacement PRs.
- Use only explicit `--force-with-lease=<ref>:<expected-sha>` pushes. Never use bare `--force`.
- Do not add a bundler, package-manager runtime dependency, Service Worker, backend, CDN, or hosting change.
- Do not change graph, sampler, manifest, artifact, or release-lock schemas.
- Keep query and fragment components out of synthesis runtime/data URLs.
- Keep the Worker init payload to manifest plus base URL; do not post parsed core or pack data across the Worker boundary.
- Cache only raw artifact bytes. Never place the manifest in the verified Cache Storage namespace.
- Artifact network misses use `cache: "default"`; only the next explicit page Retry after a current non-abort failure owns `cache: "reload"`, and that reload consumes the call's one bypass allowance.
- On every artifact source, require byte length, SHA-256, JSON, and the applicable semantic checks before use: core/pack format version and dataset binding, core schema, pack-with-core schema, or the supplied auxiliary schema.
- A successful artifact load awaits `cache.put()` settlement. Cache API failure may degrade performance but must not change correctness.
- Cache Storage has no cross-context single-flight guarantee; zero-repeat assertions apply only after a successful awaited commit.
- `DEFAULT_CONTROLS.compareBaseline` becomes `false`; explicit `true` remains supported and algorithmically unchanged.
- Runtime release directories are rebuilt only while absent from `origin/main`. Remove the complete draft directory and let `build-synthesis-runtime.mjs --write` recreate it atomically; never edit a release file or lock manually.
- PR 14 runs v1 `--check` and v1 `--check-source`. PR 15 runs v1 `--check`, v2 `--check`, and v2 `--check-source`; PR 15 must not run v1 `--check-source`.
- Artifact-generation metadata remains pinned to Node 18.19.1, MatrAIx source commit `4dfa4e066b706c6a2d33a10fd41b976efd3f524e`, full-DAG SHA-256 `28822720c6f8beea8f9386ef918df329ff5607eacea9ad16f5b80edc6dc4e166`, and dimensions SHA-256 `109d203ae177b62e872ebc3272d52a7705e02c35575456728f99332f481a4f42`.
- Golden regeneration uses Python 3.12.3 and NumPy 2.5.1 from `/data2/zonglin/MatrAIx/.venv/bin/python` and asserts both versions before execution.
- Use test-first changes, explicit path staging, and focused commits. Do not use `git add -A`.
- Preserve unrelated files and the untracked `docs/superpowers/plans/2026-07-16-synthesis-studio-static-port.md` in the primary `main` worktree.
- Run Tasks 1-8 from `/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design` and Tasks 9-13 from `/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1`. Re-declare shell variables shown in an earlier code block whenever a new shell session is opened.

## File Structure

### PR 14 source and entry files

- `synthesis.html`: current shared asset paths, v1 runtime entry, and exact v1 eager module-preload list.
- `synthesis/data-loader.js`: manifest fetch policy, artifact request handle, verified-byte cache adapter, recovery, and abort checkpoints.
- `synthesis/app.js`: v1 literal manifest/core binding and attempt lifecycle.

### Shared build and test files

- `scripts/build-synthesis-runtime.mjs`: eager static-import closure and literal manifest/core/release binding.
- `tests/data-loader.test.mjs`: injected fetch/Cache Storage unit contract.
- `tests/runtime-release.test.mjs`: HTML assets, module preloads, builder binding, release locks, and v2 core-reuse fixtures.
- `tests/browser/synthesis.spec.mjs`: no-404, request ordering/counts, cache persistence/recovery, and Worker reuse.
- `tests/browser/benchmark.mjs`: non-CI five-run Pages-like gzip/throttling report.
- `tests/browser/package.json`: `benchmark` script only; no new dependency.

### Generated PR 14 files

- `synthesis/releases/v1/**`: complete builder-generated v1 runtime and `release-lock.json`.

### PR 15 source and entry files

- `synthesis.html`: v2 entry and exact 17-module eager preload list.
- `synthesis/app.js`: Phase 2 UI plus v2 manifest and reused v1 core literal.
- `synthesis/request-schema.js`: baseline default and omitted-field normalization.
- `synthesis/README.md`: opt-in baseline, verified-cache contract, and relocated dimensions command.
- `README.md`: opt-in baseline and relocated dimensions command.
- `.github/workflows/synthesis-studio.yml`: `data/dimensions.json` generation input.
- `scripts/generate-synthesis-goldens-p2.py`: relocated dimensions source.
- `tests/build-sampler-pack.test.mjs`, `tests/dimensions-schema.test.mjs`, `tests/render-persona.test.mjs`: relocated source assertions.
- `tests/adjust-results-panels.test.mjs`, `tests/sampler-worker.test.mjs`, `tests/url-state.test.mjs`, `tests/browser/synthesis.spec.mjs`: false default plus explicit true behavior.

### Generated PR 15 files

- `synthesis/releases/v2/**`: complete builder-generated v2 runtime and predecessor lock.
- `synthesis/releases/v1/**`: inherited byte-for-byte from the frozen PR 14 commit; never regenerated in PR 15.

---

### Task 1: Protect Existing Heads And Rebase PR 14

**Files:**
- Verify only: both synthesis worktrees and Git refs

**Interfaces:**
- Consumes: clean worktrees `synthesis-studio-phase1-design` and `synthesis-studio-phase1`, live `origin/main`, and live fork heads for both existing PR branches.
- Produces: stable local refs `backup/upstream-main-20260717`, `backup/pr14-remote-20260717`, `backup/pr14-local-20260717`, and `backup/pr15-remote-20260717`.
- Produces: PR 14 rebased on the exact upstream commit stored in `backup/upstream-main-20260717`.

- [ ] **Step 1: Verify both worktrees and remote heads are clean and available**

```bash
set -euo pipefail
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P14=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
test -z "$(git -C "$P14" status --porcelain)"
test -z "$(git -C "$P15" status --porcelain)"
git -C "$REPO" fetch origin
git -C "$REPO" fetch fork
test "$(git -C "$REPO" rev-parse fork/feature/synthesis-studio-phase1)" = \
  "$(git ls-remote fork refs/heads/feature/synthesis-studio-phase1 | awk '{print $1}')"
test "$(git -C "$REPO" rev-parse fork/feature/synthesis-studio-phase2)" = \
  "$(git ls-remote fork refs/heads/feature/synthesis-studio-phase2 | awk '{print $1}')"
```

Expected: every command exits 0; no worktree has tracked or untracked changes.

- [ ] **Step 2: Create immutable local backup refs**

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
git -C "$REPO" branch backup/upstream-main-20260717 origin/main
git -C "$REPO" branch backup/pr14-remote-20260717 \
  fork/feature/synthesis-studio-phase1
git -C "$REPO" branch backup/pr14-local-20260717 \
  feature/synthesis-studio-phase1
git -C "$REPO" branch backup/pr15-remote-20260717 \
  fork/feature/synthesis-studio-phase2
git -C "$REPO" merge-base --is-ancestor \
  backup/pr14-remote-20260717 backup/pr14-local-20260717
test "$(git -C "$REPO" rev-list --count backup/pr14-remote-20260717..backup/pr14-local-20260717)" -eq 2
ACTUAL_DOC_PATHS=$(git -C "$REPO" diff --name-only backup/pr14-remote-20260717..backup/pr14-local-20260717)
EXPECTED_DOC_PATHS=$(printf '%s\n' docs/superpowers/plans/2026-07-17-pr14-pr15-loading-performance.md docs/superpowers/specs/2026-07-17-pr14-pr15-loading-performance-design.md)
test "$ACTUAL_DOC_PATHS" = "$EXPECTED_DOC_PATHS"
```

Expected: four new refs are created; the final assertions prove the local PR 14 branch contains exactly the two approved planning documents and no code change.

- [ ] **Step 3: Rebase the local PR 14 range onto frozen upstream main**

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P14=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
git -C "$P14" rebase backup/upstream-main-20260717
git -C "$REPO" merge-base --is-ancestor \
  backup/upstream-main-20260717 feature/synthesis-studio-phase1
```

Expected: rebase completes. If Git stops, resolve each reported file with the Phase 1 behavior plus current-main asset layout; do not use a bulk ours/theirs resolution. Then run `git -C "$P14" rebase --continue` until complete.

- [ ] **Step 4: Audit the rewritten range**

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P14=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
OLD_BASE=$(git -C "$REPO" merge-base \
  backup/pr14-remote-20260717 backup/upstream-main-20260717)
git -C "$REPO" range-diff \
  "$OLD_BASE..backup/pr14-local-20260717" \
  "backup/upstream-main-20260717..feature/synthesis-studio-phase1"
git -C "$P14" diff --check
git -C "$P14" status --short --branch
```

Expected: `range-diff` shows the original Phase 1 changes plus the approved docs commits, rewritten only for the new base; status is clean.

### Task 2: Repair Merged-Snapshot Asset Paths

**Files:**
- Modify: `synthesis.html`
- Modify: `tests/runtime-release.test.mjs`
- Modify: `tests/browser/synthesis.spec.mjs`

**Interfaces:**
- Consumes: current-main shared asset locations `Assets/icons`, `css`, and `js`, plus local HTML resource discovery from `link[href]` and `script[src]`.
- Produces: `assertLocalHtmlResources(root, html)` in `tests/runtime-release.test.mjs`.
- Produces: a v1 page whose local `link[href]` and `script[src]` paths all resolve to regular repository files.

- [ ] **Step 1: Install the pinned browser test environment**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
npm --prefix tests/browser ci
npx --prefix tests/browser playwright install chromium webkit
test "$(node -p "require('./tests/browser/node_modules/@playwright/test/package.json').version")" = "1.61.0"
```

Expected: the local Playwright CLI and both configured browser engines are available.

- [ ] **Step 2: Add a failing repository-resource test**

Import `realpathSync` from `node:fs` and `relative`, `resolve`, and `sep` from `node:path`. Add this helper beside `assertHtmlRuntimeEntries()`:

```js
function assertLocalHtmlResources(root, html) {
  const physicalRoot = realpathSync(root);
  const values = [
    ...startTags(html, "link").map((attrs) => attrs.get("href")),
    ...startTags(html, "script").map((attrs) => attrs.get("src")),
  ].filter(Boolean);
  for (const value of values) {
    if (/^https?:\/\//i.test(value)) continue;
    const pathname = value.split(/[?#]/, 1)[0];
    assert.ok(pathname && !pathname.startsWith("/"), `invalid local asset: ${value}`);
    const absolute = resolve(root, pathname);
    const lexicalRelative = relative(root, absolute);
    assert.ok(
      lexicalRelative !== ".."
        && !lexicalRelative.startsWith(`..${sep}`)
        && !lexicalRelative.startsWith(sep),
      `escaping local asset: ${pathname}`,
    );
    assert.ok(existsSync(absolute), `missing local asset: ${pathname}`);
    const physicalRelative = relative(physicalRoot, realpathSync(absolute));
    assert.ok(
      physicalRelative !== ".."
        && !physicalRelative.startsWith(`..${sep}`)
        && !physicalRelative.startsWith(sep),
      `escaped local asset: ${pathname}`,
    );
    const stat = lstatSync(absolute);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `unsafe local asset: ${pathname}`);
  }
}
```

Call `assertLocalHtmlResources(REPOSITORY_ROOT, html)` in the real repository entry-point test. Replace its old root-path assertions with:

```js
assert.match(html, /href="css\/styles\.css\?v=9"/);
assert.match(html, /href="css\/navigation\.css\?v=1"/);
assert.match(html, /src="js\/theme-toggle\.js\?v=3"/);
assert.match(html, /src="js\/site-performance\.js\?v=1"/);
```

- [ ] **Step 3: Run the new test and observe the semantic rebase failure**

Run: `node --test --test-name-pattern="repository release and public entry" tests/runtime-release.test.mjs`

Expected: FAIL with `missing local asset: favicon.ico` or another old root pathname.

- [ ] **Step 4: Update the page to the current site asset layout**

Replace the local resource block in `synthesis.html` with these exact paths, retaining the existing accessible `primaryNav` IDs and ARIA attributes:

```html
  <link rel="icon" href="Assets/icons/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="Assets/icons/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="Assets/icons/favicon-16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="Assets/icons/apple-touch-icon.png" />
  <link rel="stylesheet" href="css/styles.css?v=9" />
  <link rel="stylesheet" href="css/dark-theme.css?v=5" />
  <link rel="stylesheet" href="css/subpages.css?v=8" />
  <link rel="stylesheet" href="css/subpages-light.css?v=2" />
  <link rel="stylesheet" href="css/navigation.css?v=1" />
  <link rel="stylesheet" href="synthesis/releases/v1/synthesis.css" />
```

Replace the two classic scripts at the end of the body:

```html
  <script src="js/theme-toggle.js?v=3"></script>
  <script src="js/site-performance.js?v=1"></script>
```

- [ ] **Step 5: Update the browser request allowlist**

Set the shared entries in `SITE_CODE_URLS` to:

```js
const SITE_CODE_URLS = [
  `${STUDIO_ORIGIN}/css/styles.css?v=9`,
  `${STUDIO_ORIGIN}/css/dark-theme.css?v=5`,
  `${STUDIO_ORIGIN}/css/subpages.css?v=8`,
  `${STUDIO_ORIGIN}/css/subpages-light.css?v=2`,
  `${STUDIO_ORIGIN}/css/navigation.css?v=1`,
  `${STUDIO_ORIGIN}/js/theme-toggle.js?v=3`,
  `${STUDIO_ORIGIN}/js/site-performance.js?v=1`,
  GOOGLE_FONT_STYLESHEET,
  ...RELEASE_RUNTIME_PATHS.map((pathname) => `${STUDIO_ORIGIN}${pathname}`),
];
```

- [ ] **Step 6: Verify the path repair**

```bash
node --test --test-name-pattern="repository release and public entry" \
  tests/runtime-release.test.mjs
npm --prefix tests/browser test -- \
  --project=chromium-desktop --grep "browser fetch graph"
```

Expected: PASS; the browser guard reports no 404, request failure, or resource console error.

- [ ] **Step 7: Commit the path repair**

```bash
git add synthesis.html tests/runtime-release.test.mjs tests/browser/synthesis.spec.mjs
git commit -m "fix: align synthesis page with site asset paths"
```

### Task 3: Preload The Exact Eager Module Closure

**Files:**
- Modify: `scripts/build-synthesis-runtime.mjs`
- Modify: `synthesis.html`
- Modify: `tests/runtime-release.test.mjs`
- Modify: `tests/browser/synthesis.spec.mjs`

**Interfaces:**
- Consumes: builder-owned `runtimeBytes: Map<string, Buffer>`, entry module `app.js`, and only static relative import/export edges resolved within the release target set.
- Produces: `eagerModuleClosure(runtimeBytes: Map<string, Buffer>, entry?: string): string[]`.
- Produces: nine query-free v1 `modulepreload` links, exactly matching static import/re-export reachability from `app.js`.

- [ ] **Step 1: Add failing eager-closure and HTML-preload tests**

Import `eagerModuleClosure` from the runtime builder and add:

```js
function runtimeBytesFor(root, releaseId) {
  const lock = readJson(root, `synthesis/releases/${releaseId}/release-lock.json`);
  return new Map(lock.runtime
    .filter(({ path }) => path.endsWith(".js"))
    .map(({ path }) => [path, readFileSync(join(
      root, "synthesis", "releases", releaseId, ...path.split("/"),
    ))]));
}

function assertHtmlModulePreloads(root, html, releaseId) {
  const prefix = `synthesis/releases/${releaseId}/`;
  const actual = startTags(html, "link")
    .filter((attrs) => (attrs.get("rel") ?? "").toLowerCase().split(/\s+/)
      .includes("modulepreload"))
    .map((attrs) => attrs.get("href"));
  for (const href of actual) {
    assert.equal(href?.startsWith(prefix), true);
    assert.doesNotMatch(href, /[?#]/);
  }
  const expected = eagerModuleClosure(runtimeBytesFor(root, releaseId))
    .map((target) => `${prefix}${target}`)
    .sort();
  assert.deepEqual([...actual].sort(), expected);
  return expected;
}
```

Add this mixed static-import/dynamic-import/Worker fixture:

```js
const eagerFixture = new Map([
  ["app.js", Buffer.from(
    'import "./dep.js"; export { reexported } from "./reexport.js"; ' +
    'import("./dynamic.js"); new Worker(new URL("./worker.js", import.meta.url), { type: "module" });',
  )],
  ["dep.js", Buffer.from("export const dep = true;\n")],
  ["reexport.js", Buffer.from("export const reexported = true;\n")],
  ["dynamic.js", Buffer.from("export const dynamic = true;\n")],
  ["worker.js", Buffer.from("self.onmessage = () => {};\n")],
]);
assert.deepEqual(eagerModuleClosure(eagerFixture), [
  "app.js",
  "dep.js",
  "reexport.js",
]);
```

In the real repository test, call `assertHtmlModulePreloads(REPOSITORY_ROOT, html, "v1")` and expect nine paths.

- [ ] **Step 2: Run the preload tests and verify they fail**

Run: `node --test --test-name-pattern="closure|repository release and public entry" tests/runtime-release.test.mjs`

Expected: FAIL because `eagerModuleClosure` is not exported and the HTML contains no module preloads.

- [ ] **Step 3: Implement the static-import closure using the existing tokenizer**

Add after `analyzeRuntime()`:

```js
export function eagerModuleClosure(runtimeBytes, entry = "app.js") {
  if (!(runtimeBytes instanceof Map) || typeof entry !== "string" || !entry.endsWith(".js")) {
    fail("eager module closure inputs are invalid");
  }
  const targetSet = new Set(runtimeBytes.keys());
  const graph = new Map();
  for (const [target, bytes] of runtimeBytes) {
    if (!target.endsWith(".js")) continue;
    const dependencies = new Set();
    for (const resource of scanJavaScript(bytes, target, { enforceRuntimeClosure: true })) {
      if (resource.kind !== "import" && resource.kind !== "re-export") continue;
      const resolved = resolveRuntimeSpecifier(target, resource, targetSet);
      if (!resolved?.endsWith(".js")) fail(`${target} eagerly imports a non-JavaScript target`);
      dependencies.add(resolved);
    }
    graph.set(target, dependencies);
  }
  if (!graph.has(entry)) fail(`eager module entry is missing: ${entry}`);
  const reachable = new Set();
  const visit = (target) => {
    if (reachable.has(target)) return;
    reachable.add(target);
    for (const dependency of graph.get(target) ?? []) visit(dependency);
  };
  visit(entry);
  return [...reachable].sort();
}
```

- [ ] **Step 4: Add the exact v1 preload block after release CSS**

```html
  <link rel="modulepreload" href="synthesis/releases/v1/app.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/data-loader.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/detail-rail.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/dist-utils.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/drilldown-graph.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/graph-store.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/graph-views.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/overview-graph.js" />
  <link rel="modulepreload" href="synthesis/releases/v1/url-state.js" />
```

Extend the browser request-graph test to compare the DOM preload hrefs with these nine paths. Do not add `synthesis.css` or a Worker entry.

- [ ] **Step 5: Run the closure, runtime, and browser tests**

```bash
node --test tests/runtime-release.test.mjs
npm --prefix tests/browser test -- \
  --project=chromium-desktop --grep "browser fetch graph"
```

Expected: PASS; every release module is requested once despite preload plus module entry.

- [ ] **Step 6: Commit module scheduling**

```bash
git add scripts/build-synthesis-runtime.mjs synthesis.html \
  tests/runtime-release.test.mjs tests/browser/synthesis.spec.mjs
git commit -m "perf: preload the synthesis module graph"
```

### Task 4: Separate transport, integrity, and semantic validation

**Files:**
- Modify: `synthesis/data-loader.js`
- Modify: `tests/data-loader.test.mjs`
- Regenerate: `synthesis/releases/v1/data-loader.js`
- Regenerate: `synthesis/releases/v1/release-lock.json`

**Interfaces:**
- Consumes: current `loadManifest(url, options)`, `loadArtifact(manifest, key, options)`, `loadAuxJson(manifest, key, options)`, descriptor validation, and semantic validators.
- Produces: `readResponseBytes(response): Promise<Uint8Array>`, `fetchBytes(url, init, fetchImpl): Promise<Uint8Array>`, `verifyDescriptorBytes(descriptor, key, bytes): Promise<Uint8Array>`, and `cacheModeFrom(options): "default" | "reload"` for pre-I/O transport-policy validation.

- [ ] **Step 1: Make the test fetch helper mode-aware**

Change `artifactFetch` to accept `cache = "default"` and assert that exact mode. Update every existing manifest, core, pack, and dimensions transport assertion from `"no-store"` to `"default"`; after this edit `rg -n '"no-store"' tests/data-loader.test.mjs` must return no match.

```js
const artifactFetch = (
  expectedPath,
  bytes,
  { status = 200, cache = "default" } = {},
) => async (url, init) => {
  const expectedUrl = new URL(expectedPath, BASE_URL).href;
  assert.equal(String(url), expectedUrl);
  assert.equal(new URL(String(url)).search, "");
  assert.equal(new URL(String(url)).hash, "");
  assert.equal(init.cache, cache);
  return new Response(bytes, { status });
};
```

- [ ] **Step 2: Add manifest mode and precondition tests**

Add these tests beside the current manifest and artifact-key cases:

```js
test("loadManifest uses default and explicit reload cache modes", async () => {
  for (const cacheMode of ["default", "reload"]) {
    await loadManifest(MANIFEST_URL, {
      cacheMode,
      expectedReleaseId: "v1",
      fetchImpl: async (_url, init) => {
        assert.equal(init.cache, cacheMode);
        return new Response(JSON.stringify(manifestFixture));
      },
    });
  }
});

test("loadManifest rejects an invalid cache mode before fetching", async () => {
  let fetches = 0;
  await rejectsWithCode(() => loadManifest(MANIFEST_URL, {
    cacheMode: "no-store",
    fetchImpl: async () => {
      fetches += 1;
      return new Response(JSON.stringify(manifestFixture));
    },
  }), "cache-mode");
  assert.equal(fetches, 0);
});

test("pack and dimensions preconditions fail before artifact I/O", async () => {
  let fetches = 0;
  await rejectsWithCode(() => loadArtifact(
    manifestWithBytes(),
    "pack",
    { baseUrl: BASE_URL, fetchImpl: async () => { fetches += 1; } },
  ), "missing-core");
  await rejectsWithCode(() => loadAuxJson(
    manifestWithBytes(),
    "dimensions",
    { baseUrl: BASE_URL, fetchImpl: async () => { fetches += 1; } },
  ), "missing-validator");
  assert.equal(fetches, 0);
});
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run: `node --test --test-name-pattern="cache modes|invalid cache mode|preconditions" tests/data-loader.test.mjs`

Expected: FAIL because manifest requests still use `no-store`, invalid cache modes are accepted, and pack validation starts after transport setup.

- [ ] **Step 4: Split response reading from descriptor verification**

Replace `responseBytes` with these two transport functions:

```js
async function readResponseBytes(response) {
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

async function fetchBytes(url, init, fetchImpl) {
  let response;
  try {
    if (typeof fetchImpl !== "function") throw new TypeError("fetch is unavailable");
    response = await fetchImpl(url, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ArtifactLoadError("network", "Snapshot request failed.", error);
  }
  return readResponseBytes(response);
}
```

Change `verifyDescriptorBytes` so it receives bytes and performs only size and digest checks:

```js
async function verifyDescriptorBytes(descriptor, key, bytes) {
  if (bytes.byteLength !== descriptor.bytes) {
    throw new ArtifactLoadError("size", `${key} size mismatch.`);
  }
  let digest;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || typeof subtle.digest !== "function") {
      throw new TypeError("Web Crypto unavailable");
    }
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
```

- [ ] **Step 5: Add explicit transport modes and move preconditions before I/O**

Add one shared option validator, then use it in `loadManifest` before fetching:

```js
function cacheModeFrom(options) {
  const cacheMode = options.cacheMode ?? "default";
  if (cacheMode !== "default" && cacheMode !== "reload") {
    throw new ArtifactLoadError("cache-mode", "Snapshot cache mode is unsupported.");
  }
  return cacheMode;
}

const cacheMode = cacheModeFrom(options);
const bytes = await fetchBytes(
  url,
  { cache: cacheMode, signal: options.signal },
  options.fetchImpl ?? globalThis.fetch,
);
```

For artifacts, resolve the descriptor, fetch with `cache: "default"`, and then call `verifyDescriptorBytes(descriptor, key, bytes)`. Move the `missing-core` and `missing-validator` checks ahead of `artifactRequest()` so invalid calls perform no cache or network operation.

- [ ] **Step 6: Run loader tests**

Run: `node --test tests/data-loader.test.mjs`

Expected: PASS.

- [ ] **Step 7: Rebuild v1 and verify the release**

The builder refuses to overwrite a release directory. Rebuild it as one generated unit:

```bash
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse backup/upstream-main-20260717)"
test -z "$(git ls-tree -r --name-only origin/main -- synthesis/releases/v1)"
git rm -r synthesis/releases/v1
node scripts/build-synthesis-runtime.mjs --release v1 --write
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v1 --check-source
node --test tests/runtime-release.test.mjs tests/data-loader.test.mjs
```

Expected: PASS and the v1 lock records only the intended runtime-byte changes.

- [ ] **Step 8: Commit the refactor**

```bash
git add synthesis/data-loader.js synthesis/releases/v1 tests/data-loader.test.mjs
git commit -m "refactor: separate synthesis fetch and verification"
```

### Task 5: Add a verified Cache Storage layer

**Files:**
- Modify: `synthesis/data-loader.js`
- Modify: `tests/data-loader.test.mjs`
- Regenerate: `synthesis/releases/v1/data-loader.js`
- Regenerate: `synthesis/releases/v1/release-lock.json`

**Interfaces:**
- Consumes: `readResponseBytes(response)`, `fetchBytes(url, init, fetchImpl)`, `verifyDescriptorBytes(descriptor, key, bytes)`, `cacheModeFrom(options)`, plus the existing core, pack-with-core, and auxiliary semantic validators.
- Produces: private `Candidate = { cache: Cache | null, bytes: Uint8Array, source: "cache" | "network", signal: AbortSignal | undefined, fetchImpl: (url, init) => Promise<Response>, recoveryUsed: boolean }`, `initialCandidate({ requestUrl, signal, fetchImpl, cacheStorage, cacheMode }): Promise<Candidate>`, and `loadVerifiedArtifact({ descriptor, key, requestUrl, signal, fetchImpl, cacheStorage, cacheMode, validate }): Promise<unknown>`; public artifact/aux options gain injectable `cacheStorage` and validated `cacheMode`, while return values and mutability remain unchanged.
- Produces: Cache Storage namespace `matraix-synthesis-verified-artifacts-v1`, raw verified-byte entries keyed by exact immutable artifact URL, and at most one `cache: "reload"` recovery per public load.

- [ ] **Step 1: Add an observable fake Cache Storage**

Add this test helper after `artifactFetch`. Its hooks allow an individual test to pause a non-abortable cache operation.

```js
function createCacheStorage({
  entries = new Map(),
  reject = new Set(),
  hooks = {},
} = {}) {
  const calls = [];
  const cache = {
    async match(url) {
      calls.push(["match", String(url)]);
      await hooks.match?.();
      if (reject.has("match")) throw new Error("match failed");
      const entry = entries.get(String(url));
      if (entry === undefined) return undefined;
      if (typeof entry === "function") return entry();
      if (entry instanceof Response) return entry.clone();
      return new Response(entry.slice());
    },
    async put(url, response) {
      calls.push(["put", String(url)]);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await hooks.put?.();
      if (reject.has("put")) throw new Error("put failed");
      entries.set(String(url), bytes);
    },
    async delete(url) {
      calls.push(["delete", String(url)]);
      await hooks.delete?.();
      if (reject.has("delete")) throw new Error("delete failed");
      return entries.delete(String(url));
    },
  };
  return {
    calls,
    entries,
    async open(name) {
      calls.push(["open", name]);
      await hooks.open?.();
      if (reject.has("open")) throw new Error("open failed");
      return cache;
    },
  };
}

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
```

- [ ] **Step 2: Complete the verified commit/reuse red-green microcycle**

Add tests with these exact assertions:

1. `"loadArtifact awaits a verified cache commit before resolving"`: pause `put`, assert the load promise is unsettled, release it, and assert one `default` fetch followed by one put.
2. `"loadArtifact revalidates a cached artifact without fetching"`: seed the exact artifact URL with `CORE_BYTES`, assert zero fetches and the expected parsed value.
3. `"sequential loads reuse the committed artifact"`: load the same core twice against one cache and assert one network request total.
4. `"artifact cache mode fails before cache or fetch"`: pass `cacheMode: "no-store"`, inject cache/fetch counters, assert `cache-mode`, and assert both counters remain zero.

The first test must use the settlement flag below rather than a timing sleep:

```js
let settled = false;
const load = loadArtifact(manifestWithBytes(), "core", {
  baseUrl: BASE_URL,
  cacheStorage,
  fetchImpl: artifactFetch(CORE_PATH, CORE_BYTES),
}).finally(() => { settled = true; });
const firstSettlement = await Promise.race([
  putStarted.promise.then(() => "put-started"),
  load.then(
    () => "load-settled",
    () => "load-settled",
  ),
]);
assert.equal(firstSettlement, "put-started");
assert.equal(settled, false);
allowPut.resolve();
assert.deepEqual(await load, coreFixture);
```

Run: `node --test --test-name-pattern="awaits a verified cache commit|revalidates a cached artifact|sequential loads|artifact cache mode" tests/data-loader.test.mjs`

Expected: FAIL because `loadArtifact` does not open Cache Storage or await a verified write.

Implement only the happy path represented by the final helpers in Steps 5 and 6: select `cacheModeFrom(options)` before I/O, add the cache namespace, open/match a candidate, fetch a miss with the selected mode, perform the existing descriptor and semantic validation, await a network candidate's put, and return a validated cache hit. Do not add `CONTENT_FAILURE_CODES`, deletion, forced reload, best-effort degradation, or the post-promise abort checkpoints yet.

Run the same command again. Expected: PASS before starting the recovery matrix.

- [ ] **Step 3: Complete the semantic-recovery red-green microcycle**

First add `"pack and dimensions commit only after semantic validation"`: use invalid but correctly hashed bytes, assert `schema`, no put, one delete, and a single `reload` retry; repeat with valid bytes and assert one put. Add `"an auxiliary validator false result is a schema failure"`; return `false` on both attempts, assert the safe `schema` message, two validator calls, modes `["default", "reload"]`, and zero puts.

Add a parent test named `"content failures recover once and preserve the terminal error"` with table-driven subtests. Every case supplies a fresh cache and counts `init.cache` values.

| First failure | Delete | Forced reload | Second failure allowed |
|---|---:|---:|---:|
| `size`, `hash`, `json`, `version`, `dataset`, `schema` | once, best effort | exactly once with `reload` | returned, no third request |
| cached `http` or `body` | once, best effort | exactly once with `reload` | returned, no third request |
| network `http`, `network`, network `body`, `digest`, abort | never | never | not applicable |

Include a corrupt cache-hit case whose forced response is valid:

```js
test("a corrupt cached core is deleted and recovered once with reload", async () => {
  const url = new URL(CORE_PATH, BASE_URL).href;
  const cacheStorage = createCacheStorage({
    entries: new Map([[url, encode("corrupt")]]),
  });
  const modes = [];
  const value = await loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    cacheStorage,
    fetchImpl: async (_url, init) => {
      modes.push(init.cache);
      return new Response(CORE_BYTES);
    },
  });
  assert.deepEqual(value, coreFixture);
  assert.deepEqual(modes, ["reload"]);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "delete").length, 1);
  assert.equal(cacheStorage.calls.filter(([kind]) => kind === "put").length, 1);
});
```

Also assert that two content-invalid network responses produce modes `["default", "reload"]`, preserve the second error code, never issue a third request, and never write either failed response. Add `"reload mode consumes the one bypass allowance"`: start a cache-miss load with `cacheMode: "reload"`, return content-invalid bytes, assert exactly one `reload` fetch, the original content error, and no put. A cached 404/body failure is treated as corrupt cached state: delete it, make one `reload` request in the same call, and never read that cache key twice. Add a separate test named `"network transport failures do not retry"` covering network-sourced HTTP/body failures. Add `"delete rejection does not block verified recovery"`: reject `cache.delete()` once and prove the same valid forced response still succeeds; deletion is already best effort within recovery.

Run: `node --test --test-name-pattern="semantic validation|auxiliary validator false|content failures recover once|reload mode consumes|corrupt cached core|network transport failures do not retry|delete rejection" tests/data-loader.test.mjs`

Expected: FAIL because the happy-path implementation has no deletion or one-shot recovery state.

Add `CONTENT_FAILURE_CODES`, deletion that preserves the validation/recovery result when `cache.delete()` rejects, the cached HTTP/body replacement branch, and the two-attempt `recoveryUsed` state machine exactly as consolidated in Steps 5 and 6. Do not add open/match/put degradation or the abort checkpoints yet.

Run the same command again. Expected: PASS before adding degradation coverage.

- [ ] **Step 4: Complete the degradation/abort red-green microcycle**

Add a parent test named `"cache open match and put failures degrade to verified loading"`. For each of `open`, `match`, and `put`, reject the fake operation and prove that a valid artifact still loads. Keep the Step 3 delete-rejection case green. Then cover the non-abortable boundaries:

1. Abort before `open`: no cache or fetch call.
2. Abort while `match` is paused: match may finish, but no fetch and no value is exposed.
3. In an auxiliary validator, abort immediately before returning success: the post-validation checkpoint prevents `put`.
4. Abort while `put` is paused: the put may finish, but the load rejects with `AbortError` and exposes no parsed value.
5. Abort after `cachedCandidate()` settles but before its caller continues: a response whose `arrayBuffer()` increments a counter is never read.
6. Abort after `bestEffortDelete()` settles but before its caller continues: corrupt cached content is deleted but no reload fetch starts.
7. Abort after `bestEffortCommit()` settles but before its caller continues: the verified put may exist, but no parsed value is exposed.

Use this deterministic scheduler from the fake Cache Storage hook for cases 5-7. The fake `put` reads its response before invoking the hook, so after each hook there are exactly three relevant continuations: fake operation, cache helper, then helper caller. The three nested microtasks place abort after the helper's internal post-check and before the awaiting caller continuation:

```js
const abortBetweenHelperAndCaller = (controller) => {
  queueMicrotask(() => {
    queueMicrotask(() => {
      queueMicrotask(() => controller.abort());
    });
  });
};
```

Run: `node --test --test-name-pattern="cache|reload|abort" tests/data-loader.test.mjs`

Expected: FAIL on the rejecting Cache Storage operations and post-promise abort boundaries; the commit/reuse and recovery tests remain green.

Replace the provisional cache operations with the abort-aware best-effort helpers in Step 5 and add every helper-internal and caller-side checkpoint shown in Step 6. Run the same command again. Expected: PASS before consolidating the final implementation.

- [ ] **Step 5: Consolidate the final cache constants and helpers**

The three microcycles have introduced these pieces incrementally. Compare the source with this complete definition and make it exact; this step adds no new behavior. Place the constants beside the loader constants:

```js
const VERIFIED_ARTIFACT_CACHE = "matraix-synthesis-verified-artifacts-v1";
const CONTENT_FAILURE_CODES = new Set([
  "size",
  "hash",
  "json",
  "version",
  "dataset",
  "schema",
]);

const throwIfAborted = (signal) => {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === "function") signal.throwIfAborted();
  throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
};
```

Implement these cache helpers in `data-loader.js`. Each helper checks the signal on both sides of a Cache Storage promise because those promises cannot be cancelled.

```js
async function openArtifactCache(cacheStorage, signal) {
  throwIfAborted(signal);
  if (!cacheStorage || typeof cacheStorage.open !== "function") return null;
  try {
    const cache = await cacheStorage.open(VERIFIED_ARTIFACT_CACHE);
    throwIfAborted(signal);
    return cache;
  } catch (error) {
    throwIfAborted(signal);
    return null;
  }
}

async function cachedCandidate(cache, requestUrl, signal) {
  throwIfAborted(signal);
  if (!cache || typeof cache.match !== "function") return null;
  try {
    const response = await cache.match(requestUrl.href);
    throwIfAborted(signal);
    return response ?? null;
  } catch (error) {
    throwIfAborted(signal);
    return null;
  }
}

async function bestEffortDelete(cache, requestUrl, signal) {
  throwIfAborted(signal);
  if (!cache || typeof cache.delete !== "function") return;
  try {
    await cache.delete(requestUrl.href);
  } catch (error) {
    // Cache deletion is an optimization; validation remains authoritative.
  }
  throwIfAborted(signal);
}

async function bestEffortCommit(cache, requestUrl, bytes, signal) {
  throwIfAborted(signal);
  if (!cache || typeof cache.put !== "function") return;
  try {
    await cache.put(requestUrl.href, new Response(bytes));
  } catch (error) {
    // Cache writes may fail under quota or privacy restrictions.
  }
  throwIfAborted(signal);
}
```

- [ ] **Step 6: Consolidate the final verified-candidate state machine**

Compare the incrementally built private candidate selector with this complete definition and make it exact:

```js
async function initialCandidate({
  requestUrl,
  signal,
  fetchImpl,
  cacheStorage,
  cacheMode,
}) {
  const cache = await openArtifactCache(cacheStorage, signal);
  throwIfAborted(signal);
  const response = await cachedCandidate(cache, requestUrl, signal);
  throwIfAborted(signal);
  if (response !== null) {
    try {
      const bytes = await readResponseBytes(response);
      throwIfAborted(signal);
      return {
        cache,
        bytes,
        source: "cache",
        signal,
        fetchImpl,
        recoveryUsed: false,
      };
    } catch (error) {
      if (error instanceof ArtifactLoadError
          && (error.code === "http" || error.code === "body")) {
        await bestEffortDelete(cache, requestUrl, signal);
        throwIfAborted(signal);
        const bytes = await fetchBytes(
          requestUrl,
          { cache: "reload", signal },
          fetchImpl,
        );
        throwIfAborted(signal);
        return {
          cache,
          bytes,
          source: "network",
          signal,
          fetchImpl,
          recoveryUsed: true,
        };
      }
      throw error;
    }
  }
  const bytes = await fetchBytes(
    requestUrl,
    { cache: cacheMode, signal },
    fetchImpl,
  );
  throwIfAborted(signal);
  return {
    cache,
    bytes,
    source: "network",
    signal,
    fetchImpl,
    recoveryUsed: cacheMode === "reload",
  };
}
```

Then add the private verified state machine:

```js
async function loadVerifiedArtifact({
  descriptor,
  key,
  requestUrl,
  signal,
  fetchImpl,
  cacheStorage,
  cacheMode,
  validate,
}) {
  let candidate = await initialCandidate({
    requestUrl,
    signal,
    fetchImpl,
    cacheStorage,
    cacheMode,
  });
  throwIfAborted(candidate.signal);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await verifyDescriptorBytes(descriptor, key, candidate.bytes);
      throwIfAborted(candidate.signal);
      const value = parseJson(candidate.bytes, key);
      await validate(value);
      throwIfAborted(candidate.signal);
      if (candidate.source !== "cache") {
        await bestEffortCommit(
          candidate.cache,
          requestUrl,
          candidate.bytes,
          candidate.signal,
        );
      }
      throwIfAborted(candidate.signal);
      return value;
    } catch (error) {
      if (attempt !== 0
          || candidate.recoveryUsed
          || !(error instanceof ArtifactLoadError)
          || !CONTENT_FAILURE_CODES.has(error.code)) {
        throw error;
      }
      await bestEffortDelete(candidate.cache, requestUrl, candidate.signal);
      throwIfAborted(candidate.signal);
      const bytes = await fetchBytes(
        requestUrl,
        { cache: "reload", signal: candidate.signal },
        candidate.fetchImpl,
      );
      throwIfAborted(candidate.signal);
      candidate = {
        ...candidate,
        bytes,
        source: "network",
        recoveryUsed: true,
      };
    }
  }
  throw new ArtifactLoadError("artifact", "Snapshot artifact could not be loaded.");
}
```

The cache response is read only in `initialCandidate`; a retry always replaces it with freshly fetched bytes. The terminal throw is a defensive unreachable branch, not a third attempt.

Select `cacheStorage` without forcing Node tests to provide a browser global:

```js
const cacheStorage = hasOwn(options, "cacheStorage")
  ? options.cacheStorage
  : globalThis.caches;
```

After the existing artifact-key and missing-core/missing-validator preconditions, select the transport mode before any cache/network I/O and pass it to the state machine:

```js
const cacheMode = cacheModeFrom(options);
return loadVerifiedArtifact({
  descriptor,
  key,
  requestUrl,
  signal: options.signal,
  fetchImpl: options.fetchImpl ?? globalThis.fetch,
  cacheStorage,
  cacheMode,
  validate,
});
```

Refactor `loadArtifact` so its existing JSON, version, dataset, core, and pack checks live in the supplied async `validate(value)` callback. For `loadAuxJson`, preserve its exact false-result and safe-error contract inside the callback:

```js
const validate = async (value) => {
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
};
```

Return the parsed value only after the applicable callback succeeds. Preserve the current mutability contract; do not cache parsed objects or failed raw bytes.

- [ ] **Step 7: Run the full loader suite**

Run: `node --test tests/data-loader.test.mjs`

Expected: PASS, including the complete retry and abort matrix.

- [ ] **Step 8: Rebuild v1 and commit**

```bash
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse backup/upstream-main-20260717)"
test -z "$(git ls-tree -r --name-only origin/main -- synthesis/releases/v1)"
git rm -r synthesis/releases/v1
node scripts/build-synthesis-runtime.mjs --release v1 --write
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v1 --check-source
node --test tests/runtime-release.test.mjs tests/data-loader.test.mjs
git add synthesis/data-loader.js synthesis/releases/v1 tests/data-loader.test.mjs
git commit -m "perf: cache verified synthesis artifacts"
```

### Task 6: Overlap manifest and core acquisition with an opaque handle

**Files:**
- Modify: `synthesis/data-loader.js`
- Modify: `synthesis/app.js`
- Modify: `scripts/build-synthesis-runtime.mjs`
- Modify: `tests/data-loader.test.mjs`
- Modify: `tests/runtime-release.test.mjs`
- Modify: `tests/browser/synthesis.spec.mjs`
- Regenerate: `synthesis/releases/v1/app.js`
- Regenerate: `synthesis/releases/v1/data-loader.js`
- Regenerate: `synthesis/releases/v1/release-lock.json`

**Interfaces:**
- Consumes: `initialCandidate({ requestUrl, signal, fetchImpl, cacheStorage, cacheMode }): Promise<Candidate>` and `loadVerifiedArtifact({ descriptor, key, requestUrl, signal, fetchImpl, cacheStorage, cacheMode, validate }): Promise<unknown>`.
- Produces: `startArtifactRequest(url, options = {}): Readonly<object>`, a frozen opaque single-use handle whose private candidate owns its exact URL, signal, fetch adapter, cache adapter, and `"default" | "reload"` network policy.
- Produces: `loadArtifact(..., { requestHandle, signal })` consumption with `request-handle`/`request-binding` failures, plus builder gate `assertAppBinding(runtimeBytes, { releaseId, manifestPath, corePath })`.

- [ ] **Step 1: Specify the request-handle API in loader tests**

Import `startArtifactRequest`, then add tests for all handle invariants:

```js
test("startArtifactRequest returns a frozen opaque handle and starts immediately", async () => {
  const started = deferred();
  const allowResponse = deferred();
  const handle = startArtifactRequest(CORE_PATH, {
    baseUrl: BASE_URL,
    cacheStorage: null,
    fetchImpl: async (_url, init) => {
      assert.equal(init.cache, "default");
      started.resolve();
      await allowResponse.promise;
      return new Response(CORE_BYTES);
    },
  });
  assert.equal(Object.isFrozen(handle), true);
  assert.deepEqual(Object.keys(handle), []);
  await started.promise;
  allowResponse.resolve();
  assert.deepEqual(await loadArtifact(manifestWithBytes(), "core", {
    baseUrl: BASE_URL,
    requestHandle: handle,
  }), coreFixture);
});
```

Add separate tests that assert:

- a non-handle and a consumed handle reject with `request-handle`;
- a handle started for another valid immutable artifact rejects with `request-binding`;
- query strings, fragments, credentials, cross-origin URLs, traversal, escaped separators, and mutable filenames reject with `request-binding` before fetch;
- a handle that is never consumed may reject internally without an `unhandledRejection`;
- after a rejected handle is consumed once, the same handle rejects as `request-handle` and never restarts its byte request;
- aborting its signal stops an unconsumed request;
- aborting after its candidate settles but before consumption still exposes no value;
- a content-invalid handle candidate uses the handle's original `signal` and `fetchImpl` for its one forced reload;
- passing a different signal, a second fetch/cache adapter, or a second `cacheMode` with a handle rejects with `request-binding`;
- a cache-hit handle performs no network request and a network-backed handle still waits for its verified cache put when consumed.

Add `"request handle explicit retry owns reload mode"`. Start and consume one default-mode handle whose only response is HTTP 503; assert one mode, `["default"]`, and error `http`. Start a new handle with the same URL/adapters and `cacheMode: "reload"`, return `CORE_BYTES`, consume it successfully, and assert the combined modes are exactly `["default", "reload"]`. With both `cacheStorage` and `fetchImpl` instrumented, also assert an unsupported `cacheMode: "no-store"` fails with `cache-mode` before either adapter is called.

- [ ] **Step 2: Run the handle tests and verify failure**

Run: `node --test --test-name-pattern="request|handle" tests/data-loader.test.mjs`

Expected: FAIL because `startArtifactRequest` is not exported.

- [ ] **Step 3: Implement strict standalone artifact URL validation**

Extract the raw path checks currently in `validateDescriptor` into a shared helper. The descriptor path keeps code `descriptor`; speculative paths use code `request-binding`. For the speculative form, accept only a relative path that resolves to same-origin HTTP(S), ends in `synthesis/data/<immutable filename>`, and has a filename matching one of `ARTIFACT_FILENAMES`.

```js
function resolveArtifactUrl(rawPath, siteUrl, { code, key = null }) {
  if (!isNonEmptyString(rawPath)) {
    throw new ArtifactLoadError(code, "Snapshot artifact path is invalid.");
  }
  const lowerPath = rawPath.toLowerCase();
  if (rawPath !== rawPath.trim()
      || rawPath.includes("?")
      || rawPath.includes("#")
      || rawPath.includes("\\")
      || rawPath.startsWith("/")
      || /^[a-z][a-z\d+.-]*:/i.test(rawPath)
      || lowerPath.includes("%2e")
      || lowerPath.includes("%2f")
      || lowerPath.includes("%5c")
      || rawPath.split("/").some((part) => part === "." || part === "..")) {
    throw new ArtifactLoadError(code, "Snapshot artifact path is invalid.");
  }
  const rawMatch = rawPath.match(/(?:^|\/)synthesis\/data\/([^/]+)$/);
  const immutable = key === null
    ? Object.keys(ARTIFACT_FILENAMES).some((name) => immutableFilename(name, rawMatch?.[1]))
    : immutableFilename(key, rawMatch?.[1]);
  if (!rawMatch || !immutable) {
    throw new ArtifactLoadError(code, "Snapshot artifact path is not immutable.");
  }
  const base = resolveUrl(siteUrl, undefined, code);
  const resolved = resolveUrl(rawPath, base, code);
  if (resolved.origin !== base.origin
      || !["http:", "https:"].includes(base.protocol)
      || resolved.protocol !== base.protocol
      || resolved.username !== ""
      || resolved.password !== ""
      || resolved.search !== ""
      || resolved.hash !== "") {
    throw new ArtifactLoadError(code, "Snapshot artifact path is invalid.");
  }
  return resolved;
}
```

`validateDescriptor` calls this helper with its descriptor key and code `descriptor`; `startArtifactRequest` calls it with `key: null` and code `request-binding`.

- [ ] **Step 4: Implement the opaque, single-use handle**

Keep all state in a module-private WeakMap. Attach both fulfillment and rejection handlers at creation time so an abandoned request cannot produce an unhandled rejection.

```js
const artifactRequestHandles = new WeakMap();

export function startArtifactRequest(url, options = {}) {
  const base = options.baseUrl ?? runtimeBaseUrl();
  if (base === undefined) {
    throw new ArtifactLoadError("request-binding", "Snapshot base URL is unavailable.");
  }
  const requestUrl = resolveArtifactUrl(url, base, {
    code: "request-binding",
    key: null,
  });
  const cacheMode = cacheModeFrom(options);
  const cacheStorage = hasOwn(options, "cacheStorage")
    ? options.cacheStorage
    : globalThis.caches;
  const pending = initialCandidate({
    requestUrl,
    signal: options.signal,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    cacheStorage,
    cacheMode,
  }).then(
    (candidate) => ({ ok: true, candidate }),
    (error) => ({ ok: false, error }),
  );
  const handle = Object.freeze({});
  artifactRequestHandles.set(handle, {
    requestUrl: requestUrl.href,
    pending,
    consumed: false,
    signal: options.signal,
  });
  return handle;
}

async function consumeArtifactRequest(handle, requestUrl, signal) {
  const state = artifactRequestHandles.get(handle);
  if (!state || state.consumed) {
    throw new ArtifactLoadError("request-handle", "Artifact request handle is invalid.");
  }
  state.consumed = true;
  if (state.requestUrl !== requestUrl.href) {
    throw new ArtifactLoadError("request-binding", "Artifact request does not match its descriptor.");
  }
  if (signal !== undefined && signal !== state.signal) {
    throw new ArtifactLoadError("request-binding", "Artifact request signal does not match.");
  }
  const result = await state.pending;
  if (!result.ok) throw result.error;
  throwIfAborted(result.candidate.signal);
  return result.candidate;
}
```

Use the existing private `initialCandidate({ requestUrl, signal, fetchImpl, cacheStorage, cacheMode }): Promise<Candidate>`. Add `requestHandle` to `loadVerifiedArtifact` and select the candidate exactly once:

```js
let candidate = requestHandle === undefined
  ? await initialCandidate({ requestUrl, signal, fetchImpl, cacheStorage, cacheMode })
  : await consumeArtifactRequest(requestHandle, requestUrl, signal);
throwIfAborted(candidate.signal);
```

When a public loader receives `requestHandle`, reject explicit `fetchImpl`, `cacheStorage`, or `cacheMode` options with `request-binding`; the handle owns those dependencies. Without a handle, use `cacheModeFrom(options)` and pass that mode to `initialCandidate`. Pass `options.requestHandle` into the shared state machine. Its candidate carries the original signal/fetch adapter through validation, delete, forced reload, and commit. The one-time recovery path remains otherwise unchanged.

- [ ] **Step 5: Run the handle tests and verify the first microcycle is green**

Run: `node --test --test-name-pattern="request|handle" tests/data-loader.test.mjs`

Expected: PASS, including URL binding, one-time consumption, abort, cache ownership, and explicit default/reload mode ownership.

- [ ] **Step 6: Add release-builder binding failures**

First make every passing runtime fixture structurally valid:

```js
const loaderImport =
  'import { loadManifest, startArtifactRequest } from "./data-loader.js";';
const coreBinding = (corePath = "synthesis/data/graph-core.v1.json") =>
  `const coreRequest = startArtifactRequest("${corePath}", { signal: undefined });`;
const releaseBinding = (releaseId = "v1", extraOptions = "") =>
  `loadManifest("synthesis/data/manifest.${releaseId}.json", {${extraOptions} expectedReleaseId: "${releaseId}" });`;
const validApp = (...lines) => [
  loaderImport,
  ...lines,
  coreBinding(),
  releaseBinding(),
  "",
].join("\n");
```

Have `makeFixture()` write `synthesis/data-loader.js` containing `export async function loadManifest() {}` and `export function startArtifactRequest() {}`. Add it as target `data-loader.js` and include it in expected runtime-lock path arrays. Update every passing custom file list and v2 fixture to include that target; tests intentionally exercising a missing dependency may omit it. Parameterize the v2 helper's core binding from the fixture manifest so both a v2 core filename and v1-core reuse can be tested.

Extend `tests/runtime-release.test.mjs` with cases for:

- missing, duplicate, aliased, member, computed, dynamic-path, or wrong-path `startArtifactRequest`;
- a correct core request placed after `loadManifest`;
- missing named imports for either loader function;
- v2 binding to `graph-core.v2.json` even though its validated manifest reuses `graph-core.v1.json`.

Each fixture runs `--write`, expects a binding failure, and calls `assertNoReleaseWork(root)`. Add one positive v2 fixture proving that manifest v2 plus core v1 passes.
For every negative case, keep the other loader import/call structurally valid so the assertion reaches the intended failure rather than an earlier missing-binding error.

- [ ] **Step 7: Run the builder binding tests and verify failure**

Run: `node --test --test-name-pattern="binding|startArtifactRequest|core path" tests/runtime-release.test.mjs`

Expected: FAIL because the builder recognizes only the old manifest binding and does not derive or enforce the validated core path.

- [ ] **Step 8: Strengthen the builder with validated data inputs**

Generalize `isStaticLoadManifestImport` to `isStaticNamedImport(tokens, index, name)`. Change the gate signature to `assertAppBinding(runtimeBytes, { releaseId, manifestPath, corePath })`.

The complete implementation must enforce:

1. exactly one direct `loadManifest(manifestPath, options)` call;
2. exactly one direct `startArtifactRequest(corePath, options)` call;
3. both identifiers are named imports from `./data-loader.js` and have no other references;
4. both first arguments are unescaped string literals matching the validated paths;
5. the start call appears before the manifest call;
6. manifest options contain exactly one literal `expectedReleaseId: releaseId`, preserving the current spread/computed/getter/method fail-closed checks.

In both `checkRelease()` and `writeRelease()`, validate data first and derive the core path by name:

```js
const data = validateData(repoRoot, releaseId);
const corePath = data.artifacts.find(({ name }) => name === "core")?.path;
if (!corePath) fail(`release ${releaseId} has no validated core artifact`);
assertAppBinding(runtimeBytes, {
  releaseId,
  manifestPath: data.manifest.path,
  corePath,
});
```

This deliberately derives v2's core literal from data, not from the release number.

- [ ] **Step 9: Run the builder binding tests and verify the second microcycle is green**

Run: `node --test --test-name-pattern="binding|startArtifactRequest|core path" tests/runtime-release.test.mjs`

Expected: PASS for all synthetic fixtures; the real repository release remains untouched until Step 14.

- [ ] **Step 10: Add the browser waterfall and Retry regressions**

Add this helper beside `sha256`:

```js
function deferredPromise() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
```

Add a test before the exact fetch-graph case. Block the manifest route, navigate without `openStudio()`, and prove the core request starts while the manifest is unresolved:

```js
test("core acquisition starts before the manifest response completes", async ({ page }) => {
  const manifestSeen = deferredPromise();
  const releaseManifest = deferredPromise();
  await page.route(MANIFEST_ROUTE, async (route) => {
    manifestSeen.resolve();
    await releaseManifest.promise;
    await route.continue();
  });
  const coreRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === CORE_PATH);
  const navigation = page.goto(`${STUDIO_ORIGIN}/synthesis.html`);
  await manifestSeen.promise;
  await coreRequest;
  releaseManifest.resolve();
  await navigation;
  await expect.poll(() => page.evaluate(() => window.__synState.store?.nodeCount ?? 0))
    .toBeGreaterThan(0);
});
```

The test must fail by timeout against the serial implementation. Keep it release-neutral by using `MANIFEST_ROUTE`: PR 14 defines the v1 route and PR 15 updates the same constant to v2 while both retain the v1 core path.

Strengthen the existing `"Retry recovers an artifact failure without refetching the pinned manifest"` test with fetch-mode instrumentation installed before navigation:

```js
await page.addInitScript(() => {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.__synCoreFetchModes = [];
  globalThis.fetch = (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    if (new URL(rawUrl, location.href).pathname
        === "/synthesis/data/graph-core.v1.json") {
      globalThis.__synCoreFetchModes.push(init.cache ?? null);
    }
    return nativeFetch(input, init);
  };
});
```

Keep the first core response at HTTP 503 and the second valid. After clicking Retry and reaching the graph, assert the manifest request count remains one, core request count is two, and `page.evaluate(() => globalThis.__synCoreFetchModes)` equals `["default", "reload"]`.

- [ ] **Step 11: Run the browser regressions and verify failure**

Run: `npm --prefix tests/browser test -- --project=chromium-desktop --grep "core acquisition|Retry recovers an artifact failure"`

Expected: FAIL because the serial app does not start core before manifest and its explicit Retry still starts core with `default`.

- [ ] **Step 12: Wire the v1 app attempt lifecycle**

Update the import to include `startArtifactRequest`. Add `let reloadManifest = false;` and `let reloadCore = false;` beside `pinnedManifest`. Inside every attempt, use a local controller; then, as the first statement inside the existing `try`, start the literal core request before awaiting the manifest:

```js
const attemptController = new AbortController();
controller = attemptController;
const { signal } = attemptController;
const coreRequest = startArtifactRequest("synthesis/data/graph-core.v1.json", {
  baseUrl: document.baseURI,
  cacheMode: reloadCore ? "reload" : "default",
  signal,
});
```

Change the manifest call options to include:

```js
cacheMode: reloadManifest ? "reload" : "default",
```

After a manifest succeeds and the stale-attempt guard passes, assign `pinnedManifest` and set `reloadManifest = false`. Pass `requestHandle: coreRequest` to `loadArtifact`. After core validation and its stale-attempt guard, set `reloadCore = false`. Use this catch ordering: abort `attemptController`; return for a stale attempt or `AbortError`; set `reloadCore = true`; set `reloadManifest = true` only when `pinnedManifest` is still null; then show the existing retry UI. Thus only the next explicit page Retry bypasses an HTTP-cached core failure. Leave graph-store creation, URL restoration, renderer scheduling, and pagehide cleanup unchanged.

- [ ] **Step 13: Run focused source tests and verify the third microcycle is green**

```bash
node --test tests/data-loader.test.mjs
node --test --test-name-pattern="binding|startArtifactRequest|core path" tests/runtime-release.test.mjs
npm --prefix tests/browser test -- --project=chromium-desktop --grep "core acquisition|browser fetch graph|Retry recovers an artifact failure"
```

Expected: all focused source, fixture, and browser tests PASS; the real v1 generated bytes are refreshed next.

- [ ] **Step 14: Rebuild v1, verify, and commit**

```bash
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse backup/upstream-main-20260717)"
test -z "$(git ls-tree -r --name-only origin/main -- synthesis/releases/v1)"
git rm -r synthesis/releases/v1
node scripts/build-synthesis-runtime.mjs --release v1 --write
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v1 --check-source
node --test tests/runtime-release.test.mjs tests/data-loader.test.mjs
npm --prefix tests/browser test -- --project=chromium-desktop --grep "core acquisition|browser fetch graph|Retry recovers an artifact failure"
git add scripts/build-synthesis-runtime.mjs synthesis/app.js synthesis/data-loader.js synthesis/releases/v1 tests/data-loader.test.mjs tests/runtime-release.test.mjs tests/browser/synthesis.spec.mjs
git commit -m "perf: overlap synthesis manifest and core loading"
```

### Task 7: Add a repeatable browser benchmark

**Files:**
- Create: `tests/browser/benchmark.mjs`
- Modify: `tests/browser/package.json`

**Interfaces:**
- Consumes: the built v1/v2 static site, Playwright's installed Chromium, and the same request boundaries asserted by browser tests.
- Produces: `npm --prefix tests/browser run benchmark`, configurable only through `BENCH_RUNS` (`1..50`, default `5`), printing one JSON sample per run plus median load/Generate timings and core/pack request counts.

- [ ] **Step 1: Add the benchmark script entry**

Add one script and no dependency:

```json
{
  "scripts": {
    "test": "playwright test",
    "benchmark": "node benchmark.mjs"
  }
}
```

- [ ] **Step 2: Build a Pages-like local server**

In `benchmark.mjs`, import `chromium` from `@playwright/test` and Node's `http`, `fs/promises`, `path`, `url`, `zlib`, and `perf_hooks` modules. Resolve the repository root with:

```js
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const runCount = Number.parseInt(process.env.BENCH_RUNS ?? "5", 10);
if (!Number.isSafeInteger(runCount) || runCount < 1 || runCount > 50) {
  throw new Error("BENCH_RUNS must be an integer from 1 through 50");
}
```

Serve `/` as `/synthesis.html`. Decode the pathname once, resolve it under `repoRoot`, reject paths outside that root with 403, and return 404 for missing/non-file paths. Use this exact content-type map:

```js
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);
```

For HTML, send `Cache-Control: no-cache`. For every other file, send `Cache-Control: public, max-age=600`. If the request accepts gzip and the file is HTML, CSS, JavaScript, or JSON, send `gzipSync(bytes, { level: 9 })` with `Content-Encoding: gzip` and `Vary: Accept-Encoding`. Listen on `127.0.0.1` with port `0` and derive the assigned port from `server.address()`.

- [ ] **Step 3: Apply a deterministic Chromium profile**

For each sample create a fresh browser context at 1280 by 900, install the two font routes below, then create a page and CDP session. Apply:

```js
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
  connectionType: "cellular4g",
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

Make the benchmark independent of live font services:

```js
await context.route("https://fonts.googleapis.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "text/css", body: "" }));
await context.route("https://fonts.gstatic.com/**", (route) => route.abort());
```

Record request pathnames from the BrowserContext's `request` event so Worker requests are included. Measure from immediately before navigation/reload until:

```js
await page.waitForFunction(() => (window.__synState?.store?.nodeCount ?? 0) > 0);
```

The cold navigation uses a new context; the warm reload uses the same page and context. Use `performance.now()` around each measured operation.

- [ ] **Step 4: Measure the optional Phase 2 Generate boundary**

After each ready state, look for `page.getByRole("button", { name: "Generate personas" })`. If present, click it and stop timing when:

```js
await page.waitForFunction(() =>
  window.__synState?.generating === false && window.__synState?.results?.n > 0);
```

Measure cold Generate before the warm reload and warm Generate after it. For each sample return:

```js
{
  coldLoadMs,
  warmLoadMs,
  coldGenerateMs,
  warmGenerateMs,
  coreRequests,
  packRequests,
}
```

Use `null` for the two Generate timings on v1. Count exact paths `/synthesis/data/graph-core.v1.json` and `/synthesis/data/sampler-pack.v2.json`. Close each context after its sample; close the browser and server in `finally` blocks.

- [ ] **Step 5: Print medians and validate invariants**

Sort a copied numeric array and use the middle value, or the mean of the two middle values, as its median. Leave Generate medians null when every sample is v1/null. Print one JSON document containing the throttle profile, raw samples, and medians. Exit nonzero if a non-null timing is non-finite/non-positive or if `coreRequests > 1` or `packRequests > 1` in any sample. Do not add a timing threshold because shared runners are noisy.

- [ ] **Step 6: Smoke-test and commit the harness**

```bash
BENCH_RUNS=1 npm --prefix tests/browser run benchmark
git add tests/browser/benchmark.mjs tests/browser/package.json
git commit -m "test: add synthesis loading benchmark"
```

Expected: one JSON sample; v1 has finite load timings, null Generate timings, one core request, and zero pack requests.

### Task 8: Verify and update the existing PR 14 branch

**Files:**
- Verify: all PR 14 source, generated runtime, data, and test files
- Update remote: `fork/feature/synthesis-studio-phase1`

**Interfaces:**
- Consumes: the complete PR 14 task range, pinned Phase 1 generator/golden toolchain, `backup/upstream-main-20260717`, and the recorded remote lease.
- Produces: clean immutable ref `freeze/pr14-final-20260717` and the same commit on `fork/feature/synthesis-studio-phase1`, pushed only with the recorded exact lease.

- [ ] **Step 1: Run all source, release, and browser checks**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
node --test tests/*.test.mjs
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v1 --check-source
npm --prefix tests/browser test
BENCH_RUNS=5 npm --prefix tests/browser run benchmark
```

Expected: every test passes on Chromium and WebKit desktop/mobile; the benchmark prints five samples with at most one core request per cold/warm pair.

- [ ] **Step 2: Reproduce Phase 1 data with its pinned toolchain**

```bash
set -euo pipefail
P14=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
cd "$P14"
PYTHON_P2=/data2/zonglin/MatrAIx/.venv/bin/python
"$PYTHON_P2" -c 'import platform,numpy; assert platform.python_version()=="3.12.3"; assert numpy.__version__=="2.5.1"'
MATRAIX_TMP=$(mktemp -d)
git clone --filter=blob:none --no-checkout https://github.com/MatrAIx-ai/MatrAIx.git "$MATRAIX_TMP"
git -C "$MATRAIX_TMP" checkout --detach 4dfa4e066b706c6a2d33a10fd41b976efd3f524e
V1_GENERATOR=$(node -e "const m=require('./synthesis/data/manifest.v1.json');process.stdout.write(m.generator.path)")
V1_GENERATOR_SHA256=$(node -e "const m=require('./synthesis/data/manifest.v1.json');process.stdout.write(m.generator.sha256)")
printf '%s  %s\n' "$V1_GENERATOR_SHA256" "$V1_GENERATOR" | sha256sum -c -
npx --yes node@18.19.1 "$V1_GENERATOR" --graph "$MATRAIX_TMP/persona/synthesis/graph/full_dag.json" --source-commit 4dfa4e066b706c6a2d33a10fd41b976efd3f524e --out-dir synthesis/data --phase 1
"$PYTHON_P2" scripts/generate-synthesis-goldens-p1.py --matraix-root "$MATRAIX_TMP"
git diff --exit-code -- synthesis/data tests/fixtures
rm -rf "$MATRAIX_TMP"
```

Expected: the pinned generator runs under exactly Node 18.19.1 and produces no diff.

- [ ] **Step 3: Audit the final local change set**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
git diff --check
git status --short --branch
test -z "$(git status --porcelain)"
git branch freeze/pr14-final-20260717 HEAD
OLD_BASE=$(git merge-base backup/pr14-remote-20260717 backup/upstream-main-20260717)
git range-diff "$OLD_BASE..backup/pr14-local-20260717" "backup/upstream-main-20260717..freeze/pr14-final-20260717"
```

Expected: status is clean; the range contains only the approved docs, path repair, preload, loader/cache/waterfall work, benchmark, generated v1 bytes, and their tests.

- [ ] **Step 4: Recheck both remote leases**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
git fetch origin
git fetch fork
test "$(git rev-parse origin/main)" = "$(git rev-parse backup/upstream-main-20260717)"
EXPECTED_PR14=$(git rev-parse backup/pr14-remote-20260717)
test "$(git rev-parse fork/feature/synthesis-studio-phase1)" = "$EXPECTED_PR14"
test "$(git ls-remote fork refs/heads/feature/synthesis-studio-phase1 | awk '{print $1}')" = "$EXPECTED_PR14"
```

Expected: all comparisons succeed. If upstream main or the fork head moved, do not push; preserve the new remote head under another backup ref and repeat the rebase, release rebuild, full verification, freeze, and range-diff steps.

- [ ] **Step 5: Push the existing PR 14 branch with an exact lease**

```bash
P14=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1-design
EXPECTED_PR14=$(git -C "$P14" rev-parse backup/pr14-remote-20260717)
test "$(git -C "$P14" rev-parse HEAD)" = "$(git -C "$P14" rev-parse freeze/pr14-final-20260717)"
git -C "$P14" push --force-with-lease=refs/heads/feature/synthesis-studio-phase1:"$EXPECTED_PR14" fork HEAD:refs/heads/feature/synthesis-studio-phase1
test "$(git -C "$P14" ls-remote fork refs/heads/feature/synthesis-studio-phase1 | awk '{print $1}')" = "$(git -C "$P14" rev-parse freeze/pr14-final-20260717)"
```

Expected: the existing PR 14 URL now points to the frozen, fully tested head.

### Task 9: Restack PR 15 onto the frozen PR 14 head

**Files:**
- Rewrite only: `feature/synthesis-studio-phase2` commit ancestry
- Verify: v1 runtime and v1-bound data paths

**Interfaces:**
- Consumes: `freeze/pr14-final-20260717`, `backup/pr14-remote-20260717`, `backup/pr15-remote-20260717`, and the untouched Phase 2 commit range.
- Produces: local `feature/synthesis-studio-phase2` with only Phase 2 commits above the frozen PR 14 head and byte-identical v1 release/data boundary paths.

- [ ] **Step 1: Confirm the PR 15 lease and clean worktree**

```bash
set -euo pipefail
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
test -z "$(git -C "$P15" status --porcelain)"
git -C "$REPO" fetch fork
EXPECTED_PR15=$(git -C "$REPO" rev-parse backup/pr15-remote-20260717)
test "$(git -C "$REPO" rev-parse fork/feature/synthesis-studio-phase2)" = "$EXPECTED_PR15"
test "$(git -C "$REPO" rev-parse freeze/pr14-final-20260717)" = "$(git -C "$REPO" rev-parse fork/feature/synthesis-studio-phase1)"
```

Expected: PR 15 is still at its recorded head and PR 14's remote matches the tested freeze.

- [ ] **Step 2: Rebase only the original Phase 2 range**

```bash
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git -C "$P15" rebase --onto freeze/pr14-final-20260717 backup/pr14-remote-20260717 feature/synthesis-studio-phase2
```

During conflict resolution preserve all of these invariants:

- v1 release bytes and lock are exactly `freeze/pr14-final-20260717`;
- shared path fixes, cache state machine, builder gate, tests, and benchmark come from final PR 14;
- Phase 2 panels, sampler, Worker, dimensions, v2 manifest, and v2 release remain present;
- `synthesis.html` uses current `Assets/icons`, `css`, and `js` site paths while retaining the v2 release entry;
- v2 binds `manifest.v2.json` but reuses `graph-core.v1.json`.

Resolve files one at a time, stage explicit paths, and continue with `git -C "$P15" rebase --continue`. Do not regenerate either release during conflict resolution.

- [ ] **Step 3: Audit the rewritten Phase 2 commits**

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git -C "$REPO" range-diff backup/pr14-remote-20260717..backup/pr15-remote-20260717 freeze/pr14-final-20260717..feature/synthesis-studio-phase2
git -C "$P15" diff --check
git -C "$P15" status --short --branch
```

Expected: the original Phase 2 commits are recognizable, with only current-main conflict resolutions and inherited PR 14 changes.

- [ ] **Step 4: Prove the inherited v1 boundary is byte-identical**

Read the bound data paths from the frozen lock instead of hard-coding a generator digest:

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
mapfile -t V1_BOUND_PATHS < <(
  git -C "$REPO" show   freeze/pr14-final-20260717:synthesis/releases/v1/release-lock.json |
  node -e '
    let source = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { source += chunk; });
    process.stdin.on("end", () => {
      const data = JSON.parse(source).data;
      const paths = [
        data.manifest.path,
        ...data.artifacts.map(({ path }) => path),
        data.generator.path,
      ];
      process.stdout.write(paths.join("\n") + "\n");
    });
  '
)
git -C "$P15" diff --exit-code freeze/pr14-final-20260717 -- synthesis/releases/v1 "${V1_BOUND_PATHS[@]}"
(cd "$P15" && node scripts/build-synthesis-runtime.mjs --release v1 --check)
```

Expected: zero diff and v1 check PASS. Do not run v1 `--check-source` on PR 15.

### Task 10: Repair Phase 2 dimensions paths after the main rebase

**Files:**
- Modify: `.github/workflows/synthesis-studio.yml`
- Modify: `README.md`
- Modify: `synthesis/README.md`
- Modify: `scripts/generate-synthesis-goldens-p2.py`
- Modify: `tests/build-sampler-pack.test.mjs`
- Modify: `tests/dimensions-schema.test.mjs`
- Modify: `tests/render-persona.test.mjs`

**Interfaces:**
- Consumes: upstream's canonical dimensions source `data/dimensions.json` and every Phase 2 workflow, script, test, and README reference that still names root `dimensions.json`.
- Produces: all repository-owned Phase 2 dimensions reads bound to `data/dimensions.json`; temporary test fixtures may retain intentional local `dimensions.json` names.

- [ ] **Step 1: Capture the relocated-source failures**

Run:

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
node --test tests/build-sampler-pack.test.mjs tests/dimensions-schema.test.mjs tests/render-persona.test.mjs
```

Expected: FAIL because current main moved the synchronized schema to `data/dimensions.json` while Phase 2 still reads the removed root path.

- [ ] **Step 2: Update the test contract first**

Make these exact changes:

- in `tests/build-sampler-pack.test.mjs`, expect workflow text `--dimensions data/dimensions.json` and read repository bytes from `new URL("../data/dimensions.json", import.meta.url)`;
- in `tests/dimensions-schema.test.mjs` and `tests/render-persona.test.mjs`, read `../data/dimensions.json`;
- leave the temporary fixture path `join(root, "dimensions.json")` unchanged because that test owns an isolated synthetic root;
- leave content-addressed `synthesis/data/dimensions.<sha>.json` fixtures and manifest descriptors unchanged.

Run the same three-test command.

Expected: repository-path tests still FAIL until the workflow and golden generator are updated; isolated fixture tests continue to pass.

- [ ] **Step 3: Update production, reproducibility, and documentation paths**

Change:

- workflow Phase 2 generator argument to `--dimensions data/dimensions.json`;
- both `WEBSITE_ROOT / "dimensions.json"` expressions in `generate-synthesis-goldens-p2.py` to `WEBSITE_ROOT / "data" / "dimensions.json"`;
- Phase 2 build commands in both READMEs to `--dimensions data/dimensions.json`;
- any Phase 2 prose link added by the branch to `[dimensions.json](data/dimensions.json)`, while preserving current main's `[dimensions.js](js/dimensions.js)` link and file-tree entries.

- [ ] **Step 4: Verify and commit the path repair**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
node --test tests/build-sampler-pack.test.mjs tests/dimensions-schema.test.mjs tests/render-persona.test.mjs
git diff --check
git add .github/workflows/synthesis-studio.yml README.md synthesis/README.md scripts/generate-synthesis-goldens-p2.py tests/build-sampler-pack.test.mjs tests/dimensions-schema.test.mjs tests/render-persona.test.mjs
git commit -m "fix: use relocated dimensions source"
```

Expected: focused tests PASS and the root `dimensions.json` path no longer appears outside the intentional temporary fixture.

### Task 11: Apply the verified loading path to v2

**Files:**
- Modify: `synthesis.html`
- Modify: `synthesis/app.js`
- Modify: `tests/runtime-release.test.mjs`
- Modify: `tests/browser/synthesis.spec.mjs`
- Regenerate: `synthesis/releases/v2/**`
- Verify only: `synthesis/releases/v1/**`

**Interfaces:**
- Consumes: inherited `startArtifactRequest`, `loadManifest`, `loadArtifact`, `reloadManifest`/`reloadCore` page-attempt policy, verified Cache Storage namespace, and builder binding from frozen PR 14; Phase 2's renderer, sampler client, and Worker lifecycle remain intact.
- Produces: v2 app binding `manifest.v2.json` plus shared `graph-core.v1.json`, the exact 17-module eager preload closure, and a regenerated v2 release; `sampler-worker.js` remains lazy and v1 bytes remain unchanged.

- [ ] **Step 1: Add the exact v2 preload expectation**

In the real-repository runtime test, expect this sorted eager closure:

```js
const V2_EAGER_MODULES = [
  "adjust-panel.js",
  "app.js",
  "data-loader.js",
  "detail-rail.js",
  "dimensions-schema.js",
  "dist-utils.js",
  "drilldown-graph.js",
  "graph-store.js",
  "graph-views.js",
  "overview-graph.js",
  "render-persona.js",
  "request-schema.js",
  "results-panel.js",
  "rng.js",
  "sampler-client.js",
  "sampler.js",
  "url-state.js",
];
```

Call `assertHtmlModulePreloads(REPOSITORY_ROOT, html, "v2")` and compare its result with `V2_EAGER_MODULES`. Assert that `sampler-worker.js` is absent because its Worker boundary is lazy.

- [ ] **Step 2: Add a v2 real-app binding test**

Run the builder against the repository and assert that `--release v2 --check-source` accepts:

- a direct `loadManifest` call whose first argument is the literal
  `synthesis/data/manifest.v2.json`;
- a direct `startArtifactRequest` call whose first argument is the literal
  `synthesis/data/graph-core.v1.json`.

Add a mutated fixture replacing only the core literal with `graph-core.v2.json` and expect the structural binding gate to fail before a release directory is written.

- [ ] **Step 3: Add cross-navigation Window/Worker reuse coverage**

Add a Chromium test named `"verified core and pack bytes survive a Window and Worker restart"`:

1. navigate to `/` to establish the origin;
2. open `matraix-synthesis-verified-artifacts-v1` and put corrupt responses under the exact core and pack URLs;
3. begin request counting at the BrowserContext level so dedicated-Worker requests are included;
4. open Studio, wait for the graph, click `Generate personas`, and wait for results;
5. reload the page in the same context, wait for the graph, Generate again, and wait for results;
6. at first graph ready assert counts core=1/pack=0, after first Generate core=1/pack=1, and after the second cycle core=1/pack=1;
7. snapshot the existing per-document native Worker probe before reload, assert one creation, then assert the newly initialized probe also records one creation after reload;
8. assert both generations expose valid results.

The corrupt seed proves cache hits are revalidated and replaced; the second cycle proves the awaited successful puts are reusable.

- [ ] **Step 4: Add corrupt-delete and forced-reload browser recovery**

Add `"corrupt cache recovery survives delete failure"`. Seed a corrupt core, install an init script whose `Cache.prototype.delete` rejects only for the core URL, and assert one forced core request produces a verified graph. Reload in the same context and assert no second core request because the successful put replaced the bad entry even though deletion failed.

For `"a failed forced core reload reaches Retry and then recovers"`, install this probe before navigation:

```js
await page.addInitScript(() => {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.__synCoreFetchModes = [];
  globalThis.fetch = (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    if (new URL(rawUrl, location.href).pathname
        === "/synthesis/data/graph-core.v1.json") {
      globalThis.__synCoreFetchModes.push(init.cache ?? null);
    }
    return nativeFetch(input, init);
  };
});
```

Seed a corrupt core; fulfill the first network core request with invalid bytes and the second with the repository response. Assert the first attempt shows `#synRetry` and no graph, click Retry, then assert the graph loads, exactly two network core requests occurred, `page.evaluate(() => globalThis.__synCoreFetchModes)` is `["reload", "reload"]`, and no third request was made.

- [ ] **Step 5: Add browser degradation coverage**

Add `"cache storage unavailable degrades to verified network loading"` and `"cache storage put rejection degrades to verified network loading"` in separate fresh contexts. In the first, install an init script that exposes `globalThis.caches` as undefined; in the second, make `Cache.prototype.put` reject. For each case, load and reload Studio, assert both graphs are fully verified, and assert duplicate core transfer is allowed. Do not apply the zero-repeat assertion when no successful cache commit was possible.

- [ ] **Step 6: Run the new tests and verify failure**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
npm --prefix tests/browser ci
npx --prefix tests/browser playwright install chromium webkit
node --test --test-name-pattern="v2|preload|binding" tests/runtime-release.test.mjs
npm --prefix tests/browser test -- --project=chromium-desktop --grep "verified core and pack bytes survive|corrupt cache|forced core reload|cache storage"
```

Expected: FAIL because v2 has no preload block, still uses the serial app path, and its generated runtime predates the shared loader.

- [ ] **Step 7: Add the exact v2 module-preload block**

Replace the inherited nine-link v1 preload block; do not leave any v1 preload in the v2 HTML. Immediately after `synthesis/releases/v2/synthesis.css`, add one query-free `modulepreload` link for each entry below:

```html
  <link rel="modulepreload" href="synthesis/releases/v2/adjust-panel.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/app.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/data-loader.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/detail-rail.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/dimensions-schema.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/dist-utils.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/drilldown-graph.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/graph-store.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/graph-views.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/overview-graph.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/render-persona.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/request-schema.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/results-panel.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/rng.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/sampler-client.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/sampler.js" />
  <link rel="modulepreload" href="synthesis/releases/v2/url-state.js" />
```

- [ ] **Step 8: Merge the v1 attempt lifecycle into the Phase 2 app**

Keep every Phase 2 renderer, recipe, sampler-client, and Worker lifecycle. Use this complete attempt shape with the v2 literals:

```js
const coreRequest = startArtifactRequest("synthesis/data/graph-core.v1.json", {
  baseUrl: document.baseURI,
  cacheMode: reloadCore ? "reload" : "default",
  signal,
});

manifest = await loadManifest("synthesis/data/manifest.v2.json", {
  cacheMode: reloadManifest ? "reload" : "default",
  signal,
  expectedReleaseId: "v2",
});

const core = await loadArtifact(manifest, "core", {
  baseUrl: document.baseURI,
  requestHandle: coreRequest,
  signal,
});
```

The request start precedes the manifest call. Preserve the inherited state transitions: successful core validation clears `reloadCore`; a current non-abort failure sets `reloadCore`; manifest reload is armed only while no manifest is pinned. Continue passing only the cloned manifest and base URL to `createSamplerClient`; do not add parsed core or pack to the Worker message.

- [ ] **Step 9: Rebuild only v2**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse backup/upstream-main-20260717)"
test -z "$(git ls-tree -r --name-only origin/main -- synthesis/releases/v2)"
git rm -r synthesis/releases/v2
node scripts/build-synthesis-runtime.mjs --release v2 --write
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v2 --check
node scripts/build-synthesis-runtime.mjs --release v2 --check-source
```

Expected: all release checks PASS. Never run v1 `--check-source` and never rebuild v1 in PR 15.

- [ ] **Step 10: Run focused and full tests**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
node --test tests/*.test.mjs
npm --prefix tests/browser test -- --project=chromium-desktop --grep "preload|fetch graph|core acquisition|verified core and pack bytes survive|corrupt cache|forced core reload|cache storage"
```

Expected: Node PASS; the request graph has query-free v2 code, one manifest per navigation, and at most one network transfer for each verified artifact across the cold/warm pair. Corrupt-delete, failed forced reload followed by explicit Retry, missing Cache Storage, and rejected put cases all PASS before commit.

- [ ] **Step 11: Recheck the external v1 boundary and commit**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
mapfile -t V1_BOUND_PATHS < <(
  git show freeze/pr14-final-20260717:synthesis/releases/v1/release-lock.json |
  node -e '
    let source = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { source += chunk; });
    process.stdin.on("end", () => {
      const data = JSON.parse(source).data;
      process.stdout.write([
        data.manifest.path,
        ...data.artifacts.map(({ path }) => path),
        data.generator.path,
      ].join("\n") + "\n");
    });
  '
)
git diff --exit-code freeze/pr14-final-20260717 -- synthesis/releases/v1 "${V1_BOUND_PATHS[@]}"
git add synthesis.html synthesis/app.js synthesis/releases/v2 tests/runtime-release.test.mjs tests/browser/synthesis.spec.mjs
git commit -m "perf: apply verified loading to synthesis v2"
```

### Task 12: Make baseline comparison opt-in and update PR 15

**Files:**
- Modify: `synthesis/request-schema.js`
- Modify: `README.md`
- Modify: `synthesis/README.md`
- Modify: `tests/adjust-results-panels.test.mjs`
- Modify: `tests/sampler-worker.test.mjs`
- Modify: `tests/url-state.test.mjs`
- Modify: `tests/browser/synthesis.spec.mjs`
- Regenerate: `synthesis/releases/v2/request-schema.js`
- Regenerate: `synthesis/releases/v2/release-lock.json`

**Interfaces:**
- Consumes: `DEFAULT_CONTROLS`, missing-field normalization, URL-state round trips, Worker request/results, and the explicit baseline checkbox path.
- Produces: `DEFAULT_CONTROLS.compareBaseline === false`; omitted values normalize to false, explicit true remains true and continues to produce baseline marginals, and v2 source/release/docs agree.
- Produces: clean immutable ref `freeze/pr15-final-20260717` and the same commit on `fork/feature/synthesis-studio-phase2`, pushed only with the recorded exact lease.

- [ ] **Step 1: Change test defaults while preserving explicit opt-in coverage**

Update every test-owned default-controls fixture to:

```js
{
  n: 20,
  seed: 42,
  gammaScale: 1,
  compareBaseline: false,
}
```

In `sampler-worker.test.mjs`, change the omitted-field normalization expectation to false. Keep an explicit `compareBaseline: true` request test and assert `baselineMarginals` is non-null. Keep an explicit false test and assert `baselineMarginals` is null.

In `url-state.test.mjs`, assert an omitted controls field normalizes to false while URLs explicitly encoding true round-trip as true.

Name the browser case `"baseline comparison is opt-in and explicit true is preserved"`, then:

1. expect the baseline checkbox to be unchecked on first load;
2. Generate without changing it and assert `controls.compareBaseline === false`, `results.compareBaseline === false`, and `results.hasBaseline === false`;
3. check the control, Generate again, and assert those last two result fields are true.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
node --test tests/adjust-results-panels.test.mjs tests/sampler-worker.test.mjs tests/url-state.test.mjs
npm --prefix tests/browser test -- --project=chromium-desktop --grep "baseline comparison is opt-in"
```

Expected: FAIL because source defaults and missing-field normalization still produce true.

- [ ] **Step 3: Change only the default and missing-field fallback**

In `synthesis/request-schema.js`:

```js
export const DEFAULT_CONTROLS = Object.freeze({
  n: 20,
  seed: 42,
  gammaScale: 1,
  compareBaseline: false,
});

const validateCompareBaseline = (record, key) => {
  if (!hasOwn(record, "compareBaseline")) return DEFAULT_CONTROLS.compareBaseline;
  if (typeof record.compareBaseline !== "boolean") {
    fail("compareBaseline must be a boolean", key);
  }
  return record.compareBaseline;
};
```

Do not change `runSamplerJob()`, `computeMarginals()`, request shape, URL encoding, Worker transfer behavior, or the explicit-true branch.

- [ ] **Step 4: Document the opt-in cost**

Update both READMEs to say that Generate defaults to adjusted marginals only. The baseline checkbox opts into a second same-seed sample from the unadjusted model; when enabled, baseline semantics and output remain unchanged.

In `synthesis/README.md`, also record the inherited loading contract: manifests use normal HTTP caching with explicit retry reload; artifact misses normally use `default`, while the next explicit page Retry owns one `reload` core request; raw core/pack/dimensions bytes enter `matraix-synthesis-verified-artifacts-v1` only after descriptor and artifact-specific semantic validation; hits are revalidated; cached corruption is deleted and bypassed once; Cache Storage failures degrade to verified network loading; and a successful put is awaited before sequential Window/Worker reuse is promised.

- [ ] **Step 5: Rebuild v2 and run focused tests**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse backup/upstream-main-20260717)"
test -z "$(git ls-tree -r --name-only origin/main -- synthesis/releases/v2)"
git rm -r synthesis/releases/v2
node scripts/build-synthesis-runtime.mjs --release v2 --write
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v2 --check
node scripts/build-synthesis-runtime.mjs --release v2 --check-source
node --test tests/adjust-results-panels.test.mjs tests/sampler-worker.test.mjs tests/url-state.test.mjs tests/runtime-release.test.mjs
npm --prefix tests/browser test -- --project=chromium-desktop --grep "baseline comparison is opt-in"
```

Expected: PASS; default Generate has no baseline, and explicit true still computes one.

- [ ] **Step 6: Commit the default change**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git add README.md synthesis/README.md synthesis/request-schema.js synthesis/releases/v2 tests/adjust-results-panels.test.mjs tests/sampler-worker.test.mjs tests/url-state.test.mjs tests/browser/synthesis.spec.mjs
git commit -m "perf: make baseline comparison opt-in"
```

- [ ] **Step 7: Run PR 15's complete verification matrix**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
node --test tests/*.test.mjs
node scripts/build-synthesis-runtime.mjs --release v1 --check
node scripts/build-synthesis-runtime.mjs --release v2 --check
node scripts/build-synthesis-runtime.mjs --release v2 --check-source
npm --prefix tests/browser test
BENCH_RUNS=5 npm --prefix tests/browser run benchmark
git diff --check
```

Expected: all Node and browser projects PASS. Each benchmark sample reports no more than one core and one pack network request across cold/warm cycles; default Generate is faster because the baseline branch is not executed.

- [ ] **Step 8: Reproduce Phase 1 and Phase 2 data under Node 18.19.1**

```bash
set -euo pipefail
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
PYTHON_P2=/data2/zonglin/MatrAIx/.venv/bin/python
"$PYTHON_P2" -c 'import platform,numpy; assert platform.python_version()=="3.12.3"; assert numpy.__version__=="2.5.1"'
MATRAIX_TMP=$(mktemp -d)
git clone --filter=blob:none --no-checkout https://github.com/MatrAIx-ai/MatrAIx.git "$MATRAIX_TMP"
git -C "$MATRAIX_TMP" checkout --detach 4dfa4e066b706c6a2d33a10fd41b976efd3f524e
V1_GENERATOR=$(node -e "const m=require('./synthesis/data/manifest.v1.json');process.stdout.write(m.generator.path)")
V2_GENERATOR=$(node -e "const m=require('./synthesis/data/manifest.v2.json');process.stdout.write(m.generator.path)")
for generator in "$V1_GENERATOR" "$V2_GENERATOR"; do
  digest=$(basename "$generator" | sed -E 's/^build-synthesis-data\.([0-9a-f]{64})\.mjs$/\1/')
  test "${#digest}" -eq 64
  printf '%s  %s\n' "$digest" "$generator" | sha256sum -c -
done
npx --yes node@18.19.1 "$V1_GENERATOR" --graph "$MATRAIX_TMP/persona/synthesis/graph/full_dag.json" --source-commit 4dfa4e066b706c6a2d33a10fd41b976efd3f524e --out-dir synthesis/data --phase 1
npx --yes node@18.19.1 "$V2_GENERATOR" --graph "$MATRAIX_TMP/persona/synthesis/graph/full_dag.json" --source-commit 4dfa4e066b706c6a2d33a10fd41b976efd3f524e --dimensions data/dimensions.json --out-dir synthesis/data --phase 2
"$PYTHON_P2" scripts/generate-synthesis-goldens-p1.py --matraix-root "$MATRAIX_TMP"
"$PYTHON_P2" scripts/generate-synthesis-goldens-p2.py --matraix-root "$MATRAIX_TMP"
git diff --exit-code -- synthesis/data tests/fixtures
rm -rf "$MATRAIX_TMP"
```

Expected: both generators report Node 18.19.1, all pinned hashes match, and no generated data or golden changes.

- [ ] **Step 9: Reassert v1 equality and freeze the final PR 15 head**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
mapfile -t V1_BOUND_PATHS < <(
  git show freeze/pr14-final-20260717:synthesis/releases/v1/release-lock.json |
  node -e '
    let source = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { source += chunk; });
    process.stdin.on("end", () => {
      const data = JSON.parse(source).data;
      process.stdout.write([
        data.manifest.path,
        ...data.artifacts.map(({ path }) => path),
        data.generator.path,
      ].join("\n") + "\n");
    });
  '
)
git diff --exit-code freeze/pr14-final-20260717 -- synthesis/releases/v1 "${V1_BOUND_PATHS[@]}"
git status --short --branch
test -z "$(git status --porcelain)"
git branch freeze/pr15-final-20260717 HEAD
git range-diff backup/pr14-remote-20260717..backup/pr15-remote-20260717 freeze/pr14-final-20260717..freeze/pr15-final-20260717
```

Expected: v1 is identical, status is clean, and the range-diff shows the original Phase 2 work plus the approved dimensions, v2 loading, and baseline commits.

- [ ] **Step 10: Recheck leases and update the existing PR 15 branch**

```bash
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git -C "$P15" fetch origin
git -C "$P15" fetch fork
test "$(git -C "$P15" rev-parse origin/main)" = "$(git -C "$P15" rev-parse backup/upstream-main-20260717)"
EXPECTED_PR15=$(git -C "$P15" rev-parse backup/pr15-remote-20260717)
test "$(git -C "$P15" rev-parse fork/feature/synthesis-studio-phase2)" = "$EXPECTED_PR15"
test "$(git -C "$P15" ls-remote fork refs/heads/feature/synthesis-studio-phase2 | awk '{print $1}')" = "$EXPECTED_PR15"
test "$(git -C "$P15" rev-parse fork/feature/synthesis-studio-phase1)" = "$(git -C "$P15" rev-parse freeze/pr14-final-20260717)"
test "$(git -C "$P15" rev-parse HEAD)" = "$(git -C "$P15" rev-parse freeze/pr15-final-20260717)"
git -C "$P15" push --force-with-lease=refs/heads/feature/synthesis-studio-phase2:"$EXPECTED_PR15" fork HEAD:refs/heads/feature/synthesis-studio-phase2
test "$(git -C "$P15" ls-remote fork refs/heads/feature/synthesis-studio-phase2 | awk '{print $1}')" = "$(git -C "$P15" rev-parse freeze/pr15-final-20260717)"
```

Expected: the existing PR 15 URL points to the fully tested stacked head; its GitHub base remains `main`. If upstream main moved, do not push: repeat the PR 14 rebase/rebuild/verification and the PR 15 restack/rebuild/verification against a new frozen upstream ref.

### Task 13: Remove the temporary PR stack after PR 14 merges

**Files:**
- Rewrite only: `feature/synthesis-studio-phase2` ancestry
- Regenerate: `synthesis/releases/v2/**` from the post-merge source and predecessor
- Verify: all Phase 2 source, data, runtime, browser, and benchmark boundaries

**Interfaces:**
- Consumes: merged PR 14 whose `headRefOid` equals `freeze/pr14-final-20260717`, frozen stacked head `freeze/pr15-final-20260717`, and the live Phase 2 remote lease.
- Produces: Phase 2-only ancestry above `backup/main-after-pr14-20260717`, regenerated post-merge v2 bytes, immutable ref `freeze/pr15-postmerge-20260717`, and the updated existing PR 15 branch.

- [ ] **Step 1: Confirm PR 14 is merged and protect the stacked PR 15 head**

```bash
set -euo pipefail
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
test "$(gh pr view 14 --repo MatrAIx-ai/matrAIx-Website --json state --jq .state)" = "MERGED"
MERGED_PR14_HEAD=$(gh pr view 14 --repo MatrAIx-ai/matrAIx-Website --json headRefOid --jq .headRefOid)
test "$MERGED_PR14_HEAD" = "$(git -C "$REPO" rev-parse freeze/pr14-final-20260717)"
test -z "$(git -C "$P15" status --porcelain)"
git -C "$REPO" fetch origin
git -C "$REPO" fetch fork
STACKED_PR15=$(git -C "$REPO" rev-parse fork/feature/synthesis-studio-phase2)
test "$STACKED_PR15" = "$(git -C "$REPO" rev-parse freeze/pr15-final-20260717)"
git -C "$REPO" branch backup/pr15-stacked-20260717 "$STACKED_PR15"
git -C "$REPO" branch backup/main-after-pr14-20260717 origin/main
```

Expected: the exact tested PR 14 head is merged, PR 15 still equals `freeze/pr15-final-20260717`, and both relevant heads have immutable local backup refs. A different merged head blocks this plan until that head is backed up and the PR 14/15 verification cycle is repeated.

- [ ] **Step 2: Replay only Phase 2 onto updated main**

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
git -C "$P15" rebase --onto backup/main-after-pr14-20260717 freeze/pr14-final-20260717 feature/synthesis-studio-phase2
git -C "$REPO" range-diff freeze/pr14-final-20260717..backup/pr15-stacked-20260717 backup/main-after-pr14-20260717..feature/synthesis-studio-phase2
```

Expected: only Phase 2 commits remain above current main. A merge commit or squash merge of PR 14 is acceptable because `--onto` uses the frozen PR 14 commit as the old Phase 2 boundary.

- [ ] **Step 3: Rebuild v2 from the final post-merge inputs**

```bash
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
test -z "$(git -C "$P15" ls-tree -r --name-only backup/main-after-pr14-20260717 -- synthesis/releases/v2)"
git -C "$P15" rm -r synthesis/releases/v2
(
  cd "$P15"
  node scripts/build-synthesis-runtime.mjs --release v2 --write
  git add synthesis/releases/v2
  if ! git diff --cached --quiet -- synthesis/releases/v2; then
    git commit -m "build: refresh v2 after PR 14 merge"
  fi
)
```

Expected: v2 is absent from merged main and is recreated atomically from the actual post-merge source, data binding, builder, and v1 predecessor. Identical bytes produce no commit; any changed generated byte is captured in an explicit commit.

- [ ] **Step 4: Prove v1 is inherited exactly from merged main**

```bash
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
cd "$P15"
mapfile -t V1_BOUND_PATHS < <(
  git show backup/main-after-pr14-20260717:synthesis/releases/v1/release-lock.json |
  node -e '
    let source = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { source += chunk; });
    process.stdin.on("end", () => {
      const data = JSON.parse(source).data;
      process.stdout.write([
        data.manifest.path,
        ...data.artifacts.map(({ path }) => path),
        data.generator.path,
      ].join("\n") + "\n");
    });
  '
)
git -C "$P15" diff --exit-code backup/main-after-pr14-20260717 -- synthesis/releases/v1 "${V1_BOUND_PATHS[@]}"
(
  cd "$P15"
  node scripts/build-synthesis-runtime.mjs --release v1 --check
  node scripts/build-synthesis-runtime.mjs --release v2 --check
  node scripts/build-synthesis-runtime.mjs --release v2 --check-source
)
```

Expected: v1-bound bytes are identical to merged main and all permitted release checks PASS. Do not run v1 `--check-source`.

- [ ] **Step 5: Repeat full verification on the final ancestry**

```bash
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
node --test tests/*.test.mjs
npm --prefix tests/browser test
BENCH_RUNS=5 npm --prefix tests/browser run benchmark
git diff --check
test -z "$(git status --porcelain)"
```

Expected: all checks PASS and the five-run request-count invariants remain satisfied.

- [ ] **Step 6: Reproduce data on the final ancestry**

```bash
set -euo pipefail
cd /data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
PYTHON_P2=/data2/zonglin/MatrAIx/.venv/bin/python
"$PYTHON_P2" -c 'import platform,numpy; assert platform.python_version()=="3.12.3"; assert numpy.__version__=="2.5.1"'
MATRAIX_TMP=$(mktemp -d)
git clone --filter=blob:none --no-checkout https://github.com/MatrAIx-ai/MatrAIx.git "$MATRAIX_TMP"
git -C "$MATRAIX_TMP" checkout --detach 4dfa4e066b706c6a2d33a10fd41b976efd3f524e
V1_GENERATOR=$(node -e "const m=require('./synthesis/data/manifest.v1.json');process.stdout.write(m.generator.path)")
V2_GENERATOR=$(node -e "const m=require('./synthesis/data/manifest.v2.json');process.stdout.write(m.generator.path)")
for generator in "$V1_GENERATOR" "$V2_GENERATOR"; do
  digest=$(basename "$generator" | sed -E 's/^build-synthesis-data\.([0-9a-f]{64})\.mjs$/\1/')
  test "${#digest}" -eq 64
  printf '%s  %s\n' "$digest" "$generator" | sha256sum -c -
done
npx --yes node@18.19.1 "$V1_GENERATOR" --graph "$MATRAIX_TMP/persona/synthesis/graph/full_dag.json" --source-commit 4dfa4e066b706c6a2d33a10fd41b976efd3f524e --out-dir synthesis/data --phase 1
npx --yes node@18.19.1 "$V2_GENERATOR" --graph "$MATRAIX_TMP/persona/synthesis/graph/full_dag.json" --source-commit 4dfa4e066b706c6a2d33a10fd41b976efd3f524e --dimensions data/dimensions.json --out-dir synthesis/data --phase 2
"$PYTHON_P2" scripts/generate-synthesis-goldens-p1.py --matraix-root "$MATRAIX_TMP"
"$PYTHON_P2" scripts/generate-synthesis-goldens-p2.py --matraix-root "$MATRAIX_TMP"
git diff --exit-code -- synthesis/data tests/fixtures
rm -rf "$MATRAIX_TMP"
```

Expected: no generated source, artifact, or fixture diff.

- [ ] **Step 7: Audit and push PR 15 with the post-merge lease**

```bash
REPO=/data2/zonglin/MatrAIx/matrAIx-Website
P15=/data2/zonglin/matrAIx-Website-worktrees/synthesis-studio-phase1
STACKED_PR15=$(git -C "$REPO" rev-parse backup/pr15-stacked-20260717)
git -C "$REPO" range-diff freeze/pr14-final-20260717..backup/pr15-stacked-20260717 backup/main-after-pr14-20260717..feature/synthesis-studio-phase2
git -C "$REPO" fetch origin
git -C "$REPO" fetch fork
test "$(git -C "$REPO" rev-parse origin/main)" = "$(git -C "$REPO" rev-parse backup/main-after-pr14-20260717)"
test "$(git -C "$REPO" rev-parse fork/feature/synthesis-studio-phase2)" = "$STACKED_PR15"
git -C "$REPO" branch freeze/pr15-postmerge-20260717 "$(git -C "$P15" rev-parse HEAD)"
test "$(git -C "$P15" rev-parse HEAD)" = "$(git -C "$REPO" rev-parse freeze/pr15-postmerge-20260717)"
git -C "$P15" push --force-with-lease=refs/heads/feature/synthesis-studio-phase2:"$STACKED_PR15" fork HEAD:refs/heads/feature/synthesis-studio-phase2
test "$(git -C "$REPO" ls-remote fork refs/heads/feature/synthesis-studio-phase2 | awk '{print $1}')" = "$(git -C "$REPO" rev-parse freeze/pr15-postmerge-20260717)"
test "$(gh pr view 15 --repo MatrAIx-ai/matrAIx-Website --json baseRefName --jq .baseRefName)" = "main"
```

Expected: PR 15 now contains only Phase 2 work above merged main, retains its existing URL and main base, and points to the fully verified head.

---

## Completion Criteria

- PR 14 and PR 15 merged-snapshot HTML has no missing local assets.
- v1 and v2 preload exactly their eager module closures and never preload the lazy Worker.
- core acquisition overlaps manifest loading through a frozen, single-use, exact-URL handle.
- manifests use normal HTTP caching and reload only on an explicit failed attempt.
- every artifact cache hit is fully reverified; content corruption is evicted and retried once; cache API failure degrades without bypassing validation.
- helper-internal and caller-side abort checkpoints prevent body reads, reload starts, cache writes, or parsed-value exposure after an observed abort.
- artifact HTTP/body failures do not auto-retry; the next explicit page Retry owns one `cache: "reload"` core request.
- successful cache commits synchronize later Window/Worker loads, with request-count tests proving sequential reuse.
- PR 15 defaults baseline comparison to false while explicit true remains covered.
- release directories are fully regenerated, builder-checked, source-checked only at their owning PR layer, and v1 is byte-identical across the PR boundary.
- both existing remote branches are updated only with exact leases and have auditable backup/freeze refs.
