/**
 * A point-based, four-armed rig solved with analytic two-bone IK.
 *
 * Poses are authored as hand/foot targets plus elbow/knee pole hints in
 * figure space (≈1.85 units tall, +x = the figure's left, +z = towards the
 * viewer). That makes iconographic poses easy to describe and lets the dance
 * blend between them by simply interpolating targets.
 *
 * Upgrade path: a skinned GLTF Nataraja can replace the meshes in Shiva.tsx
 * while keeping this solver for driving its bones.
 */

import { Euler, Quaternion, Vector3 } from 'three'

export type V3 = [number, number, number]

export interface Pose {
  pelvis: V3
  /** Euler XYZ (radians): forward lean, twist, side tilt. */
  torso: V3
  head: V3
  rFoot: V3
  rKnee: V3
  rFootDir: V3
  lFoot: V3
  lKnee: V3
  lFootDir: V3
  /** Upper right — holds the damaru. */
  ruHand: V3
  ruElbow: V3
  ruDir: V3
  /** Lower right — abhaya mudra, "fear not". */
  rlHand: V3
  rlElbow: V3
  rlDir: V3
  /** Upper left — holds agni, the fire of dissolution. */
  luHand: V3
  luElbow: V3
  luDir: V3
  /** Lower left — gaja hasta, pointing to the raised foot. */
  llHand: V3
  llElbow: V3
  llDir: V3
}

/** Proportions after the Chola bronzes: broad shoulders, a full head on a short neck, long legs. */
export const DIM = {
  upperArm: 0.29,
  forearm: 0.27,
  hand: 0.12,
  thigh: 0.45,
  shin: 0.43,
  foot: 0.17,
  spine: 0.56,
  neck: 0.055,
  headRadius: 0.112,
  shoulderHalf: 0.2,
  hipHalf: 0.09,
}

// ── Authored poses ──────────────────────────────────────────────────

/** Ananda Tandava — the classic Nataraja pose and the figure's rest state. */
export const ANANDA: Pose = {
  pelvis: [-0.04, 0.75, 0],
  torso: [0.04, 0.08, -0.08],
  head: [0.02, -0.06, 0.15],
  rFoot: [-0.17, 0.05, 0.08],
  rKnee: [-1.1, 0.5, 0.45],
  rFootDir: [-0.35, -0.3, 1],
  lFoot: [-0.5, 0.6, 0.32],
  lKnee: [0.1, 1.6, 0.9],
  lFootDir: [-0.8, -0.5, 0.25],
  ruHand: [-0.6, 1.4, -0.06],
  ruElbow: [-0.8, 0.9, -0.25],
  ruDir: [0.05, 1, 0],
  rlHand: [-0.42, 1.16, 0.22],
  rlElbow: [-0.62, 0.78, 0.1],
  rlDir: [0.05, 1, 0.3],
  luHand: [0.62, 1.4, -0.06],
  luElbow: [0.8, 0.9, -0.25],
  luDir: [0.25, 1, 0],
  llHand: [-0.2, 1.0, 0.33],
  llElbow: [0.4, 1.2, 0.55],
  llDir: [-0.55, -0.8, 0.15],
}

/** Urdhva Tandava — the leg raised to the sky. Held at the climax. */
export const URDHVA: Pose = {
  pelvis: [-0.06, 0.92, 0],
  torso: [0.0, 0.02, 0.16],
  head: [0.0, 0.0, -0.1],
  rFoot: [-0.08, 0.05, 0.03],
  rKnee: [-0.3, 0.5, 1],
  rFootDir: [-0.1, -0.3, 1],
  lFoot: [0.2, 1.98, 0.1],
  lKnee: [0.6, 1.3, 0.6],
  lFootDir: [0.1, 1, 0.25],
  ruHand: [-0.8, 1.66, 0.0],
  ruElbow: [-0.65, 2.0, -0.3],
  ruDir: [-0.3, 1, 0],
  rlHand: [-0.5, 1.15, 0.32],
  rlElbow: [-0.6, 1.0, 0],
  rlDir: [-0.2, 1, 0.2],
  luHand: [0.78, 1.2, -0.1],
  luElbow: [0.7, 1.6, -0.3],
  luDir: [0.6, 0.8, 0],
  llHand: [0.42, 0.98, 0.35],
  llElbow: [0.6, 1.2, 0.2],
  llDir: [0.4, -0.9, 0.1],
}

