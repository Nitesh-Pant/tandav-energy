export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a))
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v)
  return t * t * (3 - 2 * t)
}
/** Frame-rate independent exponential approach. `lambda` ≈ 1 / time-constant. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

/** Deterministic PRNG so procedural geometry is identical across reloads. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth 1D value noise in [-1, 1], used for CPU-side wobble. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const h = (n: number) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
  }
  const u = f * f * (3 - 2 * f)
  return lerp(h(i), h(i + 1), u)
}

export function fbm1(x: number, seed = 0, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let o = 0; o < octaves; o++) {
    sum += noise1(x * freq, seed + o * 13) * amp
    freq *= 2.03
    amp *= 0.5
  }
  return sum
}
