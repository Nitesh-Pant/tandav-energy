import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, ShaderMaterial, Vector3 } from 'three'
import { LAYOUT } from '../../config'
import { anchors } from '../../choreography/anchors'
import { visualEvents } from '../../choreography/events'
import { stage } from '../../choreography/stage'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'

const POOL = 4
const MAX_SEG = 320

/** Re-strike flicker: real lightning pulses several times along the same channel. */
function envelope(t: number) {
  if (t < 0) return 0
  const pulses = [
    [0, 1, 0.05],
    [0.09, 0.75, 0.05],
    [0.17, 0.5, 0.06],
    [0.3, 0.35, 0.12],
  ]
  let v = 0
  for (const [at, amp, dur] of pulses) {
    const d = t - at
    if (d >= 0) v = Math.max(v, amp * Math.exp(-d / dur))
  }
  return v
}

interface Bolt {
  geometry: BufferGeometry
  pos: Float32Array
  other: Float32Array
  width: Float32Array
  bright: Float32Array
  age: number
  strength: number
  active: boolean
  flash: Vector3
  segs: number
}

function createBolt(): Bolt {
  const n = MAX_SEG * 4
  const pos = new Float32Array(n * 3)
  const other = new Float32Array(n * 3)
  const side = new Float32Array(n)
  const width = new Float32Array(n)
  const bright = new Float32Array(n)
  const index = new Uint16Array(MAX_SEG * 6)
  for (let s = 0; s < MAX_SEG; s++) {
    const v = s * 4
    side.set([-1, 1, -1, 1], v)
    index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], s * 6)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage))
  g.setAttribute('aOther', new BufferAttribute(other, 3).setUsage(DynamicDrawUsage))
  g.setAttribute('aSide', new BufferAttribute(side, 1))
  g.setAttribute('aWidth', new BufferAttribute(width, 1).setUsage(DynamicDrawUsage))
  g.setAttribute('aBright', new BufferAttribute(bright, 1).setUsage(DynamicDrawUsage))
  g.setIndex(new BufferAttribute(index, 1))
  g.setDrawRange(0, 0)
  return { geometry: g, pos, other, width, bright, age: 0, strength: 0, active: false, flash: new Vector3(), segs: 0 }
}

/** Midpoint displacement: returns a jagged polyline from a to b. */
function jag(a: Vector3, b: Vector3, levels: number, rough: number, rand: () => number): Vector3[] {
  let pts = [a.clone(), b.clone()]
  let disp = a.distanceTo(b) * rough
  for (let l = 0; l < levels; l++) {
    const next: Vector3[] = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const m = pts[i].clone().lerp(pts[i + 1], 0.45 + rand() * 0.1)
      m.x += (rand() - 0.5) * disp
      m.y += (rand() - 0.5) * disp * 0.5
      m.z += (rand() - 0.5) * disp
      next.push(m, pts[i + 1])
    }
    pts = next
    disp *= 0.55
  }
  return pts
}

function writeBolt(bolt: Bolt, start: Vector3, end: Vector3, baseWidth: number, rand: () => number) {
  let seg = 0
  const push = (pts: Vector3[], w: number, b: number) => {
    for (let i = 0; i < pts.length - 1 && seg < MAX_SEG; i++, seg++) {
      const A = pts[i]
      const B = pts[i + 1]
      const taper = 1 - (i / pts.length) * 0.5
      for (let k = 0; k < 4; k++) {
        const v = seg * 4 + k
        const P = k < 2 ? A : B
        const O = k < 2 ? B : A
        bolt.pos.set([P.x, P.y, P.z], v * 3)
        bolt.other.set([O.x, O.y, O.z], v * 3)
        bolt.width[v] = w * taper
        bolt.bright[v] = b
      }
    }
  }
  const main = jag(start, end, 6, 0.22, rand)
  push(main, baseWidth, 1)
  const branches = 4 + Math.floor(rand() * 5)
  for (let i = 0; i < branches; i++) {
    const at = 4 + Math.floor(rand() * (main.length * 0.7))
    const from = main[at]
    const len = from.distanceTo(end) * (0.25 + rand() * 0.35)
    const dir = new Vector3().subVectors(end, from).normalize()
    dir.x += (rand() - 0.5) * 1.6
    dir.z += (rand() - 0.5) * 1.2
    dir.y -= rand() * 0.3
    const to = from.clone().addScaledVector(dir.normalize(), len)
    push(jag(from, to, 4, 0.3, rand), baseWidth * 0.45, 0.55)
  }
  bolt.segs = seg
  bolt.geometry.setDrawRange(0, seg * 6)
  for (const name of ['position', 'aOther', 'aWidth', 'aBright']) {
    ;(bolt.geometry.getAttribute(name) as BufferAttribute).needsUpdate = true
  }
  bolt.geometry.computeBoundingSphere()
  bolt.flash.copy(start).lerp(end, 0.6)
}

