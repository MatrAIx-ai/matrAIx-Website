import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const pageGuards = new WeakMap();
const DOMAIN_CATEGORY_KEY = "category:Expertise: Domains";
const DOMAIN_ATTRIBUTE_KEY = "attribute:domain";
const TOPIC_CATEGORY_KEY = "category:Interests: Topics";
const TOPIC_ATTRIBUTE_KEY = "attribute:topic_technology";
const TOPIC_NODE_ID = "topic_technology";
const HELPER_NODE_ID = "latent_digital_engagement";
const MANIFEST_PATH = "/synthesis/data/manifest.v2.json";
const CORE_PATH = "/synthesis/data/graph-core.v1.json";
const PACK_PATH = "/synthesis/data/sampler-pack.v2.json";
const DIMENSIONS_PATH = "/synthesis/data/dimensions.109d203ae177b62e.json";
const MANIFEST_ROUTE = /\/synthesis\/data\/manifest\.v2\.json$/;
const CORE_ROUTE = /\/synthesis\/data\/graph-core\.v1\.json$/;
const PACK_ROUTE = /\/synthesis\/data\/sampler-pack\.v2\.json$/;
const DIMENSIONS_ROUTE = /\/synthesis\/data\/dimensions\.[0-9a-f]{16,64}\.json$/;
const VERIFIED_ARTIFACT_CACHE = "matraix-synthesis-verified-artifacts-v1";
const REQUEST_CANCELLATION_ERRORS = new Set([
  "net::ERR_ABORTED",
  "Load request cancelled",
]);
const RELEASE_RUNTIME_PATHS = [
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
  "sampler-worker.js",
  "sampler.js",
  "synthesis.css",
  "url-state.js",
].map((name) => `/synthesis/releases/v2/${name}`);
const WORKER_RUNTIME_PATH = "/synthesis/releases/v2/sampler-worker.js";
const MAIN_RUNTIME_PATHS = RELEASE_RUNTIME_PATHS
  .filter((pathname) => pathname !== WORKER_RUNTIME_PATH);
const MAIN_MODULE_PATHS = MAIN_RUNTIME_PATHS
  .filter((pathname) => pathname.endsWith(".js"));
const STUDIO_ORIGIN = "http://127.0.0.1:4173";
const GOOGLE_FONT_STYLESHEET = "https://fonts.googleapis.com/css2"
  + "?family=Inter:wght@200;300;400;500;600;700"
  + "&family=JetBrains+Mono:wght@400;500;700"
  + "&family=Orbitron:wght@600;700&display=swap";
const SITE_CODE_URLS = [
  `${STUDIO_ORIGIN}/css/styles.css?v=9`,
  `${STUDIO_ORIGIN}/css/dark-theme.css?v=5`,
  `${STUDIO_ORIGIN}/css/subpages.css?v=8`,
  `${STUDIO_ORIGIN}/css/subpages-light.css?v=2`,
  `${STUDIO_ORIGIN}/css/navigation.css?v=1`,
  `${STUDIO_ORIGIN}/js/theme-toggle.js?v=3`,
  `${STUDIO_ORIGIN}/js/site-performance.js?v=1`,
  GOOGLE_FONT_STYLESHEET,
  ...MAIN_RUNTIME_PATHS.map((pathname) => `${STUDIO_ORIGIN}${pathname}`),
];
const HOSTILE_IMG = '<img src=x onerror="window.__synSentinel=1">';
const HOSTILE_SCRIPT = "<script>window.__synSentinel=2</script>";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function deferredPromise() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function allowHttpFailure(page, pathname, status) {
  const expectation = {
    pathname,
    status,
    expected: 1,
    remaining: 1,
  };
  pageGuards.get(page).expectedHttp.push(expectation);
  return expectation;
}

function allowRequestCancellation(page, pathname) {
  pageGuards.get(page).expectedCancellations.push({ pathname, remaining: 1 });
}

function hostileFixture() {
  const sourceHash = "a".repeat(64);
  const generatorHash = "b".repeat(64);
  const datasetId = `sha256:${sourceHash}`;
  const core = {
    formatVersion: 1,
    datasetId,
    nodes: [{
      id: "hostile_node",
      label: HOSTILE_IMG,
      category: "Hostile fixture",
      description: HOSTILE_SCRIPT,
      emit: true,
      values: [HOSTILE_IMG],
      prior: [1],
      parents: [],
    }],
    edges: [],
    topologicalOrder: ["hostile_node"],
  };
  const coreBytes = Buffer.from(`${JSON.stringify(core)}\n`);
  const manifest = {
    formatVersion: 1,
    releaseId: "v2",
    datasetId,
    source: {
      repo: "MatrAIx-ai/MatrAIx",
      commit: "c".repeat(40),
      fullDagSha256: sourceHash,
    },
    generator: {
      path: `scripts/build-synthesis-data.${generatorHash}.mjs`,
      sha256: generatorHash,
      node: "18.19.1",
    },
    artifacts: {
      core: {
        path: "synthesis/data/graph-core.v1.json",
        sha256: sha256(coreBytes),
        bytes: coreBytes.byteLength,
      },
    },
  };
  return { coreBytes, manifestBytes: Buffer.from(`${JSON.stringify(manifest)}\n`) };
}

async function routeHostileFixture(page) {
  const fixture = hostileFixture();
  await page.route(MANIFEST_ROUTE, (route) => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: fixture.manifestBytes,
  }));
  await page.route(CORE_ROUTE, (route) => route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: fixture.coreBytes,
  }));
}

async function routeMutatedManifest(page, mutate) {
  await page.route(MANIFEST_ROUTE, async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    mutate(manifest);
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: `${JSON.stringify(manifest)}\n`,
    });
  });
}

async function seedCorruptArtifactCache(page, pathnames) {
  await page.route(`${STUDIO_ORIGIN}/`, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<!doctype html><title>Cache seed</title>\n",
  }), { times: 1 });
  await page.goto("/");
  await page.evaluate(async ({ cacheName, paths }) => {
    const cache = await caches.open(cacheName);
    for (const pathname of paths) {
      await cache.put(
        new URL(pathname, location.origin).href,
        new Response("corrupt artifact\n", { status: 200 }),
      );
    }
  }, { cacheName: VERIFIED_ARTIFACT_CACHE, paths: pathnames });
}

function watchArtifactRequests(context) {
  const counts = { core: 0, pack: 0 };
  context.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === CORE_PATH) counts.core += 1;
    if (pathname === PACK_PATH) counts.pack += 1;
  });
  return counts;
}

async function expectGenericLoadFailure(page) {
  await page.goto("/synthesis.html");
  await expect(page.locator("#synLoadStatus")).toHaveAttribute("role", "alert");
  await expect(page.locator("#synLoadMessage"))
    .toHaveText("The graph snapshot could not be verified.");
  await expect(page.locator("#synRetry")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__synState?.manifest)).toBeNull();
}

async function waitForStudio(page) {
  await expect.poll(() => page.evaluate(() => window.__synState?.store?.nodeCount ?? 0), {
    timeout: 15_000,
  }).toBeGreaterThan(0);
  await expect(page.locator("#overviewSvg .syn-cat-node").first()).toBeVisible();
}

async function openStudio(page, path = "/synthesis.html") {
  await page.goto(path);
  await waitForStudio(page);
}

