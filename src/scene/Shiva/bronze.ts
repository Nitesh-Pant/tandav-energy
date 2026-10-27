import {
  BackSide,
  Color,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { PALETTE } from '../../config'

/**
 * Living bronze: the dancer is the statue come alive, so he shares its metal.
 *
 * A physical bronze lit by the scene's halo, fire and lightning, plus terms
 * the scene's lighting (all from behind) can't give:
 *  - a halo-coloured rim, the silhouette language of the whole piece;
 *  - warm fire light rising from the ring below;
 *  - a soft camera-relative key, so the sculpted form reads from every shot;
 *  - faint patina and roughness variation, so the metal isn't plastic.
 *
 * Uniforms are shared objects: one update per frame drives every part.
 */
export interface BronzeUniforms {
  uRim: { value: Color }
  uRimStrength: { value: number }
  uFire: { value: number }
  uFireColor: { value: Color }
  uKey: { value: number }
  uClimax: { value: number }
}

export function createBronzeUniforms(): BronzeUniforms {
  return {
    uRim: { value: new Color('#7fb2ff') },
    uRimStrength: { value: 0.3 },
    uFire: { value: 0 },
    uFireColor: { value: new Color(PALETTE.amber) },
    uKey: { value: 0.3 },
    uClimax: { value: 0 },
  }
}

const NOISE = /* glsl */ `
  float bHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bNoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bHash(i), bHash(i + vec3(1,0,0)), f.x), mix(bHash(i + vec3(0,1,0)), bHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(bHash(i + vec3(0,0,1)), bHash(i + vec3(1,0,1)), f.x), mix(bHash(i + vec3(0,1,1)), bHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`

export function createBronzeMaterial(
  u: BronzeUniforms,
  opts: { color: string; metalness: number; roughness: number; patina?: number; envMap?: Texture | null },
) {
  const mat = new MeshStandardMaterial({
    color: opts.color,
    metalness: opts.metalness,
    roughness: opts.roughness,
    envMap: opts.envMap ?? null,
    envMapIntensity: 0.8,
  })
  const patina = (opts.patina ?? 1).toFixed(3)
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObj;
        uniform vec3 uRim, uFireColor;
        uniform float uRimStrength, uFire, uKey, uClimax;
        ${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float pn = bNoise(vObj * 38.0) * 0.6 + bNoise(vObj * 110.0) * 0.4;
        diffuseColor.rgb *= mix(0.8, 1.1, pn);
        // Verdigris settles where the noise is low.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.17, 0.13), smoothstep(0.42, 0.18, pn) * 0.35 * ${patina});`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(0.8, 1.2, pn), 0.05, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 Nv = normalize(normal);
          vec3 Vv = normalize(vViewPosition);
          float ndv = clamp(dot(Nv, Vv), 0.0, 1.0);
          totalEmissiveRadiance += uRim * pow(1.0 - ndv, 3.2) * uRimStrength;
          // Fire from the ring rises from below and behind.
          float below = smoothstep(0.4, -0.6, Nv.y);
          totalEmissiveRadiance += uFireColor * (pow(1.0 - ndv, 2.2) * 0.5 + below * 0.08) * uFire;
          float key = max(dot(Nv, normalize(vec3(-0.45, 0.6, 0.65))), 0.0);
          totalEmissiveRadiance += diffuseColor.rgb * (key * key * uKey + 0.04 * uKey);
          totalEmissiveRadiance += vec3(1.0, 0.95, 0.9) * pow(1.0 - ndv, 9.0) * uClimax * 2.0;
        }`,
      )
  }
  return mat
}

/**
 * A tiny pre-filtered environment for the metal to reflect: a warm floor,
 * a deep-blue sky, the halo's blue glow behind and a band of firelight.
 * Rendered once.
 */
export function createBronzeEnvironment(gl: WebGLRenderer): Texture {
  const scene = new Scene()
  const geo = new SphereGeometry(10, 48, 24)
  const mat = new ShaderMaterial({
    side: BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vP;
      void main() {
        vec3 d = normalize(vP);
        vec3 col = mix(vec3(0.06, 0.035, 0.02), vec3(0.025, 0.04, 0.1), smoothstep(-0.25, 0.5, d.y));
        // The halo behind the dancer.
        col += vec3(0.25, 0.42, 1.0) * exp(-pow(length(d - normalize(vec3(0.0, 0.2, -1.0))) / 0.4, 2.0)) * 0.75;
        // Firelight low on the horizon behind.
        col += vec3(1.0, 0.5, 0.18) * exp(-pow((d.y + 0.05) / 0.14, 2.0)) * smoothstep(0.3, -0.8, d.z) * 0.9;
        // A soft warm key in front, upper left.
        col += vec3(0.75, 0.55, 0.35) * exp(-pow(length(d - normalize(vec3(-0.5, 0.6, 0.8))) / 0.55, 2.0)) * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  scene.add(new Mesh(geo, mat))
  const pmrem = new PMREMGenerator(gl)
  const rt = pmrem.fromScene(scene, 0.02)
  pmrem.dispose()
  geo.dispose()
  mat.dispose()
  return rt.texture
}
