import { useEffect } from 'react'
import { cycleVerses, restart, setVolume, toggleCinematic, toggleFullscreen, toggleMute, togglePlay } from '../components/Experience/controller'
import { uiStore } from '../state/store'

/** Space/K play-pause · M mute · ↑/↓ volume · R restart · V verses · C cinematic · F fullscreen · Esc leaves cinematic. */
export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range')) return
      const ui = uiStore.get()
      if (ui.phase === 'intro' || ui.phase === 'entering') return
      // The sync tool owns the transport keys while it is open.
      if (ui.syncMode && !['m', 'M', 'f', 'F', 'v', 'V'].includes(e.key)) return
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          // Let focused buttons handle Space themselves.
          if (e.key === ' ' && target?.tagName === 'BUTTON') return
          e.preventDefault()
          togglePlay()
          break
        case 'm':
        case 'M':
          toggleMute()
          break
        case 'ArrowUp':
          if (target?.tagName === 'INPUT') return
          e.preventDefault()
          setVolume(ui.volume + 0.1)
          break
        case 'ArrowDown':
          if (target?.tagName === 'INPUT') return
          e.preventDefault()
          setVolume(ui.volume - 0.1)
          break
        case 'r':
        case 'R':
          restart()
          break
        case 'v':
        case 'V':
          cycleVerses()
          break
        case 'c':
        case 'C':
          toggleCinematic()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'Escape':
          if (ui.cinematic) toggleCinematic()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