/** The stamp — a deep, grounded impact. */
export const STAMP: Pose = {
  pelvis: [0, 0.66, 0.02],
  torso: [0.18, 0, 0],
  head: [0.12, 0, 0],
  rFoot: [-0.36, 0.05, 0.08],
  rKnee: [-1, 0.5, 0.7],
  rFootDir: [-0.4, -0.3, 1],
  lFoot: [0.36, 0.05, 0.08],
  lKnee: [1, 0.5, 0.7],
  lFootDir: [0.4, -0.3, 1],
  ruHand: [-0.66, 1.66, 0.04],
  ruElbow: [-0.8, 1.2, -0.3],
  ruDir: [-0.2, 1, 0],
  rlHand: [-0.7, 0.98, 0.2],
  rlElbow: [-0.5, 1.3, -0.2],
  rlDir: [-1, 0.1, 0.2],
  luHand: [0.66, 1.66, 0.04],
  luElbow: [0.8, 1.2, -0.3],
  luDir: [0.2, 1, 0],
  llHand: [0.7, 0.98, 0.2],
  llElbow: [0.5, 1.3, -0.2],
  llDir: [1, 0.1, 0.2],
}

/** Anticipation before a stamp: knee high, arms gathered upward. */
export const RAISE: Pose = {
  pelvis: [0.04, 0.9, 0],
  torso: [-0.06, 0, 0.05],
  head: [-0.08, 0, 0],
  rFoot: [-0.22, 0.6, 0.2],
  rKnee: [-0.4, 1.1, 0.9],
  rFootDir: [-0.2, -0.8, 0.5],
  lFoot: [0.1, 0.05, 0.02],
  lKnee: [0.4, 0.5, 1],
  lFootDir: [0.2, -0.3, 1],
  ruHand: [-0.38, 1.9, 0.05],
  ruElbow: [-0.7, 1.6, -0.2],
  ruDir: [0.2, 1, 0],
  rlHand: [-0.55, 1.35, 0.22],
  rlElbow: [-0.6, 1.0, 0],
  rlDir: [-0.2, 1, 0.2],
  luHand: [0.38, 1.9, 0.05],
  luElbow: [0.7, 1.6, -0.2],
  luDir: [-0.2, 1, 0],
  llHand: [0.55, 1.35, 0.22],
  llElbow: [0.6, 1.0, 0],
  llDir: [0.2, 1, 0.2],
}

const mirrorV = (v: V3): V3 => [-v[0], v[1], v[2]]
const mirrorE = (v: V3): V3 => [v[0], -v[1], -v[2]]

/** Mirror across the figure's vertical plane. Each arm stays on its own side, so props never cross. */
export function mirror(p: Pose): Pose {
  return {
    pelvis: mirrorV(p.pelvis),
    torso: mirrorE(p.torso),
    head: mirrorE(p.head),
    rFoot: mirrorV(p.lFoot),
    rKnee: mirrorV(p.lKnee),
    rFootDir: mirrorV(p.lFootDir),
    lFoot: mirrorV(p.rFoot),
    lKnee: mirrorV(p.rKnee),
    lFootDir: mirrorV(p.rFootDir),
    ruHand: mirrorV(p.luHand),
    ruElbow: mirrorV(p.luElbow),
    ruDir: mirrorV(p.luDir),
    rlHand: mirrorV(p.llHand),
    rlElbow: mirrorV(p.llElbow),
    rlDir: mirrorV(p.llDir),
    luHand: mirrorV(p.ruHand),
    luElbow: mirrorV(p.ruElbow),
    luDir: mirrorV(p.ruDir),
    llHand: mirrorV(p.rlHand),
    llElbow: mirrorV(p.rlElbow),
    llDir: mirrorV(p.rlDir),
  }
}

/** Lalita — graceful and turned, weight on the left leg, right foot crossed behind. */
export const LALITA: Pose = {
  pelvis: [0.05, 0.8, 0],
  torso: [0.03, -0.28, 0.1],
  head: [0.02, 0.22, -0.12],
  rFoot: [-0.06, 0.13, -0.2],
  rKnee: [-0.55, 0.5, 0.6],
  rFootDir: [0.2, -1, -0.3],
  lFoot: [0.12, 0.05, 0.06],
  lKnee: [0.75, 0.5, 0.8],
  lFootDir: [0.3, -0.3, 1],
  ruHand: [-0.72, 1.52, 0.08],
  ruElbow: [-0.75, 1.05, -0.2],
  ruDir: [0, 1, 0],
  rlHand: [-0.68, 1.08, 0.24],
  rlElbow: [-0.5, 0.85, 0.2],
  rlDir: [-1, 0.25, 0.15],
  luHand: [0.42, 1.78, 0.02],
  luElbow: [0.78, 1.42, -0.2],
  luDir: [0, 1, 0],
  llHand: [0.34, 0.86, 0.2],
  llElbow: [0.52, 1.0, -0.1],
  llDir: [0.1, -1, 0.2],
}

