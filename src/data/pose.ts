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

/**
 * The skater's skeleton (PR 8b), for drawing: the gliding foot under the
 * hips with its knee bent to the design's angle, the other leg pushed out
 * to the side, and the trunk leaning forward from the hips. Same axes as
 * the rider's: x forward along the ice, y up (ice at 0), z to the right.
 */
export const SKATER_SKELETON = {
  /** The gliding ankle: on the blade, a little to the left. */
  ankle: { x: 0, y: 0.14, z: -0.09 },
  shin: 0.46,
  thigh: 0.46,
  /** The pushing foot: back and out to the side, its leg nearly straight. */
  pushFoot: { back: 0.3, out: 0.42 },
  torso: 0.6,
  neck: 0.12,
  /** Neck angle above the back with the head up; a full head drop takes off this much. */
  neckUpDeg: 40,
  neckDropDeg: 30,
  headRadius: 0.11,
  upperArm: 0.3,
  forearm: 0.3,
  shoulderWidth: 0.36,
  hipWidth: 0.2,
  /** Hands folded on the back: this far along the back from the hips, lifted this much, this far apart either side. */
  handsOnBack: 0.15,
  handsLift: 0.08,
  handsGap: 0.04,
  /** Folded arms: elbows this far above the higher of shoulder and hand, and this much wider than the shoulders. */
  elbowLift: 0.12,
  elbowOut: 1.3,
  /** A swinging arm hangs this far forward of straight down, degrees (the near arm); the far arm swings back this many times as far, lifted a little. */
  swingDeg: 35,
  swingBack: 1.4,
  swingBackLift: 0.1,
  swingOut: 0.05,
  /** The hood's tilt from the line of the head, degrees. */
  hoodPitchDeg: -10,
  /** The blades: length, height, and how far ahead of the ankle they reach. */
  blade: { length: 0.44, height: 0.06, ahead: 0.12 },
  /** Hood (or cap) mount from the head's centre, and how much lies ahead of it. */
  hoodOffset: { x: -0.02, y: 0.02 },
  hoodNose: 0.35,
}
