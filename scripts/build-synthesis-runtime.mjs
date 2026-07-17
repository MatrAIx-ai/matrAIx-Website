#!/usr/bin/env node
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { builtinModules } from "node:module";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_REPO_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const CONFIG_PATH = "scripts/synthesis-runtime-files.json";
const RELEASE_RE = /^v[1-9][0-9]*$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const ARTIFACT_PATHS = {
  core: /^synthesis\/data\/graph-core\.v[1-9][0-9]*\.json$/,
  pack: /^synthesis\/data\/sampler-pack\.v[1-9][0-9]*\.json$/,
  dimensions: /^synthesis\/data\/dimensions\.[0-9a-f]{16,64}\.json$/,
};
const NODE_BUILTINS = new Set(builtinModules.flatMap((name) =>
  name.startsWith("node:") ? [name] : [name, `node:${name}`]));

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonicalJson = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const compactJson = (value) => Buffer.from(`${JSON.stringify(value)}\n`);

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) fail(`${label} has unknown field: ${key}`);
  }
  for (const key of expected) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${label} is missing field: ${key}`);
  }
}

function parseJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof TypeError) fail(`${label} is not valid UTF-8`);
    fail(`${label} is not valid JSON`);
  }
  return value;
}

function validateRepoRelativePath(value, label, { target = false } = {}) {
  if (typeof value !== "string" || !value) fail(`${label} must be a canonical repo-relative path`);
  if (value !== value.trim() || value.normalize("NFC") !== value) {
    fail(`${label} must not have surrounding whitespace and must use NFC normal form`);
  }
  if (value.includes("\0") || value.includes("\\") || value.includes("%")
      || value.includes("?") || value.includes("#")) {
    fail(`${label} must be a canonical repo-relative POSIX path`);
  }
  if (value.startsWith("/") || value.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    fail(`${label} must be a canonical repo-relative path`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment !== segment.trim()
      || segment === "." || segment === "..")) {
    fail(`${label} must be a canonical repo-relative path`);
  }
  if (posix.normalize(value) !== value) fail(`${label} must be in canonical form`);
  if (target && segments.at(-1).toLowerCase() === "release-lock.json") {
    fail(`${label} uses the reserved release-lock.json name`);
  }
  return value;
}

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function sameFilesystemIdentity(left, right) {
  return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

function assertDirectoryIdentity(path, identity, label) {
  const stat = lstatOrNull(path);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()
      || !sameFilesystemIdentity(identity, stat)) {
    fail(`${label} filesystem identity changed`);
  }
  return stat;
}

function readRegularFileNoFollow(path, label) {
  const before = lstatOrNull(path);
  if (!before) fail(`missing path: ${label}`);
  if (before.isSymbolicLink()) fail(`symlink is not allowed: ${label}`);
  if (!before.isFile()) fail(`path is not a regular file: ${label}`);
  const noFollow = typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
  let descriptor;
  try {
    descriptor = openSync(path, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    if (error?.code === "ELOOP") fail(`symlink is not allowed: ${label}`);
    throw error;
  }
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || !sameFilesystemIdentity(before, opened)) {
      fail(`file identity changed while opening: ${label}`);
    }
    const bytes = readFileSync(descriptor);
    const afterDescriptor = fstatSync(descriptor);
    const afterPath = lstatOrNull(path);
    if (!afterDescriptor.isFile() || !afterPath?.isFile() || afterPath.isSymbolicLink()
        || !sameFilesystemIdentity(opened, afterDescriptor)
        || !sameFilesystemIdentity(opened, afterPath)
        || opened.size !== afterDescriptor.size
        || opened.mtimeMs !== afterDescriptor.mtimeMs
        || opened.ctimeMs !== afterDescriptor.ctimeMs) {
      fail(`file identity changed while reading: ${label}`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function inspectRepoPath(repoRoot, relativePath, { file = true } = {}) {
  validateRepoRelativePath(relativePath, relativePath);
  let current = repoRoot;
  const rootStat = lstatOrNull(current);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) fail(`repository root is not a regular directory`);
  const segments = relativePath.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]);
    const stat = lstatOrNull(current);
    if (!stat) fail(`missing path: ${relativePath}`);
    if (stat.isSymbolicLink()) fail(`symlink is not allowed: ${relativePath}`);
    const isLast = index === segments.length - 1;
    if (!isLast && !stat.isDirectory()) fail(`path parent is not a directory: ${relativePath}`);
    if (isLast && file && !stat.isFile()) fail(`path is not a regular file: ${relativePath}`);
    if (isLast && !file && !stat.isDirectory()) fail(`path is not a directory: ${relativePath}`);
  }
  return current;
}

function readRepoFile(repoRoot, relativePath) {
  return readRegularFileNoFollow(inspectRepoPath(repoRoot, relativePath), relativePath);
}

function parseCli(argv) {
  if (!Array.isArray(argv)) fail("argv must be an array");
  let release = null;
  const modes = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--release") {
      if (release !== null) fail("repeated --release flag");
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) fail("missing value for --release");
      release = value;
      index += 1;
      continue;
    }
    if (arg === "--write" || arg === "--check" || arg === "--check-source") {
      if (modes.includes(arg)) fail(`repeated ${arg} flag`);
      modes.push(arg);
      continue;
    }
    fail(`unknown flag: ${arg}`);
  }
  if (release === null) fail("exactly one --release is required");
  if (!RELEASE_RE.test(release)) fail(`invalid release: ${release}`);
  if (modes.length !== 1) fail("exactly one mode is required");
  return { release, mode: modes[0] };
}

function targetCollisions(files, label) {
  const exact = new Set();
  const folded = new Map();
  for (const file of files) {
    if (exact.has(file.target)) fail(`${label} has exact target collision: ${file.target}`);
    exact.add(file.target);
    const lower = file.target.toLowerCase();
    if (folded.has(lower)) fail(`${label} has case-folded target collision: ${file.target}`);
    folded.set(lower, file.target);
  }
  const targets = [...exact].sort();
  for (let left = 0; left < targets.length; left += 1) {
    for (let right = left + 1; right < targets.length; right += 1) {
      const a = targets[left].toLowerCase();
      const b = targets[right].toLowerCase();
      if (a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) {
        fail(`${label} has file/directory target collision: ${targets[left]} and ${targets[right]}`);
      }
    }
  }
}

function validateConfig(config) {
  exactKeys(config, ["formatVersion", "releases"], "runtime config");
  if (config.formatVersion !== 1) fail("runtime config formatVersion must be 1");
  if (!isObject(config.releases)) fail("runtime config releases must be an object");
  for (const [releaseId, release] of Object.entries(config.releases)) {
    if (!RELEASE_RE.test(releaseId)) fail(`invalid configured release: ${releaseId}`);
    exactKeys(release, ["files"], `release ${releaseId}`);
    if (!Array.isArray(release.files) || !release.files.length) {
      fail(`release ${releaseId} files must be a non-empty array`);
    }
    for (const [index, file] of release.files.entries()) {
      exactKeys(file, ["source", "target"], `release ${releaseId} file ${index}`);
      validateRepoRelativePath(file.source, `release ${releaseId} source ${index}`);
      validateRepoRelativePath(file.target, `release ${releaseId} target ${index}`, { target: true });
    }
    targetCollisions(release.files, `release ${releaseId}`);
    for (let index = 1; index < release.files.length; index += 1) {
      if (release.files[index - 1].target >= release.files[index].target) {
        fail(`release ${releaseId} files must be sorted by target`);
      }
    }
  }
  return config;
}

function readConfig(repoRoot) {
  return validateConfig(parseJson(readRepoFile(repoRoot, CONFIG_PATH), "runtime config"));
}

function readJsString(source, start, quote, label) {
  let index = start + 1;
  let value = "";
  let escaped = false;
  while (index < source.length) {
    const char = source[index];
    if (char === quote) return { index: index + 1, value, escaped };
    if (char === "\n" || char === "\r") fail(`${label} has an unterminated string`);
    if (char === "\\") {
      escaped = true;
      index += 1;
      if (index >= source.length) fail(`${label} has an unterminated string escape`);
      const escapedChar = source[index];
      const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
      value += simple[escapedChar] ?? escapedChar;
      index += 1;
      continue;
    }
    value += char;
    index += 1;
  }
  fail(`${label} has an unterminated string`);
}

function tokenizeJavaScript(bytes, label) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not valid UTF-8`);
  }
  const tokens = [];
  let index = source.startsWith("#!") ? source.indexOf("\n") : 0;
  if (index < 0) index = source.length;

  const canStartRegex = () => {
    const previous = tokens.at(-1);
    if (!previous) return true;
    if (previous.type === "identifier") {
      return new Set(["return", "throw", "case", "delete", "void", "typeof", "yield", "await", "in", "of"])
        .has(previous.value);
    }
    if (["string", "number", "template", "regex"].includes(previous.type)) return false;
    return ![")", "]", "}"].includes(previous.value);
  };

  const scanRegex = () => {
    index += 1;
    let inClass = false;
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === "[") inClass = true;
      else if (char === "]") inClass = false;
      else if (char === "/" && !inClass) {
        index += 1;
        while (/[A-Za-z]/.test(source[index] ?? "")) index += 1;
        tokens.push({ type: "regex", value: "regex" });
        return;
      }
      if (char === "\n" || char === "\r") fail(`${label} has an unterminated regular expression`);
      index += 1;
    }
    fail(`${label} has an unterminated regular expression`);
  };

  const scanCode = (stopAtTemplateBrace = false) => {
    let braceDepth = 0;
    while (index < source.length) {
      const char = source[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      if (char === "/" && source[index + 1] === "/") {
        index += 2;
        while (index < source.length && source[index] !== "\n") index += 1;
        continue;
      }
      if (char === "/" && source[index + 1] === "*") {
        const end = source.indexOf("*/", index + 2);
        if (end < 0) fail(`${label} has an unterminated block comment`);
        index = end + 2;
        continue;
      }
      if (char === "/" && canStartRegex()) {
        scanRegex();
        continue;
      }
      if (char === "'" || char === '"') {
        const parsed = readJsString(source, index, char, label);
        tokens.push({ type: "string", value: parsed.value, escaped: parsed.escaped });
        index = parsed.index;
        continue;
      }
      if (char === "\\") fail(`${label} has an escaped JavaScript token`);
      if (char === "`") {
        tokens.push({ type: "template", value: "template" });
        index += 1;
        let closed = false;
        while (index < source.length) {
          if (source[index] === "\\") {
            index += 2;
            continue;
          }
          if (source[index] === "`") {
            index += 1;
            closed = true;
            break;
          }
          if (source[index] === "$" && source[index + 1] === "{") {
            index += 2;
            scanCode(true);
            continue;
          }
          index += 1;
        }
        if (!closed) fail(`${label} has an unterminated template literal`);
        continue;
      }
      if (/[A-Za-z_$]/.test(char)) {
        const start = index;
        index += 1;
        while (/[A-Za-z0-9_$]/.test(source[index] ?? "")) index += 1;
        tokens.push({ type: "identifier", value: source.slice(start, index) });
        continue;
      }
      if (/[0-9]/.test(char)) {
        const start = index;
        index += 1;
        while (/[0-9A-Fa-f_xX.eE]/.test(source[index] ?? "")) index += 1;
        tokens.push({ type: "number", value: source.slice(start, index) });
        continue;
      }
      if (char === "{") {
        braceDepth += 1;
        tokens.push({ type: "punct", value: char });
        index += 1;
        continue;
      }
      if (char === "}" && stopAtTemplateBrace && braceDepth === 0) {
        index += 1;
        return;
      }
      if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
      tokens.push({ type: "punct", value: char });
      index += 1;
    }
    if (stopAtTemplateBrace) fail(`${label} has an unterminated template expression`);
  };

  scanCode(false);
  return tokens;
}

