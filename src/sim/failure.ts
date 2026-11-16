/**
 * Tunnel failures (plan section 8). Each frame the tunnel asks how close
 * every weak point of the model on the mount is to its limit; a part past
 * its limit for long enough breaks. Below the limit, inside the warning
 * band, it only buzzes: the tunnel always warns first (Kelbo, 16 November
 * 2026). Pure and deterministic: the same model, speeds and steps always
 * break at the same moment.
 */
import type { CyclistDesign } from '../data/cyclist'
import { isAircraft, isCar, isCyclist, isDrone, isJumper, isPlane, isRecord, isTruck, type Design } from './design'
import type { JumperDesign } from '../data/jumper'
import type { SkaterDesign } from '../data/skater'
import { FAILURE } from '../data/failure'
import { MAKERS, MODEL_SHOP } from '../data/model'
import { makerOf, quote, type MakerHand, type ModelOrder, type Quote } from './modelShop'

export type FailureMode = 'flutter' | 'mount' | 'detach'
/** The part that gives: the helmet tail, a disc wheel's cover, the mount's posts, a jumper's sting or a glued-on helmet. */
export type FailurePart = 'tail' | 'disc' | 'posts' | 'sting' | 'helmet'

export interface Failure {
  mode: FailureMode
  part: FailurePart
}

export interface Strain extends Failure {
  /** Load over limit: 1 is at the limit, past `FAILURE.warnAt` it warns. */
  level: number
}

/** The model on the mount, as the failure checks need it. */
export interface MountedModel {
  order: ModelOrder
  design: Design
}

const key = (f: Failure) => `${f.mode}:${f.part}`

/** The air speed a thin part flutters at on this model, m/s, or null if it has none. */
export function flutterSpeed(model: MountedModel, part: 'tail' | 'disc'): number | null {
  const f = FAILURE.flutter
  const scaled = (v: number) => v * f.scale[model.order.scale] * f.finish[model.order.finish] * MAKERS[makerOf(model.order)].stiffness
  const d = model.design
  if (!isCyclist(d)) return null
  if (part === 'tail') {
    const h = d.helmet
    if (h.kind !== 'aero' || h.tail < f.tail.minTail) return null
    return scaled(f.tail.base - f.tail.perTail * h.tail)
  }
  const w = d.wheels
  return w.front === 'disc' || w.rear === 'disc' ? scaled(f.disc) : null
}

/**
 * How close each weak point is to its limit at this air speed and total
 * load on the mount (N): drag and side force on a rider's posts, lift and
 * drag on a jumper's sting. A tunnel tech who's good with mounts makes the
 * mount hold more (`mountStrength`). Only rider models have weak points; the
 * sphere and the wheel are the tunnel's own.
 */
export function strains(model: MountedModel, speed: number, loadN: number, mountStrength = 1): Strain[] {
  const out: Strain[] = []
  for (const part of ['tail', 'disc'] as const) {
    const v = flutterSpeed(model, part)
    if (v !== null) out.push({ mode: 'flutter', part, level: speed / v })
  }
  if (isJumper(model.design)) out.push({ mode: 'mount', part: 'sting', level: loadN / (FAILURE.stingN * mountStrength) })
  else if (isAircraft(model.design)) out.push({ mode: 'mount', part: 'sting', level: loadN / (FAILURE.aircraftStingN * mountStrength) })
  else if (isPlane(model.design)) out.push({ mode: 'mount', part: 'sting', level: loadN / (FAILURE.planeStingN * mountStrength) })
  else if (isDrone(model.design)) out.push({ mode: 'mount', part: 'sting', level: loadN / (FAILURE.droneStingN * mountStrength) })
  else if (isTruck(model.design)) out.push({ mode: 'mount', part: 'posts', level: loadN / (FAILURE.truckMountN * mountStrength) })
  else if (isCar(model.design)) out.push({ mode: 'mount', part: 'posts', level: loadN / (FAILURE.carMountN * mountStrength) })
  else if (isRecord(model.design)) out.push({ mode: 'mount', part: 'posts', level: loadN / (FAILURE.recordMountN * mountStrength) })
  else out.push({ mode: 'mount', part: 'posts', level: loadN / (FAILURE.mountN * mountStrength) })
  if (model.order.finish === 'printed' && isCyclist(model.design)) out.push({ mode: 'detach', part: 'helmet', level: speed / FAILURE.detachSpeed })
  return out
}

