import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Points,
  Group,
  Material,
  Matrix4,
  Mesh,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  DoubleSide,
  MeshBasicMaterial,
} from 'three'
import { LAYOUT, PALETTE } from '../../config'
import { anchors, type Point3 } from '../../choreography/anchors'
import { stage } from '../../choreography/stage'
import { visualEvents } from '../../choreography/events'
import { DanceController } from './dance'
import { DIM, createSkeleton, solve, type Limb } from './rig'
import { crescentGeometry, damaruGeometry, serpentGeometry, taperedCapsule } from './geometry'
import {
  crestFan,
  earrings,
  faceGeometry,
  footGeometry,
  foldedDhoti,
  hairCap,
  handGeometry,
  sculptedTorso,
  tieredCrown,
  torsoOrnaments,
  type Mudra,
} from './anatomy'
import { createBronzeEnvironment, createBronzeMaterial, createBronzeUniforms } from './bronze'
import { createFlameMaterial, createGangaMaterial, createGlowMaterial, createStrandMaterial, createThirdEyeMaterial } from './materials'
import { mulberry32, smoothstep } from '../../utils/math'
import { StrandSystem, hairDefs, sashDefs } from './strands'
import { PREVIEW } from '../../utils/preview'

const UP = new Vector3(0, 1, 0)
const _dir = new Vector3()
const _v = new Vector3()
const _x = new Vector3()
const _y = new Vector3()
const _z = new Vector3()
const _m = new Matrix4()

/** Pedestal height (world) on which the figure stands. */
export const PEDESTAL_TOP = 0.34

interface LimbMeshes {
  upper: Mesh
  lower: Mesh
  /** Hand or foot. */
  tip: Mesh
  joint: Mesh
  midJoint: Mesh
  endJoint: Mesh
  /** Cloth over the upper thigh. */
  sleeve?: Mesh
}

function placeSegment(mesh: Mesh, a: Vector3, b: Vector3) {
  mesh.position.copy(a)
  _dir.subVectors(b, a).normalize()
  mesh.quaternion.setFromUnitVectors(UP, _dir)
}

/** Orient a hand or foot: local +Y along `dir`, local +Z toward `hint` (made orthogonal). */
function placeBasis(mesh: Mesh, at: Vector3, dir: Vector3, hint: Vector3) {
  _y.copy(dir).normalize()
  _z.copy(hint).addScaledVector(_y, -hint.dot(_y))
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z)
  _z.normalize()
  _x.crossVectors(_y, _z)
  mesh.position.copy(at)
  mesh.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z))
}

/** Which way each palm faces. Lower hands that swing down turn their palms to the floor, then back. */
function palmHint(k: 'ru' | 'rl' | 'lu' | 'll', dir: Vector3, out: Vector3) {
  if (k === 'lu') return out.set(0, 0.35, 1)
  if (k === 'ru') return out.set(0, 0, 1)
  const down = smoothstep(0.1, -0.6, dir.y)
  return out.set(0, -down, 1 - 2 * down)
}

const MUDRA: Record<'ru' | 'rl' | 'lu' | 'll', Mudra> = { ru: 'damaru', rl: 'abhaya', lu: 'agni', ll: 'gaja' }

