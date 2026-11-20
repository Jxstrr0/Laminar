/**
 * The save file (plan section 13): the design on the bench and the lab's
 * state, as JSON. Everything read back is checked before the game trusts
 * it: a save the game could not have written (cut short, edited, from a
 * newer version) is turned away rather than half loaded.
 */
import { DESIGN_CHOICES, PART_RANGE, POSTURE_RANGE, type CyclistDesign } from '../data/cyclist'
import { SKATER_CHOICES, SKATER_RANGE, type SkaterDesign } from '../data/skater'
import { JUMPER_RANGE, type JumperDesign } from '../data/jumper'
import { BOBSLED_RANGE, type BobsledDesign } from '../data/bobsled'
import { TRUCK_RANGE, type TruckDesign } from '../data/truck'
import { CAR_RANGE, type CarDesign } from '../data/car'
import { RECORD_RANGE, type RecordDesign } from '../data/record'
import { DRONE_RANGE, type DroneDesign } from '../data/drone'
import { PLANE_RANGE, type PlaneDesign } from '../data/plane'
import { AIRCRAFT_RANGE, type AircraftDesign } from '../data/aircraft'
import { POD_RANGE, type PodDesign } from '../data/pod'
import type { Design } from '../sim/design'
import { ALL_SCALES, MACHINE_IDS, MAKER_IDS, MODEL_FINISH, MODEL_GRADE, type MachineId } from '../data/model'
import { BRIEFS } from '../data/briefs'
import { CRANK_DIAL, DEMO_TUNNEL_SEED } from '../data/tunnel'
import { briefTemplate, newCareer, tidyFirmName, type Brief, type CareerState, type Ending, type Job, type JobRecord } from '../sim/career'
import { NO_CLEARANCE, type Clearance } from '../sim/clearance'
import { RECORD_IDS, type RecordId } from '../data/records'
import { NO_RESEARCH, soundResearch } from '../sim/research'
import { GUIDE_STEPS, type GuideStep } from '../sim/guide'
import { NO_FACILITY, type Facility } from '../sim/facility'
import { NO_CREW, soundCrew } from '../sim/staff'
import { UPGRADE_IDS, type UpgradeId } from '../data/tunnel'
import type { Failure, FailureMode, FailurePart } from '../sim/failure'
import type { LabState, RunNote } from '../sim/lab'
import { canMake, type ModelOrder } from '../sim/modelShop'
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
  design: Design
  lab: LabState
  career: CareerState
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0
const oneOf = <T extends string>(x: unknown, list: readonly T[]): x is T => typeof x === 'string' && (list as readonly string[]).includes(x)
const clampTo = (x: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, x))

/**
 * A design, with every number pulled inside its slider's range; null if
 * anything is missing or unknown. No `sport` (or "cycling") is a cyclist.
 */
export function soundDesign(x: unknown): Design | null {
  if (!isObj(x)) return null
  if (x.sport === 'skating') return soundSkater(x)
  if (x.sport === 'skijump') return soundJumper(x)
  if (x.sport === 'bobsled') return soundBobsled(x)
  if (x.sport === 'truck') return soundTruck(x)
  if (x.sport === 'car') return soundCar(x)
  if (x.sport === 'record') return soundRecordCar(x)
  if (x.sport === 'drone') return soundDrone(x)
  if (x.sport === 'plane') return soundPlane(x)
  if (x.sport === 'aircraft') return soundAircraft(x)
  if (x.sport === 'pod') return soundPod(x)
  if (x.sport !== undefined && x.sport !== 'cycling') return null
  return soundCyclist(x)
}

function soundJumper(x: Obj): JumperDesign | null {
  if (!isObj(x.posture) || !isObj(x.suit)) return null
  const { leanDeg, vAngleDeg } = x.posture
  const { bagginess } = x.suit
  if (!isNum(leanDeg) || !isNum(vAngleDeg) || !isNum(bagginess)) return null
  return {
    sport: 'skijump',
    posture: { leanDeg: clampTo(leanDeg, JUMPER_RANGE.leanDeg), vAngleDeg: clampTo(vAngleDeg, JUMPER_RANGE.vAngleDeg) },
    suit: { bagginess: clampTo(bagginess, JUMPER_RANGE.bagginess) },
  }
}

