import { useEffect, useState } from 'react'
import { ACTS, type ActId } from '../../choreography/timeline'
import { useUI } from '../../state/store'

/**
 * Lines from the first verse of the Shiv Tandav Stotram (public domain,
 * IAST transliteration) with a short English rendering.
 */
const VERSE: Partial<Record<ActId, { sa: string; en: string }>> = {
  awakening: {
    sa: 'jaṭāṭavī-galaj-jala-pravāha-pāvita-sthale',
    en: 'From the forest of his matted locks, the sacred waters fall',
  },
  tandav: {
    sa: 'ḍamaḍ-ḍamaḍ-ḍamaḍ-ḍaman-ninādavaḍ-ḍamarvayam',
    en: 'The damaru resounds — ḍamaḍ, ḍamaḍ, ḍamaḍ',
  },
  fury: {
    sa: 'cakāra caṇḍa-tāṇḍavam',
    en: 'He danced the fierce Tandav',
  },
  stillness: {
    sa: 'tanotu naḥ śivaḥ śivam',
    en: 'May Shiva bring us what is auspicious',
  },
}

export function ActCaption() {
  const act = useUI((s) => s.act)
  const phase = useUI((s) => s.phase)
  // With a timed recording, the real shloka is shown as it is sung instead.
  const sung = useUI((s) => s.lyrics && s.verses !== 'off')
  const [shown, setShown] = useState<ActId | null>(null)

  useEffect(() => {
    if (phase !== 'experience' && phase !== 'entering') return
    setShown(act)
    const id = window.setTimeout(() => setShown(null), act === 'void' ? 5000 : 7500)
    return () => clearTimeout(id)
  }, [act, phase])

  const meta = ACTS.find((a) => a.id === act)!
  const verse = sung ? undefined : VERSE[act]
  return (
    <div className={`caption ${shown === act ? 'is-visible' : ''} ${sung ? 'is-top' : ''}`} aria-live="polite">
      <p className="caption__act">
        <span className="caption__numeral">{meta.numeral}</span>
        <span className="caption__title">{meta.title}</span>
      </p>
      {verse && (
        <p className="caption__verse">
          <span lang="sa-Latn" className="caption__sa">
            {verse.sa}
          </span>
          <span className="caption__en">{verse.en}</span>
        </p>
      )}
    </div>
  )
}
