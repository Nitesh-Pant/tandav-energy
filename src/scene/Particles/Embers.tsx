import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector3 } from 'three'
import { LAYOUT, QUALITY } from '../../config'
import { anchors } from '../../choreography/anchors'
import { visualEvents } from '../../choreography/events'
import { stage } from '../../choreography/stage'
import { useUI } from '../../state/store'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'

/**
 * Embers shed by the ring of fire and the flame in his hand, rising and
 * cooling; big hits throw them outward. Entirely shader-animated.
 */
export function Embers() {
  const count = QUALITY[useUI((s) => s.quality)].embers
  const geometry = useMemo(() => {
    const rand = mulberry32(77)
    const seed = new Float32Array(count * 4) // angle, offset, speed, rank
    for (let i = 0; i < count; i++) {
      // Most embers come off the ring; some from the flame in his hand, a few from the pedestal.
      const from = rand()
      const angle = from < 0.76 ? (rand() * 2 - 1) * Math.PI * 0.92 : from < 0.9 ? 20 + rand() : 10 + rand()
      seed.set([angle, rand(), 0.12 + rand() * 0.25, rand()], i * 4)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 4))
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
          uFire: { value: 0 },
          uTurb: { value: 0 },
          uPixel: { value: 1 },
          uR: { value: LAYOUT.ringRadius },
          uCenter: { value: new Vector3(...LAYOUT.haloCenter) },
          uHand: { value: new Vector3() },
          uBurst: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute vec4 aSeed;
          uniform float uTime, uFire, uTurb, uPixel, uR, uBurst;
          uniform vec3 uCenter, uHand;
          varying float vLife;
          varying float vOn;
          varying float vBurst;
          void main() {
            float life = fract(uTime * aSeed.z + aSeed.y);
            vec3 origin;
            bool hand = aSeed.x > 15.0;
            if (aSeed.x < 5.0) {
              float a = aSeed.x; // 0 = bottom of the ring
              origin = uCenter + vec3(sin(a), -cos(a), 0.0) * (uR + 0.15);
            } else if (hand) {
              float a = fract(aSeed.x) * 6.2831;
              origin = uHand + vec3(cos(a), 0.0, sin(a)) * 0.08;
            } else {
              float a = fract(aSeed.x) * 6.2831;
              origin = vec3(cos(a) * 1.1, 0.3, sin(a) * 1.1);
            }
            float sway = sin(life * 9.0 + aSeed.y * 30.0) * 0.25 + sin(life * 3.0 + aSeed.y * 11.0) * 0.4;
            vec3 p = origin + vec3(sway * (0.4 + uTurb), life * (2.5 + uTurb * 3.0), cos(aSeed.y * 40.0) * life * 0.8);
            // Embers pushed outward from the ring; the hand's flame sheds a narrow, short plume.
            if (hand) p = origin + vec3(sway * 0.15, life * 1.2, 0.0);
            else p.xy += normalize(origin.xy - uCenter.xy + 1e-3) * life * (0.9 + uBurst * 1.4);
            float burst = hand ? 0.0 : uBurst;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            vOn = step(aSeed.w, uFire * 0.85);
            vLife = life;
            vBurst = burst;
            gl_PointSize = (1.0 - life * 0.7) * (0.6 + pow(aSeed.w, 3.0) * 2.4) * (1.0 + burst * 0.6) * (hand ? 0.6 : 1.0) * uPixel * 26.0 / max(-mv.z, 0.5);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vLife;
          varying float vOn;
          varying float vBurst;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.05, d);
            vec3 col = mix(vec3(1.0, 0.75, 0.35), vec3(0.8, 0.15, 0.02), smoothstep(0.0, 0.7, vLife));
            float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
            gl_FragColor = vec4(col * a * fade * vOn * (1.2 + vBurst), 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(geometry, material)

  useEffect(() => {
    const kick = (strength: number) => {
      material.uniforms.uBurst.value = Math.max(material.uniforms.uBurst.value, Math.min(1, strength))
    }
    const offs = [visualEvents.on('stamp', ({ strength }) => kick(strength)), visualEvents.on('climax', () => kick(1))]
    return () => offs.forEach((o) => o())
  }, [material])

  useFrame((state, delta) => {
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uHand.value.set(anchors.fireHand.x, anchors.fireHand.y - 0.1, anchors.fireHand.z)
    u.uBurst.value *= Math.exp(-Math.min(delta, 0.05) * 2.2)
    u.uFire.value = stage.fire
    u.uTurb.value = stage.turbulence
    u.uPixel.value = state.gl.getPixelRatio()
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />
}
