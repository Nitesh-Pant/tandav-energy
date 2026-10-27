/**
 * Choreographs the rig as continuous motion rather than a series of jumps.
 *
 *  - A dance phase advances steadily (locked to the recording's beats when
 *    they are known, otherwise at a stately pace nudged by strong hits). Each
 *    step blends from where the last one arrived to the next pose, with a
 *    natural hold at each one.
 *  - Every verse has its own set of poses, so the dance changes as the shloka
 *    moves on; refrains and the fury have theirs. Sets change at a step
 *    boundary, never mid-move.
 *  - Sung words are acted out as gestures layered over the dance: the damaru
 *    shaken on "ḍamaḍ", the fire lifted on "jvalad".
 *  - Stamps, the anticipation before an accent, and Urdhva Tandava at the
 *    climax are weighted layers that rise and release smoothly over the dance.
 *  - Everything then passes through soft, well-damped springs: hands and head
 *    trail the body and settle, so nothing snaps.
 */

import { stage } from '../../choreography/stage'
import { visualEvents } from '../../choreography/events'
import { clamp, damp, smoothstep } from '../../utils/math'
import {
  AGNI_KEYS,
  AGNI_RISE,
  ANANDA,
  ANANDA_MIRROR,
  BHUJANGA,
  BHUJANGA_MIRROR,
  DAMARU_KEYS,
  DAMARU_SHAKE,
  LALITA,
  LALITA_MIRROR,
  MANDALA,
  RAISE,
  STAMP,
  TALA,
  TALA_MIRROR,
  TWIST,
  TWIST_MIRROR,
  URDHVA,
  blendKeys,
  blendPose,
  clonePose,
  type Pose,
} from './rig'

/** Pose sets, one per verse in rotation. Urdhva (the raised leg) is saved for the climax. */
const VERSE_SETS: Pose[][] = [
  [ANANDA, LALITA, ANANDA_MIRROR, LALITA_MIRROR],
  [MANDALA, TWIST, MANDALA, TWIST_MIRROR],
  [BHUJANGA, LALITA_MIRROR, BHUJANGA_MIRROR, LALITA],
  [TALA, ANANDA, TALA_MIRROR, ANANDA_MIRROR],
]
/** Between verses (refrains, interludes). */
const REFRAIN = [ANANDA, TWIST, ANANDA_MIRROR, TWIST_MIRROR]
/** Cosmic Fury: the whole vocabulary, quicker. */
const FURY = [ANANDA, TALA, BHUJANGA_MIRROR, MANDALA, ANANDA_MIRROR, TALA_MIRROR, BHUJANGA, TWIST]

function cycleFor(act: number, verse: number) {
  if (act === 3) return FURY
  if (act < 2) return VERSE_SETS[0]
  return verse > 0 ? VERSE_SETS[(verse - 1) % VERSE_SETS.length] : REFRAIN
}

type Key = keyof Pose

/** Spring stiffness per joint target: planted feet, a following torso, trailing hands and head. */
const STIFFNESS: Record<Key, number> = {
  pelvis: 60,
  torso: 45,
  head: 26,
  rFoot: 110,
  rKnee: 80,
  rFootDir: 60,
  lFoot: 110,
  lKnee: 80,
  lFootDir: 60,
  ruHand: 32,
  ruElbow: 36,
  ruDir: 26,
  rlHand: 36,
  rlElbow: 40,
  rlDir: 28,
  luHand: 32,
  luElbow: 36,
  luDir: 26,
  llHand: 36,
  llElbow: 40,
  llDir: 28,
}
const DAMPING_RATIO = 0.92

/** Width of the ease where the ground constraint engages, so it never kicks the body. */
const GROUND_SOFT = 0.04

/** Smooth max(0, x) over ±GROUND_SOFT. */
function softLift(x: number) {
  if (x <= -GROUND_SOFT) return 0
  return x >= GROUND_SOFT ? x : ((x + GROUND_SOFT) * (x + GROUND_SOFT)) / (4 * GROUND_SOFT)
}

/** After the springs, plant the lower foot (the knee bends to absorb it) without moving the body. */
function plantFoot(p: Pose) {
  const right = p.rFoot[1] <= p.lFoot[1]
  const foot = right ? p.rFoot : p.lFoot
  foot[1] -= softLift(foot[1] - 0.05)
}

