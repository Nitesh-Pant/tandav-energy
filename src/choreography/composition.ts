/**
 * The original procedural score, written as data.
 *
 * Every musical event of the built-in soundtrack is listed here. The Web Audio
 * synthesiser plays these notes, the visual timeline derives its authored cues
 * from them, and the no-audio fallback derives synthetic "analysis" from them —
 * so picture and sound are locked together by construction.
 *
 * Rhythm: the Shiv Tandav Stotram is in the Panchachamara metre, a strict
 * alternation of light and heavy syllables (da-DUM da-DUM …). The drums follow
 * that pulse: a light damaru stroke on the off-beat, a heavy taiko on the beat.
 */

import { mulberry32 } from '../utils/math'

export const BPM = 96
export const BEAT = 60 / BPM
export const BAR = BEAT * 4

export const SECTIONS = {
  awakening: 16,
  tandav: 44,
  fury: 104,
  climax: 104 + 52 * BEAT, // 136.5 — downbeat after 13 bars of fury
  stillness: 137.6,
  endTitle: 158,
  end: 172,
} as const

export type NoteKind =
  | 'boom' // deep sub impact
  | 'taiko' // heavy drum, the "guru" syllable
  | 'damaru' // light hourglass drum stroke, the "laghu" syllable
  | 'roll' // damaru roll
  | 'thunder'
  | 'bell'
  | 'shimmer' // metallic wash
  | 'riser'
  | 'om' // low vocal-formant swell
  | 'climax'

export interface Note {
  t: number
  kind: NoteKind
  vel: number
  dur?: number
}

/** Piecewise-linear automation of a continuous layer. */
export interface AutoPoint {
  t: number
  level: number
  bright: number
}

export interface Composition {
  notes: Note[]
  drone: AutoPoint[]
  wind: AutoPoint[]
  duration: number
}