async function selectDomainCenter(page) {
  const category = page.locator(`[data-focus-key="${DOMAIN_CATEGORY_KEY}"]`);
  await category.click();
  const attribute = page.locator(`[data-focus-key="${DOMAIN_ATTRIBUTE_KEY}"]`);
  await expect(attribute).toBeVisible();
  await attribute.click();
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: "domain" });
  await expect(page.locator("#drilldownSvg .syn-dd-node.center")).toBeVisible();
}

async function selectTopicTechnologyCenter(page) {
  const category = page.locator(`[data-focus-key="${TOPIC_CATEGORY_KEY}"]`);
  await category.click();
  const attribute = page.locator(`[data-focus-key="${TOPIC_ATTRIBUTE_KEY}"]`);
  await expect(attribute).toBeVisible();
  await attribute.click();
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: TOPIC_NODE_ID, selectedNode: TOPIC_NODE_ID });
  await expect(page.locator(`[data-focus-key="node:${HELPER_NODE_ID}"]`)).toBeVisible();
}

async function changeNumberControl(page, field, value) {
  const input = page.locator(`[data-control="${field}"]`);
  await input.evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}

async function waitForGeneratedSeed(page, seed, n = undefined) {
  await expect.poll(() => page.evaluate(() => ({
    generating: window.__synState?.generating,
    n: window.__synState?.results?.n,
    seed: window.__synState?.results?.seed,
  })), { timeout: 30_000 }).toEqual({
    generating: false,
    n: n ?? 20,
    seed,
  });
}

async function installFakeSamplerWorker(page, { delayMs = 0 } = {}) {
  await page.addInitScript(({ responseDelay }) => {
    const probes = { created: 0, terminated: 0, runs: [] };
    Object.defineProperty(window, "__fakeWorkerProbe", {
      configurable: false,
      value: probes,
    });

    class FakeSamplerWorker {
      constructor() {
        probes.created += 1;
        this.listeners = { error: new Set(), message: new Set() };
        this.timers = new Set();
        this.terminated = false;
      }

      addEventListener(type, listener) {
        this.listeners[type]?.add(listener);
      }

      removeEventListener(type, listener) {
        this.listeners[type]?.delete(listener);
      }

      postMessage(message) {
        if (this.terminated || message?.type !== "run") return;
        const request = structuredClone(message.request);
        probes.runs.push({ jobId: message.jobId, request });
        const personaNodeIds = ["topic_technology", "latent_digital_engagement"];
        const personaCodes = new Uint32Array(request.n * personaNodeIds.length);
        const topicCounts = [0, 0, 0, 0, 0];
        const helperCounts = [0, 0, 0];
        for (let row = 0; row < request.n; row += 1) {
          const topic = row % topicCounts.length;
          const helper = (row + 1) % helperCounts.length;
          personaCodes[row * 2] = topic;
          personaCodes[row * 2 + 1] = helper;
          topicCounts[topic] += 1;
          helperCounts[helper] += 1;
        }
        const definitions = {
          topic_technology: {
            label: "Interest: Technology",
            values: ["Passionate", "Interested", "Neutral", "Indifferent", "Averse"],
            counts: topicCounts,
          },
          latent_digital_engagement: {
            label: "latent_digital_engagement",
            values: ["Low", "Medium", "High"],
            counts: helperCounts,
          },
        };
        const marginals = {};
        const baselineMarginals = request.compareBaseline ? {} : null;
        for (const nodeId of request.marginalNodeIds ?? []) {
          const definition = definitions[nodeId];
          if (!definition) continue;
          const freqs = definition.counts.map((count) => count / request.n);
          marginals[nodeId] = {
            label: definition.label,
            values: [...definition.values],
            freqs,
          };
          if (baselineMarginals) {
            baselineMarginals[nodeId] = {
              label: definition.label,
              values: [...definition.values],
              freqs: [...freqs].reverse(),
            };
          }
        }
        const result = {
          n: request.n,
          personaNodeIds,
          personaCodes,
          marginals,
          baselineMarginals,
          effectiveConfig: request,
          flags: {
            helperPins: Object.hasOwn(request.pins ?? {}, "latent_digital_engagement")
              ? ["latent_digital_engagement"]
              : [],
          },
        };
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          if (this.terminated) return;
          for (const listener of this.listeners.message) {
            listener({ data: { type: "result", jobId: message.jobId, result } });
          }
        }, responseDelay);
        this.timers.add(timer);
      }

      terminate() {
        if (this.terminated) return;
        this.terminated = true;
        probes.terminated += 1;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
      }
    }

    window.Worker = FakeSamplerWorker;
  }, { responseDelay: delayMs });
}

async function installNativeWorkerProbe(page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const probe = { created: 0, terminated: 0, sent: [], received: [] };
    Object.defineProperty(window, "__nativeWorkerProbe", {
      configurable: false,
      value: probe,
    });
    function ProbedWorker(...args) {
      const worker = new NativeWorker(...args);
      probe.created += 1;
      const nativePostMessage = worker.postMessage.bind(worker);
      worker.postMessage = (message, transfer) => {
        probe.sent.push({
          type: message?.type ?? null,
          keys: message && typeof message === "object" ? Object.keys(message).sort() : [],
          jsonBytes: new TextEncoder().encode(JSON.stringify(message)).byteLength,
          seed: message?.request?.seed ?? null,
          n: message?.request?.n ?? null,
          transferCount: Array.isArray(transfer) ? transfer.length : 0,
        });
        return nativePostMessage(message, transfer);
      };
      const nativeTerminate = worker.terminate.bind(worker);
      worker.terminate = () => {
        probe.terminated += 1;
        return nativeTerminate();
      };
      worker.addEventListener("message", ({ data }) => {
        probe.received.push({
          type: data?.type ?? null,
          jobId: data?.jobId ?? null,
          codeBytes: data?.result?.personaCodes?.byteLength ?? 0,
          bufferBytesBeforeTransfer: data?.__synBufferBytesBeforeTransfer ?? null,
          transferCount: data?.__synTransferCount ?? null,
        });
      });
      return worker;
    }
    ProbedWorker.prototype = NativeWorker.prototype;
    window.Worker = ProbedWorker;
  });
}

async function activeIdentity(page) {
  return page.evaluate(() => ({
    id: document.activeElement?.id ?? "",
    key: document.activeElement?.dataset?.focusKey ?? "",
  }));
}

