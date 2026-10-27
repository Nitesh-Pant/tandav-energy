import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

/** Catches WebGL/scene failures so the page degrades to a still fallback instead of a blank screen. */
export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[tandav] The 3D scene failed to start.', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