function soundBobsled(x: Obj): BobsledDesign | null {
  if (!isObj(x.sled) || (x.crew !== 2 && x.crew !== 4)) return null
  const { nose, tail, cowl } = x.sled
  if (!isNum(nose) || !isNum(tail) || !isNum(cowl) || !isNum(x.tuck)) return null
  return {
    sport: 'bobsled',
    crew: x.crew,
    sled: { nose: clampTo(nose, BOBSLED_RANGE.nose), tail: clampTo(tail, BOBSLED_RANGE.tail), cowl: clampTo(cowl, BOBSLED_RANGE.cowl) },
    tuck: clampTo(x.tuck, BOBSLED_RANGE.tuck),
  }
}

function soundTruck(x: Obj): TruckDesign | null {
  if (!isObj(x.cab) || !isObj(x.gap) || !isObj(x.trailer) || !isNum(x.trailerTop)) return null
  const { nose, fairing, extenders } = x.cab
  const { length, fill } = x.gap
  const { skirts, tail, tailAngle } = x.trailer
  if (![nose, fairing, extenders, length, fill, skirts, tail, tailAngle].every(isNum)) return null
  const R = TRUCK_RANGE
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return {
    sport: 'truck',
    trailerTop: n(x.trailerTop, R.trailerTop),
    cab: { nose: n(nose, R.nose), fairing: n(fairing, R.fairing), extenders: n(extenders, R.extenders) },
    gap: { length: n(length, R.gap), fill: n(fill, R.fill) },
    trailer: { skirts: n(skirts, R.skirts), tail: n(tail, R.tail), tailAngle: n(tailAngle, R.tailAngle) },
  }
}

function soundCar(x: Obj): CarDesign | null {
  if (!oneOf(x.class, ['touring', 'open'] as const) || !isObj(x.ride) || !isObj(x.rearWing)) return null
  const { front, rear } = x.ride
  const { angle, chord } = x.rearWing
  if (![front, rear, angle, chord, x.frontWing, x.diffuser, x.floorEdge, x.inlet].every(isNum)) return null
  // Each class has its own ranges: a touring car rides higher than a single-seater.
  const R = CAR_RANGE[x.class]
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return {
    sport: 'car',
    class: x.class,
    ride: { front: n(front, R.front), rear: n(rear, R.rear) },
    frontWing: n(x.frontWing, R.frontWing),
    rearWing: { angle: n(angle, R.angle), chord: n(chord, R.chord) },
    diffuser: n(x.diffuser, R.diffuser),
    floorEdge: n(x.floorEdge, R.floorEdge),
    inlet: n(x.inlet, R.inlet),
  }
}

function soundDrone(x: Obj): DroneDesign | null {
  if (!oneOf(x.class, ['racer'] as const) || !isObj(x.pod)) return null
  const { length, rake, vents } = x.pod
  if (![length, rake, vents, x.arms].every(isNum)) return null
  const R = DRONE_RANGE[x.class]
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return { sport: 'drone', class: x.class, pod: { length: n(length, R.length), rake: n(rake, R.rake), vents: n(vents, R.vents) }, arms: n(x.arms, R.arms) }
}

function soundPlane(x: Obj): PlaneDesign | null {
  if (!oneOf(x.class, ['survey'] as const) || !isObj(x.fuselage) || !isObj(x.camera)) return null
  const { nose, taper } = x.fuselage
  const { drop, fairing, at } = x.camera
  if (![nose, taper, drop, fairing, at, x.winglets, x.tail].every(isNum)) return null
  const R = PLANE_RANGE[x.class]
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return {
    sport: 'plane',
    class: x.class,
    fuselage: { nose: n(nose, R.nose), taper: n(taper, R.taper) },
    camera: { drop: n(drop, R.drop), fairing: n(fairing, R.fairing), at: n(at, R.at) },
    winglets: n(x.winglets, R.winglets),
    tail: n(x.tail, R.tail),
    // The span slider came in PR 10w: a plane saved before it has the maker's wing.
    span: isNum(x.span) ? n(x.span, R.span) : 1,
  }
}

function soundPod(x: Obj): PodDesign | null {
  if (!oneOf(x.class, ['patrol'] as const) || ![x.nose, x.tail, x.gap, x.at].every(isNum)) return null
  const R = POD_RANGE[x.class]
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return { sport: 'pod', class: x.class, nose: n(x.nose, R.nose), tail: n(x.tail, R.tail), gap: n(x.gap, R.gap), at: n(x.at, R.at) }
}

