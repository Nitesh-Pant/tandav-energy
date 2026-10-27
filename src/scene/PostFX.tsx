import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, ShockWave, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type BloomEffect, type ShockWaveEffect } from 'postprocessing'
import { useEffect, useRef } from 'react'
import { anchors } from '../choreography/anchors'
import { visualEvents } from '../choreography/events'
import { stage } from '../choreography/stage'
import { useUI } from '../state/store'
import { QUALITY } from '../config'

/**
 * Restrained post stack: bloom for light, ACES grading, vignette and a touch
 * of film grain. The screen-space shockwave is reserved for major accents.
 */
export function PostFX() {
  const quality = useUI((s) => s.quality)
  const reduced = useUI((s) => s.reducedEffects)
  const bloom = useRef<BloomEffect>(null)
  const wave = useRef<ShockWaveEffect>(null)

  useEffect(
    () =>
      visualEvents.on('distortion', ({ strength }) => {
        const w = wave.current
        if (!w || stage.reduced) return
        w.position.set(anchors.chest.x, anchors.chest.y, anchors.chest.z)
        w.amplitude = 0.008 + strength * 0.018
        w.maxRadius = 0.6 + strength * 0.9
        w.explode()
      }),
    [],
  )

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.85 + stage.intensity * 0.45 + stage.climax * 0.35 + stage.flash * 0.25
  })

  if (!QUALITY[quality].bloom && reduced) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette darkness={0.7} offset={0.25} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={0}>
      <ShockWave ref={wave} speed={1.6} maxRadius={1.2} waveSize={0.18} amplitude={0.03} />
      <Bloom ref={bloom} mipmapBlur intensity={1} luminanceThreshold={0.42} luminanceSmoothing={0.3} radius={0.78} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette darkness={0.72} offset={0.22} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} />
    </EffectComposer>
  )
}
