import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { stage } from '../../choreography/stage'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'

const POOL = 3

interface Meteor {
  active: boolean
  age: number
  life: number
  from: Vector3
  dir: Vector3
  speed: number
}

/** Occasional shooting stars across the quiet acts: the void, the awakening, the stillness. */
export function Meteors() {
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const base = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uI: { value: 0 }, uHead: { value: new Vector3() }, uTail: { value: new Vector3() }, uWidth: { value: 1.2 } },
        // The quad is laid between tail and head in view space, facing the camera.
        vertexShader: /* glsl */ `
          uniform vec3 uHead, uTail;
          uniform float uWidth;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 h = viewMatrix * vec4(uHead, 1.0);
            vec4 t = viewMatrix * vec4(uTail, 1.0);
            vec4 p = mix(t, h, uv.x);
            vec2 d = normalize(h.xy / -h.z - t.xy / -t.z + 1e-6);
            p.xy += vec2(-d.y, d.x) * (uv.y - 0.5) * uWidth;
            gl_Position = projectionMatrix * p;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uI;
          varying vec2 vUv;
          void main() {
            float across = exp(-pow((vUv.y - 0.5) * 7.0, 2.0));
            float along = pow(vUv.x, 3.0); // bright head at x = 1, fading tail
            gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * across * along * uI, 1.0);
          }
        `,
      }),
    [],
  )
  const mats = useMemo(() => Array.from({ length: POOL }, () => base.clone()), [base])
  useDisposable(geometry, base, ...mats)
  const meteors = useMemo<Meteor[]>(
    () => Array.from({ length: POOL }, () => ({ active: false, age: 0, life: 1, from: new Vector3(), dir: new Vector3(), speed: 0 })),
    [],
  )
  const refs = useRef<(Mesh | null)[]>([])
  const state = useMemo(() => ({ next: 4, rand: mulberry32(9) }), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const quiet = !stage.running || stage.act <= 1 || stage.act === 4
    state.next -= dt
    if (quiet && state.next <= 0) {
      state.next = 5 + state.rand() * 9
      const m = meteors.find((x) => !x.active)
      if (m) {
        const r = state.rand
        const ang = (r() - 0.5) * 2.2
        m.from.set(Math.sin(ang) * 600, 160 + r() * 200, -Math.cos(ang) * 600)
        m.dir.set(r() - 0.5, -0.35 - r() * 0.3, (r() - 0.5) * 0.4).normalize()
        m.speed = 260 + r() * 200
        m.life = 0.7 + r() * 0.6
        m.age = 0
        m.active = true
      }
    }
    meteors.forEach((m, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      if (!m.active) {
        mesh.visible = false
        return
      }
      m.age += dt
      if (m.age > m.life) {
        m.active = false
        mesh.visible = false
        return
      }
      const k = m.age / m.life
      const length = 40 + k * 70
      mesh.visible = true
      const u = mats[i].uniforms
      u.uHead.value.copy(m.from).addScaledVector(m.dir, m.speed * m.age)
      u.uTail.value.copy(u.uHead.value).addScaledVector(m.dir, -length)
      u.uI.value = Math.sin(Math.PI * k) * (0.9 - stage.energy)
    })
  })

  return (
    <group>
      {mats.map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          geometry={geometry}
          material={m}
          visible={false}
          frustumCulled={false}
          renderOrder={-8}
        />
      ))}
    </group>
  )
}
