import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector2 } from 'three'
import { QUALITY } from '../../config'
import { stage } from '../../choreography/stage'
import { useUI } from '../../state/store'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'
import { NOISE_GLSL } from '../../utils/glsl'

/**
 * Cosmic dust orbiting the dance. All motion is computed in the vertex
 * shader from per-particle seeds; the CPU only feeds a handful of uniforms.
 * Density, swirl and turbulence follow the stage; the pointer parts the dust.
 */
export function CosmicDust() {
  const count = QUALITY[useUI((s) => s.quality)].dust
  const geometry = useMemo(() => {
    const rand = mulberry32(2024)
    const orbit = new Float32Array(count * 4) // radius, angle, height, speed
    const look = new Float32Array(count * 3) // size, hue, rank
    for (let i = 0; i < count; i++) {
      // Denser near the figure, thinning into the void.
      const radius = 1.5 + Math.pow(rand(), 1.6) * 38
      orbit.set([radius, rand() * Math.PI * 2, -5 + Math.pow(rand(), 0.8) * 16 * (0.5 + radius / 40), 0.4 + rand() * 1.2], i * 4)
      look.set([0.4 + Math.pow(rand(), 3) * 2.6, rand(), rand()], i * 3)
    }
    const g = new BufferGeometry()
    // Position is unused (computed in the shader) but three needs it for draw range.
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aOrbit', new BufferAttribute(orbit, 4))
    g.setAttribute('aLook', new BufferAttribute(look, 3))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: 0 },
          uDensity: { value: 0.2 },
          uTurb: { value: 0 },
          uFire: { value: 0 },
          uHigh: { value: 0 },
          uFlash: { value: 0 },
          uPixel: { value: 1 },
          uPointer: { value: new Vector2() },
          uPointerOn: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute vec4 aOrbit;
          attribute vec3 aLook;
          uniform float uTime, uPhase, uDensity, uTurb, uPixel, uPointerOn, uHigh;
          uniform vec2 uPointer;
          varying float vAlpha;
          varying float vHue;
          varying float vWarm;
          ${NOISE_GLSL}
          void main() {
            float r = aOrbit.x;
            // Inner dust orbits faster (Keplerian-ish), giving a vortex around the figure.
            float ang = aOrbit.y + uPhase * aOrbit.w * 3.0 / sqrt(r);
            float y = aOrbit.z + sin(uTime * 0.2 * aOrbit.w + aOrbit.y * 7.0) * 0.4;
            vec3 p = vec3(cos(ang) * r, y, sin(ang) * r);
            // Turbulence: noise displacement that grows with the dance.
            float t = uTime * 0.25;
            p += (vec3(vnoise2(p.xz * 0.15 + t), vnoise2(p.zy * 0.15 - t), vnoise2(p.xy * 0.15 + t * 1.3)) - 0.5) * (0.5 + uTurb * 3.0);

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vec4 clip = projectionMatrix * mv;
            // Pointer parts the dust in screen space.
            vec2 ndc = clip.xy / clip.w;
            vec2 away = ndc - uPointer;
            float push = exp(-dot(away, away) * 18.0) * uPointerOn;
            clip.xy += normalize(away + 1e-4) * push * 0.08 * clip.w;
            gl_Position = clip;

            float visible = step(aLook.z, uDensity);
            float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + aLook.y * 3.0) + aLook.y * 50.0);
            vAlpha = visible * twinkle * smoothstep(80.0, 6.0, -mv.z) * smoothstep(0.4, 2.0, -mv.z);
            vHue = aLook.y;
            vWarm = smoothstep(4.5, 1.5, r) ;
            gl_PointSize = aLook.x * (1.0 + uHigh * 0.6) * uPixel * 26.0 / max(-mv.z, 0.5);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uFire, uFlash;
          varying float vAlpha;
          varying float vHue;
          varying float vWarm;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            a *= a;
            vec3 cool = mix(vec3(0.45, 0.6, 1.0), vec3(0.85, 0.9, 1.0), vHue);
            vec3 warm = vec3(1.0, 0.55, 0.2);
            vec3 col = mix(cool, warm, clamp(vWarm * uFire + step(0.93, vHue) * uFire * 0.6, 0.0, 1.0));
            col *= 0.55 + uFlash * 0.8;
            gl_FragColor = vec4(col * a * vAlpha, 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(geometry, material)

  useFrame((state) => {
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uPhase.value = stage.swirlPhase
    u.uDensity.value = stage.dust
    u.uTurb.value = stage.turbulence
    u.uFire.value = stage.fire
    u.uHigh.value = stage.high * stage.energy
    u.uFlash.value = stage.flash
    u.uPixel.value = state.gl.getPixelRatio()
    u.uPointer.value.set(stage.pointerX, stage.pointerY)
    u.uPointerOn.value = stage.pointerActive
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
}
