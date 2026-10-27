/**
 * The director turns the authored timeline + live audio features into the
 * per-frame `stage` values and discrete visual events.
 *
 * Authored cues decide the big moments (act changes, thunder, accents, the
 * climax). Live analysis adds the small, rhythmic detail — always through
 * thresholds, cooldowns and per-act gating so noisy audio can't make the
 * scene flicker or shake.
 */

import { features, resetFeatures, SyntheticFeatures } from '../audio/audioAnalysis'
import type { EngineMode } from '../audio/audioEngine'
import { FLASH_MIN_INTERVAL } from '../config'
import { uiStore } from '../state/store'
import { clamp, damp } from '../utils/math'
import { anchors, type AnchorId } from './anchors'
import { getLyrics, lineIndexAt, type TimedLine } from '../shloka/lyrics'
import { visualEvents } from './events'
import { stage } from './stage'
import { ACTS, actAt, buildScoreTimeline, envelopeAt, type Cue, type Envelope, type Timeline } from './timeline'

const SPARK_SOURCES: AnchorId[] = ['damaru', 'fireHand', 'leftFoot', 'rightFoot', 'tridentTip']
/** Sung verse starts are the accents; cue-file accents this close to one are dropped. */
const VERSE_MERGE = 2.5
/** At most one big hit (stamp + ring) in this window; anything sooner is folded into it. */
const MAJOR_GAP = 1.5
/** A strike this close to a stamp shares its moment, so it lights the world less. */
const SHARED_MOMENT = 0.8

