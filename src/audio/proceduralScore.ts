/**
 * Real-time synthesiser for the built-in score (see choreography/composition.ts).
 * Everything is generated with oscillators, noise and filters — no samples —
 * so the repository ships without any third-party audio.
 */

import { COMPOSITION, sampleAuto, type AutoPoint, type Note } from '../choreography/composition'

const SA = 73.42 // D2 — the tonic (Sa)
const PA = SA * 1.5

function makeNoise(ctx: BaseAudioContext, seconds: number, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

/** A long, dark hall: exponentially decaying stereo noise with a soft low-pass tilt. */
function makeImpulse(ctx: BaseAudioContext, seconds = 4.2) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / len
      lp += (Math.random() * 2 - 1 - lp) * 0.35
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < 200 ? i / 200 : 1)
    }
  }
  return buf
}

export class ProceduralScore {
  readonly output: GainNode
  private dry: GainNode
  private send: GainNode
  private noise: AudioBuffer
  private brown: AudioBuffer
  private startAt = 0
  private nextNote = 0
  private nextPluck = 0
  private timer: number | null = null
  private stopped = false
  private persistent: AudioScheduledSourceNode[] = []

  constructor(private ctx: AudioContext) {
    this.output = ctx.createGain()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 10
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.25
    comp.connect(this.output)

    this.dry = ctx.createGain()
    this.dry.connect(comp)
    const reverb = ctx.createConvolver()
    reverb.buffer = makeImpulse(ctx)
    const wet = ctx.createGain()
    wet.gain.value = 0.42
    reverb.connect(wet).connect(comp)
    this.send = ctx.createGain()
    this.send.connect(reverb)

    this.noise = makeNoise(ctx, 2.5)
    this.brown = makeNoise(ctx, 6, true)
  }

  get duration() {
    return COMPOSITION.duration
  }

  /** Seconds since the score started; frozen while the AudioContext is suspended. */
  time() {
    return Math.max(0, this.ctx.currentTime - this.startAt)
  }

  start() {
    this.startAt = this.ctx.currentTime + 0.08
    this.nextNote = 0
    this.nextPluck = 0
    this.buildContinuousLayers()
    this.tick()
    this.timer = window.setInterval(() => this.tick(), 60)
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    if (this.timer !== null) clearInterval(this.timer)
    const now = this.ctx.currentTime
    this.output.gain.cancelScheduledValues(now)
    this.output.gain.setValueAtTime(this.output.gain.value, now)
    this.output.gain.linearRampToValueAtTime(0, now + 0.12)
    window.setTimeout(() => {
      this.persistent.forEach((s) => {
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
      })
      this.output.disconnect()
    }, 200)
  }

  // ── Scheduling ────────────────────────────────────────────────────

  private tick() {
    if (this.stopped) return
    // Background tabs throttle timers to ~1 Hz, so look further ahead when hidden.
    const horizon = this.time() + (document.hidden ? 1.6 : 0.4)
    const notes = COMPOSITION.notes
    while (this.nextNote < notes.length && notes[this.nextNote].t < horizon) {
      this.play(notes[this.nextNote++])
    }
    // Tanpura: four strings plucked in an endless Pa–Sa–Sa–Sa cycle.
    while (this.nextPluck < horizon && this.nextPluck < COMPOSITION.duration) {
      const step = Math.round(this.nextPluck / 0.95) % 4
      const freq = step === 0 ? PA : step === 3 ? SA : SA * 2
      this.pluck(this.nextPluck, freq)
      this.nextPluck += 0.95
    }
  }

  private at(t: number) {
    return this.startAt + t
  }

  private play(n: Note) {
    const t = this.at(n.t)
    if (t < this.ctx.currentTime - 0.05) return
    switch (n.kind) {
      case 'boom':
        return this.boom(t, n.vel)
      case 'taiko':
        return this.taiko(t, n.vel)
      case 'damaru':
        return this.damaru(t, n.vel)
      case 'roll':
        return this.roll(t, n.vel, n.dur ?? 1)
      case 'thunder':
        return this.thunder(t, n.vel)
      case 'bell':
        return this.bell(t, n.vel)
      case 'shimmer':
        return this.shimmer(t, n.vel, n.dur ?? 2.5)
      case 'riser':
        return this.riser(t, n.vel, n.dur ?? 4)
      case 'om':
        return this.om(t, n.vel, n.dur ?? 10)
      case 'climax':
        return this.climax(t)
    }
  }