function groundPose(p: Pose) {
  // Blends between poses with different standing feet would otherwise lift
  // both feet off the pedestal mid-transition. Applied to the targets only (the
  // springs then follow), and as a smooth max(0, lift), so the body's velocity
  // stays continuous as the constraint takes hold and lets go.
  const lift = softLift(Math.min(p.rFoot[1], p.lFoot[1]) - 0.05)
  if (lift > 0) for (const k in p) p[k as Key][1] -= lift
}

/** Ease with a short hold at both ends: the dancer arrives, rests, then moves on. */
const flow = (x: number) => smoothstep(0.12, 0.88, x)

export class DanceController {
  private cyclePose: Pose = clonePose(ANANDA)
  private layered: Pose = clonePose(ANANDA)
  private out: Pose = clonePose(ANANDA)
  private sprung: Pose = clonePose(ANANDA)
  /** The sprung pose with the lower foot planted; the spring state itself is left untouched. */
  private planted: Pose = clonePose(ANANDA)
  private vel: Pose = clonePose(ANANDA)
  private snap = true
  private phase = 0
  private stampW = 0
  private stampTimer = 0
  private climaxTimer = 0
  private climaxW = 0
  private raiseW = 0
  private lastBass = 0
  /** Phase still to be added from a hit, released gradually so the pose never jumps. */
  private nudge = 0
  /** Beat position last frame, so the phase advances continuously when steps change length. */
  private lastBeat = -1
  private step = 0
  private from: Pose = ANANDA
  private to: Pose = ANANDA
  private gesture = { damaru: 0, agni: 0 }
  private gestureW = { damaru: 0, agni: 0 }

  connect(): () => void {
    const offs = [
      visualEvents.on('stamp', ({ strength }) => {
        this.stampTimer = 0.55 * Math.max(0.5, strength)
      }),
      visualEvents.on('climax', () => {
        this.climaxTimer = 3.8
      }),
      visualEvents.on('gesture', ({ kind, duration }) => {
        this.gesture[kind] = Math.max(this.gesture[kind], duration)
      }),
      visualEvents.on('reset', () => {
        this.phase = 0
        this.nudge = 0
        this.stampW = this.raiseW = this.climaxW = 0
        this.stampTimer = this.climaxTimer = 0
        this.gesture.damaru = this.gesture.agni = this.gestureW.damaru = this.gestureW.agni = 0
        this.lastBeat = -1
        this.step = 0
        this.from = this.to = ANANDA
        this.snap = true
      }),
    ]
    return () => offs.forEach((off) => off())
  }

