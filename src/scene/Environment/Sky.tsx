import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { PALETTE } from '../../config'
import { stage } from '../../choreography/stage'
import { NOISE_GLSL } from '../../utils/glsl'
import { useDisposable } from '../../utils/dispose'
import { useUI } from '../../state/store'
import { QUALITY } from '../../config'

/**
 * Sky dome: midnight gradient, an indigo nebula that slowly churns, and
 * cloud structure that lightning lights up from within.
 */
export function Sky() {
  const quality = useUI((s) => s.quality)
  const octaves = QUALITY[quality].skyOctaves
  const geometry = useMemo(() => new SphereGeometry(900, 48, 24), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        defines: { OCTAVES: octaves },
        uniforms: {
          uTime: { value: 0 },
          uNebula: { value: 0.2 },
          uFlash: { value: 0 },
          uFlashDir: { value: new Vector3(0, 0.3, -1) },
          uHalo: { value: 0 },
          uFire: { value: 0 },
          uZenith: { value: new Color(PALETTE.void) },
          uHorizon: { value: new Color(PALETTE.deepIndigo) },
          uNeb1: { value: new Color(PALETTE.indigo) },
          uNeb2: { value: new Color(PALETTE.electric) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // pin to the far plane
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uNebula, uFlash, uHalo, uFire;
          uniform vec3 uFlashDir, uZenith, uHorizon, uNeb1, uNeb2;
          varying vec3 vDir;
          ${NOISE_GLSL}
          float fbm3(vec3 p) {
            float s = 0.0, a = 0.5;
            for (int i = 0; i < OCTAVES; i++) { s += a * vnoise3(p); p = p * 2.07 + 11.3; a *= 0.5; }
            return s;
          }
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, h));
            // A cool glow on the horizon behind the figure.
            float behind = max(-d.z, 0.0);
            col += uNeb1 * pow(behind, 6.0) * smoothstep(0.35, -0.05, h) * (0.25 + uHalo * 0.6);

            // Nebula: domain-warped fbm concentrated in a band across the sky behind.
            vec3 q = d * 2.2 + vec3(0.0, 0.0, uTime * 0.006);
            float w = fbm3(q);
            float n = fbm3(q * 1.8 + w * 1.6 + vec3(uTime * 0.004, 0.0, 0.0));
            float band = exp(-pow((h - 0.22 - d.x * 0.18) / 0.32, 2.0)) * smoothstep(0.1, 0.8, behind + 0.2);
            float neb = smoothstep(0.42, 0.85, n) * band;
            float filaments = smoothstep(0.55, 0.62, n) * smoothstep(0.7, 0.62, n) * band;
            vec3 nebCol = mix(uNeb1, uNeb2, smoothstep(0.55, 0.9, n));
            nebCol = mix(nebCol, vec3(1.0, 0.45, 0.2), smoothstep(0.75, 1.0, n) * uFire * 0.4);
            col += nebCol * (neb * 0.55 + filaments * 0.35) * uNebula;

            // Lightning: the cloud mass glows from within near the strike.
            float near = pow(max(dot(d, normalize(uFlashDir)), 0.0), 5.0);
            col += vec3(0.55, 0.65, 1.0) * (near * (0.25 + neb * 2.2 + w * 0.4) + neb * 0.4) * uFlash;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [octaves],
  )
  useDisposable(geometry, material)
  const tmp = useMemo(() => new Vector3(), [])

  useFrame((state) => {
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uNebula.value = 0.18 + stage.energy * 0.7 + stage.halo * 0.15
    u.uFlash.value = stage.flash
    u.uFlashDir.value.copy(tmp.set(stage.flashX, stage.flashY, stage.flashZ).normalize())
    u.uHalo.value = stage.halo
    u.uFire.value = stage.fire
  })

  return <mesh geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} />
}
