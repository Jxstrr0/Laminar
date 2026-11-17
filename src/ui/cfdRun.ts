/**
 * One CFD Cluster run (PR 12c): the model on the mount, turned to the
 * turntable's yaw, filled into the grid's cells and solved on the phone's
 * GPU. It's an instrument, never the sim's truth: the answer is shown, never
 * saved or scored, and differs a little between GPUs (plan section 6.6).
 *
 * The solver and the shape code load only when a run starts, so players
 * without the upgrade never download them.
 */
import { CFD } from '../data/cfd'
import type { RiderState } from '../render/riderFigure'

/** The flow through the model's middle, side on: air left to right. */
export interface CfdSlice {
  /** Cells along the flow and up. */
  w: number
  h: number
  /** The air's speed as a share of the inflow, row by row from the floor up. */
  speed: Float32Array
  /** 1 where the model is, seen side on (any cell across). */
  body: Uint8Array
}

export interface CfdResult {
  /** The drag area at full scale, m², after the grid's sphere calibration. */
  cdA: number
  slice: CfdSlice
}

export type CfdOutcome = { ok: true; result: CfdResult } | { ok: false; why: 'device' | 'slow' | 'stopped' | 'empty'; minutes?: number }

export interface CfdProgress {
  /** 'cells' while the model is filled in, then 'solving' with a share done. */
  stage: 'cells' | 'solving'
  done: number
}

/**
 * Run the solver on a model. `stop()` returning true ends it early. The first
 * batch is timed, and a run that would take longer than CFD.budgetSeconds
 * stops there with an estimate, so a slow phone isn't left warming up.
 */
export async function runCfd(state: RiderState, yawDeg: number, onProgress: (p: CfdProgress) => void, stop: () => boolean): Promise<CfdOutcome> {
  onProgress({ stage: 'cells', done: 0 })
  const [{ requestCfdDevice, fitsDevice, createGpuLbm }, { voxelize }, { cfdTriangles }] = await Promise.all([
    import('../cfd/gpu'),
    import('../cfd/voxel'),
    import('../render/cfdShape'),
  ])
  const grid = voxelize(cfdTriangles(state, yawDeg))
  if (grid.count === 0) return { ok: false, why: 'empty' }
  if (stop()) return { ok: false, why: 'stopped' }
  const device = await requestCfdDevice()
  if (!device || !fitsDevice(device, grid)) {
    device?.destroy()
    return { ok: false, why: 'device' }
  }
  const lbm = createGpuLbm(device, grid, CFD)
  try {
    const sum = { x: 0, n: 0 }
    const started = performance.now()
    for (let s = 0; s < CFD.steps; s += CFD.batch) {
      lbm.step(CFD.batch)
      await lbm.done()
      if (stop()) return { ok: false, why: 'stopped' }
      if (s === 0) {
        const estimate = ((performance.now() - started) / 1000) * (CFD.steps / CFD.batch)
        if (estimate > CFD.budgetSeconds) return { ok: false, why: 'slow', minutes: Math.ceil(estimate / 60) }
      }
      // The wake sheds, so the drag is averaged over the run's last stretch.
      if (s + CFD.batch > CFD.steps - CFD.averageOver) {
        sum.x += (await lbm.force()).x
        sum.n++
      }
      onProgress({ stage: 'solving', done: Math.min(1, (s + CFD.batch) / CFD.steps) })
    }
    const fx = sum.x / Math.max(1, sum.n)
    // Drag area in cells² (the grid's air has density 1), then metres² at full scale.
    const cells = fx / (0.5 * CFD.inflow * CFD.inflow)
    const cdA = cells * grid.cell * grid.cell * (CFD.sphere.real / CFD.sphere.grid)
    return { ok: true, result: { cdA, slice: sliceOf(await lbm.flow(), grid) } }
  } catch {
    return { ok: false, why: 'device' }
  } finally {
    lbm.destroy()
    device.destroy()
  }
}

/** The side-on slice through the grid's middle, and the model's silhouette. */
function sliceOf(flow: Float32Array, g: { nx: number; ny: number; nz: number; solid: Uint8Array }): CfdSlice {
  const { nx, ny, nz } = g
  const mid = Math.floor(ny / 2)
  const speed = new Float32Array(nx * nz)
  const body = new Uint8Array(nx * nz)
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      const i = x + nx * (mid + ny * z)
      const ux = flow[i * 4]!
      const uy = flow[i * 4 + 1]!
      const uz = flow[i * 4 + 2]!
      speed[x + nx * z] = Math.sqrt(ux * ux + uy * uy + uz * uz) / CFD.inflow
      for (let y = 0; y < ny; y++) {
        if (g.solid[x + nx * (y + ny * z)]) {
          body[x + nx * z] = 1
          break
        }
      }
    }
  }
  return { w: nx, h: nz, speed, body }
}