test.beforeEach(async ({ page, browserName }) => {
  const guard = {
    issues: [],
    resourceConsoleErrors: [],
    expectedHttp: [],
    expectedHttpRequests: new WeakMap(),
    expectedCancellations: [],
  };
  pageGuards.set(page, guard);

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (browserName === "webkit"
        && /^Failed to preconnect to https:\/\/fonts\.(?:googleapis|gstatic)\.com\/\. Error: TLS support is not available$/
          .test(message.text())) {
      return;
    }
    const issue = `console error: ${message.text()}`;
    if (/^console error: Failed to load resource:/.test(issue)) {
      guard.resourceConsoleErrors.push(issue);
    } else guard.issues.push(issue);
  });
  page.on("pageerror", (error) => guard.issues.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText;
    const expected = guard.expectedHttpRequests.get(request);
    if (expected && REQUEST_CANCELLATION_ERRORS.has(errorText)) {
      guard.expectedHttpRequests.delete(request);
      return;
    }
    const pathname = new URL(request.url()).pathname;
    const expectedCancellation = guard.expectedCancellations.find((item) =>
      item.remaining > 0 && item.pathname === pathname);
    if (expectedCancellation && REQUEST_CANCELLATION_ERRORS.has(errorText)) {
      expectedCancellation.remaining -= 1;
      return;
    }
    guard.issues.push(
      `request failed: ${request.method()} ${request.url()} (${errorText})`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const pathname = new URL(response.url()).pathname;
      const expected = guard.expectedHttp.find((item) =>
        item.remaining > 0 && item.status === response.status() && item.pathname === pathname);
      if (expected) {
        expected.remaining -= 1;
        guard.expectedHttpRequests.set(response.request(), expected);
      }
      else {
        guard.issues.push(
          `HTTP ${response.status()}: ${response.request().method()} ${response.url()}`,
        );
      }
    }
  });

  await page.addInitScript(() => {
    Object.defineProperty(window, "__pwUnhandledRejections", {
      configurable: false,
      value: [],
    });
    window.addEventListener("unhandledrejection", (event) => {
      window.__pwUnhandledRejections.push(String(event.reason?.message ?? event.reason));
    });
    window.__synSentinel = 0;
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/css; charset=utf-8",
    body: "/* fonts are intentionally local in browser regression tests */\n",
  }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "font/woff2",
    body: Buffer.alloc(0),
  }));

});

test.afterEach(async ({ page }) => {
  const unhandled = page.isClosed()
    ? []
    : await page.evaluate(() => window.__pwUnhandledRejections ?? []).catch(() => []);
  const guard = pageGuards.get(page)
    ?? { issues: [], resourceConsoleErrors: [], expectedHttp: [] };
  const missingHttp = guard.expectedHttp
    .filter((item) => item.remaining !== 0)
    .map((item) => `expected HTTP ${item.status} was not observed: ${item.pathname}`);
  const observedExpectedFailures = guard.expectedHttp
    .reduce((count, item) => count + item.expected - item.remaining, 0);
  const unexpectedResourceErrors = guard.resourceConsoleErrors.slice(observedExpectedFailures);
  expect(
    [...guard.issues, ...unexpectedResourceErrors, ...missingHttp, ...unhandled],
    "browser runtime/network failures",
  )
    .toEqual([]);
});

test("verified snapshot renders all panels and keeps an empty drill-down hidden", async ({ page }) => {
  await openStudio(page);

  await expect.poll(() => page.evaluate(() => window.__synState?.manifest)).toMatchObject({
    formatVersion: 1,
    releaseId: "v2",
  });
  await expect(page.locator("#synLoadMessage")).toContainText("Verified snapshot");
  await expect(page.locator("#panelOverview")).toBeVisible();
  await expect(page.locator("#panelDrilldown")).toBeVisible();
  await expect(page.locator("#panelDetail")).toBeVisible();
  await expect(page.locator("#panelGenerate")).toBeVisible();
  await expect(page.locator("#panelResults")).toBeVisible();
  await expect(page.locator("#drilldownSvg")).toHaveAttribute("hidden", "");
  await expect(page.locator("#drilldownSvg")).toBeHidden();
  await expect(page.locator("#drilldownEmpty")).toBeVisible();
  await expect(page.locator("#drilldownEmpty")).toContainText("Select an attribute");
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: null, selectedNode: null });
});

test("all five panels expand and restore independently", async ({ page }) => {
  await openStudio(page);
  const panels = [
    ["panelOverview", "Category overview"],
    ["panelDrilldown", "Drill-down subgraph"],
    ["panelDetail", "Node detail"],
    ["panelGenerate", "Adjust & generate"],
    ["panelResults", "Results"],
  ];

  for (const [id, title] of panels) {
    const button = page.locator(`#${id} > .syn-panel-head .syn-expand`);
    await expect(button).toHaveAccessibleName(`Expand ${title}`);
    await button.click();
    await expect(page.locator(`#${id}`)).toHaveClass(/\bexpanded\b/);
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: `Restore ${title}` })).toBeVisible();
  }
  await expect(page.locator(".syn-panel.expanded")).toHaveCount(5);

  await page.getByRole("button", { name: "Restore Node detail" }).click();
  await expect(page.locator("#panelDetail")).not.toHaveClass(/\bexpanded\b/);
  await expect(page.locator(".syn-panel.expanded")).toHaveCount(4);
  for (const id of ["panelOverview", "panelDrilldown", "panelGenerate", "panelResults"]) {
    await expect(page.locator(`#${id}`)).toHaveClass(/\bexpanded\b/);
  }
});

test("a real high-degree center keeps its large drill-down scrollable through expand and resize", async ({ page }) => {
  await openStudio(page);
  await selectDomainCenter(page);

  const svg = page.locator("#drilldownSvg");
  const panelBody = page.locator("#drilldownPanelBody");
  await expect(svg).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#drilldownEmpty")).toBeHidden();
  await expect(page.locator("#truncatedFlag")).toBeVisible();

  const initial = await panelBody.evaluate((body) => {
    const graph = body.querySelector("svg");
    return {
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      svgHeight: Number(graph?.getAttribute("height")),
      svgWidth: Number(graph?.getAttribute("width")),
      renderedWidth: graph?.getBoundingClientRect().width ?? 0,
    };
  });
  expect(initial.svgHeight).toBeGreaterThan(380);
  expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight);
  expect(Math.abs(initial.renderedWidth - initial.svgWidth)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Expand Drill-down subgraph" }).click();
  await expect(page.locator("#panelDrilldown")).toHaveClass(/\bexpanded\b/);
  await expect(page.getByRole("button", { name: "Restore Drill-down subgraph" })).toBeVisible();

  const viewport = page.viewportSize();
  await page.setViewportSize({
    width: Math.max(390, viewport.width - 120),
    height: Math.max(700, viewport.height - 80),
  });
  await expect(page.locator("#drilldownSvg .syn-dd-node text").first()).toBeVisible();
  const resized = await panelBody.evaluate((body) => {
    const graph = body.querySelector("svg");
    const label = graph?.querySelector(".syn-dd-node text");
    return {
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      svgHeight: Number(graph?.getAttribute("height")),
      fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
    };
  });
  expect(resized.svgHeight).toBe(initial.svgHeight);
  expect(resized.scrollHeight).toBeGreaterThan(resized.clientHeight);
  expect(resized.fontSize).toBeGreaterThanOrEqual(10);
});

