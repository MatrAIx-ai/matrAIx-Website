import { after, test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import * as runtimeBuilder from "../scripts/build-synthesis-runtime.mjs";

const { eagerModuleClosure, previousReleaseId, runCli } = runtimeBuilder;

const temporaryRoots = [];
const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
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

function write(root, relative, bytes) {
  const path = join(root, ...relative.split("/"));
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, bytes);
}

function readJson(root, relative) {
  return JSON.parse(readFileSync(join(root, ...relative.split("/")), "utf8"));
}

function writeJson(root, relative, value) {
  write(root, relative, jsonBytes(value));
}

function replaceBytes(bytes, needle, replacement) {
  const start = bytes.indexOf(Buffer.from(needle));
  assert.notEqual(start, -1, `fixture bytes must contain ${needle}`);
  return Buffer.concat([
    bytes.subarray(0, start),
    Buffer.from(replacement),
    bytes.subarray(start + Buffer.byteLength(needle)),
  ]);
}

function assertNoReleaseWork(root, expected = []) {
  const releases = join(root, "synthesis", "releases");
  assert.deepEqual(existsSync(releases) ? readdirSync(releases).sort() : [], expected);
}

function moveArtifact(root, name, path, bytes = null) {
  const manifest = readJson(root, "synthesis/data/manifest.v1.json");
  const previous = manifest.artifacts[name];
  const artifactBytes = bytes ?? readFileSync(join(root, ...previous.path.split("/")));
  write(root, path, artifactBytes);
  manifest.artifacts[name] = {
    path,
    sha256: sha256(artifactBytes),
    bytes: artifactBytes.byteLength,
  };
  writeJson(root, "synthesis/data/manifest.v1.json", manifest);
}

function addArtifact(root, name, path, value) {
  const bytes = jsonBytes(value);
  const manifest = readJson(root, "synthesis/data/manifest.v1.json");
  write(root, path, bytes);
  manifest.artifacts[name] = { path, sha256: sha256(bytes), bytes: bytes.byteLength };
  writeJson(root, "synthesis/data/manifest.v1.json", manifest);
}

