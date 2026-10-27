import { useFrame } from '@react-three/fiber'
import { audioEngine } from '../../audio/audioEngine'
import { director } from '../../choreography/director'
import { stage } from '../../choreography/stage'
import { uiStore } from '../../state/store'
import { PREVIEW } from '../../utils/preview'

/**
 * Runs first every frame (negative priority): advances the clock, analysis
 * and director before any effect reads `stage`.
 */
export function DirectorTick() {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    stage.frame++
    const ui = uiStore.get()
    stage.reduced = ui.reducedEffects
    stage.reducedMotion = ui.reducedMotion || ui.reducedEffects

    if (PREVIEW.time !== null) {
      stage.running = true
      if (ui.phase === 'intro') uiStore.set({ phase: 'experience', audioSource: 'silent' })
      director.update(PREVIEW.time + (PREVIEW.freeze ? 0 : state.clock.elapsedTime), dt, 'silent', null)
      return
    }
    if (!stage.running) {
      director.idle(dt, state.clock.elapsedTime)
      return
    }
    audioEngine.poll()
    director.update(audioEngine.time(), dt, audioEngine.mode, audioEngine.analyzer)
  }, -1)
  return null
}
