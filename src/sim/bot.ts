/**
 * The balance bot (plan section 14, PR 14c): a headless player that plays a
 * whole career through the same pure career functions the game uses, so
 * `npm run balance` can check the economy across many seeds.
 *
 * It plays like a careful player with a tunnel that tells the truth:
 * - It shapes each client's setup by nudging every slider and keeping what
 *   helps, judged on a few practice days (made-up event days, never the
 *   real one), so it can't see race day's weather.
 * - It promises its worst practice day less a margin, at a middling price,
 *   and declares the mean of its practice days.
 * - Every job pays for a model and a handful of tunnel runs, at the going
 *   rates for wherever it tests.
 * - It builds its own tunnel once it can afford it with cash to spare, and
 *   applies for defence clearance once allowed. It hires nobody and starts
 *   no R&D (their worth is in the tunnel work, which the bot doesn't model).
 *
 * The bot never changes the game; its habits live in src/data/bot.ts.
 */
import { BOT } from '../data/bot'
import { BRIEFS, PROMISE } from '../data/briefs'
import { AIRCRAFT_RANGE } from '../data/aircraft'
import { BOBSLED_RANGE } from '../data/bobsled'
import { CAR_RANGE } from '../data/car'
import { DESIGN_CHOICES, PART_RANGE, POSTURE_RANGE } from '../data/cyclist'
import { DRONE_RANGE } from '../data/drone'
import { JUMPER_RANGE } from '../data/jumper'
import { PLANE_RANGE } from '../data/plane'
import { POD_RANGE } from '../data/pod'
import { RECORD_RANGE } from '../data/record'
import { SKATER_CHOICES, SKATER_RANGE } from '../data/skater'
import { TRUCK_RANGE } from '../data/truck'
import type { ModelScale } from '../data/model'
import { OWN_TUNNEL_BUILD } from '../data/tunnel'
import {
  applyForClearance,
  briefTemplate,
  buildOwnTunnel,
  charge,
  clampBid,
  clearanceBlock,
  deliver,
  deliverAircraft,
  deliverCar,
  deliverDrone,
  deliverJump,
  deliverPlane,
  deliverPod,
  deliverRecord,
  deliverSled,
  deliverTruck,
  firmReputation,
  newCareer,
  orderModel,
  placeBid,
  ruleBreaksFor,
  waitForBriefs,
  type Bid,
  type CareerState,
  type JobRecord,
} from './career'
import { sportOf, type Design, type Sport } from './design'
import { activeTunnel, tunnelRunCost, type TunnelId } from './facility'
import { FAMILY_START, quote, type ScaleFamily } from './modelShop'
import { hashString, Rng } from './rng'
import { fanPower } from './run'

/** A slider range as the Shape screen has it. */
interface Range {
  min: number
  max: number
  step: number
}

/** One thing the bot can change on a design: a number on a slider, a pick from a list, or a yes/no. */
export type Knob =
  | { path: string[]; kind: 'num'; range: Range }
  | { path: string[]; kind: 'pick'; options: readonly string[] }
  | { path: string[]; kind: 'flag' }

type Tree = Record<string, unknown>

/** The slider ranges and lists for a design's sport (and class). */
function tablesFor(design: Design): { ranges: Record<string, Range>; choices: Record<string, readonly string[]> } {
  const cls = (design as { class?: string }).class ?? ''
  const pick = (byClass: Record<string, Record<string, Range>>) => byClass[cls] ?? {}
  switch (sportOf(design)) {
    case 'cycling':
      return { ranges: { ...POSTURE_RANGE, ...PART_RANGE }, choices: DESIGN_CHOICES }
    case 'skating':
      return { ranges: SKATER_RANGE, choices: SKATER_CHOICES }
    case 'skijump':
      return { ranges: JUMPER_RANGE, choices: {} }
    case 'bobsled':
      return { ranges: BOBSLED_RANGE, choices: {} }
    case 'truck':
      return { ranges: TRUCK_RANGE, choices: {} }
    case 'car':
      return { ranges: pick(CAR_RANGE), choices: {} }
    case 'record':
      return { ranges: pick(RECORD_RANGE), choices: {} }
    case 'drone':
      return { ranges: pick(DRONE_RANGE), choices: {} }
    case 'plane':
      return { ranges: pick(PLANE_RANGE), choices: {} }
    case 'aircraft':
      return { ranges: pick(AIRCRAFT_RANGE), choices: {} }
    case 'pod':
      return { ranges: pick(POD_RANGE), choices: {} }
  }
}

