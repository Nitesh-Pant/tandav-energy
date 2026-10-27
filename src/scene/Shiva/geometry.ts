import { BufferGeometry, CatmullRomCurve3, LatheGeometry, Shape, ShapeGeometry, TubeGeometry, Vector2, Vector3 } from 'three'

/**
 * Tapered capsule along +Y from 0 to `length`, radius r0 at the base and r1
 * at the end, with an optional mid-length bulge for musculature.
 */
export function taperedCapsule(length: number, r0: number, r1: number, bulge = 0, radial = 20): BufferGeometry {
  const pts: Vector2[] = []
  const cap = 5
  for (let i = 0; i <= cap; i++) {
    const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2)
    pts.push(new Vector2(Math.cos(a) * r0, Math.sin(a) * r0))
  }
  const mid = 10
  for (let i = 1; i < mid; i++) {
    const t = i / mid
    const r = r0 + (r1 - r0) * t + Math.sin(Math.PI * Math.pow(t, 0.8)) * bulge
    pts.push(new Vector2(r, t * length))
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2)
    pts.push(new Vector2(Math.max(1e-4, Math.cos(a) * r1), length + Math.sin(a) * r1))
  }
  pts[0].x = 1e-4
  return new LatheGeometry(pts, radial)
}

/** Lion-waisted torso from pelvis (y=0) to neck (y≈0.56); scale X/Z on the mesh for an elliptical section. */
export function torsoGeometry(): BufferGeometry {
  const profile: [number, number][] = [
    [0.0001, -0.075],
    [0.08, -0.065],
    [0.118, -0.02],
    [0.122, 0.05],
    [0.104, 0.13],
    [0.092, 0.2],
    [0.1, 0.27],
    [0.125, 0.35],
    [0.142, 0.42],
    [0.146, 0.475],
    [0.125, 0.52],
    [0.07, 0.552],
    [0.0001, 0.565],
  ]
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    20,
  )
}

/** Jata-makuta: the tall bun of matted locks. */
export function crownGeometry(): BufferGeometry {
  const profile: [number, number][] = [
    [0.0001, 0],
    [0.07, 0.005],
    [0.082, 0.04],
    [0.078, 0.09],
    [0.06, 0.14],
    [0.05, 0.17],
    [0.058, 0.195],
    [0.03, 0.23],
    [0.0001, 0.245],
  ]
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    14,
  )
}

/** Short flared dhoti around the hips. Open-ended, render double-sided. */
export function dhotiGeometry(): BufferGeometry {
  const profile: [number, number][] = [
    [0.165, -0.2],
    [0.15, -0.14],
    [0.135, -0.06],
    [0.125, 0.02],
    [0.115, 0.08],
  ]
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    20,
  )
}

export function crescentGeometry(radius = 0.06): BufferGeometry {
  const s = new Shape()
  s.absarc(0, 0, radius, Math.PI * 0.15, Math.PI * 1.85, false)
  // Inner arc, offset, back toward the start — the thin sliver of the moon.
  s.absarc(radius * 0.38, 0, radius * 0.82, Math.PI * 1.72, Math.PI * 0.28, true)
  return new ShapeGeometry(s, 16)
}

/** Hourglass damaru along +Y, centred at the origin. */
export function damaruGeometry(): BufferGeometry {
  const profile: [number, number][] = [
    [0.0001, -0.07],
    [0.05, -0.07],
    [0.052, -0.062],
    [0.012, -0.004],
    [0.012, 0.004],
    [0.052, 0.062],
    [0.05, 0.07],
    [0.0001, 0.07],
  ]
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    16,
  )
}

/**
 * Vasuki, the serpent garland, in torso space (pelvis at the origin): coiled
 * over the left shoulder, hanging across the chest, rising by the right
 * shoulder with its head lifted beside the face. Tapers to the tail.
 */
export function serpentGeometry(): { body: BufferGeometry; headAt: Vector3; headDir: Vector3 } {
  const curve = new CatmullRomCurve3(
    [
      [0.06, 0.5, -0.1],
      [0.12, 0.55, -0.04],
      [0.125, 0.565, 0.03],
      [0.09, 0.48, 0.115],
      [0.03, 0.37, 0.15],
      [-0.04, 0.39, 0.145],
      [-0.1, 0.47, 0.11],
      [-0.135, 0.57, 0.035],
      [-0.165, 0.62, 0.05],
      [-0.15, 0.68, 0.09],
    ].map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    'catmullrom',
    0.4,
  )
  const tubular = 90
  const radial = 7
  const body = new TubeGeometry(curve, tubular, 0.012, radial, false)
  const pos = body.attributes.position
  const v = new Vector3()
  const c = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / (radial + 1))
    const u = ring / tubular
    curve.getPointAt(u, c)
    // Thin tail → full body → slight narrowing at the neck below the hood.
    const taper = Math.min(1, u * 5) * (u > 0.9 ? 1 - (u - 0.9) * 2.5 : 1)
    v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(0.25 + taper * 0.75).add(c)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  body.computeVertexNormals()
  const headAt = curve.getPointAt(1)
  const headDir = curve.getTangentAt(1).normalize()
  return { body, headAt, headDir }
}