function soundAircraft(x: Obj): AircraftDesign | null {
  if (!oneOf(x.class, ['kit'] as const) || !isObj(x.struts) || !isObj(x.pod)) return null
  const { fairing, toe } = x.struts
  const pod = x.pod
  if (![x.spats, x.cowling, x.wingtips, fairing, toe, pod.fairing, pod.at].every(isNum)) return null
  const R = AIRCRAFT_RANGE[x.class]
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return {
    sport: 'aircraft',
    class: x.class,
    spats: n(x.spats, R.spats),
    cowling: n(x.cowling, R.cowling),
    wingtips: n(x.wingtips, R.wingtips),
    struts: { fairing: n(fairing, R.fairing), toe: n(toe, R.toe) },
    pod: { fairing: n(pod.fairing, R.podFairing), at: n(pod.at, R.podAt) },
  }
}

function soundRecordCar(x: Obj): RecordDesign | null {
  if (!oneOf(x.class, ['streamliner', 'jet'] as const) || !isObj(x.nose)) return null
  const { length, droop } = x.nose
  if (![length, droop, x.canopy, x.fin, x.fairings].every(isNum)) return null
  const R = RECORD_RANGE[x.class]
  const n = (v: unknown, r: { min: number; max: number }) => clampTo(v as number, r)
  return {
    sport: 'record',
    class: x.class,
    nose: { length: n(length, R.length), droop: n(droop, R.droop) },
    canopy: n(x.canopy, R.canopy),
    fin: n(x.fin, R.fin),
    fairings: n(x.fairings, R.fairings),
    // Saves from before the jet car (PR 9w) have no waist: a straight body.
    waist: n(isNum(x.waist) ? x.waist : 0, R.waist),
  }
}

function soundSkater(x: Obj): SkaterDesign | null {
  if (!isObj(x.posture) || !isObj(x.suit)) return null
  const posture = {} as SkaterDesign['posture']
  for (const k of Object.keys(SKATER_RANGE) as (keyof typeof SKATER_RANGE)[]) {
    const v = x.posture[k]
    if (!isNum(v)) return null
    posture[k] = clampTo(v, SKATER_RANGE[k])
  }
  const { fabric, legTrips } = x.suit
  if (!oneOf(x.arms, SKATER_CHOICES.arms) || !oneOf(x.hood, SKATER_CHOICES.hood)) return null
  if (!oneOf(fabric, SKATER_CHOICES.fabric) || typeof legTrips !== 'boolean') return null
  return { sport: 'skating', posture, arms: x.arms, hood: x.hood, suit: { fabric, legTrips } }
}

function soundCyclist(x: Obj): CyclistDesign | null {
  if (!isObj(x.posture) || !isObj(x.helmet) || !isObj(x.suit) || !isObj(x.wheels)) return null
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
    typeof x.steady === 'boolean' &&
    (x.clA === undefined || isNum(x.clA)) &&
    (x.pitchA === undefined || isNum(x.pitchA)) &&
    (x.clAFront === undefined || isNum(x.clAFront)) &&
    (x.liftFront === undefined || isNum(x.liftFront)) &&
    (x.centre === undefined || isNum(x.centre)) &&
    (x.twist === undefined || isNum(x.twist)) &&
    (x.downwash === undefined || isNum(x.downwash)) &&
    (x.cl === undefined || isNum(x.cl)) &&
    (x.cm === undefined || isNum(x.cm)) &&
    (x.re === undefined || isNum(x.re)) &&
    (x.shake === undefined || isNum(x.shake))
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
    isNum(x.topSpeed) &&
    (x.failure === undefined || soundFailure(x.failure) !== null) &&
    (x.tunnel === undefined || x.tunnel === 'own') &&
    (x.powered === undefined || x.powered === true) &&
    (x.wing === undefined || x.wing === true)
  )
}

const FAILURE_PARTS: Record<FailureMode, readonly FailurePart[]> = { flutter: ['tail', 'disc'], mount: ['posts', 'sting'], detach: ['helmet'] }

/** A failure the game could have written, or null. */
function soundFailure(x: unknown): Failure | null {
  if (!isObj(x) || typeof x.mode !== 'string' || !(x.mode in FAILURE_PARTS)) return null
  const mode = x.mode as FailureMode
  return FAILURE_PARTS[mode].includes(x.part as FailurePart) ? { mode, part: x.part as FailurePart } : null
}

const soundCrank = (x: unknown): x is number =>
  isNum(x) && x >= CRANK_DIAL.min && x <= CRANK_DIAL.max && (x - CRANK_DIAL.min) % CRANK_DIAL.step === 0

