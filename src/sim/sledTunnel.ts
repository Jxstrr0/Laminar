/**
 * The bobsled in the tunnel (plan section 6.8, PR 8n).
 *
 * The hull is a body like any other: it's built at scale with the model's
 * own size errors and read at the tunnel's speed, so it meets the Reynolds
 * trap and the trip strips like a rider's torso. The nose, the runners and
 * the crew aren't bodies the drag model reads, so they ride along as fixed
 * drag (PreparedModel.fixedCdA): the nose and crew with the build's size
 * errors, the runners through the still-floor error (BOB_TUNNEL). On the
 * track the ice moves under the sled; in the tunnel the floor doesn't, and
 * its slow air hides some of the runners' drag. The shop's ground board
 * takes most of that error away.
 *
 * The forecast: the reference run down the track on a drag area the tunnel
 * read, instead of the truth.
 */
import { BOB_HULL_SPEED, BOB_TUNNEL, SLED, type BobsledDesign } from '../data/bobsled'
import { BOB_REFERENCE, type Track } from '../data/tracks'
import { crewCdA, noseCdA, referenceConditions, runWith, type BobRun } from './bobsled'
import { sledShape } from './geom/bobsled'
import { gaussian } from './noise'
import { Rng } from './rng'
import { prepareModel, REFERENCE_TT, type EventSpec, type ModelSpec, type PreparedModel } from './views'

/** The share of the runners' drag the balance sees: less on the bare floor, nearly all on a ground board. */
export function floorRead(board: boolean): number {
  return 1 - BOB_TUNNEL.floorHidden * (board ? BOB_TUNNEL.boardLeft : 1)
}

/** A built sled model: the hull as a body, its nose, runners and crew as fixed drag. */
export function prepareSled(design: BobsledDesign, model: ModelSpec): PreparedModel {
  const built = prepareModel(sledShape(design), model)
  const rng = new Rng(model.seed).fork('sled-build')
  const k = () => 1 + model.accuracy * gaussian(rng)
  const s2 = model.scale * model.scale
  // The nose's drag goes with the built hull's front; the crew figures carry their own size errors.
  const nose = noseCdA(design, built.shape.frontalArea / s2)
  const crew = crewCdA(design) * k()
  const runners = SLED.runnersCdA * floorRead(model.board === true)
  return { ...built, fixedCdA: (nose + crew + runners) * s2 }
}

/** The reference run (the crew's usual push, best ice, still air) on a drag area the tunnel read. */
export function forecastRun(cdA: number, design: BobsledDesign, track: Track): BobRun {
  return runWith(cdA, design, track, referenceConditions(design))
}

/** The track's air as an event, so the model shop and the Reynolds readout match the sled at its usual speed. */
export function sledEvent(track: Track): EventSpec {
  return { ...REFERENCE_TT, temperature: BOB_REFERENCE.temperature, altitude: track.altitude, riderSpeed: BOB_HULL_SPEED, windSpeed: 0 }
}
