/**
 * Which controls differ between two designs, so the run report can say what
 * changed between run A and run B. The ids match the Shape screen's
 * controls (and their `ctl.*` labels).
 */
import type { Design } from './design'
import { isBobsled, isCar, isCyclist, isDrone, isJumper, isPlane, isRecord, isSkater, isTruck } from './design'
import type { CyclistDesign } from '../data/cyclist'
import type { SkaterDesign } from '../data/skater'
import type { JumperDesign } from '../data/jumper'
import type { BobsledDesign } from '../data/bobsled'
import type { TruckDesign } from '../data/truck'
import type { CarDesign } from '../data/car'
import type { RecordDesign } from '../data/record'
import type { DroneDesign } from '../data/drone'
import type { PlaneDesign } from '../data/plane'

export type ControlId =
  | 'torsoDeg' | 'headDrop' | 'armWidth' | 'handReach' | 'handHeight'
  | 'helmet' | 'tail' | 'vents' | 'fabric' | 'armTrips'
  | 'bars' | 'front' | 'rear' | 'frame'
  | 'trunkDeg' | 'kneeDeg' | 'arms' | 'hood' | 'legTrips'
  | 'leanDeg' | 'vAngleDeg' | 'bagginess'
  | 'sledNose' | 'sledTail' | 'cowl' | 'tuck'
  | 'cabNose' | 'fairing' | 'extenders' | 'gapLength' | 'gapFill' | 'skirts' | 'boatTail' | 'tailAngle'
  | 'rideFront' | 'rideRear' | 'frontWing' | 'rearAngle' | 'rearChord' | 'diffuser' | 'floorEdge' | 'inlet'
  | 'noseLength' | 'noseDroop' | 'canopy' | 'fin' | 'fairings' | 'waist'
  | 'podLength' | 'podRake' | 'podVents' | 'armFairings'
  | 'planeNose' | 'tailCone' | 'tailSize' | 'cameraDrop' | 'cameraFairing' | 'cameraAt' | 'winglets'

const bike = (f: (d: CyclistDesign) => unknown) => (d: Design) => (isCyclist(d) ? f(d) : undefined)
const skate = (f: (d: SkaterDesign) => unknown) => (d: Design) => (isSkater(d) ? f(d) : undefined)
const jump = (f: (d: JumperDesign) => unknown) => (d: Design) => (isJumper(d) ? f(d) : undefined)
const sled = (f: (d: BobsledDesign) => unknown) => (d: Design) => (isBobsled(d) ? f(d) : undefined)
const truck = (f: (d: TruckDesign) => unknown) => (d: Design) => (isTruck(d) ? f(d) : undefined)
const car = (f: (d: CarDesign) => unknown) => (d: Design) => (isCar(d) ? f(d) : undefined)
const rec = (f: (d: RecordDesign) => unknown) => (d: Design) => (isRecord(d) ? f(d) : undefined)
const quad = (f: (d: DroneDesign) => unknown) => (d: Design) => (isDrone(d) ? f(d) : undefined)
const plane = (f: (d: PlaneDesign) => unknown) => (d: Design) => (isPlane(d) ? f(d) : undefined)

/** Each control's value on a design (undefined for another sport's control). */
const READ: Record<ControlId, (d: Design) => unknown> = {
  torsoDeg: bike((d) => d.posture.torsoDeg),
  headDrop: (d) => (isJumper(d) || isBobsled(d) || isTruck(d) || isCar(d) || isRecord(d) || isDrone(d) || isPlane(d) ? undefined : d.posture.headDrop),
  armWidth: bike((d) => d.posture.armWidth),
  handReach: bike((d) => d.posture.handReach),
  handHeight: bike((d) => d.posture.handHeight),
  helmet: bike((d) => d.helmet.kind),
  tail: bike((d) => d.helmet.tail),
  vents: bike((d) => d.helmet.vents),
  fabric: (d) => (isJumper(d) || isBobsled(d) || isTruck(d) || isCar(d) || isRecord(d) || isDrone(d) || isPlane(d) ? undefined : d.suit.fabric),
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
  cabNose: truck((d) => d.cab.nose),
  fairing: truck((d) => d.cab.fairing),
  extenders: truck((d) => d.cab.extenders),
  gapLength: truck((d) => d.gap.length),
  gapFill: truck((d) => d.gap.fill),
  skirts: truck((d) => d.trailer.skirts),
  boatTail: truck((d) => d.trailer.tail),
  tailAngle: truck((d) => d.trailer.tailAngle),
  rideFront: car((d) => d.ride.front),
  rideRear: car((d) => d.ride.rear),
  frontWing: car((d) => d.frontWing),
  rearAngle: car((d) => d.rearWing.angle),
  rearChord: car((d) => d.rearWing.chord),
  diffuser: car((d) => d.diffuser),
  floorEdge: car((d) => d.floorEdge),
  inlet: car((d) => d.inlet),
  noseLength: rec((d) => d.nose.length),
  noseDroop: rec((d) => d.nose.droop),
  canopy: rec((d) => d.canopy),
  fin: rec((d) => d.fin),
  fairings: rec((d) => d.fairings),
  waist: rec((d) => d.waist),
  podLength: quad((d) => d.pod.length),
  podRake: quad((d) => d.pod.rake),
  podVents: quad((d) => d.pod.vents),
  armFairings: quad((d) => d.arms),
  planeNose: plane((d) => d.fuselage.nose),
  tailCone: plane((d) => d.fuselage.taper),
  tailSize: plane((d) => d.tail),
  cameraDrop: plane((d) => d.camera.drop),
  cameraFairing: plane((d) => d.camera.fairing),
  cameraAt: plane((d) => d.camera.at),
  winglets: plane((d) => d.winglets),
}

/** The controls set differently in `b` than in `a`, in Shape-screen order. */
export function changedControls(a: Design, b: Design): ControlId[] {
  return (Object.keys(READ) as ControlId[]).filter((id) => READ[id](a) !== READ[id](b))
}