/**
 * Every knob on a design. A number's slider is found by its own name, its
 * parent's name joined to it (a kit plane's pod.fairing is `podFairing`) or
 * its parent's name (a truck's gap.length is `gap`); a list by the part's
 * name or its parent's (wheels.front picks from `wheel`).
 */
export function knobsOf(design: Design): Knob[] {
  const { ranges, choices } = tablesFor(design)
  const knobs: Knob[] = []
  const walk = (node: Tree, path: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      if (BOT.fixed.includes(key)) continue
      const at = [...path, key]
      const parent = path[path.length - 1] ?? ''
      if (typeof value === 'number') {
        const joined = parent + key.charAt(0).toUpperCase() + key.slice(1)
        const range = ranges[joined] ?? ranges[key] ?? ranges[parent]
        if (range && range.max > range.min) knobs.push({ path: at, kind: 'num', range })
      } else if (typeof value === 'string') {
        const options = choices[key] ?? choices[parent] ?? choices[parent.replace(/s$/, '')]
        if (options && options.includes(value)) knobs.push({ path: at, kind: 'pick', options })
      } else if (typeof value === 'boolean') {
        knobs.push({ path: at, kind: 'flag' })
      } else if (value && typeof value === 'object') {
        walk(value as Tree, at)
      }
    }
  }
  walk(design as unknown as Tree, [])
  return knobs
}

/** x on the slider's steps, without float dust (3.4, not 3.4000000000000004). */
const onStep = (x: number, step: number) => Number((Math.round(x / step) * step).toFixed(6))

function getAt(design: Design, path: string[]): unknown {
  let node: unknown = design
  for (const key of path) node = (node as Tree)[key]
  return node
}

/** A copy of the design with one part changed. */
function setAt(design: Design, path: string[], value: unknown): Design {
  const copy = structuredClone(design) as unknown as Tree
  let node = copy
  for (const key of path.slice(0, -1)) node = node[key] as Tree
  node[path[path.length - 1]!] = value
  return copy as unknown as Design
}

/** Inside the rule box (plan section 5): the game won't deliver a design that breaks it. */
export function legal(design: Design, briefId: string): boolean {
  return ruleBreaksFor(briefId, design) === 0
}

/**
 * Deliver any sport's design: the career after race day, the job as it went
 * on the record, and the day's real figure in the unit the sport declares
 * in (CdA, metres, a lap time, litres...), or null if there was none (a
 * plane that spun in).
 */
export function deliverAny(state: CareerState, design: Design, predicted: number): { state: CareerState; record: JobRecord; declared: number | null } | null {
  const done = (() => {
    switch (sportOf(design)) {
      case 'cycling':
      case 'skating':
        return deliver(state, design, predicted)
      case 'skijump':
        return deliverJump(state, design as Parameters<typeof deliverJump>[1], predicted)
      case 'bobsled':
        return deliverSled(state, design as Parameters<typeof deliverSled>[1], predicted)
      case 'truck':
        return deliverTruck(state, design as Parameters<typeof deliverTruck>[1], predicted)
      case 'car':
        return deliverCar(state, design as Parameters<typeof deliverCar>[1], predicted)
      case 'record':
        return deliverRecord(state, design as Parameters<typeof deliverRecord>[1], predicted)
      case 'drone':
        return deliverDrone(state, design as Parameters<typeof deliverDrone>[1], predicted)
      case 'plane':
        return deliverPlane(state, design as Parameters<typeof deliverPlane>[1], predicted)
      case 'aircraft':
        return deliverAircraft(state, design as Parameters<typeof deliverAircraft>[1], predicted)
      case 'pod':
        return deliverPod(state, design as Parameters<typeof deliverPod>[1], predicted)
    }
  })()
  if (!done) return null
  return { state: done.state, record: done.state.history[done.state.history.length - 1]!, declared: done.debrief.actual }
}

/** How a design did on the practice days: the mean and worst gain (promise units), and the mean real figure (declaration units) to declare. */
export interface Practice {
  mean: number
  worst: number
  actual: number
}

/** The practice days' seeds for a brief: fixed by its id, so every career shapes a brief the same way. */
function practiceSeeds(id: string): number[] {
  return Array.from({ length: BOT.practiceDays }, (_, i) => hashString(`bot:${id}:${i}`))
}

