// Deterministic seeded RNG: SplitMix64 expands the exact 53-bit seed into
// 128 bits of sfc32 state. BigInt avoids the old many-to-one 32-bit fold.
// Deliberately NOT numpy-compatible; cross-language parity is verified
// statistically against Python goldens.
const MASK64 = (1n << 64n) - 1n;

function splitmix64(seed) {
  let state = seed & MASK64;
  return function next() {
    state = (state + 0x9e3779b97f4a7c15n) & MASK64;
    let value = state;
    value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (value ^ (value >> 31n)) & MASK64;
  };
}

export function createRng(seed) {
  if (typeof seed !== "number" || !Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError("seed must be an integer in 0..Number.MAX_SAFE_INTEGER");
  }

  const split = splitmix64(BigInt(seed));
  const x = split();
  const y = split();
  let a = Number(x & 0xffffffffn) >>> 0;
  let b = Number(x >> 32n) >>> 0;
  let c = Number(y & 0xffffffffn) >>> 0;
  let d = Number(y >> 32n) >>> 0;

  function sfc() {
    const result = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + result) >>> 0;
    return result;
  }

  for (let i = 0; i < 12; i++) sfc();
  return () => sfc() / 4_294_967_296;
}
