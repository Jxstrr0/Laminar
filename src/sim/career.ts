/**
 * The firm's career (plan sections 4 and 9): money, the calendar, the brief
 * board and the job in hand. Every step here is a pure function from one
 * state to the next, so the save holds the whole career as plain numbers.
 *
 * - Tunnel runs cost money and no days, with or without a job.
 * - Model orders need a job, cost money and spend days from its budget.
 * - A brief is won with a sealed bid against the rival firms (Bystro Aero on
 *   every brief, Vysota Aerolab on the big ones); a lost brief
 *   leaves the board and another takes its place while any are left.
 * - Your own tunnel is bought with cash and opens OWN_TUNNEL_BUILD.days later;
 *   from then on its upkeep is paid for every day that passes (passDays).
 * - Staff (one per role) are paid their wage for every day that passes too.
 * - A job that leaves cash below zero sells kit to cover it (src/sim/broke.ts)
 *   and costs a little reputation; there is no game over.
 * - The career ends when the player retires or the calendar reaches 2040
 *   (Kelbo, 16 November 2026); an ended career is closed, and nothing in it
 *   changes any more.
 * - Delivering runs the event, pays the fee, jumps the calendar to the
 *   event and refreshes the board.
 */
import { RECORD_TUNNEL, STOCK_RECORD, type RecordClass, type RecordDesign } from '../data/record'
import { STOCK_AIRCRAFT, type AircraftClass, type AircraftDesign, type Airfield } from '../data/aircraft'
import { OLD_POD, type PodClass, type PodDesign, type TestRange } from '../data/pod'
import type { Sensor } from './pod'
import { dragScaleForHours, planeDragArea, podEventFrom, podFlight, PRACTICE_RANGE, rangeDay, usualRangeDay, type PodEvent, type PodFlight, type RangeDay } from './podJob'
import { stallFix } from './aircraft'
import { applied, applyBlock, clearanceOn, isCleared, NO_CLEARANCE, reviewClearance, type ApplyBlock, type Clearance } from './clearance'
import { CLEARANCE } from '../data/defence'
import { aircraftEventFrom, cruiseDragArea, dragScaleForCruise, PRACTICE_FIELD, testDay, testFlight, usualTestDay, type AircraftEvent, type TestDay, type TestFlight } from './aircraftJob'
import { STOCK_DRONE, type DroneClass, type DroneCourse, type DroneDesign } from '../data/drone'
import { STOCK_PLANE, type PlaneClass, type PlaneDesign, type SurveySite } from '../data/plane'
import { cameraTooHigh } from './plane'
import { dragScaleForRange, looseFix, planeEventFrom, PRACTICE_SITE, surveyDay, surveyDragArea, surveyFlight, usualDay, type PlaneEvent, type SurveyDay, type SurveyFlight } from './planeJob'
import { droneRace, type DroneRace } from './drone'
import { dragScaleForTime, droneDayAir, droneEventFrom, heatCost, PRACTICE_COURSE, raceDragArea, type DroneEvent } from './droneJob'
import type { SaltFlat } from '../data/saltFlats'
import { AIRCRAFT_JOBS, POD_JOBS, BID, BRIEFS, CAREER, CAR_JOBS, DRONE_JOBS, JUMP_JOBS, PLANE_JOBS, PROMISE, RECORD_JOBS, SLED_JOBS, TRUCK_JOBS, type BriefTemplate } from '../data/briefs'
import { recordAero, recordDayAir, sightLoss, soundSpeed, twoWay, type RecordAttempt, type RecordDay } from './record'
import { dragScaleForSpeed, PRACTICE_FLAT, recordEventFrom, sightCost, stillAttempt, type RecordEvent } from './recordJob'
import type { BobsledDesign } from '../data/bobsled'
import { dayDrag, referenceConditions, referenceRun, runWith, type BobRun, type RunConditions } from './bobsled'
import { cdAForTime, PRACTICE_RUN, raceConditions, sledEventFrom, type SledEvent } from './sledJob'
import { FLEET_TRUCK, GRAVEL_YARD, type TruckDesign } from '../data/truck'
import type { Route } from '../data/routes'
import { checkTruckRules, fuelRun, skirtGap, fuelSaving, windAveragedFuel, type FuelRun, type RouteDay, type TruckRuleBreak } from './truck'
import { asRun, dragScaleForFuel, PRACTICE_ROUTE, roadLegal, straightOnCdA, trialDay, truckEventFrom, type TruckEvent } from './truckJob'
import { CAR_DESK, STOCK_CAR, type CarClass, type CarDesign } from '../data/car'
import type { Circuit } from '../data/circuits'
import { carAero, checkCarRules, circuitDensity, lapTime, scrutineered, type CarRuleBreak, type Lap } from './car'
import { carEventFrom, downScaleForLap, lapTroubles, PRACTICE_CIRCUIT, raceDayAir, worstBalance, type CarEvent } from './carJob'
import { HILLS, PRACTICE_JUMP } from '../data/hills'
import type { JumperDesign } from '../data/jumper'
import { jumpDay, referenceJump, type JumpEvent, type JumpResult, type ReferenceJump } from './jumper'
import { REFERENCE_RIDER } from '../data/field'
import { designComfort, designEvent, designShape, sportOf, sportRider, type Design } from './design'
import type { FixTarget } from './failure'
import { hashString, Rng } from './rng'
import type { Guide } from './guide'
import { correlationScore, readOf, reputationOf, type Read } from './reputation'
import { REPUTATION } from '../data/reputation'
import { RIVALS, RIVAL_IDS, type RivalId } from '../data/rivals'
import { rivalRecord } from './rivals'
import { buildBlock, machineBlock, NO_FACILITY, upgradeBlock, upkeepDays, type Facility } from './facility'
import { MACHINE_PRICE, type MachineId } from '../data/model'
import { OWN_TUNNEL_BUILD, TUNNEL_UPGRADES, type UpgradeId } from '../data/tunnel'
import { sellToCover, type Sale } from './broke'
import { hire, letGo, NO_CREW, wagesPerDay, type Crew } from './staff'
import type { StaffId } from '../data/staff'
import { fieldResult, REFERENCE_TT, truth, type EventSpec, type FieldResult } from './views'
import { claim, recordBoard, type Holding, type RecordMark } from './records'
import { RECORD_RULES, type RecordId } from '../data/records'

/** A brief as it sits on the board: which client, and the terms on offer. */
export interface Brief {
  /** The template's id in BRIEFS. */
  id: string
  /** The client's suggested fee, ₽ (the job's fee is what you bid). */
  fee: number
  days: number
  /** Seed for this job's desk bias and its event day. */
  seed: number
}

export interface Job {
  brief: Brief
  /** The promised cut, % of wind-averaged CdA from the client's setup (from your bid). */
  promise: number
  /** The career day the job was taken. */
  startDay: number
  daysLeft: number
  /** Money spent while on the job (runs and models), ₽. */
  spent: number
}

/** One finished job, kept for the firm's record: its reputation and correlation score come from these. */
export interface JobRecord {
  id: string
  /** Race day. */
  day: number
  fee: number
  paid: number
  /** Promised and achieved cut, %. */
  promised: number
  achieved: number
  /** Declared and real CdA on the day, m². */
  predicted: number
  actual: number
  /** A defence job (PR 10x): counts toward the correlation score, never the public reputation or the legacy card. */
  secret?: true
  /** A Tarnovian record this job's result broke (PR 11a). */
  mark?: RecordMark
}

export interface CareerState {
  /** The career's own seed: its tunnel's quirks and every board. */
  seed: number
  /** ₽ (may go below zero; the soft landing comes with PR 7). */
  money: number
  /** Days since the career began. */
  day: number
  jobsDone: number
  /** Which board this is: one more after every delivery or week's wait. */
  round: number
  board: Brief[]
  /** Briefs lost to a rival on this board, so they don't come back to it. */
  lost: string[]
  job: Job | null
  /** Finished jobs, oldest first. */
  history: JobRecord[]
  /** The partner's guide through the first job (src/sim/guide.ts). */
  guide: Guide
  /** Where the firm tests: the university's tunnel, and your own once it's paid for. */
  facility: Facility
  /** Who's on the staff (one per role). */
  crew: Crew
  /** Each time the firm went broke, as the number of jobs done by then. */
  broke: number[]
  /** The name the player gave the firm, or null while it keeps its ready-made one. */
  firm: string | null
  /** How and when the career ended, or null while it runs. */
  ended: Ending | null
  /** Where the firm stands with the defence ministry (PR 10x). */
  clearance: Clearance
}

