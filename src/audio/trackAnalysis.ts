/**
 * Offline structure analysis of a user soundtrack.
 *
 * The whole file is decoded once (no gesture needed: OfflineAudioContext) and
 * reduced to two envelopes — loudness and onset novelty. From those we place
 * the five acts, the climax, the biggest accents and the tempo, so a recording
 * dropped into `public/audio/` gets real choreography without hand-written
 * cues. A cue file still overrides any of it.
 */

export interface TrackStructure {
  duration: number
  acts: { awakening: number; tandav: number; fury: number; stillness: number }
  climax: number
  endTitle: number
  accents: number[]
  lightning: number[]
  tempo: { bpm: number; offset: number } | null
}

const HOP = 1024

function percentile(sorted: Float32Array, p: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]
}

function smooth(src: Float32Array, radius: number) {
  const out = new Float32Array(src.length)
  let acc = 0
  for (let i = 0; i < src.length + radius; i++) {
    if (i < src.length) acc += src[i]
    if (i - 2 * radius - 1 >= 0) acc -= src[i - 2 * radius - 1]
    const c = i - radius
    if (c >= 0 && c < src.length) out[c] = acc / (Math.min(src.length, i + 1) - Math.max(0, i - 2 * radius))
  }
  return out
}

export async function analyseTrack(url: string): Promise<TrackStructure | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    const Offline =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
    if (!Offline) return null
    const ctx = new Offline(1, 2, 44100)
    const audio = await ctx.decodeAudioData(bytes)
    return analyseBuffer(audio)
  } catch (err) {
    console.warn('[tandav] Soundtrack analysis failed; using proportional acts.', err)
    return null
  }
}

