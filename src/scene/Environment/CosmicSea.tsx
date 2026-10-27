import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from 'three'
import { LAYOUT, PALETTE } from '../../config'
import { stage } from '../../choreography/stage'
import { NOISE_GLSL } from '../../utils/glsl'
import { useDisposable } from '../../utils/dispose'
import { WAVE_COUNT, waveAge, waves } from '../EnergyEffects/waves'

/**
 * A dark, still ocean far below the floating pedestal. Analytic mirror
 * reflections of the halo and sky (no extra render pass), disturbed by
 * gentle swell and the shockwaves that roll across it.
 */
export function CosmicSea() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(2400, 2400, 1, 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHaloPos: { value: new Vector3(...LAYOUT.haloCenter) },
          uHalo: { value: 0 },
          uFire: { value: 0 },
          uFlash: { value: 0 },
          uFlashPos: { value: new Vector3() },
          uHorizon: { value: new Color(PALETTE.deepIndigo) },
          uDeep: { value: new Color('#010208') },
          uGlow: { value: new Color(PALETTE.electric) },
          uWaves: { value: Array.from({ length: WAVE_COUNT }, () => new Vector4()) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uHalo, uFire, uFlash;
          uniform vec3 uHaloPos, uFlashPos, uHorizon, uDeep, uGlow;
          uniform vec4 uWaves[${WAVE_COUNT}];
          varying vec3 vW;
          ${NOISE_GLSL}
          void main() {
            vec3 V = normalize(vW - cameraPosition);
            float dist = length(vW.xz - cameraPosition.xz);
            // Swell: slow, broad normal perturbation, fading with distance to avoid aliasing.
            vec2 p = vW.xz * 0.08;
            float fade = exp(-dist * 0.004);
            vec2 grad = vec2(
              vnoise2(p + vec2(uTime * 0.05, 0.0)) - vnoise2(p + vec2(0.7 + uTime * 0.05, 0.0)),
              vnoise2(p * 1.3 + vec2(0.0, uTime * 0.04)) - vnoise2(p * 1.3 + vec2(0.0, 0.7 + uTime * 0.04))
            ) * 0.25 * fade;
            float ringLight = 0.0;
            for (int i = 0; i < ${WAVE_COUNT}; i++) {
              vec4 w = uWaves[i];
              if (w.w <= 0.0) continue;
              vec2 dv = vW.xz - w.xy;
              float r = length(dv);
              float k = (r - w.z) / (1.2 + w.z * 0.06);
              float ripple = exp(-k * k) * w.w;
              grad += normalize(dv + 1e-4) * ripple * 0.5 * sin(k * 5.0);
              ringLight += ripple;
            }
            vec3 N = normalize(vec3(grad.x, 1.0, grad.y));
            vec3 R = reflect(V, N);

            // Sky gradient in reflection.
            vec3 col = mix(uHorizon * 0.9, uDeep, smoothstep(0.0, 0.35, R.y));
            // Mirror of the halo: a long shimmering column toward the viewer.
            vec3 toHalo = normalize(uHaloPos - vW);
            float h = max(dot(R, toHalo), 0.0);
            col += uGlow * (pow(h, 900.0) * 3.0 + pow(h, 90.0) * 0.6 + pow(h, 12.0) * 0.08) * uHalo;
            col += vec3(1.0, 0.45, 0.12) * pow(h, 60.0) * uFire * 0.5;
            // Lightning glints across the water.
            vec3 toFlash = normalize(uFlashPos - vW);
            col += vec3(0.6, 0.7, 1.0) * (pow(max(dot(R, toFlash), 0.0), 30.0) * 1.5 + 0.05) * uFlash;
            col += uGlow * ringLight * 0.35;
            // Fresnel darkening looking straight down; haze toward the horizon.
            float fres = pow(1.0 - max(-V.y, 0.0), 4.0);
            col *= 0.35 + 0.65 * fres;
            col = mix(col, uHorizon * 0.7, smoothstep(250.0, 900.0, dist));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  useDisposable(geometry, material)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const u = material.uniforms
    u.uTime.value = t
    u.uHalo.value = 0.25 + stage.halo
    u.uFire.value = stage.fire
    u.uFlash.value = stage.flash
    u.uFlashPos.value.set(stage.flashX, stage.flashY, stage.flashZ)
    const arr = u.uWaves.value as Vector4[]
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i]
      const age = waveAge(w, t)
      // Waves reach the sea a moment after leaving the pedestal.
      const a = age - 0.25
      if (a <= 0) arr[i].set(0, 0, 0, 0)
      else arr[i].set(w.x, w.z, a * w.speed * 1.2, w.strength * Math.pow(1 - a / w.life, 2))
    }
  })

  return <mesh geometry={geometry} material={material} position={[0, LAYOUT.seaLevel, 0]} renderOrder={-5} />
}
