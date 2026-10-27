import { useMemo } from 'react'
import { Controls } from './components/AudioControls/Controls'
import { Experience } from './components/Experience/Experience'
import { SceneErrorBoundary } from './components/Experience/SceneErrorBoundary'
import { ActCaption } from './components/Interface/ActCaption'
import { EndTitle } from './components/Interface/EndTitle'
import { Fallback } from './components/Interface/Fallback'
import { Intro } from './components/Interface/Intro'
import { Shloka } from './components/Interface/Shloka'
import { SyncTool } from './components/Interface/SyncTool'
import { useKeyboard } from './hooks/useKeyboard'
import { useUI } from './state/store'
import { webglAvailable } from './utils/webgl'

export default function App() {
  const hasWebGL = useMemo(webglAvailable, [])
  const cinematic = useUI((s) => s.cinematic)
  const notice = useUI((s) => s.notice)
  const syncMode = useUI((s) => s.syncMode)
  useKeyboard()

  if (!hasWebGL) {
    return <Fallback reason="This experience needs WebGL, which this browser or device does not provide." />
  }

  return (
    <main className={`app ${cinematic ? 'is-cinematic' : ''} ${syncMode ? 'is-sync' : ''}`}>
      <SceneErrorBoundary fallback={<Fallback reason="The 3D scene could not start on this device." />}>
        <Experience />
      </SceneErrorBoundary>
      <div className="overlay">
        <ActCaption />
        <Shloka />
        <EndTitle />
        <Controls />
        {syncMode && <SyncTool />}
        <Intro />
        {notice && <p className="notice">{notice}</p>}
      </div>
    </main>
  )
}
