/**
 * Drag handles on the Shape screen (plan section 5): a few dots on the rider
 * you can pull to reshape it. Each handle moves the same numbers the sliders
 * do, so the sliders stay the precise fallback and the aero model never sees
 * anything new. The slider ranges keep every pull inside a shape that can't
 * fold through itself.
 */

/** The design numbers a handle can move. */
export type HandleParam = 'torsoDeg' | 'headDrop' | 'armWidth' | 'handReach' | 'handHeight' | 'tail'

export type HandleId = 'hands' | 'elbowL' | 'elbowR' | 'back' | 'head' | 'tail'

export interface HandleDef {
  id: HandleId
  /** What pulling it changes, in the order a tap jumps to. */
  params: readonly HandleParam[]
}

export const HANDLES: readonly HandleDef[] = [
  { id: 'hands', params: ['handReach', 'handHeight'] },
  { id: 'elbowL', params: ['armWidth'] },
  { id: 'elbowR', params: ['armWidth'] },
  { id: 'back', params: ['torsoDeg'] },
  { id: 'head', params: ['headDrop'] },
  { id: 'tail', params: ['tail'] },
]

/** Where handles sit on the body. */
export const HANDLE_SPOTS = {
  /** The back handle, as a fraction of the way from hip to shoulder. */
  backAlong: 0.6,
}

/** How a pull is turned into design numbers. */
export const HANDLE_DRAG = {
  /** Probe step for working out how a number moves the dot, as a fraction of its range. */
  probe: 0.02,
  /** Damping, px²: stops tiny screen movements making huge jumps. */
  damping: 100,
  /**
   * A number that moves the dot less than this many pixels over its whole
   * range is out of reach from this view (arm width seen side-on), so a pull
   * leaves it alone.
   */
  minPxPerRange: 12,
  /** Solver passes per finger movement. */
  iterations: 2,
}

/** Touch sizes for the handles, CSS pixels. */
export const HANDLE_TOUCH = {
  /** A press this close to a dot grabs it (a 44 px target, and then some). */
  hitPx: 30,
  /** Moving less than this before letting go counts as a tap. */
  tapPx: 8,
}

/** The rule box drawn in 3D (plan section 5). */
export const RULE_BOX = {
  /** Room around the slider ranges for the hand volume, m. */
  margin: 0.04,
  /** The helmet volume's height and width, m. */
  helmetHeight: 0.26,
  helmetWidth: 0.25,
}
