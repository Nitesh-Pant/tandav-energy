import { DataTexture, LinearFilter, RedFormat, RepeatWrapping, UnsignedByteType } from 'three'
import { mulberry32 } from './math'

let shared: DataTexture | null = null

/**
 * Tileable fractal value-noise texture generated once on the CPU. Sampling a
 * texture is far cheaper than per-pixel fbm for large translucent layers.
 */
export function getNoiseTexture(size = 256): DataTexture {
  if (shared) return shared
  const rand = mulberry32(1337)
  const data = new Uint8Array(size * size)
  const acc = new Float32Array(size * size)
  let amp = 0.5
  let total = 0
  for (let period = 8; period <= size / 2; period *= 2) {
    const lattice = new Float32Array(period * period)
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand()
    const cell = size / period
    for (let y = 0; y < size; y++) {
      const gy = y / cell
      const y0 = Math.floor(gy)
      const fy = gy - y0
      const sy = fy * fy * (3 - 2 * fy)
      for (let x = 0; x < size; x++) {
        const gx = x / cell
        const x0 = Math.floor(gx)
        const fx = gx - x0
        const sx = fx * fx * (3 - 2 * fx)
        const L = (ix: number, iy: number) => lattice[(iy % period) * period + (ix % period)]
        const a = L(x0, y0) + (L(x0 + 1, y0) - L(x0, y0)) * sx
        const b = L(x0, y0 + 1) + (L(x0 + 1, y0 + 1) - L(x0, y0 + 1)) * sx
        acc[y * size + x] += (a + (b - a) * sy) * amp
      }
    }
    total += amp
    amp *= 0.55
  }
  for (let i = 0; i < acc.length; i++) data[i] = Math.round((acc[i] / total) * 255)
  const tex = new DataTexture(data, size, size, RedFormat, UnsignedByteType)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.magFilter = tex.minFilter = LinearFilter
  tex.needsUpdate = true
  shared = tex
  return tex
}
