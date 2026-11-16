import { describe, expect, it } from 'vitest'
import { pictureFileName, wrapLines } from '../src/ui/legacyPicture'

/** One unit per character, so widths are easy to reason about. */
const measure = (s: string) => s.length

describe('legacy picture', () => {
  it('wraps at spaces within the width', () => {
    expect(wrapLines('Best job: Marta Selivan at the regional', 12, measure)).toEqual(['Best job:', 'Marta', 'Selivan at', 'the regional'])
  })

  it('gives an over-long word its own line', () => {
    expect(wrapLines('a Krilodynamicsworks b', 5, measure)).toEqual(['a', 'Krilodynamicsworks', 'b'])
  })

  it('stops at the line limit with an ellipsis that fits', () => {
    const lines = wrapLines('one two three four five six', 9, measure, 2)
    expect(lines).toEqual(['one two', 'three…'])
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(9)
  })

  it('leaves short text alone', () => {
    expect(wrapLines('Potok Aero', 40, measure, 2)).toEqual(['Potok Aero'])
    expect(wrapLines('   ', 40, measure)).toEqual([])
  })

  it('names the file after the firm', () => {
    expect(pictureFileName('Strela Aero Works')).toBe('laminar-legacy-strela-aero-works.png')
    expect(pictureFileName('  Kelbo & Co.  ')).toBe('laminar-legacy-kelbo-co.png')
    expect(pictureFileName('Поток')).toBe('laminar-legacy.png')
  })
})
