import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { anchors } from '../../choreography/anchors'
import { director } from '../../choreography/director'
import { stage } from '../../choreography/stage'
import type { Timeline } from '../../choreography/timeline'
import { getLyrics, onLyricsChange } from '../../shloka/lyrics'
import { clamp, damp, easeInOutSine, lerp } from '../../utils/math'
import { PREVIEW } from '../../utils/preview'
import { buildEdit, editIndexAt, type EditPoint } from './shots'

interface Shot {
  radius: number
  azimuth: number
  height: number
  tx: number
  ty: number
  tz: number
  fov: number
}

const shot: Shot = { radius: 30, azimuth: 0, height: 2.5, tx: 0, ty: 2.4, tz: 0, fov: 32 }

/** The edit for the dance, rebuilt when the timeline, the lyrics or reduced motion change. */
const editCache: { tl: Timeline | null; lyrics: number; reduced: boolean; edit: EditPoint[] } = {
  tl: null,
  lyrics: -1,
  reduced: false,
  edit: [],
}
let lyricsVersion = 0

function currentEdit() {
  const tl = director.timeline
  if (editCache.tl !== tl || editCache.lyrics !== lyricsVersion || editCache.reduced !== stage.reducedMotion) {
    editCache.tl = tl
    editCache.lyrics = lyricsVersion
    editCache.reduced = stage.reducedMotion
    editCache.edit = buildEdit(tl, getLyrics(), stage.reducedMotion)
  }
  return editCache.edit
}

/** Smoothed anchor positions, so a followed hand or foot never jerks the frame. */
const follow = { head: new Vector3(0, 2.7, 0), damaru: new Vector3(-0.9, 2.5, 0), rightFoot: new Vector3(-0.2, 0.4, 0) }

/** Authored shot for the current moment, and whether it begins with a cut. Smoothing happens afterwards. */
function computeShot(out: Shot): boolean {
  const s = stage
  const p = s.actProgress
  out.tx = 0
  out.tz = 0
  if (!s.running) {
    // Before entry the camera gazes up into the void; entering tilts down to find the figure.
    out.radius = 32
    out.azimuth = Math.sin(s.time * 0.05) * 0.04
    out.height = 1.6
    out.ty = 10.5
    out.fov = 32
    return false
  }
  if (PREVIEW.cam === 'close' || PREVIEW.cam === 'side') {
    out.radius = 6.2
    out.azimuth = PREVIEW.cam === 'side' ? Math.PI / 2 : 0
    out.height = 2.1
    out.ty = 2.0
    out.fov = 40
    return false
  }
  let cut = false
  switch (s.act) {
    case 0: {
      const k = easeInOutSine(p)
      out.radius = lerp(30, 14, k)
      out.azimuth = Math.sin(s.time * 0.05) * 0.04
      out.height = lerp(1.8, 1.7, k)
      out.ty = lerp(4.5, 2.3, easeInOutSine(Math.min(1, p * 1.6)))
      out.fov = lerp(32, 35, k)
      break
    }
    case 1: {
      const k = easeInOutSine(p)
      out.radius = lerp(14, 9.8, k)
      out.azimuth = lerp(0, 0.22, k) * (s.reducedMotion ? 0.4 : 1)
      out.height = lerp(1.7, 1.25, k)
      out.ty = lerp(2.3, 2.45, k)
      out.fov = lerp(35, 40, k)
      break
    }
    case 2:
    case 3: {
      const edit = currentEdit()
      const i = editIndexAt(edit, s.time)
      if (i < 0) break
      const e = edit[i]
      const d = e.shot
      const k = easeInOutSine(clamp((s.time - e.t) / Math.max(1, e.end - e.t)))
      const motion = s.reducedMotion ? 0.4 : 1
      out.radius = d.radius + (d.dRadius ?? 0) * k * motion
      out.azimuth = d.azimuth + (d.dAzimuth ?? 0) * k * motion
      out.height = d.height + (d.dHeight ?? 0) * k * motion
      out.ty = d.targetY
      out.fov = d.fov
      if (d.follow) {
        const a = follow[d.follow as keyof typeof follow]
        const fx = d.followX ?? 1
        out.tx = a.x * fx
        out.tz = a.z * fx
        out.ty += a.y
        out.height += a.y
      }
      cut = e.cut && i !== cutDone && s.time - e.t < 0.25
      if (cut) cutDone = i
      break
    }
    default: {
      const k = easeInOutSine(clamp(p * 1.4))
      out.radius = lerp(10, 17, k)
      out.azimuth = lerp(0.1, 0, k)
      out.height = lerp(1.4, 2.0, k)
      out.ty = lerp(2.5, 2.2, k)
      out.fov = lerp(40, 35, k)
    }
  }
  // The climax throws the camera back to reveal the scale of the event.
  const motion = s.reducedMotion ? 0.4 : 1
  out.radius += s.climax * 9 * motion
  out.height += s.climax * 2.2 * motion
  return cut
}
let cutDone = -1

