/**
 * The save file (plan section 13): the design on the bench and the lab's
 * state, as JSON. Everything read back is checked before the game trusts
 * it: a save the game could not have written (cut short, edited, from a
 * newer version) is turned away rather than half loaded.
 */
import { DESIGN_CHOICES, PART_RANGE, POSTURE_RANGE, type CyclistDesign } from '../data/cyclist'
import { MODEL_FINISH, MODEL_GRADE, MODEL_SCALES } from '../data/model'
import { CRANK_DIAL, DEMO_TUNNEL_SEED } from '../data/tunnel'
import { briefTemplate, newCareer, type Brief, type CareerState, type Job } from '../sim/career'
import type { LabState, RunNote } from '../sim/lab'
import type { ModelOrder } from '../sim/modelShop'
import type { Run, RunSample } from '../sim/run'

/**
 * The save format's version. v2 (PR 5c) added the career; a v1 file is
 * brought up to date with a fresh career on the seed the tunnel used before
 * careers, so its calibrations still hold.
 */
export const SAVE_VERSION = 2

export interface SaveFile {
  v: typeof SAVE_VERSION
  /** When it was written, ms since 1970 (the device's clock: only for "saved at" lines). */
  savedAt: number
  design: CyclistDesign
  lab: LabState
  career: CareerState
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0
const oneOf = <T extends string>(x: unknown, list: readonly T[]): x is T => typeof x === 'string' && (list as readonly string[]).includes(x)
const clampTo = (x: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, x))

/** A design, with every number pulled inside its slider's range; null if anything is missing or unknown. */
export function soundDesign(x: unknown): CyclistDesign | null {
  if (!isObj(x) || !isObj(x.posture) || !isObj(x.helmet) || !isObj(x.suit) || !isObj(x.wheels)) return null
  const p = x.posture
  const posture = {} as CyclistDesign['posture']
  for (const k of Object.keys(POSTURE_RANGE) as (keyof typeof POSTURE_RANGE)[]) {
    const v = p[k]
    if (!isNum(v)) return null
    posture[k] = clampTo(v, POSTURE_RANGE[k])
  }
  const { kind, tail, vents } = x.helmet
  const { fabric, armTrips } = x.suit
  const { front, rear } = x.wheels
  if (!oneOf(kind, DESIGN_CHOICES.helmet) || !isNum(tail) || !isNum(vents)) return null
  if (!oneOf(fabric, DESIGN_CHOICES.fabric) || typeof armTrips !== 'boolean') return null
  if (!oneOf(front, DESIGN_CHOICES.wheel) || !oneOf(rear, DESIGN_CHOICES.wheel)) return null
  if (!oneOf(x.bars, DESIGN_CHOICES.bars) || !oneOf(x.frame, DESIGN_CHOICES.frame)) return null
  return {
    posture,
    helmet: { kind, tail: clampTo(tail, PART_RANGE.tail), vents: clampTo(vents, PART_RANGE.vents) },
    suit: { fabric, armTrips },
    bars: x.bars,
    wheels: { front, rear },
    frame: x.frame,
  }
}

function soundSample(x: unknown): x is RunSample {
  return (
    isObj(x) &&
    isNum(x.t) &&
    isNum(x.speed) &&
    isNum(x.yawDeg) &&
    isNum(x.cdA) &&
    isNum(x.cyA) &&
    isNum(x.dragN) &&
    typeof x.steady === 'boolean'
  )
}

function soundRun(x: unknown): x is Run {
  return (
    isObj(x) &&
    isCount(x.id) &&
    x.id > 0 &&
    typeof x.model === 'string' &&
    Array.isArray(x.samples) &&
    x.samples.every(soundSample) &&
    isNum(x.duration) &&
    isNum(x.energyKWh) &&
    isNum(x.topSpeed)
  )
}

const soundCrank = (x: unknown): x is number =>
  isNum(x) && x >= CRANK_DIAL.min && x <= CRANK_DIAL.max && (x - CRANK_DIAL.min) % CRANK_DIAL.step === 0

function soundOrder(x: unknown): ModelOrder | null {
  if (!isObj(x)) return null
  const { scale, finish, grade, trips, taps } = x
  if (!MODEL_SCALES.includes(scale as never) || !oneOf(finish, Object.keys(MODEL_FINISH) as (keyof typeof MODEL_FINISH)[])) return null
  if (!oneOf(grade, Object.keys(MODEL_GRADE) as (keyof typeof MODEL_GRADE)[]) || typeof trips !== 'boolean') return null
  return { scale: scale as ModelOrder['scale'], finish, grade, trips, taps: taps === true }
}

