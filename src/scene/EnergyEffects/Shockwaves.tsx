import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CylinderGeometry, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three'
import { anchors } from '../../choreography/anchors'
import { visualEvents } from '../../choreography/events'
import { stage } from '../../choreography/stage'
import { useDisposable } from '../../utils/dispose'
import { WAVE_COUNT, clearWaves, spawnWave, waveAge, waves } from './waves'

const RINGS = 3

interface VRing {
  age: number
  strength: number
  active: boolean
}

export function Shockwaves() {
  const clock = useRef(0)
  const ground = useMemo(() => {
    const g = new PlaneGeometry(7, 7, 1, 1) // the island top only; the sea carries ripples beyond
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const groundMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uWaves: { value: Array.from({ length: WAVE_COUNT }, () => new Vector4()) } },
        vertexShader: /* glsl */ `
          varying vec3 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec4 uWaves[${WAVE_COUNT}];
          varying vec3 vW;
          void main() {
            vec3 col = vec3(0.0);
            for (int i = 0; i < ${WAVE_COUNT}; i++) {
              vec4 w = uWaves[i];
              if (w.w <= 0.0) continue;
              float r = length(vW.xz - w.xy);
              float width = 0.12 + w.z * 0.035;
              float k = (r - w.z) / width;
              float front = exp(-k * k);
              // A thin, travelling edge — no filled disc behind it.
              col += vec3(0.55, 0.75, 1.0) * front * w.w;
              col += vec3(1.0) * pow(front, 6.0) * w.w * 0.45;
            }
            // Circular mask: the plane only lights the island's crown.
            col *= smoothstep(3.2, 2.2, length(vW.xz));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  )

  // Expanding walls of light: read clearly even from a low camera, where a flat ring would collapse to a line.
  const wallGeo = useMemo(() => {
    const g = new CylinderGeometry(1, 1, 1, 128, 1, true)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  const wallMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uI: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vH;
          varying vec3 vN;
          varying vec3 vW;
          void main() {
            vH = uv.y;
            vN = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uI;
          varying float vH;
          varying vec3 vN;
          varying vec3 vW;
          void main() {
            vec3 V = normalize(cameraPosition - vW);
            // Brightest where the wall is seen edge-on, like a shell of light.
            float edge = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
            float fade = pow(1.0 - vH, 4.0);
            vec3 col = mix(vec3(0.35, 0.55, 1.0), vec3(0.9, 0.95, 1.0), fade * fade);
            gl_FragColor = vec4(col * fade * (0.25 + edge) * uI, 1.0);
          }
        `,
      }),
    [],
  )
  const wallMats = useMemo(() => Array.from({ length: WAVE_COUNT }, () => wallMat.clone()), [wallMat])
  const wallRefs = useRef<(Mesh | null)[]>([])

  const ringGeo = useMemo(() => new PlaneGeometry(1, 1), [])
  const ringMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uR: { value: 0 }, uW: { value: 0.1 }, uI: { value: 0 }, uSize: { value: 1 } },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          uniform float uSize;
          void main() {
            vP = position.xy * uSize;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * uSize;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uR, uW, uI;
          varying vec2 vP;
          void main() {
            float d = length(vP);
            float k = (d - uR) / uW;
            float ring = exp(-k * k);
            float inner = exp(-pow((d - uR * 0.94) / (uW * 0.6), 2.0));
            vec3 col = vec3(0.35, 0.55, 1.0) * ring + vec3(1.0, 0.9, 0.8) * inner * 0.5;
            gl_FragColor = vec4(col * uI, 1.0);
          }
        `,
      }),
    [],
  )
  const ringMats = useMemo(() => Array.from({ length: RINGS }, () => ringMat.clone()), [ringMat])
  const rings = useMemo<VRing[]>(() => Array.from({ length: RINGS }, () => ({ age: 0, strength: 0, active: false })), [])
  const ringRefs = useRef<(Mesh | null)[]>([])
  useDisposable(ground, groundMat, ringGeo, ringMat, ...ringMats, wallGeo, wallMat, ...wallMats)

  useEffect(() => {
    let cursor = 0
    const offs = [
      visualEvents.on('shockwave', ({ strength, x, z, vertical }) => {
        const s = stage.reduced ? strength * 0.6 : strength
        spawnWave(clock.current, s, x ?? 0, z ?? 0)
        if (vertical) {
          const r = rings[cursor]
          cursor = (cursor + 1) % RINGS
          r.age = 0
          r.strength = s
          r.active = true
        }
      }),
      visualEvents.on('reset', () => {
        clearWaves()
        rings.forEach((r) => (r.active = false))
      }),
    ]
    return () => offs.forEach((o) => o())
  }, [rings])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    clock.current = t
    const dt = Math.min(delta, 1 / 20)
    const arr = groundMat.uniforms.uWaves.value as Vector4[]
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i]
      const age = waveAge(w, t)
      const wall = wallRefs.current[i]
      if (age < 0) {
        arr[i].set(0, 0, 0, 0)
        if (wall) wall.visible = false
        continue
      }
      const radius = age * w.speed
      const fade = Math.pow(1 - age / w.life, 1.5)
      arr[i].set(w.x, w.z, radius, w.strength * fade * 0.6)
      if (wall) {
        wall.visible = true
        wall.position.set(w.x, -0.4, w.z)
        // The shell is low near the pedestal and rises as it travels outward.
        wall.scale.set(radius, Math.min(1.6, (0.3 + w.strength * 0.9 * fade) * Math.min(1, radius / 8) + radius * 0.02), radius)
        // Fade before the wall reaches the camera so it never washes over the lens.
        const camDist = Math.hypot(state.camera.position.x - w.x, state.camera.position.z - w.z)
        const nearCam = 1 - Math.min(1, Math.max(0, (radius - camDist * 0.45) / (camDist * 0.4)))
        wallMats[i].uniforms.uI.value = w.strength * fade * nearCam * 0.4 * Math.min(1, radius / 5)
      }
    }
    rings.forEach((r, i) => {
      const mesh = ringRefs.current[i]
      const m = ringMats[i]
      if (!mesh) return
      if (!r.active) {
        mesh.visible = false
        return
      }
      r.age += dt
      const life = 1.1 + r.strength * 0.6
      if (r.age > life) {
        r.active = false
        mesh.visible = false
        return
      }
      const k = r.age / life
      // Sized to frame the dancer and halo, not to fill the screen.
      const radius = (1 - Math.pow(1 - k, 2.2)) * (2.4 + r.strength * 2.6)
      mesh.visible = true
      mesh.position.set(anchors.chest.x, anchors.chest.y, anchors.chest.z + 0.2)
      m.uniforms.uR.value = radius
      m.uniforms.uW.value = 0.05 + radius * 0.05
      m.uniforms.uI.value = r.strength * Math.pow(1 - k, 1.6) * 0.85
      m.uniforms.uSize.value = (radius + m.uniforms.uW.value * 3) * 2 + 0.4
    })
  })

  return (
    <group>
      <mesh geometry={ground} material={groundMat} position={[0, 0.04, 0]} renderOrder={2} />
      {wallMats.map((m, i) => (
        <mesh
          key={`w${i}`}
          ref={(el) => {
            wallRefs.current[i] = el
          }}
          geometry={wallGeo}
          material={m}
          visible={false}
          frustumCulled={false}
          renderOrder={2}
        />
      ))}
      {ringMats.map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el
          }}
          geometry={ringGeo}
          material={m}
          visible={false}
          frustumCulled={false}
          renderOrder={7}
        />
      ))}
    </group>
  )
}