export function Lightning() {
  const bolts = useMemo(() => Array.from({ length: POOL }, createBolt), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uI: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute vec3 aOther;
          attribute float aSide;
          attribute float aWidth;
          attribute float aBright;
          varying float vSide;
          varying float vBright;
          void main() {
            vec4 a = modelViewMatrix * vec4(position, 1.0);
            vec4 b = modelViewMatrix * vec4(aOther, 1.0);
            vec2 d = normalize(b.xy / max(-b.z, 0.01) - a.xy / max(-a.z, 0.01) + 1e-6);
            vec2 n = vec2(-d.y, d.x);
            // World width plus a minimum screen-space width, so distant bolts stay legible.
            float w = aWidth + 0.0022 * -a.z;
            a.xy += n * aSide * w;
            // Overlap neighbouring segments slightly so the channel reads as one stroke.
            a.xy -= d * w * 0.3;
            vSide = aSide;
            vBright = aBright;
            gl_Position = projectionMatrix * a;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uI;
          varying float vSide;
          varying float vBright;
          void main() {
            float x = abs(vSide);
            float core = exp(-x * x * 40.0);
            float glow = exp(-x * x * 4.0) * 0.35;
            vec3 col = vec3(0.75, 0.85, 1.0) * glow + vec3(1.0) * core * 1.6;
            gl_FragColor = vec4(col * vBright * uI, 1.0);
          }
        `,
      }),
    [],
  )
  const materials = useMemo(() => bolts.map(() => material.clone()), [bolts, material])
  useDisposable(material, ...materials, ...bolts.map((b) => b.geometry))

  useEffect(() => {
    const rand = mulberry32(17)
    let cursor = 0
    const strike = (strength: number, target?: 'sky' | 'trident' | 'mountain') => {
      const bolt = bolts[cursor]
      cursor = (cursor + 1) % POOL
      const start = new Vector3()
      const end = new Vector3()
      if (target === 'trident') {
        const tip = anchors.tridentTip
        end.set(tip.x, tip.y, tip.z)
        start.set(tip.x + (rand() - 0.3) * 24, 48 + rand() * 12, tip.z - 30 - rand() * 20)
        writeBolt(bolt, start, end, 0.16, rand)
      } else {
        // Distant strikes into the ranges behind, either side of the halo.
        const side = rand() < 0.5 ? -1 : 1
        const ang = side * (0.35 + rand() * 0.9)
        const r = 180 + rand() * 180
        end.set(Math.sin(ang) * r, LAYOUT.seaLevel + 8 + rand() * 18, -Math.cos(ang) * r)
        start.set(end.x + (rand() - 0.5) * 80, 70 + rand() * 50, end.z - rand() * 60)
        writeBolt(bolt, start, end, 0.9 + r * 0.004, rand)
      }
      bolt.age = 0
      bolt.strength = strength
      bolt.active = true
    }
    const offs = [
      visualEvents.on('lightning', ({ strength, target }) => strike(strength, target)),
      visualEvents.on('climax', () => {
        strike(1, 'mountain')
        strike(0.9, 'mountain')
      }),
      visualEvents.on('reset', () => bolts.forEach((b) => (b.active = false))),
    ]
    return () => offs.forEach((o) => o())
  }, [bolts])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    let flash = 0
    let fx = stage.flashX
    let fy = stage.flashY
    let fz = stage.flashZ
    // The world flash stays below white-out, so the dancer and the ranges keep their form.
    const flashScale = stage.reduced ? 0.35 : 0.72
    bolts.forEach((b, i) => {
      if (!b.active) {
        materials[i].uniforms.uI.value = 0
        return
      }
      b.age += dt
      materials[i].uniforms.uI.value = envelope(b.age) * b.strength * (stage.reduced ? 0.6 : 1)
      // The world-lighting flash is one smooth pulse per strike: only the thin bolt
      // itself flickers, so large areas never strobe (photosensitivity).
      const f = b.strength * Math.exp(-b.age / 0.3) * Math.min(1, b.age / 0.025)
      if (f > flash) {
        flash = f
        fx = b.flash.x
        fy = b.flash.y
        fz = b.flash.z
      }
      if (b.age > 0.9) b.active = false
    })
    stage.flash = Math.max(flash * flashScale, stage.flash * Math.exp(-dt * 6))
    stage.flashX = fx
    stage.flashY = fy
    stage.flashZ = fz
  })

  return (
    <group>
      {bolts.map((b, i) => (
        <mesh key={i} geometry={b.geometry} material={materials[i]} frustumCulled={false} renderOrder={6} />
      ))}
    </group>
  )
}