/**
 * The lab's state, or null if it isn't one the game could have written.
 * Notes on runs that aren't on file are dropped. A save from before PR 5d
 * doesn't say what the model was built of; then it was `modelFallback`
 * (back then the model always matched the bench design).
 */
export function soundLab(x: unknown, modelFallback: CyclistDesign): LabState | null {
  if (!isObj(x) || !Array.isArray(x.runs) || !x.runs.every(soundRun) || !isObj(x.notes)) return null
  if (!isCount(x.build) || !soundCrank(x.crank) || !isCount(x.nextRunId) || !isCount(x.balanceRng) || x.balanceRng > 0xffffffff) return null
  const order = soundOrder(x.order)
  if (!order) return null
  const runs = x.runs as Run[]
  const ids = runs.map((r) => r.id)
  if (new Set(ids).size !== ids.length || ids.some((id) => id >= (x.nextRunId as number))) return null
  const notes: Record<number, RunNote> = {}
  for (const id of ids) {
    const n = (x.notes as Obj)[String(id)]
    if (!isObj(n)) continue
    const design = soundDesign(n.design)
    if (!design || !soundCrank(n.crank) || !isCount(n.build)) return null
    notes[id] = { design, crank: n.crank, build: n.build }
  }
  const modelDesign = x.modelDesign === undefined ? structuredClone(modelFallback) : soundDesign(x.modelDesign)
  if (!modelDesign) return null
  return {
    runs,
    notes,
    order,
    modelDesign,
    build: x.build,
    crank: x.crank,
    nextRunId: x.nextRunId,
    balanceRng: x.balanceRng,
  }
}

const isSeed = (x: unknown): x is number => isCount(x) && x <= 0xffffffff

function soundBrief(x: unknown): Brief | null {
  if (!isObj(x) || typeof x.id !== 'string' || !briefTemplate(x.id)) return null
  if (!isCount(x.fee) || !isCount(x.days) || x.days === 0 || !isSeed(x.seed)) return null
  return { id: x.id, fee: x.fee, days: x.days, seed: x.seed }
}

function soundJob(x: unknown): Job | null {
  if (!isObj(x)) return null
  const brief = soundBrief(x.brief)
  if (!brief || !isCount(x.startDay) || !isCount(x.daysLeft) || x.daysLeft > brief.days || !isNum(x.spent)) return null
  return { brief, startDay: x.startDay, daysLeft: x.daysLeft, spent: x.spent }
}

/** The career, or null if it isn't one the game could have written. */
export function soundCareer(x: unknown): CareerState | null {
  if (!isObj(x) || !isSeed(x.seed) || !isNum(x.money) || !isCount(x.day) || !isCount(x.jobsDone)) return null
  if (!Array.isArray(x.board)) return null
  const board = x.board.map(soundBrief)
  if (board.some((b) => !b)) return null
  const job = x.job === null ? null : soundJob(x.job)
  if (x.job !== null && !job) return null
  return { seed: x.seed, money: x.money, day: x.day, jobsDone: x.jobsDone, board: board as Brief[], job }
}

/** A save file, checked (and brought up to date if it's older); null if it can't be trusted. */
export function soundSave(x: unknown): SaveFile | null {
  if (!isObj(x) || (x.v !== SAVE_VERSION && x.v !== 1) || !isNum(x.savedAt)) return null
  const design = soundDesign(x.design)
  const lab = design && soundLab(x.lab, design)
  const career = x.v === 1 ? newCareer(DEMO_TUNNEL_SEED) : soundCareer(x.career)
  return design && lab && career ? { v: SAVE_VERSION, savedAt: x.savedAt, design, lab, career } : null
}

/** Readings keep six decimal places: plenty for any of them, and it keeps saves small. */
function rounded(_key: string, value: unknown): unknown {
  return typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1e6) / 1e6 : value
}

export function packSave(save: SaveFile): string {
  return JSON.stringify(save, rounded)
}

export function parseSave(text: string | null | undefined): SaveFile | null {
  if (!text) return null
  try {
    return soundSave(JSON.parse(text))
  } catch {
    return null
  }
}
