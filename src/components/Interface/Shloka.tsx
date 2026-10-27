import { useEffect, useRef, useState } from 'react'
import { stage } from '../../choreography/stage'
import { getLyrics, onLyricsChange, type TimedLine } from '../../shloka/lyrics'
import { useUI } from '../../state/store'

/**
 * The line being sung: Devanagari that fills with light word by word as it is
 * chanted, IAST beneath it, and an optional English rendering. Line changes
 * are polled; the fill is written straight to the DOM every frame.
 *
 * Each word carries its own fill so the sweep reads correctly when the line
 * wraps (the verse sits in a narrow column beside the dancer on wide screens).
 */
export function Shloka() {
  const verses = useUI((s) => s.verses)
  const lyrics = useUI((s) => s.lyrics)
  const phase = useUI((s) => s.phase)
  const [current, setCurrent] = useState<TimedLine | null>(null)
  const [previous, setPrevious] = useState<TimedLine | null>(null)
  const fill = useRef<HTMLParagraphElement>(null)
  const shownId = useRef<string | null>(null)
  const currentRef = useRef<TimedLine | null>(null)

  useEffect(() => {
    const check = () => {
      const line = stage.lineIndex >= 0 ? (getLyrics()[stage.lineIndex] ?? null) : null
      const id = line ? `${line.id}@${line.t}` : null
      if (id === shownId.current) return
      shownId.current = id
      setPrevious(currentRef.current)
      setCurrent(line)
      currentRef.current = line
    }
    const id = window.setInterval(check, 80)
    const off = onLyricsChange(check)
    return () => {
      clearInterval(id)
      off()
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const el = fill.current
      const line = stage.lineIndex >= 0 ? getLyrics()[stage.lineIndex] : null
      if (el && line) {
        const p = Math.min(1, Math.max(0, (stage.time - line.t) / Math.max(0.5, (line.end - line.t) * 0.92)))
        const words = el.children
        const total = line.deva.length
        let at = 0
        for (let i = 0; i < words.length; i++) {
          const w = words[i] as HTMLElement
          const len = (w.textContent ?? '').length + 1
          const local = Math.min(1, Math.max(0, (p * total - at) / len))
          w.style.setProperty('--p', `${(local * 116 - 8).toFixed(2)}%`)
          at += len
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!lyrics || verses === 'off' || phase === 'intro') return null

  const render = (line: TimedLine, leaving: boolean) => (
    <div key={`${line.id}@${line.t}${leaving ? '-out' : ''}`} className={`shloka__line ${leaving ? 'is-leaving' : ''}`}>
      <p lang="sa" className="shloka__deva" ref={leaving ? undefined : fill}>
        {line.deva.split(' ').map((word, i) => (
          <span key={i} className="shloka__word">
            {word}{' '}
          </span>
        ))}
      </p>
      <p lang="sa-Latn" className="shloka__iast">
        {line.iast}
      </p>
      {verses === 'full' && <p className="shloka__en">{line.en}</p>}
    </div>
  )

  return (
    <section className="shloka" aria-live="polite" aria-label="Verse being chanted">
      {previous && previous !== current && render(previous, true)}
      {current && render(current, false)}
    </section>
  )
}
