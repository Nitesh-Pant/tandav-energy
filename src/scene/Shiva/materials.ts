import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, Vector3 } from 'three'
import { PALETTE } from '../../config'
import { NOISE_GLSL } from '../../utils/glsl'

/**
 * Silhouette skin: nearly black, defined by a strong electric-blue rim from the
 * halo behind, warm fire light from the ring, and brief lightning fill.
 * The faint blue fill nods to Neelakantha without turning the figure into a poster.
 */
export function createSkinMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uBase: { value: new Color(PALETTE.skin) },
      uSkin: { value: new Color('#2a4596') },
      uRim: { value: new Color('#6aa6ff') },
      uRimStrength: { value: 0.4 },
      uHaloPos: { value: new Vector3() },
      uFireColor: { value: new Color(PALETTE.amber) },
      uFire: { value: 0 },
      uFirePos: { value: new Vector3() },
      uFlash: { value: 0 },
      uFlashPos: { value: new Vector3(0, 30, -60) },
      uFill: { value: 0.12 },
      uClimax: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uSkin, uRim, uHaloPos, uFireColor, uFirePos, uFlashPos;
      uniform float uRimStrength, uFire, uFlash, uFill, uClimax;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        if (!gl_FrontFacing) N = -N;
        float ndv = max(dot(N, V), 0.0);
        float fres = pow(1.0 - ndv, 4.0);

        vec3 toHalo = normalize(uHaloPos - vW);
        // Light wraps from behind: only surfaces turned toward the halo catch the rim.
        float back = smoothstep(-0.2, 0.7, dot(N, toHalo));
        vec3 col = uBase;

        // Rim from the halo behind: the defining silhouette light.
        col += uRim * fres * back * uRimStrength * 1.9;
        // A thinner, hotter inner rim.
        col += vec3(0.8, 0.9, 1.0) * pow(1.0 - ndv, 9.0) * back * uRimStrength * 1.6;

        // Fire from the prabha mandala behind/below: warm edge light.
        vec3 toFire = normalize(uFirePos - vW);
        float fireL = smoothstep(0.0, 1.0, dot(N, toFire));
        col += uFireColor * (fireL * 0.08 + fres * fireL * 0.9) * uFire * 0.5;

        // Lightning fill.
        vec3 toFlash = normalize(uFlashPos - vW);
        col += vec3(0.6, 0.74, 1.0) * (max(dot(N, toFlash), 0.0) * 0.32 + fres * 0.35) * uFlash;

        // Soft frontal fill so form reads, never fully revealed.
        float fill = max(dot(N, normalize(vec3(0.25, 0.55, 1.0))), 0.0);
        col += uSkin * fill * fill * uFill;

        // At the climax the figure stays a black silhouette, outlined by a hair-thin white-hot rim.
        col += vec3(1.0, 0.95, 0.9) * pow(1.0 - ndv, 10.0) * uClimax * 2.0;
        col *= 1.0 - uClimax * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

