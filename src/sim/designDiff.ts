/**
 * Which controls differ between two designs, so the run report can say what
 * changed between run A and run B. The ids match the Shape screen's
 * controls (and their `ctl.*` labels).
 */
import type { CyclistDesign } from '../data/cyclist'

export type ControlId =
  | 'torsoDeg' | 'headDrop' | 'armWidth' | 'handReach' | 'handHeight'
  | 'helmet' | 'tail' | 'vents' | 'fabric' | 'armTrips'
  | 'bars' | 'front' | 'rear' | 'frame'

const READ: Record<ControlId, (d: CyclistDesign) => unknown> = {
  torsoDeg: (d) => d.posture.torsoDeg,
  headDrop: (d) => d.posture.headDrop,
  armWidth: (d) => d.posture.armWidth,
  handReach: (d) => d.posture.handReach,
  handHeight: (d) => d.posture.handHeight,
  helmet: (d) => d.helmet.kind,
  tail: (d) => d.helmet.tail,
  vents: (d) => d.helmet.vents,
  fabric: (d) => d.suit.fabric,
  armTrips: (d) => d.suit.armTrips,
  bars: (d) => d.bars,
  front: (d) => d.wheels.front,
  rear: (d) => d.wheels.rear,
  frame: (d) => d.frame,
}

/** The controls set differently in `b` than in `a`, in Shape-screen order. */
export function changedControls(a: CyclistDesign, b: CyclistDesign): ControlId[] {
  return (Object.keys(READ) as ControlId[]).filter((id) => READ[id](a) !== READ[id](b))
}