  // ── Continuous layers ─────────────────────────────────────────────

  private automate(param: AudioParam, points: AutoPoint[], map: (p: AutoPoint) => number) {
    param.setValueAtTime(map(points[0]), this.at(0))
    for (const p of points) param.linearRampToValueAtTime(map(p), this.at(p.t))
  }

  private buildContinuousLayers() {
    const ctx = this.ctx
    // Sub drone: the weight beneath everything.
    const subGain = ctx.createGain()
    subGain.connect(this.dry)
    this.automate(subGain.gain, COMPOSITION.drone, (p) => p.level * 0.32)
    for (const [f, g] of [
      [SA / 2, 0.8],
      [SA, 0.35],
    ] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = g
      o.connect(og).connect(subGain)
      o.start(this.at(0))
      o.stop(this.at(COMPOSITION.duration))
      this.persistent.push(o)
    }

    // Cosmic wind: band-passed noise with slow gusts.
    const wind = ctx.createBufferSource()
    wind.buffer = this.noise
    wind.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    this.automate(bp.frequency, COMPOSITION.wind, (p) => 260 + p.bright * 1300)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 180
    lfo.connect(lfoGain).connect(bp.frequency)
    const wg = ctx.createGain()
    this.automate(wg.gain, COMPOSITION.wind, (p) => p.level * 0.22)
    wind.connect(bp).connect(wg)
    wg.connect(this.dry)
    wg.connect(this.send)
    wind.start(this.at(0))
    lfo.start(this.at(0))
    wind.stop(this.at(COMPOSITION.duration))
    lfo.stop(this.at(COMPOSITION.duration))
    this.persistent.push(wind, lfo)
  }