/** Try a design for the job in hand on the practice days. */
export function practise(state: CareerState, design: Design): Practice {
  const job = state.job
  if (!job) return { mean: 0, worst: 0, actual: 0 }
  let sum = 0
  let worst = Infinity
  let actual = 0
  let counted = 0
  for (const seed of practiceSeeds(job.brief.id)) {
    const trial = { ...state, job: { ...job, brief: { ...job.brief, seed } } }
    const done = deliverAny(trial, design, 1)
    const gain = done ? done.record.achieved : -Infinity
    sum += gain
    worst = Math.min(worst, gain)
    if (done && done.declared !== null) {
      actual += done.declared
      counted++
    }
  }
  return { mean: sum / BOT.practiceDays, worst, actual: counted > 0 ? actual / counted : 0 }
}

/** The bot's best shot at a design for the job in hand, from the client's setup. */
export interface Shaped {
  design: Design
  practice: Practice
}

/**
 * Shape the client's setup. First scout: try a few designs with about half
 * the knobs set at random (some briefs have a gate, like a stall check,
 * that only clears when two parts change together). Then polish: nudge
 * each slider up and down, try every pick and flip every flag, keep
 * whatever lifts the worst practice day (then the mean), and halve the
 * nudge each round.
 */
export function shapeFor(state: CareerState): Shaped | null {
  const job = state.job
  const b = job && briefTemplate(job.brief.id)
  if (!b) return null
  let design = structuredClone(b.setup)
  let best = practise(state, design)
  const knobs = knobsOf(design)
  let nudge = BOT.firstNudge
  const tryOne = (candidate: Design) => {
    if (!legal(candidate, b.id)) return false
    const p = practise(state, candidate)
    // Its worst day first (that's what it promises, and a steady design reads true), then the mean.
    if (p.worst > best.worst + 1e-9 || (p.worst > best.worst - 1e-9 && p.mean > best.mean + 1e-9)) {
      design = candidate
      best = p
      return true
    }
    return false
  }
  const rng = new Rng(hashString(`bot-scout:${b.id}`))
  for (let i = 0; i < BOT.scouts; i++) {
    // Every other scout sets every knob at random, to look past a cliff (the sound barrier) a nudge never crosses.
    const share = i % 2 === 0 ? 0.5 : 1
    let candidate = design
    for (const knob of knobs) {
      if (rng.next() >= share) continue
      if (knob.kind === 'num') {
        const { min, max, step } = knob.range
        candidate = setAt(candidate, knob.path, onStep(min + rng.next() * (max - min), step))
      } else if (knob.kind === 'pick') {
        candidate = setAt(candidate, knob.path, rng.pick(knob.options))
      } else {
        candidate = setAt(candidate, knob.path, rng.next() < 0.5)
      }
    }
    tryOne(candidate)
  }
  for (let round = 0; round < BOT.shapeRounds; round++) {
    for (const knob of knobs) {
      const now = getAt(design, knob.path)
      if (knob.kind === 'num') {
        const { min, max, step } = knob.range
        const move = Math.max(step, onStep((max - min) * nudge, step))
        for (const dir of [1, -1]) {
          const next = Math.min(max, Math.max(min, onStep((now as number) + dir * move, step)))
          if (next !== now && tryOne(setAt(design, knob.path, next))) break
        }
      } else if (knob.kind === 'pick') {
        for (const option of knob.options) if (option !== now) tryOne(setAt(design, knob.path, option))
      } else {
        tryOne(setAt(design, knob.path, !now))
      }
    }
    nudge /= 2
  }
  return { design, practice: best }
}

/** The bot's bid: the worst practice day less the margin, at its share of the fee range. Null if not worth it. */
export function botBid(id: string, practice: Practice): Bid | null {
  const b = briefTemplate(id)
  if (!b) return null
  const promise = practice.worst - BOT.margin
  if (promise < BOT.minPromise) return null
  return clampBid(id, { price: b.fee.min + BOT.priceShare * (b.fee.max - b.fee.min), promise })
}

/** Which model family a sport's models come from. */
const FAMILY: Record<Sport, ScaleFamily> = {
  cycling: 'rider',
  skating: 'rider',
  skijump: 'rider',
  bobsled: 'rider',
  car: 'rider',
  truck: 'truck',
  record: 'truck',
  drone: 'drone',
  plane: 'plane',
  aircraft: 'aircraft',
  pod: 'pod',
}

/** The model the bot orders for a sport: the family's usual scale, sanded, standard grade. */
export function modelQuote(sport: Sport): { price: number; days: number } {
  const board = sport === 'bobsled' || sport === 'truck'
  return quote({ scale: FAMILY_START[FAMILY[sport]] as ModelScale, finish: 'sanded', grade: 'standard', trips: false, taps: false, ...(board ? { board } : {}) })
}

