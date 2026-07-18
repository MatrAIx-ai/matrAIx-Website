import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const pageGuards = new WeakMap();
const DOMAIN_CATEGORY_KEY = "category:Expertise: Domains";
const DOMAIN_ATTRIBUTE_KEY = "attribute:domain";
const MANIFEST_PATH = "/synthesis/data/manifest.v1.json";
const CORE_PATH = "/synthesis/data/graph-core.v1.json";
const MANIFEST_ROUTE = /\/synthesis\/data\/manifest\.v1\.json$/;
const CORE_ROUTE = /\/synthesis\/data\/graph-core\.v1\.json$/;
const RELEASE_RUNTIME_PATHS = [
  "app.js",
  "data-loader.js",
  "detail-rail.js",
  "dist-utils.js",
  "drilldown-graph.js",
  "graph-store.js",
  "graph-views.js",
  "overview-graph.js",
  "synthesis.css",
  "url-state.js",
].map((name) => `/synthesis/releases/v1/${name}`);
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
  ...RELEASE_RUNTIME_PATHS.map((pathname) => `${STUDIO_ORIGIN}${pathname}`),
];
const HOSTILE_IMG = '<img src=x onerror="window.__synSentinel=1">';
const HOSTILE_SCRIPT = "<script>window.__synSentinel=2</script>";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function allowHttpFailure(page, pathname, status) {
  pageGuards.get(page).expectedHttp.push({ pathname, status, expected: 1, remaining: 1 });
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
    releaseId: "v1",
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

async function activeIdentity(page) {
  return page.evaluate(() => ({
    id: document.activeElement?.id ?? "",
    key: document.activeElement?.dataset?.focusKey ?? "",
  }));
}

test.beforeEach(async ({ page }) => {
  const guard = { issues: [], resourceConsoleErrors: [], expectedHttp: [] };
  pageGuards.set(page, guard);

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const issue = `console error: ${message.text()}`;
    if (/^console error: Failed to load resource:/.test(issue)) {
      guard.resourceConsoleErrors.push(issue);
    } else guard.issues.push(issue);
  });
  page.on("pageerror", (error) => guard.issues.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    guard.issues.push(
      `request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const pathname = new URL(response.url()).pathname;
      const expected = guard.expectedHttp.find((item) =>
        item.remaining > 0 && item.status === response.status() && item.pathname === pathname);
      if (expected) expected.remaining -= 1;
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
    releaseId: "v1",
  });
  await expect(page.locator("#synLoadMessage")).toContainText("Verified snapshot");
  await expect(page.locator("#panelOverview")).toBeVisible();
  await expect(page.locator("#panelDrilldown")).toBeVisible();
  await expect(page.locator("#panelDetail")).toBeVisible();
  await expect(page.locator("#drilldownSvg")).toHaveAttribute("hidden", "");
  await expect(page.locator("#drilldownSvg")).toBeHidden();
  await expect(page.locator("#drilldownEmpty")).toBeVisible();
  await expect(page.locator("#drilldownEmpty")).toContainText("Select an attribute");
  await expect.poll(() => page.evaluate(() => ({
    centerNode: window.__synState?.centerNode,
    selectedNode: window.__synState?.selectedNode,
  }))).toEqual({ centerNode: null, selectedNode: null });
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
    setup: async (page) => page.route(MANIFEST_ROUTE, (route) => route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: '{"formatVersion":',
    })),
  },
  {
    name: "unsupported formatVersion",
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
    await scenario.setup(page);
    await expectGenericLoadFailure(page);
  });
}

test("Retry recovers an artifact failure without refetching the pinned manifest", async ({ page }) => {
  let manifestRequests = 0;
  let coreRequests = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === MANIFEST_PATH) manifestRequests += 1;
    if (pathname === CORE_PATH) coreRequests += 1;
  });
  allowHttpFailure(page, CORE_PATH, 503);
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

test("the browser fetch graph is exactly the query-free v1 release closure", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push({
    resourceType: request.resourceType(),
    url: request.url(),
  }));
  await openStudio(page);

  const codeRequests = requests.filter(({ resourceType }) =>
    resourceType === "script" || resourceType === "stylesheet");
  expect(codeRequests.map(({ url }) => url).sort()).toEqual([...SITE_CODE_URLS].sort());
  for (const url of SITE_CODE_URLS) {
    expect(codeRequests.filter((request) => request.url === url)).toHaveLength(1);
  }

  const releaseRequests = requests
    .map(({ url }) => new URL(url))
    .filter((url) => url.pathname.startsWith("/synthesis/releases/"));
  expect(releaseRequests).toHaveLength(RELEASE_RUNTIME_PATHS.length);
  expect(releaseRequests.every((url) => url.search === "" && url.hash === "")).toBe(true);
  expect(releaseRequests.map((url) => url.pathname).sort())
    .toEqual([...RELEASE_RUNTIME_PATHS].sort());
  for (const pathname of RELEASE_RUNTIME_PATHS) {
    expect(releaseRequests.filter((url) => url.pathname === pathname)).toHaveLength(1);
  }

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
    ...RELEASE_RUNTIME_PATHS,
    MANIFEST_PATH,
    CORE_PATH,
  ].sort());
  expect(await page.evaluate(() => window.__synState.manifest.releaseId)).toBe("v1");

  await expect(page.locator('link[rel="stylesheet"][href*="synthesis.css"]'))
    .toHaveAttribute("href", "synthesis/releases/v1/synthesis.css");
  await expect(page.locator('script[type="module"][src*="app.js"]'))
    .toHaveAttribute("src", "synthesis/releases/v1/app.js");
  const sourceRuntimeRequests = requests.map(({ url }) => new URL(url).pathname)
    .filter((pathname) => /^\/synthesis\/(?:[^/]+\.js|synthesis\.css)$/.test(pathname));
  expect(sourceRuntimeRequests).toEqual([]);
});