function literalSpecifier(token, label, kind) {
  if (!token || token.type !== "string") fail(`${label} has non-literal ${kind}`);
  if (token.escaped) fail(`${label} has escaped ${kind} specifier`);
  return token.value;
}

function findFromSpecifier(tokens, start, label, kind) {
  for (let index = start; index < tokens.length && tokens[index].value !== ";"; index += 1) {
    if (tokens[index].type === "identifier" && tokens[index].value === "from") {
      return literalSpecifier(tokens[index + 1], label, kind);
    }
  }
  return null;
}

function matchingTokenIndex(tokens, start, label) {
  const pairs = new Map([["(", ")"], ["[", "]"], ["{", "}"]]);
  const first = tokens[start]?.value;
  if (!pairs.has(first)) fail(`${label} has malformed delimiter syntax`);
  const stack = [pairs.get(first)];
  for (let index = start + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value;
    if (pairs.has(value)) stack.push(pairs.get(value));
    else if ([")", "]", "}"].includes(value)) {
      if (value !== stack.at(-1)) fail(`${label} has mismatched delimiter syntax`);
      stack.pop();
      if (!stack.length) return index;
    }
  }
  fail(`${label} has unterminated delimiter syntax`);
}

function isImportMeta(tokens, start) {
  return tokens[start]?.value === "import"
    && tokens[start + 1]?.value === "."
    && tokens[start + 2]?.value === "meta";
}