/** The end of a career: the player retired, or 2040 came. */
export interface Ending {
  day: number
  why: 'retired' | 'year2040'
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

/** A template as it goes on a board: a suggested fee and its own seed. */
function onBoard(b: BriefTemplate, rng: Rng): Brief {
  const fee = Math.round(rng.range(b.fee.min, b.fee.max) / CAREER.feeRound) * CAREER.feeRound
  return { id: b.id, fee, days: b.days, seed: rng.int(1, 0x7fffffff) }
}

/** Clients who'll call a firm with this reputation (Kelbo: a good name brings bigger clients). */
export function openTo(b: BriefTemplate, reputation: number, cleared = false): boolean {
  // Defence briefs reach only a cleared firm's board (PR 10x).
  if (b.defence && !cleared) return false
  if (b.event.jump && !JUMP_JOBS.open) return false
  if (b.event.sled && !SLED_JOBS.open) return false
  if (b.event.truck && !TRUCK_JOBS.open) return false
  if (b.event.car && !CAR_JOBS.open) return false
  if (b.event.record && !RECORD_JOBS.open) return false
  if (b.event.drone && !DRONE_JOBS.open) return false
  if (b.event.plane && !PLANE_JOBS.open) return false
  if (b.event.aircraft && !AIRCRAFT_JOBS.open) return false
  if (b.event.pod && !POD_JOBS.open) return false
  return (b.minRep ?? 0) <= reputation
}

/** True for a ski-jump brief: its promise and declaration are in metres. */
export function isJumpBrief(id: string): boolean {
  return briefTemplate(id)?.event.jump !== undefined
}

/** A ski-jump brief's jump, ready for the flight model. Null for any other brief. */
export function jumpEventOf(brief: Pick<Brief, 'id'>): JumpEvent | null {
  const e = template(brief.id).event
  if (!e.jump) return null
  return {
    hill: HILLS[e.jump.hill],
    mass: e.jump.mass,
    temperature: e.temperature,
    altitude: e.altitude,
    headwind: e.windSpeed,
    spread: { temperature: e.spread.temperature, wind: e.spread.wind, speed: e.jump.speedSpread },
  }
}

/** True for a bobsled brief: its promise is tenths of a second (bid in hundredths), its declaration a run time. */
export function isSledBrief(id: string): boolean {
  return briefTemplate(id)?.event.sled !== undefined
}

/** A bobsled brief's race, ready for the run model. Null for any other brief. */
export function sledEventOf(brief: Pick<Brief, 'id'>): SledEvent | null {
  return sledEventFrom(template(brief.id))
}

/** True for a truck brief: its promise is per cent of fuel saved, its declaration a fuel figure. */
export function isTruckBrief(id: string): boolean {
  return briefTemplate(id)?.event.truck !== undefined
}

/** A truck brief's fuel trial, ready for the fuel run. Null for any other brief. */
export function truckEventOf(brief: Pick<Brief, 'id'>): TruckEvent | null {
  return truckEventFrom(template(brief.id))
}

/** True for a racing-car brief: its promise is tenths of a second off the lap, its declaration a lap time. */
export function isCarBrief(id: string): boolean {
  return briefTemplate(id)?.event.car !== undefined
}

/** A car brief's race weekend, ready for the lap. Null for any other brief. */
export function carEventOf(brief: Pick<Brief, 'id'>): CarEvent | null {
  return carEventFrom(template(brief.id))
}

/** True for a land-speed record brief: its promise is km/h on the two-way mean, its declaration a record speed. */
export function isRecordBrief(id: string): boolean {
  return briefTemplate(id)?.event.record !== undefined
}

/** True for a racing-quad brief: its promise is tenths of a second off the race, its declaration a race time. */
export function isDroneBrief(id: string): boolean {
  return briefTemplate(id)?.event.drone !== undefined
}

/** A quad brief's club race. Null for any other brief. */
export function droneEventOf(brief: Pick<Brief, 'id'>): DroneEvent | null {
  return droneEventFrom(template(brief.id))
}

/** True for a survey-drone brief: its promise is kilometres of range, its declaration a range. */
export function isPlaneBrief(id: string): boolean {
  return briefTemplate(id)?.event.plane !== undefined
}

/** True for a light-aircraft brief: its promise is km/h of cruise, its declaration a cruise speed (PR 10t). */
export function isAircraftBrief(id: string): boolean {
  return briefTemplate(id)?.event.aircraft !== undefined
}

/** True for a sensor-pod brief: its promise is minutes on station, its declaration hours on station (PR 10ac). */
export function isPodBrief(id: string): boolean {
  return briefTemplate(id)?.event.pod !== undefined
}

/** A sensor-pod brief's range trial. Null for any other brief. */
export function podEventOf(brief: Pick<Brief, 'id'>): PodEvent | null {
  return podEventFrom(template(brief.id))
}

/** A light-aircraft brief's test flight. Null for any other brief. */
export function aircraftEventOf(brief: Pick<Brief, 'id'>): AircraftEvent | null {
  return aircraftEventFrom(template(brief.id))
}

/** A survey brief's contract. Null for any other brief. */
export function planeEventOf(brief: Pick<Brief, 'id'>): PlaneEvent | null {
  return planeEventFrom(template(brief.id))
}

/** A record brief's speed week. Null for any other brief. */
export function recordEventOf(brief: Pick<Brief, 'id'>): RecordEvent | null {
  return recordEventFrom(template(brief.id))
}

/**
 * Board number `round`: the tutorial first while no job is done, and always
 * one small brief; the rest are clients who'll call a firm with this
 * reputation. (Round n of a career that has never waited or lost is the
 * board after n jobs, as before bids.)
 */
export function boardFor(seed: number, round: number, firstJob = round === 0, reputation: number = REPUTATION.start, cleared = false): Brief[] {
  const rng = new Rng(seed).fork(`board-${round}`)
  const first = firstJob ? BRIEFS.filter((b) => b.tutorial) : []
  const small = rng.shuffle(BRIEFS.filter((b) => b.small))
  const rest = rng.shuffle(BRIEFS.filter((b) => !b.tutorial && !b.small && openTo(b, reputation, cleared)))
  const picked = [...first, ...small.slice(0, 1)]
  for (const b of [...rest, ...small.slice(1)]) {
    if (picked.length >= CAREER.boardSize) break
    picked.push(b)
  }
  return picked.map((b) => onBoard(b, rng))
}

export function newCareer(seed: number): CareerState {
  return {
    seed,
    money: CAREER.startMoney,
    day: 0,
    jobsDone: 0,
    round: 0,
    board: boardFor(seed, 0),
    lost: [],
    job: null,
    history: [],
    guide: { off: false, done: [] },
    facility: NO_FACILITY,
    crew: NO_CREW,
    broke: [],
    firm: null,
    ended: null,
    clearance: NO_CLEARANCE,
  }
}

/** The ready-made name for a career's firm. */
export function defaultFirmName(seed: number): string {
  return CAREER.firmNames[new Rng(seed).fork('firm-name').int(0, CAREER.firmNames.length - 1)]!
}

/** The firm's name as players read it. */
export function firmName(state: Pick<CareerState, 'seed' | 'firm'>): string {
  return state.firm ?? defaultFirmName(state.seed)
}

/** A typed name, tidied: spaces squeezed and trimmed, cut to CAREER.firmNameMax. Empty if nothing's left. */
export function tidyFirmName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, CAREER.firmNameMax).trim()
}

/** Name the firm (an empty name keeps the ready-made one, now chosen). */
export function nameFirm(state: CareerState, raw: string): CareerState {
  if (state.ended) return state
  return { ...state, firm: tidyFirmName(raw) || defaultFirmName(state.seed) }
}

/** Retire: the career ends today. Not with a job in hand. */
export function retire(state: CareerState): CareerState {
  if (state.ended || state.job) return state
  return { ...state, ended: { day: state.day, why: 'retired' } }
}

/** Where the firm stands with the defence ministry today (PR 10x). */
export function firmClearance(state: Pick<CareerState, 'clearance' | 'day'>): Clearance {
  return clearanceOn(state.clearance, state.day)
}

/** Why the firm can't apply for defence clearance today, or null if it can. */
export function clearanceBlock(state: CareerState): ApplyBlock {
  return applyBlock({
    day: state.day,
    money: state.money,
    reputation: firmReputation(state),
    correlation: correlationScore(state.history),
    clearance: state.clearance,
    ended: state.ended !== null,
  })
}

/** Apply for defence clearance: the fee is paid now, and vetting runs for CLEARANCE.vettingDays. */
export function applyForClearance(state: CareerState): CareerState {
  if (clearanceBlock(state) !== null) return state
  return { ...state, money: state.money - CLEARANCE.fee, clearance: applied(state.day) }
}

/** Close the career once the calendar has reached 2040. */
function closeIfOver(state: CareerState): CareerState {
  if (state.ended || state.day < CAREER.endDay) return state
  return { ...state, ended: { day: state.day, why: 'year2040' } }
}

/** The firm's reputation now: its record, less a dip for each time it went broke. */
export function firmReputation(state: Pick<CareerState, 'history' | 'broke'>): number {
  return reputationOf(state.history, state.broke)
}

/** The upkeep due for `days` more days from the career's day, ₽. */
export function upkeepFor(state: CareerState, days: number): number {
  return upkeepDays(state.facility, state.day, state.day + days) * OWN_TUNNEL_BUILD.upkeepPerDay
}

/** The staff's wages for `days` more days, ₽. */
export function wagesFor(state: CareerState, days: number): number {
  return Math.max(0, days) * wagesPerDay(state.crew)
}

/**
 * Let days pass: the calendar moves on, and the open tunnel's upkeep and the
 * staff's wages are paid for each of them. They're the firm's costs, not the
 * job's, so they stay off the job's tally.
 */
