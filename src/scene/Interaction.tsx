import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { visualEvents } from '../choreography/events'
import { stage } from '../choreography/stage'
import { damp } from '../utils/math'
import { PEDESTAL_TOP } from './Shiva/Shiva'

/**
 * Pointer → parallax and a parting of the dust; click/tap → a restrained
 * energy ripple where the ray meets the pedestal plane. Rate-limited so
 * interaction can never overwhelm the choreography.
 */
export function Interaction() {
  const { gl, camera } = useThree()
  const tools = useMemo(
    () => ({ ray: new Raycaster(), ndc: new Vector2(), plane: new Plane(new Vector3(0, 1, 0), -PEDESTAL_TOP), hit: new Vector3(), target: new Vector2(), active: 0, lastMove: -10, lastRipple: -10 }),
    [],
  )

  useEffect(() => {
    const el = gl.domElement
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tools.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    const onMove = (e: PointerEvent) => {
      toNdc(e)
      tools.target.copy(tools.ndc)
      tools.lastMove = performance.now() / 1000
    }
    const onDown = (e: PointerEvent) => {
      onMove(e)
      const now = performance.now() / 1000
      if (!stage.running || now - tools.lastRipple < 0.6) return
      tools.lastRipple = now
      tools.ray.setFromCamera(tools.ndc, camera)
      const hit = tools.ray.ray.intersectPlane(tools.plane, tools.hit)
      if (hit && hit.length() < 60) {
        visualEvents.emit('shockwave', { strength: 0.35, x: hit.x, z: hit.z })
        if (hit.length() < 4) visualEvents.emit('sparks', { strength: 0.4, x: hit.x, y: hit.y + 0.05, z: hit.z })
      } else {
        const p = tools.ray.ray.at(8, tools.hit)
        visualEvents.emit('sparks', { strength: 0.35, x: p.x, y: p.y, z: p.z })
      }
    }
    // Parallax follows the whole window so the overlay UI doesn't block it.
    window.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
    }
  }, [gl, camera, tools])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const recent = performance.now() / 1000 - tools.lastMove < 1.5 ? 1 : 0
    stage.pointerActive = damp(stage.pointerActive, recent, 3, dt)
    // Without recent input the parallax relaxes back to centre.
    stage.pointerX = damp(stage.pointerX, recent ? tools.target.x : 0, recent ? 6 : 0.8, dt)
    stage.pointerY = damp(stage.pointerY, recent ? tools.target.y : 0, recent ? 6 : 0.8, dt)
  })

  return null
}
