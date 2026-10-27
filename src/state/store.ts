import { useSyncExternalStore } from 'react'
import { detectQuality, prefersReducedMotion, type QualityLevel } from '../config'
import type { ActId } from '../choreography/timeline'

/**
 * Low-frequency UI state (phase, playback flags, settings).
 * Per-frame values never go through here — see `choreography/stage.ts`.
 */

export type Phase = 'intro' | 'entering' | 'experience' | 'ended'
export type AudioSource = 'pending' | 'track' | 'score' | 'silent'
export type VerseMode = 'full' | 'sanskrit' | 'off'

const VERSE_KEY = 'tandav.verses'
function storedVerseMode(): VerseMode {
  try {
    const v = localStorage.getItem(VERSE_KEY)
    return v === 'sanskrit' || v === 'off' ? v : 'full'
  } catch {
    return 'full'
  }
}
export function rememberVerseMode(v: VerseMode) {
  try {
    localStorage.setItem(VERSE_KEY, v)
  } catch {
    /* not persisted; fine */
  }
}

export interface UIState {
  phase: Phase
  playing: boolean
  muted: boolean
  volume: number
  cinematic: boolean
  reducedEffects: boolean
  reducedMotion: boolean
  quality: QualityLevel
  audioSource: AudioSource
  act: ActId
  webglFailed: boolean
  notice: string | null
  /** How the sung shloka is shown. */
  verses: VerseMode
  /** True when timed shloka lines are available for the current soundtrack. */
  lyrics: boolean
  /** Structure analysis of a user soundtrack. */
  analysis: 'none' | 'pending' | 'done' | 'failed'
  /** `?sync` — the tap-to-time tool for shloka lines. */
  syncMode: boolean
}

type Listener = () => void

function createStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<Listener>()
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === 'function' ? patch(state) : patch
      let changed = false
      for (const k in next) {
        if (!Object.is(next[k], state[k])) {
          changed = true
          break
        }
      }
      if (!changed) return
      state = { ...state, ...next }
      listeners.forEach((l) => l())
    },
    subscribe(l: Listener) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

const reducedMotion = prefersReducedMotion()

export const uiStore = createStore<UIState>({
  phase: 'intro',
  playing: false,
  muted: false,
  volume: 0.85,
  cinematic: false,
  reducedEffects: reducedMotion,
  reducedMotion,
  quality: detectQuality(),
  audioSource: 'pending',
  act: 'void',
  webglFailed: false,
  notice: null,
  verses: storedVerseMode(),
  lyrics: false,
  analysis: 'none',
  syncMode: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('sync'),
})

export function useUI<S>(selector: (s: UIState) => S): S {
  return useSyncExternalStore(uiStore.subscribe, () => selector(uiStore.get()))
}