  private pluck(rel: number, freq: number) {
    const t = this.at(rel)
    const { level, bright } = sampleAuto(COMPOSITION.drone, rel)
    if (level < 0.01) return
    const ctx = this.ctx
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 3
    // The jawari bridge gives the tanpura its buzzing bloom: cutoff swells after the pluck.
    const base = 400 + bright * 1400
    lp.frequency.setValueAtTime(base * 0.6, t)
    lp.frequency.linearRampToValueAtTime(base * 1.6, t + 0.6)
    lp.frequency.exponentialRampToValueAtTime(base * 0.5, t + 3.8)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06 * level + 0.0002, t + 0.09) // soft attack: a drone, not a beat
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4)
    lp.connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    for (const detune of [-5, 6]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = freq
      o.detune.value = detune
      o.connect(lp)
      o.start(t)
      o.stop(t + 4.1)
    }
  }

  // ── Instruments ───────────────────────────────────────────────────

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, dest: AudioNode, buffer = this.noise) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(dest)
    src.start(t, Math.random() * (buffer.duration - dur - 0.1))
    src.stop(t + dur + 0.05)
    return g
  }

  private boom(t: number, vel: number) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(36, t + 0.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.85 * vel, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 + vel * 0.8)
    o.connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    o.start(t)
    o.stop(t + 2.4)
    this.noiseBurst(t, 0.05, 'lowpass', 1800, 0.7, 0.25 * vel, this.dry)
  }

  private taiko(t: number, vel: number) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(165, t)
    o.frequency.exponentialRampToValueAtTime(62, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    o.start(t)
    o.stop(t + 0.55)
    this.noiseBurst(t, 0.07, 'bandpass', 900, 1.2, 0.3 * vel, this.dry)
  }

  private damaru(t: number, vel: number) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = 'triangle'
    const f0 = 330 + Math.random() * 40
    o.frequency.setValueAtTime(f0 * 1.25, t)
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.04)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    o.connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    o.start(t)
    o.stop(t + 0.16)
    this.noiseBurst(t, 0.045, 'bandpass', 2400, 2, 0.22 * vel, this.dry)
  }

  private roll(t: number, vel: number, dur: number) {
    let x = 0
    let i = 0
    while (x < dur) {
      const k = x / dur
      this.damaru(t + x, vel * (0.35 + 0.65 * k) * (i % 2 ? 0.8 : 1))
      x += 0.075 - 0.03 * k // accelerating roll
      i++
    }
  }

  private thunder(t: number, vel: number) {
    this.noiseBurst(t, 0.35, 'highpass', 1400, 0.5, 0.35 * vel, this.dry)
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.brown
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(140, t + 3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.03)
    // Irregular rolling decay.
    let x = 0.15
    let level = 0.9 * vel
    while (x < 4.5) {
      level *= 0.62 + Math.random() * 0.3
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * (0.6 + Math.random() * 0.6)), t + x)
      x += 0.25 + Math.random() * 0.5
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5)
    src.connect(lp).connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    src.start(t)
    src.stop(t + 5.1)
  }

  private bell(t: number, vel: number) {
    const ctx = this.ctx
    const f = 587.33 // D5
    const partials: [number, number, number][] = [
      [0.5, 0.5, 7],
      [1, 1, 6],
      [2.32, 0.5, 3.5],
      [4.25, 0.3, 2],
      [6.63, 0.18, 1.2],
    ]
    for (const [ratio, amp, decay] of partials) {
      for (const det of [0, 1.8]) {
        const o = ctx.createOscillator()
        o.frequency.value = f * ratio + det
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.05 * vel * amp, t + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
        o.connect(g)
        g.connect(this.dry)
        g.connect(this.send)
        o.start(t)
        o.stop(t + decay + 0.1)
      }
    }
  }

  private shimmer(t: number, vel: number, dur: number) {
    const g = this.noiseBurst(t, dur, 'highpass', 6500, 0.6, 0.09 * vel, this.send)
    g.connect(this.dry)
    const ctx = this.ctx
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const mg = ctx.createGain()
    mg.gain.setValueAtTime(0.0001, t)
    mg.gain.exponentialRampToValueAtTime(0.03 * vel, t + 0.01)
    mg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7)
    hp.connect(mg)
    mg.connect(this.send)
    for (const r of [1, 1.483, 1.932, 2.546, 2.63, 3.897]) {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = 410 * r
      o.connect(hp)
      o.start(t)
      o.stop(t + dur)
    }
  }

  private riser(t: number, vel: number, dur: number) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.5
    bp.frequency.setValueAtTime(220, t)
    bp.frequency.exponentialRampToValueAtTime(5200, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + dur * 0.97)
    g.gain.linearRampToValueAtTime(0, t + dur + 0.02)
    src.connect(bp).connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    src.start(t)
    src.stop(t + dur + 0.05)

    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(SA * 2, t)
    o.frequency.exponentialRampToValueAtTime(SA * 8, t + dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, t)
    lp.frequency.exponentialRampToValueAtTime(3000, t + dur)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.05 * vel, t + dur * 0.97)
    og.gain.linearRampToValueAtTime(0, t + dur + 0.02)
    o.connect(lp).connect(og)
    og.connect(this.send)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  /** A low vocal-formant swell morphing "aa" → "oo" → "mm". */
  private om(t: number, vel: number, dur: number) {
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, t)
    out.gain.exponentialRampToValueAtTime(0.22 * vel, t + dur * 0.3)
    out.gain.setValueAtTime(0.22 * vel, t + dur * 0.6)
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    out.connect(this.dry)
    out.connect(this.send)
    const formants: [number, number, number][] = [
      [730, 450, 260],
      [1090, 800, 300],
    ]
    const mix = ctx.createGain()
    for (const [a, o, m] of formants) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 6
      bp.frequency.setValueAtTime(a, t)
      bp.frequency.linearRampToValueAtTime(o, t + dur * 0.35)
      bp.frequency.linearRampToValueAtTime(m, t + dur * 0.8)
      mix.connect(bp).connect(out)
    }
    for (const [f, det] of [
      [SA, -4],
      [SA, 5],
      [SA * 2, 0],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      o.connect(mix)
      o.start(t)
      o.stop(t + dur + 0.1)
    }
  }

  private climax(t: number) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(70, t)
    o.frequency.exponentialRampToValueAtTime(24, t + 3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4)
    o.connect(g)
    g.connect(this.dry)
    g.connect(this.send)
    o.start(t)
    o.stop(t + 4.1)
    this.bell(t + 0.02, 0.7)
  }
}
