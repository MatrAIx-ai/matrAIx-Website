import { test } from "node:test";
import assert from "node:assert/strict";
import { assertDeepClose } from "./helpers.mjs";

test("equal structures pass", () => {
  assertDeepClose({ a: [1, 2.0000000001], b: "x" }, { a: [1, 2], b: "x" }, { atol: 1e-8 });
});

test("numeric drift beyond atol fails with path", () => {
  assert.throws(
    () => assertDeepClose({ a: { b: [0.1] } }, { a: { b: [0.2] } }),
    /a\.b\[0\]/
  );
});

test("shape mismatch fails", () => {
  assert.throws(() => assertDeepClose([1, 2], [1, 2, 3]));
  assert.throws(() => assertDeepClose({ x: 1 }, { y: 1 }));
});