test("keyboard, pointer, focus restoration, and detail semantics stay coherent", async ({ page }) => {
  await openStudio(page);

  const category = page.locator(`[data-focus-key="${DOMAIN_CATEGORY_KEY}"]`);
  await category.focus();
  await category.press("Enter");
  await expect(category).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: DOMAIN_CATEGORY_KEY });

  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width - 40, height: viewport.height - 20 });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: DOMAIN_CATEGORY_KEY });

  const attribute = page.locator(`[data-focus-key="${DOMAIN_ATTRIBUTE_KEY}"]`);
  await attribute.focus();
  await attribute.press("Space");
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: "domain" });
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: DOMAIN_ATTRIBUTE_KEY });
  await expect(attribute).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#detailRail .prior-val").first()).toHaveText(/^\d+(?:\.\d+)?%$/);
  await expect(page.locator("#detailRail .syn-edge-meta").first()).toContainText(/w=\d/);

  const candidates = page.locator("#drilldownSvg .syn-dd-node:not(.center)");
  await expect(candidates.first()).toBeVisible();
  const enterNode = candidates.first();
  const enterKey = await enterNode.getAttribute("data-focus-key");
  const enterId = enterKey.slice("node:".length);
  await enterNode.focus();
  await enterNode.press("Enter");
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: enterId });
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: enterKey });
  await expect(page.locator(`[data-focus-key="${enterKey}"]`)).toHaveAttribute("aria-pressed", "true");
  const graphViewport = page.viewportSize();
  await page.setViewportSize({
    width: graphViewport.width + 20,
    height: graphViewport.height + 20,
  });
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: enterKey });

  const spaceNode = candidates.nth(1);
  const spaceKey = await spaceNode.getAttribute("data-focus-key");
  const spaceId = spaceKey.slice("node:".length);
  await spaceNode.focus();
  await spaceNode.press("Space");
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: spaceId });
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: spaceKey });
  await expect(page.locator(`[data-focus-key="${spaceKey}"]`))
    .toHaveAttribute("aria-pressed", "true");

  await page.locator(`[data-focus-key="${spaceKey}"]`).press("Shift+Enter");
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: spaceId, selectedNode: spaceId });
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "", key: spaceKey });
  await expect(page.locator(`[data-focus-key="${spaceKey}"]`))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-focus-key="${spaceKey}"]`))
    .toHaveAttribute("aria-current", "true");

  const pointerNode = page.locator("#drilldownSvg .syn-dd-node:not(.center)").first();
  const pointerKey = await pointerNode.getAttribute("data-focus-key");
  const pointerId = pointerKey.slice("node:".length);
  await pointerNode.dblclick();
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: pointerId, selectedNode: pointerId });
  await expect(page.locator(`[data-focus-key="${pointerKey}"]`))
    .toHaveAttribute("aria-pressed", "true");

  const vanishingNode = page.locator("#drilldownSvg .syn-dd-node:not(.center)").first();
  await vanishingNode.focus();
  await page.evaluate(() => {
    for (const id of ["hopsUp", "hopsDown"]) {
      const select = document.getElementById(id);
      select.value = "0";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await expect.poll(() => page.evaluate(() => window.__synState?.selectedNode)).toBeNull();
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "drilldownTitle", key: "" });
  await expect(page.locator("#detailRail")).toContainText("Select a node to inspect");

  await page.locator("#hopsUp").selectOption("1");
  await page.locator("#hopsDown").selectOption("1");
  const selectable = page.locator("#drilldownSvg .syn-dd-node:not(.center)").first();
  await selectable.focus();
  await selectable.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__synState?.selectedNode)).not.toBeNull();

  await attribute.focus();
  const otherCategory = page.locator(
    `#overviewSvg .syn-cat-node:not([data-focus-key="${DOMAIN_CATEGORY_KEY}"])`,
  ).first();
  await otherCategory.evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => window.__synState?.selectedNode)).toBeNull();
  await expect.poll(() => activeIdentity(page)).toEqual({ id: "overviewTitle", key: "" });
  await expect(page.locator("#detailRail")).toContainText("Select a node to inspect");
});

test("hostile fixture text stays literal and cannot create executable DOM", async ({ page }) => {
  await routeHostileFixture(page);
  await openStudio(page);

  const category = page.locator("#overviewSvg .syn-cat-node").first();
  await category.focus();
  await category.press("Enter");
  const attribute = page.locator("#attrList button").first();
  await expect(attribute).toContainText(HOSTILE_IMG);
  await attribute.click();
  await expect.poll(() => page.evaluate(() => window.__synState?.selectedNode))
    .toBe("hostile_node");

  await expect(page.locator("#detailRail")).toContainText(HOSTILE_IMG);
  await expect(page.locator("#detailRail")).toContainText(HOSTILE_SCRIPT);
  expect(await page.locator("img").count()).toBe(0);
  expect(await page.locator("script:not([src])").count()).toBe(0);
  expect(await page.evaluate(() => window.__synSentinel)).toBe(0);
});

for (const scenario of [
  {
    name: "manifest 404",
    cancelsCore: true,
    setup: async (page) => {
      allowHttpFailure(page, MANIFEST_PATH, 404);
      await page.route(MANIFEST_ROUTE, (route) => route.fulfill({
        status: 404,
        contentType: "text/plain; charset=utf-8",
        body: "not found\n",
      }));
    },
  },
  {
    name: "malformed manifest JSON",
    cancelsCore: true,
    setup: async (page) => page.route(MANIFEST_ROUTE, (route) => route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: '{"formatVersion":',
    })),
  },
  {
    name: "unsupported formatVersion",
    cancelsCore: true,
    setup: async (page) => routeMutatedManifest(page, (manifest) => {
      manifest.formatVersion = 2;
    }),
  },
  {
    name: "artifact hash mismatch",
    setup: async (page) => routeMutatedManifest(page, (manifest) => {
      manifest.artifacts.core.sha256 = "0".repeat(64);
    }),
  },
  {
    name: "datasetId mismatch",
    setup: async (page) => routeMutatedManifest(page, (manifest) => {
      manifest.source.fullDagSha256 = "0".repeat(64);
      manifest.datasetId = `sha256:${manifest.source.fullDagSha256}`;
    }),
  },
]) {
  test(`${scenario.name} shows only the generic verification error`, async ({ page }) => {
    if (scenario.cancelsCore) allowRequestCancellation(page, CORE_PATH);
    await scenario.setup(page);
    await expectGenericLoadFailure(page);
  });
}

test("Retry recovers an artifact failure without refetching the pinned manifest", async ({ page }) => {
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
  let manifestRequests = 0;
  let coreRequests = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === MANIFEST_PATH) manifestRequests += 1;
    if (pathname === CORE_PATH) coreRequests += 1;
  });
  const expectedCoreFailure = allowHttpFailure(page, CORE_PATH, 503);
  await page.route(CORE_ROUTE, async (route) => {
    if (coreRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "text/plain; charset=utf-8",
        body: "temporary outage\n",
      });
      return;
    }
    await route.continue();
  });

  await expectGenericLoadFailure(page);
  expect(manifestRequests).toBe(1);
  expect(coreRequests).toBe(1);
  await page.locator("#synRetry").click();
  await waitForStudio(page);
  await expect(page.locator("#synLoadMessage")).toContainText("Verified snapshot");
  await expect(page.locator("#synRetry")).toBeHidden();
  expect(manifestRequests).toBe(1);
  expect(coreRequests).toBe(2);
  expect(await page.evaluate(() => globalThis.__synCoreFetchModes))
    .toEqual(["default", "reload"]);
  expect(expectedCoreFailure.remaining).toBe(0);
});

test("verified core and pack bytes survive a Window and Worker restart", async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Cache/Worker reuse runs once on Chromium");
  await seedCorruptArtifactCache(page, [CORE_PATH, PACK_PATH]);
  await installNativeWorkerProbe(page);
  const requests = watchArtifactRequests(context);

  await openStudio(page);
  expect(requests).toEqual({ core: 1, pack: 0 });
  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 20);
  expect(requests).toEqual({ core: 1, pack: 1 });
  expect(await page.evaluate(() => ({
    created: window.__nativeWorkerProbe.created,
    resultCount: window.__synState?.results?.n ?? 0,
  }))).toEqual({ created: 1, resultCount: 20 });

  await page.reload();
  await waitForStudio(page);
  expect(requests).toEqual({ core: 1, pack: 1 });
  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 20);
  expect(requests).toEqual({ core: 1, pack: 1 });
  expect(await page.evaluate(() => ({
    created: window.__nativeWorkerProbe.created,
    resultCount: window.__synState?.results?.n ?? 0,
  }))).toEqual({ created: 1, resultCount: 20 });
});

