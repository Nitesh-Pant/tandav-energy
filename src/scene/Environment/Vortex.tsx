import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, CircleGeometry, Color, DoubleSide, ShaderMaterial } from 'three'
import { PALETTE } from '../../config'
import { stage } from '../../choreography/stage'
import { getNoiseTexture } from '../../utils/noiseTexture'
import { useDisposable } from '../../utils/dispose'

/**
 * A vast spiral of cloud high above the dance. Its rotation is integrated from
 * the stage swirl, so the heavens literally turn faster as the Tandav builds;
 * lightning lights it from within.
 */
export function Vortex() {
  const geometry = useMemo(() => {
    const g = new CircleGeometry(420, 96)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: {
          uNoise: { value: getNoiseTexture() },
          uPhase: { value: 0 },
          uI: { value: 0 },
          uFlash: { value: 0 },
          uFire: { value: 0 },
          uStorm: { value: 0 },
          uCool: { value: new Color(PALETTE.indigo) },
          uGlow: { value: new Color(PALETTE.electric) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          varying vec3 vW;
          void main() {
            vP = position.xz;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uNoise;
          uniform float uPhase, uI, uFlash, uFire, uStorm;
          uniform vec3 uCool, uGlow;
          varying vec2 vP;
          varying vec3 vW;
          void main() {
            float r = length(vP);
            // Seen nearly edge-on the disc would leave a hard line in the sky; fade it there.
            float upward = smoothstep(0.1, 0.35, normalize(vW - cameraPosition).y);
            float a = atan(vP.y, vP.x);
            // Logarithmic spiral arms: angle advances with log radius.
            float spiral = a + log(r + 1.0) * 1.6 - uPhase;
            vec2 uv = vec2(spiral / 6.2831 * 3.0, log(r + 1.0) * 0.55 - uPhase * 0.05);
            float n = texture2D(uNoise, uv).r * 0.65 + texture2D(uNoise, uv * 2.3 + 0.37).r * 0.35;
            float arms = smoothstep(0.42, 0.78, n);
            float ring = smoothstep(20.0, 90.0, r) * (1.0 - smoothstep(260.0, 420.0, r));
            vec3 col = mix(uCool, uGlow, smoothstep(0.6, 0.95, n)) * arms * ring;
            col += vec3(1.0, 0.45, 0.15) * arms * ring * uFire * 0.12 * smoothstep(140.0, 40.0, r);
            col += vec3(0.6, 0.7, 1.0) * arms * ring * uFlash * 1.2;
            gl_FragColor = vec4(col * upward * (uI + uStorm * 0.25), 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(geometry, material)

  useFrame(() => {
    const u = material.uniforms
    u.uPhase.value = stage.swirlPhase * 0.35
    u.uI.value = 0.03 + stage.energy * 0.14 + stage.climax * 0.2
    u.uFlash.value = stage.flash
    u.uFire.value = stage.fire
    u.uStorm.value = stage.motif.storm
  })

  return <mesh geometry={geometry} material={material} position={[0, 70, -60]} renderOrder={-7} frustumCulled={false} />
}