export function CameraRig() {
  const camera = useThree((st) => st.camera) as PerspectiveCamera
  const rig = useMemo(
    () => ({
      radius: 30,
      azimuth: 0,
      height: 2.2,
      tx: 0,
      ty: 2.4,
      tz: 0,
      fov: 32,
      px: 0,
      py: 0,
      kick: 0,
      kickV: 0,
      target: new Vector3(),
      right: new Vector3(),
      fwd: new Vector3(),
    }),
    [],
  )

  useEffect(() => {
    const off = onLyricsChange(() => {
      lyricsVersion++
    })
    return () => {
      off()
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    for (const k of ['head', 'damaru', 'rightFoot'] as const) {
      const a = anchors[k]
      const f = follow[k]
      f.set(damp(f.x, a.x, 1.6, dt), damp(f.y, a.y, 1.6, dt), damp(f.z, a.z, 1.6, dt))
    }
    const cut = computeShot(shot)
    if (cut) {
      rig.radius = shot.radius
      rig.azimuth = shot.azimuth
      rig.height = shot.height
      rig.tx = shot.tx
      rig.ty = shot.ty
      rig.tz = shot.tz
      rig.fov = shot.fov
    }
    // Slow during the intro/void; shot changes in the dance glide over ~2.5 s.
    const lambda = stage.running ? (stage.act === 0 ? 0.55 : stage.climax > 0.3 ? 2.6 : 1.25) : 0.6
    rig.radius = damp(rig.radius, shot.radius, lambda, dt)
    rig.azimuth = damp(rig.azimuth, shot.azimuth, lambda, dt)
    rig.height = damp(rig.height, shot.height, lambda, dt)
    rig.tx = damp(rig.tx, shot.tx, lambda, dt)
    rig.ty = damp(rig.ty, shot.ty, lambda, dt)
    rig.tz = damp(rig.tz, shot.tz, lambda, dt)
    rig.fov = damp(rig.fov, shot.fov, lambda, dt)

    // Pointer parallax.
    const par = stage.reducedMotion ? 0.3 : 1
    rig.px = damp(rig.px, stage.pointerX * par, 2.5, dt)
    rig.py = damp(rig.py, stage.pointerY * par, 2.5, dt)

    // Impact impulse: a short, damped dolly kick — never continuous shake.
    if (!stage.reducedMotion && stage.impulse > 0) rig.kickV += Math.min(stage.impulse, 1.5) * 9
    stage.impulse = 0
    const w = 11
    const z = 0.8
    rig.kickV += (-w * w * rig.kick - 2 * z * w * rig.kickV) * dt
    rig.kick += rig.kickV * dt

    const az = rig.azimuth
    // Portrait screens: pull back so the ring of fire still fits horizontally.
    const fit = Math.min(2.1, Math.max(1, 1.05 / camera.aspect))
    const r = rig.radius * fit
    camera.position.set(rig.tx + Math.sin(az) * r, rig.height, rig.tz + Math.cos(az) * r)
    // On portrait screens aim a little lower, lifting the figure clear of the verse band below.
    rig.target.set(rig.tx, rig.ty - (fit - 1) * 0.7, rig.tz)
    rig.fwd.subVectors(rig.target, camera.position).normalize()
    rig.right.crossVectors(rig.fwd, camera.up).normalize()
    camera.position.addScaledVector(rig.right, rig.px * 0.7)
    camera.position.y += rig.py * 0.4
    camera.position.addScaledVector(rig.fwd, rig.kick * 0.08)
    camera.lookAt(rig.target)
    camera.rotateZ(rig.kick * 0.004 + rig.px * -0.01)
    if (Math.abs(camera.fov - rig.fov) > 0.01) {
      camera.fov = rig.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
