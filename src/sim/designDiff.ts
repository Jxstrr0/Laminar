/**
 * Which controls differ between two designs, so the run report can say what
 * changed between run A and run B. The ids match the Shape screen's
 * controls (and their `ctl.*` labels).
 */
import type { Design } from './design'
import { isBobsled, isCyclist, isJumper, isSkater } from './design'
import type { CyclistDesign } from '../data/cyclist'
import type { SkaterDesign } from '../data/skater'
import type { JumperDesign } from '../data/jumper'
import type { BobsledDesign } from '../data/bobsled'

export type ControlId =
  | 'torsoDeg' | 'headDrop' | 'armWidth' | 'handReach' | 'handHeight'
  | 'helmet' | 'tail' | 'vents' | 'fabric' | 'armTrips'
  | 'bars' | 'front' | 'rear' | 'frame'
  | 'trunkDeg' | 'kneeDeg' | 'arms' | 'hood' | 'legTrips'
  | 'leanDeg' | 'vAngleDeg' | 'bagginess'
  | 'sledNose' | 'sledTail' | 'cowl' | 'tuck'

const bike = (f: (d: CyclistDesign) => unknown) => (d: Design) => (isCyclist(d) ? f(d) : undefined)
const skate = (f: (d: SkaterDesign) => unknown) => (d: Design) => (isSkater(d) ? f(d) : undefined)
const jump = (f: (d: JumperDesign) => unknown) => (d: Design) => (isJumper(d) ? f(d) : undefined)
const sled = (f: (d: BobsledDesign) => unknown) => (d: Design) => (isBobsled(d) ? f(d) : undefined)

/** Each control's value on a design (undefined for another sport's control). */
const READ: Record<ControlId, (d: Design) => unknown> = {
  torsoDeg: bike((d) => d.posture.torsoDeg),
  headDrop: (d) => (isJumper(d) || isBobsled(d) ? undefined : d.posture.headDrop),
  armWidth: bike((d) => d.posture.armWidth),
  handReach: bike((d) => d.posture.handReach),
  handHeight: bike((d) => d.posture.handHeight),
  helmet: bike((d) => d.helmet.kind),
  tail: bike((d) => d.helmet.tail),
  vents: bike((d) => d.helmet.vents),
  fabric: (d) => (isJumper(d) || isBobsled(d) ? undefined : d.suit.fabric),
  armTrips: bike((d) => d.suit.armTrips),
  bars: bike((d) => d.bars),
  front: bike((d) => d.wheels.front),
  rear: bike((d) => d.wheels.rear),
  frame: bike((d) => d.frame),
  trunkDeg: skate((d) => d.posture.trunkDeg),
  kneeDeg: skate((d) => d.posture.kneeDeg),
  arms: skate((d) => d.arms),
  hood: skate((d) => d.hood),
  legTrips: skate((d) => d.suit.legTrips),
  leanDeg: jump((d) => d.posture.leanDeg),
  vAngleDeg: jump((d) => d.posture.vAngleDeg),
  bagginess: jump((d) => d.suit.bagginess),
  sledNose: sled((d) => d.sled.nose),
  sledTail: sled((d) => d.sled.tail),
  cowl: sled((d) => d.sled.cowl),
  tuck: sled((d) => d.tuck),
}

/** The controls set differently in `b` than in `a`, in Shape-screen order. */
export function changedControls(a: Design, b: Design): ControlId[] {
  return (Object.keys(READ) as ControlId[]).filter((id) => READ[id](a) !== READ[id](b))
}
