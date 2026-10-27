/**
 * Central creative + technical configuration.
 * Colours, quality presets and figure scale live here so the look can be
 * tuned without hunting through individual effects.
 */

export const PALETTE = {
  void: '#020309',
  midnight: '#050a1c',
  indigo: '#1b2060',
  deepIndigo: '#0c0f33',
  electric: '#4f8dff',
  ice: '#b9d3ff',
  silver: '#eef3ff',
  amber: '#ff8f33',
  ember: '#ff5418',
  skin: '#0a1028',
} as const

export type QualityLevel = 'high' | 'medium' | 'low'

export interface QualityPreset {
  dust: number
  embers: number
  sparks: number
  stars: number
  rocks: number
  maxDpr: number
  bloom: boolean
  skyOctaves: number
  cloudLayers: number
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  high: { dust: 7000, embers: 900, sparks: 600, stars: 4500, rocks: 48, maxDpr: 1.5, bloom: true, skyOctaves: 5, cloudLayers: 4 },
  medium: { dust: 4200, embers: 600, sparks: 400, stars: 3000, rocks: 32, maxDpr: 1.25, bloom: true, skyOctaves: 4, cloudLayers: 3 },
  low: { dust: 1800, embers: 300, sparks: 200, stars: 1800, rocks: 22, maxDpr: 1, bloom: false, skyOctaves: 3, cloudLayers: 2 },
}

/** World-space layout of the central composition. */
export const LAYOUT = {
  /** Figure scale relative to a ~1.85 unit tall rig. */
  figureScale: 1.6,
  /** Centre of the halo / ring of fire, roughly the figure's sternum. */
  haloCenter: [0, 1.95, -0.55] as [number, number, number],
  ringRadius: 2.05,
  /** Height of the cosmic sea below the floating pedestal. */
  seaLevel: -7,
  tridentPosition: [2.85, 0, 0.85] as [number, number, number],
}

/** Accessibility: flashes are rate limited to stay under 3 per second (WCAG 2.3.1). */
export const FLASH_MIN_INTERVAL = 0.42

export function detectQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'medium'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 600
  const cores = navigator.hardwareConcurrency ?? 4
  if (coarse && (small || cores <= 4)) return 'low'
  if (coarse || cores <= 4) return 'medium'
  return 'high'
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
