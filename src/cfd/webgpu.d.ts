/**
 * The small part of the WebGPU API the CFD Cluster uses (PR 12a).
 * TypeScript 5.9's DOM types don't include WebGPU yet, and this saves adding
 * a package for it. Only what gpu.ts calls is declared.
 */
export {}

declare global {
  interface Navigator {
    readonly gpu?: GPU
  }

  interface GPU {
    requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GPUAdapter | null>
  }

  interface GPUAdapter {
    readonly limits: GPULimits
    requestDevice(descriptor?: { requiredLimits?: Record<string, number> }): Promise<GPUDevice>
  }

  interface GPULimits {
    readonly maxStorageBufferBindingSize: number
    readonly maxBufferSize: number
    readonly maxComputeWorkgroupsPerDimension: number
  }

  interface GPUDevice {
    readonly limits: GPULimits
    readonly queue: GPUQueue
    readonly lost: Promise<{ reason: string; message: string }>
    createBuffer(descriptor: { size: number; usage: number; mappedAtCreation?: boolean; label?: string }): GPUBuffer
    createShaderModule(descriptor: { code: string; label?: string }): GPUShaderModule
    createComputePipeline(descriptor: { layout: 'auto'; compute: { module: GPUShaderModule; entryPoint: string }; label?: string }): GPUComputePipeline
    createBindGroup(descriptor: { layout: GPUBindGroupLayout; entries: { binding: number; resource: { buffer: GPUBuffer } }[] }): GPUBindGroup
    createCommandEncoder(): GPUCommandEncoder
    pushErrorScope(filter: 'validation' | 'out-of-memory' | 'internal'): void
    popErrorScope(): Promise<{ message: string } | null>
    destroy(): void
  }

  interface GPUQueue {
    writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView | ArrayBuffer): void
    submit(buffers: GPUCommandBuffer[]): void
    onSubmittedWorkDone(): Promise<void>
  }

  interface GPUBuffer {
    readonly size: number
    mapAsync(mode: number): Promise<void>
    getMappedRange(): ArrayBuffer
    unmap(): void
    destroy(): void
  }

  // Opaque handles.
  interface GPUShaderModule {
    readonly __shader?: never
  }
  interface GPUBindGroupLayout {
    readonly __layout?: never
  }
  interface GPUBindGroup {
    readonly __group?: never
  }
  interface GPUCommandBuffer {
    readonly __commands?: never
  }

  interface GPUComputePipeline {
    getBindGroupLayout(index: number): GPUBindGroupLayout
  }

  interface GPUCommandEncoder {
    beginComputePass(): GPUComputePassEncoder
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void
    finish(): GPUCommandBuffer
  }

  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void
    setBindGroup(index: number, group: GPUBindGroup): void
    dispatchWorkgroups(x: number, y?: number, z?: number): void
    end(): void
  }

  const GPUBufferUsage: {
    readonly MAP_READ: number
    readonly COPY_SRC: number
    readonly COPY_DST: number
    readonly UNIFORM: number
    readonly STORAGE: number
  }

  const GPUMapMode: {
    readonly READ: number
  }
}
