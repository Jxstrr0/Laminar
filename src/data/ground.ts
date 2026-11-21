/**
 * Surface detail on the replays' ground and roads (PR 13az): greyscale CC0
 * textures from ambientCG, made by scripts/make-ground.py into
 * public/tex/<kind>.jpg. Each one only shades the venue's own colour a
 * little lighter or darker, so the palette stays and the grass, tarmac and
 * snow stop looking like flat paper. Credits in CREDITS.md.
 */

/** The tunnel's walls and floor (PR 13ba) use the same idea: plaster and smooth concrete. */
export type GroundKind = 'grass' | 'asphalt' | 'snow' | 'wall' | 'floor'

/** How many metres one copy of each texture covers. */
export const GROUND_TILE: Record<GroundKind, number> = {
  // An eighth of a grid cell: the ground moves in whole cells, and the grass mustn't seem to jump (PR 13bc).
  grass: 3.125,
  asphalt: 2.5,
  snow: 5,
  wall: 1.2,
  floor: 1.6,
}