/** Ardha-mandali — the deep, turned-out plié: knees open, both feet planted wide. */
export const MANDALA: Pose = {
  pelvis: [0, 0.62, 0.02],
  torso: [0.06, 0, 0],
  head: [0.04, 0, 0],
  rFoot: [-0.34, 0.05, 0.1],
  rKnee: [-1.0, 0.5, 0.6],
  rFootDir: [-0.6, -0.25, 0.8],
  lFoot: [0.34, 0.05, 0.1],
  lKnee: [1.0, 0.5, 0.6],
  lFootDir: [0.6, -0.25, 0.8],
  ruHand: [-0.62, 1.48, 0.05],
  ruElbow: [-0.75, 1.0, -0.2],
  ruDir: [-0.1, 1, 0],
  rlHand: [-0.18, 1.1, 0.4],
  rlElbow: [-0.5, 0.8, 0.2],
  rlDir: [0, 1, 0.2],
  luHand: [0.62, 1.48, 0.05],
  luElbow: [0.75, 1.0, -0.2],
  luDir: [0.1, 1, 0],
  llHand: [0.2, 0.95, 0.38],
  llElbow: [0.5, 1.0, 0.3],
  llDir: [-0.5, -0.8, 0.2],
}

/** Katichhinna — the waist twists, the arms spiral around it. */
export const TWIST: Pose = {
  pelvis: [0.02, 0.76, 0],
  torso: [0.04, 0.45, -0.1],
  head: [0.02, -0.3, 0.06],
  rFoot: [-0.2, 0.05, 0.12],
  rKnee: [-0.8, 0.5, 0.8],
  rFootDir: [-0.4, -0.3, 1],
  lFoot: [0.16, 0.05, -0.12],
  lKnee: [0.7, 0.5, 0.5],
  lFootDir: [0.3, -0.3, 0.9],
  ruHand: [-0.45, 1.6, -0.25],
  ruElbow: [-0.7, 1.3, -0.4],
  ruDir: [0, 1, -0.1],
  rlHand: [-0.05, 1.15, 0.42],
  rlElbow: [-0.35, 1.0, 0.35],
  rlDir: [0.6, 0.6, 0.3],
  luHand: [0.66, 1.55, 0.22],
  luElbow: [0.65, 1.1, 0.0],
  luDir: [0.1, 1, 0.1],
  llHand: [0.55, 0.9, 0.1],
  llElbow: [0.6, 1.1, -0.15],
  llDir: [0.3, -0.9, 0],
}

/** Bhujangatrasita — the leg snatched up and across, as if from a serpent. */
export const BHUJANGA: Pose = {
  pelvis: [-0.05, 0.86, 0],
  torso: [0.0, 0.12, -0.16],
  head: [0.0, -0.1, 0.18],
  rFoot: [-0.1, 0.05, 0.04],
  rKnee: [-0.5, 0.5, 1],
  rFootDir: [-0.3, -0.3, 1],
  lFoot: [-0.36, 0.95, 0.22],
  lKnee: [0.4, 1.9, 0.9],
  lFootDir: [-0.8, -0.4, 0.3],
  ruHand: [-0.7, 1.72, -0.05],
  ruElbow: [-0.8, 1.2, -0.3],
  ruDir: [0, 1, 0],
  rlHand: [-0.55, 1.3, 0.3],
  rlElbow: [-0.6, 0.95, 0.1],
  rlDir: [-0.1, 1, 0.2],
  luHand: [0.66, 1.62, -0.05],
  luElbow: [0.8, 1.15, -0.25],
  luDir: [0.2, 1, 0],
  llHand: [-0.25, 1.05, 0.38],
  llElbow: [0.35, 1.2, 0.5],
  llDir: [-0.6, -0.75, 0.2],
}