export function passDays(state: CareerState, days: number): CareerState {
  if (days <= 0) return state
  return { ...state, money: state.money - upkeepFor(state, days) - wagesFor(state, days), day: state.day + days }
}

/** Take someone on (whoever held their role leaves). Wages start with the next day that passes. */
export function hireStaff(state: CareerState, id: StaffId): CareerState {
  if (state.ended) return state
  return { ...state, crew: hire(state.crew, id) }
}

/** Let someone go. Nothing more is owed. */
export function letStaffGo(state: CareerState, id: StaffId): CareerState {
  return { ...state, crew: letGo(state.crew, id) }
}

/** Pay for your own tunnel (cash only); it opens OWN_TUNNEL_BUILD.days later. Unchanged if it can't be bought. */
export function buildOwnTunnel(state: CareerState): CareerState {
  if (state.ended || buildBlock(state.facility, state.money)) return state
  return { ...state, money: state.money - OWN_TUNNEL_BUILD.price, facility: { ...state.facility, ownOrdered: state.day } }
}

/** Buy a workshop machine (cash only); it arrives at once. Unchanged if it can't be bought. */
export function buyMachine(state: CareerState, id: MachineId): CareerState {
  if (state.ended || machineBlock(state.facility, state.money, id)) return state
  const facility = { ...state.facility, machines: { ...state.facility.machines, [id]: state.day } }
  return { ...state, money: state.money - MACHINE_PRICE[id], facility }
}

/** Pay for an upgrade to your tunnel (cash only); it's fitted TUNNEL_UPGRADES[id].days later. Unchanged if it can't be. */
export function orderUpgrade(state: CareerState, id: UpgradeId): CareerState {
  if (state.ended || upgradeBlock(state.facility, state.day, state.money, id)) return state
  const facility = { ...state.facility, upgrades: { ...state.facility.upgrades, [id]: state.day } }
  return { ...state, money: state.money - TUNNEL_UPGRADES[id].price, facility }
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
    rider: sportRider(sportOf(b.setup), { ...REFERENCE_RIDER, power: b.rider.power, mass: b.rider.mass }),
    refX: REFERENCE_TT.refX,
    spread: b.event.spread,
  }
}

/** The event the bench is working towards: the job's, or the reference time trial between jobs. */
export function currentEvent(state: CareerState): EventSpec {
  return state.job ? eventOf(state.job.brief) : REFERENCE_TT
}

/** The jump a jumper is built for: the job's hill and day, or the practice jump between jobs. */
export function currentJumpEvent(state: CareerState): JumpEvent {
  return (state.job && jumpEventOf(state.job.brief)) ?? PRACTICE_JUMP
}

/** The race a sled is built for: the job's, or Belogor in the reference conditions between jobs. */
export function currentSledEvent(state: CareerState): SledEvent {
  return (state.job && sledEventOf(state.job.brief)) ?? PRACTICE_RUN
}

/** The route a truck is built for: the job's, or the Mostograd run between jobs. */
export function currentTruckEvent(state: CareerState): TruckEvent {
  return (state.job && truckEventOf(state.job.brief)) ?? PRACTICE_ROUTE
}

/**
 * The route a truck is forecast on and the fleet's truck it's measured
 * against (known from their own fuel records): the job's, or the plain
 * fleet rig with this trailer on the Mostograd run between jobs.
 */
export function currentTruckRun(state: CareerState, trailerTop: number): { route: Route; old: TruckDesign } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  return { route: currentTruckEvent(state).route, old: setup && setup.sport === 'truck' ? setup : { ...FLEET_TRUCK, trailerTop } }
}

/** The race weekend a car is built for: the job's, or the Dolgo Ring on its usual day between jobs. */
export function currentCarEvent(state: CareerState): CarEvent {
  return (state.job && carEventOf(state.job.brief)) ?? PRACTICE_CIRCUIT
}

/**
 * The circuit a car is forecast on and the team's car it's measured
 * against: the job's, or a middling car of this class at the Dolgo Ring
 * between jobs.
 */
export function currentCarRun(state: CareerState, cls: CarClass): { circuit: Circuit; old: CarDesign } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  return { circuit: currentCarEvent(state).circuit, old: setup && setup.sport === 'car' && setup.class === cls ? setup : STOCK_CAR[cls] }
}

/** The club race a quad is built for: the job's, or the Lugovoy meadow on its usual day between jobs. */
export function currentDroneEvent(state: CareerState): DroneEvent {
  return (state.job && droneEventOf(state.job.brief)) ?? PRACTICE_COURSE
}

/**
 * The course a racing quad is forecast on and the pilot's quad it's
 * measured against: the job's (PR 10f), or a club racer as the hobby pilots
 * fly it at the Lugovoy meadow between jobs.
 */
export function currentDroneRun(state: CareerState, cls: DroneClass): { course: DroneCourse; old: DroneDesign } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  return { course: currentDroneEvent(state).course, old: setup && setup.sport === 'drone' && setup.class === cls ? setup : STOCK_DRONE[cls] }
}

/** The survey a plane is built for: the job's, or the Ozimka fields on their usual day between jobs. */
export function currentPlaneEvent(state: CareerState): PlaneEvent {
  return (state.job && planeEventOf(state.job.brief)) ?? PRACTICE_SITE
}

/** The test flight a kit plane is built for: the job's, or Belyanka on its usual day between jobs (PR 10t). */
export function currentAircraftEvent(state: CareerState): AircraftEvent {
  return (state.job && aircraftEventOf(state.job.brief)) ?? PRACTICE_FIELD
}

/**
 * The airfield a kit plane is forecast over and the client's plane it's
 * measured against: the job's (PR 10t), or Belyanka and the kit as its
 * builders fly it between jobs.
 */
export function currentAircraftRun(state: CareerState, cls: AircraftClass): { field: Airfield; old: AircraftDesign } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  return { field: currentAircraftEvent(state).field, old: setup && setup.sport === 'aircraft' && setup.class === cls ? setup : STOCK_AIRCRAFT[cls] }
}

/** The range trial a sensor pod is built for: the job's, or Stepnoy on its usual day between jobs (PR 10ac). */
export function currentPodEvent(state: CareerState): PodEvent {
  return (state.job && podEventOf(state.job.brief)) ?? PRACTICE_RANGE
}

/**
 * The range a sensor pod is forecast over and the pod it's measured
 * against, with the sensor inside it: on a job, the ministry's pod as it
 * hangs now, round the new sensor (PR 10ac); between jobs, the old pod
 * round the old sensor, the plane as it flies today (PR 10z).
 */
export function currentPodRun(state: CareerState, cls: PodClass): { range: TestRange; old: PodDesign; oldSensor: Sensor } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  const range = currentPodEvent(state).range
  if (setup && setup.sport === 'pod' && setup.class === cls) return { range, old: setup, oldSensor: 'new' }
  return { range, old: OLD_POD[cls], oldSensor: 'old' }
}

/**
 * The site a survey drone is forecast at and the client's plane it's
 * measured against: the job's (PR 10m), or the maker's plane as sold at the
 * Ozimka fields between jobs.
 */
export function currentPlaneRun(state: CareerState, cls: PlaneClass): { site: SurveySite; old: PlaneDesign } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  return { site: currentPlaneEvent(state).site, old: setup && setup.sport === 'plane' && setup.class === cls ? setup : STOCK_PLANE[cls] }
}

/** The speed week a record car is built for: the job's, or Lake Sukhoye on its usual day between jobs. */
export function currentRecordEvent(state: CareerState): RecordEvent {
  return (state.job && recordEventOf(state.job.brief)) ?? PRACTICE_FLAT
}

/**
 * The salt flat a land-speed car is forecast on and the team's car it's
 * measured against: the job's (PR 9t), or a middling streamliner at Lake
 * Sukhoye between jobs.
 */
export function currentRecordRun(state: CareerState, cls: RecordClass): { flat: SaltFlat; old: RecordDesign } {
  const setup = state.job ? template(state.job.brief.id).setup : null
  return { flat: currentRecordEvent(state).flat, old: setup && setup.sport === 'record' && setup.class === cls ? setup : STOCK_RECORD[cls] }
}

/** Take a brief off the board at its suggested fee and the client's ask. Only one job at a time. */
export function acceptBrief(state: CareerState, id: string): CareerState {
  const brief = state.board.find((b) => b.id === id)
  if (!brief || state.ended) return state
  return take(state, brief, { price: brief.fee, promise: template(id).target })
}

function take(state: CareerState, brief: Brief, bid: Bid): CareerState {
  if (state.job) return state
  return { ...state, job: { brief: { ...brief, fee: bid.price }, promise: bid.promise, startDay: state.day, daysLeft: brief.days, spent: 0 } }
}

/** A sealed bid: a price, ₽, and a promised cut, %. */
export interface Bid {
  price: number
  promise: number
}

export interface BidResult {
  state: CareerState
  won: boolean
  /** Your bid as it went in (kept inside the limits). */
  mine: Bid
  /** The rivals' bids (none when the client asked for you alone, as on the first job). */
  rivals: RivalBid[]
  /** Who got the job: null for you, or the rival that beat you. */
  winner: RivalId | null
  /** What the client counts each promised point as worth, ₽. */
  worth: number
  /** Your firm's reputation, as the client weighed it. */
  myRep: number
}

