import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  AdditiveBlending,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Shape,
  type BufferGeometry,
} from 'three'
import { LAYOUT } from '../../config'
import { anchors } from '../../choreography/anchors'
import { stage } from '../../choreography/stage'
import { useDisposable } from '../../utils/dispose'
import { damaruGeometry } from '../Shiva/geometry'
import { ISLAND_RADIUS } from './Pedestal'

const HEIGHT = 4.1
const HEAD_SCALE = 1.05

function bladeShapes(): Shape[] {
  // Central spear: a long leaf blade.
  const c = new Shape()
  c.moveTo(-0.06, 0)
  c.bezierCurveTo(-0.16, 0.2, -0.14, 0.5, 0, 1.05)
  c.bezierCurveTo(0.14, 0.5, 0.16, 0.2, 0.06, 0)
  c.closePath()
  // Side prongs: crescents sweeping out and up.
  const side = (s: number) => {
    const p = new Shape()
    p.moveTo(s * 0.1, -0.02)
    p.bezierCurveTo(s * 0.5, 0.0, s * 0.52, 0.32, s * 0.38, 0.78)
    p.bezierCurveTo(s * 0.36, 0.42, s * 0.3, 0.18, s * 0.1, 0.12)
    p.closePath()
    return p
  }
  // Collar.
  const k = new Shape()
  k.moveTo(-0.18, -0.12)
  k.lineTo(0.18, -0.12)
  k.lineTo(0.13, 0.03)
  k.lineTo(-0.13, 0.03)
  k.closePath()
  return [c, side(-1), side(1), k]
}

export function Trident() {
  const parts = useMemo(() => {
    const blades = new ExtrudeGeometry(bladeShapes(), {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 16,
    })
    blades.translate(0, 0, -0.015)
    const shaft = new CylinderGeometry(0.03, 0.04, HEIGHT, 10)
    shaft.translate(0, HEIGHT / 2, 0)
    const knot = new CylinderGeometry(0.055, 0.055, 0.07, 12)
    return { blades, shaft, knot, damaru: damaruGeometry(), flare: new PlaneGeometry(1, 1) }
  }, [])
  const metal = useMemo(
    () =>
      new MeshStandardMaterial({ color: '#9aa4bf', metalness: 1, roughness: 0.22, emissive: '#000000' }),
    [],
  )
  const flareMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uI: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uI;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float core = exp(-dot(p, p) * 30.0);
            float streak = exp(-abs(p.y) * 60.0) * exp(-abs(p.x) * 2.5) + exp(-abs(p.x) * 60.0) * exp(-abs(p.y) * 3.5) * 0.6;
            vec3 col = vec3(0.85, 0.92, 1.0) * (core * 2.0 + streak) * uI;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(...(Object.values(parts) as BufferGeometry[]), metal, flareMat)

  // Planted at the island's edge, outside the ring of fire.
  const [px, , pz] = LAYOUT.tridentPosition
  const scale = Math.min(1, (ISLAND_RADIUS - 0.4) / Math.hypot(px, pz))
  const x = px * scale
  const z = pz * scale

  useFrame(() => {
    const g = stage.glint
    metal.emissive.setRGB(0.22 * g + 0.02 * stage.halo, 0.27 * g + 0.03 * stage.halo, 0.4 * g + 0.06 * stage.halo)
    metal.emissiveIntensity = 1 + stage.flash * 0.8
    flareMat.uniforms.uI.value = g * g * 1.4 + stage.flash * 0.3
    anchors.tridentTip.x = x
    anchors.tridentTip.y = HEIGHT + 1.0 * HEAD_SCALE
    anchors.tridentTip.z = z
  })

  return (
    <group position={[x, 0, z]} rotation={[0, -0.25, 0.02]}>
      <mesh geometry={parts.shaft} material={metal} />
      <mesh geometry={parts.knot} material={metal} position={[0, HEIGHT - 0.55, 0]} />
      <group position={[0, HEIGHT + 0.08, 0]} scale={HEAD_SCALE}>
        <mesh geometry={parts.blades} material={metal} />
      </group>
      {/* Damaru tied below the blades, as in the iconography. */}
      <mesh geometry={parts.damaru} material={metal} position={[0.11, HEIGHT - 0.4, 0]} rotation={[0, 0, 1.3]} scale={1.3} />
      <mesh geometry={parts.flare} material={flareMat} position={[0, HEIGHT + 1.0, 0.05]} scale={[2.4, 2.4, 1]} />
    </group>
  )
}
