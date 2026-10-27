/**
 * Sculpted parts of the dancer, modelled on the proportions of the Chola
 * bronzes: a broad, rounded chest over a lion waist, hands held in their
 * mudras, wide-open eyes and long ear lobes, a tiered crown of matted locks,
 * and the ornaments that define the silhouette (necklaces, sacred thread,
 * belly band, armlets).
 *
 * Every part is generated once at startup; nothing here runs per frame.
 */

import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { taperedCapsule } from './geometry'

const gauss = (x: number) => Math.exp(-x * x)
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// ── Torso ───────────────────────────────────────────────────────────

/** Half-width (x) and half-depth (z) of the torso by height, pelvis at y = 0. */
const TORSO_PROFILE: [number, number, number][] = [
  [-0.075, 0.07, 0.05],
  [-0.05, 0.13, 0.09],
  [-0.015, 0.158, 0.105],
  [0.04, 0.16, 0.104],
  [0.11, 0.138, 0.094],
  [0.17, 0.122, 0.087],
  [0.24, 0.133, 0.092],
  [0.31, 0.163, 0.108],
  [0.38, 0.193, 0.122],
  [0.44, 0.212, 0.121],
  [0.49, 0.206, 0.108],
  [0.525, 0.15, 0.085],
  [0.552, 0.075, 0.058],
  [0.565, 0.02, 0.02],
]

function profileAt(y: number): [number, number] {
  const p = TORSO_PROFILE
  if (y <= p[0][0]) return [p[0][1], p[0][2]]
  for (let i = 0; i < p.length - 1; i++) {
    const [y0, x0, z0] = p[i]
    const [y1, x1, z1] = p[i + 1]
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0)
      const s = t * t * (3 - 2 * t)
      return [x0 + (x1 - x0) * s, z0 + (z1 - z0) * s]
    }
  }
  const last = p[p.length - 1]
  return [last[1], last[2]]
}

/** Surface relief by height and angle (θ = π/2 faces the viewer). */
function relief(y: number, x: number, front: number) {
  let d = 0
  if (front > 0) {
    // Pectorals and the crease beneath them.
    d += 0.016 * gauss((y - 0.415) / 0.042) * (gauss((x - 0.085) / 0.055) + gauss((x + 0.085) / 0.055)) * front
    d -= 0.006 * gauss((y - 0.36) / 0.012) * (gauss((x - 0.08) / 0.05) + gauss((x + 0.08) / 0.05)) * front
    // Sternum, linea alba and a soft abdomen.
    d -= 0.006 * gauss(x / 0.016) * smooth(0.3, 0.36, y) * (1 - smooth(0.46, 0.5, y)) * front
    d -= 0.0035 * gauss(x / 0.012) * smooth(0.13, 0.17, y) * (1 - smooth(0.3, 0.34, y)) * front
    d += 0.009 * gauss((y - 0.23) / 0.06) * gauss(x / 0.07) * front
    // Navel.
    d -= 0.009 * gauss((y - 0.125) / 0.011) * gauss(x / 0.011) * front
  } else {
    // Spine and shoulder blades.
    d -= 0.008 * gauss(x / 0.02) * smooth(0.08, 0.14, y) * (1 - smooth(0.5, 0.54, y)) * -front
    d += 0.01 * gauss((y - 0.43) / 0.05) * (gauss((x - 0.09) / 0.05) + gauss((x + 0.09) / 0.05)) * -front
  }
  return d
}

/** A point on the torso surface (torso space), pushed out by `offset`. */
export function torsoSurface(y: number, theta: number, offset = 0, out = new Vector3()) {
  const [rx, rz] = profileAt(y)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const back = s < 0 ? 0.92 : 1
  const x = rx * c
  const z = rz * s * back
  const n = new Vector2(c / Math.max(rx, 1e-3), (s * back) / Math.max(rz, 1e-3)).normalize()
  const d = relief(y, x, s) + offset
  return out.set(x + n.x * d, y, z + n.y * d)
}