/** Seconds each weak point has spent past its limit (it drains when you back off). */
export type StrainClock = Record<string, number>

export interface StrainStep {
  clock: StrainClock
  /** The worst part in its warning band or past its limit, or null if all is calm. */
  warn: Strain | null
  /** The part that just broke, or null. */
  broke: Failure | null
}

/** Advance the clock one fixed step. */
export function stepStrain(clock: StrainClock, now: readonly Strain[], dt: number): StrainStep {
  const next: StrainClock = {}
  let warn: Strain | null = null
  let broke: Failure | null = null
  for (const s of now) {
    const k = key(s)
    const was = clock[k] ?? 0
    const t = s.level >= 1 ? was + dt : Math.max(0, was - dt * FAILURE.recover)
    if (t > 0) next[k] = t
    if (s.level >= FAILURE.warnAt && (!warn || s.level > warn.level)) warn = s
    // A hair of slack so fixed steps that add up to the hold time count, despite rounding.
    if (!broke && t >= FAILURE.holdSeconds[s.mode] - 1e-9) broke = { mode: s.mode, part: s.part }
  }
  return { clock: broke ? {} : next, warn, broke }
}

/** Extra balance scatter while a part buzzes: none below the warning band, `FAILURE.wobble` at the limit. */
export function wobbleOf(warn: Strain | null): number {
  if (!warn) return 0
  const into = (warn.level - FAILURE.warnAt) / (1 - FAILURE.warnAt)
  return FAILURE.wobble * Math.min(1, Math.max(0, into))
}

/** What putting a broken model right costs: half its price and days, plus the screens if it tore off the mount. */
export function repairQuote(order: ModelOrder, failure: Failure, hand?: MakerHand): Quote & { screens: number } {
  const q = quote(order, hand)
  const share = FAILURE.repair.share
  return {
    price: Math.round((q.price * share) / MODEL_SHOP.round) * MODEL_SHOP.round,
    days: Math.max(1, Math.ceil(q.days * share)),
    screens: failure.mode === 'mount' ? FAILURE.repair.screens : 0,
  }
}

/**
 * A part on the Shape screen a "change this" jump can go to: the helmet's
 * tail, the rear or front wheel, or one of the position's sliders.
 */
/** A slider or part the "change this" jump goes to. A sled's: its cowling or the crew's tuck. */
export type FixTarget = 'helmet' | 'wheels' | 'front' | 'bagginess' | 'cowl' | 'tuck' | 'skirts' | 'boatTail' | 'rideHeight' | 'inlet' | 'frontWing' | 'rearWing' | 'noseDroop' | 'fin' | 'canopy' | 'podRake' | 'podVents' | 'podLength' | 'armFairings' | 'tailSize' | 'planeNose' | 'cameraDrop' | 'cameraAt' | 'winglets' | 'wingtips' | 'acPodAt' | 'strutToe' | 'acCowling' | 'spats' | 'senTail' | 'senGap' | 'waist' | keyof CyclistDesign['posture'] | keyof SkaterDesign['posture'] | keyof JumperDesign['posture']

/** Where the "change this" jump goes: the part on Shape, or the model shop for a stiffer, smaller or sanded model. */
export function fixFor(failure: Failure): 'helmet' | 'wheels' | 'shop' {
  if (failure.part === 'tail') return 'helmet'
  if (failure.part === 'disc') return 'wheels'
  return 'shop'
}