/** A rival firm's sealed bid, with the reputation the client weighed it with. */
export interface RivalBid {
  firm: RivalId
  bid: Bid
  reputation: number
}

/** ₽ the client counts each promised point as worth: a share of the middle of the fee range. */
export function pointWorth(id: string): number {
  const b = template(id)
  return Math.round((((b.fee.min + b.fee.max) / 2) * BID.pointValue) / 100) * 100
}

/**
 * How the client rates a bid: the promise's worth plus what it saves under
 * the top of the fee range, plus a little for the firm's name (each
 * reputation point counts as a small share of a promised point). Higher wins.
 */
export function bidScore(id: string, bid: Bid, reputation = 0): number {
  return (bid.promise + reputation * REPUTATION.bidPerPoint) * pointWorth(id) + template(id).fee.max - bid.price
}

/** x to the nearest step (a step under 1 divides, so 0.1 steps come out clean). */
const roundTo = (x: number, step: number) => (step < 1 ? Math.round(x / step) / Math.round(1 / step) : Math.round(x / step) * step)

/** A bid brought inside the brief's fee range and the promise limits, on the steps. */
/** The smallest and largest promise a bid for this brief can make, points (a record car's runs higher: PR 9z). */
export function promiseLimits(id: string): { min: number; max: number } {
  return { min: BID.promiseMin, max: isRecordBrief(id) ? RECORD_JOBS.promiseMax : BID.promiseMax }
}

export function clampBid(id: string, bid: Bid): Bid {
  const b = template(id)
  const price = Math.min(b.fee.max, Math.max(b.fee.min, roundTo(bid.price, BID.priceStep)))
  // A sled's promise moves in hundredths of a second, a car's and a quad's in tenths, a record car's 2 km/h at a time, a survey drone's a kilometre, a kit plane's a km/h, a sensor pod's a minute.
  const step = isSledBrief(id)
    ? SLED_JOBS.promiseStep
    : isCarBrief(id)
      ? CAR_JOBS.promiseStep
      : isRecordBrief(id)
        ? RECORD_JOBS.promiseStep
        : isDroneBrief(id)
          ? DRONE_JOBS.promiseStep
          : isPlaneBrief(id)
            ? PLANE_JOBS.promiseStep
            : isAircraftBrief(id)
              ? AIRCRAFT_JOBS.promiseStep
              : isPodBrief(id)
                ? POD_JOBS.promiseStep
                : BID.promiseStep
  const limits = promiseLimits(id)
  const promise = Math.min(limits.max, Math.max(limits.min, roundTo(bid.promise, step)))
  return { price, promise }
}

/** The firms that bid for a brief: none for the first job, Vysota Aerolab only on the big ones. */
export function biddersFor(id: string): RivalId[] {
  const b = template(id)
  if (b.tutorial) return []
  return RIVAL_IDS.filter((firm) => b.fee.max >= RIVALS[firm].minFee)
}

/** One rival's sealed bid for a brief (seeded by the brief and the firm). */
export function rivalBid(brief: Brief, firm: RivalId): Bid {
  const b = template(brief.id)
  const r = RIVALS[firm]
  const rng = new Rng(brief.seed).fork(`rival-${firm}`)
  const promise = b.target + rng.range(r.promise.min, r.promise.max)
  const share = rng.range(r.price.min, r.price.max)
  return clampBid(brief.id, { price: b.fee.min + share * (b.fee.max - b.fee.min), promise })
}

/** Every rival's bid for a brief, weighed with that firm's reputation this week. */
export function rivalBids(state: Pick<CareerState, 'seed' | 'day'>, brief: Brief): RivalBid[] {
  return biddersFor(brief.id).map((firm) => ({
    firm,
    bid: rivalBid(brief, firm),
    reputation: rivalRecord(state.seed, firm, state.day).reputation,
  }))
}

/**
 * Put in a sealed bid. Win (ties go to you) and the job starts at your price
 * and promise. Lose and the brief leaves the board, and another the firm
 * hasn't lost this round takes its place if there is one. Null if the brief
 * isn't on the board or a job is in hand.
 */
export function placeBid(state: CareerState, id: string, bid: Bid): BidResult | null {
  const brief = state.board.find((b) => b.id === id)
  if (!brief || state.job || state.ended) return null
  const mine = clampBid(id, bid)
  const rivals = rivalBids(state, brief)
  const worth = pointWorth(id)
  const myRep = firmReputation(state)
  // The best rival bid; ties between rivals go to the first listed, and a tie with you goes to you.
  let best: RivalBid | null = null
  for (const r of rivals) if (!best || bidScore(id, r.bid, r.reputation) > bidScore(id, best.bid, best.reputation)) best = r
  const won = !best || bidScore(id, mine, myRep) >= bidScore(id, best.bid, best.reputation)
  if (won) return { state: take(state, brief, mine), won, mine, rivals, winner: null, worth, myRep }
  const lost = [...state.lost, id]
  const board = state.board.filter((b) => b.id !== id)
  const spare = BRIEFS.filter((b) => !b.tutorial && openTo(b, myRep, isCleared(state.clearance, state.day)) && !lost.includes(b.id) && !board.some((o) => o.id === b.id))
  if (spare.length > 0) {
    const rng = new Rng(state.seed).fork(`refill-${state.round}-${lost.length}`)
    board.push(onBoard(rng.pick(spare), rng))
  }
  return { state: { ...state, board, lost }, won, mine, rivals, winner: best!.firm, worth, myRep }
}

/** Wait a week for a fresh board (when the rivals have taken every brief). */
export function waitForBriefs(state: CareerState): CareerState {
  if (state.job || state.ended) return state
  const round = state.round + 1
  const passed = passDays(state, BID.waitDays)
  const clearance = clearanceOn(state.clearance, passed.day)
  return closeIfOver({ ...passed, round, board: boardFor(state.seed, round, state.jobsDone === 0, firmReputation(state), isCleared(clearance, passed.day)), lost: [], clearance })
}

/** Spend money (a run, a model). Goes on the job's tally when there is one. */
export function charge(state: CareerState, amount: number): CareerState {
  if (state.ended) return state
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
  const paid = passDays(charge(state, price), days)
  return { ...paid, job: { ...paid.job!, daysLeft: paid.job!.daysLeft - days } }
}

/**
 * Send a broken model for repair (plan section 8): pay the repair and the
 * screens if it tore off the mount, and let the repair days pass. With no
 * job there's no clock to spend; with too few days left it can't be done.
 */
export function repairModel(state: CareerState, price: number, days: number): CareerState {
  if (state.job && days > state.job.daysLeft) return state
  const paid = charge(state, price)
  if (!paid.job) return paid
  const later = passDays(paid, days)
  return { ...later, job: { ...paid.job, daysLeft: paid.job.daysLeft - days } }
}

/** How close a declared CdA was to the road's. */
export { readOf, type Read }

/** What race day showed (plan section 4, step 8). */
export interface Debrief {
  /** Promised and achieved cut, % (achieved: both setups ridden in the day's air). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real CdA on the day, m². */
  predicted: number
  actual: number
  /** (declared − real) ÷ real. */
  readError: number
  read: Read
  /** The client's old setup on the same day, and the time your design saved, s. */
  baseline: FieldResult
  timeSaved: number
  /**
   * Why a miss happened: the design doesn't cut enough even on a typical
   * day ('design'), or it does and the day's wind took it away ('day').
   */
  cause: 'design' | 'day' | null
  /**
   * Trouble on the road (plan section 7): time the rider lost easing off in
   * gusts or sitting up late, s, and the part to change for each; null if
   * it didn't happen. It costs time, not the promise (that's on CdA).
   */
  gusts: { lost: number; fix: FixTarget } | null
  fade: { lost: number; fix: FixTarget } | null
  /** The firm's reputation before and after this job. */
  reputation: { before: number; after: number }
}

/** The fee, less a slice per point short (Kelbo: at most half, after a small allowance). */
export function penaltyFor(fee: number, promised: number, achieved: number): { shortfall: number; penalty: number } {
  const shortfall = Math.max(0, promised - PROMISE.allowance - achieved)
  const share = Math.min(PROMISE.maxShare, shortfall * PROMISE.perPoint)
  return { shortfall, penalty: Math.round((fee * share) / 100) * 100 }
}

export interface Delivery {
  state: CareerState
  /** The job that was delivered. */
  job: Job
  event: EventSpec
  result: FieldResult
  debrief: Debrief
  /** What the client paid, ₽. */
  paid: number
  /** Your tunnel's upkeep for the days up to race day, ₽ (0 before it's open). */
  upkeep: number
  /** The staff's wages for the days up to race day, ₽. */
  wages: number
  /** If the job left cash below zero: the kit sold to cover it (the firm also lost BROKE.dip reputation). */
  sale: Sale | null  /** The Tarnovian record the job broke (PR 11a), or null. */
  mark: RecordMark | null
}

/** The seed for a job's event day. */
export function daySeed(brief: Brief): number {
  return hashString(`day:${brief.seed}`)
}

/**
 * Deliver the design with a declared CdA: the calendar jumps to the event,
 * the rider races it (with whatever power the position costs them), and so
 * does their old setup in the same air, for the promise. The fee is paid,
 * less any penalty. Null if there's no job.
 */
