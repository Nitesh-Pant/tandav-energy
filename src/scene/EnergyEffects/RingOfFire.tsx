import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Mesh } from 'three'
import { AdditiveBlending, PlaneGeometry, ShaderMaterial } from 'three'
import { LAYOUT } from '../../config'
import { stage } from '../../choreography/stage'
import { NOISE_GLSL } from '../../utils/glsl'
import { useDisposable } from '../../utils/dispose'

/**
 * Prabha mandala — the arch of flames that rings the dancing Nataraja.
 * One shader on one quad: a hot metal ring with living fire around it.
 *
 * Fire rises, so along the sides of the arch the tongues lean upward. Each
 * tongue has its own width, height and life; a finer layer and domain-warped
 * turbulence (stronger toward the tips) keep the edge from ever repeating.
 * A faint shimmer of heat hangs above the flames. The fire climbs both sides
 * from the pedestal as it ignites.
 */
export function RingOfFire() {
  const R = LAYOUT.ringRadius
  const size = (R + 1.3) * 2
  const geometry = useMemo(() => new PlaneGeometry(size, size), [size])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFire: { value: 0 },
          uCoverage: { value: 0 },
          uHalo: { value: 0 },
          uPulse: { value: 0 },
          uR: { value: R },
          uSize: { value: size },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uFire, uCoverage, uHalo, uPulse, uR, uSize;
          varying vec2 vUv;
          ${NOISE_GLSL}
          const float PI = 3.14159265;
          void main() {
            vec2 p = (vUv - 0.5) * uSize;
            float r = length(p);
            float a = atan(p.x, -p.y); // 0 at the bottom, ±PI at the top
            float fromBottom = abs(a) / PI; // 0 bottom → 1 top
            // Open at the base where the arch meets the pedestal.
            float base = smoothstep(0.06, 0.12, fromBottom);
            // Ignition climbs both sides toward the top.
            float lit = smoothstep(uCoverage + 0.04, uCoverage - 0.04, fromBottom) * base;
            float t = uTime;

            float d = r - uR;
            // The ring itself: a thin band of hot metal, faintly visible even unlit.
            float band = exp(-pow(d / 0.028, 2.0));
            float bandGlow = exp(-abs(d) * 10.0);
            vec3 cool = vec3(0.35, 0.5, 0.9) * band * 0.18 * uHalo * base;
            // Far from the flames (or before they ignite) only the ring's faint sheen remains.
            if (lit <= 0.001 || d > 1.25 || d < -0.4) {
              gl_FragColor = vec4(cool + vec3(1.0, 0.3, 0.05) * bandGlow * 0.22 * uFire * lit, 1.0);
              return;
            }

            // Where along the arch this flame was born: on the sides, fire leans up the arch.
            float side = sin(abs(a));
            float s = a * uR - sign(a) * max(d, 0.0) * side * 0.85;

            // Tongues: cells along the arch, each with its own width, height and life.
            float cs = s / 0.4 + (vnoise2(vec2(s * 0.7, t * 0.3)) - 0.5) * 1.6;
            float id = floor(cs);
            float fx = fract(cs);
            float life = vnoise2(vec2(id * 3.7, t * 1.4 + hash12(vec2(id, 1.0)) * 10.0));
            float tall = mix(0.16, 0.8, pow(hash12(vec2(id, 7.0)), 1.6)) * (0.45 + life);
            float wid = mix(0.6, 1.0, hash12(vec2(id, 5.0)));
            float tongue = pow(max(0.0, 1.0 - abs(fx - 0.5) * 2.0 / wid), 1.3);
            float height = (0.07 + tall * tongue + 0.07 * vnoise2(vec2(s * 8.0, t * 3.0))) * (0.55 + uFire * 0.5 + uPulse * 0.5);

            // Rising turbulence, warped harder toward the tips so they curl and tear.
            float q = max(d, 0.0) / max(height, 1e-3);
            vec2 w = vec2(s * 3.0, d * 3.2 - t * 2.4);
            w += vec2(fbm2(w * 0.85 + vec2(0.0, -t * 0.5)), fbm2(w * 0.85 + vec2(5.2, 1.3))) * (0.35 + q * 1.2);
            float n = fbm2(w);
            float flame = smoothstep(1.0, 0.1, q + (0.5 - n) * 0.95) * smoothstep(-0.2, 0.02, d);

            // Short flames licking inward, toward the dancer.
            float inner = step(d, 0.0) * smoothstep(0.1 + 0.12 * n, 0.0, -d) * smoothstep(0.38, 0.75, n) * 0.55;

            float heat = clamp(flame * (1.2 - q * 0.8) + band * 0.9 + inner * 0.5, 0.0, 1.5);
            vec3 col = mix(vec3(0.32, 0.025, 0.005), vec3(1.0, 0.3, 0.05), smoothstep(0.0, 0.45, heat));
            col = mix(col, vec3(1.0, 0.7, 0.3), smoothstep(0.55, 1.0, heat));
            col = mix(col, vec3(1.0, 0.94, 0.8), smoothstep(1.05, 1.45, heat));
            float body = flame * 1.35 + band * 1.4 + bandGlow * 0.22 + inner;

            // Heat shimmer: a faint, rising glow just beyond the flames.
            float haze = smoothstep(0.0, 0.25, d) * exp(-max(d - height, 0.0) * 2.4)
              * (0.4 + 0.6 * fbm2(vec2(s * 2.2, d * 2.5 - t * 1.6))) * 0.1;

            vec3 c = (col * body + vec3(1.0, 0.42, 0.1) * haze) * uFire * lit;
            // Unlit, the arch is a faint cool sliver catching the halo.
            c += cool;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    [R, size],
  )
  useDisposable(geometry, material)

  const mesh = useRef<Mesh>(null)

  useFrame((state) => {
    // The bronze carries its own prabha; never show two rings.
    if (mesh.current) mesh.current.visible = !(stage.statueReady && stage.statue > 0.5)
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uFire.value = Math.min(1.2, stage.fire * 1.15 + stage.climax * 0.4)
    // Act II's late, low fire is enough to ignite the whole ring.
    u.uCoverage.value = Math.min(1.05, stage.fire * 4.2)
    u.uHalo.value = stage.halo
    u.uPulse.value = stage.bass * stage.energy
  })

  const [x, y, z] = LAYOUT.haloCenter
  return <mesh ref={mesh} geometry={geometry} material={material} position={[x, y, z + 0.1]} renderOrder={1} />
}