function compose(): Composition {
  const notes: Note[] = []
  const rand = mulberry32(108)
  const add = (t: number, kind: NoteKind, vel: number, dur?: number) => notes.push({ t, kind, vel, dur })
  const S = SECTIONS

  // ── ACT I · The Void ─────────────────────────────────────────────
  add(2.5, 'om', 0.3, 11)
  add(9.5, 'boom', 0.32)
  add(13, 'bell', 0.22)

  // ── ACT II · The Awakening ───────────────────────────────────────
  add(S.awakening, 'thunder', 1)
  add(S.awakening, 'boom', 0.85)
  add(22, 'bell', 0.35)
  ;[20, 26, 32, 37].forEach((t, i) => add(t, 'roll', 0.38 + i * 0.1, 1 + i * 0.25))
  add(30, 'thunder', 0.55)
  add(38.5, 'thunder', 0.7)
  // Heartbeat, phase-aligned with the beat grid that starts at the Tandav.
  for (let t = S.tandav - BEAT * 2; t >= 27; t -= BEAT * 2) {
    add(t, 'taiko', 0.3 + ((t - 27) / (S.tandav - 27)) * 0.35)
  }
  add(S.tandav - 4, 'riser', 0.75, 4)

  // ── ACT III · The Tandav ─────────────────────────────────────────
  const tandavBars = Math.round((S.fury - S.tandav) / BAR) // 24
  for (let b = 0; b < tandavBars; b++) {
    for (let j = 0; j < 4; j++) {
      const t = S.tandav + (b * 4 + j) * BEAT
      const accent = j === 0 && b % 4 === 0
      add(t, 'taiko', j === 0 ? 0.92 : j === 2 ? 0.72 : 0.5)
      if (j === 0) add(t, 'boom', accent ? 1 : 0.55)
      if (accent) add(t, 'shimmer', 0.7, 3)
      add(t + BEAT / 2, 'damaru', 0.5 + rand() * 0.1)
      if (b >= 8) add(t + (BEAT * 3) / 4, 'damaru', 0.3)
      if (b >= 16 && b % 2 === 1 && j === 3) {
        add(t + BEAT / 4, 'damaru', 0.42)
        add(t + BEAT / 2, 'damaru', 0.5)
      }
    }
    if (b % 8 === 4) add(S.tandav + b * BAR, 'thunder', 0.85)
    if (b % 8 === 7) add(S.tandav + b * BAR + BEAT * 2, 'bell', 0.3)
  }
  add(S.fury - 2.5, 'riser', 0.6, 2.5)

  // ── ACT IV · Cosmic Fury ─────────────────────────────────────────
  const furyBeats = Math.round((S.climax - S.fury) / BEAT) // 52
  for (let i = 0; i < furyBeats; i++) {
    const t = S.fury + i * BEAT
    const bar = Math.floor(i / 4)
    const j = i % 4
    const lift = i / furyBeats
    add(t, 'taiko', 0.85 + lift * 0.15)
    if (j === 0 || j === 2) add(t, 'boom', j === 0 ? 0.75 + lift * 0.2 : 0.5)
    if (j === 0 && bar % 2 === 0) {
      add(t, 'boom', 1)
      add(t, 'shimmer', 0.75, 2.5)
    }
    for (let s = 1; s < 4; s++) add(t + (BEAT * s) / 4, 'damaru', 0.38 + lift * 0.25 + (s === 2 ? 0.1 : 0))
    if (j === 2 && bar % 2 === 1) add(t, 'thunder', 0.9)
    // Final bar: triplet taiko roll into the climax.
    if (bar === 12) {
      add(t + BEAT / 3, 'taiko', 0.8 + lift * 0.2)
      add(t + (BEAT * 2) / 3, 'taiko', 0.85 + lift * 0.2)
    }
  }
  add(S.climax - 8, 'riser', 1, 8)
  add(S.climax, 'climax', 1)
  add(S.climax, 'boom', 1)
  add(S.climax, 'thunder', 1)
  add(S.climax, 'shimmer', 1, 7)

  // ── ACT V · Stillness ────────────────────────────────────────────
  add(S.stillness + 1, 'om', 0.34, 16)
  add(140, 'bell', 0.55)
  add(150, 'bell', 0.4)
  add(160, 'bell', 0.3)

  notes.sort((a, b) => a.t - b.t)

  const drone: AutoPoint[] = [
    { t: 0, level: 0, bright: 0.05 },
    { t: 12, level: 0.22, bright: 0.1 },
    { t: S.awakening, level: 0.42, bright: 0.3 },
    { t: S.tandav, level: 0.5, bright: 0.58 },
    { t: S.fury, level: 0.55, bright: 0.75 },
    { t: S.climax, level: 0.62, bright: 1 },
    { t: S.climax + 0.08, level: 0, bright: 0.2 },
    { t: S.stillness, level: 0, bright: 0.12 },
    { t: S.stillness + 4, level: 0.24, bright: 0.12 },
    { t: S.end - 12, level: 0.16, bright: 0.08 },
    { t: S.end - 1, level: 0, bright: 0.05 },
  ]
  const wind: AutoPoint[] = [
    { t: 0, level: 0, bright: 0.2 },
    { t: 5, level: 0.32, bright: 0.25 },
    { t: S.tandav, level: 0.2, bright: 0.5 },
    { t: S.climax - 6, level: 0.42, bright: 1 },
    { t: S.climax + 0.08, level: 0, bright: 0.2 },
    { t: S.stillness + 2, level: 0.2, bright: 0.2 },
    { t: S.end - 1, level: 0, bright: 0.1 },
  ]

  return { notes, drone, wind, duration: S.end }
}

export const COMPOSITION = compose()

export function sampleAuto(points: AutoPoint[], t: number): { level: number; bright: number } {
  if (t <= points[0].t) return points[0]
  for (let i = 1; i < points.length; i++) {
    const b = points[i]
    if (t <= b.t) {
      const a = points[i - 1]
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return { level: a.level + (b.level - a.level) * k, bright: a.bright + (b.bright - a.bright) * k }
    }
  }
  return points[points.length - 1]
}