export function deliver(state: CareerState, design: Design, predicted: number): Delivery | null {
  const job = state.job
  if (!job) return null
  const b = template(job.brief.id)
  const event = eventOf(job.brief)
  const seed = daySeed(job.brief)
  const shape = designShape(design)
  const result = fieldResult(shape, designEvent(design, event), seed)
  const baseline = fieldResult(designShape(b.setup), designEvent(b.setup, event), seed)
  const achieved = (1 - result.cdA / baseline.cdA) * 100
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  // On a typical day, would the design have kept the promise? Then the miss was the day's.
  const typical = (1 - truth(shape, event).windAveragedCdA / truth(designShape(b.setup), event).windAveragedCdA) * 100
  const readError = (predicted - result.cdA) / result.cdA
  const debrief: Debrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: result.cdA,
    readError,
    read: readOf(readError),
    baseline,
    timeSaved: baseline.time - result.time,
    cause: met ? null : typical >= job.promise - PROMISE.allowance ? 'day' : 'design',
    // A gust turns the bike by its front: the front wheel is the part to change.
    gusts: result.lostToGusts > 0 ? { lost: result.lostToGusts, fix: 'front' } : null,
    fade: result.lostToFade > 0 ? { lost: result.lostToFade, fix: (designComfort(design).worst ?? (sportOf(design) === 'skating' ? 'trunkDeg' : 'torsoDeg')) as FixTarget } : null,
    reputation: {
      before: firmReputation(state),
      after: reputationOf([...state.history, { promised: job.promise, achieved, predicted, actual: result.cdA }], state.broke),
    },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted, actual: result.cdA }, cyclingAttempt(b, result))
  return { ...closed, job, event, result, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/**
 * The record a cycling result might break (PR 11a): the hour, for an hour
 * attempt on the boards, or the time trial, for a road race long enough.
 * Skaters set no records here.
 */
function cyclingAttempt(b: BriefTemplate, result: FieldResult): Attempt | null {
  if (sportOf(b.setup) !== 'cycling' || result.time <= 0) return null
  // km/h, which is also the km an hour at that pace covers.
  const kmh = (result.distance / result.time) * 3.6
  if (b.event.hour) return { record: 'hour', value: kmh }
  if (!b.event.indoor && result.distance >= RECORD_RULES.timeTrialMin) return { record: 'timeTrial', value: kmh }
  return null
}

/** What closing a job leaves: the career on race day, and the money that moved. */
interface Closed {
  state: CareerState
  paid: number
  upkeep: number
  wages: number
  sale: Sale | null
  /** The Tarnovian record the job broke (PR 11a), or null. */
  mark: RecordMark | null
}

/** A result on the day that might break a record: which one, and the mark in its unit. */
interface Attempt {
  record: RecordId
  value: number
}

/**
 * The Tarnovian records board as the firm's history leaves it (PR 11a).
 * Defence jobs never set records.
 */
export function firmRecords(state: Pick<CareerState, 'history'>): Holding[] {
  const holderOf = (id: string) => {
    const b = briefTemplate(id)
    return b ? (b.recordHolder ?? b.client) : ''
  }
  return recordBoard(state.history.filter((j) => !j.secret).map((j) => ({ day: j.day, mark: j.mark, holder: holderOf(j.id) })))
}

/**
 * Race day for any job: the calendar jumps to it, the client pays the fee less
 * any penalty, the upkeep and wages for the days are paid, the job goes on the
 * record and a fresh board comes up. If that leaves cash below zero, the
 * soft landing sells kit and the firm takes the dip.
 */
function closeJob(state: CareerState, job: Job, penalty: number, result: Pick<JobRecord, 'achieved' | 'predicted' | 'actual'>, attempt: Attempt | null = null): Closed {
  const paid = job.brief.fee - penalty
  const jobsDone = state.jobsDone + 1
  const raceDay = state.day + job.daysLeft
  const record: JobRecord = { id: job.brief.id, day: raceDay, fee: job.brief.fee, paid, promised: job.promise, ...result }
  const defence = template(job.brief.id).defence
  if (defence) record.secret = true
  // A result that beats a Tarnovian record goes on the board (PR 11a); a secret one never does.
  const mark = attempt && !defence ? claim(firmRecords(state), attempt.record, attempt.value) : null
  if (mark) record.mark = mark
  const upkeep = upkeepFor(state, job.daysLeft)
  const wages = wagesFor(state, job.daysLeft)
  const history = [...state.history, record]
  let money = state.money + paid - upkeep - wages
  let facility = state.facility
  let broke = state.broke
  let sale: Sale | null = null
  // The soft landing: sell kit to cover a hole, and take the dip.
  if (money < 0) {
    const covered = sellToCover(money, facility)
    money = covered.money
    facility = covered.facility
    sale = covered.sale
    broke = [...broke, history.length]
  }
  // Going broke, or a run of poor reads, loses defence clearance (PR 10x).
  const clearance = reviewClearance(state.clearance, raceDay, history, broke.length > state.broke.length)
  const next: CareerState = closeIfOver({
    ...state,
    money,
    day: raceDay,
    jobsDone,
    round: state.round + 1,
    board: boardFor(state.seed, state.round + 1, false, reputationOf(history, broke), isCleared(clearance, raceDay)),
    lost: [],
    job: null,
    history,
    facility,
    broke,
    clearance,
  })
  // The reputation after (firmReputation of the new state) includes any dip for going broke.
  return { state: next, paid, upkeep, wages, sale, mark }
}

/** What the jump showed (plan section 9: distance gain at a reference speed, with a pitch-stability floor). */
export interface JumpDebrief {
  /** Promised and achieved gain on the reference jump, m. */
  promised: number
  achieved: number
  met: boolean
  /** Metres short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real reference jump, m. */
  predicted: number
  actual: number
  /** (declared − real) ÷ real. */
  readError: number
  read: Read
  /** The reference jump, yours and the old setup's: distance and what counts, m, lowest margin and whether it held the floor. */
  reference: ReferenceJump
  baselineReference: ReferenceJump
  /** The competition jump on the day, yours and the old setup's in the same air. */
  day: JumpResult
  baselineDay: JumpResult
  /**
   * Why a miss happened: the design doesn't gain enough ('design'), or it
   * does but dips under the stability floor, so the gain doesn't count ('pitch').
   */
  cause: 'design' | 'pitch' | null
  /** Trouble on the day: metres lost to a wobble or a pitch-forward, and the control to change (a bail-out past HS is no fault). */
  trouble: { kind: 'pitch' | 'wobble'; lost: number; fix: FixTarget } | null
  reputation: { before: number; after: number }
}

export interface JumpDelivery extends Closed {
  job: Job
  event: JumpEvent
  debrief: JumpDebrief
}

/**
 * Deliver a ski jumper with a declared reference distance. The promise is
 * judged on the reference jump (still air at the hill's own take-off speed),
 * the same for any day, and counts only if the margin holds the floor all the
 * way. The competition jump on the day, yours and the old setup's in the same
 * air, is the show. Null if there's no job or it isn't a ski jump.
 */
export function deliverJump(state: CareerState, design: JumperDesign, predicted: number): JumpDelivery | null {
  const job = state.job
  if (!job) return null
  const event = jumpEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'skijump') return null
  const reference = referenceJump(design, event)
  const baselineReference = referenceJump(setup, event)
  // Metres past the hill size don't count (Kelbo, 16 November 2026).
  const gain = reference.counted - baselineReference.counted
  // Under the floor the gain doesn't count; a loss always does.
  const achieved = reference.stable ? gain : Math.min(0, gain)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const seed = daySeed(job.brief)
  const day = jumpDay(design, event, seed)
  const baselineDay = jumpDay(setup, event, seed)
  // The declared length against the reference jump as it lands (at HS, if it bails out there).
  const readError = (predicted - reference.counted) / reference.counted
  // A wobble or a pitch-forward is the suit's doing first: a tighter cut steadies the jumper.
  const trouble = day.trouble === 'pitch' || day.trouble === 'wobble' ? { kind: day.trouble, lost: day.lostToPitch, fix: 'bagginess' as FixTarget } : null
  const debrief: JumpDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: reference.counted,
    readError,
    read: readOf(readError),
    reference,
    baselineReference,
    day,
    baselineDay,
    cause: met ? null : !reference.stable && gain > 0 ? 'pitch' : 'design',
    trouble,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted, actual: reference.counted }, { record: 'skiJump', value: day.distance })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What race day showed for a sled (plan section 9: time gained on the reference run). */
export interface SledDebrief {
  /** Promised and achieved gain on the reference run, points (tenths of a second). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real reference run, s. */
  predicted: number
  actual: number
  /** The drag areas the declared and real runs come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** The reference run, yours and the old sled's. */
  reference: BobRun
  baselineReference: BobRun
  /** Race day: its conditions, and both sleds down the track in them. */
  conditions: RunConditions
  day: BobRun
  baselineDay: BobRun
  /** Why a miss happened: not enough gain ('design'), or enough lost to steering late ('sight'). */
  cause: 'design' | 'sight' | null
  /** Time the driver lost steering late because they couldn't see over the cowling, s, and the slider to change. */
  blind: { lost: number; fix: FixTarget } | null
  reputation: { before: number; after: number }
}

