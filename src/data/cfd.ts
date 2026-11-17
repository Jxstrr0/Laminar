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
  /**
   * The sponge at the far end (PR 12c): over its last this-many cells the
   * relaxation time rises to `tau`, so the wake's eddies fade before the
   * edge instead of bouncing back and blowing the run up.
   */
  sponge: { cells: 16, tau: 1.0 },
  /** Steps per run: about two flow-throughs of the grid. */
  steps: 3200,
  /** The last steps whose force is averaged into the reading (the wake sheds). */
  averageOver: 800,
  /** Steps sent to the GPU per batch, so the page stays responsive. */
  batch: 100,
  /**
   * How the model sits in the grid (PR 12b): it fills at most this share of
   * the grid's length and of its width and height, with its nose this far
   * along, so the wake has room behind it. A part thinner than thinCells
   * (a tyre, a disc wheel) is drawn as a shell instead of filled.
   */
  fit: { length: 0.36, across: 0.6, noseAt: 0.2, thinCells: 1.5 },
  /**
   * A run that would take longer than this, in seconds, judged from its first
   * batch, stops with a "too slow" note (PR 12c).
   */
  budgetSeconds: 120,
  /**
   * The grid's calibration (PR 12c), as a tunnel calibrates on a sphere: a
   * sphere fitted to the grid the way a model is reads drag coefficient
   * `grid` (measured with the CPU reference, runCpu, at these settings),
   * where a real sphere at a rider's Reynolds number reads `real`. Every CFD
   * drag area is scaled by real / grid. It takes out the grid's average bias
   * (thick air, tight walls), not the bias that depends on the shape.
   */
  sphere: { grid: 2.58, real: 0.47 },
} as const
