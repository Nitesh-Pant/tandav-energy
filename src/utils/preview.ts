/**
 * Development aids (query parameters):
 *   ?t=95        skip the intro and run the choreography silently from 95 s
 *   &freeze      hold that moment instead of playing on
 *   &cam=close   frame the figure tightly (for inspecting the rig); cam=side for profile
 *   &lit         flood the figure with fill light to read its form
 *   &statue      show the bronze statue instead of the dancer
 */
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const raw = params.get('t')
const t = raw === null ? NaN : Number(raw)

export const PREVIEW = {
  time: Number.isFinite(t) ? Math.max(0, t) : null,
  freeze: params.has('freeze'),
  cam: params.get('cam'),
  lit: params.has('lit'),
  statue: params.has('statue'),
}

export function previewTime(): number | null {
  return PREVIEW.time
}
