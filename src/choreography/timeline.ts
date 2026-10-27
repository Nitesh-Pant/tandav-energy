/**
 * The five-act structure and authored cues.
 *
 * Two sources:
 *  - The built-in procedural score: acts and cues come straight from the
 *    composition, so every lightning strike lands on its thunder.
 *  - A user-supplied track: acts default to proportions of the track length,
 *    optionally overridden by `public/audio/tandav.cues.json`. Live audio
 *    analysis then supplies the beat-level detail.
 */

import { BEAT, BPM, COMPOSITION, SECTIONS } from './composition'
import { clamp, easeInOutSine, easeOutCubic, lerp, smoothstep } from '../utils/math'
import type { TrackStructure } from '../audio/trackAnalysis'

export type ActId = 'void' | 'awakening' | 'tandav' | 'fury' | 'stillness'

export const ACTS: { id: ActId; numeral: string; title: string }[] = [
  { id: 'void', numeral: 'I', title: 'The Void' },
  { id: 'awakening', numeral: 'II', title: 'The Awakening' },
  { id: 'tandav', numeral: 'III', title: 'The Tandav' },
  { id: 'fury', numeral: 'IV', title: 'Cosmic Fury' },
  { id: 'stillness', numeral: 'V', title: 'Stillness' },
]

export type CueKind = 'lightning' | 'glint' | 'accent' | 'climax'

export interface Cue {
  t: number
  kind: CueKind
  strength: number
}

export interface Timeline {
  duration: number
  /** Start time of each act, in ACTS order. */
  actStarts: number[]
  cues: Cue[]
  climax: number
  endTitle: number
  /** Known pulse (procedural score only). Lets the dance land poses on the beat. */
  tempo: { bpm: number; start: number; end: number } | null
  /** Individual beat times of a recording whose tempo drifts (from the cue file). */
  beats: number[] | null
}

export function buildScoreTimeline(): Timeline {
  const cues: Cue[] = []
  let firstThunder = true
  for (const n of COMPOSITION.notes) {
    if (n.kind === 'thunder') {
      cues.push({ t: n.t, kind: 'lightning', strength: n.vel })
      if (firstThunder || n.vel >= 0.85) cues.push({ t: n.t + 0.12, kind: 'glint', strength: firstThunder ? 1 : 0.6 })
      firstThunder = false
    } else if (n.kind === 'boom' && n.vel >= 1 && n.t < SECTIONS.climax - 0.01) {
      cues.push({ t: n.t, kind: 'accent', strength: 1 })
    } else if (n.kind === 'climax') {
      cues.push({ t: n.t, kind: 'climax', strength: 1 })
    }
  }
  cues.sort((a, b) => a.t - b.t)
  return {
    duration: COMPOSITION.duration,
    actStarts: [0, SECTIONS.awakening, SECTIONS.tandav, SECTIONS.fury, SECTIONS.stillness],
    cues,
    climax: SECTIONS.climax,
    endTitle: SECTIONS.endTitle,
    tempo: { bpm: BPM, start: SECTIONS.tandav - BEAT * 28, end: SECTIONS.climax },
    beats: null,
  }
}

/** Shape of `public/audio/tandav.cues.json` (all fields optional, seconds). */
export interface CueFile {
  acts?: Partial<Record<Exclude<ActId, 'void'>, number>>
  climax?: number
  endTitle?: number
  lightning?: number[]
  accents?: number[]
  /** Tempo for beat-locked dancing; 0 = free tempo (ignore the detected one). */
  bpm?: number
  beatOffset?: number
  /** Beat times for a recording whose tempo drifts; the dance steps land on these. */
  beats?: number[]
}

/**
 * Timeline for a user soundtrack. Precedence per field: cue file → automatic
 * structure analysis → fixed proportions of the duration.
 */