function isImportMetaUrl(tokens, start) {
  return isImportMeta(tokens, start)
    && tokens[start + 3]?.value === "."
    && tokens[start + 4]?.value === "url";
}

function rejectComputedSensitiveMembers(tokens, label) {
  const globals = new Set(["globalThis", "window", "self"]);
  const expressionKeywords = new Set([
    "await", "case", "delete", "in", "instanceof", "new", "of", "return", "throw",
    "typeof", "void", "yield",
  ]);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== "[") continue;
    const previous = tokens[index - 1];
    const optionalGlobal = tokens[index - 1]?.value === "."
      && tokens[index - 2]?.value === "?" ? tokens[index - 3] : null;
    if (globals.has(previous?.value) || globals.has(optionalGlobal?.value)) {
      fail(`${label} has unsupported computed access on a global object`);
    }
    const memberBase = optionalGlobal ?? previous;
    const isMember = (memberBase?.type === "identifier"
      && !expressionKeywords.has(memberBase.value)) || [")", "]"].includes(memberBase?.value);
    if (!isMember) continue;
    const close = matchingTokenIndex(tokens, index, `${label} computed member`);
    const keyTokens = tokens.slice(index + 1, close);
    if (keyTokens.some((token) => token.type === "string" && token.escaped)) {
      fail(`${label} has an escaped computed member key`);
    }
    if (keyTokens.some((token) => token.type === "template")) {
      fail(`${label} has an unsupported template computed member key`);
    }
    if (keyTokens.some((token) => token.type === "string")) {
      fail(`${label} has an unsupported string computed member key`);
    }
  }
}

function scanJavaScript(bytes, label, { enforceRuntimeClosure = false } = {}) {
  const tokens = tokenizeJavaScript(bytes, label);
  if (enforceRuntimeClosure) rejectComputedSensitiveMembers(tokens, label);
  const resources = [];
  const consumedImportMetaUrls = new Set();
  const add = (specifier, kind) => resources.push({ specifier, kind });
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "identifier" && ["Worker", "SharedWorker"].includes(token.value)
        && !(tokens[index - 1]?.value === "new" && tokens[index + 1]?.value === "(")) {
      fail(`${label} has unsupported ${token.value} member or alias reference`);
    }
    if (enforceRuntimeClosure && token.type === "identifier" && token.value === "URL"
        && !(tokens[index - 1]?.value === "new" && tokens[index + 1]?.value === "(")
        && tokens[index - 1]?.value !== "instanceof") {
      fail(`${label} has unsupported URL member or alias reference`);
    }
    if (token.type === "identifier" && token.value === "import"
        && tokens[index - 1]?.value !== ".") {
      if (tokens[index + 1]?.value === ".") continue;
      if (tokens[index + 1]?.value === "(") {
        const specifier = literalSpecifier(tokens[index + 2], label, "dynamic import");
        if (tokens[index + 3]?.value !== ")") fail(`${label} has unsupported dynamic import syntax`);
        add(specifier, "dynamic import");
      } else if (tokens[index + 1]?.type === "string") {
        add(literalSpecifier(tokens[index + 1], label, "import"), "import");
      } else {
        const specifier = findFromSpecifier(tokens, index + 1, label, "import");
        if (specifier === null) fail(`${label} has unsupported import syntax`);
        add(specifier, "import");
      }
    }
    if (token.type === "identifier" && token.value === "export"
        && (tokens[index + 1]?.value === "*" || tokens[index + 1]?.value === "{")) {
      const specifier = findFromSpecifier(tokens, index + 1, label, "re-export");
      if (specifier !== null) add(specifier, "re-export");
    }
    if (token.type === "identifier" && token.value === "new"
        && tokens[index + 1]?.type === "identifier" && tokens[index + 1].value === "URL"
        && tokens[index + 2]?.value === "(") {
      const close = matchingTokenIndex(tokens, index + 2, `${label} new URL`);
      let hasImportMetaBase = false;
      for (let cursor = index + 3; cursor < close; cursor += 1) {
        if (isImportMetaUrl(tokens, cursor)) {
          hasImportMetaBase = true;
          break;
        }
      }
      if (hasImportMetaBase) {
        const exact = tokens[index + 4]?.value === ","
          && isImportMetaUrl(tokens, index + 5)
          && tokens[index + 10]?.value === ")"
          && close === index + 10;
        if (!exact) fail(`${label} has unsupported new URL import.meta.url syntax`);
        consumedImportMetaUrls.add(index + 5);
        add(literalSpecifier(tokens[index + 3], label, "new URL"), "new URL");
      }
    }
    if (token.type === "identifier" && token.value === "new"
        && ["Worker", "SharedWorker"].includes(tokens[index + 1]?.value)
        && tokens[index + 2]?.value === "(") {
      const workerType = tokens[index + 1].value;
      const first = tokens[index + 3];
      if (first?.value === "new" && tokens[index + 4]?.value === "URL") {
        const literal = tokens[index + 6];
        const exactImportMetaUrl = tokens[index + 5]?.value === "("
          && tokens[index + 7]?.value === ","
          && isImportMetaUrl(tokens, index + 8)
          && tokens[index + 13]?.value === ")";
        if (!exactImportMetaUrl) {
          fail(`${label} has unsupported ${workerType} new URL wrapper; import.meta.url is required`);
        }
        literalSpecifier(literal, label, `${workerType} new URL`);
        const workerClose = matchingTokenIndex(tokens, index + 2, `${label} ${workerType}`);
        if (tokens[index + 14]?.value !== ")" && tokens[index + 14]?.value !== ",") {
          fail(`${label} has unsupported ${workerType} first argument`);
        }
        if (tokens[index + 14]?.value === ")" && workerClose !== index + 14) {
          fail(`${label} has unsupported ${workerType} syntax`);
        }
        if (tokens[index + 14]?.value === ",") {
          if (index + 15 >= workerClose) fail(`${label} has missing ${workerType} options`);
          for (let cursor = index + 15; cursor < workerClose; cursor += 1) {
            if (["(", "[", "{"].includes(tokens[cursor].value)) {
              cursor = matchingTokenIndex(tokens, cursor, `${label} ${workerType} options`);
              continue;
            }
            if (tokens[cursor].value === ",") {
              fail(`${label} ${workerType} accepts at most one options argument`);
            }
          }
        }
      } else {
        fail(`${label} requires ${workerType}(new URL(literal, import.meta.url), options)`);
      }
    }
  }
  if (enforceRuntimeClosure) {
    for (let index = 0; index < tokens.length; index += 1) {
      if (isImportMeta(tokens, index)
          && (!isImportMetaUrl(tokens, index) || !consumedImportMetaUrls.has(index))) {
        fail(`${label} has import.meta outside an exact new URL(literal, import.meta.url)`);
      }
    }
  }
  return resources;
}

