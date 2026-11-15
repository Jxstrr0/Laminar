/**
 * The yaw turntable under the model. Like the fan, it turns towards the angle
 * you ask for at its own rate rather than jumping, on the sim's fixed step.
 * Yaw is in degrees; positive turns the model's nose to its left, so the air
 * arrives from the rider's right.
 */

export interface TurntableSpec {
  /** Furthest it turns each way, degrees. */
  min: number
  max: number
  /** The dial moves in steps of this many degrees. */
  step: number
  /** Most it turns per second, degrees. */
  rate: number
}

export interface TurntableState {
  target: number
  angle: number
}

export function turntableAtRest(): TurntableState {
  return { target: 0, angle: 0 }
}

/** Clamp a requested angle into the table's range, on its steps. */
export function setYawTarget(state: TurntableState, target: number, spec: TurntableSpec): TurntableState {
  if (!Number.isFinite(target)) return state
  const snapped = Math.round(target / spec.step) * spec.step
  return { ...state, target: Math.min(spec.max, Math.max(spec.min, snapped)) }
}

/** Advance the table by dt seconds. */
export function stepTurntable(state: TurntableState, dt: number, spec: TurntableSpec): TurntableState {
  const most = spec.rate * dt
  const gap = state.target - state.angle
  return { ...state, angle: state.angle + Math.min(most, Math.max(-most, gap)) }
}
