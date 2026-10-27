import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { QUALITY } from '../../config'
import { stage } from '../../choreography/stage'
import { useUI } from '../../state/store'
import { mulberry32 } from '../../utils/math'
import { useDisposable } from '../../utils/dispose'

/** Distant starfield with per-star colour temperature and twinkle. */
export function Stars() {
  const count = QUALITY[useUI((s) => s.quality)].stars
  const geometry = useMemo(() => {
    const rand = mulberry32(42)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      // Upper hemisphere, biased away from straight overhead.
      const u = rand() * 2 - 1
      const y = Math.abs(u) * 0.95 - 0.05
      const r = Math.sqrt(1 - y * y)
      const a = rand() * Math.PI * 2
      pos.set([Math.cos(a) * r * 800, y * 800, Math.sin(a) * r * 800], i * 3)
      seed.set([rand(), Math.pow(rand(), 6)], i * 2)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 2))
    return g
  }, [count])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uVisible: { value: 0.5 }, uPixel: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec2 aSeed;
          uniform float uTime, uPixel;
          varying float vB;
          varying vec3 vC;
          void main() {
            float tw = 0.6 + 0.4 * sin(uTime * (0.5 + aSeed.x * 2.5) + aSeed.x * 40.0);
            vB = (0.25 + aSeed.y * 2.5) * tw;
            vC = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), step(0.85, aSeed.x));
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
            gl_PointSize = (1.0 + aSeed.y * 3.0) * uPixel;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uVisible;
          varying float vB;
          varying vec3 vC;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vC * vB * a * uVisible, 1.0);
          }
        `,
      }),
    [],
  )
  useDisposable(geometry, material)

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uPixel.value = state.gl.getPixelRatio()
    // Stars fade in from the void and recede a little in the brightest passages.
    material.uniforms.uVisible.value = 0.45 + stage.dust * 0.4 - stage.energy * 0.2
  })

  return <points geometry={geometry} material={material} renderOrder={-9} frustumCulled={false} />
}