function readCssString(source, start, quote, label) {
  let index = start + 1;
  let value = "";
  let escaped = false;
  while (index < source.length) {
    const char = source[index];
    if (char === quote) return { value, escaped, index: index + 1 };
    if (char === "\\") {
      escaped = true;
      index += 1;
      if (index >= source.length) fail(`${label} has an unterminated CSS escape`);
      value += source[index];
      index += 1;
      continue;
    }
    value += char;
    index += 1;
  }
  fail(`${label} has an unterminated CSS string`);
}

function scanCss(bytes, label) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not valid UTF-8`);
  }
  const resources = [];
  let index = 0;
  const skipSpace = () => {
    while (/\s/.test(source[index] ?? "")) index += 1;
  };
  const skipComment = () => {
    if (source.slice(index, index + 2) !== "/*") return false;
    const end = source.indexOf("*/", index + 2);
    if (end < 0) fail(`${label} has an unterminated CSS comment`);
    index = end + 2;
    return true;
  };
  const parseUrlFunction = (kind) => {
    skipSpace();
    if (source[index] !== "(") fail(`${label} has malformed ${kind}`);
    index += 1;
    skipSpace();
    let value;
    let escaped = false;
    if (source[index] === "'" || source[index] === '"') {
      const parsed = readCssString(source, index, source[index], label);
      ({ value, escaped, index } = parsed);
      skipSpace();
      if (source[index] !== ")") fail(`${label} has malformed ${kind}`);
      index += 1;
    } else {
      const start = index;
      while (index < source.length && source[index] !== ")") {
        if (source[index] === "\\" || source.slice(index, index + 2) === "/*") escaped = true;
        index += 1;
      }
      if (source[index] !== ")") fail(`${label} has unterminated ${kind}`);
      value = source.slice(start, index).trim();
      index += 1;
    }
    if (escaped) fail(`${label} has escaped ${kind} specifier`);
    if (!value) fail(`${label} has empty ${kind} specifier`);
    resources.push({ specifier: value, kind });
  };

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (skipComment()) continue;
    if (source[index] === "'" || source[index] === '"') {
      index = readCssString(source, index, source[index], label).index;
      continue;
    }
    if (source[index] === "\\") fail(`${label} has an escaped CSS token`);
    if (source.slice(index, index + 7).toLowerCase() === "@import"
        && !/[A-Za-z0-9_-]/.test(source[index + 7] ?? "")) {
      index += 7;
      skipSpace();
      if (source[index] === "'" || source[index] === '"') {
        const parsed = readCssString(source, index, source[index], label);
        if (parsed.escaped) fail(`${label} has escaped CSS @import specifier`);
        resources.push({ specifier: parsed.value, kind: "CSS @import" });
        index = parsed.index;
      } else if (source.slice(index, index + 3).toLowerCase() === "url") {
        index += 3;
        parseUrlFunction("CSS @import");
      } else {
        fail(`${label} has non-literal CSS @import`);
      }
      continue;
    }
    if (source.slice(index, index + 3).toLowerCase() === "url"
        && !/[A-Za-z0-9_-]/.test(source[index - 1] ?? "")
        && !/[A-Za-z0-9_-]/.test(source[index + 3] ?? "")) {
      index += 3;
      parseUrlFunction("CSS url()");
      continue;
    }
    index += 1;
  }
  return resources;
}

function resolveRuntimeSpecifier(fromTarget, resource, targetSet, { css = false } = {}) {
  const specifier = resource.specifier;
  if (typeof specifier !== "string" || !specifier) fail(`${fromTarget} has empty ${resource.kind}`);
  if (css && (specifier.startsWith("data:") || /^#[^#?]+$/.test(specifier))) return null;
  if (specifier.includes("\\") || specifier.includes("%")
      || specifier.includes("?") || specifier.includes("#")) {
    fail(`${fromTarget} has unsafe ${resource.kind}: ${specifier}`);
  }
  if (specifier.startsWith("/") || specifier.startsWith("//")
      || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(specifier)) {
    fail(`${fromTarget} has absolute or protocol ${resource.kind}: ${specifier}`);
  }
  if (!css && !specifier.startsWith("./") && !specifier.startsWith("../")) {
    fail(`${fromTarget} has bare package ${resource.kind}: ${specifier}`);
  }
  const resolved = posix.normalize(posix.join(posix.dirname(fromTarget), specifier));
  if (resolved === ".." || resolved.startsWith("../") || posix.isAbsolute(resolved)) {
    fail(`${fromTarget} has escaping ${resource.kind}: ${specifier}`);
  }
  if (!targetSet.has(resolved)) {
    fail(`${fromTarget} dependency is missing from configured release: ${resolved}`);
  }
  return resolved;
}

function analyzeRuntime(runtimeBytes) {
  const targetSet = new Set(runtimeBytes.keys());
  if (!targetSet.has("app.js")) fail("runtime release must configure app.js");
  if (!targetSet.has("synthesis.css")) fail("runtime release must configure synthesis.css");
  const graph = new Map();
  for (const [target, bytes] of runtimeBytes) {
    let resources = [];
    if (target.endsWith(".js")) {
      resources = scanJavaScript(bytes, target, { enforceRuntimeClosure: true });
    }
    else if (target.endsWith(".css")) resources = scanCss(bytes, target);
    const dependencies = new Set();
    for (const resource of resources) {
      const resolved = resolveRuntimeSpecifier(target, resource, targetSet,
        { css: target.endsWith(".css") });
      if (resolved) dependencies.add(resolved);
    }
    graph.set(target, dependencies);
  }
  const reachable = new Set();
  const visit = (target) => {
    if (reachable.has(target)) return;
    reachable.add(target);
    for (const dependency of graph.get(target) ?? []) visit(dependency);
  };
  visit("app.js");
  visit("synthesis.css");
  const ghosts = [...targetSet].filter((target) => !reachable.has(target));
  if (ghosts.length) fail(`runtime release has unreachable target: ${ghosts.join(", ")}`);
}

function validateGenerator(bytes, label) {
  const tokens = tokenizeJavaScript(bytes, label);
  if (tokens.some((token) => token.type === "identifier"
      && ["createRequire", "require"].includes(token.value))) {
    fail(`${label} generator may not use createRequire or CommonJS require`);
  }
  for (const resource of scanJavaScript(bytes, label)) {
    if (!resource.kind.includes("import") && resource.kind !== "re-export") {
      fail(`${label} generator resources must be static node: built-in imports`);
    }
    if (resource.kind === "dynamic import") fail(`${label} generator dynamic import is not allowed`);
    if (resource.specifier === "node:module") {
      fail(`${label} generator may not import node:module`);
    }
    if (!resource.specifier.startsWith("node:") || !NODE_BUILTINS.has(resource.specifier)) {
      fail(`${label} generator imports must be real node: built-ins`);
    }
  }
}

function validateDescriptor(descriptor, label) {
  exactKeys(descriptor, ["path", "sha256", "bytes"], label);
  validateRepoRelativePath(descriptor.path, `${label} path`);
  if (typeof descriptor.sha256 !== "string" || !SHA_RE.test(descriptor.sha256)) {
    fail(`${label} sha256 must be lowercase hex`);
  }
  if (!Number.isSafeInteger(descriptor.bytes) || descriptor.bytes <= 0) {
    fail(`${label} bytes must be a positive safe integer`);
  }
}

function validateData(repoRoot, releaseId) {
  const manifestPath = `synthesis/data/manifest.${releaseId}.json`;
  const manifestBytes = readRepoFile(repoRoot, manifestPath);
  const manifest = parseJson(manifestBytes, `manifest ${releaseId}`);
  exactKeys(manifest,
    ["formatVersion", "releaseId", "datasetId", "source", "generator", "artifacts"],
    `manifest ${releaseId}`);
  if (manifest.formatVersion !== 1) fail(`manifest ${releaseId} formatVersion must be 1`);
  if (manifest.releaseId !== releaseId) fail(`manifest releaseId mismatch for ${releaseId}`);
  if (typeof manifest.datasetId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(manifest.datasetId)) {
    fail(`manifest ${releaseId} datasetId is invalid`);
  }
  exactKeys(manifest.source, ["repo", "commit", "fullDagSha256"], `manifest ${releaseId} source`);
  if (typeof manifest.source.repo !== "string" || !manifest.source.repo) fail("manifest source repo is invalid");
  if (typeof manifest.source.commit !== "string" || !/^[0-9a-f]{40}$/.test(manifest.source.commit)) {
    fail("manifest source commit is invalid");
  }
  if (typeof manifest.source.fullDagSha256 !== "string" || !SHA_RE.test(manifest.source.fullDagSha256)
      || manifest.datasetId !== `sha256:${manifest.source.fullDagSha256}`) {
    fail("manifest source full-DAG binding is invalid");
  }
  exactKeys(manifest.generator, ["path", "sha256", "node"], `manifest ${releaseId} generator`);
  validateRepoRelativePath(manifest.generator.path, "manifest generator path");
  if (!SHA_RE.test(manifest.generator.sha256 ?? "")) fail("manifest generator sha256 is invalid");
  if (typeof manifest.generator.node !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.generator.node)) {
    fail("manifest generator node metadata is invalid");
  }
  const expectedGeneratorPath = `scripts/build-synthesis-data.${manifest.generator.sha256}.mjs`;
  if (manifest.generator.path !== expectedGeneratorPath) fail("manifest generator content-name is invalid");

  if (!isObject(manifest.artifacts)) fail("manifest artifacts must be an object");
  const allowedArtifacts = new Set(["core", "pack", "dimensions"]);
  for (const name of Object.keys(manifest.artifacts)) {
    if (!allowedArtifacts.has(name)) fail(`manifest artifacts has unknown field: ${name}`);
  }
  if (!manifest.artifacts.core) fail("manifest core artifact is required");
  const artifacts = [];
  for (const name of ["core", "pack", "dimensions"]) {
    const descriptor = manifest.artifacts[name];
    if (!descriptor) continue;
    validateDescriptor(descriptor, `manifest artifact ${name}`);
    if (!ARTIFACT_PATHS[name]?.test(descriptor.path)) {
      fail(`artifact ${name} filename must use the immutable synthesis/data policy`);
    }
    const bytes = readRepoFile(repoRoot, descriptor.path);
    if (bytes.byteLength !== descriptor.bytes) fail(`artifact ${name} bytes mismatch`);
    if (sha256(bytes) !== descriptor.sha256) fail(`artifact ${name} hash mismatch`);
    const parsed = parseJson(bytes, `artifact ${name}`);
    if ((name === "core" || name === "pack") && parsed?.datasetId !== manifest.datasetId) {
      fail(`artifact ${name} datasetId mismatch`);
    }
    artifacts.push({ name, path: descriptor.path, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  artifacts.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const generatorBytes = readRepoFile(repoRoot, manifest.generator.path);
  const generatorHash = sha256(generatorBytes);
  if (generatorHash !== manifest.generator.sha256) fail("generator hash mismatch");
  validateGenerator(generatorBytes, manifest.generator.path);

  return {
    datasetId: manifest.datasetId,
    manifest: { path: manifestPath, bytes: manifestBytes.byteLength, sha256: sha256(manifestBytes) },
    artifacts,
    generator: {
      path: manifest.generator.path,
      bytes: generatorBytes.byteLength,
      sha256: generatorHash,
      node: manifest.generator.node,
    },
  };
}

function allowlistSha(releaseId, files) {
  const normalizedFiles = files.map((file) => ({ source: file.source, target: file.target }));
  return sha256(compactJson({ formatVersion: 1, releaseId, files: normalizedFiles }));
}

function runtimeRecords(runtimeBytes) {
  return [...runtimeBytes.entries()].map(([path, bytes]) => ({
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  }));
}

function validateLockSchema(lock) {
  exactKeys(lock,
    ["formatVersion", "releaseId", "allowlistSha256", "runtime", "data", "predecessor"],
    "release lock");
  if (lock.formatVersion !== 1) fail("release lock formatVersion must be 1");
  if (!RELEASE_RE.test(lock.releaseId ?? "")) fail("release lock releaseId is invalid");
  if (!SHA_RE.test(lock.allowlistSha256 ?? "")) fail("release lock allowlistSha256 is invalid");
  if (!Array.isArray(lock.runtime)) fail("release lock runtime must be an array");
  for (const [index, entry] of lock.runtime.entries()) {
    exactKeys(entry, ["path", "bytes", "sha256"], `release lock runtime ${index}`);
    validateRepoRelativePath(entry.path, `release lock runtime ${index} path`, { target: true });
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !SHA_RE.test(entry.sha256 ?? "")) {
      fail(`release lock runtime ${index} descriptor is invalid`);
    }
  }
  exactKeys(lock.data, ["datasetId", "manifest", "artifacts", "generator"], "release lock data");
  if (typeof lock.data.datasetId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(lock.data.datasetId)) {
    fail("release lock data datasetId is invalid");
  }
  validateDescriptor(lock.data.manifest, "release lock manifest");
  if (!Array.isArray(lock.data.artifacts)) fail("release lock artifacts must be an array");
  lock.data.artifacts.forEach((entry, index) => {
    exactKeys(entry, ["name", "path", "bytes", "sha256"], `release lock artifact ${index}`);
    if (!["core", "pack", "dimensions"].includes(entry.name)) {
      fail(`release lock artifact ${index} name is invalid`);
    }
    validateDescriptor({ path: entry.path, bytes: entry.bytes, sha256: entry.sha256 },
      `release lock artifact ${index}`);
  });
  exactKeys(lock.data.generator, ["path", "bytes", "sha256", "node"], "release lock generator");
  validateDescriptor({
    path: lock.data.generator.path,
    bytes: lock.data.generator.bytes,
    sha256: lock.data.generator.sha256,
  }, "release lock generator");
  if (typeof lock.data.generator.node !== "string" || !/^\d+\.\d+\.\d+$/.test(lock.data.generator.node)) {
    fail("release lock generator node is invalid");
  }
  if (lock.predecessor !== null) {
    exactKeys(lock.predecessor, ["releaseId", "path", "bytes", "sha256"],
      "release lock predecessor");
    if (!RELEASE_RE.test(lock.predecessor.releaseId ?? "")) {
      fail("release lock predecessor releaseId is invalid");
    }
    validateDescriptor({
      path: lock.predecessor.path,
      bytes: lock.predecessor.bytes,
      sha256: lock.predecessor.sha256,
    }, "release lock predecessor");
  }
}

function walkReleaseTree(releaseDirectory) {
  const rootStat = lstatOrNull(releaseDirectory);
  if (!rootStat) fail(`release directory is missing: ${releaseDirectory}`);
  if (rootStat.isSymbolicLink()) fail("release directory may not be a symlink");
  if (!rootStat.isDirectory()) fail("release path is not a directory");
  const files = [];
  const directories = [];
  const walk = (directory, prefix) => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = join(directory, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) fail(`release tree contains symlink: ${relative}`);
      if (stat.isDirectory()) {
        directories.push(relative);
        walk(absolute, relative);
      } else if (stat.isFile()) {
        files.push(relative);
      } else {
        fail(`release tree contains non-regular file: ${relative}`);
      }
    }
  };
  walk(releaseDirectory, "");
  return { files: files.sort(), directories: directories.sort() };
}

function expectedDirectories(targets) {
  const directories = new Set();
  for (const target of targets) {
    const parts = target.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  return [...directories].sort();
}

function sameJson(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(message);
}

function isStaticLoadManifestImport(tokens, index) {
  if (!["{", ","].includes(tokens[index - 1]?.value)
      || !["}", ","].includes(tokens[index + 1]?.value)) return false;
  let importIndex = index - 1;
  while (importIndex >= 0 && tokens[importIndex].value !== ";"
      && tokens[importIndex].value !== "import") importIndex -= 1;
  if (tokens[importIndex]?.value !== "import" || tokens[importIndex + 1]?.value !== "{") return false;
  for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].value !== ";"; cursor += 1) {
    if (tokens[cursor].value === "from") {
      return tokens[cursor + 1]?.type === "string"
        && !tokens[cursor + 1].escaped
        && tokens[cursor + 1].value === "./data-loader.js";
    }
  }
  return false;
}

function assertAppBinding(runtimeBytes, releaseId) {
  const tokens = tokenizeJavaScript(runtimeBytes.get("app.js") ?? Buffer.alloc(0), "app.js");
  const calls = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== "identifier" || tokens[index].value !== "loadManifest") continue;
    if (tokens[index + 1]?.value === "(" && tokens[index - 1]?.value !== ".") {
      calls.push(index);
      continue;
    }
    if (isStaticLoadManifestImport(tokens, index)) continue;
    fail("app.js has unsupported loadManifest identifier reference");
  }
  if (calls.length !== 1) fail("released app must contain exactly one real loadManifest() call");

  const call = calls[0];
  const callClose = matchingTokenIndex(tokens, call + 1, "app.js loadManifest call");
  const expectedManifest = `synthesis/data/manifest.${releaseId}.json`;
  if (literalSpecifier(tokens[call + 2], "app.js", "loadManifest manifest") !== expectedManifest) {
    fail(`released app manifest literal does not match ${releaseId}`);
  }
  if (tokens[call + 3]?.value !== "," || tokens[call + 4]?.value !== "{") {
    fail("released app loadManifest options must be an object literal");
  }
  const optionsClose = matchingTokenIndex(tokens, call + 4, "app.js loadManifest options");
  if (optionsClose + 1 !== callClose) {
    fail("released app loadManifest call must have exactly two arguments");
  }

  let bindingCount = 0;
  for (let index = call + 5; index < optionsClose; index += 1) {
    const propertyStart = ["{", ","].includes(tokens[index - 1]?.value);
    if (propertyStart && tokens[index].value === "."
        && tokens[index + 1]?.value === "." && tokens[index + 2]?.value === ".") {
      fail("released app loadManifest options may not use spread properties");
    }
    if (tokens[index].value === "[") {
      fail("released app loadManifest options may not use computed properties");
    }
    if (propertyStart && tokens[index].type === "string" && tokens[index].escaped) {
      fail("released app loadManifest options may not use escaped property names");
    }
    if (["(", "[", "{"].includes(tokens[index].value)) {
      index = matchingTokenIndex(tokens, index, "app.js loadManifest options");
      continue;
    }
    const isBindingName = (tokens[index].type === "identifier" || tokens[index].type === "string")
      && tokens[index].value === "expectedReleaseId";
    if (!isBindingName) continue;
    if (!propertyStart || tokens[index + 1]?.value !== ":") {
      fail("released app expectedReleaseId must use a plain object property");
    }
    bindingCount += 1;
    const value = tokens[index + 2];
    if (value?.type !== "string" || value.escaped || value.value !== releaseId
        || ![",", "}"].includes(tokens[index + 3]?.value)) {
      fail(`released app expectedReleaseId must be the literal "${releaseId}"`);
    }
  }
  if (bindingCount !== 1) {
    fail("released app loadManifest options must contain exactly one expectedReleaseId binding");
  }
}

export function previousReleaseId(releaseId) {
  if (!RELEASE_RE.test(releaseId)) fail(`invalid release: ${releaseId}`);
  const number = BigInt(releaseId.slice(1));
  return number === 1n ? null : `v${number - 1n}`;
}

function checkRelease(repoRoot, config, releaseId, {
  releaseDirectory = join(repoRoot, "synthesis", "releases", releaseId),
  visited = new Set(),
} = {}) {
  if (visited.has(releaseId)) fail(`predecessor cycle detected at ${releaseId}`);
  if (visited.size > 100) fail("predecessor chain is too deep");
  visited.add(releaseId);
  const release = config.releases[releaseId];
  if (!release) fail(`release ${releaseId} is not configured`);

  const expectedFileList = [...release.files.map((file) => file.target), "release-lock.json"].sort();
  const tree = walkReleaseTree(releaseDirectory);
  if (JSON.stringify(tree.files) !== JSON.stringify(expectedFileList)) {
    fail(`release file set mismatch for ${releaseId}`);
  }
  const directories = expectedDirectories(release.files.map((file) => file.target));
  if (JSON.stringify(tree.directories) !== JSON.stringify(directories)) {
    fail(`release directory set mismatch for ${releaseId}`);
  }

  const runtimeBytes = new Map();
  for (const file of release.files) {
    const path = join(releaseDirectory, ...file.target.split("/"));
    runtimeBytes.set(file.target, readRegularFileNoFollow(path, `release runtime ${file.target}`));
  }
  analyzeRuntime(runtimeBytes);
  assertAppBinding(runtimeBytes, releaseId);
  const data = validateData(repoRoot, releaseId);

  let predecessor = null;
  const previous = previousReleaseId(releaseId);
  if (previous) {
    if (!config.releases[previous]) fail(`predecessor ${previous} is not configured`);
    checkRelease(repoRoot, config, previous, { visited });
    const predecessorPath = `synthesis/releases/${previous}/release-lock.json`;
    const predecessorBytes = readRepoFile(repoRoot, predecessorPath);
    predecessor = {
      releaseId: previous,
      path: predecessorPath,
      bytes: predecessorBytes.byteLength,
      sha256: sha256(predecessorBytes),
    };
  }

  const expectedLock = {
    formatVersion: 1,
    releaseId,
    allowlistSha256: allowlistSha(releaseId, release.files),
    runtime: runtimeRecords(runtimeBytes),
    data,
    predecessor,
  };
  const lockPath = join(releaseDirectory, "release-lock.json");
  const lockBytes = readRegularFileNoFollow(lockPath, "release lock");
  const lock = parseJson(lockBytes, "release lock");
  validateLockSchema(lock);
  sameJson(lock, expectedLock, `release lock mismatch for ${releaseId}`);
  if (!lockBytes.equals(canonicalJson(expectedLock))) fail(`release lock is not canonical for ${releaseId}`);
  visited.delete(releaseId);
  return { runtimeBytes, lock: expectedLock };
}

function ensureReleaseParent(repoRoot) {
  const synthesis = inspectRepoPath(repoRoot, "synthesis", { file: false });
  const releases = join(synthesis, "releases");
  const stat = lstatOrNull(releases);
  if (stat) {
    if (stat.isSymbolicLink()) fail("synthesis/releases may not be a symlink");
    if (!stat.isDirectory()) fail("synthesis/releases is not a directory");
  } else {
    mkdirSync(releases);
  }
  return releases;
}

function assertDestinationAbsent(destination) {
  if (lstatOrNull(destination)) fail(`release destination already exists: ${destination}`);
}

function captureOwnedDirectory(path, label) {
  const stat = lstatOrNull(path);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`${label} was not created as a regular directory`);
  }
  return { dev: stat.dev, ino: stat.ino };
}

function removeOwnedDirectory(path, identity, label, { recursive = false } = {}) {
  const stat = lstatOrNull(path);
  if (!stat) return;
  if (stat.isSymbolicLink() || !stat.isDirectory()
      || !sameFilesystemIdentity(identity, stat)) {
    fail(`${label} filesystem identity changed; refusing cleanup`);
  }
  if (recursive) rmSync(path, { recursive: true, force: false });
  else rmdirSync(path);
}

function writeRelease(repoRoot, config, releaseId) {
  const release = config.releases[releaseId];
  if (!release) fail(`release ${releaseId} is not configured`);

  const runtimeBytes = new Map();
  for (const file of release.files) runtimeBytes.set(file.target, readRepoFile(repoRoot, file.source));
  analyzeRuntime(runtimeBytes);
  assertAppBinding(runtimeBytes, releaseId);
  const data = validateData(repoRoot, releaseId);

  let predecessor = null;
  const previous = previousReleaseId(releaseId);
  if (previous) {
    if (!config.releases[previous]) fail(`predecessor ${previous} is not configured`);
    checkRelease(repoRoot, config, previous);
    const predecessorPath = `synthesis/releases/${previous}/release-lock.json`;
    const bytes = readRepoFile(repoRoot, predecessorPath);
    predecessor = {
      releaseId: previous,
      path: predecessorPath,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    };
  }

  const lock = {
    formatVersion: 1,
    releaseId,
    allowlistSha256: allowlistSha(releaseId, release.files),
    runtime: runtimeRecords(runtimeBytes),
    data,
    predecessor,
  };

  const releases = join(repoRoot, "synthesis", "releases");
  const destination = join(releases, releaseId);
  if (lstatOrNull(releases)) assertDestinationAbsent(destination);
  const releaseParent = ensureReleaseParent(repoRoot);
  assertDestinationAbsent(destination);
  const buildLock = join(releaseParent, `.${releaseId}.build-lock`);
  const temporary = join(releaseParent,
    `.${releaseId}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
  let lockIdentity = null;
  let temporaryIdentity = null;
  try {
    try {
      mkdirSync(buildLock);
      lockIdentity = captureOwnedDirectory(buildLock, "build lock");
    } catch (error) {
      if (error?.code === "EEXIST") fail(`build lock already exists for ${releaseId}`);
      throw error;
    }
    assertDestinationAbsent(destination);
    mkdirSync(temporary);
    temporaryIdentity = captureOwnedDirectory(temporary, "temporary release");
    for (const file of release.files) {
      assertDirectoryIdentity(buildLock, lockIdentity, "build lock");
      assertDirectoryIdentity(temporary, temporaryIdentity, "temporary release");
      const output = join(temporary, ...file.target.split("/"));
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, runtimeBytes.get(file.target), { flag: "wx" });
    }
    assertDirectoryIdentity(buildLock, lockIdentity, "build lock");
    assertDirectoryIdentity(temporary, temporaryIdentity, "temporary release");
    writeFileSync(join(temporary, "release-lock.json"), canonicalJson(lock), { flag: "wx" });
    assertDirectoryIdentity(buildLock, lockIdentity, "build lock");
    assertDirectoryIdentity(temporary, temporaryIdentity, "temporary release");
    checkRelease(repoRoot, config, releaseId, { releaseDirectory: temporary });
    assertDestinationAbsent(destination);
    assertDirectoryIdentity(buildLock, lockIdentity, "build lock");
    assertDirectoryIdentity(temporary, temporaryIdentity, "temporary release");
    renameSync(temporary, destination);
    assertDirectoryIdentity(destination, temporaryIdentity, "release destination");
    temporaryIdentity = null;
  } finally {
    let cleanupError = null;
    try {
      if (temporaryIdentity) {
        removeOwnedDirectory(temporary, temporaryIdentity, "temporary release", { recursive: true });
      }
    } catch (error) {
      cleanupError = error;
    }
    try {
      if (lockIdentity) removeOwnedDirectory(buildLock, lockIdentity, "build lock");
    } catch (error) {
      cleanupError ??= error;
    }
    if (cleanupError) throw cleanupError;
  }
}

export async function runCli(argv, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  if (typeof repoRoot !== "string" || !repoRoot) fail("repoRoot must be a path");
  const root = resolve(repoRoot);
  const { release, mode } = parseCli(argv);
  const config = readConfig(root);
  if (!config.releases[release]) fail(`release ${release} is not configured`);
  if (mode === "--write") {
    writeRelease(root, config, release);
    return;
  }
  const checked = checkRelease(root, config, release);
  if (mode === "--check-source") {
    const releaseConfig = config.releases[release];
    for (const file of releaseConfig.files) {
      const sourceBytes = readRepoFile(root, file.source);
      const releaseBytes = checked.runtimeBytes.get(file.target);
      if (!sourceBytes.equals(releaseBytes)) fail(`source differs from release target: ${file.target}`);
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
