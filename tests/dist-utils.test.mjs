import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDist, alignDist, roundPy, cmpStr } from "../synthesis/dist-utils.js";
import { assertDeepClose } from "./helpers.mjs";

test("normalizeDist basic / degenerate / dirty input", () => {
  assertDeepClose(normalizeDist([3, 1]), [0.75, 0.25]);
  assertDeepClose(normalizeDist([0, 0, 0]), [1 / 3, 1 / 3, 1 / 3]);
  assertDeepClose(normalizeDist([-1, NaN, 2]), [0, 0, 1]);
  assertDeepClose(normalizeDist([Infinity, 1]), [0, 1]);
  assertDeepClose(normalizeDist([Number.MAX_VALUE, Number.MAX_VALUE]), [0.5, 0.5]);
});

test("alignDist mapping / source_values / plain list", () => {
  assertDeepClose(alignDist({ b: 1, a: 3 }, ["a", "b"]), [0.75, 0.25]);
  // 行按 sourceValues 命名，重排到 values 序；缺失值补 0
  assertDeepClose(alignDist([0.75, 0.25], ["c0", "c1"], ["c1", "c0"]), [0.25, 0.75]);
  assertDeepClose(alignDist([0.9], ["x", "y"], ["y"]), [0, 1]);
  assertDeepClose(alignDist([2, 2], ["x", "y"]), [0.5, 0.5]);
});

test("roundPy matches Python round semantics", () => {
  assert.equal(roundPy(0.125, 2), 0.12);   // half-even down
  assert.equal(roundPy(0.135, 2), 0.14);
  assert.equal(roundPy(2.5, 0), 2);
  assert.equal(roundPy(3.5, 0), 4);
  assert.equal(roundPy(1.23456789, 4), 1.2346);
  // 真实 full DAG / marginal 回归：x*10**n 会给出相反结果。
  assert.equal(roundPy(0.04375, 4), 0.0437);
  assert.equal(roundPy(0.05625, 4), 0.0563);
  assert.equal(roundPy(1 / 160, 4), 0.0063);
  assert.ok(Object.is(roundPy(-0.5, 0), -0));
});

test("cmpStr is code-unit order", () => {
  assert.ok(cmpStr("a", "b") < 0);
  assert.equal(cmpStr("a", "a"), 0);
  assert.ok(cmpStr("b", "a") > 0);
});