/** Index of the last beat at or before t (binary search). */
function beatAt(beats: number[], t: number) {
  let lo = 0
  let hi = beats.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (beats[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

const VOWELS = /[aāiīuūṛṝḷeo]/g

/**
 * Where each match of `word` falls in a line, as a fraction of the line (0..1).
 * Chant moves at a near-even pace per syllable, so vowels stand in for time.
 */
function wordTimes(iast: string, word: RegExp): number[] {
  const total = (iast.match(VOWELS) ?? []).length || 1
  const out: number[] = []
  const re = new RegExp(word.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(iast))) out.push((iast.slice(0, m.index).match(VOWELS) ?? []).length / total)
  return out
}

/** Verse being sung at t, held for a few seconds after its last line so short breaths don't change the dance. */
function verseAt(t: number) {
  const lines = getLyrics()
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (t < l.t) continue
    return t < Math.max(l.end, l.t + l.sung) + 3 ? l.verse : 0
  }
  return 0
}

export class Director {
  timeline: Timeline = buildScoreTimeline()
  private cueIdx = 0
  private seenBass = 0
  private seenHigh = 0
  private lastFlash = -10
  private lastShock = -10
  private lastAccent = -10
  private lastSpark = -10
  private lastLiveBolt = -10
  private lastAct = -1
  private env: Envelope = { energy: 0, halo: 0, fire: 0, dance: 0, dust: 0, thirdEye: 0 }
  private synthetic = new SyntheticFeatures()
  private sparkCursor = 0
  private lineIdx = -1
  private lastT = 0
  /** Short sequences scheduled by shloka lines (e.g. one shockwave per epithet). */
  private scheduled: { t: number; run: () => void }[] = []

  setTimeline(tl: Timeline) {
    this.timeline = tl
    this.reset()
  }

  /** Swap in a refined timeline mid-play (e.g. once a track's duration is known) without replaying cues. */
  replaceTimeline(tl: Timeline, t: number) {
    this.timeline = tl
    this.cueIdx = tl.cues.findIndex((c) => c.t > t)
    if (this.cueIdx < 0) this.cueIdx = tl.cues.length
  }

  reset() {
    this.cueIdx = 0
    this.seenBass = features.bassOnsets
    this.seenHigh = features.highOnsets
    this.lastFlash = this.lastShock = this.lastAccent = this.lastSpark = this.lastLiveBolt = -10
    this.lastAct = -1
    this.lineIdx = -1
    this.lastT = 0
    this.scheduled = []
    for (const k in stage.motif) stage.motif[k as keyof typeof stage.motif] = 0
    stage.lineIndex = -1
    this.synthetic.reset()
    resetFeatures()
    stage.flash = stage.glint = stage.climax = stage.impulse = 0
    stage.beatIndex = -1
    visualEvents.emit('reset', {})
  }

  /** Idle state behind the intro screen: a near-black void with a faint glow. */
  idle(dt: number, elapsed: number) {
    stage.dt = dt
    stage.time = elapsed
    stage.energy = damp(stage.energy, 0.02, 2, dt)
    stage.intensity = stage.energy
    stage.halo = damp(stage.halo, 0.05 + 0.02 * Math.sin(elapsed * 0.6), 1.5, dt)
    // Behind the intro the bronze stands, waiting.
    stage.statue = 1
    stage.fire = damp(stage.fire, 0, 2, dt)
    stage.dance = damp(stage.dance, 0, 2, dt)
    stage.dust = damp(stage.dust, 0.16, 1, dt)
    stage.thirdEye = damp(stage.thirdEye, 0, 2, dt)
    stage.swirl = 0.03
    stage.swirlPhase += stage.swirl * dt
    stage.turbulence = 0.05
    stage.flash *= Math.exp(-dt * 6)
    stage.climax *= Math.exp(-dt * 0.6)
    stage.act = 0
    stage.actProgress = 0
    stage.beatIndex = -1
    stage.nextAccentIn = Infinity
    stage.bass = stage.mid = stage.high = stage.loudness = 0
  }

  update(t: number, dt: number, mode: EngineMode, analyzer: { update(dt: number): void } | null) {
    const tl = this.timeline
    stage.dt = dt
    stage.time = t

    if (t < this.lastT - 0.5) this.rewind(t)
    this.lastT = t

    if (mode !== 'silent' && analyzer) analyzer.update(dt)
    else this.synthetic.update(t, dt)
    stage.bass = features.bass
    stage.mid = features.mid
    stage.high = features.high
    stage.loudness = features.loudness

    // ── Macro arc ──
    const { index, progress } = actAt(tl, t)
    stage.act = index
    stage.actProgress = progress
    if (index !== this.lastAct) {
      this.lastAct = index
      uiStore.set({ act: ACTS[index].id })
    }
    envelopeAt(tl, t, this.env)
    const e = this.env
    const m = stage.motif
    const live = Math.max(e.energy, 0.25) // words still speak in quiet passages
    stage.energy = damp(stage.energy, e.energy, 1.6, dt)
    stage.halo = damp(stage.halo, e.halo + features.bass * 0.12 * e.energy + m.radiance * 0.18 * live, 2.2, dt)
    stage.fire = damp(stage.fire, Math.min(1.1, e.fire * (0.85 + features.mid * 0.3) + m.fire * 0.32 * live), 1.8, dt)
    stage.dance = damp(stage.dance, e.dance * (1 - m.calm * 0.45), 1.2, dt)
    stage.dust = damp(stage.dust, e.dust, 1, dt)
    stage.thirdEye = damp(stage.thirdEye, Math.max(e.thirdEye, m.eye * 0.8), 3, dt)
    stage.intensity = clamp(stage.energy * (0.7 + features.loudness * 0.5))
    stage.swirl = 0.03 + stage.intensity * 0.28 + features.bass * 0.06 * stage.energy
    stage.swirlPhase += stage.swirl * dt
    stage.turbulence = clamp((stage.intensity * 0.8 + features.mid * 0.25 * stage.energy) * (1 - m.calm * 0.4))
    stage.glint *= Math.exp(-dt * 2.2)
    stage.climax *= Math.exp(-dt * 0.45)

    // ── Beat grid (procedural score / cue file with bpm or individual beats) ──
    if (tl.tempo) stage.beatLength = 60 / tl.tempo.bpm
    if (tl.beats && t >= tl.beats[0] && t < Math.min(tl.climax, tl.beats[tl.beats.length - 1])) {
      const i = beatAt(tl.beats, t)
      const len = tl.beats[i + 1] - tl.beats[i]
      stage.beatIndex = i
      stage.beatPhase = (t - tl.beats[i]) / len
      stage.beatLength = len
    } else if (tl.tempo && t >= tl.tempo.start && t < tl.tempo.end) {
      const b = (t - tl.tempo.start) / (60 / tl.tempo.bpm)
      stage.beatIndex = Math.floor(b)
      stage.beatPhase = b - stage.beatIndex
    } else {
      stage.beatIndex = -1
    }

    // ── Authored cues ──
    const cues = tl.cues
    while (this.cueIdx < cues.length && cues[this.cueIdx].t <= t) {
      const cue = cues[this.cueIdx++]
      // Skip stale cues (e.g. after a hidden tab); the climax gets a longer grace period.
      if (t - cue.t > (cue.kind === 'climax' ? 4 : 1)) continue
      this.fireCue(cue, t)
    }
    stage.toClimax = t - tl.climax
    // The bronze comes alive inside the first lightning strike and returns to
    // bronze in the climax burst. Derived from time, so seeking stays correct.
    const awaken = (tl.cues.find((c) => c.kind === 'lightning' && c.t >= tl.actStarts[1] - 0.5)?.t ?? tl.actStarts[1]) + 0.06
    stage.statue = t < awaken || t >= tl.climax + 0.05 ? 1 : 0
    stage.nextAccentIn = Infinity
    for (let i = this.cueIdx; i < cues.length; i++) {
      const c = cues[i]
      if (c.t - t > 1.5) break
      if (c.kind === 'accent' && !this.nearVerseStart(c.t)) {
        stage.nextAccentIn = c.t - t
        break
      }
    }
    for (const line of getLyrics()) {
      if (line.t <= t) continue
      if (line.t - t > 1.5) break
      if (line.verseStart) stage.nextAccentIn = Math.min(stage.nextAccentIn, line.t - t)
    }

    // ── Shloka: the words of the line being sung ──
    const li = lineIndexAt(t)
    if (li !== this.lineIdx) {
      this.lineIdx = li
      stage.lineIndex = li
      if (li >= 0) this.onLine(getLyrics()[li], t)
    }
    stage.verse = verseAt(t)
    if (this.scheduled.length) {
      const due = this.scheduled.filter((ev) => ev.t <= t)
      if (due.length) {
        this.scheduled = this.scheduled.filter((ev) => ev.t > t)
        for (const ev of due) if (t - ev.t < 0.6) ev.run()
      }
    }
    const fade = Math.exp(-dt / 3.2)
    for (const k in m) m[k as keyof typeof m] *= fade

    // ── Live onsets ──
    if (features.bassOnsets !== this.seenBass) {
      this.seenBass = features.bassOnsets
      this.onBass(features.lastBassStrength, t, mode)
    }
    if (features.highOnsets !== this.seenHigh) {
      this.seenHigh = features.highOnsets
      this.onHigh(features.lastHighStrength, t, mode)
    }
  }

  /** After a backward seek: realign cue and line cursors without replaying anything. */
  private rewind(t: number) {
    this.cueIdx = this.timeline.cues.findIndex((c) => c.t > t)
    if (this.cueIdx < 0) this.cueIdx = this.timeline.cues.length
    this.lineIdx = lineIndexAt(t)
    stage.lineIndex = this.lineIdx
    this.scheduled = []
  }

  private schedule(at: number, run: () => void) {
    this.scheduled.push({ t: at, run })
  }

  /** Turn the imagery of a sung line into visual events, timed to where its words fall. */
  private onLine(line: TimedLine, t: number) {
    const m = stage.motif
    const sung = Math.max(2, line.sung)
    const dancing = stage.act >= 2 && stage.act <= 3
    const at = (word: RegExp) => wordTimes(line.iast, word).map((k) => line.t + k * sung)
    if (line.verseStart && dancing) this.accent(0.85, t)
    for (const motif of line.motifs) {
      switch (motif) {
        case 'fire': {
          // On "dhagad … jvalad" when the line names the blaze, otherwise as the line begins.
          const when = at(/dhagad|jval|havya|anala/)[0] ?? t
          this.schedule(when, () => {
            stage.motif.fire = 1
            this.sparks('fireHand', 0.8)
            visualEvents.emit('gesture', { kind: 'agni', duration: 1.6 })
          })
          break
        }
        case 'thirdEye':
          m.eye = 1
          this.sparks('head', 0.5)
          break
        case 'moon':
          m.moon = 1
          break
        case 'serpent':
          m.serpent = 1
          break
        case 'ganga':
          m.ganga = 1
          break
        case 'throat':
          m.throat = 1
          break
        case 'radiance':
          m.radiance = 1
          break
        case 'blessing':
          m.radiance = Math.max(m.radiance, 0.6)
          m.calm = Math.max(m.calm, 0.4)
          break
        case 'calm':
          m.calm = 1
          break
        case 'storm':
          m.storm = 1
          this.strike(0.9, t)
          this.schedule(t + sung * 0.45, () => this.strike(0.75, stage.time, 'mountain'))
          break
        case 'damaru': {
          // ḍamaḍ ḍamaḍ ḍamaḍ ḍaman — a rattle on each word, the drum shaken high throughout.
          const hits = at(/ḍama/)
          m.damaru = 1
          if (hits.length) visualEvents.emit('gesture', { kind: 'damaru', duration: hits[hits.length - 1] - t + 0.8 })
          for (const h of hits) this.schedule(h, () => this.sparks('damaru', 0.55))
          break
        }
        case 'drum':
          // dhimid dhimid dhimi — a small stamp and a pulse through the ground on each.
          for (const h of at(/dhimi/))
            this.schedule(h, () => {
              visualEvents.emit('shockwave', { strength: 0.45 })
              if (stage.act >= 2 && stage.act <= 3) visualEvents.emit('stamp', { strength: 0.5 })
              stage.impulse += 0.15
            })
          break
        case 'tandav':
          if (dancing) this.schedule(t + sung * 0.55, () => this.accent(0.9, stage.time))
          break
        case 'destroyer': {
          // One shockwave per epithet ("…-cchidaṃ", "…-antakaṃ"); the last ("…Death itself") is the largest.
          const hits = at(/cchid|ntaka/)
          hits.forEach((h, i) => {
            const last = i === hits.length - 1
            this.schedule(h, () => {
              visualEvents.emit('shockwave', { strength: last ? 1 : 0.5, vertical: last })
              this.sparks(SPARK_SOURCES[i % SPARK_SOURCES.length], last ? 1 : 0.5)
              stage.impulse += last ? 0.6 : 0.12
              if (last) visualEvents.emit('stamp', { strength: 1 })
            })
          })
          break
        }
      }
    }
  }

  private fireCue(cue: Cue, t: number) {
    switch (cue.kind) {
      case 'lightning':
        this.strike(cue.strength, t, stage.act <= 1 && cue.strength >= 1 ? 'trident' : undefined)
        break
      case 'glint':
        stage.glint = Math.max(stage.glint, cue.strength)
        visualEvents.emit('glint', { strength: cue.strength })
        break
      case 'accent':
        if (!this.nearVerseStart(cue.t)) this.accent(cue.strength, t)
        break
      case 'climax':
        stage.climax = 1
        stage.impulse += 1.2
        this.lastShock = this.lastAccent = t
        visualEvents.emit('climax', {})
        visualEvents.emit('shockwave', { strength: 1.6, vertical: true })
        visualEvents.emit('distortion', { strength: 1 })
        this.strike(1, t, 'trident', true)
        for (const id of SPARK_SOURCES) this.sparks(id, 1)
        break
    }
  }

  /** True while dancing to timed lyrics and a sung verse begins within the merge window of `at`. */
  private nearVerseStart(at: number) {
    for (const line of getLyrics()) if (line.verseStart && Math.abs(line.t - at) < VERSE_MERGE) return true
    return false
  }

  private accent(strength: number, t: number) {
    // Inside the window of the last big hit, only the sparks remain.
    if (t - this.lastAccent < MAJOR_GAP) {
      this.sparks('rightFoot', strength * 0.5)
      return
    }
    this.lastAccent = this.lastShock = t
    stage.impulse += 0.45 * strength
    visualEvents.emit('stamp', { strength })
    // With a strike in the same moment, the bolt carries the hit; the ring stays on the ground.
    visualEvents.emit('shockwave', { strength, vertical: t - this.lastFlash > SHARED_MOMENT })
    this.sparks('rightFoot', strength)
    this.sparks('leftFoot', strength * 0.7)
  }

  private strike(strength: number, t: number, target?: 'trident' | 'sky' | 'mountain', force = false) {
    if (!force && t - this.lastFlash < FLASH_MIN_INTERVAL) return
    if (!force && t - this.lastAccent < SHARED_MOMENT) strength *= 0.65
    this.lastFlash = t
    visualEvents.emit('lightning', { strength, target })
    if (target === 'trident') {
      stage.glint = 1
      this.sparks('tridentTip', strength)
    }
  }

  private sparks(id: AnchorId, strength: number) {
    const a = anchors[id]
    visualEvents.emit('sparks', { strength, x: a.x, y: a.y, z: a.z })
  }

  private onBass(s: number, t: number, mode: EngineMode) {
    const act = stage.act
    if (act === 0 || act === 4 || s < 0.25) return
    const gap = t - this.lastShock
    if (act === 1) {
      if (s > 0.55 && gap > 1.2) {
        this.lastShock = t
        visualEvents.emit('shockwave', { strength: s * 0.45 })
      }
      return
    }
    // Acts III–IV. Without authored accents, promote the strongest hits.
    const authored = this.timeline.cues.some((c) => c.kind === 'accent')
    if (mode === 'track' && !authored && s > 0.85 && t - this.lastAccent > 3.5) {
      this.accent(Math.min(1, s), t)
      return
    }
    // Only clear hits ripple the ground, and never in quick succession.
    if (s > 0.55 && gap > (act === 3 ? 1.1 : 1.6)) {
      this.lastShock = t
      visualEvents.emit('shockwave', { strength: s * (act === 3 ? 0.55 : 0.4) })
    }
  }

  private onHigh(s: number, t: number, mode: EngineMode) {
    const act = stage.act
    if (act < 2 || act > 3) return
    if (t - this.lastSpark > 0.6) {
      this.lastSpark = t
      this.sparks(SPARK_SOURCES[this.sparkCursor++ % SPARK_SOURCES.length], clamp(s * 0.8))
    }
    // The score has authored thunder; user tracks get occasional reactive lightning.
    if (mode === 'track' && s > 0.85 && t - this.lastLiveBolt > (act === 3 ? 7 : 12)) {
      this.lastLiveBolt = t
      this.strike(s * 0.8, t)
    }
  }
}

export const director = new Director()
