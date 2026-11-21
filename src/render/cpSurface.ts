/**
 * Pressure colour on the model (Isobar, PR 13i). While the pressure taps
 * instrument is on, the model's skin wears the taps' latest scan: each vertex
 * takes the Cp of its nearest taps, blended by distance, through the same
 * colour scale as the dots and the legend (cpScale.ts). Thin isobar lines are
 * drawn where that Cp crosses each legend tick.
 *
 * The colours are the taps' readings, never extra truth: away from any tap the
 * skin fades back to its plain matte colour. Kelbo, 16 November 2026: only
 * while the taps are on, so the colour never gives away what the taps sell.
 *
 * Work happens on change only: when a new scan arrives (at most four times a
 * second while the setting moves) or the model is rebuilt. Nothing per frame.
 * The figure's own materials are shared with the Shape screen, so a painted
 * mesh borrows a copy of its geometry and this file's material, and gets its
 * own back when the paint comes off.
 */
import * as THREE from 'three'
import { CP_PALETTE, TAPS } from '../data/flowViz'
import type { Tap } from '../sim/flow/taps'
import { cpRgb } from './cpScale'

/** Each vertex blends this many nearest taps. */
const NEAREST = 4
/**
 * How far a vertex may sit from its nearest tap, m at full size: within `full`
 * it wears the scan's colour, past `none` its own plain colour, fading between.
 */
const REACH = { full: TAPS.spacing * 0.9, none: TAPS.spacing * 2 }
/** Isobar lines every legend tick: the gap between ticks, in Cp. */
const LINE_STEP = (CP_PALETTE.ticks[1] ?? 1) - (CP_PALETTE.ticks[0] ?? 0)
/** How dark a line draws over the colour beneath it (0 none, 1 black). */
const LINE_INK = 0.45
/** Phones with this few cores or fewer skip the lines and keep only the colours. */
const SLOW_CORES = 4

/** Marks a figure's root: meshes under it may wear the paint. Set by riderFigure's buildRider. */
export const CP_SURFACE = 'cpSurface'

interface Painted {
  mesh: THREE.Mesh
  geometry: THREE.BufferGeometry
  material: THREE.Material | THREE.Material[]
  /** Each vertex's nearest taps and their weights (NEAREST per vertex). */
  near: Int32Array
  weight: Float32Array
  /** 1 where the scan reaches the vertex, 0 where it keeps its own colour. */
  cover: Float32Array
  /** The mesh's own colour, linear RGB. */
  base: THREE.Color
}

export interface CpSurface {
  /** Paint the figures under `root` from a scan; `frame` is the object whose local space is the taps' full-size metres. */
  paint(root: THREE.Object3D, frame: THREE.Object3D, taps: readonly Tap[], cps: readonly number[]): void
  /** Take the paint off and give every mesh its own geometry and material back. */
  clear(): void
  /** The paint's one material, so the tunnel can keep its studio reflections off it (PR 13ba). */
  readonly material: THREE.MeshStandardMaterial
  dispose(): void
}

/** Only plain matte parts take the paint: not see-through props, not parts glowing as broken or strained. */
function paintable(mesh: THREE.Mesh): THREE.Color | null {
  if (mesh instanceof THREE.InstancedMesh || !mesh.visible || Array.isArray(mesh.material)) return null
  const m = mesh.material
  if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshLambertMaterial)) return null
  if (m.transparent || (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0)) return null
  return m.color.clone()
}

function slowPhone(): boolean {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0
  return cores > 0 && cores <= SLOW_CORES
}

