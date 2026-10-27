import { useEffect } from 'react'

interface Disposable {
  dispose: () => void
}

/** Dispose GPU resources created imperatively (useMemo) when the owner unmounts. */
export function useDisposable(...resources: (Disposable | null | undefined)[]) {
  useEffect(
    () => () => resources.forEach((r) => r?.dispose()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    resources,
  )
}
