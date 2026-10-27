import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Shape, ShapeGeometry, ShaderMaterial, Vector3 } from 'three'
import { LAYOUT, PALETTE } from '../../config'
import { stage } from '../../choreography/stage'
import { fbm1, mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'
import { getNoiseTexture } from '../../utils/noiseTexture'

/**
 * Layered mountain ranges wrapping the horizon behind the figure, with Mount
 * Kailash on the far range and temple shikharas on the middle peaks.
 *
 * Each range is a union of individual peaks (asymmetric, concave flanks)
 * over low foothills, with fine rock detail scaled by height — distinct
 * mountains rather than a noisy line. Far ranges are paler and bluer.
 */

interface Layer {
  radius: number
  height: number
  seed: number
  peaks: number
  depth: number // 0 near … 1 far
}

const LAYERS: Layer[] = [
  { radius: 150, height: 17, seed: 3, peaks: 12, depth: 0 },
  { radius: 240, height: 36, seed: 11, peaks: 14, depth: 0.35 },
  { radius: 360, height: 62, seed: 23, peaks: 13, depth: 0.65 },
  { radius: 560, height: 100, seed: 37, peaks: 11, depth: 1 },
]
const ARC = 2.1 // radians either side of straight-behind
const KAILASH_ANGLE = -0.42

function kailash(angle: number, radius: number) {
  // The distinctive rounded pyramid, rising well above the far range.
  const x = (angle - KAILASH_ANGLE) / 0.2
  if (Math.abs(x) > 1) return 0
  const ax = Math.abs(x + 0.06)
  const pyramid = Math.pow(Math.max(0, 1 - ax), 1.3)
  const dome = 1 - Math.pow(Math.min(1, ax / 0.16), 2) * 0.05
  const rough = 1 + fbm1(angle * 70, 3, 3) * 0.035 * ax
  return (pyramid * dome * rough * 140 * radius) / 560
}

function rangeProfile(layer: Layer) {
  const rand = mulberry32(layer.seed)
  const spacing = (ARC * 2) / layer.peaks
  const peaks = Array.from({ length: layer.peaks + 2 }, (_, i) => ({
    c: -ARC - spacing + (i + 0.5 + (rand() - 0.5) * 0.7) * spacing,
    h: 0.3 + Math.pow(rand(), 0.7) * 0.7,
    wl: (0.8 + rand() * 0.9) * spacing,
    wr: (0.8 + rand() * 0.9) * spacing,
  }))
  return (angle: number) => {
    let h = 0
    for (const p of peaks) {
      const x = angle - p.c
      const u = Math.abs(x) / (x < 0 ? p.wl : p.wr)
      // Near-straight flanks and a sharp summit: a Himalayan pyramid, not a dune.
      if (u < 1) h = Math.max(h, p.h * Math.pow(1 - u, 1.15))
    }
    const foothills = 0.08 + (fbm1(angle * 3 + layer.seed, layer.seed, 3) * 0.5 + 0.5) * 0.1
    h = Math.max(h, foothills)
    // Ridged rock detail grows with height: smooth valleys, broken crests.
    const ridged = 1 - Math.abs(fbm1(angle * 26 * (1 + layer.depth * 0.6), layer.seed + 7, 4)) * 2
    h += ridged * 0.07 * h
    // A lower saddle directly behind the figure, so the halo sits in a valley.
    h *= 0.6 + 0.4 * Math.min(1, Math.abs(angle) / 0.55)
    return h * layer.height
  }
}

function buildLayer(layer: Layer, segments: number) {
  const profile = rangeProfile(layer)
  const verts: number[] = []
  const ridge: number[] = []
  const snow: number[] = []
  const slope: number[] = []
  const index: number[] = []
  const base = LAYOUT.seaLevel - 40
  const peaks: { angle: number; h: number }[] = []
  const heights: number[] = []
  const snowLine = layer.height * 0.72
  for (let i = 0; i <= segments; i++) {
    const angle = -ARC + (i / segments) * ARC * 2
    let h = profile(angle)
    let s = layer.depth >= 0.65 ? Math.max(0, Math.min(1, (h - snowLine) / (layer.height * 0.2))) : 0
    if (layer.depth === 1) {
      const k = kailash(angle, layer.radius)
      if (k > h) {
        h = k
        s = 1
      }
    }
    heights.push(h)
    snow.push(s, s)
  }
  for (let i = 0; i <= segments; i++) {
    const angle = -ARC + (i / segments) * ARC * 2
    const h = heights[i]
    if (i > 0 && i < segments && h > heights[i - 1] && h >= heights[i + 1]) peaks.push({ angle, h })
    // Slope in world units per unit of arc, for flank lighting.
    const dh = (heights[Math.min(segments, i + 1)] - heights[Math.max(0, i - 1)]) / ((2 * ARC * 2 * layer.radius) / segments)
    const x = Math.sin(angle) * layer.radius
    const z = -Math.cos(angle) * layer.radius
    const top = LAYOUT.seaLevel + h
    verts.push(x, top, z, x, base, z)
    ridge.push(top, top)
    slope.push(dh, dh)
    if (i < segments) {
      const v = i * 2
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))
  g.setAttribute('aRidge', new BufferAttribute(new Float32Array(ridge), 1))
  g.setAttribute('aSnow', new BufferAttribute(new Float32Array(snow), 1))
  g.setAttribute('aSlope', new BufferAttribute(new Float32Array(slope), 1))
  g.setIndex(index)
  return { geometry: g, peaks }
}

/** Nagara shikhara silhouette: platform, curvilinear tower, amalaka, kalasha. */
function shikharaGeometry() {
  const s = new Shape()
  const pts: [number, number][] = [
    [-1.6, 0],
    [-1.6, 0.6],
    [-1.25, 0.6],
    [-1.25, 1.3],
    [-1.05, 1.3],
  ]
  // Curvilinear tower (left side), then mirrored.
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    pts.push([-1.05 * (1 - Math.pow(t, 1.8) * 0.72), 1.3 + t * 3.6])
  }
  const left = [...pts, [-0.42, 5.0], [-0.5, 5.2], [-0.42, 5.4], [-0.15, 5.45], [-0.12, 5.9], [-0.04, 6.3]] as [number, number][]
  const right = left.map(([x, y]) => [-x, y] as [number, number]).reverse()
  const all = [...left, [0, 6.45] as [number, number], ...right]
  s.moveTo(all[0][0], all[0][1])
  for (const [x, y] of all.slice(1)) s.lineTo(x, y)
  s.closePath()
  return new ShapeGeometry(s)
}

