import { describe, expect, it } from 'vitest'
import { CHALLENGE, DESIGN_CODE_PREFIX } from '../src/data/challenge'
import type { CyclistDesign } from '../src/data/cyclist'
import { DEFAULT_JUMPER } from '../src/data/jumper'
import { BRIEFS } from '../src/data/briefs'
import { challengeLink, decodeChallenge, encodeChallenge, findChallengeCode } from '../src/persist/designCode'
import { wrapText } from '../src/persist/code'
import { briefTemplate, dayCdA, deliver, type Brief } from '../src/sim/career'
import { challengeable, challengeCareer, challengeOutcome, challengeTarget, type Challenge } from '../src/sim/challenge'

const id = 'tvardov-national'
const tmpl = briefTemplate(id)!
const brief: Brief = { id, fee: 250000, days: tmpl.days, seed: 4242 }
const fast = (s: CyclistDesign): CyclistDesign => ({
  ...s,
  posture: { ...s.posture, torsoDeg: 12, headDrop: 0.55, armWidth: 0.28 },
  helmet: { kind: 'aero', tail: 0.3, vents: 0.05 },
  suit: { fabric: 'smooth', armTrips: true },
  bars: 'aero',
  wheels: { front: 'deep', rear: 'disc' },
  frame: 'kamm',
})
const sent: Challenge = { brief, seed: 77, day: 140, design: fast(tmpl.setup as CyclistDesign), firm: 'Nordwind Aero' }

describe('challenges (PR 11h)', () => {
  it('only riders and skaters, and never a defence job', () => {
    expect(challengeable(id)).toBe(true)
    expect(challengeable('zorin-junior')).toBe(false)
    expect(challengeable('no-such-job')).toBe(false)
    for (const b of BRIEFS.filter((x) => x.defence)) expect(challengeable(b.id)).toBe(false)
    expect(BRIEFS.some((b) => b.setup.sport === 'skating' && challengeable(b.id))).toBe(true)
  })

  it('the target is the sender’s design on the day: what their debrief read', () => {
    const practice = challengeCareer(sent)
    const d = deliver(practice, sent.design, 0.22)!
    expect(challengeTarget(sent)).toBe(d.debrief.actual)
    // Their client's old setup is slower on the same day.
    expect(dayCdA(brief, tmpl.setup)).toBeGreaterThan(challengeTarget(sent))
  })

  it('opens a practice copy: the job in hand on the sender’s seed and day, money for the tunnel, no guide', () => {
    const c = challengeCareer(sent)
    expect(c.seed).toBe(77)
    expect(c.day).toBe(140)
    expect(c.money).toBe(CHALLENGE.money)
    expect(c.job).toEqual({ brief, promise: tmpl.target, startDay: 140, daysLeft: brief.days, spent: 0 })
    expect(c.history).toEqual([])
    expect(c.guide.off).toBe(true)
  })

  it('beating, tying and falling short', () => {
    const target = challengeTarget(sent)
    expect(challengeOutcome(target, target - 0.002)).toBe('beat')
    expect(challengeOutcome(target, target + CHALLENGE.tie / 2)).toBe('tie')
    expect(challengeOutcome(target, target + 0.002)).toBe('short')
    // The client's setup doesn't beat a sharp design.
    expect(challengeOutcome(target, dayCdA(brief, tmpl.setup))).toBe('short')
  })
})

describe('design codes (PR 11h)', () => {
  it('round-trip a challenge, and survive the spaces a phone adds', async () => {
    const code = await encodeChallenge(sent)
    expect(code.startsWith(DESIGN_CODE_PREFIX)).toBe(true)
    const back = await decodeChallenge(code)
    expect(back).toEqual({ ok: true, challenge: sent })
    const spaced = code.replace(/(.{40})/g, '$1\n ')
    expect((await decodeChallenge(spaced)).ok).toBe(true)
  })

  it('carries nothing from the career but the seed, day and firm name', async () => {
    const code = await encodeChallenge(sent)
    const { unwrapText } = await import('../src/persist/code')
    const open = await unwrapText(DESIGN_CODE_PREFIX, code)
    expect(open.ok && Object.keys(JSON.parse(open.text)).sort()).toEqual(['brief', 'day', 'design', 'firm', 'seed', 'v'])
  })

  it('catch a save code, a typo, a newer format, the wrong sport and a job that isn’t a challenge', async () => {
    expect(await decodeChallenge('LAM1:zabc.def')).toEqual({ ok: false, error: 'prefix' })
    const code = await encodeChallenge(sent)
    expect(await decodeChallenge(code.slice(0, -3) + 'zzz')).toEqual({ ok: false, error: 'check' })
    const wrap = (body: object) => wrapText(DESIGN_CODE_PREFIX, JSON.stringify(body))
    expect(await decodeChallenge(await wrap({ ...sent, v: CHALLENGE.version + 1 }))).toEqual({ ok: false, error: 'newer' })
    expect(await decodeChallenge(await wrap({ ...sent, v: CHALLENGE.version, design: DEFAULT_JUMPER }))).toEqual({ ok: false, error: 'damaged' })
    const jump = briefTemplate('zorin-junior')!
    expect(await decodeChallenge(await wrap({ ...sent, v: CHALLENGE.version, brief: { id: 'zorin-junior', fee: 1, days: jump.days, seed: 1 }, design: DEFAULT_JUMPER }))).toEqual({ ok: false, error: 'unknown' })
    expect(await decodeChallenge(await wrap({ ...sent, v: CHALLENGE.version, firm: '   ' }))).toEqual({ ok: false, error: 'damaged' })
    expect(await decodeChallenge(await wrap({ ...sent, v: CHALLENGE.version, seed: -1 }))).toEqual({ ok: false, error: 'damaged' })
  })
})

describe('challenge links (PR 11i)', () => {
  it('find the code in a link, an escaped link, a bare code, or a message around it', async () => {
    const code = await encodeChallenge(sent)
    const link = challengeLink('https://laminar.longlight.games/', code)
    expect(link).toContain('?challenge=LAMD1%3A')
    expect(link.endsWith('#board')).toBe(true)
    expect(findChallengeCode(link)).toBe(code)
    expect(findChallengeCode(code)).toBe(code)
    expect(findChallengeCode(`Beat this! ${link} good luck`)).toBe(code)
    expect(findChallengeCode(link.replace('%3A', ':'))).toBe(code)
    expect(findChallengeCode('LAM1:zabc.def')).toBeNull()
    expect(findChallengeCode('nothing here')).toBeNull()
    expect((await decodeChallenge(findChallengeCode(link)!)).ok).toBe(true)
  })
})
