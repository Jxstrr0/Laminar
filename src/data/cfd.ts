/**
 * The CFD Cluster's numbers (PR 12; plan section 6.6). A coarse lattice
 * Boltzmann grid (D3Q19) on the phone's GPU: an instrument with its own
 * biases (thick numerical viscosity, no transition), never the sim's truth.
 * Lattice units throughout: one cell is 1, one step is 1.
 */
export const CFD = {
  /** Cells along the flow, across it and up (plan: roughly 96 × 48 × 48). */
  grid: { nx: 96, ny: 48, nz: 48 },
  /** Inflow speed in lattice units: low enough to stay incompressible (Mach ≈ 0.1). */
  inflow: 0.06,
  /** BGK relaxation time; 0.5 is inviscid and unstable, so the grid's air is thick. */
  tau: 0.56,
  /** Steps per run: about two flow-throughs of the grid. */
  steps: 3200,
  /** The last steps whose force is averaged into the reading (the wake sheds). */
  averageOver: 800,
  /** Steps sent to the GPU per batch, so the page stays responsive. */
  batch: 100,
} as const
