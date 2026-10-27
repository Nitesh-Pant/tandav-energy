import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { QUALITY } from '../config'
import { useUI } from '../state/store'

/**
 * Keeps the frame rate steady by stepping the pixel ratio down when frames
 * run long. It never steps back up: each change costs a visible hitch, and
 * oscillating between resolutions reads as stutter.
 */
export function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr)
  const quality = useUI((s) => s.quality)
  const reduced = useUI((s) => s.reducedEffects)
  const max = Math.min(window.devicePixelRatio || 1, reduced ? 1 : QUALITY[quality].maxDpr)
  const state = useRef({ dpr: max, acc: 0, frames: 0, cooldown: 0 })

  useEffect(() => {
    state.current.dpr = max
    setDpr(max)
  }, [max, setDpr])

  useFrame((_, delta) => {
    const s = state.current
    if (delta > 0.25) return // tab switch or hitch; ignore
    s.acc += delta
    s.frames++
    s.cooldown -= delta
    if (s.acc < 2) return
    const avg = s.acc / s.frames
    s.acc = 0
    s.frames = 0
    if (s.cooldown > 0) return
    if (avg > 1 / 50 && s.dpr > 0.75) {
      s.dpr = Math.max(0.75, s.dpr - 0.25)
      s.cooldown = 3
      setDpr(s.dpr)
    }
  })
  return null
}