test("corrupt cache recovery survives delete failure", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Cache recovery runs once on Chromium");
  await seedCorruptArtifactCache(page, [CORE_PATH]);
  await page.addInitScript((corePath) => {
    const nativeDelete = Cache.prototype.delete;
    Cache.prototype.delete = function deleteCachedArtifact(input, options) {
      const rawUrl = input instanceof Request ? input.url : String(input);
      if (new URL(rawUrl, location.href).pathname === corePath) {
        return Promise.reject(new Error("synthetic cache delete failure"));
      }
      return nativeDelete.call(this, input, options);
    };
  }, CORE_PATH);
  const requests = watchArtifactRequests(context);

  await openStudio(page);
  expect(requests.core).toBe(1);
  await page.reload();
  await waitForStudio(page);
  expect(requests.core).toBe(1);
});

test("a failed forced core reload reaches Retry and then recovers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Forced recovery runs once on Chromium");
  await seedCorruptArtifactCache(page, [CORE_PATH]);
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
  let coreRequests = 0;
  await page.route(CORE_ROUTE, async (route) => {
    coreRequests += 1;
    if (coreRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: "corrupt network artifact\n",
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/synthesis.html");
  await expect(page.locator("#synRetry")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__synState?.store?.nodeCount ?? 0)).toBe(0);
  expect(coreRequests).toBe(1);
  await page.locator("#synRetry").click();
  await waitForStudio(page);
  expect(coreRequests).toBe(2);
  expect(await page.evaluate(() => globalThis.__synCoreFetchModes))
    .toEqual(["reload", "reload"]);
});

test("cache storage unavailable degrades to verified network loading", async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Cache degradation runs once on Chromium");
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "caches", { configurable: true, value: undefined });
  });
  const requests = watchArtifactRequests(context);

  await openStudio(page);
  await page.reload();
  await waitForStudio(page);
  expect(requests.core).toBe(2);
});

test("cache storage put rejection degrades to verified network loading", async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Cache degradation runs once on Chromium");
  await page.addInitScript(() => {
    Cache.prototype.put = () => Promise.reject(new Error("synthetic cache put failure"));
  });
  const requests = watchArtifactRequests(context);

  await openStudio(page);
  await page.reload();
  await waitForStudio(page);
  expect(requests.core).toBe(2);
});

test("a recipe-free batch paginates, renders text lazily, compares numeric distributions, and preserves selection focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "full worker flow runs once on desktop Chromium");
  let dimensionsRequests = 0;
  page.on("request", (request) => {
    if (DIMENSIONS_ROUTE.test(new URL(request.url()).pathname)) dimensionsRequests += 1;
  });
  await openStudio(page);
  await selectDomainCenter(page);
  expect(await page.evaluate(() => window.__synState.recipe)).toEqual([]);
  expect(dimensionsRequests).toBe(0);

  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 20);
  await expect(page.locator("#resultsPanel .syn-persona-table tbody tr")).toHaveCount(10);
  await expect(page.locator("#resultsPanel caption"))
    .toHaveText("Generated personas 1–10 of 20");
  await expect(page.locator("#resultsPanel .syn-dist-card").filter({ hasText: "Domain" }))
    .toBeVisible();
  const distributionNumbers = page.locator("#resultsPanel .syn-dist-numbers");
  await expect(distributionNumbers.first()).toHaveText(/^\d+\.\d% → \d+\.\d%$/);

  await page.getByRole("button", { name: "Next result page" }).click();
  await expect(page.locator("#resultsPanel caption"))
    .toHaveText("Generated personas 11–20 of 20");
  await expect(page.locator("#resultsPanel .syn-persona-table tbody tr")).toHaveCount(10);

  const renderText = page.getByRole("button", { name: "Render text for persona #11" });
  await renderText.click();
  await expect(page.locator("#resultsPanel .syn-rendered-persona").first()).not.toBeEmpty();
  expect(dimensionsRequests).toBe(1);

  const select = page.getByRole("button", { name: "Select persona #11" });
  await select.focus();
  await select.press("Enter");
  await expect(select).toBeFocused();
  await expect(select).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__synState.overlayIndex)).toBe(10);
  await expect(page.locator(`[data-focus-key="node:domain"] .syn-dd-meta`))
    .toContainText("Persona:");
});