function parseTagAttributes(source) {
  const attributes = new Map();
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (attributes.has(name)) throw new Error(`duplicate HTML attribute: ${name}`);
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function startTags(html, tagName) {
  const tags = [];
  const source = html.replace(/<!--[\s\S]*?-->/g, "");
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  for (const match of source.matchAll(pattern)) tags.push(parseTagAttributes(match[1]));
  return tags;
}

function isFeatureAsset(value, filename) {
  if (typeof value !== "string") return false;
  const pathname = value.split(/[?#]/, 1)[0];
  return pathname === filename || pathname.endsWith(`/${filename}`);
}

function assertHtmlRuntimeEntries(html, releaseId) {
  const stylesheets = startTags(html, "link")
    .filter((attrs) => (attrs.get("rel") ?? "").toLowerCase().split(/\s+/).includes("stylesheet"))
    .map((attrs) => attrs.get("href"))
    .filter((href) => isFeatureAsset(href, "synthesis.css"));
  const modules = startTags(html, "script")
    .filter((attrs) => (attrs.get("type") ?? "").toLowerCase() === "module")
    .map((attrs) => attrs.get("src"))
    .filter((src) => isFeatureAsset(src, "app.js"));
  assert.equal(stylesheets.length, 1, "HTML must have exactly one feature stylesheet");
  assert.equal(modules.length, 1, "HTML must have exactly one feature module entry");

  const root = `synthesis/releases/${releaseId}`;
  const css = stylesheets[0];
  const app = modules[0];
  assert.equal(css, `${root}/synthesis.css`);
  assert.equal(app, `${root}/app.js`);
  assert.equal(css.split("/").slice(0, -1).join("/"), app.split("/").slice(0, -1).join("/"));
  assert.doesNotMatch(css, /[?#]/);
  assert.doesNotMatch(app, /[?#]/);
  return { css, app };
}

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

function makeFixture({ app, css, generator, files, extraSources = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "synthesis-runtime-"));
  temporaryRoots.push(root);
  const datasetId = `sha256:${"a".repeat(64)}`;
  const generatorBytes = Buffer.from(generator
    ?? 'import { readFileSync } from "node:fs";\nexport { readFileSync };\n');
  const generatorSha = sha256(generatorBytes);
  const generatorPath = `scripts/build-synthesis-data.${generatorSha}.mjs`;
  const coreBytes = jsonBytes({
    formatVersion: 1,
    datasetId,
    nodes: [],
    edges: [],
    topologicalOrder: [],
  });
  const manifest = {
    formatVersion: 1,
    releaseId: "v1",
    datasetId,
    source: {
      repo: "example/repo",
      commit: "b".repeat(40),
      fullDagSha256: "a".repeat(64),
    },
    generator: {
      path: generatorPath,
      sha256: generatorSha,
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

  write(root, generatorPath, generatorBytes);
  write(root, "synthesis/data/graph-core.v1.json", coreBytes);
  writeJson(root, "synthesis/data/manifest.v1.json", manifest);
  write(root, "synthesis/app.js", Buffer.from(app ?? validApp(
    'import "./dep.js";',
    '// import "./comment-only.js"',
    'const harmless = "import(\\"./string-only.js\\")";',
    'const template = `import("./template-only.js") ${1}`;',
    'export { harmless, template };',
  )));
  write(root, "synthesis/data-loader.js", Buffer.from([
    "export async function loadManifest() {}",
    "export function startArtifactRequest() {}",
    "",
  ].join("\n")));
  write(root, "synthesis/dep.js", Buffer.from("export const dependency = true;\n"));
  write(root, "synthesis.css", Buffer.from(css ?? ".fixture { color: currentColor; }\n"));
  for (const [relative, bytes] of Object.entries(extraSources)) {
    write(root, relative, Buffer.from(bytes));
  }
  writeJson(root, "scripts/synthesis-runtime-files.json", {
    formatVersion: 1,
    releases: {
      v1: {
        files: files ?? [
          { source: "synthesis/app.js", target: "app.js" },
          { source: "synthesis/data-loader.js", target: "data-loader.js" },
          { source: "synthesis/dep.js", target: "dep.js" },
          { source: "synthesis.css", target: "synthesis.css" },
        ],
      },
    },
  });
  return root;
}

const run = (root, ...argv) => runCli(argv, { repoRoot: root });

async function buildFixture(options) {
  const root = makeFixture(options);
  await run(root, "--release", "v1", "--write");
  return root;
}

function addV2(root, { corePath = "synthesis/data/graph-core.v2.json" } = {}) {
  const v1Manifest = readJson(root, "synthesis/data/manifest.v1.json");
  const coreBytes = readFileSync(join(root, "synthesis", "data", "graph-core.v1.json"));
  if (corePath === "synthesis/data/graph-core.v2.json") {
    write(root, corePath, coreBytes);
  }
  const v2Manifest = structuredClone(v1Manifest);
  v2Manifest.releaseId = "v2";
  v2Manifest.artifacts.core.path = corePath;
  writeJson(root, "synthesis/data/manifest.v2.json", v2Manifest);
  write(root, "synthesis/v2-app.js", Buffer.from([
    loaderImport,
    'import "./dep.js";',
    coreBinding(corePath),
    releaseBinding("v2"),
    "",
  ].join("\n")));
  const config = readJson(root, "scripts/synthesis-runtime-files.json");
  config.releases.v2 = {
    files: [
      { source: "synthesis/v2-app.js", target: "app.js" },
      { source: "synthesis/data-loader.js", target: "data-loader.js" },
      { source: "synthesis/dep.js", target: "dep.js" },
      { source: "synthesis.css", target: "synthesis.css" },
    ],
  };
  writeJson(root, "scripts/synthesis-runtime-files.json", config);
}

async function rejects(root, argv, pattern) {
  await assert.rejects(() => runCli(argv, { repoRoot: root }), pattern);
}

function releaseNames(root) {
  const releases = join(root, "synthesis", "releases");
  return existsSync(releases) ? readdirSync(releases).sort() : [];
}

test("CLI is strict and importing the builder does not execute it", async () => {
  const root = makeFixture();
  assert.equal(existsSync(join(root, "synthesis", "releases", "v1")), false);
  for (const [argv, pattern] of [
    [[], /exactly one --release/i],
    [["--release"], /missing value/i],
    [["--release", "v1"], /exactly one mode/i],
    [["--release", "v1", "--write", "--check"], /exactly one mode/i],
    [["--release", "v1", "--write", "--write"], /repeated/i],
    [["--release", "v1", "--write", "--root", root], /unknown flag/i],
    [["--release", "v0", "--check"], /release/i],
    [["--release", "v2", "--check"], /not configured/i],
  ]) await rejects(root, argv, pattern);
  assert.equal(existsSync(join(root, "synthesis", "releases", "v1")), false);
});

test("write is immutable; check is source-independent; check-source detects drift", async () => {
  const root = await buildFixture();
  await run(root, "--release", "v1", "--check");
  await run(root, "--release", "v1", "--check-source");
  await rejects(root, ["--release", "v1", "--write"], /already exists/i);

  const lockPath = join(root, "synthesis", "releases", "v1", "release-lock.json");
  const before = readFileSync(lockPath);
  const lock = JSON.parse(before);
  assert.equal(lock.formatVersion, 1);
  assert.equal(lock.releaseId, "v1");
  assert.equal(lock.predecessor, null);
  assert.deepEqual(lock.runtime.map((entry) => entry.path), [
    "app.js",
    "data-loader.js",
    "dep.js",
    "synthesis.css",
  ]);
  assert.deepEqual(lock.data.artifacts.map((entry) => entry.name), ["core"]);
  assert.ok(/^[0-9a-f]{64}$/.test(lock.allowlistSha256));

  write(root, "synthesis/app.js", Buffer.from("mutable source drift\n"));
  await run(root, "--release", "v1", "--check");
  await rejects(root, ["--release", "v1", "--check-source"], /source differs/i);
  assert.deepEqual(readFileSync(lockPath), before);

  const config = readJson(root, "scripts/synthesis-runtime-files.json");
  config.releases.v2 = { files: [{ source: "elsewhere.js", target: "app.js" }] };
  writeJson(root, "scripts/synthesis-runtime-files.json", config);
  await run(root, "--release", "v1", "--check");
  assert.equal(readJson(root, "synthesis/releases/v1/release-lock.json").allowlistSha256,
    lock.allowlistSha256);

  config.releases.v1.files = config.releases.v1.files
    .map(({ source, target }) => ({ target, source }));
  writeJson(root, "scripts/synthesis-runtime-files.json", config);
  await run(root, "--release", "v1", "--check");
  assert.equal(readJson(root, "synthesis/releases/v1/release-lock.json").allowlistSha256,
    lock.allowlistSha256);
});

test("v2 locks bind the exact v1 predecessor and huge release IDs stay precise", async () => {
  assert.equal(previousReleaseId("v2"), "v1");
  assert.equal(previousReleaseId("v9007199254740993"), "v9007199254740992");
  const root = await buildFixture();
  addV2(root);
  await run(root, "--release", "v2", "--write");
  await run(root, "--release", "v2", "--check");
  const lock = readJson(root, "synthesis/releases/v2/release-lock.json");
  assert.deepEqual(Object.keys(lock.predecessor), ["releaseId", "path", "bytes", "sha256"]);
  assert.equal(lock.predecessor.releaseId, "v1");
  assert.equal(lock.predecessor.path, "synthesis/releases/v1/release-lock.json");

  lock.predecessor.releaseId = "v999";
  writeJson(root, "synthesis/releases/v2/release-lock.json", lock);
  await rejects(root, ["--release", "v2", "--check"], /predecessor|lock mismatch/i);
});

test("tokenized closure accepts every supported literal JS/CSS dependency form deterministically", async () => {
  const files = [
    { source: "synthesis/app.js", target: "app.js" },
    { source: "synthesis/asset.txt", target: "asset.txt" },
    { source: "synthesis/data-loader.js", target: "data-loader.js" },
    { source: "synthesis/dep.js", target: "dep.js" },
    { source: "synthesis/dynamic.js", target: "dynamic.js" },
    { source: "synthesis/reexport.js", target: "reexport.js" },
    { source: "synthesis/shared.js", target: "shared.js" },
    { source: "synthesis.css", target: "synthesis.css" },
    { source: "synthesis/texture.svg", target: "texture.svg" },
    { source: "synthesis/theme.css", target: "theme.css" },
    { source: "synthesis/worker.js", target: "worker.js" },
  ];
  const options = {
    files,
    app: [
      loaderImport,
      'import "./dep.js";',
      'export { reexported } from "./reexport.js";',
      'const lazy = () => import("./dynamic.js");',
      'const asset = new URL("./asset.txt", import.meta.url).href;',
      'const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });',
      'const shared = new SharedWorker(new URL("./shared.js", import.meta.url));',
      '// import "./comment-only.js"',
      'const harmless = "new Worker(\\"./string-only.js\\")";',
      'const template = `import("./template-only.js") ${asset}`;',
      coreBinding(),
      releaseBinding(),
      'export { lazy, asset, worker, shared, harmless, template };',
      "",
    ].join("\n"),
    css: [
      '/* url("./comment-only.svg") */',
      '@import "./theme.css";',
      '.fixture::before { content: "url(\\"./string-only.svg\\")"; }',
      '.fixture { background: url("./texture.svg"); }',
      "",
    ].join("\n"),
    extraSources: {
      "synthesis/asset.txt": "asset\n",
      "synthesis/dynamic.js": "export const dynamic = true;\n",
      "synthesis/reexport.js": "export const reexported = true;\n",
      "synthesis/shared.js": "self.onconnect = () => {};\n",
      "synthesis/theme.css": ".theme { background: url(data:image/gif;base64,AAAA); }\n",
      "synthesis/texture.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n",
      "synthesis/worker.js": "self.onmessage = () => {};\n",
    },
  };
  const first = await buildFixture(options);
  const second = await buildFixture(options);
  await run(first, "--release", "v1", "--check");
  await run(second, "--release", "v1", "--check");
  const firstLock = readFileSync(join(first, "synthesis", "releases", "v1", "release-lock.json"));
  const secondLock = readFileSync(join(second, "synthesis", "releases", "v1", "release-lock.json"));
  assert.deepEqual(firstLock, secondLock);
  const lockText = firstLock.toString("utf8");
  assert.doesNotMatch(lockText, /synthesis-runtime-|\.tmp-|timestamp|createdAt|updatedAt/i);
  assert.doesNotMatch(lockText, /(?:^|\")\/(?:tmp|data2|home)\//);
});

test("eager module closure excludes dynamic imports and Worker entries", () => {
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
});

test("app/data binding requires exactly one structural loadManifest call", async (t) => {
  const cases = [
    ["complete call in a comment", [
      loaderImport,
      'import "./dep.js";',
      '/* loadManifest( "synthesis/data/manifest.v1.json", { expectedReleaseId: "v1" }); */',
      coreBinding(),
      "",
    ].join("\n")],
    ["complete call in a string", [
      loaderImport,
      'import "./dep.js";',
      'const fake = \'loadManifest( "synthesis/data/manifest.v1.json", { expectedReleaseId: "v1" });\';',
      coreBinding(),
      "",
    ].join("\n")],
    ["comments and unrelated strings", validApp(
      'import "./dep.js";',
      '/* synthesis/data/manifest.v1.json expectedReleaseId: "v1" */',
      'const manifestPath = "synthesis/data/manifest.v1.json";',
      'const decoy = { expectedReleaseId: "v1" };',
    ).replace(releaseBinding(), "")],
    ["duplicate real calls", validApp(
      'import "./dep.js";',
      releaseBinding(),
    )],
    ["correct v1 plus wrong v2 real call", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["real v2 call plus v1 comment decoys", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
      '/* synthesis/data/manifest.v1.json expectedReleaseId: "v1" */',
    ).replace(releaseBinding(), "")],
    ["dynamic first argument plus string decoy", validApp(
      'import "./dep.js";',
      'const path = "synthesis/data/manifest.v1.json";',
      'loadManifest(path, { expectedReleaseId: "v1" });',
    ).replace(releaseBinding(), "")],
    ["expectedReleaseId outside the call", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v1.json", { signal: null });',
      'const decoy = { expectedReleaseId: "v1" };',
    ).replace(releaseBinding(), "")],
    ["duplicate expectedReleaseId property", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v1.json", { expectedReleaseId: "v1", expectedReleaseId: "v1" });',
    ).replace(releaseBinding(), "")],
    ["spread shadows expectedReleaseId", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v1.json", { expectedReleaseId: "v1", ...{ expectedReleaseId: "v2" } });',
    ).replace(releaseBinding(), "")],
    ["computed key shadows expectedReleaseId", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v1.json", { expectedReleaseId: "v1", ["expectedReleaseId"]: "v2" });',
    ).replace(releaseBinding(), "")],
    ["getter shadows expectedReleaseId", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v1.json", { expectedReleaseId: "v1", get expectedReleaseId() { return "v2"; } });',
    ).replace(releaseBinding(), "")],
    ["method shadows expectedReleaseId", validApp(
      'import "./dep.js";',
      'loadManifest("synthesis/data/manifest.v1.json", { expectedReleaseId: "v1", expectedReleaseId() { return "v2"; } });',
    ).replace(releaseBinding(), "")],
    ["loadManifest.call after the direct call", validApp(
      'import "./dep.js";',
      'loadManifest.call(null, "synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["loadManifest alias after the direct call", validApp(
      'import "./dep.js";',
      'const lm = loadManifest;',
      'lm("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader["loadManifest"]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["escaped computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader["load\\u004danifest"]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["concatenated computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader["load" + "Manifest"]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["optional computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader?.["loadManifest"]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["template computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader[`loadManifest`]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["conditional computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader[flag ? "loadManifest" : "other"]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["parenthesized template computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader[(`loadManifest`)]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
    ["parenthesized concatenated computed loadManifest member after the direct call", validApp(
      'import "./dep.js";',
      'loader[("load" + "Manifest")]("synthesis/data/manifest.v2.json", { expectedReleaseId: "v2" });',
    )],
  ];

  for (const [label, app] of cases) {
    await t.test(label, async () => {
      const root = makeFixture({ app });
      await rejects(root, ["--release", "v1", "--write"],
        /loadManifest|manifest|release binding|expectedReleaseId|computed|escaped|unsupported/i);
      assertNoReleaseWork(root);
    });
  }
});

test("app binding requires one imported startArtifactRequest core path before loadManifest", async (t) => {
  const valid = validApp('import "./dep.js";');
  const cases = [
    ["missing startArtifactRequest", valid.replace(coreBinding(), "")],
    ["duplicate startArtifactRequest", validApp(
      'import "./dep.js";',
      coreBinding(),
    )],
    ["aliased startArtifactRequest", validApp(
      'import "./dep.js";',
      "const startCore = startArtifactRequest;",
    )],
    ["member startArtifactRequest", validApp(
      'import "./dep.js";',
      `startArtifactRequest.call(null, "synthesis/data/graph-core.v1.json", {});`,
    )],
    ["computed startArtifactRequest", validApp(
      'import "./dep.js";',
      `loader["startArtifactRequest"]("synthesis/data/graph-core.v1.json", {});`,
    )],
    ["dynamic core path", validApp(
      'import "./dep.js";',
      'const corePath = "synthesis/data/graph-core.v1.json";',
      "const coreRequest = startArtifactRequest(corePath, { signal: undefined });",
    ).replace(coreBinding(), "")],
    ["wrong core path", valid.replace(
      coreBinding(),
      coreBinding("synthesis/data/graph-core.v2.json"),
    )],
    ["core request after loadManifest", [
      loaderImport,
      'import "./dep.js";',
      releaseBinding(),
      coreBinding(),
      "",
    ].join("\n")],
    ["missing loadManifest named import", valid.replace(
      loaderImport,
      'import { startArtifactRequest } from "./data-loader.js";',
    )],
    ["missing startArtifactRequest named import", valid.replace(
      loaderImport,
      'import { loadManifest } from "./data-loader.js";',
    )],
  ];

  for (const [label, app] of cases) {
    await t.test(label, async () => {
      const root = makeFixture({ app });
      await rejects(root, ["--release", "v1", "--write"],
        /startArtifactRequest|core|binding|path|import|reference|computed/i);
      assertNoReleaseWork(root);
    });
  }

  await t.test("v2 binding cannot invent a v2 core when validated data reuses v1", async () => {
    const root = await buildFixture();
    addV2(root, { corePath: "synthesis/data/graph-core.v1.json" });
    write(root, "synthesis/v2-app.js", Buffer.from([
      loaderImport,
      'import "./dep.js";',
      coreBinding("synthesis/data/graph-core.v2.json"),
      releaseBinding("v2"),
      "",
    ].join("\n")));
    await rejects(root, ["--release", "v2", "--write"],
      /startArtifactRequest|core|binding|path/i);
    assertNoReleaseWork(root, ["v1"]);
  });
});

test("v2 app binding accepts the validated v1 core path", async () => {
  const root = await buildFixture();
  addV2(root, { corePath: "synthesis/data/graph-core.v1.json" });
  await run(root, "--release", "v2", "--write");
  await run(root, "--release", "v2", "--check");
  assert.equal(readJson(root, "synthesis/releases/v2/release-lock.json")
    .data.artifacts.find(({ name }) => name === "core")?.path,
  "synthesis/data/graph-core.v1.json");
});

test("Worker and generic import-meta URL syntax fail closed outside the exact wrapper", async (t) => {
  const cases = [
    ["direct Worker literal", 'new Worker("./dep.js");'],
    ["direct SharedWorker literal", 'new SharedWorker("./dep.js");'],
    ["direct Worker concatenation", 'new Worker("./dep.js" + "?outside-release");'],
    ["Worker wrapper first-argument concatenation",
      'new Worker(new URL("./dep.js" + suffix, import.meta.url));'],
    ["generic URL first-argument concatenation",
      'new URL("./dep.js" + suffix, import.meta.url);'],
    ["generic URL base concatenation", 'new URL("./dep.js", import.meta.url + suffix);'],
    ["generic URL extra base expression", 'new URL("./dep.js", import.meta.url, suffix);'],
    ["Worker inner URL result concatenation",
      'new Worker(new URL("./dep.js", import.meta.url) + suffix);'],
    ["Worker inner URL member result",
      'new Worker(new URL("./dep.js", import.meta.url).href);'],
    ["Worker third argument",
      'new Worker(new URL("./dep.js", import.meta.url), { type: "module" }, extra);'],
    ["Worker member reference", 'new globalThis.Worker("./missing-worker.js");'],
    ["Worker alias reference", 'const W = Worker; new W("./missing-worker.js");'],
    ["computed global Worker", 'globalThis["Worker"]("./missing-worker.js");'],
    ["computed global SharedWorker", 'globalThis["SharedWorker"]("./missing-worker.js");'],
    ["computed global Worker alias",
      'const W = globalThis["Worker"]; new W("./missing-worker.js");'],
    ["optional computed aliased-global Worker",
      'const g = globalThis; g?.["Worker"]("./missing-worker.js");'],
    ["dynamic global Worker member",
      'window["Wor" + "ker"]("./missing-worker.js");'],
    ["computed global URL resource",
      'new globalThis["URL"]("./missing-worker.js", import.meta.url);'],
    ["parenthesized computed global URL resource",
      'new (globalThis)["URL"]("./missing-worker.js", import.meta.url);'],
    ["computed aliased-global URL resource",
      'const g = globalThis; new g["URL"]("./missing-worker.js", import.meta.url);'],
    ["parenthesized template computed global Worker",
      'new (globalThis)[(`Worker`)]("./missing-worker.js");'],
    ["parenthesized concatenated computed global Worker",
      'new (globalThis)[("Wor" + "ker")]("./missing-worker.js");'],
    ["static global URL member",
      'new globalThis.URL("./missing-worker.js", import.meta.url);'],
    ["bare URL alias",
      'const U = URL; new U("./missing-worker.js", import.meta.url);'],
    ["unconsumed import-meta URL base alias",
      'const base = import.meta.url; new URL("./missing-worker.js", base);'],
    ["computed import-meta URL property",
      'new URL("./missing-worker.js", import.meta["url"]);'],
  ];

  for (const [label, statement] of cases) {
    await t.test(label, async () => {
      const root = makeFixture({ app: validApp('import "./dep.js";', statement) });
      await rejects(root, ["--release", "v1", "--write"], /Worker|SharedWorker|new URL|import\.meta\.url|unsupported|suffix/i);
      assertNoReleaseWork(root);
    });
  }
});

test("config paths and target collisions fail closed before destination work", async () => {
  const cases = [
    ["source", "../escape.js", /canonical|path/i],
    ["source", "/absolute.js", /canonical|path/i],
    ["source", "synthesis\\app.js", /canonical|path/i],
    ["source", "synthesis/app.js?x=1", /canonical|path/i],
    ["source", "synthesis/%61pp.js", /canonical|path/i],
    ["target", "release-lock.json", /reserved/i],
  ];
  for (const [field, value, pattern] of cases) {
    const root = makeFixture();
    const config = readJson(root, "scripts/synthesis-runtime-files.json");
    config.releases.v1.files[0][field] = value;
    writeJson(root, "scripts/synthesis-runtime-files.json", config);
    await rejects(root, ["--release", "v1", "--write"], pattern);
    assert.deepEqual(releaseNames(root), []);
  }

  for (const targets of [["A.js", "a.js"], ["a", "a/b.js"]]) {
    const root = makeFixture();
    const config = readJson(root, "scripts/synthesis-runtime-files.json");
    config.releases.v1.files[0].target = targets[0];
    config.releases.v1.files[1].target = targets[1];
    config.releases.v1.files.sort((a, b) => a.target.localeCompare(b.target));
    writeJson(root, "scripts/synthesis-runtime-files.json", config);
    await rejects(root, ["--release", "v1", "--write"], /collision/i);
    assert.deepEqual(releaseNames(root), []);
  }

  const root = makeFixture();
  const config = readJson(root, "scripts/synthesis-runtime-files.json");
  config.releases.v1.unknown = true;
  writeJson(root, "scripts/synthesis-runtime-files.json", config);
  await rejects(root, ["--release", "v1", "--write"], /unknown field/i);
});

test("canonical config paths reject leading/trailing whitespace and non-NFC text", async (t) => {
  const cases = [
    ["leading source whitespace", " synthesis/dep.js", "dep.js", 'import "./dep.js";'],
    ["trailing source whitespace", "synthesis/dep.js ", "dep.js", 'import "./dep.js";'],
    ["leading target whitespace", "synthesis/dep.js", " dep.js", 'import "./ dep.js";'],
    ["trailing target whitespace", "synthesis/dep.js", "dep.js ", 'import "./dep.js ";'],
    ["non-NFC source", "synthesis/de\u0301p.js", "dep.js", 'import "./dep.js";'],
    ["non-NFC target", "synthesis/dep.js", "de\u0301p.js", 'import "./de\u0301p.js";'],
  ];

  for (const [label, source, target, importLine] of cases) {
    await t.test(label, async () => {
      const root = makeFixture({ app: validApp(importLine) });
      if (source !== "synthesis/dep.js") {
        write(root, source, readFileSync(join(root, "synthesis", "dep.js")));
      }
      const config = readJson(root, "scripts/synthesis-runtime-files.json");
      const depIndex = config.releases.v1.files.findIndex((file) => file.target === "dep.js");
      assert.notEqual(depIndex, -1);
      config.releases.v1.files[depIndex] = { source, target };
      config.releases.v1.files.sort((a, b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
      writeJson(root, "scripts/synthesis-runtime-files.json", config);
      await rejects(root, ["--release", "v1", "--write"], /canonical|whitespace|NFC|normal form/i);
      assertNoReleaseWork(root);
    });
  }
});

test("JSON inputs reject invalid UTF-8 before creating release work", async (t) => {
  await t.test("config", async () => {
    const root = makeFixture();
    const path = join(root, "scripts", "synthesis-runtime-files.json");
    const invalid = replaceBytes(readFileSync(path), "synthesis/dep.js",
      Buffer.concat([Buffer.from("synthesis/"), Buffer.from([0xff]), Buffer.from("ep.js")]));
    write(root, "synthesis/�ep.js", readFileSync(join(root, "synthesis", "dep.js")));
    writeFileSync(path, invalid);
    await rejects(root, ["--release", "v1", "--write"], /UTF-8/i);
    assertNoReleaseWork(root);
  });

  await t.test("manifest", async () => {
    const root = makeFixture();
    const path = join(root, "synthesis", "data", "manifest.v1.json");
    writeFileSync(path, replaceBytes(readFileSync(path), "example/repo",
      Buffer.concat([Buffer.from("example/"), Buffer.from([0xff]), Buffer.from("repo")])))
    await rejects(root, ["--release", "v1", "--write"], /UTF-8/i);
    assertNoReleaseWork(root);
  });

  await t.test("artifact", async () => {
    const root = makeFixture();
    const corePath = join(root, "synthesis", "data", "graph-core.v1.json");
    const core = readJson(root, "synthesis/data/graph-core.v1.json");
    core.note = "invalid-marker";
    const invalid = replaceBytes(jsonBytes(core), "invalid-marker",
      Buffer.concat([Buffer.from("invalid-"), Buffer.from([0xff]), Buffer.from("marker")]));
    writeFileSync(corePath, invalid);
    const manifest = readJson(root, "synthesis/data/manifest.v1.json");
    manifest.artifacts.core.bytes = invalid.byteLength;
    manifest.artifacts.core.sha256 = sha256(invalid);
    writeJson(root, "synthesis/data/manifest.v1.json", manifest);
    await rejects(root, ["--release", "v1", "--write"], /UTF-8/i);
    assertNoReleaseWork(root);
  });

  await t.test("release lock", async () => {
    const root = await buildFixture();
    const lockPath = join(root, "synthesis", "releases", "v1", "release-lock.json");
    writeFileSync(lockPath, replaceBytes(readFileSync(lockPath), "18.19.1",
      Buffer.concat([Buffer.from([0xff]), Buffer.from("8.19.1")])))
    await rejects(root, ["--release", "v1", "--check"], /UTF-8/i);
  });
});

test("artifact descriptors enforce key-specific immutable positive-byte paths", async (t) => {
  const datasetId = `sha256:${"a".repeat(64)}`;
  const cases = [
    ["mutable core name", (root) => moveArtifact(root, "core", "synthesis/data/core.json"), /immutable|filename/i],
    ["core v0 name", (root) => moveArtifact(root, "core", "synthesis/data/graph-core.v0.json"), /immutable|filename/i],
    ["mutable pack name", (root) => addArtifact(root, "pack", "synthesis/data/pack.json", { datasetId }), /immutable|filename/i],
    ["pack v01 name", (root) => addArtifact(root, "pack", "synthesis/data/sampler-pack.v01.json", { datasetId }), /immutable|filename/i],
    ["mutable dimensions name", (root) => addArtifact(root, "dimensions", "synthesis/data/dimensions.v1.json", { rows: [] }), /immutable|filename/i],
    ["15-digit dimensions name", (root) => addArtifact(root, "dimensions", `synthesis/data/dimensions.${"a".repeat(15)}.json`, { rows: [] }), /immutable|filename/i],
    ["65-digit dimensions name", (root) => addArtifact(root, "dimensions", `synthesis/data/dimensions.${"a".repeat(65)}.json`, { rows: [] }), /immutable|filename/i],
    ["uppercase dimensions name", (root) => addArtifact(root, "dimensions", `synthesis/data/dimensions.${"A".repeat(16)}.json`, { rows: [] }), /immutable|filename/i],
    ["padded artifact path", (root) => moveArtifact(root, "core", "synthesis/data/graph-core.v1.json "), /canonical|whitespace/i],
    ["zero-byte artifact", (root) => moveArtifact(root, "core", "synthesis/data/graph-core.v1.json", Buffer.alloc(0)), /bytes.*positive|positive.*bytes/i],
  ];

  for (const [label, mutate, pattern] of cases) {
    await t.test(label, async () => {
      const root = makeFixture();
      mutate(root);
      await rejects(root, ["--release", "v1", "--write"], pattern);
      assertNoReleaseWork(root);
    });
  }
});

test("artifact policy accepts immutable pack/dimensions and v2 reuse of a v1 core", async () => {
  const datasetId = `sha256:${"a".repeat(64)}`;
  const withOptionalArtifacts = makeFixture();
  addArtifact(withOptionalArtifacts, "pack", "synthesis/data/sampler-pack.v9.json", { datasetId });
  addArtifact(withOptionalArtifacts, "dimensions",
    `synthesis/data/dimensions.${"a".repeat(16)}.json`, { rows: [] });
  await run(withOptionalArtifacts, "--release", "v1", "--write");
  await run(withOptionalArtifacts, "--release", "v1", "--check");
  assert.deepEqual(readJson(withOptionalArtifacts, "synthesis/releases/v1/release-lock.json")
    .data.artifacts.map((entry) => entry.name).sort(), ["core", "dimensions", "pack"]);

  const maxDimensions = makeFixture();
  addArtifact(maxDimensions, "dimensions",
    `synthesis/data/dimensions.${"f".repeat(64)}.json`, { rows: [] });
  await run(maxDimensions, "--release", "v1", "--write");
  await run(maxDimensions, "--release", "v1", "--check");

  const reusedCore = await buildFixture();
  addV2(reusedCore, { corePath: "synthesis/data/graph-core.v1.json" });
  await run(reusedCore, "--release", "v2", "--write");
  await run(reusedCore, "--release", "v2", "--check");
  assert.equal(readJson(reusedCore, "synthesis/releases/v2/release-lock.json")
    .data.artifacts[0].path, "synthesis/data/graph-core.v1.json");
});

test("JavaScript and CSS resource-token escapes fail closed outside inert text", async (t) => {
  const cases = [
    ["escaped Worker identifier", { app: validApp('import "./dep.js";', 'new Wor\\u006ber("./missing-worker.js");') }],
    ["escaped CSS url identifier", { css: '.x { background: u\\72l("./missing.svg"); }\n' }],
    ["escaped CSS import identifier", { css: '@\\69mport "./missing.css";\n' }],
  ];
  for (const [label, options] of cases) {
    await t.test(label, async () => {
      const root = makeFixture(options);
      await rejects(root, ["--release", "v1", "--write"], /escape|token|Worker|CSS/i);
      assertNoReleaseWork(root);
    });
  }
});

test("generator validation rejects node:module, createRequire, and CommonJS resource loads", async (t) => {
  const cases = [
    ["node:module import", 'import "node:module";\n'],
    ["createRequire missing helper", [
      'import { createRequire } from "node:module";',
      'const require = createRequire(import.meta.url);',
      'require("./not-committed.cjs");',
      "",
    ].join("\n")],
    ["CommonJS require missing helper", [
      'import { readFileSync } from "node:fs";',
      'require("./not-committed.cjs");',
      "",
    ].join("\n")],
  ];
  for (const [label, generator] of cases) {
    await t.test(label, async () => {
      const root = makeFixture({ generator });
      await rejects(root, ["--release", "v1", "--write"], /generator|node:module|createRequire|require/i);
      assertNoReleaseWork(root);
    });
  }
});

test("nested runtime trees are compared after global path sorting", async () => {
  const files = [
    { source: "synthesis/a-foo.js", target: "a-foo.js" },
    { source: "synthesis/a-b.js", target: "a/b.js" },
    { source: "synthesis/app.js", target: "app.js" },
    { source: "synthesis/data-loader.js", target: "data-loader.js" },
    { source: "synthesis.css", target: "synthesis.css" },
  ];
  const root = await buildFixture({
    files,
    app: validApp('import "./a-foo.js";', 'import "./a/b.js";'),
    extraSources: {
      "synthesis/a-foo.js": "export const foo = true;\n",
      "synthesis/a-b.js": "export const nested = true;\n",
    },
  });
  await run(root, "--release", "v1", "--check");
  assert.deepEqual(readJson(root, "synthesis/releases/v1/release-lock.json")
    .runtime.map((entry) => entry.path), [
      "a-foo.js",
      "a/b.js",
      "app.js",
      "data-loader.js",
      "synthesis.css",
    ]);
});

test("filesystem identity helper distinguishes a path replacement", () => {
  assert.equal(typeof runtimeBuilder.sameFilesystemIdentity, "function");
  const root = mkdtempSync(join(tmpdir(), "synthesis-runtime-identity-"));
  temporaryRoots.push(root);
  const owned = join(root, "owned");
  const moved = join(root, "moved");
  mkdirSync(owned);
  const identity = lstatSync(owned);
  assert.equal(runtimeBuilder.sameFilesystemIdentity(identity, lstatSync(owned)), true);
  renameSync(owned, moved);
  mkdirSync(owned);
  write(root, "owned/sentinel", Buffer.from("keep\n"));
  assert.equal(runtimeBuilder.sameFilesystemIdentity(identity, lstatSync(owned)), false);
  assert.equal(readFileSync(join(owned, "sentinel"), "utf8"), "keep\n");
});

test("JS and CSS dependency closure rejects missing, unreachable, and non-literal resources", async () => {
  const cases = [
    [{ app: validApp('import "./missing.js";') }, /missing|configured/i],
    [{ files: [
      { source: "synthesis/app.js", target: "app.js" },
      { source: "synthesis/data-loader.js", target: "data-loader.js" },
      { source: "synthesis/dep.js", target: "dep.js" },
      { source: "synthesis/ghost.js", target: "ghost.js" },
      { source: "synthesis.css", target: "synthesis.css" },
    ] }, /unreachable/i],
    [{ app: validApp('const p="./dep.js"; import(p);') }, /non-literal dynamic import/i],
    [{ app: validApp('const x = `${import("./missing.js")}`;') }, /missing|configured/i],
    [{ app: validApp('const p="./dep.js"; new Worker(p);') }, /Worker/i],
    [{ app: validApp('import "./dep.js"; const p="./dep.js"; const base=location.href; new Worker(new URL(p, base));') }, /Worker|new URL|literal/i],
    [{ app: validApp('import "./dep.js"; const base=location.href; new SharedWorker(new URL("./dep.js", base));') }, /SharedWorker|new URL|import\.meta\.url/i],
    [{ css: '@import "./missing.css";\n' }, /missing|configured/i],
    [{ css: '.x { background: url("./missing.svg"); }\n' }, /missing|configured/i],
  ];
  for (const [options, pattern] of cases) {
    const root = makeFixture(options);
    if (options.files?.some((entry) => entry.target === "ghost.js")) {
      write(root, "synthesis/ghost.js", Buffer.from("export const ghost = true;\n"));
    }
    await rejects(root, ["--release", "v1", "--write"], pattern);
    assert.deepEqual(releaseNames(root), []);
  }
});

test("source parents, sources, destination objects, and release checks never follow symlinks", async () => {
  {
    const root = makeFixture();
    unlinkSync(join(root, "synthesis", "app.js"));
    symlinkSync("dep.js", join(root, "synthesis", "app.js"));
    await rejects(root, ["--release", "v1", "--write"], /symlink/i);
  }
  {
    const root = makeFixture();
    symlinkSync("synthesis", join(root, "linked"));
    const config = readJson(root, "scripts/synthesis-runtime-files.json");
    config.releases.v1.files[0].source = "linked/app.js";
    writeJson(root, "scripts/synthesis-runtime-files.json", config);
    await rejects(root, ["--release", "v1", "--write"], /symlink/i);
  }
  {
    const root = makeFixture();
    mkdirSync(join(root, "synthesis", "releases"), { recursive: true });
    symlinkSync("missing-destination", join(root, "synthesis", "releases", "v1"));
    await rejects(root, ["--release", "v1", "--write"], /already exists|destination/i);
    assert.equal(lstatSync(join(root, "synthesis", "releases", "v1")).isSymbolicLink(), true);
  }
  {
    const root = await buildFixture();
    const releases = join(root, "synthesis", "releases");
    renameSync(join(releases, "v1"), join(releases, "real-v1"));
    symlinkSync("real-v1", join(releases, "v1"));
    await rejects(root, ["--release", "v1", "--check"], /symlink/i);
  }
  {
    const root = await buildFixture();
    const release = join(root, "synthesis", "releases", "v1");
    renameSync(join(release, "release-lock.json"), join(root, "sentinel-lock.json"));
    symlinkSync("../../../sentinel-lock.json", join(release, "release-lock.json"));
    await rejects(root, ["--release", "v1", "--check"], /symlink/i);
    assert.equal(readJson(root, "sentinel-lock.json").releaseId, "v1");
  }
});

test("check rejects exact-tree violations and preserves injected or sibling objects", async () => {
  for (const mutate of [
    (root) => write(root, "synthesis/releases/v1/injected.js", Buffer.from("sentinel\n")),
    (root) => unlinkSync(join(root, "synthesis", "releases", "v1", "dep.js")),
    (root) => {
      unlinkSync(join(root, "synthesis", "releases", "v1", "dep.js"));
      mkdirSync(join(root, "synthesis", "releases", "v1", "dep.js"));
    },
    (root) => mkdirSync(join(root, "synthesis", "releases", "v1", "empty")),
  ]) {
    const root = await buildFixture();
    write(root, "synthesis/releases/v2/sentinel", Buffer.from("keep\n"));
    mutate(root);
    await rejects(root, ["--release", "v1", "--check"], /release|file|directory|unexpected|missing/i);
    assert.equal(readFileSync(join(root, "synthesis", "releases", "v2", "sentinel"), "utf8"), "keep\n");
    const injected = join(root, "synthesis", "releases", "v1", "injected.js");
    if (existsSync(injected)) assert.equal(readFileSync(injected, "utf8"), "sentinel\n");
  }
});

test("check rejects lock, runtime, manifest, artifact, inner dataset, and generator tamper", async () => {
  const mutations = [
    (root) => {
      const lock = readJson(root, "synthesis/releases/v1/release-lock.json");
      lock.unknown = true;
      writeJson(root, "synthesis/releases/v1/release-lock.json", lock);
    },
    (root) => write(root, "synthesis/releases/v1/dep.js", Buffer.from("tamper\n")),
    (root) => {
      const manifest = readJson(root, "synthesis/data/manifest.v1.json");
      manifest.source.repo = "tampered/repo";
      writeJson(root, "synthesis/data/manifest.v1.json", manifest);
    },
    (root) => write(root, "synthesis/data/graph-core.v1.json", Buffer.from("{}\n")),
    (root) => {
      const core = readJson(root, "synthesis/data/graph-core.v1.json");
      core.datasetId = `sha256:${"c".repeat(64)}`;
      writeJson(root, "synthesis/data/graph-core.v1.json", core);
    },
    (root) => {
      const manifest = readJson(root, "synthesis/data/manifest.v1.json");
      write(root, manifest.generator.path, Buffer.from("tampered generator\n"));
    },
  ];
  for (const mutate of mutations) {
    const root = await buildFixture();
    mutate(root);
    await rejects(root, ["--release", "v1", "--check"], /lock|hash|bytes|manifest|artifact|dataset|generator|runtime/i);
  }
});

test("manifest/release literals and generator module graph are pinned before write", async () => {
  for (const app of [
    [
      loaderImport,
      'import "./dep.js";',
      coreBinding(),
      'loadManifest("synthesis/data/manifest.v2.json", { expectedReleaseId: "v1" });',
      "",
    ].join("\n"),
    [
      loaderImport,
      'import "./dep.js";',
      coreBinding(),
      'loadManifest("synthesis/data/manifest.v1.json", { expectedReleaseId: "v2" });',
      "",
    ].join("\n"),
  ]) {
    const root = makeFixture({ app });
    await rejects(root, ["--release", "v1", "--write"], /manifest|release binding|expectedReleaseId/i);
  }
  const root = makeFixture({ generator: 'import "./relative.js";\n' });
  await rejects(root, ["--release", "v1", "--write"], /generator|node: built-in/i);
  const fakeBuiltin = makeFixture({ generator: 'import "node:not-a-real-builtin";\n' });
  await rejects(fakeBuiltin, ["--release", "v1", "--write"], /generator|built-in/i);
});

test("repository runtime allowlists preserve v1 and pin the exact sorted v2 closure", () => {
  const config = JSON.parse(readFileSync(
    new URL("../scripts/synthesis-runtime-files.json", import.meta.url), "utf8"));
  assert.deepEqual(config, {
    formatVersion: 1,
    releases: {
      v1: {
        files: [
          { source: "synthesis/app.js", target: "app.js" },
          { source: "synthesis/data-loader.js", target: "data-loader.js" },
          { source: "synthesis/detail-rail.js", target: "detail-rail.js" },
          { source: "synthesis/dist-utils.js", target: "dist-utils.js" },
          { source: "synthesis/drilldown-graph.js", target: "drilldown-graph.js" },
          { source: "synthesis/graph-store.js", target: "graph-store.js" },
          { source: "synthesis/graph-views.js", target: "graph-views.js" },
          { source: "synthesis/overview-graph.js", target: "overview-graph.js" },
          { source: "synthesis.css", target: "synthesis.css" },
          { source: "synthesis/url-state.js", target: "url-state.js" },
        ],
      },
      v2: {
        files: [
          { source: "synthesis/adjust-panel.js", target: "adjust-panel.js" },
          { source: "synthesis/app.js", target: "app.js" },
          { source: "synthesis/data-loader.js", target: "data-loader.js" },
          { source: "synthesis/detail-rail.js", target: "detail-rail.js" },
          { source: "synthesis/dimensions-schema.js", target: "dimensions-schema.js" },
          { source: "synthesis/dist-utils.js", target: "dist-utils.js" },
          { source: "synthesis/drilldown-graph.js", target: "drilldown-graph.js" },
          { source: "synthesis/graph-store.js", target: "graph-store.js" },
          { source: "synthesis/graph-views.js", target: "graph-views.js" },
          { source: "synthesis/overview-graph.js", target: "overview-graph.js" },
          { source: "synthesis/render-persona.js", target: "render-persona.js" },
          { source: "synthesis/request-schema.js", target: "request-schema.js" },
          { source: "synthesis/results-panel.js", target: "results-panel.js" },
          { source: "synthesis/rng.js", target: "rng.js" },
          { source: "synthesis/sampler-client.js", target: "sampler-client.js" },
          { source: "synthesis/sampler-worker.js", target: "sampler-worker.js" },
          { source: "synthesis/sampler.js", target: "sampler.js" },
          { source: "synthesis.css", target: "synthesis.css" },
          { source: "synthesis/url-state.js", target: "url-state.js" },
        ],
      },
    },
  });
});

test("the exact repository v2 sources and pinned data pass a predecessor-bound temp preflight", async () => {
  const root = mkdtempSync(join(tmpdir(), "synthesis-runtime-real-preflight-"));
  temporaryRoots.push(root);
  const copy = (relative) => write(root, relative,
    readFileSync(join(REPOSITORY_ROOT, ...relative.split("/"))));
  copy("scripts/synthesis-runtime-files.json");
  const config = readJson(root, "scripts/synthesis-runtime-files.json");
  for (const file of config.releases.v2.files) copy(file.source);
  for (const target of [
    ...config.releases.v1.files.map((file) => file.target),
    "release-lock.json",
  ]) copy(`synthesis/releases/v1/${target}`);
  for (const releaseId of ["v1", "v2"]) {
    copy(`synthesis/data/manifest.${releaseId}.json`);
    const manifest = readJson(root, `synthesis/data/manifest.${releaseId}.json`);
    for (const descriptor of Object.values(manifest.artifacts)) {
      if (!existsSync(join(root, ...descriptor.path.split("/")))) copy(descriptor.path);
    }
    copy(manifest.generator.path);
  }

  await run(root, "--release", "v2", "--write");
  await run(root, "--release", "v2", "--check");
  await run(root, "--release", "v2", "--check-source");
  const lock = readJson(root, "synthesis/releases/v2/release-lock.json");
  assert.equal(lock.runtime.length, 19);
  assert.equal(lock.predecessor.releaseId, "v1");
  assert.equal(lock.data.datasetId,
    readJson(root, "synthesis/data/manifest.v2.json").datasetId);
});

test("repository releases and public entry points pin one query-free v2 runtime", async () => {
  await runCli(["--release", "v1", "--check"], { repoRoot: REPOSITORY_ROOT });
  await runCli(["--release", "v2", "--check"], { repoRoot: REPOSITORY_ROOT });
  await runCli(["--release", "v2", "--check-source"], { repoRoot: REPOSITORY_ROOT });
  const html = readFileSync(join(REPOSITORY_ROOT, "synthesis.html"), "utf8");
  assert.deepEqual(assertHtmlRuntimeEntries(html, "v2"), {
    css: "synthesis/releases/v2/synthesis.css",
    app: "synthesis/releases/v2/app.js",
  });
  assert.deepEqual(assertHtmlModulePreloads(REPOSITORY_ROOT, html, "v2"), [
    "synthesis/releases/v2/adjust-panel.js",
    "synthesis/releases/v2/app.js",
    "synthesis/releases/v2/data-loader.js",
    "synthesis/releases/v2/detail-rail.js",
    "synthesis/releases/v2/dimensions-schema.js",
    "synthesis/releases/v2/dist-utils.js",
    "synthesis/releases/v2/drilldown-graph.js",
    "synthesis/releases/v2/graph-store.js",
    "synthesis/releases/v2/graph-views.js",
    "synthesis/releases/v2/overview-graph.js",
    "synthesis/releases/v2/render-persona.js",
    "synthesis/releases/v2/request-schema.js",
    "synthesis/releases/v2/results-panel.js",
    "synthesis/releases/v2/rng.js",
    "synthesis/releases/v2/sampler-client.js",
    "synthesis/releases/v2/sampler.js",
    "synthesis/releases/v2/url-state.js",
  ]);
  assertLocalHtmlResources(REPOSITORY_ROOT, html);

  const reordered = html
    .replace('<link rel="stylesheet" href="synthesis/releases/v2/synthesis.css" />',
      '<link href="synthesis/releases/v2/synthesis.css" media="screen" rel="stylesheet" />')
    .replace('<script type="module" src="synthesis/releases/v2/app.js"></script>',
      '<script src="synthesis/releases/v2/app.js" defer type="module"></script>');
  assertHtmlRuntimeEntries(`<!-- <script type="module" src="synthesis/app.js"></script> -->${reordered}`, "v2");

  for (const bypass of [
    html.replace("</head>", '<link rel="stylesheet" href="synthesis.css" /></head>'),
    html.replace("</body>", '<script type="module" src="synthesis/app.js"></script></body>'),
    html.replace("synthesis/releases/v2/synthesis.css", "synthesis/releases/v2/synthesis.css?v=mutable"),
    html.replace('<script type="module" src="synthesis/releases/v2/app.js"></script>',
      '<script type="module" src="synthesis/releases/v1/app.js"></script>'),
  ]) assert.throws(() => assertHtmlRuntimeEntries(bypass, "v2"));

  assert.match(html, /href="css\/styles\.css\?v=9"/);
  assert.match(html, /href="css\/navigation\.css\?v=1"/);
  assert.match(html, /src="js\/theme-toggle\.js\?v=3"/);
  assert.match(html, /src="js\/site-performance\.js\?v=1"/);

  const persona = readFileSync(join(REPOSITORY_ROOT, "persona.html"), "utf8");
  assert.match(persona,
    /class="persona-hero-actions"[\s\S]*?<a class="persona-secondary-cta" href="synthesis\.html">Open the DAG Studio →<\/a>/);
  const readme = readFileSync(join(REPOSITORY_ROOT, "README.md"), "utf8");
  assert.match(readme,
    /\| DAG Studio \| \[`synthesis\.html`\]\(synthesis\.html\) \| Verified client-side Persona Full DAG browser[\s\S]*?selected-persona overlays\. \|/);
  assert.match(readme,
    /NODE18[\s\S]*?v18\.19\.1[\s\S]*?manifest\.v2\.json[\s\S]*?"\$NODE18" "\$V2_GENERATOR"[\s\S]*?--phase 2[\s\S]*?default,[\s\S]*?unadjusted sampler/);
});
