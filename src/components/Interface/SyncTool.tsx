import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioEngine } from '../../audio/audioEngine'
import { loadDraft, saveDraft, setLyrics, type TimedLineInput } from '../../shloka/lyrics'
import { STOTRAM } from '../../shloka/stotram'
import { uiStore, useUI } from '../../state/store'
import { seek, togglePlay } from '../Experience/controller'

/** Typical tap latency; marks are shifted earlier by this much. */
const REACTION = 0.12

/**
 * `?sync` — time the shloka to your recording by tapping as each half-verse
 * begins. Marks preview live (the shloka display and motif choreography use
 * them immediately), persist as a local draft, and export as
 * `tandav.lyrics.json` for `public/audio/`.
 */
export function SyncTool() {
  const phase = useUI((s) => s.phase)
  const source = useUI((s) => s.audioSource)
  const [marks, setMarks] = useState<TimedLineInput[]>(() => loadDraft() ?? [])
  const [cursor, setCursor] = useState(() => {
    const draft = loadDraft()
    const last = draft?.[draft.length - 1]
    return last ? STOTRAM.findIndex((l) => l.id === last.id) + 1 : 0
  })
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(0)
  const listRef = useRef<HTMLOListElement>(null)

  const commit = useCallback((next: TimedLineInput[]) => {
    setMarks(next)
    setLyrics(next)
    saveDraft(next)
    uiStore.set({ lyrics: next.length > 0 })
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(audioEngine.time()), 100)
    return () => clearInterval(id)
  }, [])

  const json = useMemo(
    () => JSON.stringify({ lines: marks.map((m) => ({ id: m.id, t: Math.round(m.t * 100) / 100 })) }, null, 2),
    [marks],
  )

  const mark = useCallback(() => {
    if (cursor >= STOTRAM.length) return
    const t = Math.max(0, audioEngine.time() - REACTION)
    commit([...marks.filter((m) => m.t < t), { id: STOTRAM[cursor].id, t }])
    setCursor(cursor + 1)
  }, [cursor, marks, commit])

  const undo = useCallback(() => {
    const last = marks[marks.length - 1]
    if (!last) return
    commit(marks.slice(0, -1))
    setCursor(STOTRAM.findIndex((l) => l.id === last.id))
  }, [marks, commit])

  const skip = useCallback(() => setCursor((c) => Math.min(STOTRAM.length, c + 1)), [])
  const back = useCallback(() => setCursor((c) => Math.max(0, c - 1)), [])

  const download = useCallback(() => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'tandav.lyrics.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [json])

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(json).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }, [json])

  const clear = useCallback(() => {
    if (!window.confirm('Clear all marks?')) return
    commit([])
    setCursor(0)
  }, [commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (uiStore.get().phase === 'intro') return
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      switch (e.key) {
        case ' ':
        case 'Enter':
          handled()
          mark()
          break
        case 'Backspace':
          handled()
          undo()
          break
        case 's':
        case 'S':
          handled()
          skip()
          break
        case 'b':
        case 'B':
          handled()
          back()
          break
        case 'p':
        case 'P':
          handled()
          togglePlay()
          break
        case 'ArrowLeft':
          handled()
          seek(audioEngine.time() - 5)
          break
        case 'ArrowRight':
          handled()
          seek(audioEngine.time() + 5)
          break
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [mark, undo, skip, back])

  useEffect(() => {
    listRef.current?.querySelector('.is-next')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (phase === 'intro') return null
  if (source !== 'track') {
    return (
      <aside className="sync" role="dialog" aria-label="Shloka sync">
        <h2 className="sync__title">Shloka sync</h2>
        <p className="sync__note">
          No soundtrack found. Put your recording at <code>public/audio/tandav.mp3</code> and reload with <code>?sync</code>.
        </p>
      </aside>
    )
  }

  const next = STOTRAM[cursor]
  const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

  return (
    <aside className="sync" role="dialog" aria-label="Shloka sync">
      <header className="sync__head">
        <h2 className="sync__title">Shloka sync</h2>
        <span className="sync__clock">{fmt(now)}</span>
      </header>
      <p className="sync__note">
        Tap <kbd>Space</kbd> the moment each half-verse <em>begins</em>. <kbd>⌫</kbd> undo · <kbd>S</kbd> skip a line your recording
        omits · <kbd>B</kbd> back · <kbd>P</kbd> pause · <kbd>←</kbd>/<kbd>→</kbd> seek 5 s.
      </p>
      <div className="sync__next">
        {next ? (
          <>
            <span className="sync__label">
              Next · {next.id}
              {next.optional ? ' · sung in some recordings' : ''}
            </span>
            <span lang="sa" className="sync__deva">
              {next.deva}
            </span>
          </>
        ) : (
          <span className="sync__label">All lines marked — export below.</span>
        )}
      </div>
      <div className="sync__buttons">
        <button onClick={mark} disabled={!next}>
          Mark
        </button>
        <button onClick={undo} disabled={!marks.length}>
          Undo
        </button>
        <button onClick={skip} disabled={!next}>
          Skip
        </button>
      </div>
      <ol className="sync__list" ref={listRef}>
        {STOTRAM.map((l, i) => {
          const m = marks.find((x) => x.id === l.id)
          return (
            <li key={l.id} className={`${i === cursor ? 'is-next' : ''} ${m ? 'is-marked' : ''}`}>
              <button className="sync__time" onClick={() => m && seek(m.t - 2)} disabled={!m} title={m ? 'Replay from just before this line' : undefined}>
                {m ? fmt(m.t) : '—'}
              </button>
              <span className="sync__id">{l.id}</span>
              <span className="sync__iast">{l.iast}</span>
            </li>
          )
        })}
      </ol>
      <div className="sync__buttons">
        <button onClick={download} disabled={!marks.length}>
          Download JSON
        </button>
        <button onClick={copy} disabled={!marks.length}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={clear} disabled={!marks.length}>
          Clear
        </button>
      </div>
      <p className="sync__note">
        Save the file as <code>public/audio/tandav.lyrics.json</code>. Until then this browser keeps a draft.
      </p>
    </aside>
  )
}
