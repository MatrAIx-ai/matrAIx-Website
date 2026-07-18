import { chromium } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const runCount = Number.parseInt(process.env.BENCH_RUNS ?? "5", 10);
if (
  !Number.isSafeInteger(runCount)
  || runCount < 1
  || runCount > 50
) {
  throw new Error("BENCH_RUNS must be an integer from 1 through 50");
}

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
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".mjs"]);
const corePath = "/synthesis/data/graph-core.v1.json";
const packPath = "/synthesis/data/sampler-pack.v2.json";
const viewport = { width: 1280, height: 900 };
const networkConditions = {
  offline: false,
  latency: 150,
  downloadThroughput: 1_600_000 / 8,
  uploadThroughput: 750_000 / 8,
  connectionType: "cellular4g",
};
const cpuThrottlingRate = 4;

function encodingQuality(header, encoding) {
  let wildcardQuality = 0;

  for (const item of String(header ?? "").split(",")) {
    const [name, ...parameters] = item.trim().split(";");
    let quality = 1;
    const qualityParameter = parameters.find((parameter) =>
      parameter.trim().toLowerCase().startsWith("q="));
    if (qualityParameter) {
      const parsed = Number(qualityParameter.trim().slice(2));
      quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
    }

    if (name.toLowerCase() === encoding) return quality;
    if (name === "*") wildcardQuality = quality;
  }

  return wildcardQuality;
}

function sendStatus(response, statusCode, message) {
  const body = Buffer.from(`${message}\n`);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": body.byteLength,
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

async function serveRequest(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendStatus(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://127.0.0.1").pathname,
    );
  } catch {
    sendStatus(response, 400, "Bad request");
    return;
  }

  if (pathname.includes("\0")) {
    sendStatus(response, 400, "Bad request");
    return;
  }
  if (pathname === "/") pathname = "/synthesis.html";

  const filePath = path.resolve(repoRoot, `.${pathname}`);
  const relativePath = path.relative(repoRoot, filePath);
  if (
    relativePath === ".."
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    sendStatus(response, 403, "Forbidden");
    return;
  }

  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      sendStatus(response, 404, "Not found");
      return;
    }
    throw error;
  }
  if (!fileStats.isFile()) {
    sendStatus(response, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const source = await readFile(filePath);
  const shouldGzip = compressibleExtensions.has(extension)
    && encodingQuality(request.headers["accept-encoding"], "gzip") > 0;
  const body = shouldGzip ? gzipSync(source, { level: 9 }) : source;
  const headers = {
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=600",
    "Content-Length": body.byteLength,
    "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
  };
  if (shouldGzip) {
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  }

  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : body);
}

function createStaticServer() {
  return createServer((request, response) => {
    serveRequest(request, response).catch(() => {
      if (response.headersSent) response.destroy();
      else sendStatus(response, 500, "Internal server error");
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    const rejectListen = (error) => reject(error);
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Benchmark server did not expose a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function measureLoad(page, operation) {
  const startedAt = performance.now();
  await operation();
  try {
    await page.waitForFunction(() => (window.__synState?.store?.nodeCount ?? 0) > 0);
  } catch (error) {
    const state = await page.evaluate(() => ({
      nodeCount: window.__synState?.store?.nodeCount ?? 0,
      status: document.querySelector("#synLoadStatus")?.getAttribute("role") ?? null,
      message: document.querySelector("#synLoadMessage")?.textContent ?? null,
      retryHidden: document.querySelector("#synRetry")?.hidden ?? null,
    })).catch(() => null);
    throw new Error(`${error.message}; page state: ${JSON.stringify(state)}`, { cause: error });
  }
  return performance.now() - startedAt;
}

async function measureGenerate(page) {
  const generateButton = page.getByRole("button", { name: "Generate personas" });
  if (await generateButton.count() === 0) return null;

  const startedAt = performance.now();
  await generateButton.click();
  await page.waitForFunction(() =>
    window.__synState?.generating === false && window.__synState?.results?.n > 0);
  return performance.now() - startedAt;
}

async function runSample(browser, origin) {
  const context = await browser.newContext({ viewport });
  const requestPathnames = [];

  try {
    await context.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await context.route("https://fonts.gstatic.com/**", (route) => route.abort());
    context.on("request", (request) => {
      try {
        requestPathnames.push(new URL(request.url()).pathname);
      } catch {
        // Ignore non-URL browser-internal requests; artifact requests are HTTP URLs.
      }
    });

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", networkConditions);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottlingRate });

    const coldLoadMs = await measureLoad(page, () => page.goto(`${origin}/synthesis.html`));
    const coldGenerateMs = await measureGenerate(page);
    const warmLoadMs = await measureLoad(page, () => page.reload());
    const warmGenerateMs = await measureGenerate(page);

    return {
      coldLoadMs,
      warmLoadMs,
      coldGenerateMs,
      warmGenerateMs,
      coreRequests: requestPathnames.filter((pathname) => pathname === corePath).length,
      packRequests: requestPathnames.filter((pathname) => pathname === packPath).length,
    };
  } finally {
    await context.close();
  }
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function validateSamples(samples) {
  const timingFields = [
    "coldLoadMs",
    "warmLoadMs",
    "coldGenerateMs",
    "warmGenerateMs",
  ];

  for (const [index, sample] of samples.entries()) {
    for (const field of timingFields) {
      const value = sample[field];
      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        throw new Error(`Sample ${index + 1} has an invalid ${field}`);
      }
    }
    for (const field of ["coreRequests", "packRequests"]) {
      const value = sample[field];
      if (!Number.isSafeInteger(value) || value < 0 || value > 1) {
        throw new Error(`Sample ${index + 1} has an invalid ${field}`);
      }
    }
  }
}

function summarize(samples) {
  const numericValues = (field) => samples
    .map((sample) => sample[field])
    .filter((value) => value !== null);

  return {
    coldLoadMs: median(numericValues("coldLoadMs")),
    warmLoadMs: median(numericValues("warmLoadMs")),
    coldGenerateMs: median(numericValues("coldGenerateMs")),
    warmGenerateMs: median(numericValues("warmGenerateMs")),
    coreRequests: median(numericValues("coreRequests")),
    packRequests: median(numericValues("packRequests")),
  };
}

async function main() {
  const server = createStaticServer();
  let browser;

  try {
    const origin = await listen(server);
    browser = await chromium.launch();
    const samples = [];
    for (let index = 0; index < runCount; index += 1) {
      samples.push(await runSample(browser, origin));
    }
    validateSamples(samples);

    console.log(JSON.stringify({
      profile: {
        viewport,
        network: networkConditions,
        cpuThrottlingRate,
      },
      samples,
      medians: summarize(samples),
    }, null, 2));
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await closeServer(server);
    }
  }
}

await main();