test("four recipe kinds reach the worker, invalid priors roll back, and compact results overlay real emit/helper values", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "phase-two integration runs once on desktop Chromium");
  await installFakeSamplerWorker(page);
  await openStudio(page);
  await selectTopicTechnologyCenter(page);

  const categoryAdjustment = page.getByRole("button", {
    name: "Adjust Interests: Topics category scale",
  });
  await categoryAdjustment.focus();
  await categoryAdjustment.press("Enter");
  await page.getByRole("button", { name: "Adjust prior for Interest: Technology" }).click();
  await page.locator(
    '#detailRail button[aria-label^="Adjust "][aria-label$=" edge weight"]',
  ).first().click();
  await expect.poll(() => page.evaluate(() => window.__synState.recipe.map((entry) => entry.kind)))
    .toEqual(["category", "prior", "edge"]);

  const categoryScale = page.getByRole("slider", { name: "Influence of Interests: Topics" });
  await categoryScale.scrollIntoViewIfNeeded();
  const categoryHandle = await categoryScale.elementHandle();
  const categoryBox = await categoryScale.boundingBox();
  expect(categoryHandle).not.toBeNull();
  expect(categoryBox).not.toBeNull();
  const urlBeforeDrag = page.url();
  await categoryScale.hover({ position: { x: 4, y: categoryBox.height / 2 } });
  await page.mouse.down();
  for (const fraction of [0.45, 0.6, 0.72, 0.84]) {
    await page.mouse.move(
      categoryBox.x + categoryBox.width * fraction,
      categoryBox.y + categoryBox.height / 2,
      { steps: 3 },
    );
    expect(await categoryHandle.evaluate((input) => input.isConnected)).toBe(true);
  }
  expect(await categoryHandle.evaluate((input) => input.nextElementSibling?.textContent))
    .not.toBe("1.0×");
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() =>
    window.__synState.recipe.find((entry) => entry.kind === "category")?.factor))
    .toBeGreaterThan(2);
  const categoryFactor = await page.evaluate(() =>
    window.__synState.recipe.find((entry) => entry.kind === "category")?.factor);
  expect(categoryFactor).toBeLessThanOrEqual(3);
  expect(page.url()).not.toBe(urlBeforeDrag);
  const edgeScale = page.locator('#adjustPanel input[aria-label^="Weight factor for "]').first();
  await edgeScale.evaluate((input) => {
    input.value = "1.7";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

  const priorInputs = () => page.locator(
    '#adjustPanel input[aria-label^="Prior weight for Interest: Technology ="]',
  );
  await expect(priorInputs()).toHaveCount(5);
  for (let index = 0; index < 4; index += 1) {
    const input = priorInputs().nth(index);
    await input.evaluate((element) => {
      element.value = "0";
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect.poll(() => page.evaluate((throughIndex) =>
      window.__synState.recipe.find((entry) => entry.kind === "prior")
        ?.weights.slice(0, throughIndex + 1), index))
      .toEqual(Array(index + 1).fill(0));
    // The panel re-renders on the next animation frame. Wait for that commit so
    // the next change listener closes over the latest cumulative weights.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  }
  const urlBeforeRejectedPrior = page.url();
  const finalPriorBefore = await page.evaluate(() =>
    window.__synState.recipe.find((entry) => entry.kind === "prior")?.weights[4]);
  await priorInputs().nth(4).evaluate((element) => {
    element.value = "0";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#adjustPanel .syn-inline-error"))
    .toContainText("weights must have positive mass");
  await expect.poll(() => page.evaluate(() =>
    window.__synState.recipe.find((entry) => entry.kind === "prior")?.weights[4]))
    .toBe(finalPriorBefore);
  expect(page.url()).toBe(urlBeforeRejectedPrior);

  const helper = page.locator(`[data-focus-key="node:${HELPER_NODE_ID}"]`);
  await helper.focus();
  await helper.press("Enter");
  await expect(page.locator("#detailRail h3").first()).toHaveText(HELPER_NODE_ID);
  await page.getByRole("button", { name: `Pin ${HELPER_NODE_ID} to Low` }).click();
  await expect.poll(() => page.evaluate(() => window.__synState.recipe.map((entry) => entry.kind)))
    .toEqual(["category", "prior", "edge", "pin"]);
  await expect(page.locator('#adjustPanel [data-helper-warning="true"]'))
    .toHaveText("helper pin");

  await changeNumberControl(page, "gammaScale", 0.5);
  await expect.poll(() => page.evaluate(() => window.__synState.controls.gammaScale)).toBe(0.5);
  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 20);

  const run = await page.evaluate(() => window.__fakeWorkerProbe.runs.at(-1));
  expect(run.request).toMatchObject({
    n: 20,
    seed: 42,
    gammaScale: 0.5,
    pins: { latent_digital_engagement: "Low" },
    overrides: {
      categoryScales: { "Interests: Topics": categoryFactor },
      nodePriors: { topic_technology: [0, 0, 0, 0, finalPriorBefore] },
    },
  });
  expect(Object.keys(run.request.overrides.edgeWeights)).toHaveLength(1);
  expect(Object.values(run.request.overrides.edgeWeights)).toEqual([1.7]);
  await expect(page.locator("#resultsPanel .syn-dist-numbers").first())
    .toHaveText(/^\d+\.\d% → \d+\.\d%$/);
  await expect(page.locator("#resultsPanel .syn-persona-table"))
    .not.toContainText(HELPER_NODE_ID);

  const second = page.getByRole("button", { name: "Select persona #2" });
  await second.focus();
  await second.press("Enter");
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__synState.overlayIndex)).toBe(1);
  await expect(page.locator(`[data-focus-key="node:${TOPIC_NODE_ID}"] .syn-dd-meta`))
    .toHaveText("Persona: Interested");
  await expect(page.locator(`[data-focus-key="node:${HELPER_NODE_ID}"] .syn-dd-meta`))
    .toHaveText("Persona: High");
  await expect(page.locator('[data-focus-key="node:values_priority"] .syn-dd-meta'))
    .toHaveText("Not sampled");
  expect(await page.evaluate(() => Object.hasOwn(window.__synState.results, "personaCodes")))
    .toBe(false);

  await changeNumberControl(page, "seed", 43);
  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 43, 20);
  await expect.poll(() => page.evaluate(() => window.__synState.overlayIndex)).toBeNull();
  await expect(page.locator(`[data-focus-key="node:${TOPIC_NODE_ID}"] .syn-dd-meta`))
    .not.toContainText("Persona:");
});

test("rapid restarts are latest-wins and an invalid draft cannot cancel the active valid job", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "worker lifecycle integration runs once on desktop Chromium");
  await installFakeSamplerWorker(page, { delayMs: 750 });
  await openStudio(page);

  for (const seed of [101, 202, 303]) {
    await changeNumberControl(page, "seed", seed);
    const action = seed === 101 ? "Generate personas" : "Restart with latest settings";
    await page.getByRole("button", { name: action }).click();
    await expect.poll(() => page.evaluate(() => window.__synState.generating)).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.__fakeWorkerProbe.runs.map((run) =>
    run.request.seed))).toEqual([101, 202, 303]);
  await waitForGeneratedSeed(page, 303, 20);
  expect(await page.evaluate(() => window.__fakeWorkerProbe.terminated)).toBe(2);

  await changeNumberControl(page, "seed", 404);
  await page.getByRole("button", { name: "Generate personas" }).click();
  await expect.poll(() => page.evaluate(() => ({
    activeJobId: window.__synState.activeJobId,
    generating: window.__synState.generating,
  }))).toEqual({ activeJobId: 4, generating: true });
  const validUrl = page.url();
  await changeNumberControl(page, "gammaScale", -1);
  await expect(page.locator("#adjustPanel .syn-inline-error"))
    .toContainText("gammaScale must be a finite number greater than or equal to 0");
  await expect.poll(() => page.evaluate(() => ({
    activeJobId: window.__synState.activeJobId,
    gammaScale: window.__synState.controls.gammaScale,
    generating: window.__synState.generating,
  }))).toEqual({ activeJobId: 4, gammaScale: 1, generating: true });
  expect(page.url()).toBe(validUrl);
  await expect(page.getByRole("button", { name: "Restart with latest settings" }))
    .toBeVisible();
  await waitForGeneratedSeed(page, 404, 20);
  await expect(page.locator("#resultsPanel .syn-results-summary"))
    .toContainText("seed 404");
});

test("a failed sampler pack retires its worker and the next Generate retries cleanly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "real worker retry runs once on desktop Chromium");
  await installNativeWorkerProbe(page);
  let packRequests = 0;
  allowHttpFailure(page, PACK_PATH, 503);
  await page.route(PACK_ROUTE, async (route) => {
    packRequests += 1;
    if (packRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "text/plain; charset=utf-8",
        body: "temporary sampler pack outage\n",
      });
      return;
    }
    await route.continue();
  });

  await openStudio(page);
  await page.getByRole("button", { name: "Generate personas" }).click();
  await expect(page.locator("#adjustPanel .syn-inline-error"))
    .toHaveText("Generation failed. Retry with the verified snapshot.", { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => ({
    generating: window.__synState.generating,
    workers: window.__nativeWorkerProbe.created,
  }))).toEqual({ generating: false, workers: 1 });
  expect(packRequests).toBe(1);

  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 20);
  expect(packRequests).toBe(2);
  await expect.poll(() => page.evaluate(() => ({
    created: window.__nativeWorkerProbe.created,
    terminated: window.__nativeWorkerProbe.terminated,
  }))).toEqual({ created: 2, terminated: 1 });
});

test("a rejected dimensions load is cleared so persona text Retry can succeed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "lazy artifact retry runs once on desktop Chromium");
  await installFakeSamplerWorker(page);
  let dimensionsRequests = 0;
  allowHttpFailure(page, DIMENSIONS_PATH, 503);
  await page.route(DIMENSIONS_ROUTE, async (route) => {
    dimensionsRequests += 1;
    if (dimensionsRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "text/plain; charset=utf-8",
        body: "temporary dimensions outage\n",
      });
      return;
    }
    await route.continue();
  });

  await openStudio(page);
  await selectTopicTechnologyCenter(page);
  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 20);
  await page.getByRole("button", { name: "Render text for persona #1", exact: true }).click();
  await expect(page.locator("#resultsPanel .syn-text-error"))
    .toHaveText("Persona text dimensions could not be verified.");
  await expect(page.getByRole("button", {
    name: "Retry persona text for persona #1",
    exact: true,
  }))
    .toBeVisible();
  expect(dimensionsRequests).toBe(1);

  await page.getByRole("button", {
    name: "Retry persona text for persona #1",
    exact: true,
  }).click();
  await expect(page.locator("#resultsPanel .syn-rendered-persona")).not.toBeEmpty();
  expect(dimensionsRequests).toBe(2);
});