  update(dt: number): Pose {
    const s = stage
    const dancing = s.act >= 2 && s.act <= 3
    const cycle = cycleFor(s.act, s.verse)

    // ── Phase ──
    const beatsPerStep = s.act === 3 ? 2 : 4
    if (s.beatIndex >= 0) {
      const beat = s.beatIndex + s.beatPhase
      const d = beat - this.lastBeat
      // Advance by beats travelled; resync only after a real seek. The audio
      // clock can tick back a few milliseconds, which must not count as one.
      if (this.lastBeat < 0 || d < -0.5 || d > 4) this.phase = beat / beatsPerStep
      else if (d > 0) this.phase += d / beatsPerStep
      if (d > 0 || d < -0.5 || this.lastBeat < 0) this.lastBeat = beat
    } else {
      this.lastBeat = -1
      // Free tempo: a stately pace that quickens with intensity; strong hits
      // pull the next arrival a little closer, so steps tend to land on them.
      const stepSeconds = s.act === 3 ? 1.7 : 3.0
      this.phase += (dt / stepSeconds) * (0.8 + s.intensity * 0.4)
      if (s.bass > 0.75 && this.lastBass <= 0.75 && dancing) {
        const toNext = Math.ceil(this.phase) - this.phase
        if (toNext < 0.45) this.nudge = Math.max(this.nudge, toNext * 0.5)
      }
      const add = this.nudge * (1 - Math.exp(-dt * 6))
      this.phase += add
      this.nudge -= add
    }
    this.lastBass = s.bass
    const i = Math.floor(this.phase)
    if (i !== this.step) {
      // Each step starts where the last one arrived, so a new pose set never jumps.
      this.from = i === this.step + 1 ? this.to : cycle[i % cycle.length]
      this.to = cycle[(i + 1) % cycle.length]
      this.step = i
    }
    blendPose(this.from, this.to, flow(this.phase - i), this.cyclePose)

    // ── Rest ↔ dance amplitude ──
    blendPose(ANANDA, this.cyclePose, clamp(s.dance), this.layered)

    // ── Layers: anticipation, stamp, climax ──
    const raiseTarget = dancing && s.nextAccentIn < 0.5 ? 0.7 : 0
    this.raiseW = damp(this.raiseW, raiseTarget, raiseTarget > this.raiseW ? 7 : 4, dt)
    this.stampTimer -= dt
    this.stampW = damp(this.stampW, this.stampTimer > 0 ? 0.6 : 0, this.stampTimer > 0 ? 7 : 2.5, dt)
    this.climaxTimer -= dt
    const climaxTarget = this.climaxTimer > 0 || (s.toClimax > -1.8 && s.toClimax < 0) ? 1 : 0
    this.climaxW = damp(this.climaxW, climaxTarget, climaxTarget ? 2.5 : 1.2, dt)
    if (this.raiseW > 0.001) blendPose(this.layered, RAISE, this.raiseW, this.layered)
    if (this.stampW > 0.001) blendPose(this.layered, STAMP, this.stampW, this.layered)
    if (this.climaxW > 0.001) blendPose(this.layered, URDHVA, this.climaxW, this.layered)
    // Gestures for sung words ride on top of everything but the climax.
    for (const k of ['damaru', 'agni'] as const) {
      this.gesture[k] -= dt
      const on = this.gesture[k] > 0 && dancing
      this.gestureW[k] = damp(this.gestureW[k], on ? 0.85 : 0, on ? 6 : 2.5, dt)
      const w = this.gestureW[k] * (1 - this.climaxW)
      if (w > 0.001) blendKeys(this.layered, k === 'damaru' ? DAMARU_SHAKE : AGNI_RISE, w, k === 'damaru' ? DAMARU_KEYS : AGNI_KEYS)
    }

    blendPose(this.layered, this.layered, 0, this.out)
    this.breathe(s.time)
    groundPose(this.out)
    this.spring(dt)
    blendPose(this.sprung, this.sprung, 0, this.planted)
    plantFoot(this.planted)
    return this.planted
  }

  /** Continuous, low-amplitude life: hips sway, torso breathes, arms float. */
  private breathe(t: number) {
    const a = 0.25 + stage.dance * 0.75
    const o = this.out
    o.pelvis[0] += Math.sin(t * 0.9) * 0.012 * a
    o.pelvis[1] += Math.sin(t * 1.8) * 0.006 * a
    o.torso[2] += Math.sin(t * 0.9 + 0.6) * 0.035 * a
    o.torso[1] += Math.sin(t * 0.45) * 0.05 * a
    o.head[2] += Math.sin(t * 0.9 + 1.4) * 0.04 * a
    for (const [k, ph] of [
      ['ruHand', 0],
      ['luHand', 1.7],
      ['rlHand', 0.8],
      ['llHand', 2.6],
    ] as const) {
      o[k][1] += Math.sin(t * 1.1 + ph) * 0.018 * a
      o[k][0] += Math.cos(t * 0.8 + ph) * 0.012 * a
    }
  }

  private spring(dt: number) {
    if (this.snap) {
      blendPose(this.out, this.out, 0, this.sprung)
      for (const k in this.vel) this.vel[k as Key].fill(0)
      this.snap = false
      return
    }
    // Impacts tighten the springs a little so the stamp still lands.
    const urgent = 1 + this.stampW * 0.8
    const steps = dt > 1 / 70 ? 2 : 1
    const h = dt / steps
    for (let n = 0; n < steps; n++) {
      for (const k in this.out) {
        const key = k as Key
        const stiff = STIFFNESS[key] * urgent
        const c = 2 * DAMPING_RATIO * Math.sqrt(stiff)
        const x = this.sprung[key]
        const v = this.vel[key]
        const target = this.out[key]
        for (let j = 0; j < 3; j++) {
          v[j] += (stiff * (target[j] - x[j]) - c * v[j]) * h
          x[j] += v[j] * h
        }
      }
    }
  }
}