export function sculptedTorso(): BufferGeometry {
  const seg = 56
  const rows = 64
  const y0 = -0.075
  const y1 = 0.565
  const pos: number[] = []
  const idx: number[] = []
  const v = new Vector3()
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows
    for (let i = 0; i <= seg; i++) {
      torsoSurface(y, (i / seg) * Math.PI * 2, 0, v)
      pos.push(v.x, v.y, v.z)
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i
      const b = a + seg + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Close the seam: average normals of the duplicated first/last column.
  const nrm = g.getAttribute('normal') as BufferAttribute
  for (let r = 0; r <= rows; r++) {
    const a = r * (seg + 1)
    const b = a + seg
    const nx = nrm.getX(a) + nrm.getX(b)
    const ny = nrm.getY(a) + nrm.getY(b)
    const nz = nrm.getZ(a) + nrm.getZ(b)
    const l = Math.hypot(nx, ny, nz) || 1
    nrm.setXYZ(a, nx / l, ny / l, nz / l)
    nrm.setXYZ(b, nx / l, ny / l, nz / l)
  }
  return g
}

// ── Garments and ornaments in torso space ──────────────────────────

/** Short, close-fitting dhoti with folds that deepen toward the hem. Open-ended; render double-sided. */
export function foldedDhoti(): BufferGeometry {
  const seg = 64
  const rows = 14
  const top = 0.085
  const hem = -0.11
  const pos: number[] = []
  const idx: number[] = []
  for (let r = 0; r <= rows; r++) {
    const k = r / rows
    const y = top + (hem - top) * k
    const rx = 0.15 + 0.02 * k * k
    const rz = 0.104 + 0.012 * k
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const fold = 1 + (Math.sin(a * 13 + k * 2.2) * 0.035 + Math.sin(a * 5 - 0.7) * 0.02) * k
      // The hem rises a little over the hips, where the thigh cloth takes over.
      const yy = y + Math.abs(Math.cos(a)) * 0.015 * k
      pos.push(Math.cos(a) * rx * fold, yy, Math.sin(a) * rz * fold)
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i
      const b = a + seg + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function tubeOnTorso(points: Vector3[], radius: number, closed: boolean, tubular = 96, radial = 6) {
  const curve = new CatmullRomCurve3(points, closed, 'centripetal')
  return new TubeGeometry(curve, tubular, radius, radial, closed)
}

/** Beads along a curve: small spheres merged into one geometry. */
function beads(points: Vector3[], every: number, r: number) {
  const curve = new CatmullRomCurve3(points, false, 'centripetal')
  const n = Math.max(2, Math.floor(curve.getLength() / every))
  const parts: BufferGeometry[] = []
  for (let i = 1; i < n; i++) {
    const b = new SphereGeometry(r * (i === Math.floor(n / 2) ? 2.2 : 1), 8, 6)
    const p = curve.getPointAt(i / n)
    b.translate(p.x, p.y, p.z)
    parts.push(b)
  }
  return parts
}

/**
 * Necklaces, the sacred thread across the chest, the belly band and the
 * waist girdle — one merged geometry in torso space.
 */
export function torsoOrnaments(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const pts = (n: number, f: (k: number) => [number, number, number]) =>
    Array.from({ length: n }, (_, i) => {
      const [y, th, off] = f(i / (n - 1))
      return torsoSurface(y, th, off)
    })

  // Choker at the base of the neck.
  parts.push(tubeOnTorso(pts(24, (k) => [0.536 - Math.sin(k * Math.PI) * 0.012, Math.PI * 0.08 + k * Math.PI * 0.84, 0.01]), 0.007, false, 48))
  // Long necklace resting on the chest, with a pendant at its lowest point.
  const neck = pts(28, (k) => [0.5 - Math.sin(k * Math.PI) * 0.15, Math.PI * 0.1 + k * Math.PI * 0.8, 0.008])
  parts.push(tubeOnTorso(neck, 0.0045, false, 64))
  parts.push(...beads(neck, 0.022, 0.0075))
  // Yajnopavita: from the left shoulder across the chest to the right hip, around the back.
  parts.push(tubeOnTorso(pts(48, (k) => {
    const th = k * Math.PI * 2
    return [0.27 + 0.2 * Math.cos(th), th, 0.006]
  }), 0.004, true, 120, 5))
  // Udarabandha, the band around the belly.
  parts.push(tubeOnTorso(pts(40, (k) => [0.205, k * Math.PI * 2, 0.004]), 0.007, true, 96))
  // Girdle at the top of the dhoti, with a clasp at the front.
  parts.push(tubeOnTorso(pts(40, (k) => [0.075, k * Math.PI * 2, 0.012]), 0.011, true, 96))
  const clasp = new SphereGeometry(0.02, 12, 8)
  clasp.scale(1.2, 1, 0.5)
  const cp = torsoSurface(0.072, Math.PI / 2, 0.02)
  clasp.translate(cp.x, cp.y, cp.z)
  parts.push(clasp)

  return mergeAll(parts)
}

function mergeAll(parts: BufferGeometry[]) {
  // Tube, sphere and lathe geometries share position/normal/uv, but not always an index.
  const prepared = parts.map((g) => (g.index ? g.toNonIndexed() : g))
  for (const g of prepared) if (!g.getAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
  const merged = mergeGeometries(prepared, false)
  parts.forEach((g) => g.dispose())
  prepared.forEach((g) => g.dispose())
  if (!merged) throw new Error('ornament merge failed')
  return merged
}

// ── Hands ───────────────────────────────────────────────────────────

export type Mudra = 'abhaya' | 'gaja' | 'damaru' | 'agni'

/** Per-mudra finger flexion (3 joints, radians) and thumb direction. */
const MUDRAS: Record<Mudra, { flex: [number, number, number][]; spread: number; thumb: [number, number, number]; thumbFlex: number }> = {
  // Pataka: the open palm, "fear not".
  abhaya: { flex: [[0.06, 0.06, 0.04], [0.04, 0.05, 0.03], [0.06, 0.06, 0.04], [0.1, 0.08, 0.05]], spread: 0.6, thumb: [0.4, 0.9, 0.18], thumbFlex: 0.15 },
  // Gaja hasta: the arm swung across like an elephant's trunk, fingers relaxed.
  gaja: { flex: [[0.15, 0.2, 0.15], [0.18, 0.22, 0.16], [0.22, 0.25, 0.18], [0.28, 0.28, 0.2]], spread: 0.3, thumb: [0.3, 0.9, 0.3], thumbFlex: 0.3 },
  // Holding the damaru's waist between curled fingers.
  damaru: { flex: [[0.55, 0.8, 0.5], [0.6, 0.85, 0.55], [0.7, 0.9, 0.55], [0.8, 0.9, 0.55]], spread: 0.2, thumb: [0.45, 0.6, 0.65], thumbFlex: 0.45 },
  // Ardhachandra: fingers together and lifted back, thumb wide — the flame rests on the palm.
  agni: { flex: [[-0.12, 0.04, 0.04], [-0.1, 0.03, 0.03], [-0.08, 0.04, 0.04], [-0.05, 0.06, 0.05]], spread: 0.35, thumb: [0.95, 0.35, 0.15], thumbFlex: 0.1 },
}

const FINGERS = [
  { x: 0.021, base: 0.06, len: 0.056, r: 0.0082 },
  { x: 0.0072, base: 0.064, len: 0.062, r: 0.0086 },
  { x: -0.0068, base: 0.061, len: 0.058, r: 0.0082 },
  { x: -0.02, base: 0.055, len: 0.046, r: 0.0072 },
]
const PHALANX = [0.46, 0.31, 0.23]

/**
 * A hand in its mudra. Local frame: wrist at the origin, fingers along +Y,
 * palm facing +Z. `thumbSide` is +1 when the thumb lies toward +X.
 */
export function handGeometry(mudra: Mudra, thumbSide: 1 | -1): BufferGeometry {
  const m = MUDRAS[mudra]
  const parts: BufferGeometry[] = []
  const palm = taperedCapsule(0.05, 0.026, 0.031, 0.002, 12)
  palm.scale(1.05, 1, 0.48)
  palm.translate(0, 0.008, 0)
  parts.push(palm)
  // Heel of the thumb.
  const mound = new SphereGeometry(0.018, 10, 8)
  mound.scale(1, 1.4, 0.8)
  mound.translate(thumbSide * 0.017, 0.022, 0.005)
  parts.push(mound)

  const mat = new Matrix4()
  const step = new Matrix4()
  const rot = new Matrix4()
  FINGERS.forEach((f, i) => {
    const flex = m.flex[i]
    const spread = (1.5 - i) * 0.07 * m.spread * thumbSide
    mat.makeTranslation(f.x * thumbSide, f.base, 0).multiply(rot.makeRotationZ(-spread))
    let r = f.r
    PHALANX.forEach((p, j) => {
      mat.multiply(rot.makeRotationX(flex[j]))
      const len = f.len * p
      const seg = taperedCapsule(len, r, r * 0.86, 0, 8)
      seg.applyMatrix4(mat)
      parts.push(seg)
      mat.multiply(step.makeTranslation(0, len, 0))
      r *= 0.86
    })
  })

  // Thumb: two segments from the side of the palm.
  const td = new Vector3(m.thumb[0] * thumbSide, m.thumb[1], m.thumb[2]).normalize()
  const tq = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), td)
  mat.compose(new Vector3(thumbSide * 0.024, 0.016, 0.006), tq, new Vector3(1, 1, 1))
  let tr = 0.0095
  for (let j = 0; j < 2; j++) {
    const len = j === 0 ? 0.03 : 0.026
    const seg = taperedCapsule(len, tr, tr * 0.88, 0, 8)
    seg.applyMatrix4(mat)
    parts.push(seg)
    mat.multiply(step.makeTranslation(0, len, 0)).multiply(rot.makeRotationX(m.thumbFlex))
    tr *= 0.88
  }
  return mergeAll(parts)
}

// ── Feet ────────────────────────────────────────────────────────────

/** A foot: local frame with the ankle at the origin, toes along +Y, the top of the foot toward +Z. */
export function footGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const sole = new SphereGeometry(1, 18, 12)
  sole.scale(0.042, 0.1, 0.03)
  sole.translate(0, 0.07, -0.012)
  parts.push(sole)
  const heel = new SphereGeometry(0.034, 12, 10)
  heel.translate(0, -0.008, -0.02)
  parts.push(heel)
  const instep = taperedCapsule(0.08, 0.036, 0.028, 0, 12)
  instep.scale(1.1, 1, 0.8)
  parts.push(instep)
  // Toes as a soft row.
  for (let i = 0; i < 5; i++) {
    const toe = new SphereGeometry(i === 0 ? 0.012 : 0.0085, 8, 6)
    toe.translate((i - 1.6) * 0.0155, 0.158 - Math.abs(i - 0.6) * 0.008 - i * 0.004, -0.018)
    parts.push(toe)
  }
  return mergeAll(parts)
}

// ── Head ────────────────────────────────────────────────────────────

/** Brow, eyes, lips, cheeks and long ear lobes, in head space (head centre at the origin, +Z the face). */
export function faceGeometry(radius: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  const at = (g: BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) => {
    g.scale(sx, sy, sz)
    if (rz) g.rotateZ(rz)
    g.translate(x, y, z)
    parts.push(g)
  }
  const r = radius / 0.1
  // Brow ridge.
  at(new SphereGeometry(1, 20, 10), 0, 0.026 * r, 0.077 * r, 0.068 * r, 0.013 * r, 0.026 * r)
  // Wide almond eyes under heavy lids.
  for (const s of [-1, 1]) {
    at(new SphereGeometry(1, 14, 8), s * 0.031 * r, 0.004 * r, 0.083 * r, 0.02 * r, 0.0085 * r, 0.012 * r, s * 0.18)
    at(new SphereGeometry(1, 10, 8), s * 0.046 * r, -0.03 * r, 0.068 * r, 0.022 * r, 0.02 * r, 0.018 * r)
  }
  // Lips: a full lower lip and a bowed upper lip.
  at(new SphereGeometry(1, 14, 8), 0, -0.05 * r, 0.082 * r, 0.022 * r, 0.0075 * r, 0.011 * r)
  at(new SphereGeometry(1, 14, 8), 0, -0.041 * r, 0.086 * r, 0.024 * r, 0.006 * r, 0.01 * r)
  // Ears with the stretched lobes of the bronzes.
  for (const s of [-1, 1]) {
    const ear = taperedCapsule(0.07 * r, 0.011 * r, 0.016 * r, 0, 10)
    ear.scale(0.6, 1, 1.2)
    ear.rotateX(Math.PI)
    ear.translate(s * 0.092 * r, 0.03 * r, -0.004 * r)
    parts.push(ear)
  }
  return mergeAll(parts)
}

/** Ear ornaments: the makara-kundala ring in the right ear, the round patra-kundala disc in the left. */
export function earrings(radius: number): BufferGeometry {
  const r = radius / 0.1
  const ring = new TorusGeometry(0.026 * r, 0.006 * r, 8, 24)
  ring.rotateY(Math.PI / 2)
  ring.translate(-0.1 * r, -0.07 * r, 0)
  const disc = new CylinderGeometry(0.032 * r, 0.032 * r, 0.008 * r, 24)
  disc.rotateZ(Math.PI / 2)
  disc.translate(0.102 * r, -0.068 * r, 0)
  const boss = new SphereGeometry(0.012 * r, 10, 8)
  boss.translate(0.108 * r, -0.068 * r, 0)
  return mergeAll([ring, disc, boss])
}

/** Hair over the skull with a jewelled band at the hairline. */
export function hairCap(radius: number): BufferGeometry {
  const cap = new SphereGeometry(radius * 1.04, 28, 14, 0, Math.PI * 2, 0, 1.25)
  cap.scale(0.88, 1.04, 0.97)
  cap.rotateX(-0.32)
  cap.translate(0, radius * 0.08, -radius * 0.04)
  // The band sits exactly on the cap's rim (polar angle 1.25 of the scaled, tilted sphere).
  const rimY = Math.cos(1.25) * 1.04 * 1.04
  const rimR = Math.sin(1.25) * 1.04
  const place = new Matrix4()
    .makeTranslation(0, radius * 0.08, -radius * 0.04)
    .multiply(new Matrix4().makeRotationX(-0.32))
    .multiply(new Matrix4().makeTranslation(0, rimY * radius, 0))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2))
  const sx = rimR * 0.88 * radius
  const sz = rimR * 0.97 * radius
  const band = new TorusGeometry(1, 0.055, 8, 48)
  band.scale(sx, sz, radius)
  band.applyMatrix4(place)
  const jewels: BufferGeometry[] = []
  const p = new Vector3()
  for (let i = -3; i <= 3; i++) {
    const a = Math.PI / 2 + i * 0.3
    const j = new SphereGeometry(radius * (i === 0 ? 0.11 : 0.065), 8, 6)
    p.set(Math.cos(a) * sx * 1.03, Math.sin(a) * sz * 1.03, 0).applyMatrix4(place)
    j.translate(p.x, p.y, p.z)
    jewels.push(j)
  }
  return mergeAll([cap, band, ...jewels])
}

