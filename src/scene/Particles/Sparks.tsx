import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, ShaderMaterial } from 'three'
import { QUALITY } from '../../config'
import { visualEvents } from '../../choreography/events'
import { useUI } from '../../state/store'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'

/**
 * Short-lived spark bursts (stamps, high-frequency accents, the trident).
 * A fixed CPU pool updated in place — no allocation per burst.
 */
export function Sparks() {
  const count = QUALITY[useUI((s) => s.quality)].sparks
  const sim = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const life = new Float32Array(count) // remaining life, seconds
    const meta = new Float32Array(count * 2) // max life, heat
    const g = new BufferGeometry()
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage)
    const metaAttr = new BufferAttribute(new Float32Array(count * 2), 2).setUsage(DynamicDrawUsage)
    g.setAttribute('position', posAttr)
    g.setAttribute('aMeta', metaAttr)
    return { pos, vel, life, meta, g, posAttr, metaAttr, cursor: 0, rand: mulberry32(3) }
  }, [count])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uPixel: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec2 aMeta; // x: life fraction remaining, y: heat
          uniform float uPixel;
          varying vec2 vMeta;
          void main() {
            vMeta = aMeta;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aMeta.x * (2.0 + aMeta.y * 2.0) * uPixel * 22.0 / max(-mv.z, 0.5);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vMeta;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            vec3 hot = mix(vec3(1.0, 0.5, 0.15), vec3(0.85, 0.92, 1.0), vMeta.y);
            gl_FragColor = vec4(hot * a * vMeta.x * 2.0, 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(sim.g, material)

  useEffect(() => {
    const off = visualEvents.on('sparks', ({ strength, x, y, z }) => {
      const n = Math.floor(10 + strength * 40)
      const r = sim.rand
      for (let k = 0; k < n; k++) {
        const i = sim.cursor
        sim.cursor = (sim.cursor + 1) % count
        sim.pos[i * 3] = x
        sim.pos[i * 3 + 1] = y
        sim.pos[i * 3 + 2] = z
        const theta = r() * Math.PI * 2
        const phi = Math.acos(r() * 2 - 1)
        const sp = (1.5 + r() * 4) * (0.5 + strength)
        sim.vel[i * 3] = Math.sin(phi) * Math.cos(theta) * sp
        sim.vel[i * 3 + 1] = Math.abs(Math.cos(phi)) * sp * 0.8 + 1
        sim.vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * sp
        const l = 0.4 + r() * 0.8
        sim.life[i] = l
        sim.meta[i * 2] = l
        sim.meta[i * 2 + 1] = r() < 0.35 ? 1 : 0
      }
    })
    const offReset = visualEvents.on('reset', () => sim.life.fill(0))
    return () => {
      off()
      offReset()
    }
  }, [sim, count])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const meta = sim.metaAttr.array as Float32Array
    const drag = Math.exp(-dt * 2.2)
    for (let i = 0; i < count; i++) {
      if (sim.life[i] <= 0) {
        meta[i * 2] = 0
        continue
      }
      sim.life[i] -= dt
      const o = i * 3
      sim.vel[o] *= drag
      sim.vel[o + 1] = sim.vel[o + 1] * drag - 3.5 * dt
      sim.vel[o + 2] *= drag
      sim.pos[o] += sim.vel[o] * dt
      sim.pos[o + 1] += sim.vel[o + 1] * dt
      sim.pos[o + 2] += sim.vel[o + 2] * dt
      meta[i * 2] = Math.max(0, sim.life[i] / sim.meta[i * 2])
      meta[i * 2 + 1] = sim.meta[i * 2 + 1]
    }
    sim.posAttr.needsUpdate = true
    sim.metaAttr.needsUpdate = true
    material.uniforms.uPixel.value = state.gl.getPixelRatio()
  })

  return <points geometry={sim.g} material={material} frustumCulled={false} renderOrder={5} />
}