function soundOrder(x: unknown): ModelOrder | null {
  if (!isObj(x)) return null
  const { scale, finish, grade, trips, taps } = x
  if (!ALL_SCALES.includes(scale as never) || !oneOf(finish, Object.keys(MODEL_FINISH) as (keyof typeof MODEL_FINISH)[])) return null
  if (!oneOf(grade, Object.keys(MODEL_GRADE) as (keyof typeof MODEL_GRADE)[]) || typeof trips !== 'boolean') return null
  // Orders from before PR 7e were all the outside shop's.
  const maker = x.maker === undefined ? 'shop' : x.maker
  if (!oneOf(maker, MAKER_IDS)) return null
  const order: ModelOrder = { scale: scale as ModelOrder['scale'], finish, grade, trips, taps: taps === true, ...(x.board === true ? { board: true } : {}), ...(x.powered === true ? { powered: true } : {}), ...(x.wing === true ? { wing: true } : {}), ...(maker === 'shop' ? {} : { maker }) }
  return canMake(order) ? order : null
}

/**
 * The lab's state, or null if it isn't one the game could have written.
 * Notes on runs that aren't on file are dropped. A save from before PR 5d
 * doesn't say what the model was built of; then it was `modelFallback`
 * (back then the model always matched the bench design).
 */
export function soundLab(x: unknown, modelFallback: Design): LabState | null {
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
  // Saves from before PR 6a have no broken model.
  const broken = x.broken === undefined || x.broken === null ? null : soundFailure(x.broken)
  if (x.broken && !broken) return null
  return {
    runs,
    notes,
    order,
    modelDesign,
    build: x.build,
    crank: x.crank,
    nextRunId: x.nextRunId,
    balanceRng: x.balanceRng,
    broken,
  }
}

const isSeed = (x: unknown): x is number => isCount(x) && x <= 0xffffffff

export function soundBrief(x: unknown): Brief | null {
  if (!isObj(x) || typeof x.id !== 'string' || !briefTemplate(x.id)) return null
  if (!isCount(x.fee) || !isCount(x.days) || x.days === 0 || !isSeed(x.seed)) return null
  return { id: x.id, fee: x.fee, days: x.days, seed: x.seed }
}

function soundJob(x: unknown): Job | null {
  if (!isObj(x)) return null
  const brief = soundBrief(x.brief)
  if (!brief || !isCount(x.startDay) || !isCount(x.daysLeft) || x.daysLeft > brief.days || !isNum(x.spent)) return null
  // Jobs taken before PR 5e promised the brief's ask.
  const promise = x.promise === undefined ? briefTemplate(brief.id)!.target : x.promise
  if (!isNum(promise) || promise < 0 || promise > 100) return null
  return { brief, promise, startDay: x.startDay, daysLeft: x.daysLeft, spent: x.spent }
}

function soundRecord(x: unknown): JobRecord | null {
  if (!isObj(x) || typeof x.id !== 'string' || !isCount(x.day) || !isCount(x.fee) || !isNum(x.paid)) return null
  if (!isNum(x.promised) || !isNum(x.achieved) || !isNum(x.predicted) || !isNum(x.actual)) return null
  if (x.secret !== undefined && x.secret !== true) return null
  const record: JobRecord = { id: x.id, day: x.day, fee: x.fee, paid: x.paid, promised: x.promised, achieved: x.achieved, predicted: x.predicted, actual: x.actual }
  // A defence job (PR 10x).
  if (x.secret === true) record.secret = true
  // A Tarnovian record the job broke (PR 11a); never on a secret job.
  if (x.mark !== undefined) {
    const m = x.mark
    if (x.secret === true || !isObj(m) || typeof m.record !== 'string' || !(RECORD_IDS as readonly string[]).includes(m.record) || !isNum(m.value) || m.value <= 0) return null
    record.mark = { record: m.record as RecordId, value: m.value }
  }
  return record
}

/** Defence clearance (PR 10x), or null if it isn't one the game could have written. */
function soundClearance(x: unknown): Clearance | null {
  if (!isObj(x)) return null
  if (x.status === 'none') return NO_CLEARANCE
  if (x.status === 'vetting' && isCount(x.applied) && isCount(x.ready) && x.ready >= x.applied) return { status: 'vetting', applied: x.applied, ready: x.ready }
  if (x.status === 'cleared' && isCount(x.since)) return { status: 'cleared', since: x.since }
  if (x.status === 'lost' && isCount(x.on) && (x.why === 'broke' || x.why === 'reads')) return { status: 'lost', on: x.on, why: x.why }
  return null
}

