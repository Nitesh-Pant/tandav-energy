import { useEffect, useState } from 'react'
import { useUI } from '../../state/store'
import { enter, hasTrack as trackFound, prepareAudio } from '../Experience/controller'

/** The threshold: near-black, a title, one invitation. Audio starts only on that click. */
export function Intro() {
  const phase = useUI((s) => s.phase)
  const [ready, setReady] = useState(false)
  const [hasTrack, setHasTrack] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    prepareAudio().then(() => {
      if (!alive) return
      setReady(true)
      setHasTrack(trackFound())
    })
    return () => {
      alive = false
    }
  }, [])

  if (phase !== 'intro' && phase !== 'entering') return null
  const leaving = phase === 'entering'

  return (
    <section className={`intro ${leaving ? 'is-leaving' : ''}`} aria-hidden={leaving}>
      <div className="intro__inner">
        <p className="intro__eyebrow">
          <span lang="sa">ताण्डव</span>
        </p>
        <h1 className="intro__title" aria-label="Tandav">
          {'TANDAV'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${1.2 + i * 0.12}s` }} aria-hidden="true">
              {c}
            </span>
          ))}
        </h1>
        <p className="intro__tagline">When the universe moves, it dances.</p>
        <button className="intro__enter" onClick={enter} disabled={!ready || leaving} autoFocus>
          <span>Enter the experience</span>
        </button>
        <p className="intro__hint">
          Sound on · best with headphones
          {hasTrack !== null && (
            <span className="intro__source">{hasTrack ? 'Soundtrack loaded' : 'Original procedural score'}</span>
          )}
        </p>
        {/* <p className="credit">
          Bronze: <i>Shiva Nataraja (Lord of Dance)</i>, Birmingham Museum of Art — 3D scan,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          , simplified and cleaned
        </p> */}
      </div>
    </section>
  )
}
