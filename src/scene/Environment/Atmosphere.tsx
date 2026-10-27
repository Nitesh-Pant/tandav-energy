import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, CylinderGeometry, DoubleSide, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { LAYOUT, PALETTE, QUALITY } from '../../config'
import { stage } from '../../choreography/stage'
import { useUI } from '../../state/store'
import { getNoiseTexture } from '../../utils/noiseTexture'
import { useDisposable } from '../../utils/dispose'

const sharedUniforms = () => ({
  uNoise: { value: getNoiseTexture() },
  uTime: { value: 0 },
  uHalo: { value: 0 },
  uFire: { value: 0 },
  uFlash: { value: 0 },
  uFlashPos: { value: new Vector3() },
  uTurb: { value: 0 },
  uTint: { value: new Color(PALETTE.indigo) },
  uGlow: { value: new Color(PALETTE.electric) },
})

/** Horizontal cloud sea beneath the floating pedestal. */
function cloudMaterial(layer: number) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { ...sharedUniforms(), uLayer: { value: layer } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform float uTime, uHalo, uFire, uFlash, uTurb, uLayer;
      uniform vec3 uFlashPos, uTint, uGlow;
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vec2 p = vW.xz * 0.012;
        float drift = uTime * (0.004 + uTurb * 0.01);
        float n = texture2D(uNoise, p + vec2(drift, uLayer * 0.37)).r;
        n = n * 0.65 + texture2D(uNoise, p * 2.7 - vec2(drift * 1.6, 0.0) + n * 0.25).r * 0.35;
        float dist = length(vW.xz);
        float density = smoothstep(0.42, 0.78, n);
        float edge = smoothstep(260.0, 120.0, dist) * smoothstep(4.0, 12.0, dist);
        // Fade at grazing angles, where a flat layer would smear into streaks.
        float grazing = smoothstep(0.04, 0.22, abs(normalize(vW - cameraPosition).y));
        float a = density * edge * grazing * (0.55 - uLayer * 0.12);
        // Light from the dance above: halo-blue near centre, warm under the fire.
        float centre = exp(-dist / 28.0);
        vec3 col = uTint * (0.18 + n * 0.25);
        col += uGlow * centre * (0.25 + uHalo * 0.9) * n;
        col += vec3(1.0, 0.45, 0.15) * centre * uFire * 0.45 * n;
        float fd = length(vW.xz - uFlashPos.xz);
        col += vec3(0.6, 0.7, 1.0) * uFlash * (0.25 + exp(-fd / 60.0) * 1.4) * n;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Haze band wrapping the horizon between mountain ranges. */
function hazeMaterial(radius: number) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { ...sharedUniforms(), uRadius: { value: radius } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying float vH;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vH = uv.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform float uTime, uHalo, uFlash, uRadius;
      uniform vec3 uFlashPos, uTint, uGlow;
      varying vec3 vW;
      varying float vH;
      void main() {
        float ang = atan(vW.x, -vW.z);
        float n = texture2D(uNoise, vec2(ang * 1.5 + uTime * 0.003, vH * 0.6)).r;
        float a = pow(1.0 - vH, 2.2) * (0.35 + n * 0.5) * smoothstep(1.9, 1.2, abs(ang));
        vec3 col = uTint * 0.55 + uGlow * pow(max(-normalize(vW).z, 0.0), 8.0) * uHalo * 0.25;
        col += vec3(0.5, 0.6, 1.0) * uFlash * 0.3;
        gl_FragColor = vec4(col, a * 0.55);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

export function Atmosphere() {
  const layers = QUALITY[useUI((s) => s.quality)].cloudLayers
  const built = useMemo(() => {
    const plane = new PlaneGeometry(560, 560, 1, 1)
    plane.rotateX(-Math.PI / 2)
    const clouds = Array.from({ length: layers }, (_, i) => ({ material: cloudMaterial(i), y: -2.6 - i * 1.25 }))
    const hazes = [195, 300].map((r) => {
      const g = new CylinderGeometry(r, r, 60, 64, 1, true, Math.PI - 2, 4)
      return { geometry: g, material: hazeMaterial(r) }
    })
    return { plane, clouds, hazes }
  }, [layers])
  useDisposable(
    built.plane,
    ...built.clouds.map((c) => c.material),
    ...built.hazes.map((h) => h.geometry),
    ...built.hazes.map((h) => h.material),
  )

  useFrame((state) => {
    const mats = [...built.clouds.map((c) => c.material), ...built.hazes.map((h) => h.material)]
    for (const m of mats) {
      const u = m.uniforms
      u.uTime.value = state.clock.elapsedTime
      u.uHalo.value = stage.halo
      u.uFire.value = stage.fire
      u.uFlash.value = stage.flash
      u.uFlashPos.value.set(stage.flashX, stage.flashY, stage.flashZ)
      u.uTurb.value = stage.turbulence
    }
  })

  return (
    <group>
      {built.hazes.map((h, i) => (
        <mesh key={`h${i}`} geometry={h.geometry} material={h.material} position={[0, LAYOUT.seaLevel + 22, 0]} renderOrder={-6} />
      ))}
      {built.clouds.map((c, i) => (
        <mesh key={i} geometry={built.plane} material={c.material} position={[0, c.y, 0]} renderOrder={-4 + i} />
      ))}
    </group>
  )
}