function mountainMaterial(layer: Layer) {
  const near = new Color('#020309')
  const far = new Color('#0b1030')
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uNoise: { value: getNoiseTexture() },
      uColor: { value: near.clone().lerp(far, layer.depth) },
      uHaze: { value: new Color('#05071a').lerp(new Color('#10173f'), layer.depth) },
      uRim: { value: new Color(PALETTE.ice) },
      uDepth: { value: layer.depth },
      uRadius: { value: layer.radius },
      uHeight: { value: layer.height },
      uHalo: { value: 0 },
      uFlash: { value: 0 },
      uFlashPos: { value: new Vector3() },
      uFire: { value: 0 },
      uSea: { value: LAYOUT.seaLevel },
    },
    vertexShader: /* glsl */ `
      attribute float aRidge;
      attribute float aSnow;
      attribute float aSlope;
      varying vec3 vW;
      varying float vRidge;
      varying float vSnow;
      varying float vSlope;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vRidge = aRidge;
        vSnow = aSnow;
        vSlope = aSlope;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform vec3 uColor, uHaze, uRim, uFlashPos;
      uniform float uDepth, uRadius, uHeight, uHalo, uFlash, uFire, uSea;
      varying vec3 vW;
      varying float vRidge;
      varying float vSnow;
      varying float vSlope;
      void main() {
        float below = vRidge - vW.y;
        // Height in units of this range's typical height — absolute, so tall
        // peaks (Kailash) shade continuously with their neighbours.
        float hNorm = clamp((vW.y - uSea) / uHeight, 0.0, 1.4);
        float ang = atan(vW.x, -vW.z);

        // Relief: gullies running down the faces (stretched noise), strongest near the summits.
        float arc = ang * uRadius;
        float g = texture2D(uNoise, vec2(arc * 0.02, vW.y * 0.015)).r;
        g = g * 0.6 + texture2D(uNoise, vec2(arc * 0.06, vW.y * 0.04) + 0.3).r * 0.4;
        float relief = mix(1.0, 0.85 + g * 0.3, smoothstep(0.3, 0.9, hNorm));

        // Flanks turned toward the centre of the scene catch a little of the halo.
        float facing = clamp(vSlope * sign(ang) * 1.6, -1.0, 1.0);
        vec3 col = uColor * relief * (1.0 + facing * 0.35 * (0.4 + uHalo));

        // Haze pools low in the valleys and thickens with distance.
        col = mix(uHaze, col, smoothstep(0.0, 0.55, hNorm));
        // The faintest edge light along the crest.
        col += uRim * exp(-below * 2.2) * (0.006 + uHalo * 0.03) * (1.0 - uDepth * 0.5);

        // Snow on the high far peaks and on Kailash.
        float snow = vSnow * smoothstep(0.7, 1.1, hNorm) * (0.6 + g * 0.5);
        col += vec3(0.3, 0.36, 0.55) * snow * (0.05 + uHalo * 0.08);

        // Lightning reveals the ranges, strongest near the strike; valleys stay dark.
        float dist = length(vW.xz - uFlashPos.xz);
        float nearF = exp(-dist / (70.0 + uDepth * 90.0));
        float lit = (0.04 + nearF * 0.8) * pow(min(hNorm, 1.0), 1.6) * relief;
        col += vec3(0.45, 0.56, 0.95) * uFlash * lit * (1.0 - uDepth * 0.35);
        col += vec3(0.75, 0.82, 1.0) * snow * uFlash * (0.15 + nearF * 0.6);
        col += vec3(0.6, 0.2, 0.05) * uFire * 0.03 * hNorm * (1.0 - uDepth);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Temples are pure silhouettes; lightning briefly reveals their stone. */
function templeMaterial() {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uHalo: { value: 0 },
      uFlash: { value: 0 },
      uFlashPos: { value: new Vector3() },
      uFire: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHalo, uFlash;
      varying vec2 vLocal;
      void main() {
        vec3 col = vec3(0.012, 0.016, 0.04);
        col += vec3(0.45, 0.55, 0.9) * uFlash * (0.25 + vLocal.y * 0.06);
        col += vec3(0.25, 0.4, 0.9) * smoothstep(5.6, 6.4, vLocal.y) * uHalo * 0.3;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

export function Mountains() {
  const built = useMemo(() => {
    const layers = LAYERS.map((l) => {
      const { geometry, peaks } = buildLayer(l, 700)
      return { layer: l, geometry, peaks, material: mountainMaterial(l) }
    })
    // Temples on a few prominent peaks of the second range.
    const mid = layers[1]
    const wanted = [-0.95, 0.55, 1.2]
    const temples = wanted.map((a, i) => {
      const peak = mid.peaks.reduce((best, p) => (Math.abs(p.angle - a) < Math.abs(best.angle - a) ? p : best), mid.peaks[0])
      const r = mid.layer.radius - 1
      const scale = 1.5 + (i % 2) * 0.5
      return {
        position: [Math.sin(peak.angle) * r, LAYOUT.seaLevel + peak.h - 0.8, -Math.cos(peak.angle) * r] as [number, number, number],
        rotationY: -peak.angle,
        scale,
      }
    })
    return { layers, temples, templeGeo: shikharaGeometry(), templeMat: templeMaterial() }
  }, [])

  useDisposable(
    built.templeGeo,
    built.templeMat,
    ...built.layers.map((l) => l.geometry),
    ...built.layers.map((l) => l.material),
  )

  useFrame(() => {
    const all = [...built.layers.map((l) => l.material), built.templeMat]
    for (const m of all) {
      m.uniforms.uHalo.value = stage.halo
      m.uniforms.uFlash.value = stage.flash
      m.uniforms.uFlashPos.value.set(stage.flashX, stage.flashY, stage.flashZ)
      m.uniforms.uFire.value = stage.fire
    }
  })

  return (
    <group>
      {built.layers.map((l, i) => (
        <mesh key={i} geometry={l.geometry} material={l.material} renderOrder={-8 + i} frustumCulled={false} />
      ))}
      {built.temples.map((t, i) => (
        <mesh
          key={`t${i}`}
          geometry={built.templeGeo}
          material={built.templeMat}
          position={t.position}
          rotation={[0, t.rotationY, 0]}
          scale={t.scale}
        />
      ))}
    </group>
  )
}