export function analyseBuffer(audio: AudioBuffer): TrackStructure {
  const sr = audio.sampleRate
  const n = audio.length
  const chans = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
  const frames = Math.floor(n / HOP)
  const fps = sr / HOP
  const rms = new Float32Array(frames)
  const low = new Float32Array(frames)
  // One-pole low-pass (~180 Hz) isolates drums and the chant's chest resonance.
  const a = Math.exp((-2 * Math.PI * 180) / sr)
  let lp = 0
  for (let f = 0; f < frames; f++) {
    let s = 0
    let sl = 0
    for (let i = f * HOP; i < (f + 1) * HOP; i++) {
      let v = 0
      for (const ch of chans) v += ch[i]
      v /= chans.length
      lp = v + (lp - v) * a
      s += v * v
      sl += lp * lp
    }
    rms[f] = Math.sqrt(s / HOP)
    low[f] = Math.sqrt(sl / HOP)
  }

  // Loudness in dB, then normalised by robust percentiles.
  const db = rms.map((v) => 20 * Math.log10(v + 1e-6))
  const sortedDb = db.slice().sort()
  const lo = percentile(sortedDb, 0.05)
  const hi = percentile(sortedDb, 0.98)
  const loud = smooth(
    db.map((v) => Math.min(1, Math.max(0, (v - lo) / Math.max(6, hi - lo)))),
    Math.round(fps * 1.5),
  )

  // Onset novelty: rectified rise of low-band log energy.
  const novelty = new Float32Array(frames)
  for (let f = 1; f < frames; f++) {
    const d = Math.log(low[f] + 1e-5) - Math.log(low[f - 1] + 1e-5)
    novelty[f] = d > 0 ? d : 0
  }

  const duration = audio.duration
  const t = (f: number) => f / fps
  const firstAbove = (from: number, level: number, holdSec: number) => {
    const hold = Math.round(holdSec * fps)
    for (let f = Math.max(0, Math.round(from * fps)); f < frames - hold; f++) {
      let ok = true
      for (let k = 0; k < hold; k += 4) if (loud[f + k] < level) ok = false
      if (ok) return t(f)
    }
    return -1
  }

  let awakening = firstAbove(0, 0.22, 1.5)
  if (awakening < 0 || awakening > duration * 0.3) awakening = duration * 0.07
  awakening = Math.max(2.5, awakening)
  let tandav = firstAbove(awakening + 4, 0.55, 4)
  if (tandav < 0 || tandav > duration * 0.5) tandav = Math.max(awakening + 8, duration * 0.2)

  // Stillness: after the last sustained loud passage.
  let lastLoud = -1
  for (let f = frames - 1; f >= 0; f--) {
    if (loud[f] > 0.55) {
      lastLoud = t(f)
      break
    }
  }
  let stillness = lastLoud > 0 ? lastLoud + 1 : duration * 0.89
  stillness = Math.min(duration - 6, Math.max(stillness, tandav + 30, duration * 0.6))

  // Climax: the loudest moment in the final stretch before stillness.
  const furySpan = Math.max(20, 0.28 * (stillness - tandav))
  let fury = Math.max(tandav + 15, stillness - furySpan)
  let climaxF = Math.round(fury * fps)
  for (let f = Math.round(fury * fps); f < Math.min(frames, Math.round((stillness + 2) * fps)); f++) {
    if (loud[f] + novelty[f] * 0.2 > loud[climaxF] + novelty[climaxF] * 0.2) climaxF = f
  }
  let climax = t(climaxF)
  if (climax < fury + 6) climax = Math.min(stillness - 0.5, fury + 6)
  if (stillness < climax + 0.8) stillness = Math.min(duration - 4, climax + 1)
  fury = Math.min(fury, climax - 6)

  // Accents: the strongest onsets, spaced out, within the dance.
  const sortedNov = novelty.slice().sort()
  const strong = percentile(sortedNov, 0.995)
  const accents: number[] = []
  const candidates: { f: number; v: number }[] = []
  for (let f = Math.round(tandav * fps); f < Math.round((climax - 1) * fps); f++) {
    if (novelty[f] >= strong && novelty[f] >= novelty[f - 1] && novelty[f] >= novelty[f + 1]) candidates.push({ f, v: novelty[f] })
  }
  candidates.sort((x, y) => y.v - x.v)
  for (const c of candidates) {
    const time = t(c.f)
    if (accents.every((x) => Math.abs(x - time) > 6)) accents.push(time)
    if (accents.length >= 28) break
  }
  accents.sort((x, y) => x - y)

  const lightning = [awakening, tandav, fury, ...accents.filter((x) => x > fury).slice(0, 3)]

  return {
    duration,
    acts: { awakening, tandav, fury, stillness },
    climax,
    endTitle: Math.min(duration - 3, Math.max(stillness + 6, duration - 14)),
    accents,
    lightning,
    tempo: estimateTempo(novelty, fps, tandav, climax),
  }
}

/** Autocorrelation tempo estimate over the dance section, with a mild prior near 100 BPM. */
function estimateTempo(novelty: Float32Array, fps: number, from: number, to: number) {
  const a = Math.round(from * fps)
  const b = Math.min(novelty.length, Math.round(to * fps))
  if (b - a < fps * 20) return null
  const seg = novelty.subarray(a, b)
  let mean = 0
  for (const v of seg) mean += v
  mean /= seg.length
  const minLag = Math.round((fps * 60) / 180)
  const maxLag = Math.round((fps * 60) / 60)
  let best = 0
  let bestLag = 0
  let total = 0
  let count = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    for (let i = 0; i + lag < seg.length; i++) s += (seg[i] - mean) * (seg[i + lag] - mean)
    s /= seg.length - lag
    const bpm = (60 * fps) / lag
    const prior = Math.exp(-Math.pow(Math.log2(bpm / 100), 2) * 1.5)
    const score = s * prior
    total += Math.max(0, score)
    count++
    if (score > best) {
      best = score
      bestLag = lag
    }
  }
  // Reject when no lag clearly dominates (free-tempo chanting).
  if (!bestLag || best < (total / count) * 2.2) return null
  let bestPhase = 0
  let bestSum = -1
  for (let p = 0; p < bestLag; p++) {
    let s = 0
    for (let i = p; i < seg.length; i += bestLag) s += seg[i]
    if (s > bestSum) {
      bestSum = s
      bestPhase = p
    }
  }
  return { bpm: (60 * fps) / bestLag, offset: (a + bestPhase) / fps }
}