/** Jata-makuta: the tall crown of matted locks, built up in tiers. */
export function tieredCrown(): BufferGeometry {
  const profile: [number, number][] = [
    [0.0001, 0],
    [0.074, 0.004],
    [0.084, 0.03],
    [0.07, 0.05],
    [0.08, 0.07],
    [0.064, 0.095],
    [0.07, 0.112],
    [0.052, 0.14],
    [0.058, 0.156],
    [0.04, 0.182],
    [0.046, 0.196],
    [0.022, 0.226],
    [0.03, 0.238],
    [0.0001, 0.262],
  ]
  const lathe = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    28,
  )
  // Locks: vertical ridges over the tiers.
  const pos = lathe.getAttribute('position') as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = pos.getY(i)
    const a = Math.atan2(z, x)
    const k = 1 + Math.sin(a * 14) * 0.05 * Math.min(1, y * 12)
    pos.setXYZ(i, x * k, y, z * k)
  }
  lathe.computeVertexNormals()
  return lathe
}

/** The fan crest behind the crown: radiating blades tipped with buds, around a jewelled boss. */
export function crestFan(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const n = 13
  const q = new Quaternion()
  const e = new Euler()
  for (let i = 0; i < n; i++) {
    const a = -1.35 + (i / (n - 1)) * 2.7
    const len = 0.17 + Math.cos(a) * 0.05
    const blade = taperedCapsule(len, 0.014, 0.006, 0.004, 8)
    blade.scale(1.4, 1, 0.35)
    q.setFromEuler(e.set(-0.18, 0, -a))
    blade.applyQuaternion(q)
    const bud = new SphereGeometry(0.014, 8, 6)
    const tip = new Vector3(0, len + 0.012, 0).applyQuaternion(q)
    bud.translate(tip.x, tip.y, tip.z)
    parts.push(blade, bud)
  }
  const boss = new CylinderGeometry(0.04, 0.04, 0.016, 20)
  boss.rotateX(Math.PI / 2)
  parts.push(boss)
  const merged = mergeAll(parts)
  merged.translate(0, 0.13, -0.075)
  return merged
}
