/**
 * Which controls differ between two designs, so the run report can say what
 * changed between run A and run B. The ids match the Shape screen's
 * controls (and their `ctl.*` labels).
 */
import type { Design } from './design'
import { isCyclist, isSkater } from './design'
import type { CyclistDesign } from '../data/cyclist'
import type { SkaterDesign } from '../data/skater'

export type ControlId =
  | 'torsoDeg' | 'headDrop' | 'armWidth' | 'handReach' | 'handHeight'
  | 'helmet' | 'tail' | 'vents' | 'fabric' | 'armTrips'
  | 'bars' | 'front' | 'rear' | 'frame'
  | 'trunkDeg' | 'kneeDeg' | 'arms' | 'hood' | 'legTrips'

const bike = (f: (d: CyclistDesign) => unknown) => (d: Design) => (isCyclist(d) ? f(d) : undefined)
const skate = (f: (d: SkaterDesign) => unknown) => (d: Design) => (isSkater(d) ? f(d) : undefined)

/** Each control's value on a design (undefined for another sport's control). */
const READ: Record<ControlId, (d: Design) => unknown> = {
  torsoDeg: bike((d) => d.posture.torsoDeg),
  headDrop: (d) => d.posture.headDrop,
  armWidth: bike((d) => d.posture.armWidth),
  handReach: bike((d) => d.posture.handReach),
  handHeight: bike((d) => d.posture.handHeight),
  helmet: bike((d) => d.helmet.kind),
  tail: bike((d) => d.helmet.tail),
  vents: bike((d) => d.helmet.vents),
  fabric: (d) => d.suit.fabric,
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
}

/** The controls set differently in `b` than in `a`, in Shape-screen order. */
export function changedControls(a: Design, b: Design): ControlId[] {
  return (Object.keys(READ) as ControlId[]).filter((id) => READ[id](a) !== READ[id](b))
}
