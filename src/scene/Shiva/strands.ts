/**
 * Verlet-simulated ribbons for the flying jata (matted locks) and the sash.
 * Simulated in world space so they trail the dance with real inertia;
 * rendered as camera-facing ribbons written into one preallocated buffer.
 */

import { BufferAttribute, BufferGeometry, Quaternion, Vector3 } from 'three'
import { mulberry32 } from '../../utils/math'

export interface StrandDef {
  attach: 'head' | 'waist'
  offset: [number, number, number]
  dir: [number, number, number]
  length: number
  width0: number
  width1: number
  wave: number
  stiffness: number
}

export interface AttachFrame {
  p: Vector3
  q: Quaternion
}

const SEGMENTS = 12

export function hairDefs(): StrandDef[] {
  const rand = mulberry32(7)
  const defs: StrandDef[] = []
  // Locks fan out sideways in the frontal plane, as in the Chola bronzes.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const a = -0.6 + i * 0.22 + (rand() - 0.5) * 0.1 // radians below/above horizontal
      defs.push({
        attach: 'head',
        offset: [side * 0.03, 0.05 + (rand() - 0.5) * 0.04, -0.06],
        dir: [side * Math.cos(a), Math.sin(a), -0.12 - rand() * 0.15],
        length: 0.72 + rand() * 0.38 - Math.abs(a) * 0.25,
        width0: 0.028,
        width1: 0.006 + rand() * 0.005,
        wave: 0.08 + rand() * 0.07,
        stiffness: 5 + rand() * 3,
      })
    }
  }
  return defs
}

export function sashDefs(): StrandDef[] {
  return [
    { attach: 'waist', offset: [0.12, 0.08, 0.08], dir: [1, 0.05, 0.2], length: 0.62, width0: 0.05, width1: 0.012, wave: 0.1, stiffness: 4.5 },
    { attach: 'waist', offset: [0.13, 0.04, 0.03], dir: [1, -0.3, 0.05], length: 0.5, width0: 0.04, width1: 0.01, wave: 0.09, stiffness: 4 },
  ]
}

const _a = new Vector3()
const _b = new Vector3()
const _t = new Vector3()
const _s = new Vector3()
const _rest = new Vector3()
const _dir = new Vector3()
const _perp = new Vector3()

export class StrandSystem {
  readonly geometry = new BufferGeometry()
  private pos: Float32Array
  private prev: Float32Array
  private verts: Float32Array
  private initialised = false

  constructor(
    private defs: StrandDef[],
    private scale: number,
  ) {
    const n = defs.length * SEGMENTS
    this.pos = new Float32Array(n * 3)
    this.prev = new Float32Array(n * 3)
    this.verts = new Float32Array(n * 2 * 3)
    const uv = new Float32Array(n * 2 * 2)
    const index: number[] = []
    defs.forEach((_, s) => {
      for (let i = 0; i < SEGMENTS; i++) {
        const v = (s * SEGMENTS + i) * 2
        uv.set([i / (SEGMENTS - 1), 0, i / (SEGMENTS - 1), 1], v * 2)
        if (i < SEGMENTS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    })
    this.geometry.setAttribute('position', new BufferAttribute(this.verts, 3))
    this.geometry.setAttribute('uv', new BufferAttribute(uv, 2))
    this.geometry.setIndex(index)
  }

  reset() {
    this.initialised = false
  }

  update(dt: number, frames: Record<'head' | 'waist', AttachFrame>, camera: Vector3, time: number, turbulence: number) {
    const k = 1 - Math.exp(-dt * 60) // normalise per-frame constants to 60 fps
    this.defs.forEach((d, s) => {
      const f = frames[d.attach]
      const seg = (d.length * this.scale) / (SEGMENTS - 1)
      _dir.set(d.dir[0], d.dir[1], d.dir[2]).normalize().applyQuaternion(f.q)
      _perp.set(0, 1, 0).cross(_dir).normalize()
      _a.set(d.offset[0], d.offset[1], d.offset[2]).multiplyScalar(this.scale).applyQuaternion(f.q)
      const rx = f.p.x + _a.x
      const ry = f.p.y + _a.y
      const rz = f.p.z + _a.z

      for (let i = 0; i < SEGMENTS; i++) {
        const o = (s * SEGMENTS + i) * 3
        const u = i / (SEGMENTS - 1)
        // Rest shape: straight out along dir, with a travelling wave and a little droop.
        const phase = time * (1.4 + turbulence * 1.6) - i * 0.5 + s * 1.7
        const w = Math.sin(phase) * d.wave * this.scale * u * (0.5 + turbulence)
        const droop = -u * u * 0.08 * this.scale
        _rest.set(rx, ry, rz).addScaledVector(_dir, seg * i).addScaledVector(_perp, w)
        _rest.y += droop + Math.cos(phase * 0.7) * w * 0.6

        if (!this.initialised || i === 0) {
          this.pos[o] = this.prev[o] = _rest.x
          this.pos[o + 1] = this.prev[o + 1] = _rest.y
          this.pos[o + 2] = this.prev[o + 2] = _rest.z
          continue
        }
        const x = this.pos[o]
        const y = this.pos[o + 1]
        const z = this.pos[o + 2]
        const damping = 0.9
        const spring = Math.min(1, d.stiffness * dt * (1.2 - u * 0.6))
        let nx = x + (x - this.prev[o]) * damping * k
        let ny = y + (y - this.prev[o + 1]) * damping * k
        let nz = z + (z - this.prev[o + 2]) * damping * k
        nx += (_rest.x - nx) * spring
        ny += (_rest.y - ny) * spring
        nz += (_rest.z - nz) * spring
        this.prev[o] = x
        this.prev[o + 1] = y
        this.prev[o + 2] = z
        // Follow-the-leader length constraint keeps segments rigid.
        const po = o - 3
        _t.set(nx - this.pos[po], ny - this.pos[po + 1], nz - this.pos[po + 2])
        const len = _t.length() || 1
        _t.multiplyScalar(seg / len)
        this.pos[o] = this.pos[po] + _t.x
        this.pos[o + 1] = this.pos[po + 1] + _t.y
        this.pos[o + 2] = this.pos[po + 2] + _t.z
      }

      // Ribbon expansion facing the camera.
      for (let i = 0; i < SEGMENTS; i++) {
        const o = (s * SEGMENTS + i) * 3
        const a = Math.max(0, i - 1) * 3 + s * SEGMENTS * 3
        const b = Math.min(SEGMENTS - 1, i + 1) * 3 + s * SEGMENTS * 3
        _t.set(this.pos[b] - this.pos[a], this.pos[b + 1] - this.pos[a + 1], this.pos[b + 2] - this.pos[a + 2])
        _b.set(camera.x - this.pos[o], camera.y - this.pos[o + 1], camera.z - this.pos[o + 2])
        _s.crossVectors(_t, _b).normalize()
        const u = i / (SEGMENTS - 1)
        const width = (d.width0 + (d.width1 - d.width0) * u) * this.scale
        const v = o * 2
        this.verts[v] = this.pos[o] - _s.x * width
        this.verts[v + 1] = this.pos[o + 1] - _s.y * width
        this.verts[v + 2] = this.pos[o + 2] - _s.z * width
        this.verts[v + 3] = this.pos[o] + _s.x * width
        this.verts[v + 4] = this.pos[o + 1] + _s.y * width
        this.verts[v + 5] = this.pos[o + 2] + _s.z * width
      }
    })
    this.initialised = true
    const attr = this.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }

  dispose() {
    this.geometry.dispose()
  }
}
