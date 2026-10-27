import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, Color, PlaneGeometry, ShaderMaterial } from 'three'
import { LAYOUT, PALETTE } from '../../config'
import { stage } from '../../choreography/stage'
import { NOISE_GLSL } from '../../utils/glsl'
import { useDisposable } from '../../utils/dispose'

/**
 * The celestial orb behind the figure — the backlight that defines the
 * silhouette. A camera-facing billboard: bright core, corona, slow rays.
 */
export function Halo() {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uCore: { value: new Color(PALETTE.silver) },
          uGlow: { value: new Color(PALETTE.electric) },
          uDeep: { value: new Color(PALETTE.indigo) },
          uFire: { value: 0 },
          uClimax: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
            mv.xy += position.xy * scale;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uIntensity, uFire, uClimax;
          uniform vec3 uCore, uGlow, uDeep;
          varying vec2 vUv;
          ${NOISE_GLSL}
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float a = atan(p.y, p.x);
            float I = uIntensity;
            // Disc with a soft limb; grows slightly with intensity.
            float discR = 0.16 + 0.04 * I;
            float disc = smoothstep(discR, discR * 0.55, r);
            float corona = exp(-max(r - discR * 0.6, 0.0) * 9.0);
            float wide = exp(-r * 3.4);
            float rays = vnoise2(vec2(a * 5.0 + 3.0, uTime * 0.15)) * vnoise2(vec2(a * 13.0, -uTime * 0.11));
            rays = pow(rays, 1.5) * exp(-r * 4.5) * smoothstep(discR * 0.8, discR * 1.6, r);

            vec3 col = uCore * disc * (0.75 + I * 0.6);
            col += mix(uGlow, uCore, 0.25) * corona * (0.32 + I * 0.4);
            col += uGlow * rays * 1.3 * I;
            col += uDeep * wide * (0.7 + I * 0.6);
            col += vec3(1.0, 0.5, 0.18) * corona * uFire * 0.25;
            col += vec3(1.0, 0.97, 0.92) * exp(-r * 3.2) * uClimax * 0.8;
            float edge = 1.0 - smoothstep(0.7, 1.0, r);
            gl_FragColor = vec4(col * I * edge, 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(geometry, material)

  // Shafts of light fanning out behind the figure. Drawn behind it, so the
  // silhouette, locks and arms stay crisp and dark against the burst.
  const fanMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uSpin: { value: 0 }, uColor: { value: new Color(PALETTE.electric) } },
        vertexShader: material.vertexShader,
        fragmentShader: /* glsl */ `
          uniform float uTime, uI, uSpin;
          uniform vec3 uColor;
          varying vec2 vUv;
          ${NOISE_GLSL}
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float a = atan(p.y, p.x) + uSpin;
            // Two layers of angular noise make uneven, slowly turning shafts.
            float s1 = vnoise2(vec2(a * 9.0, uTime * 0.05));
            float s2 = vnoise2(vec2(a * 23.0 + 4.0, -uTime * 0.08));
            float shafts = pow(s1, 3.0) * 0.8 + pow(s2, 5.0) * 0.6;
            float fall = exp(-r * 4.5) * smoothstep(0.04, 0.12, r) * (1.0 - smoothstep(0.5, 0.9, r));
            gl_FragColor = vec4(mix(uColor, vec3(0.9, 0.95, 1.0), 0.35) * shafts * fall * uI, 1.0);
          }
        `,
      }),
    [material],
  )
  useDisposable(fanMaterial)

  useFrame((state) => {
    const f = fanMaterial.uniforms
    f.uTime.value = state.clock.elapsedTime
    f.uI.value = (stage.halo * 0.12 + stage.energy * 0.14 + stage.climax * 0.6 + stage.motif.radiance * 0.15) * (0.85 + stage.bass * 0.15 * stage.energy)
    f.uSpin.value = stage.swirlPhase * 0.03
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uIntensity.value = stage.halo + stage.climax * 0.35
    u.uFire.value = stage.fire
    u.uClimax.value = stage.climax
  })

  const [x, y, z] = LAYOUT.haloCenter
  return (
    <group>
      <mesh geometry={geometry} material={fanMaterial} position={[x, y + 0.25, z - 0.6]} scale={[30, 30, 1]} renderOrder={-2} />
      <mesh geometry={geometry} material={material} position={[x, y + 0.25, z - 0.4]} scale={[12, 12, 1]} renderOrder={-1} />
    </group>
  )
}
