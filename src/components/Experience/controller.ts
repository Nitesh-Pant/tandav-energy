/**
 * User-facing actions. Glue between the UI, the audio engine and the director;
 * nothing here runs per frame.
 */

import { audioEngine, probeTrack, type TrackInfo } from '../../audio/audioEngine'
import { analyseTrack, type TrackStructure } from '../../audio/trackAnalysis'
import { loadDraft, loadLyricsFile, setLyrics } from '../../shloka/lyrics'
import { director } from '../../choreography/director'
import { stage } from '../../choreography/stage'
import { buildScoreTimeline, buildTrackTimeline } from '../../choreography/timeline'
import { rememberVerseMode, uiStore } from '../../state/store'

let track: TrackInfo | null = null
let structure: TrackStructure | null = null
let probed: Promise<void> | null = null

const LYRICS_URL = `${import.meta.env.BASE_URL}audio/tandav.lyrics.json`

/**
 * Discover an optional soundtrack before the visitor clicks (gesture-safe
 * playback needs it ready). Its lyric timings and structure analysis load in
 * the background; the experience can start before they finish.
 */
export function prepareAudio() {
  probed ??= probeTrack().then((t) => {
    track = t
    if (!t) return
    void loadLyricsFile(LYRICS_URL).then((lines) => {
      // In sync mode an unsaved draft from a previous session takes precedence.
      const draft = uiStore.get().syncMode ? loadDraft() : null
      setLyrics(draft ?? lines)
      uiStore.set({ lyrics: !!(draft ?? lines)?.length })
    })
    uiStore.set({ analysis: 'pending' })
    void analyseTrack(t.url).then((s) => {
      structure = s
      uiStore.set({ analysis: s ? 'done' : 'failed' })
      if (s) {
        console.info(
          `[tandav] Soundtrack structure: acts at ${Object.values(s.acts).map((x) => x.toFixed(1)).join(' / ')} s, climax ${s.climax.toFixed(1)} s, ` +
            (s.tempo ? `${s.tempo.bpm.toFixed(1)} BPM` : 'free tempo') +
            `, ${s.accents.length} accents`,
        )
        if (stage.running && audioEngine.mode === 'track') director.replaceTimeline(trackTimeline(), audioEngine.time())
      }
    })
  })
  return probed
}

const trackTimeline = () => buildTrackTimeline(audioEngine.duration() || structure?.duration || 240, track?.cues, structure)

export function seek(seconds: number) {
  if (audioEngine.seek(seconds) && uiStore.get().phase === 'ended') uiStore.set({ phase: 'experience', playing: !audioEngine.isPaused })
}

export const hasTrack = () => track !== null

function applyTimeline() {
  if (audioEngine.mode === 'track') {
    director.setTimeline(trackTimeline())
  } else {
    director.setTimeline(buildScoreTimeline())
  }
}

audioEngine.onEnded = () => {
  uiStore.set({ phase: 'ended', playing: false })
}

// Rebuild act proportions once a soundtrack's real duration is known.
audioEngine.onDuration = (d) => {
  if (audioEngine.mode === 'track' && d) director.replaceTimeline(trackTimeline(), audioEngine.time())
}

audioEngine.onModeChange = (mode) => {
  uiStore.set({ audioSource: mode })
  applyTimeline()
}

/** Must be called directly from the click/tap handler. */
export function enter() {
  const ui = uiStore.get()
  if (ui.phase !== 'intro') return
  audioEngine.setVolume(ui.volume)
  audioEngine.setMuted(ui.muted)
  const mode = audioEngine.start(track)
  applyTimeline()
  stage.running = true
  uiStore.set({ phase: 'entering', playing: true, audioSource: mode })
  window.setTimeout(() => {
    if (uiStore.get().phase === 'entering') uiStore.set({ phase: 'experience' })
  }, 2400)
}

export function togglePlay() {
  const ui = uiStore.get()
  if (ui.phase === 'ended') return restart()
  if (ui.phase === 'intro') return
  if (audioEngine.isPaused) {
    audioEngine.resume()
    uiStore.set({ playing: true })
  } else {
    audioEngine.pause()
    uiStore.set({ playing: false })
  }
}

export function restart() {
  if (uiStore.get().phase === 'intro') return
  audioEngine.restart(track)
  applyTimeline()
  stage.running = true
  uiStore.set({ phase: 'experience', playing: true })
}

export function setVolume(v: number) {
  const volume = Math.min(1, Math.max(0, v))
  audioEngine.setVolume(volume)
  if (volume > 0 && uiStore.get().muted) audioEngine.setMuted(false)
  uiStore.set({ volume, muted: volume === 0 ? uiStore.get().muted : false })
}

export function toggleMute() {
  const muted = !uiStore.get().muted
  audioEngine.setMuted(muted)
  uiStore.set({ muted })
}

export function toggleCinematic() {
  uiStore.set((s) => ({ cinematic: !s.cinematic }))
}

export function toggleReducedEffects() {
  uiStore.set((s) => ({ reducedEffects: !s.reducedEffects }))
}

const VERSE_ORDER = ['full', 'sanskrit', 'off'] as const
export function cycleVerses() {
  const next = VERSE_ORDER[(VERSE_ORDER.indexOf(uiStore.get().verses) + 1) % VERSE_ORDER.length]
  rememberVerseMode(next)
  uiStore.set({ verses: next })
}

export function toggleFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
  } else {
    void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
  }
}

export const fullscreenSupported = () =>
  typeof document !== 'undefined' &&
  !!(document.fullscreenEnabled || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled)
