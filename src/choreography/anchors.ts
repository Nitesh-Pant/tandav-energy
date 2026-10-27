/**
 * World-space points on the figure and props, written every frame by the
 * scene and read by the director (e.g. to emit sparks from a striking foot).
 */
export interface Point3 {
  x: number
  y: number
  z: number
}

const p = (x = 0, y = 0, z = 0): Point3 => ({ x, y, z })

export const anchors = {
  head: p(0, 2.7, 0),
  chest: p(0, 2, 0),
  leftFoot: p(0.3, 0.6, 0.2),
  rightFoot: p(-0.2, 0, 0),
  damaru: p(-0.9, 2.5, 0),
  fireHand: p(0.9, 2.5, 0),
  tridentTip: p(1.85, 4.3, -0.35),
}

export type AnchorId = keyof typeof anchors
