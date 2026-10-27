import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { NoToneMapping } from 'three'
import { AdaptiveResolution } from '../../scene/AdaptiveResolution'
import { Interaction } from '../../scene/Interaction'
import { Scene } from '../../scene/Scene'
import { uiStore } from '../../state/store'
import { DirectorTick } from './DirectorTick'

/** The single, persistent WebGL canvas. The intro idles in it; the experience plays in it. */
export function Experience() {
  // Stop rendering entirely while the page is hidden (the audio clock keeps time).
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <Canvas
      className="experience-canvas"
      frameloop={visible ? 'always' : 'never'}
      dpr={1}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true }}
      camera={{ fov: 32, near: 0.1, far: 2000, position: [0, 2.2, 30] }}
      onCreated={({ gl }) => {
        gl.toneMapping = NoToneMapping
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          uiStore.set({ notice: 'The graphics context was lost. Reload the page to continue.' })
        })
      }}
      aria-label="TANDAV — a cosmic scene of Shiva's dance"
    >
      <DirectorTick />
      <AdaptiveResolution />
      <Interaction />
      <Scene />
    </Canvas>
  )
}
