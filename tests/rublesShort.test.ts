import { describe, expect, it } from 'vitest'
import { rublesShort } from '../src/ui/format'

// The money chip (top right on every screen) must stay a few characters wide on a 360 px phone.
describe('rublesShort', () => {
  it('keeps small sums and thousands as before', () => {
    expect(rublesShort(850)).toBe('₽850')
    expect(rublesShort(98_500)).toBe('₽98.5k')
    expect(rublesShort(120_000)).toBe('₽120k')
    expect(rublesShort(999_000)).toBe('₽999k')
  })
  it('writes millions with an M', () => {
    expect(rublesShort(999_600)).toBe('₽1M')
    expect(rublesShort(1_250_000)).toBe('₽1.25M')
    expect(rublesShort(1_200_000)).toBe('₽1.2M')
    expect(rublesShort(12_345_000)).toBe('₽12.3M')
    expect(rublesShort(123_456_000)).toBe('₽123M')
    expect(rublesShort(1_234_567_000)).toBe('₽1,235M')
  })
  it('puts the minus sign in front', () => {
    expect(rublesShort(-4_200)).toBe('−₽4.2k')
    expect(rublesShort(-1_500_000)).toBe('−₽1.5M')
  })
})
