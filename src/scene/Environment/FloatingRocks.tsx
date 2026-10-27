import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { QUALITY } from '../../config'
import { stage } from '../../choreography/stage'
import { useUI } from '../../state/store'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'
import { waveAge, waves } from '../EnergyEffects/waves'

interface Rock {
  angle: number
  radius: number
  y: number
  size: number
  speed: number
  spinAxis: Vector3
  spin: number
  push: number
  pushV: number
  lift: number
  seen: number
}

/** Fragments of the world drifting around the dance; shockwaves shove them outward. */
export function FloatingRocks() {
  const count = QUALITY[useUI((s) => s.quality)].rocks
  const geometry = useMemo(() => {
    const g = new IcosahedronGeometry(1, 1)
    const pos = g.attributes.position
    const v = new Vector3()
    const rand = mulberry32(5)
    // Fracture the sphere into a rough shard, shared by all instances (non-uniform scale adds variety).
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const k = 0.7 + Math.abs(Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3)) * 0.5 + rand() * 0.05
      v.multiplyScalar(k)
      v.y *= 0.7
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#141830', roughness: 0.85, metalness: 0.1, flatShading: true }),
    [],
  )
  useDisposable(geometry, material)

  const rocks = useMemo<Rock[]>(() => {
    const rand = mulberry32(99)
    return Array.from({ length: count }, (_, i) => {
      const near = i < count * 0.3
      const radius = near ? 5 + rand() * 6 : 11 + rand() * 30
      // Anything that can orbit between camera and figure stays above or below the figure band.
      const y = radius < 26 ? (rand() < 0.55 ? -6 + rand() * 4.5 : 5.4 + rand() * 5) : -5 + rand() * 14
      return {
        angle: rand() * Math.PI * 2,
        radius,
        y,
        size: near ? 0.06 + rand() * 0.16 : 0.18 + Math.pow(rand(), 3) * 1.1,
        speed: (0.4 + rand() * 0.6) * (rand() < 0.5 ? 1 : 0.8),
        spinAxis: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        spin: rand() * 6,
        push: 0,
        pushV: 0,
        lift: rand() * 10,
        seen: -1,
      }
    })
  }, [count])

  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 1 / 20)
    const t = state.clock.elapsedTime
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i]
      // Orbit speed follows the swirl of the dance; inner rocks orbit faster.
      r.angle += (stage.swirl * 0.35 * r.speed * 6) / (r.radius + 4) * dt * 6
      const x0 = Math.cos(r.angle) * r.radius
      const z0 = Math.sin(r.angle) * r.radius
      for (let k = 0; k < waves.length; k++) {
        const w = waves[k]
        const age = waveAge(w, t)
        if (age < 0) continue
        const front = age * w.speed
        const d = Math.hypot(x0 - w.x, z0 - w.z)
        // One impulse per wave when its front passes this rock.
        if (front > d && r.seen !== k + w.start) {
          r.seen = k + w.start
          r.pushV += (w.strength * 6) / (1 + d * 0.08) / (0.6 + r.size)
        }
      }
      r.pushV += (-r.push * 3 - r.pushV * 1.6) * dt
      r.push += r.pushV * dt
      r.spin += dt * (0.2 + Math.abs(r.pushV) * 0.6)
      const radial = 1 + r.push / Math.max(r.radius, 1)
      const bob = Math.sin(t * 0.3 + r.lift) * 0.4 + stage.turbulence * Math.sin(t * 1.3 + r.lift) * 0.3
      dummy.position.set(x0 * radial, r.y + bob, z0 * radial)
      dummy.quaternion.setFromAxisAngle(r.spinAxis, r.spin)
      dummy.scale.set(r.size * 1.2, r.size, r.size * 0.9)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
}