function soundFacility(x: unknown): Facility | null {
  if (!isObj(x)) return null
  if (x.ownOrdered !== null && !isCount(x.ownOrdered)) return null
  // Facilities from PR 7c have no upgrades yet.
  const raw = x.upgrades === undefined ? {} : x.upgrades
  if (!isObj(raw)) return null
  const upgrades: Facility['upgrades'] = {}
  for (const [id, day] of Object.entries(raw)) {
    if (!(UPGRADE_IDS as readonly string[]).includes(id) || !isCount(day)) return null
    upgrades[id as UpgradeId] = day
  }
  // Facilities from before PR 7e have no machines.
  const owned = x.machines === undefined ? {} : x.machines
  if (!isObj(owned)) return null
  const machines: Facility['machines'] = {}
  for (const [id, day] of Object.entries(owned)) {
    if (!(MACHINE_IDS as readonly string[]).includes(id) || !isCount(day)) return null
    machines[id as MachineId] = day
  }
  return { ownOrdered: x.ownOrdered as number | null, upgrades, machines }
}

/** The career, or null if it isn't one the game could have written. */
export function soundCareer(x: unknown): CareerState | null {
  if (!isObj(x) || !isSeed(x.seed) || !isNum(x.money) || !isCount(x.day) || !isCount(x.jobsDone)) return null
  // A board holds a few briefs and none twice, so it can never be longer than
  // the list of briefs. A tampered save with thousands on it slowed the game to a crawl.
  if (!Array.isArray(x.board) || x.board.length > BRIEFS.length) return null
  const board = x.board.map(soundBrief)
  if (board.some((b) => !b)) return null
  const job = x.job === null ? null : soundJob(x.job)
  if (x.job !== null && !job) return null
  // Careers from before PR 5e have no record yet.
  const raw = x.history === undefined ? [] : x.history
  if (!Array.isArray(raw)) return null
  const history = raw.map(soundRecord)
  if (history.some((r) => !r)) return null
  // Careers from before PR 5f have had one board per job and lost no bids.
  const round = x.round === undefined ? x.jobsDone : x.round
  if (!isCount(round)) return null
  const lost = x.lost === undefined ? [] : x.lost
  if (!Array.isArray(lost) || lost.length > BRIEFS.length || !lost.every((id) => typeof id === 'string' && briefTemplate(id))) return null
  // Careers from before PR 5i get the guide only if they haven't finished a job.
  const guide = x.guide === undefined ? { off: x.jobsDone > 0, done: [] } : x.guide
  if (!isObj(guide) || typeof guide.off !== 'boolean' || !Array.isArray(guide.done)) return null
  if (!guide.done.every((s) => (GUIDE_STEPS as readonly unknown[]).includes(s))) return null
  // Careers from before PR 7c rent the university's tunnel.
  const facility = soundFacility(x.facility === undefined ? NO_FACILITY : x.facility)
  if (!facility) return null
  // Careers from before PR 7f have no staff.
  const crew = soundCrew(x.crew === undefined ? NO_CREW : x.crew)
  if (!crew) return null
  // Careers from before PR 7g never went broke. Each entry is a count of jobs on the record, in order.
  const broke = x.broke === undefined ? [] : x.broke
  if (!Array.isArray(broke) || !broke.every((n, i) => isCount(n) && n <= history.length && (i === 0 || n >= broke[i - 1]))) return null
  // Careers from before PR 7i keep the ready-made name and are still running.
  const firm = x.firm === undefined ? null : x.firm
  if (firm !== null && (typeof firm !== 'string' || firm !== tidyFirmName(firm) || firm === '')) return null
  const ended = x.ended === undefined ? null : x.ended
  if (ended !== null && (!isObj(ended) || !isCount(ended.day) || (ended.why !== 'retired' && ended.why !== 'year2040'))) return null
  // Careers from before PR 10x never applied for defence clearance.
  const clearance = soundClearance(x.clearance === undefined ? NO_CLEARANCE : x.clearance)
  if (!clearance) return null
  // Careers from before PR 11d have no R&D; a project can't have started after today.
  const research = soundResearch(x.research === undefined ? NO_RESEARCH : x.research)
  if (!research || Object.values(research).some((d) => d > (x.day as number))) return null
  return {
    seed: x.seed,
    money: x.money,
    day: x.day,
    jobsDone: x.jobsDone,
    round,
    board: board as Brief[],
    lost: lost as string[],
    job,
    history: history as JobRecord[],
    guide: { off: guide.off, done: guide.done as GuideStep[] },
    facility,
    crew,
    broke: broke as number[],
    firm,
    ended: ended as Ending | null,
    clearance,
    research,
  }
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