export interface SledDelivery extends Closed {
  job: Job
  event: SledEvent
  debrief: SledDebrief
}

/**
 * Deliver a sled with a declared reference run time. The promise is judged
 * on the reference run (the usual push, good ice, still air), the same for
 * any day. Race day, your sled and the old one in the same conditions, is
 * the show. The firm's record keeps the read on drag, like every other job.
 * Null if there's no job or it isn't a bobsled race.
 */
export function deliverSled(state: CareerState, design: BobsledDesign, predicted: number): SledDelivery | null {
  const job = state.job
  if (!job) return null
  const event = sledEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'bobsled' || design.crew !== setup.crew) return null
  const track = event.track
  const reference = referenceRun(design, track)
  const baselineReference = referenceRun(setup, track)
  const achieved = (baselineReference.time - reference.time) / SLED_JOBS.pointSeconds
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const conditions = raceConditions(event, daySeed(job.brief))
  const day = runWith(dayDrag(design, track, conditions).cdA, design, track, conditions)
  const baselineDay = runWith(dayDrag(setup, track, conditions).cdA, setup, track, conditions)
  const actualCdA = dayDrag(design, track, referenceConditions(design)).cdA
  const predictedCdA = cdAForTime(predicted, design, track)
  const readError = (predictedCdA - actualCdA) / actualCdA
  // Without the late steering, would the promise have held? Then the cowling (or the tuck) cost it.
  const sighted = (baselineReference.time - (reference.time - reference.blindLoss)) / SLED_JOBS.pointSeconds
  const debrief: SledDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: reference.time,
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    reference,
    baselineReference,
    conditions,
    day,
    baselineDay,
    cause: met ? null : reference.blindLoss > 0 && penaltyFor(job.brief.fee, job.promise, sighted).shortfall === 0 ? 'sight' : 'design',
    blind: reference.blindLoss > 0 ? { lost: reference.blindLoss, fix: 'cowl' } : null,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What the fuel trial showed for a truck (plan section 9: fuel saving on the client's route, wind-averaged). */
export interface TruckDebrief {
  /** Promised and achieved saving, % of the old truck's wind-averaged fuel. */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real wind-averaged fuel figure, litres per 100 km. */
  predicted: number
  actual: number
  /** The old truck's wind-averaged figure, litres per 100 km. */
  baseline: number
  /** The straight-on drag areas the declared and real figures come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** The trial day: its air and wind, and both trucks down the route in it. */
  day: RouteDay
  run: FuelRun
  baselineRun: FuelRun
  /** Parts the road code made the depot cut back before the truck went out (none if it was legal). */
  cutBack: TruckRuleBreak[]
  /** The skirts cracked on the fleet's gravel yard and the trucks ran without them (PR 9g): their gap above the road, and the yard's limit, m. */
  cracked: { gap: number; limit: number } | null
  /**
   * Why a miss happened: not enough saving ('design'), enough until the
   * skirts cracked on the gravel yard ('gravel'), or enough until the depot
   * cut a part back ('roadCode').
   */
  cause: 'design' | 'roadCode' | 'gravel' | null
  reputation: { before: number; after: number }
}

export interface TruckDelivery extends Closed {
  job: Job
  event: TruckEvent
  debrief: TruckDebrief
}

/**
 * Deliver a truck with a declared wind-averaged fuel figure. The fleet fits
 * the parts the road code allows (anything past a limit is cut back to it),
 * skirts too low for a gravel yard crack there and come off, and the
 * promise is judged on that truck's wind-averaged saving on the
 * route, the same for any day. The trial day, your truck and the old one in
 * the same air and wind, is the show. The firm's record keeps the read on
 * drag, like every other job. Null if there's no job or it isn't a truck job.
 */
export function deliverTruck(state: CareerState, design: TruckDesign, predicted: number): TruckDelivery | null {
  const job = state.job
  if (!job) return null
  const event = truckEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'truck') return null
  const route = event.route
  const cutBack = checkTruckRules(design)
  const legal = roadLegal(design)
  // What went out of the yard: the legal truck, without its skirts if they cracked on the gravel.
  const { truck: ran, cracked } = asRun(design, event)
  const achieved = fuelSaving(ran, setup, route)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const day = trialDay(event, daySeed(job.brief))
  // The read is on the truck that ran, like the saving: the brief says which yards are gravel.
  const actual = windAveragedFuel(ran, route)
  const actualCdA = straightOnCdA(ran, route)
  const predictedCdA = dragScaleForFuel(predicted, ran, route) * actualCdA
  const readError = (predictedCdA - actualCdA) / actualCdA
  // Would it have kept the promise with its skirts on? Then the gravel cost it. Failing that, as drawn? Then the road code.
  const keeps = (truck: TruckDesign) => penaltyFor(job.brief.fee, job.promise, fuelSaving(truck, setup, route)).shortfall === 0
  const cause = met ? null : cracked && keeps(legal) ? 'gravel' : cutBack.length > 0 && keeps(design) ? 'roadCode' : 'design'
  const debrief: TruckDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual,
    baseline: windAveragedFuel(setup, route),
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    day,
    run: fuelRun(ran, route, day),
    baselineRun: fuelRun(setup, route, day),
    cutBack,
    cracked: cracked ? { gap: skirtGap(legal), limit: GRAVEL_YARD.minSkirtGap } : null,
    cause,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA }, { record: 'truckFuel', value: actual })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What race weekend showed for a car (plan section 9: lap time gained on the circuit's usual day). */
export interface CarDebrief {
  /** Promised and achieved gain on the usual day's lap, points (tenths of a second). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real lap on the usual day, s. */
  predicted: number
  actual: number
  /** The old car's lap on the usual day, s. */
  baseline: number
  /** The downforce areas the declared and real laps come from at 200 km/h, m²: the read is judged on these. */
  predictedClA: number
  actualClA: number
  /** (declared − real) ÷ real, on downforce. */
  readError: number
  read: Read
  /** Race day: its air, and both cars round the circuit in it. */
  day: { temperature: number }
  lap: Lap
  baselineLap: Lap
  /** What the scrutineers raised or trimmed before the car raced (none if it was legal). */
  cutBack: CarRuleBreak[]
  /**
   * Why a miss happened: not enough gain ('design'), or enough until the
   * scrutineers trimmed it ('rules'), or enough but for the floor
   * porpoising ('porpoise'), the balance ('balance') or the engine running
   * hot ('heat').
   */
  cause: 'design' | 'rules' | 'porpoise' | 'balance' | 'heat' | null
  /** What each trouble cost on the usual day's lap, s, with the slider to change; null where it cost nothing. */
  porpoise: { speed: number; lost: number; fix: FixTarget } | null
  balance: { balance: number; low: number; high: number; lost: number; fix: FixTarget } | null
  heat: { lost: number; fix: FixTarget } | null
  reputation: { before: number; after: number }
}

export interface CarDelivery extends Closed {
  job: Job
  event: CarEvent
  debrief: CarDebrief
}

/**
 * Deliver a car with a declared lap time. The scrutineers raise or trim
 * anything past the rulebook's limits, and the promise is judged on that
 * car's lap on the circuit's usual day, the same for any race day. Race
 * day, your car and the old one in the same air, is the show. The firm's
 * record keeps the read on downforce. Null if there's no job, it isn't a
 * car job, or the car isn't the team's class.
 */
export function deliverCar(state: CareerState, design: CarDesign, predicted: number): CarDelivery | null {
  const job = state.job
  if (!job) return null
  const event = carEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'car' || design.class !== setup.class) return null
  const circuit = event.circuit
  const cutBack = checkCarRules(design)
  const raced = scrutineered(design)
  const reference = lapTime(raced, circuit)
  const baseline = lapTime(setup, circuit).time
  const gainOf = (time: number) => (baseline - time) / CAR_JOBS.pointSeconds
  const achieved = gainOf(reference.time)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const day = raceDayAir(event, daySeed(job.brief))
  // The read is on the car that raced, at the speed the sheet reads it.
  const actualClA = carAero(raced, CAR_DESK.readSpeed, circuitDensity(circuit)).clA
  const predictedClA = downScaleForLap(predicted, raced, circuit) * actualClA
  const readError = (predictedClA - actualClA) / actualClA
  const troubles = lapTroubles(raced, circuit, reference)
  const keeps = (time: number) => penaltyFor(job.brief.fee, job.promise, gainOf(time)).shortfall === 0
  // Would the car as drawn have kept it? Then the scrutineers cost it. Failing that, without one trouble?
  const cause = met
    ? null
    : cutBack.length > 0 && keeps(lapTime(design, circuit).time)
      ? 'rules'
      : troubles.porpoise > 0 && keeps(reference.time - troubles.porpoise)
        ? 'porpoise'
        : troubles.balance > 0 && keeps(reference.time - troubles.balance)
          ? 'balance'
          : troubles.heat > 0 && keeps(reference.time - troubles.heat)
            ? 'heat'
            : 'design'
  const bal = worstBalance(raced, reference)
  const debrief: CarDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: reference.time,
    baseline,
    predictedClA,
    actualClA,
    readError,
    read: readOf(readError),
    day,
    lap: lapTime(raced, circuit, day.temperature),
    baselineLap: lapTime(setup, circuit, day.temperature),
    cutBack,
    cause,
    // Ride height first: a car that sits higher keeps its floor working.
    porpoise: reference.porpoise !== null && troubles.porpoise > 0 ? { speed: reference.porpoise, lost: troubles.porpoise, fix: 'rideHeight' } : null,
    // The front wing moves the balance most directly, either way.
    balance: bal && troubles.balance > 0 ? { ...bal, lost: troubles.balance, fix: 'frontWing' } : null,
    heat: troubles.heat > 0 ? { lost: troubles.heat, fix: 'inlet' } : null,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedClA, actual: actualClA })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What speed week showed for a record car (plan section 9: km/h gained on the two-way mean on the still day). */