/** Talasamsphotita — the knee lifted high before the foot strikes, arms flung wide. */
export const TALA: Pose = {
  pelvis: [0.03, 0.8, 0.02],
  torso: [0.1, 0.0, 0.05],
  head: [0.08, 0, 0],
  rFoot: [-0.16, 0.05, 0.02],
  rKnee: [-0.6, 0.5, 1],
  rFootDir: [-0.3, -0.3, 1],
  lFoot: [0.14, 0.5, 0.28],
  lKnee: [0.35, 1.0, 1.2],
  lFootDir: [0.1, -0.9, 0.4],
  ruHand: [-0.72, 1.45, 0.05],
  ruElbow: [-0.6, 1.5, -0.25],
  ruDir: [-0.3, 1, 0],
  rlHand: [-0.7, 1.15, 0.2],
  rlElbow: [-0.5, 1.2, -0.2],
  rlDir: [-0.9, 0.3, 0.1],
  luHand: [0.72, 1.45, 0.05],
  luElbow: [0.6, 1.5, -0.25],
  luDir: [0.3, 1, 0],
  llHand: [0.7, 1.15, 0.2],
  llElbow: [0.5, 1.2, -0.2],
  llDir: [0.9, 0.3, 0.1],
}

/** Gesture: the damaru shaken high overhead. Only the keys in DAMARU_KEYS are used. */
export const DAMARU_SHAKE: Pose = {
  ...ANANDA,
  torso: [0.02, -0.15, 0.1],
  head: [-0.1, -0.2, 0.05],
  ruHand: [-0.4, 1.95, 0.15],
  ruElbow: [-0.65, 1.55, -0.1],
  ruDir: [0.1, 1, 0.2],
}
export const DAMARU_KEYS: (keyof Pose)[] = ['torso', 'head', 'ruHand', 'ruElbow', 'ruDir']

/** Gesture: the fire lifted high and forward. Only the keys in AGNI_KEYS are used. */
export const AGNI_RISE: Pose = {
  ...ANANDA,
  torso: [-0.06, -0.1, -0.06],
  head: [-0.14, 0.15, -0.05],
  luHand: [0.42, 1.95, 0.25],
  luElbow: [0.7, 1.55, -0.1],
  luDir: [0, 1, 0.2],
}
export const AGNI_KEYS: (keyof Pose)[] = ['torso', 'head', 'luHand', 'luElbow', 'luDir']

export const ANANDA_MIRROR = mirror(ANANDA)
export const LALITA_MIRROR = mirror(LALITA)
export const TWIST_MIRROR = mirror(TWIST)
export const BHUJANGA_MIRROR = mirror(BHUJANGA)
export const TALA_MIRROR = mirror(TALA)

export function clonePose(p: Pose): Pose {
  const out = {} as Pose
  for (const k in p) out[k as keyof Pose] = [...p[k as keyof Pose]] as V3
  return out
}

/** Blend only the listed keys of `out` toward `b` by `t` (for gestures of a few limbs). */
export function blendKeys(out: Pose, b: Pose, t: number, keys: (keyof Pose)[]) {
  for (const key of keys) {
    const o = out[key]
    const bv = b[key]
    o[0] += (bv[0] - o[0]) * t
    o[1] += (bv[1] - o[1]) * t
    o[2] += (bv[2] - o[2]) * t
  }
}

/** out = lerp(a, b, t), written in place. */
export function blendPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  for (const k in a) {
    const key = k as keyof Pose
    const av = a[key]
    const bv = b[key]
    const o = out[key]
    o[0] = av[0] + (bv[0] - av[0]) * t
    o[1] = av[1] + (bv[1] - av[1]) * t
    o[2] = av[2] + (bv[2] - av[2]) * t
  }
  return out
}

// ── Solver ──────────────────────────────────────────────────────────

export interface Limb {
  root: Vector3
  mid: Vector3
  end: Vector3
  tip: Vector3
}

export interface Skeleton {
  pelvis: Vector3
  chest: Vector3
  neck: Vector3
  head: Vector3
  torsoQ: Quaternion
  headQ: Quaternion
  pelvisQ: Quaternion
  ru: Limb
  rl: Limb
  lu: Limb
  ll: Limb
  rLeg: Limb
  lLeg: Limb
}

const limb = (): Limb => ({ root: new Vector3(), mid: new Vector3(), end: new Vector3(), tip: new Vector3() })

export function createSkeleton(): Skeleton {
  return {
    pelvis: new Vector3(),
    chest: new Vector3(),
    neck: new Vector3(),
    head: new Vector3(),
    torsoQ: new Quaternion(),
    headQ: new Quaternion(),
    pelvisQ: new Quaternion(),
    ru: limb(),
    rl: limb(),
    lu: limb(),
    ll: limb(),
    rLeg: limb(),
    lLeg: limb(),
  }
}

