/**
 * The firm's career (plan sections 4 and 9): money, the calendar, the brief
 * board and the job in hand. Every step here is a pure function from one
 * state to the next, so the save holds the whole career as plain numbers.
 *
 * - Tunnel runs cost money and no days, with or without a job.
 * - Model orders need a job, cost money and spend days from its budget.
 * - Delivering runs the event, pays the fee, jumps the calendar to the
 *   event and refreshes the board.
 */
import { BRIEFS, CAREER, type BriefTemplate } from '../data/briefs'
import type { CyclistDesign } from '../data/cyclist'
import { REFERENCE_RIDER } from '../data/field'
import { riderEvent } from './cyclist'
import { cyclistShape } from './geom/cyclist'
import { hashString, Rng } from './rng'
import { fieldResult, REFERENCE_TT, type EventSpec, type FieldResult } from './views'

/** A brief as it sits on the board: which client, and the terms on offer. */
export interface Brief {
  /** The template's id in BRIEFS. */
  id: string
  /** ₽. */
  fee: number
  days: number
  /** Seed for this job's desk bias and its event day. */
  seed: number
}

export interface Job {
  brief: Brief
  /** The career day the job was taken. */
  startDay: number
  daysLeft: number
  /** Money spent while on the job (runs and models), ₽. */
  spent: number
}

export interface CareerState {
  /** The career's own seed: its tunnel's quirks and every board. */
  seed: number
  /** ₽ (may go below zero; the soft landing comes with PR 7). */
  money: number
  /** Days since the career began. */
  day: number
  jobsDone: number
  board: Brief[]
  job: Job | null
}

/** Why a model can't be ordered now, or null if it can. */
export type OrderBlock = 'noJob' | 'noDays' | null

export function briefTemplate(id: string): BriefTemplate | undefined {
  return BRIEFS.find((b) => b.id === id)
}

function template(id: string): BriefTemplate {
  const found = briefTemplate(id)
  if (!found) throw new RangeError(`unknown brief ${id}`)
  return found
}

/** The brief board after `jobsDone` jobs: the tutorial first in a new career, and always one small brief. */
export function boardFor(seed: number, jobsDone: number): Brief[] {
  const rng = new Rng(seed).fork(`board-${jobsDone}`)
  const first = jobsDone === 0 ? BRIEFS.filter((b) => b.tutorial) : []
  const small = rng.shuffle(BRIEFS.filter((b) => b.small))
  const rest = rng.shuffle(BRIEFS.filter((b) => !b.tutorial && !b.small))
  const picked = [...first, ...small.slice(0, 1)]
  for (const b of [...rest, ...small.slice(1)]) {
    if (picked.length >= CAREER.boardSize) break
    picked.push(b)
  }
  return picked.map((b) => {
    const fee = Math.round(rng.range(b.fee.min, b.fee.max) / CAREER.feeRound) * CAREER.feeRound
    return { id: b.id, fee, days: b.days, seed: rng.int(1, 0x7fffffff) }
  })
}

export function newCareer(seed: number): CareerState {
  return { seed, money: CAREER.startMoney, day: 0, jobsDone: 0, board: boardFor(seed, 0), job: null }
}

/** The event a brief is for, ready for the field model. */
export function eventOf(brief: Pick<Brief, 'id'>): EventSpec {
  const b = template(brief.id)
  return {
    temperature: b.event.temperature,
    altitude: b.event.altitude,
    riderSpeed: b.event.riderSpeed,
    windSpeed: b.event.windSpeed,
    course: b.event.course,
    rider: { ...REFERENCE_RIDER, power: b.rider.power, mass: b.rider.mass },
    refX: REFERENCE_TT.refX,
    spread: b.event.spread,
  }
}

/** The event the bench is working towards: the job's, or the reference time trial between jobs. */
export function currentEvent(state: CareerState): EventSpec {
  return state.job ? eventOf(state.job.brief) : REFERENCE_TT
}

/** Take a brief off the board. Only one job at a time. */
export function acceptBrief(state: CareerState, id: string): CareerState {
  const brief = state.board.find((b) => b.id === id)
  if (!brief || state.job) return state
  return { ...state, job: { brief, startDay: state.day, daysLeft: brief.days, spent: 0 } }
}

/** Spend money (a run, a model). Goes on the job's tally when there is one. */
export function charge(state: CareerState, amount: number): CareerState {
  return {
    ...state,
    money: state.money - amount,
    job: state.job ? { ...state.job, spent: state.job.spent + amount } : null,
  }
}

export function orderBlock(state: CareerState, days: number): OrderBlock {
  if (!state.job) return 'noJob'
  return days > state.job.daysLeft ? 'noDays' : null
}

/** Order a model: pay for it and let its days pass (Kelbo: days pass at once, the model arrives straight away). */
export function orderModel(state: CareerState, price: number, days: number): CareerState {
  if (orderBlock(state, days)) return state
  const paid = charge(state, price)
  return { ...paid, day: paid.day + days, job: { ...paid.job!, daysLeft: paid.job!.daysLeft - days } }
}

export interface Delivery {
  state: CareerState
  /** The job that was delivered. */
  job: Job
  event: EventSpec
  result: FieldResult
  /** What the client paid, ₽. */
  paid: number
}

/** The seed for a job's event day. */
export function daySeed(brief: Brief): number {
  return hashString(`day:${brief.seed}`)
}

/**
 * Deliver the design: the calendar jumps to the event, the rider races it
 * (with whatever power the position costs them), and the fee is paid.
 * Null if there's no job.
 */
export function deliver(state: CareerState, design: CyclistDesign): Delivery | null {
  const job = state.job
  if (!job) return null
  const event = eventOf(job.brief)
  const result = fieldResult(cyclistShape(design), riderEvent(design, event), daySeed(job.brief))
  const jobsDone = state.jobsDone + 1
  const next: CareerState = {
    ...state,
    money: state.money + job.brief.fee,
    day: state.day + job.daysLeft,
    jobsDone,
    board: boardFor(state.seed, jobsDone),
    job: null,
  }
  return { state: next, job, event, result, paid: job.brief.fee }
}