export interface RecordDebrief {
  /** Promised and achieved gain on the still day's two-way mean, points (2 km/h each). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real two-way mean on the still day, m/s (real: null if the chutes came out). */
  predicted: number
  actual: number | null
  /** The old car's two-way mean on the still day, m/s. */
  baseline: number
  /** The drag areas the declared and real speeds come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** The still day's attempt the promise is judged on. */
  still: RecordAttempt
  /** Record day: its air, and both cars' attempts in it. */
  day: RecordDay
  attempt: RecordAttempt
  baselineAttempt: RecordAttempt
  /**
   * Why a miss happened: not enough speed ('design'), the nose going light
   * ('lift') or the car wandering ('wander') so the chutes came out, or
   * enough but for the power the driver gave up behind a low canopy
   * ('sight'), or a jet car held back by the air squeezing round it near
   * the speed of sound ('squeeze', PR 9z).
   */
  cause: 'design' | 'lift' | 'wander' | 'sight' | 'squeeze' | null
  /** Where the chutes came out on the still day, km/h, with the slider to change; null if they didn't. */
  abort: { cause: 'lift' | 'wander'; speed: number; fix: FixTarget } | null
  /** The share of power given up behind a low canopy and the km/h it cost, with the slider; null if none. */
  sight: { share: number; lost: number; fix: FixTarget } | null
  /**
   * How hard the air squeezed round the car at its fastest on the still day
   * (the drag rise the tunnel can't see): its Mach number there and the
   * extra drag, a share (0.5: half as much again), with the slider to
   * change. Null if the air hardly squeezed, or the chutes came out.
   */
  squeeze: { mach: number; extra: number; fix: FixTarget } | null
  /** The still day's two-way mean as a Mach number (over 1: through the sound barrier both ways); null if the chutes came out. */
  meanMach: number | null
  reputation: { before: number; after: number }
}

export interface RecordDelivery extends Closed {
  job: Job
  event: RecordEvent
  debrief: RecordDebrief
}

/**
 * Deliver a record car with a declared two-way mean, m/s. The promise is
 * judged on the still day's attempt, the same for any record day; a car
 * that pulls its chutes there gains nothing. Record day, your car and the
 * old one in the same air, is the show. The firm's record keeps the read
 * on drag. Null if there's no job, it isn't a record job, or the car isn't
 * the team's class.
 */
