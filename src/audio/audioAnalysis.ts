/**
 * Audio feature extraction. Knows nothing about visuals: it only publishes
 * normalised band energies and onset counters into `features`, which the
 * director reads every frame.
 */

import { COMPOSITION, sampleAuto, type Note } from '../choreography/composition'
import { clamp } from '../utils/math'

export interface AudioFeatures {
  bass: number
  mid: number
  high: number
  loudness: number
  /** Decaying 0..1 impulse from the most recent bass onset. */
  transient: number
  /** Monotonic counters; a change means a new onset happened this frame. */
  bassOnsets: number
  highOnsets: number
  lastBassStrength: number
  lastHighStrength: number
  /** True when values come from real analysis rather than the fallback. */
  live: boolean
  /** Raw per-frame measurements, useful for tuning thresholds. */
  raw: { bass: number; mid: number; high: number; bassFlux: number; highFlux: number }
}

export const features: AudioFeatures = {
  bass: 0,
  mid: 0,
  high: 0,
  loudness: 0,
  transient: 0,
  bassOnsets: 0,
  highOnsets: 0,
  lastBassStrength: 0,
  lastHighStrength: 0,
  live: false,
  raw: { bass: 0, mid: 0, high: 0, bassFlux: 0, highFlux: 0 },
}

export function resetFeatures() {
  features.bass = features.mid = features.high = features.loudness = features.transient = 0
  features.lastBassStrength = features.lastHighStrength = 0
}

/** Asymmetric smoothing: fast attack, slow release — avoids flicker on noisy input. */
function follow(current: number, target: number, dt: number, attack = 28, release = 5) {
  const k = target > current ? attack : release
  return current + (target - current) * (1 - Math.exp(-k * dt))
}

/**
 * Adaptive range for one band. Byte spectra are already log-scaled, so a
 * slowly tracked floor and peak (with a minimum span) turn them into a
 * stable 0..1 without amplifying quiet passages into noise.
 */
class BandRange {
  private floor = -1
  private peak = 0
  constructor(private minSpan: number) {}
  norm(raw: number, dt: number) {
    if (this.floor < 0) {
      this.floor = raw
      this.peak = raw + this.minSpan
    }
    // Floor: falls quickly to new minima, rises slowly (~20 s).
    this.floor = raw < this.floor ? raw : this.floor + (raw - this.floor) * (1 - Math.exp(-dt / 20))
    // Peak: jumps to new maxima, decays slowly (~12 s).
    this.peak = raw > this.peak ? raw : this.peak + (raw - this.peak) * (1 - Math.exp(-dt / 12))
    const span = Math.max(this.minSpan, this.peak - this.floor)
    return clamp((raw - this.floor) / span)
  }
}

/**
 * Spectral-flux onset detector: adaptive threshold (mean + k·σ over ~0.8 s),
 * an absolute floor so soft swells never count, and a cooldown. Strength is
 * relative to a decaying flux peak, so the loudest hits read as 1.
 */
class OnsetDetector {
  private history: Float32Array
  private i = 0
  private filled = 0
  private cooldown = 0
  private fluxPeak: number
  constructor(
    size: number,
    private sensitivity: number,
    private minGap: number,
    private floor: number,
  ) {
    this.history = new Float32Array(size)
    this.fluxPeak = floor * 2
  }

  /** Returns onset strength (0..1) or 0 when no onset. */
  push(flux: number, dt: number): number {
    this.cooldown -= dt
    this.fluxPeak = Math.max(flux, this.fluxPeak * Math.exp(-dt / 6), this.floor * 2)
    let mean = 0
    const n = Math.max(1, this.filled)
    for (let k = 0; k < this.filled; k++) mean += this.history[k]
    mean /= n
    let variance = 0
    for (let k = 0; k < this.filled; k++) variance += (this.history[k] - mean) ** 2
    const std = Math.sqrt(variance / n)
    this.history[this.i] = flux
    this.i = (this.i + 1) % this.history.length
    this.filled = Math.min(this.filled + 1, this.history.length)

    const threshold = Math.max(this.floor, mean + this.sensitivity * std)
    if (this.filled > 8 && this.cooldown <= 0 && flux > threshold) {
      this.cooldown = this.minGap
      return clamp(flux / this.fluxPeak)
    }
    return 0
  }
}

export class SpectrumAnalyzer {
  private freq: Uint8Array<ArrayBuffer>
  private prev: Uint8Array<ArrayBuffer>
  private bins: { bass: [number, number]; mid: [number, number]; high: [number, number] }
  private ranges = { bass: new BandRange(0.25), mid: new BandRange(0.2), high: new BandRange(0.15), loud: new BandRange(0.2) }
  private bassOnset = new OnsetDetector(48, 1.5, 0.18, 9)
  private highOnset = new OnsetDetector(48, 1.8, 0.14, 10)

