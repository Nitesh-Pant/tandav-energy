import { useEffect, useState } from 'react'

/** Re-evaluates `read` a few times per second — for UI that follows the clock without per-frame renders. */
export function useTicker<T>(read: () => T, ms = 250): T {
  const [value, setValue] = useState(read)
  useEffect(() => {
    const id = window.setInterval(() => setValue(() => read()), ms)
    return () => clearInterval(id)
  }, [read, ms])
  return value
}
