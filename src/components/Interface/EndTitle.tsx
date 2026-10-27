import { useCallback } from 'react'
import { director } from '../../choreography/director'
import { stage } from '../../choreography/stage'
import { useUI } from '../../state/store'
import { useTicker } from '../../hooks/useTicker'
import { restart } from '../Experience/controller'

export function EndTitle() {
  const phase = useUI((s) => s.phase)
  const reachedTitle = useTicker(
    useCallback(() => stage.running && stage.time >= director.timeline.endTitle, []),
    300,
  )
  const visible = phase === 'ended' || (phase === 'experience' && reachedTitle)
  return (
    <section className={`endtitle ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <h2 className="endtitle__text">
        <span>The universe moves.</span>
        <span>The universe transforms.</span>
      </h2>
      <button className="endtitle__replay" onClick={restart} tabIndex={visible ? 0 : -1} disabled={!visible}>
        Experience again
      </button>
      
      {/*<p className="credit">
        Bronze: <i>Shiva Nataraja (Lord of Dance)</i>, Birmingham Museum of Art — 3D scan,{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        , simplified and cleaned
      </p>*/}
      
    </section>
  )
}
