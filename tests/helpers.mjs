import assert from "node:assert/strict";

export function assertDeepClose(actual, expected, { atol = 1e-9, path = "$" } = {}) {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number", `${path}: expected number, got ${typeof actual}`);
    if (Number.isFinite(expected)) {
      assert.ok(Math.abs(actual - expected) <= atol,
        `${path}: |${actual} - ${expected}| > ${atol}`);
    } else {
      assert.equal(actual, expected, `${path}: ${actual} !== ${expected}`);
    }
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: expected array`);
    assert.equal(actual.length, expected.length, `${path}: length ${actual.length} !== ${expected.length}`);
    expected.forEach((item, i) =>
      assertDeepClose(actual[i], item, { atol, path: `${path === "$" ? "" : path}[${i}]` || `[${i}]` }));
    return;
  }
  if (expected !== null && typeof expected === "object") {
    assert.ok(actual !== null && typeof actual === "object" && !Array.isArray(actual),
      `${path}: expected object`);
    const ak = Object.keys(actual).sort();
    const ek = Object.keys(expected).sort();
    assert.deepEqual(ak, ek, `${path}: keys ${ak} !== ${ek}`);
    for (const key of ek) {
      assertDeepClose(actual[key], expected[key],
        { atol, path: path === "$" ? key : `${path}.${key}` });
    }
    return;
  }
  assert.equal(actual, expected, `${path}: ${actual} !== ${expected}`);
}