function buildFigure(envMap: ReturnType<typeof createBronzeEnvironment>) {
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const g = <T extends BufferGeometry>(geo: T) => (geometries.push(geo), geo)
  const m = <T extends Material>(mat: T) => (materials.push(mat), mat)

  const bronzeU = createBronzeUniforms()
  const skin = m(createBronzeMaterial(bronzeU, { color: '#5e4027', metalness: 0.62, roughness: 0.42, envMap }))
  const cloth = m(createBronzeMaterial(bronzeU, { color: '#553a22', metalness: 0.5, roughness: 0.56, envMap, patina: 1.4 }))
  cloth.side = DoubleSide
  const ornament = m(createBronzeMaterial(bronzeU, { color: '#a47a3c', metalness: 0.9, roughness: 0.3, envMap, patina: 0.4 }))
  // HDR colour so the crescent blooms softly.
  const moon = m(new MeshBasicMaterial({ side: DoubleSide }))
  moon.color.setRGB(2.2, 2.4, 2.8)
  const flame = m(createFlameMaterial())
  const eye = m(createThirdEyeMaterial())

  const root = new Group()
  root.name = 'shiva'
  root.scale.setScalar(LAYOUT.figureScale)
  root.position.set(0, PEDESTAL_TOP, 0)

  const add = (geo: BufferGeometry, mat: Material, parent: Group = root) => {
    const mesh = new Mesh(geo, mat)
    parent.add(mesh)
    return mesh
  }

  // Torso, with its ornaments riding on it; the dhoti follows the hips.
  const torso = add(g(sculptedTorso()), skin)
  const chest = new Group()
  root.add(chest)
  add(g(torsoOrnaments()), ornament, chest)
  const dhoti = add(g(foldedDhoti()), cloth)

  // Neck and head.
  const R = DIM.headRadius
  const s = R / 0.1
  const neck = add(g(taperedCapsule(DIM.neck + 0.06, 0.05, 0.045)), skin)
  const head = new Group()
  root.add(head)
  const skull = add(g(new SphereGeometry(R, 28, 20)), skin, head)
  skull.scale.set(0.86, 1.05, 0.94)
  add(g(faceGeometry(R)), skin, head)
  add(g(hairCap(R)), skin, head)
  add(g(earrings(R)), ornament, head)
  const crown = add(g(tieredCrown()), skin, head)
  crown.position.set(0, 0.064 * s, -0.018 * s)
  crown.scale.setScalar(s)
  const crest = add(g(crestFan()), ornament, head)
  crest.scale.setScalar(s)
  const crescent = add(g(crescentGeometry(0.05)), moon, head)
  crescent.position.set(-0.084 * s, 0.16 * s, 0.024)
  crescent.rotation.set(0, 0.3, 0.9)
  const thirdEye = add(g(new PlaneGeometry(0.03, 0.06)), eye, head)
  thirdEye.position.set(0, 0.04 * s, 0.1 * s)
  thirdEye.renderOrder = 5
  const nose = add(g(taperedCapsule(0.042 * s, 0.011 * s, 0.015 * s, 0, 14)), skin, head)
  nose.position.set(0, 0.022 * s, 0.086 * s)
  nose.quaternion.setFromUnitVectors(UP, new Vector3(0, -0.93, 0.36).normalize())
  const chin = add(g(new SphereGeometry(0.028 * s, 14, 10)), skin, head)
  chin.position.set(0, -0.072 * s, 0.064 * s)
  chin.scale.set(1.1, 0.8, 0.9)

  // Neelakantha: the blue throat, glowing faintly beneath the chin.
  const throatMat = m(createGlowMaterial('#3f7dff'))
  const throat = add(g(new PlaneGeometry(1, 1)), throatMat, head)
  throat.position.set(0, -0.14 * s, 0.06)
  throat.scale.set(0.16, 0.12, 1)
  throat.renderOrder = 5

  // Ganga, falling from the matted locks.
  const gangaMat = m(createGangaMaterial())
  const gangaGeo = g(new BufferGeometry())
  {
    const n = 900
    const rand = mulberry32(11)
    const seeds = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) seeds.set([rand(), rand(), Math.pow(rand(), 2)], i * 3)
    gangaGeo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    gangaGeo.setAttribute('aSeed', new BufferAttribute(seeds, 3))
  }
  const ganga = new Points(gangaGeo, gangaMat)
  ganga.frustumCulled = false
  ganga.renderOrder = 6
  head.add(ganga)

  // Vasuki, the serpent garland, rides the chest.
  const snake = serpentGeometry()
  // Vasuki is cast in the same bronze, greener with age; he glows when the verse names him.
  const serpentSkin = m(createBronzeMaterial(bronzeU, { color: '#4d4a2c', metalness: 0.6, roughness: 0.45, envMap, patina: 2 }))
  add(g(snake.body), serpentSkin, chest)
  const hood = add(g(new SphereGeometry(1, 12, 8)), serpentSkin, chest)
  hood.position.copy(snake.headAt)
  hood.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), snake.headDir)
  hood.scale.set(0.03, 0.012, 0.026)
  const serpentEyeMat = m(new MeshBasicMaterial({ color: '#ffffff' }))
  const serpentEyes = add(g(new SphereGeometry(0.004, 6, 4)), serpentEyeMat, chest)
  serpentEyes.position.copy(snake.headAt).addScaledVector(snake.headDir, 0.012)

  // Limbs.
  const jointGeo = g(new SphereGeometry(0.052, 18, 14))
  const limb = (r: [number, number, number, number, number, number], lengths: [number, number], tip: BufferGeometry, sleeve = false): LimbMeshes => {
    const upper = add(g(taperedCapsule(lengths[0], r[0], r[1], r[0] * 0.14)), skin)
    const lower = add(g(taperedCapsule(lengths[1], r[2], r[3], r[2] * 0.12)), skin)
    const tipMesh = add(tip, skin)
    const joint = add(jointGeo, skin)
    joint.scale.setScalar(r[0] / 0.052)
    // Fill the elbow/knee and wrist/ankle so limbs read as one continuous form.
    const midJoint = add(jointGeo, skin)
    midJoint.scale.setScalar((r[1] * 0.97) / 0.052)
    const endJoint = add(jointGeo, skin)
    endJoint.scale.setScalar((r[3] * 0.98) / 0.052)
    const out: LimbMeshes = { upper, lower, tip: tipMesh, joint, midJoint, endJoint }
    if (sleeve) out.sleeve = add(g(taperedCapsule(lengths[0] * 0.36, r[0] * 1.08, r[0] * 0.95, 0.003, 24)), cloth)
    return out
  }
  const armR: [number, number, number, number, number, number] = [0.06, 0.046, 0.045, 0.031, 0, 0]
  const legR: [number, number, number, number, number, number] = [0.088, 0.062, 0.062, 0.036, 0, 0]
  const armL: [number, number] = [DIM.upperArm, DIM.forearm]
  const legL: [number, number] = [DIM.thigh, DIM.shin]
  const limbs = {
    ru: limb(armR, armL, g(handGeometry(MUDRA.ru, 1))),
    rl: limb(armR, armL, g(handGeometry(MUDRA.rl, 1))),
    lu: limb(armR, armL, g(handGeometry(MUDRA.lu, -1))),
    ll: limb(armR, armL, g(handGeometry(MUDRA.ll, -1))),
    rLeg: limb(legR, legL, g(footGeometry()), true),
    lLeg: limb(legR, legL, g(footGeometry()), true),
  }

  // Ornaments: armlets, bracelets, anklets.
  const bandGeo = g(new TorusGeometry(1, 0.12, 8, 24))
  const bands: { mesh: Mesh; limb: keyof typeof limbs; seg: 'upper' | 'lower'; at: number; r: number }[] = []
  for (const k of ['ru', 'rl', 'lu', 'll'] as const) {
    bands.push({ mesh: add(bandGeo, ornament), limb: k, seg: 'upper', at: 0.3, r: 0.058 })
    bands.push({ mesh: add(bandGeo, ornament), limb: k, seg: 'lower', at: 0.88, r: 0.032 })
  }
  for (const k of ['rLeg', 'lLeg'] as const) bands.push({ mesh: add(bandGeo, ornament), limb: k, seg: 'lower', at: 0.9, r: 0.04 })

  // Props.
  const damaru = add(g(damaruGeometry()), ornament)
  const agni = add(g(new PlaneGeometry(1, 1)), flame)
  agni.scale.set(0.3, 0.46, 1)
  agni.renderOrder = 6
  const agniLight = new PointLight(PALETTE.amber, 0, 6, 1.6)
  root.add(agniLight)

  return {
    root,
    chest,
    throat,
    throatMat,
    ganga,
    gangaMat,
    moon,
    serpentSkin,
    serpentEyeMat,
    torso,
    dhoti,
    neck,
    head,
    thirdEye,
    limbs,
    bands,
    damaru,
    agni,
    agniLight,
    bronzeU,
    bronze: [skin, cloth, ornament, serpentSkin],
    flame,
    eye,
    dispose() {
      geometries.forEach((x) => x.dispose())
      materials.forEach((x) => x.dispose())
    },
  }
}

