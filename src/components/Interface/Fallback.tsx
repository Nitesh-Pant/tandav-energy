/** Shown when WebGL is unavailable: a still, composed version of the halo — never a blank page. */
export function Fallback({ reason }: { reason: string }) {
  return (
    <section className="fallback" role="alert">
      <div className="fallback__halo" aria-hidden="true" />
      <div className="fallback__inner">
        <h1 className="intro__title fallback__title">TANDAV</h1>
        <p className="intro__tagline">When the universe moves, it dances.</p>
        <p className="fallback__note">{reason}</p>
      </div>
    </section>
  )
}