  constructor(private analyser: AnalyserNode) {
    this.freq = new Uint8Array(analyser.frequencyBinCount)
    this.prev = new Uint8Array(analyser.frequencyBinCount)
    const hz = analyser.context.sampleRate / analyser.fftSize
    const bin = (f: number) => Math.max(1, Math.min(analyser.frequencyBinCount - 1, Math.round(f / hz)))
    this.bins = {
      bass: [bin(28), bin(160)],
      mid: [bin(250), bin(2200)],
      high: [bin(3500), bin(12000)],
    }
  }

  update(dt: number) {
    this.analyser.getByteFrequencyData(this.freq)
    const f = this.freq
    const band = ([a, b]: [number, number]) => {
      let s = 0
      for (let k = a; k <= b; k++) s += f[k]
      return s / ((b - a + 1) * 255)
    }
    const flux = ([a, b]: [number, number]) => {
      let s = 0
      for (let k = a; k <= b; k++) {
        const d = f[k] - this.prev[k]
        if (d > 0) s += d
      }
      return s / (b - a + 1)
    }
    const rawBass = band(this.bins.bass)
    const rawMid = band(this.bins.mid)
    const rawHigh = band(this.bins.high)
    const rawLoud = rawBass * 0.45 + rawMid * 0.4 + rawHigh * 0.15
    const bassFlux = flux(this.bins.bass)
    const highFlux = flux(this.bins.high)
    this.prev.set(f)
    const r = features.raw
    r.bass = rawBass
    r.mid = rawMid
    r.high = rawHigh
    r.bassFlux = bassFlux
    r.highFlux = highFlux

    const R = this.ranges
    features.bass = follow(features.bass, R.bass.norm(rawBass, dt), dt)
    features.mid = follow(features.mid, R.mid.norm(rawMid, dt), dt, 20, 4)
    features.high = follow(features.high, R.high.norm(rawHigh, dt), dt, 30, 7)
    features.loudness = follow(features.loudness, R.loud.norm(rawLoud, dt), dt, 10, 2.5)

    const bo = this.bassOnset.push(bassFlux, dt)
    if (bo > 0) {
      features.bassOnsets++
      features.lastBassStrength = bo
      features.transient = Math.max(features.transient, bo)
    }
    const ho = this.highOnset.push(highFlux, dt)
    if (ho > 0) {
      features.highOnsets++
      features.lastHighStrength = ho
    }
    features.transient *= Math.exp(-dt * 6)
    features.live = true
  }
}

/**
 * Fallback when audio is unavailable or silent: synthesise the same features
 * from the score's note list, so the choreography still breathes with the
 * (unheard) rhythm.
 */
export class SyntheticFeatures {
  private idx = 0
  private env = { bass: 0, mid: 0, high: 0 }

  reset() {
    this.idx = 0
    this.env.bass = this.env.mid = this.env.high = 0
  }

  update(t: number, dt: number) {
    const notes: Note[] = COMPOSITION.notes
    if (this.idx > 0 && notes[this.idx - 1].t > t + 0.5) this.reset()
    while (this.idx < notes.length && notes[this.idx].t <= t) {
      const n = notes[this.idx++]
      if (t - n.t > 0.25) continue
      if (n.kind === 'taiko' || n.kind === 'boom' || n.kind === 'climax') {
        this.env.bass = Math.max(this.env.bass, n.vel)
        features.bassOnsets++
        features.lastBassStrength = n.vel
        features.transient = Math.max(features.transient, n.vel)
      } else if (n.kind === 'damaru' || n.kind === 'roll') {
        this.env.mid = Math.max(this.env.mid, n.vel)
      } else if (n.kind === 'thunder' || n.kind === 'shimmer') {
        this.env.high = Math.max(this.env.high, n.vel)
        features.highOnsets++
        features.lastHighStrength = n.vel
      }
    }
    const drone = sampleAuto(COMPOSITION.drone, t)
    const k = Math.exp(-dt * 7)
    this.env.bass *= k
    this.env.mid *= Math.exp(-dt * 10)
    this.env.high *= Math.exp(-dt * 4)
    features.bass = follow(features.bass, this.env.bass, dt)
    features.mid = follow(features.mid, Math.max(this.env.mid, drone.bright * 0.4), dt, 20, 4)
    features.high = follow(features.high, this.env.high, dt, 30, 7)
    features.loudness = follow(features.loudness, clamp(drone.level * 1.2 + this.env.bass * 0.4), dt, 10, 2.5)
    features.transient *= Math.exp(-dt * 6)
    features.live = false
  }
}