export function Shiva() {
  const gl = useThree((st) => st.gl)
  const envMap = useMemo(() => createBronzeEnvironment(gl), [gl])
  const fig = useMemo(() => buildFigure(envMap), [envMap])
  const sk = useMemo(createSkeleton, [])
  const dance = useMemo(() => new DanceController(), [])
  const hair = useMemo(() => new StrandSystem(hairDefs(), LAYOUT.figureScale), [])
  const sash = useMemo(() => new StrandSystem(sashDefs(), LAYOUT.figureScale), [])
  const hairMat = useMemo(() => createStrandMaterial('#94683a', 0.45, '#140c06', '#7fb2ff'), [])
  const sashMat = useMemo(() => createStrandMaterial('#8a5f34', 0.06, '#1a1108'), [])
  const frames = useMemo(
    () => ({ head: { p: new Vector3(), q: new Quaternion() }, waist: { p: new Vector3(), q: new Quaternion() } }),
    [],
  )
  const tmp = useMemo(() => ({ dir: new Vector3(), hint: new Vector3(), up: new Vector3(), palm: new Vector3() }), [])
  const group = useRef<Group>(null)

  useEffect(() => {
    const disconnect = dance.connect()
    const off = visualEvents.on('reset', () => {
      hair.reset()
      sash.reset()
    })
    return () => {
      off()
      disconnect()
      fig.dispose()
      envMap.dispose()
      hair.dispose()
      sash.dispose()
      hairMat.dispose()
      sashMat.dispose()
    }
  }, [fig, envMap, dance, hair, sash, hairMat, sashMat])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const s = stage
    const t = state.clock.elapsedTime
    // The bronze statue stands in for the dancer before the awakening and after the climax.
    const hidden = PREVIEW.statue || (s.statueReady && s.statue > 0.5)
    if (group.current) group.current.visible = !hidden
    const pose = dance.update(dt)
    const breath = Math.sin(t * 1.1)
    solve(pose, sk, breath)

    // Root motion: only a slow, living turn of the whole body.
    fig.root.rotation.y = Math.sin(t * 0.23) * 0.08 * (0.3 + s.dance)

    fig.torso.position.copy(sk.pelvis)
    fig.torso.quaternion.copy(sk.torsoQ)
    fig.chest.position.copy(sk.pelvis)
    fig.chest.quaternion.copy(sk.torsoQ)
    fig.dhoti.position.copy(sk.pelvis)
    fig.dhoti.quaternion.copy(sk.pelvisQ)
    placeSegment(fig.neck, sk.neck, sk.head)
    fig.neck.position.addScaledVector(_dir, -0.04)
    fig.head.position.copy(sk.head)
    fig.head.quaternion.copy(sk.headQ)

    for (const k of ['ru', 'rl', 'lu', 'll', 'rLeg', 'lLeg'] as const) {
      const l: Limb = sk[k]
      const meshes = fig.limbs[k]
      placeSegment(meshes.upper, l.root, l.mid)
      placeSegment(meshes.lower, l.mid, l.end)
      tmp.dir.subVectors(l.tip, l.end)
      if (k === 'rLeg' || k === 'lLeg') {
        // The top of the foot faces up, turning to face back when the foot points to the sky.
        const dy = tmp.dir.y / Math.max(1e-4, tmp.dir.length())
        placeBasis(meshes.tip, l.end, tmp.dir, tmp.hint.set(0, 1, -0.6 * dy))
        if (meshes.sleeve) placeSegment(meshes.sleeve, l.root, l.mid)
      } else {
        placeBasis(meshes.tip, l.end, tmp.dir, palmHint(k, tmp.dir.normalize(), tmp.hint))
      }
      meshes.joint.position.copy(l.root)
      meshes.midJoint.position.copy(l.mid)
      meshes.endJoint.position.copy(l.end)
    }
    for (const b of fig.bands) {
      const l = sk[b.limb]
      const a = b.seg === 'upper' ? l.root : l.mid
      const c = b.seg === 'upper' ? l.mid : l.end
      b.mesh.position.lerpVectors(a, c, b.at)
      _dir.subVectors(c, a).normalize()
      b.mesh.quaternion.setFromUnitVectors(_v.set(0, 0, 1), _dir)
      b.mesh.scale.setScalar(b.r)
    }

    // Props sit in the hands: the damaru across the curled fingers, the flame on the open palm.
    const ruHand = fig.limbs.ru.tip
    _x.set(1, 0, 0).applyQuaternion(ruHand.quaternion)
    _z.set(0, 0, 1).applyQuaternion(ruHand.quaternion)
    _y.set(0, 1, 0).applyQuaternion(ruHand.quaternion)
    fig.damaru.position.copy(ruHand.position).addScaledVector(_y, 0.075).addScaledVector(_z, 0.03)
    fig.damaru.quaternion.setFromUnitVectors(UP, _x)
    fig.damaru.rotateY(Math.sin(t * 18) * 0.25 * Math.max(s.dance, s.motif.damaru)) // the rattle
    const luHand = fig.limbs.lu.tip
    _z.set(0, 0, 1).applyQuaternion(luHand.quaternion)
    _y.set(0, 1, 0).applyQuaternion(luHand.quaternion)
    tmp.palm.copy(luHand.position).addScaledVector(_y, 0.05).addScaledVector(_z, 0.03)
    fig.agni.position.copy(tmp.palm).y += 0.2
    fig.agniLight.position.copy(fig.agni.position)

    // Materials.
    const bu = fig.bronzeU
    // Lightning outlines him rather than flooding him with light, so his form survives the flash.
    bu.uRimStrength.value = 0.2 + s.halo * 0.95 + s.flash * 0.6
    bu.uFire.value = s.fire * 0.6
    bu.uKey.value = PREVIEW.lit ? 1.6 : 0.2 + s.intensity * 0.08 + s.flash * 0.06
    bu.uClimax.value = s.climax * 0.8
    for (const mat of fig.bronze) mat.envMapIntensity = 0.4 + s.halo * 0.35
    fig.flame.uniforms.uTime.value = t
    fig.flame.uniforms.uStrength.value = 0.35 + s.fire * 0.9 + s.high * 0.2 * s.fire
    fig.agniLight.intensity = (0.4 + s.fire * 3) * (0.85 + Math.sin(t * 17) * 0.15)
    fig.eye.uniforms.uOpen.value = s.thirdEye
    fig.eye.uniforms.uTime.value = t
    // Imagery the shloka names glows while it is sung.
    const mo = s.motif
    fig.serpentSkin.emissive.setRGB(0.05, 0.16, 0.13).multiplyScalar(mo.serpent)
    fig.serpentEyeMat.color.setRGB(0.4 + mo.serpent * 3, 0.9 + mo.serpent * 2.5, 0.8 + mo.serpent * 2)
    const moonGlow = 1 + mo.moon * 1.6 + s.halo * 0.3
    fig.moon.color.setRGB(2.2 * moonGlow, 2.4 * moonGlow, 2.8 * moonGlow)
    fig.throatMat.uniforms.uI.value = 0.12 + s.halo * 0.18 + mo.throat * 1.4
    fig.gangaMat.uniforms.uTime.value = t
    fig.gangaMat.uniforms.uPixel.value = state.gl.getPixelRatio()
    fig.gangaMat.uniforms.uI.value = 0.08 + s.halo * 0.18 + mo.ganga * 1.2
    for (const mat of [hairMat, sashMat]) {
      mat.uniforms.uStrength.value = 0.1 + s.halo * 0.45
      mat.uniforms.uFlash.value = s.flash * 0.5
    }
    hairMat.uniforms.uFire.value = s.fire

    // World-space anchors and strand attach frames.
    fig.root.updateMatrixWorld()
    const toWorld = (local: Vector3, out: Point3) => {
      _v.copy(local).applyMatrix4(fig.root.matrixWorld)
      out.x = _v.x
      out.y = _v.y
      out.z = _v.z
    }
    toWorld(sk.head, anchors.head)
    toWorld(sk.chest, anchors.chest)
    toWorld(sk.lLeg.tip, anchors.leftFoot)
    toWorld(sk.rLeg.tip, anchors.rightFoot)
    toWorld(fig.damaru.position, anchors.damaru)
    toWorld(fig.agni.position, anchors.fireHand)

    frames.head.p.copy(sk.head).applyMatrix4(fig.root.matrixWorld)
    frames.head.q.copy(fig.root.quaternion).multiply(sk.headQ)
    frames.waist.p.copy(sk.pelvis).applyMatrix4(fig.root.matrixWorld)
    frames.waist.q.copy(fig.root.quaternion).multiply(sk.pelvisQ)
    hair.update(dt, frames, state.camera.position, t, s.turbulence)
    sash.update(dt, frames, state.camera.position, t, s.turbulence)
  })

  return (
    <group ref={group}>
      <primitive object={fig.root} />
      <mesh geometry={hair.geometry} material={hairMat} frustumCulled={false} renderOrder={2} />
      <mesh geometry={sash.geometry} material={sashMat} frustumCulled={false} renderOrder={2} />
    </group>
  )
}
