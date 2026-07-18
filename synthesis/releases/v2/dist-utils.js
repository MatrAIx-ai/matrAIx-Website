// Ports of persona/synthesis/sampler/sampler.py::_normalize / _align_dist (float64).

export function normalizeDist(arr) {
  const out = Array.from(arr, (x) => {
    const v = Number(x);
    return Number.isFinite(v) ? Math.max(v, 0) : 0;
  });
  const max = Math.max(0, ...out);
  if (max === 0) return out.map(() => 1 / out.length);
  // 先按最大值缩放，避免多个有限大数求和时溢出到 Infinity。
  const scaled = out.map((x) => x / max);
  const sum = scaled.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0) throw new RangeError("non-finite normalized mass");
  return scaled.map((x) => x / sum);
}

export function alignDist(dist, values, sourceValues = null) {
  if (dist !== null && typeof dist === "object" && !Array.isArray(dist)) {
    return normalizeDist(values.map((v) => Number(dist[v] ?? 0)));
  }
  const list = Array.from(dist ?? [], Number);
  if (sourceValues) {
    const byName = new Map();
    const n = Math.min(sourceValues.length, list.length);
    for (let i = 0; i < n; i++) byName.set(sourceValues[i], list[i]);
    return normalizeDist(values.map((v) => byName.get(v) ?? 0));
  }
  return normalizeDist(list);
}

// Python round(x, ndigits) for the finite values used by this port. Decompose
// the original IEEE-754 binary64 value, multiply the exact rational by 10**n,
// and perform integer half-even rounding. Never pre-round through x * 10**n.
const roundBuffer = new ArrayBuffer(8);
const roundView = new DataView(roundBuffer);
export function roundPy(x, ndigits) {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new TypeError("x must be finite");
  if (!Number.isInteger(ndigits) || ndigits < 0 || ndigits > 15) {
    throw new RangeError("ndigits must be an integer in 0..15");
  }
  if (x === 0) return x;

  const sign = x < 0 ? -1 : 1;
  roundView.setFloat64(0, Math.abs(x), false);
  const hi = roundView.getUint32(0, false);
  const lo = roundView.getUint32(4, false);
  const exponentBits = (hi >>> 20) & 0x7ff;
  let significand = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exponent2;
  if (exponentBits === 0) {
    exponent2 = -1074;
  } else {
    significand |= 1n << 52n;
    exponent2 = exponentBits - 1023 - 52;
  }

  const n = BigInt(ndigits);
  let numerator = significand * (5n ** n);
  exponent2 += ndigits;
  let denominator = 1n;
  if (exponent2 >= 0) numerator <<= BigInt(exponent2);
  else denominator <<= BigInt(-exponent2);

  let q = numerator / denominator;
  const twiceRemainder = 2n * (numerator % denominator);
  if (twiceRemainder > denominator ||
      (twiceRemainder === denominator && (q & 1n) === 1n)) q += 1n;

  const roundedInteger = Number(q);
  if (!Number.isSafeInteger(roundedInteger)) {
    throw new RangeError("rounded integer exceeds exact port domain");
  }
  return sign * roundedInteger / (10 ** ndigits);
}

export const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
