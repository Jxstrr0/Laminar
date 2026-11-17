// Adapted from Quench tests/credits.test.ts (17 Nov 2026)
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FONTS, LIBRARIES, STUDIO_LOGO, STUDIO_URL } from '../src/data/credits'
import { STRINGS, t } from '../src/data/strings'

const read = (path: string) => readFileSync(path, 'utf8')
const RECORD = read('CREDITS.md')

/** The rows of the table under a heading in CREDITS.md, as lists of cells. */
function table(heading: string): string[][] {
  const from = RECORD.indexOf(`## ${heading}`)
  expect(from).toBeGreaterThan(-1)
  const rows: string[][] = []
  for (const line of RECORD.slice(from).split('\n').slice(1)) {
    if (line.startsWith('## ')) break
    if (!line.startsWith('|') || line.includes('---')) continue
    rows.push(line.split('|').slice(1, -1).map((c) => c.trim()))
  }
  return rows.slice(1)
}

describe('the Credits sheet and CREDITS.md agree', () => {
  it('names every font in the record, with its makers and licence', () => {
    const rows = table('Fonts (self-hosted)')
    expect(FONTS.map((f) => f.name)).toEqual(rows.map((r) => r[0]))
    for (const [i, font] of FONTS.entries()) {
      expect(rows[i]?.[1]).toBe(font.by)
      expect(rows[i]?.[2]).toBe(font.licence)
    }
  })

  it('names every code library in the record', () => {
    const rows = table('Code libraries')
    expect(LIBRARIES.map((l) => l.name)).toEqual(rows.map((r) => r[0]))
    for (const [i, lib] of LIBRARIES.entries()) {
      expect(rows[i]?.[1]).toBe(lib.by)
      expect(rows[i]?.[2]).toBe(lib.licence)
    }
  })

  it('writes one line per credit', () => {
    expect(t('credits.line', { name: 'three.js', by: 'three.js authors', licence: 'MIT' })).toBe('three.js, by three.js authors. Licence: MIT.')
  })
})

// Section 3 of the studio catalogue: the rules for studio pieces.
describe('the studio brand', () => {
  const BRAND = ['#d97757', '#7b3fc4', '#141413', '#faf9f5', '#b48ce8']
  const hexes = (css: string) => [...css.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase())

  it('uses the official logo file, unchanged', () => {
    const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
    // The same files as Quench's, copied from the studio press kit.
    expect(sha('public/brand/longlight-logo-dark.svg')).toBe('e619f5110ba27d0c77afcfcef9d99ccaa360e7619456213c19b14b5400851c97')
    expect(STUDIO_LOGO.src).toBe('./brand/longlight-logo-dark.svg')
  })

  it('has the credit line and the studio link as the catalogue gives them', () => {
    expect(t('studio.credit')).toBe('© 2026 Kelbo / Longlight Interactive')
    expect(STUDIO_URL).toBe('https://longlight.games/')
  })

  it('always gives the studio its full name', () => {
    for (const text of Object.values(STRINGS)) {
      const bare = text.replace(/longlight\.games/g, '').match(/Longlight(?! Interactive)/g)
      expect(bare, text.slice(0, 60)).toBeNull()
    }
  })

  it('keeps the studio block to the studio colours and font', () => {
    const css = read('src/style.css')
    const block = css.split('\n').filter((l) => /^\.credits-(studio|logo|game|copy|site)\b/.test(l))
    expect(block.length).toBe(5)
    for (const hex of hexes(block.join('\n'))) expect(BRAND).toContain(hex)
    expect(block[0]).toContain("'Space Grotesk'")
  })
})
