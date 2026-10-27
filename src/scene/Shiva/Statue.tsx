import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Vector3, type Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { PALETTE } from '../../config'
import { stage } from '../../choreography/stage'
import { PREVIEW } from '../../utils/preview'
import { PEDESTAL_TOP } from './Shiva'

/**
 * The bronze: a photogrammetry scan of the Birmingham Museum of Art's
 * Shiva Nataraja (2013), CC BY 4.0 — see README for the credit.
 *
 * It stands in place of the living dancer before the awakening and after the
 * climax; the swaps happen inside a lightning flash / the climax burst, so the
 * statue appears to come alive and return to bronze.
 *
 * The scan's own unlit, baked-colour material is replaced with a physical
 * bronze that our halo, fire and lightning light, plus a halo-coloured rim
 * (the same silhouette language as the dancer).
 */

const URL = `${import.meta.env.BASE_URL}models/nataraja.glb`
/** World height of the sculpture including its prabha (ring of fire). */
const TARGET_HEIGHT = 4.5

export function Statue() {
  const [model, setModel] = useState<Group | null>(null)
  const group = useRef<Group>(null)
  const rim = useMemo(() => ({ uRim: { value: new Color(PALETTE.ice) }, uRimStrength: { value: 0.5 } }), [])

  useEffect(() => {
    let disposed = false
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load(
      URL,
      (gltf) => {
        if (disposed) return
        const root = gltf.scene
        root.traverse((o) => {
          const mesh = o as Mesh
          if (!mesh.isMesh) return
          // The web build drops normals (the source was unlit); rebuild them for lighting.
          if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals()
          const old = mesh.material as MeshStandardMaterial
          const map = (old as { map?: Texture | null }).map ?? null
          const mat = new MeshStandardMaterial({ map, color: '#d8c3a0', metalness: 0.55, roughness: 0.5 })
          mat.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, rim)
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimStrength;')
              .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                {
                  float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.5);
                  totalEmissiveRadiance += uRim * fres * uRimStrength;
                }`,
              )
          }
          old.dispose()
          mesh.material = mat
        })
        // Normalise: stand it on the pedestal, centred, at a fixed height.
        root.updateMatrixWorld(true)
        const box = new Box3().setFromObject(root)
        const size = box.getSize(new Vector3())
        const centre = box.getCenter(new Vector3())
        const scale = TARGET_HEIGHT / size.y
        const holder = new Group()
        root.position.set(-centre.x, -box.min.y, -centre.z)
        holder.add(root)
        holder.scale.setScalar(scale)
        setModel(holder)
        stage.statueReady = true
      },
      undefined,
      (err) => {
        console.warn('[tandav] Statue model unavailable; the dancer stays throughout.', err)
        stage.statueReady = false
      },
    )
    return () => {
      disposed = true
    }
  }, [rim])

  useEffect(
    () => () => {
      model?.traverse((o) => {
        const mesh = o as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        const mat = mesh.material as MeshStandardMaterial
        mat.map?.dispose()
        mat.dispose()
      })
    },
    [model],
  )

  useFrame(() => {
    if (!group.current) return
    group.current.visible = PREVIEW.statue || stage.statue > 0.5
    rim.uRimStrength.value = 0.15 + stage.halo * 0.9 + stage.flash * 0.6
  })

  if (!model) return null
  return (
    <group ref={group} position={[0, PEDESTAL_TOP - 0.12, -0.1]}>
      <primitive object={model} />
    </group>
  )
}
