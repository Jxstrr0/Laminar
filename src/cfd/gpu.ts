/**
 * The CFD Cluster's solver on the GPU (PR 12a): the same lattice Boltzmann
 * scheme as the CPU reference in lbm.ts, as WebGPU compute shaders. One
 * thread per cell; two population buffers swap each step. Results differ
 * from the CPU's only by float rounding, and between GPUs the same way:
 * this is an instrument, never saved or scored (plan section 6.6).
 */
import { C, OPP, Q, W } from './d3q19'
import { initialPopulations, type Grid, type LbmParams, type Vec3 } from './lbm'

const GROUP = 64

const list = (xs: readonly number[], f: (x: number) => string) => xs.map(f).join(', ')
const f32 = (x: number) => (Number.isInteger(x) ? `${x}.0` : String(x))

/** The shaders, with the lattice written in from d3q19.ts. */
const SHADER = /* wgsl */ `
struct Params { nx: u32, ny: u32, nz: u32, n: u32, inflow: f32, omega: f32, spongeCells: f32, spongeTau: f32 }
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> solid: array<u32>;
@group(0) @binding(2) var<storage, read> src: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;
@group(0) @binding(4) var<storage, read_write> partial: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> flow: array<vec4<f32>>;

var<private> CX: array<i32, ${Q}> = array<i32, ${Q}>(${list(C.map((c) => c[0]), String)});
var<private> CY: array<i32, ${Q}> = array<i32, ${Q}>(${list(C.map((c) => c[1]), String)});
var<private> CZ: array<i32, ${Q}> = array<i32, ${Q}>(${list(C.map((c) => c[2]), String)});
var<private> W: array<f32, ${Q}> = array<f32, ${Q}>(${list(W, f32)});
var<private> OPP: array<u32, ${Q}> = array<u32, ${Q}>(${list(OPP, (x) => `${x}u`)});

fn wrapi(i: i32, n: i32) -> i32 {
  if (i < 0) { return i + n; }
  if (i >= n) { return i - n; }
  return i;
}

fn cvec(q: u32) -> vec3<f32> {
  return vec3<f32>(f32(CX[q]), f32(CY[q]), f32(CZ[q]));
}

fn feq(q: u32, rho: f32, u: vec3<f32>) -> f32 {
  let cu = 3.0 * dot(cvec(q), u);
  return W[q] * rho * (1.0 + cu + 0.5 * cu * cu - 1.5 * dot(u, u));
}

fn coords(i: u32) -> vec3<i32> {
  return vec3<i32>(i32(i % P.nx), i32((i / P.nx) % P.ny), i32(i / (P.nx * P.ny)));
}

// The relaxation rate at column x, with the sponge at the far end (lbm.ts omegaAt).
fn omegaAt(x: i32) -> f32 {
  if (P.spongeCells <= 0.0) { return P.omega; }
  let into = (f32(x) - (f32(P.nx) - P.spongeCells)) / P.spongeCells;
  if (into <= 0.0) { return P.omega; }
  let tau = 1.0 / P.omega;
  return 1.0 / (tau + (P.spongeTau - tau) * into * into);
}

// One step: pull the populations streaming in, then relax towards equilibrium (lbm.ts lbmStep).
@compute @workgroup_size(${GROUP})
fn step(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let n = P.n;
  if (solid[i] != 0u) {
    for (var q = 0u; q < ${Q}u; q++) { dst[q * n + i] = src[q * n + i]; }
    return;
  }
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let nz = i32(P.nz);
  let p = coords(i);
  var fin: array<f32, ${Q}>;
  // The last column's own velocity, for the air coming back in from beyond the far end.
  var own = vec3<f32>(0.0);
  if (p.x == nx - 1) {
    var orho = 0.0;
    for (var q = 0u; q < ${Q}u; q++) {
      let v = src[q * n + i];
      orho += v;
      own += v * cvec(q);
    }
    own = own / orho;
  }
  var rho = 0.0;
  var m = vec3<f32>(0.0);
  for (var q = 0u; q < ${Q}u; q++) {
    let sx = p.x - CX[q];
    var v: f32;
    if (sx < 0) {
      v = feq(q, 1.0, vec3<f32>(P.inflow, 0.0, 0.0));
    } else if (sx >= nx) {
      v = feq(q, 1.0, own);
    } else {
      let j = u32(sx + nx * (wrapi(p.y - CY[q], ny) + ny * wrapi(p.z - CZ[q], nz)));
      if (solid[j] != 0u) { v = src[OPP[q] * n + i]; } else { v = src[q * n + j]; }
    }
    fin[q] = v;
    rho += v;
    m += v * cvec(q);
  }
  let u = m / rho;
  let omega = omegaAt(p.x);
  for (var q = 0u; q < ${Q}u; q++) {
    dst[q * n + i] = fin[q] - omega * (fin[q] - feq(q, rho, u));
  }
}

// The force on the body by momentum exchange (lbm.ts bodyForce), summed per workgroup.
var<workgroup> acc: array<vec4<f32>, ${GROUP}>;

@compute @workgroup_size(${GROUP})
fn force(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) li: u32, @builtin(workgroup_id) wid: vec3<u32>) {
  let i = gid.x;
  var f = vec3<f32>(0.0);
  if (i < P.n && solid[i] == 0u) {
    let n = P.n;
    let nx = i32(P.nx);
    let ny = i32(P.ny);
    let nz = i32(P.nz);
    let p = coords(i);
    for (var q = 1u; q < ${Q}u; q++) {
      let tx = p.x + CX[q];
      if (tx >= 0 && tx < nx) {
        let j = u32(tx + nx * (wrapi(p.y + CY[q], ny) + ny * wrapi(p.z + CZ[q], nz)));
        if (solid[j] != 0u) { f += 2.0 * src[q * n + i] * cvec(q); }
      }
    }
  }
  acc[li] = vec4<f32>(f, 0.0);
  workgroupBarrier();
  for (var s = ${GROUP / 2}u; s > 0u; s = s >> 1u) {
    if (li < s) { acc[li] = acc[li] + acc[li + s]; }
    workgroupBarrier();
  }
  if (li == 0u) { partial[wid.x] = acc[0]; }
}

// Each cell's velocity and density, for the flow slices (lbm.ts cellFlow).
@compute @workgroup_size(${GROUP})
fn moments(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= P.n) { return; }
  if (solid[i] != 0u) { flow[i] = vec4<f32>(0.0, 0.0, 0.0, 1.0); return; }
  var rho = 0.0;
  var m = vec3<f32>(0.0);
  for (var q = 0u; q < ${Q}u; q++) {
    let v = src[q * P.n + i];
    rho += v;
    m += v * cvec(q);
  }
  flow[i] = vec4<f32>(m / rho, rho);
}
`