/** Flowing locks and sash: dark ribbons with luminous edges and energised tips. */
export function createStrandMaterial(edge: string, tipGlow: number, base: string = PALETTE.skin, tip: string = edge) {
  return new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    uniforms: {
      uBase: { value: new Color(base) },
      uEdge: { value: new Color(edge) },
      uTipColor: { value: new Color(tip) },
      uStrength: { value: 0.4 },
      uTip: { value: tipGlow },
      uFire: { value: 0 },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uEdge, uTipColor;
      uniform float uStrength, uTip, uFire, uFlash;
      varying vec2 vUv;
      void main() {
        float across = abs(vUv.y * 2.0 - 1.0);
        float edge = pow(across, 3.0);
        float along = vUv.x;
        vec3 col = uBase + uEdge * edge * uStrength * 0.9;
        col += uTipColor * pow(along, 3.0) * uTip * uStrength * 2.0;
        col += vec3(1.0, 0.5, 0.18) * pow(along, 3.0) * uFire * 0.12;
        col += vec3(0.7, 0.8, 1.0) * uFlash * 0.4;
        float alpha = (1.0 - smoothstep(0.85, 1.0, across)) * (1.0 - smoothstep(0.82, 1.0, along));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

/**
 * Agni in the upper left hand: a billboard flame with a hot core, a body that
 * sways and tapers, and smaller tongues that tear away above it.
 */
export function createFlameMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // Camera-facing billboard: keep the object's centre, expand in view space.
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        mv.xy += position.xy * scale;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uStrength;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float y = (p.y + 1.0) * 0.5; // 0 at the palm, 1 at the top
        vec2 q = vec2(p.x * 1.6, y * 2.2 - uTime * 2.8);
        q += vec2(fbm2(q * 1.3 + uTime * 0.4), fbm2(q * 1.3 - 3.1)) * 0.55 * y;
        float n = fbm2(q * 1.4);
        float sway = (vnoise2(vec2(uTime * 1.7, 2.0)) - 0.5) * 0.5 * y * y;
        float x = p.x - sway;
        float width = mix(0.6, 0.05, pow(y, 0.85)) * (0.8 + 0.45 * n);
        float body = smoothstep(width, width * 0.2, abs(x)) * smoothstep(0.0, 0.08, y)
          * (1.0 - smoothstep(0.5, 0.95, y + (n - 0.5) * 0.6));
        float tongues = smoothstep(0.56, 0.86, n + (1.0 - y) * 0.3) * smoothstep(0.85, 0.25, abs(x))
          * smoothstep(0.25, 0.6, y) * (1.0 - smoothstep(0.82, 1.0, y));
        float f = max(body, tongues * 0.75);
        float core = smoothstep(0.38, 0.0, length(vec2(x * 1.6, y - 0.2)));
        float heat = f * (1.0 - y * 0.55) + core * 0.7;
        vec3 col = mix(vec3(0.85, 0.1, 0.02), vec3(1.0, 0.48, 0.1), smoothstep(0.1, 0.5, heat));
        col = mix(col, vec3(1.0, 0.92, 0.72), smoothstep(0.7, 1.25, heat));
        gl_FragColor = vec4(col * (f + core * 0.5) * uStrength * 1.5, 1.0);
      }
    `,
  })
}

/** Third eye: a vertical almond of white-gold fire that opens toward the climax. */
export function createThirdEyeMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uOpen: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpen, uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float width = max(uOpen, 0.02) * 0.55 * (1.0 - p.y * p.y);
        float d = abs(p.x) / max(width, 1e-3);
        float core = smoothstep(1.0, 0.0, d) * smoothstep(1.0, 0.85, abs(p.y));
        float glow = exp(-length(p * vec2(2.0, 1.0)) * 3.0) * uOpen;
        vec3 col = mix(vec3(1.0, 0.5, 0.15), vec3(1.0, 0.97, 0.9), core);
        float flicker = 0.9 + 0.1 * sin(uTime * 23.0);
        gl_FragColor = vec4(col * (core * 2.5 + glow) * uOpen * flicker, 1.0);
      }
    `,
  })
}

/**
 * Ganga descending from the matted locks: luminous droplets travelling a
 * curve in head space. All motion is in the vertex shader.
 */
export function createGangaMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed; // phase, lateral spread, size
      uniform float uTime, uPixel;
      varying float vA;
      vec3 bezier(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
        float s = 1.0 - t;
        return s * s * s * a + 3.0 * s * s * t * b + 3.0 * s * t * t * c + t * t * t * d;
      }
      void main() {
        float u = fract(uTime * 0.22 + aSeed.x);
        vec3 p = bezier(vec3(-0.03, 0.27, -0.03), vec3(-0.2, 0.36, -0.06), vec3(-0.34, 0.1, -0.1), vec3(-0.38, -0.32, -0.12), u);
        float spread = u * u * 0.08;
        p += vec3(sin(aSeed.y * 40.0 + uTime * 2.0), cos(aSeed.y * 23.0), sin(aSeed.y * 17.0 - uTime)) * spread * aSeed.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = sin(3.14159 * u) * (1.0 - u * 0.5);
        gl_PointSize = (0.45 + aSeed.z * 1.3) * uPixel * 8.0 / max(-mv.z, 0.5);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uI;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.7, 0.88, 1.0) * a * vA * uI * 0.7, 1.0);
      }
    `,
  })
}

/** Soft additive radial glow (used for the Neelakantha throat). */
export function createGlowMaterial(color: string) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color(color) }, uI: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uI;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float g = exp(-dot(p, p) * 5.0);
        gl_FragColor = vec4(uColor * g * uI, 1.0);
      }
    `,
  })
}
