/**
 * Can this phone run the CFD Cluster (PR 12b)? It needs WebGPU and a GPU
 * that can hold the grid. Asked once and remembered for the visit; the
 * answer never changes the game, only whether the upgrade is offered.
 */
import { CFD } from '../data/cfd'
import { Q } from './d3q19'

let answer: Promise<boolean> | null = null

export function cfdSupported(): Promise<boolean> {
  answer ??= (async () => {
    const gpu = typeof navigator === 'undefined' ? undefined : navigator.gpu
    if (!gpu) return false
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (!adapter) return false
      const { nx, ny, nz } = CFD.grid
      const bytes = nx * ny * nz * Q * 4
      return bytes <= adapter.limits.maxStorageBufferBindingSize && bytes <= adapter.limits.maxBufferSize
    } catch {
      return false
    }
  })()
  return answer
}
