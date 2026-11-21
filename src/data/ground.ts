/**
 * Surface detail on the replays' ground and roads (PR 13az): greyscale CC0
 * textures from ambientCG, made by scripts/make-ground.py into
 * public/tex/<kind>.jpg. Each one only shades the venue's own colour a
 * little lighter or darker, so the palette stays and the grass, tarmac and
 * snow stop looking like flat paper. Credits in CREDITS.md.
 */

export type GroundKind = 'grass' | 'asphalt' | 'snow'

/** How many metres one copy of each texture covers. */
export const GROUND_TILE: Record<GroundKind, number> = {
  grass: 3,
  asphalt: 2.5,
  snow: 5,
}
