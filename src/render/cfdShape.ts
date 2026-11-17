/**
 * The model's surface for the CFD Cluster (PR 12b): the same figure the
 * tunnel draws (riderFigure.ts builds every sport), turned to the
 * turntable's yaw, as plain triangles in the flow's frame for
 * src/cfd/voxel.ts. The mount, floor and smoke stay out: the CFD sees the
 * model alone in open air.
 *
 * Frames: the figure faces +x with y up and z to its left; the flow's frame
 * runs the air along +x (so the nose points to −x), y across and z up.
 */
import * as THREE from 'three'
import { buildRider, disposeGroup, type RiderState } from './riderFigure'

/** One flat triangle list per mesh, in metres, in the flow's frame, at full scale. */
export function cfdTriangles(state: RiderState, yawDeg: number): Float32Array[] {
  const figure = buildRider(state)
  const turn = new THREE.Group()
  // The turntable's yaw (tunnelScene.ts setYaw), then about-face so the nose meets the air.
  turn.rotation.y = (-yawDeg * Math.PI) / 180 + Math.PI
  turn.add(figure)
  turn.updateMatrixWorld(true)
  const out: Float32Array[] = []
  const v = new THREE.Vector3()
  turn.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.visible) return
    const geom = obj.geometry as THREE.BufferGeometry
    const pos = geom.getAttribute('position')
    if (!pos) return
    const index = geom.getIndex()
    const count = index ? index.count : pos.count
    const tris = new Float32Array(Math.floor(count / 3) * 9)
    for (let i = 0; i < tris.length / 3; i++) {
      v.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(obj.matrixWorld)
      // Figure (x forward, y up, z left) after the about-face → flow frame (x downstream, y across, z up).
      tris[i * 3] = v.x
      tris[i * 3 + 1] = v.z
      tris[i * 3 + 2] = v.y
    }
    out.push(tris)
  })
  disposeGroup(figure)
  return out
}
