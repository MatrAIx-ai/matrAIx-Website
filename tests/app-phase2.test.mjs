import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../synthesis/app.js", import.meta.url), "utf8");

function extractFunction(source, declaration) {
  const start = source.indexOf(declaration);
  assert.ok(start >= 0, `${declaration} must exist`);
  const declarationEnd = source.indexOf("\n", start);
  const brace = source.lastIndexOf("{", declarationEnd);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${declaration}`);
}

test("app declares the phase-2 state and generation modules", () => {
  for (const moduleName of [
    "adjust-panel.js",
    "results-panel.js",
    "sampler-client.js",
    "request-schema.js",
  ]) {
    assert.match(app, new RegExp(`from "\\./${moduleName.replace(".", "\\.")}"`));
  }
  for (const initializer of [
    /recipe:\s*\[\]/,
    /controls:\s*\{\s*\.\.\.DEFAULT_CONTROLS\s*\}/,
    /results:\s*null/,
    /overlayIndex:\s*null/,
    /generating:\s*false/,
    /activeJobId:\s*null/,
    /generateError:\s*null/,
  ]) assert.match(app, initializer);
});

test("Generate synchronously expands then validates the click-time request before client run", () => {
  const start = app.indexOf("const onGenerate = () => {");
  assert.ok(start >= 0, "onGenerate must be a synchronous callback");
  const end = app.indexOf("\n  };", start);
  const body = app.slice(start, end);
  assert.doesNotMatch(body, /\bawait\b|\basync\b/);
  const expand = body.indexOf("recipeToRequest(");
  const validate = body.indexOf("validateSampleRequest(");
  const run = body.indexOf("samplerClient.run(");
  assert.ok(expand >= 0 && validate > expand && run > validate,
    "Generate must execute recipeToRequest -> validateSampleRequest -> client.run");
  assert.match(body, /marginalNodeIds:\s*\[state\.centerNode\]/);
  const validationCatch = body.slice(body.indexOf("} catch (error)"));
  assert.match(validationCatch, /\{ generateError: safeError \}/);
  assert.doesNotMatch(validationCatch, /generating:\s*false|activeJobId:\s*null/,
    "an invalid restart must not orphan the already-running snapshotted job");
});

test("app constructs only module workers and applies latest-job result semantics", () => {
  assert.match(app,
    /createWorker:\s*\(\)\s*=>\s*new Worker\(new URL\("\.\/sampler-worker\.js", import\.meta\.url\), \{ type: "module" \}\)/);
  assert.match(app, /dataset:\s*\{\s*manifest,\s*baseUrl:\s*document\.baseURI\s*\}/);
  assert.match(app, /if \(jobId !== state\.activeJobId\) return;/);
  assert.match(app,
    /results:\s*result,[\s\S]*?overlayIndex:\s*null,[\s\S]*?generating:\s*false/);
  assert.match(app,
    /generateError:\s*error,[\s\S]*?generating:\s*false/);
});

test("recipe history, cap rejection, and renderer slices preserve results focus", () => {
  assert.match(app, /MAX_RECIPE_ENTRIES/);
  assert.match(app, /recipe\.length\s*>=\s*MAX_RECIPE_ENTRIES/);
  assert.match(app, /"push",\s*\["recipe", "generateError"\]/);
  assert.match(app, /"replace",\s*\["recipe", "generateError"\]/);
  assert.match(app,
    /createDrilldownRenderer\([\s\S]*?slices:\s*\["store", "centerNode", "selectedNode", "up", "down", "results", "overlayIndex"\]/);
  assert.match(app,
    /createResultsPanel\([\s\S]*?slices:\s*\["store", "manifest", "results", "generateError"\]/);
  assert.doesNotMatch(app,
    /createResultsPanel\([\s\S]*?slices:\s*\[[^\]]*"overlayIndex"/,
    "results selection updates in place, so overlay changes must not remount its focused button");
});

test("draft edits validate the complete persisted cfg before committing state or history", () => {
  assert.match(app, /DEFAULT_CONTROLS,[\s\S]*?validateSampleRequest,[\s\S]*?validateUrlConfig,/);
  const start = app.indexOf("const commitDraft = (");
  const end = app.indexOf("\n  };", start);
  const body = app.slice(start, end);
  const validate = body.indexOf("validateUrlConfig(");
  const commit = body.indexOf("setState(normalizedPatch");
  assert.ok(validate >= 0 && commit > validate,
    "schema-invalid controls or priors must not overwrite the last reproducible URL/state");
  assert.match(body, /error instanceof SynthesisValidationError/);
  assert.match(body, /historyMode: "none", dirtySlices: \["generateError"\]/);
});

test("debug state publishes only a compact result summary", () => {
  const start = app.indexOf("function publishDebugSnapshot()");
  const end = app.indexOf("\n}\n\npublishDebugSnapshot", start);
  const body = app.slice(start, end);
  assert.match(body, /resultSummary/);
  assert.doesNotMatch(body, /structuredClone\(state\.results\)|personaCodes:\s*state\.results/);
});

test("setState leaves state, debug output, and render scheduling untouched when history rejects", () => {
  const declaration = extractFunction(app, "export function setState").replace("export ", "");
  const state = { manifest: { releaseId: "v2" }, selectedNode: "old" };
  let debugPublishes = 0;
  let renderSchedules = 0;
  const makeSetState = new Function(
    "state",
    "history",
    "location",
    "encodeUrlState",
    "publishDebugSnapshot",
    "scheduleAffectedRenderers",
    `${declaration}; return setState;`,
  );
  const setState = makeSetState(
    state,
    {
      replaceState() {
        throw new DOMException("too frequent", "SecurityError");
      },
    },
    new URL("https://example.test/synthesis.html"),
    () => new URL("https://example.test/synthesis.html?node=new"),
    () => { debugPublishes += 1; },
    () => { renderSchedules += 1; },
  );

  assert.throws(
    () => setState({ selectedNode: "new" }),
    (error) => error instanceof DOMException && error.name === "SecurityError",
  );
  assert.equal(state.selectedNode, "old");
  assert.equal(debugPublishes, 0);
  assert.equal(renderSchedules, 0);
});
