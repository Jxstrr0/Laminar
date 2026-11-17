import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { commTakeover } from '../src/audio/cues'
import { MIX } from '../src/data/audio'
import { MUSIC } from '../src/data/music'
import { SFX } from '../src/data/sfx'
import { VOICE } from '../src/data/voice'

const db = (gain: number) => 20 * Math.log10(gain)

describe('the commentator stays in time with the replay (PR 13u)', () => {
  it('plays at once when nobody is speaking', () => {
    expect(commTakeover(null, VOICE.commWait)).toBe('now')
  })

  it('waits only for one of his own calls that is nearly done', () => {
    expect(commTakeover({ comm: true, left: 0.3 }, VOICE.commWait)).toBe('after')
    expect(commTakeover({ comm: true, left: 2 }, VOICE.commWait)).toBe('cut')
  })

  it('cuts in over anyone else, however close they are to the end', () => {
    expect(commTakeover({ comm: false, left: 0.1 }, VOICE.commWait)).toBe('cut')
  })

  it('drops a call before it could land on the next moment', () => {
    expect(VOICE.commWait + VOICE.commGap).toBeLessThan(VOICE.commStale)
    expect(VOICE.commStale).toBeLessThan(VOICE.stale)
  })
})

describe('the mix (PR 13u)', () => {
  // Files are levelled to about -20 LUFS (voice) and -18 (effects, music); the gains place them.
  const voice = -20 + db(VOICE.gain)
  // A typical effect: the middle gain (a few quiet ones, the snap and the brief's click, sit lower in their files and higher in gain).
  const gains = Object.values(SFX).map((s) => s.gain).sort((a, b) => a - b)
  const loudestSfx = -18 + db(gains[Math.floor(gains.length / 2)]!)
  const loudestMusic = -18 + db(Math.max(...Object.values(MUSIC).map((m) => m.gain)))

  it('keeps the voice clear of the effects, and the music under both', () => {
    expect(voice - loudestSfx).toBeGreaterThanOrEqual(4)
    expect(loudestSfx - loudestMusic).toBeGreaterThanOrEqual(4)
  })

  it('steps the music and effects back while someone speaks, more for the music', () => {
    expect(MIX.duck.music).toBeLessThan(MIX.duck.sfx)
    expect(MIX.duck.sfx).toBeLessThan(1)
    expect(MIX.duckAttack).toBeLessThan(MIX.duckRelease)
  })

  it('lets the music and replay sounds hear a replay open at once, not on a timer', () => {
    for (const file of ['music', 'sfx', 'voice']) {
      const src = readFileSync(new URL(`../src/audio/${file}.ts`, import.meta.url), 'utf8')
      expect(src).toContain("from './replayWatch'")
      expect(src).not.toMatch(/const replayOpen =|setInterval\([^)]*watchMs\)[\s\S]*replayOpen\(\) && loops/)
    }
  })
})

describe('the commentator says what the screen says (PR 13u)', () => {
  it('lets a dead-level halfway pass instead of calling it behind', async () => {
    const { commLineFor } = await import('../src/audio/cues')
    const { voiceGap } = await import('../src/audio/voice')
    expect(commLineFor('ride', 'half', voiceGap({ kind: 'half', gap: 0.01 } as { kind: string }, 3000))).toBeNull()
    expect(commLineFor('ride', 'half', voiceGap({ kind: 'half', gap: 2 } as { kind: string }, 3000))).toBe('LAM-COMM-0003')
    expect(commLineFor('ride', 'half', voiceGap({ kind: 'half', gap: -2 } as { kind: string }, 3000))).toBe('LAM-COMM-0004')
  })
})
