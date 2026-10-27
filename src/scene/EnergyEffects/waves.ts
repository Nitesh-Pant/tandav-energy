/**
 * Shared pool of expanding ground shockwaves. Spawned from visual events and
 * read by the ring effect, the cosmic sea (ripples) and the floating rocks
 * (impulses), so a single wave travels coherently through the whole world.
 */

export const WAVE_COUNT = 8

export interface Wave {
  start: number
  strength: number
  x: number
  z: number
  speed: number
  life: number
  active: boolean
}

export const waves: Wave[] = Array.from({ length: WAVE_COUNT }, () => ({
  start: 0,
  strength: 0,
  x: 0,
  z: 0,
  speed: 14,
  life: 4,
  active: false,
}))

let cursor = 0

export function spawnWave(time: number, strength: number, x = 0, z = 0) {
  const w = waves[cursor]
  cursor = (cursor + 1) % WAVE_COUNT
  w.start = time
  w.strength = strength
  w.x = x
  w.z = z
  w.speed = 9 + strength * 9
  w.life = 3 + strength * 2
  w.active = true
}

/** Age in seconds, or -1 when inactive/expired. */
export function waveAge(w: Wave, time: number) {
  if (!w.active) return -1
  const age = time - w.start
  if (age > w.life || age < 0) {
    w.active = false
    return -1
  }
  return age
}

export function clearWaves() {
  waves.forEach((w) => (w.active = false))
}
