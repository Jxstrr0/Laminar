/**
 * The lab's lasting state (plan section 9): the runs on file, what each
 * rider run tested, the model on order and the balance's noise stream. The
 * tunnel screen works from it and hands it back for saving, so closing the
 * page loses nothing but a run still in progress.
 */
import { DEMO_MODEL_SEED, STANDARD_ORDER } from '../data/model'
import { SKELETON } from '../data/pose'
import { DEFAULT_CYCLIST } from '../data/cyclist'
import type { Design } from './design'
import type { Failure } from './failure'
import type { ModelOrder } from './modelShop'
import { Rng, type RngState } from './rng'
import type { Run } from './run'

/** What a rider run tested, so the run report can say what changed. */
export interface RunNote {
  design: Design
  /** The model's fixed crank angle, degrees. */
  crank: number
  /** Which build of the model (each build has its own small errors). */
  build: number
}

export interface LabState {
  /** Finished runs, oldest first. */
  runs: Run[]
  /** Notes on the rider runs, by run id. */
  notes: Record<number, RunNote>
  /** The model on the mount, as ordered. */
  order: ModelOrder
  /** The design that model was built of (with any parts swapped since). */
  modelDesign: Design
  /** Builds ordered so far (0 is the model you start with). */
  build: number
  /** The model's crank angle now, degrees. */
  crank: number
  /** The id the next run takes. */
  nextRunId: number
  /** Where the balance's noise stream has got to. */
  balanceRng: RngState
  /** How the model on the mount broke, until it's repaired or replaced (plan section 8). */
  broken: Failure | null
}

export function newLab(modelDesign: Design = DEFAULT_CYCLIST): LabState {
  return {
    runs: [],
    notes: {},
    // A truck's starting model is a truck's size, on a ground board (PR 9d); a land-speed car's is a truck's size too (PR 9s); a quad's is full size (PR 10d); a survey drone's is the small plane model (PR 10l).
    order:
      modelDesign.sport === 'truck'
        ? { ...STANDARD_ORDER, scale: 8, board: true }
        : modelDesign.sport === 'record'
          ? { ...STANDARD_ORDER, scale: 8 }
          : modelDesign.sport === 'drone'
            ? { ...STANDARD_ORDER, scale: 1 }
            : modelDesign.sport === 'plane'
              ? { ...STANDARD_ORDER, scale: 2.5 }
              : { ...STANDARD_ORDER },
    modelDesign: structuredClone(modelDesign),
    build: 0,
    crank: SKELETON.crankDeg[0]!,
    nextRunId: 1,
    balanceRng: new Rng(DEMO_MODEL_SEED).fork('balance').state,
    broken: null,
  }
}