test("the 390px menu closes on Escape, link activation, and desktop resize", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile-390"), "390px navigation regression");
  await openStudio(page);

  const nav = page.locator(".mx-nav");
  const menu = page.locator(".mx-menu");
  const firstLink = page.locator("#primaryNav a").first();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await expect(nav).toHaveClass(/\bopen\b/);
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(firstLink).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(nav).not.toHaveClass(/\bopen\b/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();

  await menu.click();
  await firstLink.evaluate((link) => {
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await firstLink.click();
  await expect(nav).not.toHaveClass(/\bopen\b/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(new URL(page.url()).pathname).toBe("/synthesis.html");

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.setViewportSize({ width: 900, height: 844 });
  await expect(nav).not.toHaveClass(/\bopen\b/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("URL reload and Back/Forward keep center and detail selection independent", async ({ page }) => {
  await openStudio(page);
  await selectDomainCenter(page);

  const neighbor = page.locator("#drilldownSvg .syn-dd-node:not(.center)").first();
  const neighborKey = await neighbor.getAttribute("data-focus-key");
  const neighborId = neighborKey.slice("node:".length);
  await neighbor.click();
  await expect.poll(() => page.evaluate(() => window.__synState?.selectedNode)).toBe(neighborId);
  await expect.poll(() => page.evaluate(() => window.__synState?.centerNode)).toBe("domain");
  let url = new URL(page.url());
  expect(url.searchParams.get("centerNode")).toBe("domain");
  expect(url.searchParams.get("selectedNode")).toBe(neighborId);

  await page.reload();
  await waitForStudio(page);
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: neighborId });
  await expect(page.locator("#detailRail h3").first()).not.toHaveText("Domain");

  await page.goBack();
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: "domain" });
  await page.goForward();
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: "domain", selectedNode: neighborId });

  const datasetId = await page.evaluate(() => window.__synState.manifest.datasetId);
  const centerOnly = new URL("/synthesis.html", page.url());
  centerOnly.searchParams.set("v", "1");
  centerOnly.searchParams.set("datasetId", datasetId);
  centerOnly.searchParams.set("centerNode", "domain");
  centerOnly.searchParams.set("up", "2");
  centerOnly.searchParams.set("down", "0");
  await page.goto(centerOnly.href);
  await waitForStudio(page);
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
    up: window.__synState?.up,
    down: window.__synState?.down,
  }))).toEqual({ centerNode: "domain", selectedNode: null, up: 2, down: 0 });
  await expect(page.locator("#drilldownSvg")).toBeVisible();
  await expect(page.locator("#detailRail")).toContainText("Select a node to inspect");
  await expect(page.locator("#detailRail")).not.toContainText("Highest education");
});

test("the complete cfg survives reload and history while duplicate cfg falls back without losing browse state", async ({ page }) => {
  await openStudio(page);
  await selectTopicTechnologyCenter(page);
  await page.getByRole("button", { name: "Pin Interest: Technology to Passionate" }).click();
  await expect.poll(() => page.evaluate(() => window.__synState.recipe.length)).toBe(1);
  await changeNumberControl(page, "gammaScale", 1.8);
  await expect.poll(() => page.evaluate(() => window.__synState.controls.gammaScale)).toBe(1.8);

  const validUrl = page.url();
  await changeNumberControl(page, "gammaScale", -1);
  await expect(page.locator("#adjustPanel .syn-inline-error"))
    .toContainText("gammaScale must be a finite number greater than or equal to 0");
  await expect.poll(() => page.evaluate(() => window.__synState.controls.gammaScale)).toBe(1.8);
  await expect(page.locator('[data-control="gammaScale"]')).toHaveValue("1.8");
  expect(page.url()).toBe(validUrl);

  const categoryAdjustment = page.getByRole("button", {
    name: "Adjust Interests: Topics category scale",
  });
  await categoryAdjustment.focus();
  await categoryAdjustment.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__synState.recipe.length)).toBe(2);
  let url = new URL(page.url());
  expect(url.searchParams.getAll("cfg")).toHaveLength(1);
  const twoRecipeCfg = url.searchParams.get("cfg");

  await page.reload();
  await waitForStudio(page);
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState.centerNode,
    gammaScale: window.__synState.controls.gammaScale,
    recipeKinds: window.__synState.recipe.map((entry) => entry.kind),
  }))).toEqual({
    centerNode: TOPIC_NODE_ID,
    gammaScale: 1.8,
    recipeKinds: ["pin", "category"],
  });

  await page.goBack();
  await expect.poll(() => page.evaluate(() => ({
    gammaScale: window.__synState.controls.gammaScale,
    recipeKinds: window.__synState.recipe.map((entry) => entry.kind),
  }))).toEqual({ gammaScale: 1.8, recipeKinds: ["pin"] });
  await page.goForward();
  await expect.poll(() => page.evaluate(() =>
    window.__synState.recipe.map((entry) => entry.kind))).toEqual(["pin", "category"]);
  expect(new URL(page.url()).searchParams.get("cfg")).toBe(twoRecipeCfg);

  url = new URL(page.url());
  url.searchParams.append("cfg", "not-canonical-base64url");
  await page.goto(url.href);
  await waitForStudio(page);
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState.centerNode,
    selectedNode: window.__synState.selectedNode,
    controls: window.__synState.controls,
    recipe: window.__synState.recipe,
  }))).toEqual({
    centerNode: TOPIC_NODE_ID,
    selectedNode: TOPIC_NODE_ID,
    controls: { n: 20, seed: 42, gammaScale: 1, compareBaseline: true },
    recipe: [],
  });
  const canonical = new URL(page.url());
  expect(canonical.searchParams.getAll("cfg")).toHaveLength(0);
  expect(canonical.searchParams.get("cfg")).not.toBe(twoRecipeCfg);
  await expect(page.locator(`[data-focus-key="node:${TOPIC_NODE_ID}"]`)).toBeVisible();
});

test("illegal and duplicate URL parameters canonicalize to safe defaults", async ({ page }) => {
  await openStudio(page,
    "/synthesis.html?v=1&v=1&datasetId=sha256%3A0000&category=missing"
      + "&centerNode=missing&selectedNode=domain&up=99&down=-1");

  await expect.poll(() => page.evaluate(() => ({
    selectedCategory: window.__synState?.selectedCategory,
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
    up: window.__synState?.up,
    down: window.__synState?.down,
  }))).toEqual({
    selectedCategory: null,
    centerNode: null,
    selectedNode: null,
    up: 1,
    down: 1,
  });
  const canonical = new URL(page.url());
  expect(canonical.searchParams.getAll("v")).toEqual(["1"]);
  expect(canonical.searchParams.get("datasetId")).toMatch(/^sha256:[0-9a-f]{64}$/);
  for (const key of ["category", "centerNode", "selectedNode", "up", "down"]) {
    expect(canonical.searchParams.has(key)).toBe(false);
  }
  await expect(page.locator("#drilldownSvg")).toBeHidden();
  await expect(page.locator("#detailRail")).toContainText("Select a node to inspect");
});

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

