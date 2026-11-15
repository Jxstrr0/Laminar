/**
 * The rider's skeleton and the bike's frame, for drawing the Shape screen.
 * Metres; the ground is y = 0, the bottom bracket sits at x = 0 with x
 * pointing forward along the road, and z points to the rider's right.
 * The aero model doesn't read these: they turn the same design into a
 * figure you can see (plan section 5's base body, until the Blender art
 * pass replaces it in PR 13).
 */
export const SKELETON = {
  bottomBracket: { x: 0, y: 0.27 },
  /** Saddle top, from the bottom bracket. */
  saddle: { x: -0.17, y: 0.72 },
  /** Hip joint above the saddle top. */
  hipAbove: 0.06,
  torso: 0.6,
  neck: 0.12,
  /** Neck angle above the back with the head up; a full head drop takes off this much. */
  neckUpDeg: 45,
  neckDropDeg: 35,
  headRadius: 0.11,
  /** Helmet nose-up tilt, degrees: base, per degree of back angle, per unit of head drop. */
  helmetPitch: { base: -6, perTorsoDeg: 0.5, perHeadDrop: 14 },
  upperArm: 0.3,
  forearm: 0.34,
  thigh: 0.46,
  shin: 0.47,
  crank: 0.17,
  /** Shoulder width at the joints, m. */
  shoulderWidth: 0.36,
  hipWidth: 0.2,
  /** Static crank angles for the two feet, degrees (0 forward, 90 down). */
  crankDeg: [15, 195],
}

/** Where the helmet sits: its mount point from the head's centre, and how much of its length lies ahead of the mount. */
export const HELMET_MOUNT = {
  offset: { x: -0.02, y: 0.03 },
  noseFraction: 0.3,
}

export const FRAME = {
  wheelRadius: 0.335,
  rearAxleX: -0.41,
  frontAxleX: 0.59,
  headTop: { x: 0.5, y: 0.82 },
  headBottom: { x: 0.54, y: 0.66 },
  seatTop: { x: -0.13, y: 0.83 },
  tubeRadius: 0.018,
}