const _e = new Euler()
const _q = new Quaternion()
const _v = new Vector3()
const _d = new Vector3()
const _n = new Vector3()
const _pole = new Vector3()
const _target = new Vector3()

/** Two-bone IK: places `mid` so |root-mid| = a and |mid-end| = b, bending toward `pole`. */
function solveTwoBone(root: Vector3, target: Vector3, pole: Vector3, a: number, b: number, mid: Vector3, end: Vector3) {
  _d.subVectors(target, root)
  let c = _d.length()
  const maxReach = (a + b) * 0.999
  const minReach = Math.abs(a - b) + 1e-3
  c = Math.min(Math.max(c, minReach), maxReach)
  _d.normalize()
  const cosA = (a * a + c * c - b * b) / (2 * a * c)
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  _n.subVectors(pole, root)
  _n.addScaledVector(_d, -_n.dot(_d))
  if (_n.lengthSq() < 1e-8) _n.set(0, 0, 1).addScaledVector(_d, -_d.z)
  _n.normalize()
  mid.copy(root).addScaledVector(_d, a * cosA).addScaledVector(_n, a * sinA)
  end.copy(root).addScaledVector(_d, c)
}

function setV(out: Vector3, v: V3) {
  return out.set(v[0], v[1], v[2])
}

function solveLimb(l: Limb, target: V3, pole: V3, dir: V3, a: number, b: number, tipLen: number) {
  solveTwoBone(l.root, setV(_target, target), setV(_pole, pole), a, b, l.mid, l.end)
  setV(_v, dir).normalize()
  l.tip.copy(l.end).addScaledVector(_v, tipLen)
}

export function solve(p: Pose, sk: Skeleton, breath = 0) {
  setV(sk.pelvis, p.pelvis)
  sk.torsoQ.setFromEuler(_e.set(p.torso[0], p.torso[1], p.torso[2]))
  sk.pelvisQ.setFromEuler(_e.set(p.torso[0] * 0.3, p.torso[1] * 0.5, p.torso[2] * 0.4))
  _q.setFromEuler(_e.set(p.head[0], p.head[1], p.head[2]))
  sk.headQ.multiplyQuaternions(sk.torsoQ, _q)

  const local = (x: number, y: number, z: number, q: Quaternion, out: Vector3) =>
    out.set(x, y, z).applyQuaternion(q).add(sk.pelvis)

  local(0, DIM.spine * 0.68 + breath * 0.008, 0, sk.torsoQ, sk.chest)
  local(0, DIM.spine, 0, sk.torsoQ, sk.neck)
  sk.head.set(0, DIM.neck + DIM.headRadius * 0.95, 0).applyQuaternion(sk.headQ).add(sk.neck)

  const sy = DIM.spine * 0.9 + breath * 0.006
  local(-DIM.shoulderHalf, sy, -0.01, sk.torsoQ, sk.ru.root)
  local(-DIM.shoulderHalf + 0.01, sy - 0.03, 0.02, sk.torsoQ, sk.rl.root)
  local(DIM.shoulderHalf, sy, -0.01, sk.torsoQ, sk.lu.root)
  local(DIM.shoulderHalf - 0.01, sy - 0.03, 0.02, sk.torsoQ, sk.ll.root)
  local(-DIM.hipHalf, -0.02, 0, sk.pelvisQ, sk.rLeg.root)
  local(DIM.hipHalf, -0.02, 0, sk.pelvisQ, sk.lLeg.root)

  solveLimb(sk.ru, p.ruHand, p.ruElbow, p.ruDir, DIM.upperArm, DIM.forearm, DIM.hand)
  solveLimb(sk.rl, p.rlHand, p.rlElbow, p.rlDir, DIM.upperArm, DIM.forearm, DIM.hand)
  solveLimb(sk.lu, p.luHand, p.luElbow, p.luDir, DIM.upperArm, DIM.forearm, DIM.hand)
  solveLimb(sk.ll, p.llHand, p.llElbow, p.llDir, DIM.upperArm, DIM.forearm, DIM.hand)
  solveLimb(sk.rLeg, p.rFoot, p.rKnee, p.rFootDir, DIM.thigh, DIM.shin, DIM.foot)
  solveLimb(sk.lLeg, p.lFoot, p.lKnee, p.lFootDir, DIM.thigh, DIM.shin, DIM.foot)
}
