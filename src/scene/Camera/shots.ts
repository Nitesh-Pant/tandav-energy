/**
 * The shot list for the dance (Acts III–IV) and the edit that sequences it.
 *
 * Each shot is a framing plus a slow drift across its duration. The edit
 * changes shot on the sung lines — a cut on each verse start (where the stamp
 * lands), a blend on each half-verse — and fills long instrumental passages
 * with blends so no framing lasts more than ~20 s. Everything is derived from
 * time, so seeking lands on the same shot as playing through.
 */

import type { AnchorId } from '../../choreography/anchors'
import type { Timeline } from '../../choreography/timeline'
import type { TimedLine } from '../../shloka/lyrics'

export interface ShotDef {
  name: string
  radius: number
  azimuth: number
  /** Camera height: absolute, or above the followed anchor. */
  height: number
  /** Look-at height: absolute, or above the followed anchor. */
  targetY: number
  fov: number
  /** Frame a moving part of the figure instead of the centre of the stage. */
  follow?: AnchorId
  /** How far the anchor pulls the look-at point sideways (0..1). */
  followX?: number
  /** Drift over the shot's duration. */
  dRadius?: number
  dAzimuth?: number
  dHeight?: number
}

const HERO: ShotDef = { name: 'hero', radius: 9.6, azimuth: 0.06, height: 1.35, targetY: 2.5, fov: 40, dRadius: -1.1, dAzimuth: 0.08 }
const LOW_HERO: ShotDef = { name: 'low', radius: 7.0, azimuth: -0.28, height: 0.15, targetY: 2.75, fov: 46, dAzimuth: 0.16, dHeight: 0.2 }
const THREE_Q_L: ShotDef = { name: '3q-left', radius: 7.8, azimuth: 0.62, height: 1.7, targetY: 2.35, fov: 39, dAzimuth: 0.18, dRadius: -0.6 }
const THREE_Q_R: ShotDef = { name: '3q-right', radius: 7.8, azimuth: -0.66, height: 1.5, targetY: 2.35, fov: 39, dAzimuth: -0.16, dRadius: -0.6 }
const PROFILE: ShotDef = { name: 'profile', radius: 8.2, azimuth: 1.12, height: 1.9, targetY: 2.3, fov: 37, dAzimuth: -0.12 }
const WIDE: ShotDef = { name: 'wide', radius: 15.5, azimuth: -0.12, height: 2.4, targetY: 3.0, fov: 38, dRadius: -1.8, dAzimuth: 0.14 }
const MEDIUM: ShotDef = { name: 'medium', radius: 5.6, azimuth: 0.26, height: 2.35, targetY: 2.45, fov: 40, dAzimuth: -0.14, dRadius: -0.3 }
const HIGH: ShotDef = { name: 'high', radius: 8.4, azimuth: 0.35, height: 5.2, targetY: 1.9, fov: 40, dAzimuth: 0.2 }
const FACE: ShotDef = {
  name: 'face',
  radius: 4.3,
  azimuth: 0.14,
  height: 0.0,
  targetY: -0.12,
  fov: 36,
  follow: 'head',
  followX: 0.8,
  dRadius: -0.4,
  dAzimuth: 0.1,
}
const DAMARU: ShotDef = {
  name: 'damaru',
  radius: 4.2,
  azimuth: -0.42,
  height: 0.0,
  targetY: -0.25,
  fov: 36,
  follow: 'damaru',
  followX: 0.6,
  dAzimuth: 0.12,
}
/** The stamping foot on the lotus pedestal, seen from above so the ground reads as stone, not void. */
const FOOT: ShotDef = {
  name: 'foot',
  radius: 4.4,
  azimuth: 0.3,
  height: 1.7,
  targetY: 0.55,
  fov: 40,
  follow: 'rightFoot',
  followX: 0.6,
  dAzimuth: -0.12,
  dHeight: 0.3,
}
/** Held through the last seconds before the climax: the full figure inside the ring. */
export const PRE_CLIMAX: ShotDef = { name: 'pre-climax', radius: 10.5, azimuth: 0, height: 0.9, targetY: 2.55, fov: 42, dRadius: -1.6 }

const SEQ_TANDAV = [HERO, THREE_Q_L, FACE, LOW_HERO, THREE_Q_R, DAMARU, WIDE, MEDIUM, FOOT, PROFILE, HIGH, THREE_Q_L, FACE, HERO, THREE_Q_R, DAMARU]
const SEQ_FURY = [LOW_HERO, FOOT, THREE_Q_R, DAMARU, WIDE, THREE_Q_L, FACE, HERO, PROFILE, MEDIUM]
/** Reduced motion keeps the framing calmer: no close-ups of a moving part. */
const CALM = new Set(['face', 'damaru', 'foot', 'high'])

export interface EditPoint {
  t: number
  end: number
  shot: ShotDef
  cut: boolean
}

const FILL_MAX = 20
const FURY_FILL = 9
const PRE_CLIMAX_LEAD = 7

/** Insert evenly spaced blends wherever two edit points are too far apart. */
function fill(points: { t: number; cut: boolean }[], from: number, to: number, every: number) {
  const out: { t: number; cut: boolean }[] = []
  const all = [...points, { t: to, cut: false }]
  let prev = from
  for (const p of all) {
    const gap = p.t - prev
    if (gap > every * 1.3) {
      const n = Math.ceil(gap / every)
      for (let i = 1; i < n; i++) out.push({ t: prev + (gap * i) / n, cut: false })
    }
    if (p.t < to) out.push(p)
    prev = p.t
  }
  return out
}

export function buildEdit(tl: Timeline, lyrics: readonly TimedLine[], reducedMotion: boolean): EditPoint[] {
  const [, , tandav, fury, stillness] = tl.actStarts
  const preClimax = Math.max(fury + 4, tl.climax - PRE_CLIMAX_LEAD)
  // Sung lines are edit points, but a shot always holds for a moment first; verse starts always cut.
  const lines = (from: number, to: number, hold: number) => {
    const out: { t: number; cut: boolean }[] = []
    let last = from
    for (const l of lyrics) {
      if (l.t <= from + 3 || l.t >= to - 3) continue
      if (!l.verseStart && l.t - last < hold) continue
      out.push({ t: l.t, cut: l.verseStart })
      last = l.t
    }
    return out
  }

  const sections: { from: number; to: number; seq: ShotDef[]; every: number; hold: number }[] = [
    { from: tandav, to: fury, seq: SEQ_TANDAV, every: FILL_MAX, hold: 5 },
    { from: fury, to: preClimax, seq: SEQ_FURY, every: FURY_FILL, hold: 8 },
  ]
  const edit: EditPoint[] = []
  for (const s of sections) {
    const pts = [{ t: s.from, cut: true }, ...fill(lines(s.from, s.to, s.hold), s.from, s.to, s.every)]
    const seq = reducedMotion ? s.seq.filter((d) => !CALM.has(d.name)) : s.seq
    pts.forEach((p, i) => {
      edit.push({ t: p.t, end: pts[i + 1]?.t ?? s.to, shot: seq[i % seq.length], cut: p.cut && !reducedMotion })
    })
  }
  edit.push({ t: preClimax, end: stillness, shot: PRE_CLIMAX, cut: false })
  return edit
}

export function editIndexAt(edit: EditPoint[], t: number) {
  for (let i = edit.length - 1; i >= 0; i--) if (t >= edit[i].t) return t < edit[i].end ? i : -1
  return -1
}