/** A GPU to run on, or null: no WebGPU, no adapter, or the request failed. */
export async function requestCfdDevice(): Promise<GPUDevice | null> {
  const gpu = typeof navigator === 'undefined' ? undefined : navigator.gpu
  if (!gpu) return null
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
    return adapter ? await adapter.requestDevice() : null
  } catch {
    return null
  }
}

/** Can this device hold a grid this size? */
export function fitsDevice(device: GPUDevice, g: Pick<Grid, 'nx' | 'ny' | 'nz'>): boolean {
  const bytes = g.nx * g.ny * g.nz * Q * 4
  const groups = Math.ceil((g.nx * g.ny * g.nz) / GROUP)
  return bytes <= device.limits.maxStorageBufferBindingSize && bytes <= device.limits.maxBufferSize && groups <= device.limits.maxComputeWorkgroupsPerDimension
}

export interface GpuLbm {
  /** Queue this many steps (returns at once; the GPU works on). */
  step(count: number): void
  /** The force on the body now, lattice units. */
  force(): Promise<Vec3>
  /** Each cell's [ux, uy, uz, rho], index x + nx·(y + ny·z). */
  flow(): Promise<Float32Array>
  /** Wait for the queued steps to finish. */
  done(): Promise<void>
  destroy(): void
}