/** What the bot's runs cost on one job in this tunnel, ₽. */
export function runsCost(tunnel: TunnelId): number {
  const kWh = (fanPower(BOT.runSpeed) * BOT.runSeconds) / 3_600_000
  return BOT.runs * tunnelRunCost(tunnel, kWh)
}

/** One finished job in a bot career. */
export interface BotJob {
  day: number
  id: string
  sport: Sport
  fee: number
  paid: number
  /** Model and runs, ₽. */
  spent: number
  promised: number
  achieved: number
  kept: boolean
  readError: number
  money: number
  reputation: number
}

/** One whole bot career. */
export interface BotCareer {
  seed: number
  jobs: BotJob[]
  bidsWon: number
  bidsLost: number
  /** Briefs the bot passed on (it couldn't promise enough). */
  passed: number
  waits: number
  /** Day the bot paid for its own tunnel, or null. */
  ownTunnel: number | null
  /** Day defence clearance was first applied for, or null. */
  clearance: number | null
  broke: number
  final: CareerState
}

/** Shaping is the slow part, and a brief shapes the same in every career: keep each brief's result. */
export type ShapeCache = Map<string, Shaped | null>

/** Play one career from day one to 2040 (or for `steps` jobs, bids and waits, for a quick look). */
export function playCareer(seed: number, cache: ShapeCache = new Map(), steps: number = BOT.maxSteps): BotCareer {
  let state = newCareer(seed)
  const jobs: BotJob[] = []
  let bidsWon = 0
  let bidsLost = 0
  let passed = 0
  let waits = 0
  let ownTunnel: number | null = null
  let clearance: number | null = null
  const shaped = (s: CareerState): Shaped | null => {
    const id = s.job!.brief.id
    if (!cache.has(id)) cache.set(id, shapeFor(s))
    return cache.get(id)!
  }
  for (let step = 0; step < steps && !state.ended; step++) {
    // Between jobs: the tunnel, once it can be paid for with cash to spare, and clearance once allowed.
    if (ownTunnel === null && state.money >= OWN_TUNNEL_BUILD.price + BOT.reserve) {
      state = buildOwnTunnel(state)
      ownTunnel = state.day
    }
    if (BOT.clearance && clearanceBlock(state) === null) {
      state = applyForClearance(state)
      clearance ??= state.day
    }
    // Bid for the board's briefs, best profit per day first (the fee less a model and the runs where it tests now).
    const runs = runsCost(activeTunnel(state.facility, state.day))
    const net = (b: (typeof state.board)[number]) => (b.fee - runs - modelQuote(sportOf(briefTemplate(b.id)!.setup)).price) / b.days
    const board = [...state.board].sort((a, b) => net(b) - net(a))
    let won = false
    for (const brief of board) {
      // Shape on a trial job at the client's ask, to see what the bot could promise.
      const trial = { ...state, job: { brief, promise: 0, startDay: state.day, daysLeft: brief.days, spent: 0 } }
      const shot = shaped(trial)
      const bid = shot && botBid(brief.id, shot.practice)
      if (!bid) {
        passed++
        continue
      }
      const result = placeBid(state, brief.id, bid)
      if (!result) continue
      state = result.state
      if (!result.won) {
        bidsLost++
        continue
      }
      bidsWon++
      won = true
      // The work: a model if the days allow, then the runs; then race day.
      const sport = sportOf(shot.design)
      const before = state.money
      const model = modelQuote(sport)
      if (model.days <= state.job!.daysLeft) state = orderModel(state, model.price, model.days)
      state = charge(state, runsCost(activeTunnel(state.facility, state.day)))
      const spent = before - state.money
      const done = deliverAny(state, shot.design, shot.practice.actual)!
      state = done.state
      const r = done.record
      jobs.push({
        day: r.day,
        id: r.id,
        sport,
        fee: r.fee,
        paid: r.paid,
        spent,
        promised: r.promised,
        achieved: r.achieved,
        kept: r.achieved >= r.promised - PROMISE.allowance,
        readError: (r.predicted - r.actual) / r.actual,
        money: state.money,
        reputation: firmReputation(state),
      })
      break
    }
    if (!won && !state.ended) {
      state = waitForBriefs(state)
      waits++
    }
  }
  return { seed, jobs, bidsWon, bidsLost, passed, waits, ownTunnel, clearance, broke: state.broke.length, final: state }
}

/** Every brief template's id, for the per-brief table. */
export const BRIEF_IDS: readonly string[] = BRIEFS.map((b) => b.id)
