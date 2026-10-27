import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  CylinderGeometry,
  InstancedMesh,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { stage } from '../../choreography/stage'
import { fbm1 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'
import { NOISE_GLSL } from '../../utils/glsl'

export const ISLAND_RADIUS = 3.2

/**
 * Floating rock built as a lathe (concentric rings everywhere, so it displaces
 * cleanly): a flat centre for the pedestal, crags rising toward the rim, then
 * broken strata tapering to a point far below.
 */
function islandGeometry() {
  const R = ISLAND_RADIUS
  const profile: [number, number][] = [
    [0.001, 0],
    [0.8, 0],
    [1.5, 0.0],
    [2.0, 0.05],
    [2.5, 0.18],
    [2.85, 0.3],
    [R, 0.12],
    [R * 1.02, -0.3],
    [R * 0.96, -1.0],
    [R * 0.82, -1.9],
    [R * 0.62, -3.0],
    [R * 0.42, -4.2],
    [R * 0.24, -5.4],
    [R * 0.1, -6.5],
    [0.001, -7.4],
  ]
  // Lathe normals face outward only when the profile runs bottom → top.
  const g = new LatheGeometry(
    profile.reverse().map(([r, y]) => new Vector2(r, y)),
    128,
  )
  const pos = g.attributes.position
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const a = Math.atan2(v.z, v.x)
    const r = Math.hypot(v.x, v.z)
    if (r < 1e-3) continue
    if (v.y > -0.05 && r < 3) {
      // Crags on the crown, growing toward the rim; the centre stays flat.
      const rim = Math.max(0, (r - 1.6) / (R - 1.6))
      v.y += rim * rim * (0.15 + Math.max(0, fbm1(a * 5, 4, 3)) * 0.55)
    }
    const depth = Math.max(0, -v.y / 7.4)
    const n = 1 + fbm1(a * 5 + depth * 6, 5, 4) * 0.35 * (0.3 + depth) + fbm1(a * 19 + depth * 25, 9) * 0.08
    const k = r > 1.5 || v.y < -0.1 ? n : 1
    v.x *= k
    v.z *= k
    v.y += fbm1(a * 7 + depth * 4, 13) * 0.7 * depth
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export function Pedestal() {
  const island = useMemo(islandGeometry, [])
  const dais = useMemo(() => new CylinderGeometry(1.05, 1.18, 0.12, 40), [])
  const top = useMemo(() => new CylinderGeometry(0.62, 0.72, 0.08, 32), [])
  const petal = useMemo(() => {
    // A cupped, pointed lotus petal: a half-ellipsoid pinched to a tip along +Z.
    const g = new SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    const pos = g.attributes.position
    const v = new Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const along = (v.z + 1) / 2 // 0 at the base … 1 at the tip
      v.x *= 1 - Math.pow(along, 2.6) * 0.6
      v.y *= (1 - along * 0.5) * 0.4
      v.y += Math.pow(along, 2) * 0.15 // tip curls gently upward
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    g.scale(0.12, 0.18, 0.2)
    g.translate(0, 0, 0.17)
    return g
  }, [])
  const cracks = useMemo(() => ({ uFire: { value: 0 }, uSpread: { value: 0 }, uPulse: { value: 0 }, uTime: { value: 0 } }), [])
  const rock = useMemo(() => {
    const mat = new MeshStandardMaterial({ color: '#0a0c18', roughness: 0.95, metalness: 0.0, flatShading: true })
    // Lava veins: thin isolines of 3D noise, igniting outward from the dancer's
    // feet as the fire grows, pulsing with the bass. Injected into the standard
    // material so the rock keeps its lighting.
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, cracks)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRockP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vRockP;
          uniform float uFire, uSpread, uPulse, uTime;
          ${NOISE_GLSL}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            vec3 p = vRockP;
            float n1 = vnoise3(p * 1.4 + vec3(0.0, uTime * 0.02, 0.0));
            float n2 = vnoise3(p * 3.7 + 11.0);
            // Thin primary fissures; finer secondary cracks only where they branch near them.
            float vein = 1.0 - smoothstep(0.0, 0.018, abs(n1 - 0.5));
            float near = 1.0 - smoothstep(0.0, 0.12, abs(n1 - 0.5));
            vein = max(vein, (1.0 - smoothstep(0.0, 0.012, abs(n2 - 0.5))) * near * 0.7);
            vein *= 0.75 + 0.25 * sin(uTime * 3.0 + n2 * 20.0);
            float reach = smoothstep(uSpread, uSpread - 1.2, length(p.xz));
            float depth = smoothstep(-3.0, 0.1, p.y);
            float heat = vein * reach * depth * uFire;
            vec3 lava = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.62, 0.22), vein * (0.5 + uPulse * 0.5));
            totalEmissiveRadiance += lava * heat * (1.4 + uPulse * 2.2);
          }`,
        )
    }
    return mat
  }, [cracks])
  const bronze = useMemo(
    () => new MeshStandardMaterial({ color: '#2a2218', roughness: 0.38, metalness: 0.9, emissive: '#000000' }),
    [],
  )
  useDisposable(island, dais, top, petal, rock, bronze)

  const petals = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = petals.current
    if (!mesh) return
    const o = new Object3D()
    // Padma pitha: an outer row of petals falling away, an inner row rising.
    const rows = [
      { n: 22, r: 0.86, y: 0.1, tilt: 0.7, s: 1.05 },
      { n: 22, r: 0.74, y: 0.2, tilt: 0.25, s: 0.85, offset: 0.5 },
      { n: 22, r: 0.62, y: 0.27, tilt: -0.15, s: 0.65 },
    ]
    let i = 0
    for (const row of rows) {
      for (let k = 0; k < row.n; k++) {
        const a = ((k + (row.offset ?? 0)) / row.n) * Math.PI * 2
        o.position.set(Math.cos(a) * row.r, row.y, Math.sin(a) * row.r)
        // Point each petal outward (+Z → radial), then tilt it down or up.
        o.rotation.set(0, Math.PI / 2 - a, 0)
        o.rotateX(row.tilt)
        o.scale.setScalar(row.s)
        o.updateMatrix()
        mesh.setMatrixAt(i++, o.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame((state, delta) => {
    // Fire and the halo warm the bronze from within during the dance.
    bronze.emissive.setRGB(0.05 * stage.fire, 0.014 * stage.fire, 0.002 * stage.fire)
    cracks.uTime.value = state.clock.elapsedTime
    cracks.uFire.value = Math.max(0, stage.fire - 0.82) * 2.2
    // The veins spread from the pedestal toward the rim as the Tandav intensifies.
    const target = 0.8 + Math.max(0, stage.fire - 0.82) * 10
    cracks.uSpread.value += (target - cracks.uSpread.value) * (1 - Math.exp(-Math.min(delta, 0.05) * 0.8))
    cracks.uPulse.value = stage.bass * stage.energy + stage.climax
  })

  return (
    <group>
      <mesh geometry={island} material={rock} />
      <mesh geometry={dais} material={bronze} position={[0, 0.06, 0]} />
      <instancedMesh ref={petals} args={[petal, bronze, 66]} />
      <mesh geometry={top} material={bronze} position={[0, 0.3, 0]} />
    </group>
  )
}