/** Set a grid up on the GPU, filled with the inflow. */
export function createGpuLbm(device: GPUDevice, g: Grid, p: LbmParams): GpuLbm {
  const n = g.nx * g.ny * g.nz
  const groups = Math.ceil(n / GROUP)
  const usage = GPUBufferUsage
  const buffer = (size: number, use: number, label: string) => device.createBuffer({ size, usage: use, label })

  const params = buffer(32, usage.UNIFORM | usage.COPY_DST, 'cfd params')
  const head = new ArrayBuffer(32)
  new Uint32Array(head, 0, 4).set([g.nx, g.ny, g.nz, n])
  new Float32Array(head, 16, 4).set([p.inflow, 1 / p.tau, p.sponge?.cells ?? 0, p.sponge?.tau ?? p.tau])
  device.queue.writeBuffer(params, 0, head)

  const solid = buffer(n * 4, usage.STORAGE | usage.COPY_DST, 'cfd solid')
  device.queue.writeBuffer(solid, 0, Uint32Array.from(g.solid))

  const start = initialPopulations(g, p)
  const pops = [0, 1].map((k) => buffer(start.byteLength, usage.STORAGE | usage.COPY_DST, `cfd populations ${k}`))
  device.queue.writeBuffer(pops[0]!, 0, start)
  device.queue.writeBuffer(pops[1]!, 0, start)

  const partial = buffer(groups * 16, usage.STORAGE | usage.COPY_SRC, 'cfd force partials')
  const partialRead = buffer(groups * 16, usage.MAP_READ | usage.COPY_DST, 'cfd force read')
  const flowBuf = buffer(n * 16, usage.STORAGE | usage.COPY_SRC, 'cfd flow')
  const flowRead = buffer(n * 16, usage.MAP_READ | usage.COPY_DST, 'cfd flow read')

  const module = device.createShaderModule({ code: SHADER, label: 'cfd lbm' })
  const pipe = (entryPoint: string) => device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint }, label: `cfd ${entryPoint}` })
  const stepPipe = pipe('step')
  const forcePipe = pipe('force')
  const macroPipe = pipe('moments')
  const bind = (pl: GPUComputePipeline, entries: [number, GPUBuffer][]) =>
    device.createBindGroup({ layout: pl.getBindGroupLayout(0), entries: entries.map(([binding, b]) => ({ binding, resource: { buffer: b } })) })
  // Step k reads pops[k % 2] and writes the other.
  const stepGroups = [0, 1].map((k) => bind(stepPipe, [[0, params], [1, solid], [2, pops[k]!], [3, pops[1 - k]!]]))
  const forceGroups = [0, 1].map((k) => bind(forcePipe, [[0, params], [1, solid], [2, pops[k]!], [4, partial]]))
  const macroGroups = [0, 1].map((k) => bind(macroPipe, [[0, params], [1, solid], [2, pops[k]!], [5, flowBuf]]))

  /** Which buffer holds the latest populations. */
  let cur = 0

  async function read(target: GPUBuffer): Promise<Float32Array> {
    await target.mapAsync(GPUMapMode.READ)
    const out = new Float32Array(target.getMappedRange().slice(0))
    target.unmap()
    return out
  }

  return {
    step(count) {
      const enc = device.createCommandEncoder()
      const pass = enc.beginComputePass()
      pass.setPipeline(stepPipe)
      for (let s = 0; s < count; s++) {
        pass.setBindGroup(0, stepGroups[cur]!)
        pass.dispatchWorkgroups(groups)
        cur = 1 - cur
      }
      pass.end()
      device.queue.submit([enc.finish()])
    },
    async force() {
      const enc = device.createCommandEncoder()
      const pass = enc.beginComputePass()
      pass.setPipeline(forcePipe)
      pass.setBindGroup(0, forceGroups[cur]!)
      pass.dispatchWorkgroups(groups)
      pass.end()
      enc.copyBufferToBuffer(partial, 0, partialRead, 0, groups * 16)
      device.queue.submit([enc.finish()])
      const parts = await read(partialRead)
      const sum = { x: 0, y: 0, z: 0 }
      for (let k = 0; k < groups; k++) {
        sum.x += parts[k * 4]!
        sum.y += parts[k * 4 + 1]!
        sum.z += parts[k * 4 + 2]!
      }
      return sum
    },
    async flow() {
      const enc = device.createCommandEncoder()
      const pass = enc.beginComputePass()
      pass.setPipeline(macroPipe)
      pass.setBindGroup(0, macroGroups[cur]!)
      pass.dispatchWorkgroups(groups)
      pass.end()
      enc.copyBufferToBuffer(flowBuf, 0, flowRead, 0, n * 16)
      device.queue.submit([enc.finish()])
      return read(flowRead)
    },
    done: () => device.queue.onSubmittedWorkDone(),
    destroy() {
      for (const b of [params, solid, ...pops, partial, partialRead, flowBuf, flowRead]) b.destroy()
    },
  }
}
