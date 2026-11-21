/**
 * Studio reflections for the tunnel and Shape (PR 13ba): three.js's built-in
 * lit room, no download, so steel, glass and paint catch a highlight
 * instead of looking flat.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { STUDIO_LIGHT } from '../data/skies'

export interface StudioLight {
  /**
   * Give one material its own share of the light (0 keeps it out). three.js
   * ignores a material's own strength under a scene-wide light, so the
   * material gets the room as its own reflection.
   */
  share(mat: THREE.MeshStandardMaterial, amount: number): void
  dispose(): void
}

export function studioLight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, hemi: THREE.HemisphereLight): StudioLight {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const lit = pmrem.fromScene(room, 0.04)
  room.dispose()
  pmrem.dispose()
  scene.environment = lit.texture
  scene.environmentIntensity = STUDIO_LIGHT.light
  hemi.intensity *= STUDIO_LIGHT.hemi
  return {
    share(mat, amount) {
      mat.envMap = lit.texture
      mat.envMapIntensity = amount
      mat.needsUpdate = true
    },
    dispose() {
      scene.environment = null
      lit.dispose()
    },
  }
}