export function deliverRecord(state: CareerState, design: RecordDesign, predicted: number): RecordDelivery | null {
  const job = state.job
  if (!job) return null
  const event = recordEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'record' || design.class !== setup.class) return null
  const flat = event.flat
  const still = stillAttempt(design, flat)
  const baseline = stillAttempt(setup, flat).mean ?? 0
  const gainOf = (mean: number | null) => (mean === null ? 0 : ((mean - baseline) * 3.6) / RECORD_JOBS.pointKmh)
  const achieved = gainOf(still.mean)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const dayAir = recordDayAir(flat, daySeed(job.brief))
  // The read is on drag: the speed the car's drag is worth, had the driver kept going.
  const actualCdA = recordAero(design).cdA
  const predictedCdA = dragScaleForSpeed(predicted, design, flat) * actualCdA
  const readError = (predictedCdA - actualCdA) / actualCdA
  const first = still.runs[0].abort ?? still.runs[1].abort
  const sight = sightCost(design, flat)
  const keeps = (mean: number | null) => penaltyFor(job.brief.fee, job.promise, gainOf(mean)).shortfall === 0
  // The air squeezing near the speed of sound, read off the out run (the still day's two runs are alike).
  const top = still.runs[0]
  const squeeze = !first && top.rise >= RECORD_TUNNEL.squeezeWarn ? { mach: top.topMach, extra: top.rise - 1, fix: 'waist' as const } : null
  const cause = met ? null : first ? first.cause : sight && keeps(sight.mean) ? 'sight' : squeeze ? 'squeeze' : 'design'
  const debrief: RecordDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: still.mean,
    baseline,
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    still,
    day: dayAir,
    attempt: twoWay(design, flat, dayAir),
    baselineAttempt: twoWay(setup, flat, dayAir),
    cause,
    // A light nose wants more droop; a wandering car more fin.
    abort: first ? { cause: first.cause, speed: first.speed * 3.6, fix: first.cause === 'lift' ? 'noseDroop' : 'fin' } : null,
    squeeze,
    meanMach: still.mean === null ? null : still.mean / soundSpeed(flat.temperature),
    sight: sight && sightLoss(design) > 0 ? { share: sight.share, lost: sight.mean !== null && still.mean !== null ? (sight.mean - still.mean) * 3.6 : 0, fix: 'canopy' } : null,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA }, debrief.attempt.mean === null ? null : { record: 'landSpeed', value: debrief.attempt.mean * 3.6 })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What the club race showed for a racing quad (plan section 9: race time gained on the course's usual day). */
export interface DroneDebrief {
  /** Promised and achieved gain on the usual day's race, points (tenths of a second). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared race time, s, and the real one on the usual day (null if it tumbled). */
  predicted: number
  actual: number | null
  /** The pilot's old quad's race on the usual day, s. */
  baseline: number
  /** The drag areas flat out the declared and real times come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** Race day: its air, and both quads round the gates in it. */
  day: { temperature: number }
  race: DroneRace
  baselineRace: DroneRace
  /**
   * Why a miss happened: not enough gain ('design'), a tumble that crashed
   * it out ('tumble'), or enough but for the speed controllers overheating
   * ('heat').
   */
  cause: 'design' | 'tumble' | 'heat' | null
  /** Where it tumbled on the usual day: how fast, km/h, and braking or flying, with the slider to change; null if it held. */
  tumble: { speed: number; braking: boolean; fix: FixTarget } | null
  /** What the overheating cost on the usual day's race, s, and when it started; null if it never did. */
  heat: { at: number; lost: number; fix: FixTarget } | null
  reputation: { before: number; after: number }
}

export interface DroneDelivery extends Closed {
  job: Job
  event: DroneEvent
  debrief: DroneDebrief
}

/**
 * Deliver a racing quad with a declared race time, s. The promise is
 * judged on the race on the course's usual day, the same for any race day;
 * a quad that tumbles crashes out and gains nothing. Race day, your quad and
 * the old one in the same air, is the show. The firm's record keeps the
 * read on drag. Null if there's no job, it isn't a quad job, or the quad
 * isn't the pilot's class.
 */
export function deliverDrone(state: CareerState, design: DroneDesign, predicted: number): DroneDelivery | null {
  const job = state.job
  if (!job) return null
  const event = droneEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'drone' || design.class !== setup.class) return null
  const course = event.course
  const reference = droneRace(design, course)
  const baseline = droneRace(setup, course).time ?? 0
  const gainOf = (time: number | null) => (time === null ? 0 : (baseline - time) / DRONE_JOBS.pointSeconds)
  const achieved = gainOf(reference.time)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const day = droneDayAir(event, daySeed(job.brief))
  // The read is on drag: the drag flat out the declared time is worth, had the motors held any twist.
  const actualCdA = raceDragArea(design, course)
  const predictedCdA = dragScaleForTime(predicted, design, course) * actualCdA
  const readError = (predictedCdA - actualCdA) / actualCdA
  const lost = heatCost(design, course, reference)
  const keeps = (time: number | null) => penaltyFor(job.brief.fee, job.promise, gainOf(time)).shortfall === 0
  const cause = met ? null : reference.tumble ? 'tumble' : lost > 0 && reference.time !== null && keeps(reference.time - lost) ? 'heat' : 'design'
  const debrief: DroneDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: reference.time,
    baseline,
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    day,
    race: droneRace(design, course, day.temperature),
    baselineRace: droneRace(setup, course, day.temperature),
    cause,
    // Either way the pod's rake sets the angle the air meets it at; its length how hard that twists.
    tumble: reference.tumble ? { speed: reference.tumble.speed * 3.6, braking: reference.twist.braking, fix: 'podRake' } : null,
    heat: reference.hotAt !== null && lost > 0 ? { at: reference.hotAt, lost, fix: 'podVents' } : null,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What survey day showed for a survey drone (plan section 9: range on a charge on the site's usual day). */
export interface PlaneDebrief {
  /** Promised and achieved gain in range on the usual day, points (kilometres). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared range, km, and the real one on the usual day (null if the usual gust stalls it on a turn). */
  predicted: number
  actual: number | null
  /** The client's plane's range on paper on the usual day, km. */
  baseline: number
  /** The drag areas at survey speed the declared and real ranges come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** Survey day: its air and gust, and both planes' flights in it. */
  day: SurveyDay
  flight: SurveyFlight
  baselineFlight: SurveyFlight
  /** Why a miss happened: not enough range ('design'), or a stall in the usual gust on a turn ('stall'). */
  cause: 'design' | 'stall' | null
  /** The usual gust that stalls it and the strongest it rides out, km/h, with the slider to change; null if it rides the usual gust out. */
  stall: { gust: number; limit: number; fix: FixTarget } | null
  /** The camera sat higher than the client's rule, so they lowered it before flying (the range counts it lowered); null if it was within the rule. */
  camera: { fix: FixTarget } | null
  reputation: { before: number; after: number }
}

export interface PlaneDelivery extends Closed {
  job: Job
  event: PlaneEvent
  debrief: PlaneDebrief
}

/**
 * Deliver a survey drone with a declared range, km. The promise is judged
 * on the site's usual day, over the client's plane on paper; a plane the
 * usual gust stalls on a turn gains nothing. Survey day, both planes in the
 * same air and gust, is the show. The firm's record keeps the read on drag.
 * Null if there's no job, it isn't a survey job, or the plane isn't the
 * client's class.
 */
export function deliverPlane(state: CareerState, design: PlaneDesign, predicted: number): PlaneDelivery | null {
  const job = state.job
  if (!job) return null
  const event = planeEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'plane' || design.class !== setup.class) return null
  const site = event.site
  const usual = surveyFlight(design, site, usualDay(site, setup.class))
  const actual = usual.stall ? null : usual.range
  // Their plane on paper: the range it would fly, stall or not (Vekha's spins in, and that's why they called).
  const baseline = surveyFlight(setup, site, usualDay(site, setup.class)).range
  const gainOf = (range: number | null) => (range === null ? 0 : (range - baseline) / PLANE_JOBS.pointKm)
  const achieved = gainOf(actual)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const day = surveyDay(event, daySeed(job.brief), setup.class)
  // The read is on drag: the drag at survey speed the declared range is worth.
  const actualCdA = surveyDragArea(design, site)
  const predictedCdA = dragScaleForRange(predicted, design, site) * actualCdA
  const readError = (predictedCdA - actualCdA) / actualCdA
  const debrief: PlaneDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual,
    baseline,
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    day,
    flight: surveyFlight(design, site, day),
    baselineFlight: surveyFlight(setup, site, day),
    cause: met ? null : usual.stall ? 'stall' : 'design',
    stall: usual.stall ? { gust: site.gust * 3.6, limit: usual.limit * 3.6, fix: looseFix(design) } : null,
    camera: cameraTooHigh(design) ? { fix: 'cameraDrop' } : null,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What test day showed for a light aircraft (plan section 9: cruise speed on the airfield's usual day). */
export interface AircraftDebrief {
  /** Promised and achieved gain in cruise speed on the usual day, points (km/h). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared cruise, km/h, and the real one on the usual day (null if the inspector won't sign the mod off). */
  predicted: number
  actual: number | null
  /** The client's plane's cruise on paper on the usual day, km/h. */
  baseline: number
  /** The drag areas at cruise the declared and real speeds come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** Test day: its air, and both planes' flights in it. */
  day: TestDay
  flight: TestFlight
  baselineFlight: TestFlight
  /** Why a miss happened: not enough speed ('design'), or a stall speed past the certified figure ('stall'). */
  cause: 'design' | 'stall' | null
  /** The stall speed and the certified limit, km/h, with the slider to change; null if the inspector signs it off. */
  stall: { stall: number; limit: number; fix: FixTarget } | null
  reputation: { before: number; after: number }
}

export interface AircraftDelivery extends Closed {
  job: Job
  event: AircraftEvent
  debrief: AircraftDebrief
}

/**
 * Deliver a light aircraft with a declared cruise speed, km/h. The promise
 * is judged on the airfield's usual day, over the client's plane on paper;
 * a mod the inspector won't sign off (its stall speed past the certified
 * figure) gains nothing. Test day, both planes in the same air, is the
 * show. The firm's record keeps the read on drag. Null if there's no job,
 * it isn't a light-aircraft job, or the plane isn't the client's class.
 */
export function deliverAircraft(state: CareerState, design: AircraftDesign, predicted: number): AircraftDelivery | null {
  const job = state.job
  if (!job) return null
  const event = aircraftEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'aircraft' || design.class !== setup.class) return null
  const field = event.field
  const usual = testFlight(design, field, usualTestDay(field))
  const actual = usual.passes ? usual.cruise : null
  // Their plane on paper: the speed it would cruise, signed off or not (Ozerov's isn't, and that's why he called).
  const baseline = testFlight(setup, field, usualTestDay(field)).cruise
  const gainOf = (cruise: number | null) => (cruise === null ? 0 : (cruise - baseline) / AIRCRAFT_JOBS.pointKmh)
  const achieved = gainOf(actual)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const day = testDay(event, daySeed(job.brief))
  // The read is on drag: the drag at cruise the declared speed is worth.
  const actualCdA = cruiseDragArea(design, field)
  const predictedCdA = dragScaleForCruise(predicted, design, field) * actualCdA
  const readError = (predictedCdA - actualCdA) / actualCdA
  const debrief: AircraftDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual,
    baseline,
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    day,
    flight: testFlight(design, field, day),
    baselineFlight: testFlight(setup, field, day),
    cause: met ? null : usual.passes ? 'design' : 'stall',
    stall: usual.passes ? null : { stall: usual.stall, limit: usual.limit, fix: stallFix(design) },
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}

/** What range day showed for a sensor pod (plan section 9: hours on station over the range on its usual day). */
export interface PodDebrief {
  /** Promised and achieved gain in hours on station on the usual day, points (minutes). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared hours on station, and the real ones on the usual day (null if the ministry rejects the run). */
  predicted: number
  actual: number | null
  /** The ministry's pod as it hangs now: its hours on station on the usual day. */
  baseline: number
  /** The plane's drag areas with the pod the declared and real hours come from, m²: the read is judged on these. */
  predictedCdA: number
  actualCdA: number
  /** (declared − real) ÷ real, on drag. */
  readError: number
  read: Read
  /** Range day: its air, and both pods' patrols in it. */
  day: RangeDay
  flight: PodFlight
  baselineFlight: PodFlight
  /** Why a miss happened: not enough hours ('design'), or a picture blurred by the buffet ('buffet'). */
  cause: 'design' | 'buffet' | null
  /** The buffet index and the ministry's limit, with the slider to change; null if the picture holds. */
  buffet: { index: number; limit: number; fix: Extract<FixTarget, 'senTail' | 'senGap'> } | null
  /** A defence job never moves the public reputation: these stay the same. */
  reputation: { before: number; after: number }
}

export interface PodDelivery extends Closed {
  job: Job
  event: PodEvent
  debrief: PodDebrief
}

/**
 * Deliver a sensor pod with declared hours on station. The promise is
 * judged on the range's usual day, over the ministry's pod as it hangs
 * now; a pod whose buffet blurs the sensor's picture has its run rejected
 * and gains nothing. Range day, both pods in the same air, is the show.
 * The firm's record keeps the read on drag, as a secret job. Null if
 * there's no job, it isn't a sensor-pod job, or the pod isn't for the
 * ministry's plane.
 */
export function deliverPod(state: CareerState, design: PodDesign, predicted: number): PodDelivery | null {
  const job = state.job
  if (!job) return null
  const event = podEventOf(job.brief)
  const setup = template(job.brief.id).setup
  if (!event || setup.sport !== 'pod' || design.class !== setup.class) return null
  const range = event.range
  const usual = podFlight(design, range, usualRangeDay(range))
  const actual = usual.blurs ? null : usual.hours
  // Their pod on paper: the hours it would stay out, steady picture or not (theirs may blur, and that's why they called).
  const baseline = podFlight(setup, range, usualRangeDay(range)).hours
  const gainOf = (hours: number | null) => (hours === null ? 0 : (hours - baseline) / POD_JOBS.pointHours)
  const achieved = gainOf(actual)
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  const day = rangeDay(event, daySeed(job.brief))
  // The read is on drag: the plane's drag area with the pod drag the declared hours are worth.
  const actualCdA = planeDragArea(design)
  const predictedCdA = planeDragArea(design, dragScaleForHours(predicted, design, range))
  const readError = (predictedCdA - actualCdA) / actualCdA
  const debrief: PodDebrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual,
    baseline,
    predictedCdA,
    actualCdA,
    readError,
    read: readOf(readError),
    day,
    flight: podFlight(design, range, day),
    baselineFlight: podFlight(setup, range, day),
    cause: met ? null : usual.blurs ? 'buffet' : 'design',
    buffet: usual.blurs ? { index: usual.buffet, limit: usual.limit, fix: usual.cause === 'gap' ? 'senGap' : 'senTail' } : null,
    reputation: { before: firmReputation(state), after: 0 },
  }
  const closed = closeJob(state, job, penalty, { achieved, predicted: predictedCdA, actual: actualCdA })
  return { ...closed, job, event, debrief: { ...debrief, reputation: { ...debrief.reputation, after: firmReputation(closed.state) } } }
}
