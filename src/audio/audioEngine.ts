/**
 * Playback + clock. Owns the AudioContext, the optional user soundtrack, the
 * procedural score, and the analyser tap.
 *
 * Signal graph:
 *   source (track | score) ─► bus ─┬─► analyser          (visuals; pre-volume)
 *                                  └─► master ─► speakers (volume / mute)
 * Tapping before the master gain means muting never flattens the visuals.
 */

import { ProceduralScore } from './proceduralScore'
import { SpectrumAnalyzer } from './audioAnalysis'
import type { CueFile } from '../choreography/timeline'

export type EngineMode = 'track' | 'score' | 'silent'

const BASE = import.meta.env.BASE_URL
const TRACK_CANDIDATES = ['tandav.mp3', 'tandav.m4a', 'tandav.ogg', 'tandav.wav']
const CUES_PATH = 'tandav.cues.json'

export interface TrackInfo {
  url: string
  cues: CueFile | null
}

/** Look for a developer-supplied soundtrack. Must run before the user gesture. */
export async function probeTrack(): Promise<TrackInfo | null> {
  for (const name of TRACK_CANDIDATES) {
    const url = `${BASE}audio/${name}`
    try {
      // A 2-byte ranged GET works on hosts that mishandle HEAD.
      const res = await fetch(url, { headers: { Range: 'bytes=0-1' } })
      void res.body?.cancel()
      // Dev servers and SPA hosts answer unknown paths with index.html, so check the type too.
      if (res.ok && (res.headers.get('content-type') ?? '').startsWith('audio')) {
        let cues: CueFile | null = null
        try {
          const c = await fetch(`${BASE}audio/${CUES_PATH}`)
          if (c.ok && (c.headers.get('content-type') ?? '').includes('json')) cues = (await c.json()) as CueFile
        } catch {
          cues = null
        }
        return { url, cues }
      }
    } catch {
      /* try the next candidate */
    }
  }
  return null
}

type AudioContextCtor = typeof AudioContext

export class AudioEngine {
  mode: EngineMode = 'silent'
  analyzer: SpectrumAnalyzer | null = null
  onEnded: (() => void) | null = null
  onDuration: ((seconds: number) => void) | null = null
  onModeChange: ((mode: EngineMode) => void) | null = null

  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private master: GainNode | null = null
  private score: ProceduralScore | null = null
  private element: HTMLAudioElement | null = null
  private volume = 0.85
  private muted = false
  private paused = false
  private ended = false
  // Silent-mode clock.
  private silentStart = 0
  private silentPausedAt = 0

  /**
   * Must be called synchronously inside the user's click/tap handler so the
   * AudioContext and media element are unlocked by the gesture.
   */
  start(track: TrackInfo | null): EngineMode {
    this.ended = false
    this.paused = false
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
    if (!Ctor) return this.startSilent()

    try {
      if (!this.ctx) {
        this.ctx = new Ctor({ latencyHint: 'playback' })
        this.bus = this.ctx.createGain()
        this.master = this.ctx.createGain()
        const analyser = this.ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.35
        analyser.minDecibels = -90
        analyser.maxDecibels = -12
        this.bus.connect(analyser)
        this.bus.connect(this.master).connect(this.ctx.destination)
        this.analyzer = new SpectrumAnalyzer(analyser)
        this.applyVolume()
      }
      void this.ctx.resume()
    } catch (err) {
      console.warn('[tandav] Web Audio unavailable, continuing without sound.', err)
      return this.startSilent()
    }

    if (track) {
      this.startTrack(track.url)
      return 'track'
    }
    this.startScore()
    return 'score'
  }

  private startTrack(url: string) {
    const ctx = this.ctx!
    if (!this.element) {
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.preload = 'auto'
      el.src = url
      el.addEventListener('ended', () => this.finish())
      el.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(el.duration)) this.onDuration?.(el.duration)
      })
      ctx.createMediaElementSource(el).connect(this.bus!)
      this.element = el
    }
    this.mode = 'track'
    this.element.currentTime = 0
    this.element.play().catch((err) => {
      console.warn('[tandav] Soundtrack failed to play; switching to the procedural score.', err)
      this.element?.pause()
      this.startScore()
      this.onModeChange?.('score')
    })
  }

  private startScore() {
    this.score?.stop()
    this.score = new ProceduralScore(this.ctx!)
    this.score.output.connect(this.bus!)
    this.score.start()
    this.mode = 'score'
  }

  private startSilent(): EngineMode {
    this.mode = 'silent'
    this.analyzer = null
    this.silentStart = performance.now() / 1000
    return 'silent'
  }

  private finish() {
    if (this.ended) return
    this.ended = true
    this.onEnded?.()
  }

  /** Experience clock in seconds. */
  time(): number {
    switch (this.mode) {
      case 'track':
        return this.element?.currentTime ?? 0
      case 'score':
        return this.score?.time() ?? 0
      default:
        return (this.paused ? this.silentPausedAt : performance.now() / 1000) - this.silentStart
    }
  }

  duration(): number {
    if (this.mode === 'track') {
      const d = this.element?.duration
      return d && Number.isFinite(d) ? d : 0
    }
    return this.score?.duration ?? 172
  }

  /** Called every frame; detects the end of the score / silent clock. */
  poll() {
    if (this.ended || this.paused) return
    if (this.mode !== 'track' && this.time() >= this.duration()) this.finish()
  }

  get isPaused() {
    return this.paused
  }

  pause() {
    if (this.paused) return
    this.paused = true
    if (this.mode === 'track') this.element?.pause()
    else if (this.mode === 'score') void this.ctx?.suspend()
    else this.silentPausedAt = performance.now() / 1000
  }

  resume() {
    if (!this.paused) return
    this.paused = false
    if (this.mode === 'track') void this.element?.play()
    else if (this.mode === 'score') void this.ctx?.resume()
    else this.silentStart += performance.now() / 1000 - this.silentPausedAt
  }

  restart(track: TrackInfo | null) {
    this.score?.stop()
    this.score = null
    if (this.element) this.element.pause()
    this.start(track)
  }

  stop() {
    this.score?.stop()
    this.score = null
    this.element?.pause()
    this.paused = false
  }

  /** Seek (soundtrack only — the procedural score is scheduled ahead and always plays from the top). */
  seek(seconds: number) {
    if (this.mode !== 'track' || !this.element) return false
    const d = this.duration()
    this.element.currentTime = Math.max(0, d ? Math.min(d - 0.1, seconds) : seconds)
    if (this.ended) {
      this.ended = false
    }
    return true
  }

  setVolume(v: number) {
    this.volume = v
    this.applyVolume()
  }

  setMuted(m: boolean) {
    this.muted = m
    this.applyVolume()
  }

  private applyVolume() {
    if (!this.master || !this.ctx) return
    const target = this.muted ? 0 : this.volume * this.volume // perceptual curve
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05)
  }
}

export const audioEngine = new AudioEngine()
