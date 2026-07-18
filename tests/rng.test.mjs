import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../synthesis/rng.js";

test("deterministic per seed", () => {
  const a = createRng(42);
  const b = createRng(42);
  const c = createRng(43);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  const seqC = Array.from({ length: 8 }, () => c());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
});

test("matches the locked SplitMix64-to-sfc32 sequence", () => {
  const rng = createRng(42);
  assert.deepEqual(
    Array.from({ length: 8 }, () => rng() * 4_294_967_296),
    [
      1_281_811_455,
      3_891_476_829,
      219_889_211,
      2_835_935_739,
      2_097_133_875,
      3_110_773_643,
      76_829_781,
      3_886_653_979,
    ],
  );
});

test("range and rough uniformity", () => {
  const rng = createRng(7);
  let sum = 0;
  for (let i = 0; i < 20_000; i++) {
    const value = rng();
    assert.ok(value >= 0 && value < 1);
    sum += value;
  }
  assert.ok(Math.abs(sum / 20_000 - 0.5) < 0.01);
});

test("large seeds (up to 2^53-1) produce distinct streams", () => {
  const a = createRng(Number.MAX_SAFE_INTEGER);
  const b = createRng(Number.MAX_SAFE_INTEGER - 1);
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("does not collapse the known old 53-to-32-bit collision", () => {
  const a = createRng(0);
  const b = createRng(6_949_403_057);
  assert.notDeepEqual(
    Array.from({ length: 8 }, () => a()),
    Array.from({ length: 8 }, () => b()),
  );
});

test("does not truncate seeds that share the same low 32 bits", () => {
  const low = createRng(0);
  const high = createRng(2 ** 32);
  assert.notDeepEqual(
    Array.from({ length: 8 }, () => low()),
    Array.from({ length: 8 }, () => high()),
  );
});

test("rejects non-integer, negative and unsafe seeds", () => {
  for (const seed of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", true]) {
    assert.throws(() => createRng(seed));
  }
});
