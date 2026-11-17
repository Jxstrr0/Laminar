/**
 * The people's smooth body parts (PR 13q): shapes made in Blender
 * (art/body/build.py → public/models/body.glb) that riderFigure lays
 * between the joints the sim works out, in place of plain capsules. Kelbo
 * chose "Blender parts, code poses" (17 November 2026).
 *
 * The game asks for them once at start-up (main.ts). Until they arrive, or
 * if they never do (offline with an old cache), every figure keeps its
 * capsules, so nothing ever waits on them. The tests never load them.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type PartName = 'Thigh' | 'Shin' | 'UpperArm' | 'Forearm' | 'Torso' | 'Hand' | 'Head' | 'Shoe' | 'Boot' | 'RoadHelmet' | 'BobHelmet'

export interface BodyPart {
  geometry: THREE.BufferGeometry
  /** A limb's or the torso's joint-to-joint length as built, m. */
  length: number
  /** Its reference thickness as built, m (radius 1 for the head and the sliding helmet). */
  radius: number
  /** A shoe's or boot's nominal box as built (length, height, width), m. */
  size: THREE.Vector3
}

const parts = new Map<string, BodyPart>()
let loading: Promise<void> | null = null

/** A part, if the model has loaded. */
export function bodyPart(name: PartName): BodyPart | undefined {
  return parts.get(name)
}

/** Load the parts once; resolves when they're in (or have failed: the capsules stay). */
export function loadBodyParts(): Promise<void> {
  loading ??= new Promise((resolve) => {
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/body.glb`,
      (gltf) => {
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return
          const extras = o.userData as { length?: number; radius?: number; size?: number[] }
          const size = extras.size ?? [1, 1, 1]
          parts.set(o.name, {
            geometry: o.geometry as THREE.BufferGeometry,
            length: extras.length ?? 1,
            radius: extras.radius ?? 1,
            size: new THREE.Vector3(size[0], size[1], size[2]),
          })
        })
        resolve()
      },
      undefined,
      () => resolve(),
    )
  })
  return loading
}
