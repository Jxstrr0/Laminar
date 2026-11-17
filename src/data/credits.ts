/**
 * Who made what, for the Credits sheet (PR 13c). CREDITS.md is the full record
 * with sources; `tests/credits.test.ts` checks the two agree, so a font or
 * library added to one and not the other fails the build.
 */

/** The studio site. */
export const STUDIO_URL = 'https://longlight.games/'

/** The official logo file for dark backgrounds, and its size in the file. */
export const STUDIO_LOGO = { src: './brand/longlight-logo-dark.svg', width: 1043, height: 336 } as const

export interface Credit {
  name: string
  /** Who made it, as the record names them. */
  by: string
  licence: string
}

export const FONTS: readonly Credit[] = [
  { name: 'Instrument Sans', by: 'The Instrument Sans Project Authors', licence: 'SIL Open Font License 1.1' },
  { name: 'Spline Sans Mono', by: 'The Spline Sans Mono Project Authors', licence: 'SIL Open Font License 1.1' },
  { name: 'Space Grotesk (studio pieces)', by: 'The Space Grotesk Project Authors', licence: 'SIL Open Font License 1.1' },
]

export const LIBRARIES: readonly Credit[] = [{ name: 'three.js', by: 'three.js authors', licence: 'MIT' }]