export function buildTrackTimeline(duration: number, file?: CueFile | null, auto?: TrackStructure | null): Timeline {
  const d = Math.max(30, auto?.duration ?? duration)
  const acts = file?.acts ?? {}
  const actStarts = [
    0,
    acts.awakening ?? auto?.acts.awakening ?? d * 0.07,
    acts.tandav ?? auto?.acts.tandav ?? d * 0.2,
    acts.fury ?? auto?.acts.fury ?? d * 0.68,
    acts.stillness ?? auto?.acts.stillness ?? d * 0.89,
  ]
  const climax = file?.climax ?? auto?.climax ?? actStarts[4] - 0.8
  const cues: Cue[] = []
  const lightning = file?.lightning ?? auto?.lightning ?? [actStarts[1], actStarts[2], actStarts[3]]
  lightning.forEach((t, i) => {
    cues.push({ t, kind: 'lightning', strength: 1 })
    if (i === 0) cues.push({ t: t + 0.12, kind: 'glint', strength: 1 })
  })
  ;(file?.accents ?? auto?.accents ?? []).forEach((t) => {
    if (Math.abs(t - climax) > 1.5) cues.push({ t, kind: 'accent', strength: 1 })
  })
  cues.push({ t: climax, kind: 'climax', strength: 1 })
  cues.sort((a, b) => a.t - b.t)
  const bpm = file?.bpm ?? auto?.tempo?.bpm
  const offset = file?.beatOffset ?? auto?.tempo?.offset ?? actStarts[2]
  // Start the beat grid on the first downbeat at or after the awakening.
  let start = offset
  if (bpm) {
    const beat = 60 / bpm
    while (start - beat >= actStarts[1]) start -= beat
  }
  return {
    duration: d,
    actStarts,
    cues,
    climax,
    endTitle: file?.endTitle ?? auto?.endTitle ?? Math.max(actStarts[4] + 8, d - 14),
    tempo: bpm ? { bpm, start, end: climax } : null,
    beats: file?.beats?.length ? [...file.beats].sort((a, b) => a - b) : null,
  }
}

export function actAt(tl: Timeline, t: number): { index: number; progress: number } {
  let index = 0
  for (let i = tl.actStarts.length - 1; i >= 0; i--) {
    if (t >= tl.actStarts[i]) {
      index = i
      break
    }
  }
  const start = tl.actStarts[index]
  const end = index + 1 < tl.actStarts.length ? tl.actStarts[index + 1] : tl.duration
  return { index, progress: clamp((t - start) / Math.max(0.001, end - start)) }
}

/**
 * Authored macro-envelopes, keyed by act and progress within the act.
 * Live audio modulates these; it never replaces them, which is what gives the
 * piece a real build, climax and release.
 */
export interface Envelope {
  energy: number
  halo: number
  fire: number
  dance: number
  dust: number
  thirdEye: number
}

export function envelopeAt(tl: Timeline, t: number, out: Envelope): Envelope {
  const { index, progress: p } = actAt(tl, t)
  switch (index) {
    case 0:
      out.energy = lerp(0.02, 0.08, p)
      out.halo = lerp(0.03, 0.16, easeInOutSine(p))
      out.fire = 0
      out.dance = 0
      out.dust = lerp(0.18, 0.3, p)
      // A single slow breath of light as the visitor crosses the threshold.
      out.halo += 0.22 * Math.exp(-Math.pow((t - 1.8) / 1.1, 2))
      break
    case 1:
      out.energy = lerp(0.12, 0.45, easeInOutSine(p))
      out.halo = lerp(0.35, 0.62, easeOutCubic(p))
      out.fire = smoothstep(0.55, 1, p) * 0.25
      out.dance = smoothstep(0.25, 1, p) * 0.32
      out.dust = lerp(0.35, 0.6, p)
      break
    case 2:
      out.energy = lerp(0.52, 0.74, p)
      out.halo = lerp(0.66, 0.8, p)
      out.fire = lerp(0.55, 0.78, smoothstep(0, 0.15, p) * 0.6 + p * 0.4)
      out.dance = lerp(0.72, 0.88, p)
      out.dust = lerp(0.65, 0.85, p)
      break
    case 3:
      out.energy = lerp(0.76, 1, p * p)
      out.halo = lerp(0.82, 1, p)
      out.fire = lerp(0.8, 1, p)
      out.dance = 1
      out.dust = lerp(0.85, 1, p)
      break
    default: {
      const settle = easeOutCubic(clamp(p * 2.2))
      out.energy = lerp(0.2, 0.03, settle)
      out.halo = lerp(0.55, 0.3, settle)
      out.fire = lerp(0.3, 0, smoothstep(0, 0.45, p))
      out.dance = 0
      out.dust = lerp(0.6, 0.25, settle)
    }
  }
  // The third eye opens across the final approach to the climax and closes after.
  const toClimax = t - tl.climax
  out.thirdEye = toClimax < 0 ? smoothstep(-7, -0.4, toClimax) : 1 - smoothstep(0.5, 6, toClimax)
  return out
}
