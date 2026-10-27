/**
 * Tiny synchronous event bus for discrete visual events.
 * The director emits; effects subscribe once and push into their own pools,
 * so nothing here touches React state.
 */

export interface VisualEvents {
  /** Ground-level energy wave from the figure (or a point). */
  shockwave: { strength: number; x?: number; z?: number; vertical?: boolean }
  /** A lightning strike. `target` biases where the bolt lands. */
  lightning: { strength: number; target?: 'sky' | 'trident' | 'mountain' }
  /** Spark burst at a world position. */
  sparks: { strength: number; x: number; y: number; z: number }
  /** A dance accent: the figure stamps its foot. */
  stamp: { strength: number }
  /** A sung word acted out: shake the damaru, lift the fire. Held for `duration` seconds. */
  gesture: { kind: 'damaru' | 'agni'; duration: number }
  /** Screen-space refraction ripple, reserved for the largest accents. */
  distortion: { strength: number }
  /** The single largest moment of the piece. */
  climax: Record<string, never>
  /** Clean reset on restart/replay. */
  reset: Record<string, never>
}

type Handler<T> = (payload: T) => void

class EventBus<M> {
  private handlers: { [K in keyof M]?: Set<Handler<M[K]>> } = {}

  on<K extends keyof M>(type: K, handler: Handler<M[K]>): () => void {
    const set = (this.handlers[type] ??= new Set())
    set.add(handler)
    return () => set.delete(handler)
  }

  emit<K extends keyof M>(type: K, payload: M[K]) {
    this.handlers[type]?.forEach((h) => h(payload))
  }
}

export const visualEvents = new EventBus<VisualEvents>()
