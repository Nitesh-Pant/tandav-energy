import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight, HemisphereLight, PointLight } from 'three'
import { LAYOUT, PALETTE } from '../../config'
import { stage } from '../../choreography/stage'

/**
 * Physical lights only matter for the standard-material props (rocks,
 * pedestal, trident, ornaments). The figure and effects light themselves
 * in their shaders from the same stage values.
 */
export function Lights() {
  const halo = useRef<PointLight>(null)
  const fire = useRef<PointLight>(null)
  const flash = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const [hx, hy, hz] = LAYOUT.haloCenter

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (halo.current) halo.current.intensity = 3 + stage.halo * 26 + stage.climax * 22
    if (fire.current) fire.current.intensity = stage.fire * 10 * (0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07)
    if (flash.current) {
      flash.current.intensity = stage.flash * 3
      flash.current.position.set(stage.flashX, stage.flashY, stage.flashZ)
    }
    if (hemi.current) hemi.current.intensity = 0.12 + stage.energy * 0.18
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#26306e', '#05060c', 0.3]} />
      <pointLight ref={halo} color={PALETTE.electric} position={[hx, hy, hz - 1.4]} distance={90} decay={1.1} />
      <pointLight ref={fire} color={PALETTE.amber} position={[0, 1.2, -0.9]} distance={18} decay={1.6} />
      <directionalLight ref={flash} color="#cfdcff" intensity={0} />
    </>
  )
}
