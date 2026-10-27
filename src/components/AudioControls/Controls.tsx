import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { features } from '../../audio/audioAnalysis'
import { director } from '../../choreography/director'
import { stage } from '../../choreography/stage'
import { ACTS } from '../../choreography/timeline'
import { useIdle } from '../../hooks/useIdle'
import { useTicker } from '../../hooks/useTicker'
import { useUI } from '../../state/store'
import {
  fullscreenSupported,
  restart,
  setVolume,
  toggleCinematic,
  toggleFullscreen,
  toggleMute,
  togglePlay,
  toggleReducedEffects,
  cycleVerses,
} from '../Experience/controller'

const Icon = {
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M8.5 5.5v13" />
      <path d="M15.5 5.5v13" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  muted: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  restart: (
    <>
      <path d="M5 12a7 7 0 1 0 2.05-4.95" />
      <path d="M5 4.5v3.5h3.5" />
    </>
  ),
  cinematic: (
    <>
      <path d="M3.5 7.5h17v9h-17z" />
      <path d="M3.5 10h17M3.5 14h17" opacity="0.45" />
    </>
  ),
  effects: (
    <>
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  verses: (
    <>
      <path d="M5 7.5h14M5 12h10M5 16.5h12" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </>
  ),
}

function Btn({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button className="ctl" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

/** Five bars that breathe with the live analysis. Written straight to the DOM each frame. */
function SoundIndicator() {
  const bars = useRef<HTMLSpanElement[]>([])
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const vals = [features.bass, (features.bass + features.mid) / 2, features.mid, (features.mid + features.high) / 2, features.high]
      bars.current.forEach((b, i) => {
        if (b) b.style.transform = `scaleY(${0.15 + Math.min(1, vals[i] * stage.energy * 1.4 + 0.05) * 0.85})`
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <span className="meter" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          ref={(el) => {
            if (el) bars.current[i] = el
          }}
        />
      ))}
    </span>
  )
}

function Progress() {
  const read = useCallback(() => {
    const tl = director.timeline
    return { p: Math.min(1, stage.time / tl.duration), starts: tl.actStarts.map((s) => s / tl.duration) }
  }, [])
  const { p, starts } = useTicker(read, 200)
  const act = useUI((s) => s.act)
  const meta = ACTS.find((a) => a.id === act)!
  return (
    <div className="progress">
      <p className="progress__act" aria-label={`Act ${meta.numeral}: ${meta.title}`}>
        <span>{meta.numeral}</span>
      </p>
      <div className="progress__track" role="progressbar" aria-label="Experience progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <div className="progress__fill" style={{ transform: `scaleX(${p})` }} />
        {starts.slice(1).map((s, i) => (
          <span key={i} className="progress__tick" style={{ left: `${s * 100}%` }} />
        ))}
      </div>
    </div>
  )
}

export function Controls() {
  const phase = useUI((s) => s.phase)
  const playing = useUI((s) => s.playing)
  const muted = useUI((s) => s.muted)
  const volume = useUI((s) => s.volume)
  const cinematic = useUI((s) => s.cinematic)
  const reduced = useUI((s) => s.reducedEffects)
  const source = useUI((s) => s.audioSource)
  const lyrics = useUI((s) => s.lyrics)
  const verses = useUI((s) => s.verses)
  const root = useRef<HTMLDivElement>(null)
  const idle = useIdle(3200, phase === 'experience')
  const focusWithin = () => !!root.current?.contains(document.activeElement)

  if (phase === 'intro') return null
  const hidden = (idle && !focusWithin()) || cinematic

  return (
    <>
      <div ref={root} className={`hud ${hidden ? 'is-hidden' : ''} ${phase === 'entering' ? 'is-entering' : ''}`}>
        <Progress />
        <div className="controls" role="toolbar" aria-label="Playback controls">
          <SoundIndicator />
          <Btn label={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={togglePlay}>
            {playing ? Icon.pause : Icon.play}
          </Btn>
          <Btn label={muted ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute} pressed={muted}>
            {muted ? Icon.muted : Icon.sound}
          </Btn>
          <input
            className="volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ '--v': muted ? 0 : volume } as CSSProperties}
          />
          <Btn label="Restart (R)" onClick={restart}>
            {Icon.restart}
          </Btn>
          <span className="controls__sep" aria-hidden="true" />
          {lyrics && (
            <Btn
              label={`Verses: ${verses === 'full' ? 'Sanskrit + English' : verses === 'sanskrit' ? 'Sanskrit only' : 'hidden'} (V)`}
              onClick={cycleVerses}
              pressed={verses !== 'off'}
            >
              {Icon.verses}
            </Btn>
          )}
          <Btn label={reduced ? 'Full effects' : 'Reduce effects'} onClick={toggleReducedEffects} pressed={reduced}>
            {Icon.effects}
          </Btn>
          <Btn label="Cinematic mode (C)" onClick={toggleCinematic} pressed={cinematic}>
            {Icon.cinematic}
          </Btn>
          {fullscreenSupported() && (
            <Btn label="Fullscreen (F)" onClick={toggleFullscreen}>
              {Icon.fullscreen}
            </Btn>
          )}
        </div>
        {source !== 'pending' && (
          <p className="hud__source">
            {source === 'track' ? 'Soundtrack' : source === 'score' ? 'Procedural score' : 'Silent mode · audio unavailable'}
          </p>
        )}
      </div>
      {cinematic && (
        <button className="cinematic-exit" onClick={toggleCinematic} aria-label="Exit cinematic mode (Esc)">
          Exit cinematic · Esc
        </button>
      )}
    </>
  )
}
