import { useEffect, useState } from 'react'

/** True after `ms` without pointer, touch or keyboard activity. */
export function useIdle(ms: number, enabled = true) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setIdle(false)
      return
    }
    let timer = window.setTimeout(() => setIdle(true), ms)
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), ms)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [ms, enabled])
  return idle
}