test("n=200 stays off the main thread and crosses the worker boundary as a compact transferred buffer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "performance and transfer probe is Chromium-specific");
  await installNativeWorkerProbe(page);
  await page.route(/\/synthesis\/releases\/v2\/sampler-worker\.js$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const instrumentation = `
const __synNativeWorkerPostMessage = self.postMessage.bind(self);
self.postMessage = (message, transfer = []) => {
  if (message?.type === "result") {
    message.__synTransferCount = Array.isArray(transfer) ? transfer.length : 0;
    message.__synBufferBytesBeforeTransfer = message.result?.personaCodes?.buffer?.byteLength ?? 0;
  }
  return __synNativeWorkerPostMessage(message, transfer);
};
`;
    await route.fulfill({ response, body: `${instrumentation}${source}` });
  });

  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url())));
  await openStudio(page);
  await changeNumberControl(page, "n", 200);
  const compareBaseline = page.locator('[data-control="compareBaseline"]');
  await expect(compareBaseline).toBeChecked();
  await compareBaseline.uncheck();
  await expect.poll(() => page.evaluate(() => window.__synState.controls.compareBaseline))
    .toBe(false);
  await page.evaluate(() => {
    const intervalMs = 25;
    let previous = performance.now();
    let maxLag = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      maxLag = Math.max(maxLag, now - previous - intervalMs);
      previous = now;
    }, intervalMs);
    window.__stopMainThreadProbe = () => {
      clearInterval(timer);
      return maxLag;
    };
  });

  const started = Date.now();
  await page.getByRole("button", { name: "Generate personas" }).click();
  await waitForGeneratedSeed(page, 42, 200);
  const elapsedMs = Date.now() - started;
  const maxMainThreadLagMs = await page.evaluate(() => window.__stopMainThreadProbe());
  expect(elapsedMs).toBeLessThan(30_000);
  expect(maxMainThreadLagMs).toBeLessThan(250);

  const snapshot = await page.evaluate(() => ({
    probe: window.__nativeWorkerProbe,
    result: window.__synState.results,
  }));
  expect(snapshot.probe.created).toBe(1);
  const init = snapshot.probe.sent.find((message) => message.type === "init");
  const run = snapshot.probe.sent.find((message) => message.type === "run");
  expect(init).toMatchObject({
    keys: ["baseUrl", "manifest", "type"],
    transferCount: 0,
  });
  expect(init.jsonBytes).toBeLessThan(10_000);
  expect(run).toMatchObject({
    keys: ["jobId", "request", "type"],
    n: 200,
    seed: 42,
    transferCount: 0,
  });
  expect(run.jsonBytes).toBeLessThan(10_000);
  const received = snapshot.probe.received.find((message) => message.type === "result");
  const expectedCodeBytes = 200 * snapshot.result.personaNodeCount * Uint32Array.BYTES_PER_ELEMENT;
  expect(snapshot.result.personaCodeBytes).toBe(expectedCodeBytes);
  expect(received).toMatchObject({
    codeBytes: expectedCodeBytes,
    bufferBytesBeforeTransfer: expectedCodeBytes,
    transferCount: 1,
  });
  expect(Object.hasOwn(snapshot.result, "personaCodes")).toBe(false);

  const synthesisRequests = requests.filter((url) => url.pathname.startsWith("/synthesis/"));
  expect(synthesisRequests.every((url) => url.search === "" && url.hash === "")).toBe(true);
  expect(synthesisRequests.filter((url) => url.pathname === WORKER_RUNTIME_PATH)).toHaveLength(1);
  expect(synthesisRequests.filter((url) => url.pathname === PACK_PATH)).toHaveLength(1);
  expect(synthesisRequests.filter((url) => url.pathname === DIMENSIONS_PATH)).toHaveLength(0);
  expect(new Set(synthesisRequests
    .filter((url) => url.pathname.startsWith("/synthesis/releases/"))
    .map((url) => url.pathname))).toEqual(new Set(RELEASE_RUNTIME_PATHS));
});

test("the main thread fetch graph is the query-free v2 closure and defers worker data", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push({
    resourceType: request.resourceType(),
    url: request.url(),
  }));
  await openStudio(page);

  const preloadHrefs = await page.locator('link[rel~="modulepreload"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")));
  expect(preloadHrefs.sort()).toEqual(
    MAIN_MODULE_PATHS.map((pathname) => pathname.slice(1)).sort(),
  );

  const codeRequests = requests.filter(({ resourceType }) =>
    resourceType === "script" || resourceType === "stylesheet");
  expect(codeRequests.map(({ url }) => url).sort()).toEqual([...SITE_CODE_URLS].sort());
  for (const url of SITE_CODE_URLS) {
    expect(codeRequests.filter((request) => request.url === url)).toHaveLength(1);
  }

  const releaseRequests = requests
    .map(({ url }) => new URL(url))
    .filter((url) => url.pathname.startsWith("/synthesis/releases/"));
  expect(releaseRequests).toHaveLength(MAIN_RUNTIME_PATHS.length);
  expect(releaseRequests.every((url) => url.search === "" && url.hash === "")).toBe(true);
  expect(releaseRequests.map((url) => url.pathname).sort())
    .toEqual([...MAIN_RUNTIME_PATHS].sort());
  for (const pathname of MAIN_RUNTIME_PATHS) {
    expect(releaseRequests.filter((url) => url.pathname === pathname)).toHaveLength(1);
  }
  expect(releaseRequests.some((url) => url.pathname === WORKER_RUNTIME_PATH)).toBe(false);

  const manifestRequests = requests
    .map(({ url }) => new URL(url))
    .filter((url) => url.pathname === MANIFEST_PATH);
  expect(manifestRequests).toHaveLength(1);
  expect([manifestRequests[0].search, manifestRequests[0].hash]).toEqual(["", ""]);

  const coreRequests = requests
    .map(({ url }) => new URL(url))
    .filter((url) => url.pathname === CORE_PATH);
  expect(coreRequests).toHaveLength(1);
  expect([coreRequests[0].search, coreRequests[0].hash]).toEqual(["", ""]);

  const synthesisRequests = requests
    .map(({ url }) => new URL(url))
    .filter((url) => url.pathname.startsWith("/synthesis/"));
  expect(synthesisRequests.every((url) => url.search === "" && url.hash === "")).toBe(true);
  expect(synthesisRequests.map((url) => url.pathname).sort()).toEqual([
    ...MAIN_RUNTIME_PATHS,
    MANIFEST_PATH,
    CORE_PATH,
  ].sort());
  expect(synthesisRequests.some((url) => url.pathname === PACK_PATH)).toBe(false);
  expect(synthesisRequests.some((url) => url.pathname === DIMENSIONS_PATH)).toBe(false);
  expect(await page.evaluate(() => window.__synState.manifest.releaseId)).toBe("v2");

  await expect(page.locator('link[rel="stylesheet"][href*="synthesis.css"]'))
    .toHaveAttribute("href", "synthesis/releases/v2/synthesis.css");
  await expect(page.locator('script[type="module"][src*="app.js"]'))
    .toHaveAttribute("src", "synthesis/releases/v2/app.js");
  const sourceRuntimeRequests = requests.map(({ url }) => new URL(url).pathname)
    .filter((pathname) => /^\/synthesis\/(?:[^/]+\.js|synthesis\.css)$/.test(pathname));
  expect(sourceRuntimeRequests).toEqual([]);
});