export function createCpSurface(): CpSurface {
  const lines = !slowPhone()
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
  if (lines) {
    // Lines where the blended Cp crosses a tick, a pixel or so wide at any zoom (fwidth), faded where the scan doesn't reach.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 cpw;\nvarying vec2 vCpw;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCpw = cpw;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCpw;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float cpStep = vCpw.x / ${LINE_STEP.toFixed(3)};
          float cpGap = abs(fract(cpStep + 0.5) - 0.5) / max(fwidth(cpStep), 1e-4);
          float cpLine = (1.0 - clamp(cpGap - 0.5, 0.0, 1.0)) * vCpw.y;
          diffuseColor.rgb *= 1.0 - ${LINE_INK.toFixed(2)} * cpLine;`,
        )
    }
    material.customProgramCacheKey = () => 'cp-isobars'
  }

  let painted: Painted[] = []
  let paintedRoot: THREE.Object3D | null = null
  let layoutKey = ''
  const colour = new THREE.Color()
  const p = new THREE.Vector3()
  const toFrame = new THREE.Matrix4()

  function clear() {
    for (const x of painted) {
      x.mesh.geometry.dispose()
      x.mesh.geometry = x.geometry
      x.mesh.material = x.material
    }
    painted = []
    paintedRoot = null
    layoutKey = ''
  }

  /** Borrow every paintable mesh under the figures and work out which taps each vertex listens to. */
  function lay(root: THREE.Object3D, frame: THREE.Object3D, taps: readonly Tap[]) {
    clear()
    root.updateWorldMatrix(true, true)
    frame.updateWorldMatrix(true, false)
    const fromWorld = frame.matrixWorld.clone().invert()
    const tx = new Float32Array(taps.length)
    const ty = new Float32Array(taps.length)
    const tz = new Float32Array(taps.length)
    taps.forEach((t, i) => {
      tx[i] = t.point.x
      ty[i] = t.point.y
      tz[i] = t.point.z
    })
    const k = Math.min(NEAREST, taps.length)
    const bestI = new Int32Array(k)
    const bestD = new Float32Array(k)
    const visit = (o: THREE.Object3D, inFigure: boolean) => {
      const under = inFigure || o.userData[CP_SURFACE] === true
      if (under && o instanceof THREE.Mesh) {
        const base = paintable(o)
        const pos = o.geometry.getAttribute('position')
        if (base && pos) {
          const n = pos.count
          const near = new Int32Array(n * NEAREST)
          const weight = new Float32Array(n * NEAREST)
          const cover = new Float32Array(n)
          toFrame.multiplyMatrices(fromWorld, o.matrixWorld)
          for (let v = 0; v < n; v++) {
            p.fromBufferAttribute(pos, v).applyMatrix4(toFrame)
            // The k nearest taps, by squared distance (a small insertion list).
            bestD.fill(Infinity)
            for (let i = 0; i < taps.length; i++) {
              const dx = tx[i]! - p.x
              const dy = ty[i]! - p.y
              const dz = tz[i]! - p.z
              const d = dx * dx + dy * dy + dz * dz
              if (d >= bestD[k - 1]!) continue
              let j = k - 1
              while (j > 0 && bestD[j - 1]! > d) {
                bestD[j] = bestD[j - 1]!
                bestI[j] = bestI[j - 1]!
                j--
              }
              bestD[j] = d
              bestI[j] = i
            }
            // Inverse-distance weights, so a vertex right on a tap reads that tap.
            let sum = 0
            for (let j = 0; j < k; j++) sum += 1 / (bestD[j]! + 1e-6)
            for (let j = 0; j < k; j++) {
              near[v * NEAREST + j] = bestI[j]!
              weight[v * NEAREST + j] = 1 / (bestD[j]! + 1e-6) / sum
            }
            const d0 = Math.sqrt(bestD[0]!)
            cover[v] = Math.min(1, Math.max(0, (REACH.none - d0) / (REACH.none - REACH.full)))
          }
          const geometry = o.geometry
          const copy = geometry.clone()
          copy.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
          copy.setAttribute('cpw', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
          painted.push({ mesh: o, geometry, material: o.material, near, weight, cover, base })
          o.geometry = copy
          o.material = material
        }
      }
      for (const c of o.children) visit(c, under)
    }
    visit(root, false)
    paintedRoot = root
  }

  /** Colour every borrowed vertex from the scan. */
  function colourIn(cps: readonly number[]) {
    for (const x of painted) {
      const col = x.mesh.geometry.getAttribute('color') as THREE.BufferAttribute
      const cpw = x.mesh.geometry.getAttribute('cpw') as THREE.BufferAttribute
      const out = col.array as Float32Array
      const data = cpw.array as Float32Array
      for (let v = 0; v < x.cover.length; v++) {
        let cp = 0
        for (let j = 0; j < NEAREST; j++) cp += (cps[x.near[v * NEAREST + j]!] ?? 0) * x.weight[v * NEAREST + j]!
        const [r, g, b] = cpRgb(cp)
        colour.setRGB(r, g, b, THREE.SRGBColorSpace).lerp(x.base, 1 - x.cover[v]!)
        out[v * 3] = colour.r
        out[v * 3 + 1] = colour.g
        out[v * 3 + 2] = colour.b
        data[v * 2] = cp
        data[v * 2 + 1] = x.cover[v]!
      }
      col.needsUpdate = true
      cpw.needsUpdate = true
    }
  }

  return {
    material,
    paint(root, frame, taps, cps) {
      if (taps.length === 0 || cps.length !== taps.length) {
        clear()
        return
      }
      // The taps are fixed to the model, so the layout only moves when the model does.
      const first = taps[0]!.point
      const key = `${taps.length}|${first.x.toFixed(4)}|${first.y.toFixed(4)}|${first.z.toFixed(4)}`
      if (root !== paintedRoot || key !== layoutKey) {
        lay(root, frame, taps)
        layoutKey = key
      }
      colourIn(cps)
    },
    clear,
    dispose() {
      clear()
      material.dispose()
    },
  }
}
