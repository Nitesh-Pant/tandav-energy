/**
 * Timed shloka lines for a user recording.
 *
 * File: `public/audio/tandav.lyrics.json`
 *   { "lines": [ { "id": "1a", "t": 21.4 }, { "id": "1b", "t": 28.1 }, ... ] }
 * Optional per line: "end" (seconds) and "deva" / "iast" / "en" text overrides.
 * The in-app sync tool (`?sync`) writes exactly this format.
 */

import { STOTRAM_BY_ID, type Motif } from './stotram'

export interface TimedLineInput {
  id: string
  t: number
  end?: number
  deva?: string
  iast?: string
  en?: string
}

export interface TimedLine {
  id: string
  t: number
  end: number
  deva: string
  iast: string
  en: string
  motifs: Motif[]
  /** Verse number in the stotram (0 when the id is unknown). */
  verse: number
  /** First half-verse of a verse — a natural structural accent. */
  verseStart: boolean
  /** Seconds the line is actually sung over: its `end` if given, else a typical half-verse. */
  sung: number
}

/** A line stays on screen until the next begins, but never longer than this. */
const MAX_LINE = 16
/** A half-verse usually takes about this long to chant. */
const TYPICAL_LINE = 6.6

let lines: TimedLine[] = []
const listeners = new Set<() => void>()

export function setLyrics(input: TimedLineInput[] | null) {
  const valid = (input ?? []).filter((l) => l && typeof l.t === 'number' && Number.isFinite(l.t))
  valid.sort((a, b) => a.t - b.t)
  lines = valid.map((l, i) => {
    const base = STOTRAM_BY_ID.get(l.id)
    const next = valid[i + 1]?.t ?? Infinity
    return {
      id: l.id,
      t: l.t,
      end: l.end ?? Math.min(next, l.t + MAX_LINE),
      deva: l.deva ?? base?.deva ?? '',
      iast: l.iast ?? base?.iast ?? '',
      en: l.en ?? base?.en ?? '',
      motifs: base?.motifs ?? [],
      verse: base?.verse ?? 0,
      verseStart: /a$/.test(l.id),
      sung: l.end !== undefined ? l.end - l.t : Math.min(next - l.t, TYPICAL_LINE),
    }
  })
  listeners.forEach((f) => f())
}

export function getLyrics(): readonly TimedLine[] {
  return lines
}

export function hasLyrics() {
  return lines.length > 0
}

export function onLyricsChange(f: () => void) {
  listeners.add(f)
  return () => listeners.delete(f)
}

/** Index of the line being sung at time t, or -1. */
export function lineIndexAt(t: number): number {
  // Lines are few (≈34); a linear scan from the end is plenty.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (t >= lines[i].t) return t < lines[i].end ? i : -1
  }
  return -1
}

export async function loadLyricsFile(url: string): Promise<TimedLineInput[] | null> {
  try {
    const res = await fetch(url)
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
    const data = (await res.json()) as { lines?: TimedLineInput[] }
    return Array.isArray(data.lines) ? data.lines : null
  } catch {
    return null
  }
}

export const SYNC_DRAFT_KEY = 'tandav.lyrics.draft'

export function loadDraft(): TimedLineInput[] | null {
  try {
    const raw = localStorage.getItem(SYNC_DRAFT_KEY)
    return raw ? ((JSON.parse(raw) as { lines: TimedLineInput[] }).lines ?? null) : null
  } catch {
    return null
  }
}

export function saveDraft(input: TimedLineInput[]) {
  try {
    localStorage.setItem(SYNC_DRAFT_KEY, JSON.stringify({ lines: input }))
  } catch {
    /* private mode: the export buttons still work */
  }
}
