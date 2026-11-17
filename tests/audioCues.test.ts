import { describe, expect, it } from 'vitest'
import { fanVoice, tableCue, tableMoving } from '../src/audio/cues'
import { AUDIO } from '../src/data/audio'

describe('the lab sounds (PR 13a)', () => {
  it('a still fan is silent', () => {
    const v = fanVoice(0, 40)
    expect(v.humGain).toBe(0)
    expect(v.rushGain).toBe(0)
  })
  it('the fan rises in pitch and loudness with the air', () => {
    const slow = fanVoice(10, 40)
    const fast = fanVoice(30, 40)
    expect(fast.humHz).toBeGreaterThan(slow.humHz)
    expect(fast.rushHz).toBeGreaterThan(slow.rushHz)
    expect(fast.rushGain).toBeGreaterThan(slow.rushGain)
    // The air's roar goes with the square of its speed.
    expect(fast.rushGain / slow.rushGain).toBeCloseTo(9, 6)
  })
  it('never louder than full at top speed, even past it', () => {
    const v = fanVoice(80, 40)
    expect(v.rushGain).toBeCloseTo(AUDIO.fan.rushGain, 9)
    expect(v.humGain).toBeCloseTo(AUDIO.fan.humGain, 9)
  })
  it('the turntable knocks once, as it arrives', () => {
    expect(tableMoving(3, 10)).toBe(true)
    expect(tableCue(true, tableMoving(10, 10))).toBe('clunk')
    expect(tableCue(false, false)).toBeNull()
    expect(tableCue(true, true)).toBeNull()
    expect(tableCue(false, true)).toBeNull()
  })
})
