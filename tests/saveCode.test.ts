import { describe, expect, it } from 'vitest'
import { SIT_UP_CYCLIST } from '../src/data/cyclist'
import { CODE_LIMITS, CODE_PREFIX, decodeSave, encodeSave, unwrapText, wrapText } from '../src/persist/code'
import { packSave, SAVE_VERSION, type SaveFile } from '../src/persist/save'
import { newLab } from '../src/sim/lab'
import { newCareer } from '../src/sim/career'
import type { Run } from '../src/sim/run'

const run = (id: number): Run => ({
  id,
  model: 'rider',
  samples: Array.from({ length: 200 }, (_, i) => ({ t: i * 0.25, speed: 30, yawDeg: 0, cdA: 0.214 + (i % 7) * 1e-4, cyA: 0, dragN: 25, steady: i > 20 })),
  duration: 50,
  energyKWh: 0.02,
  topSpeed: 30,
})
const save: SaveFile = { v: SAVE_VERSION, savedAt: 1_763_200_000_000, design: structuredClone(SIT_UP_CYCLIST), lab: { ...newLab(), runs: [run(1), run(2)], nextRunId: 3 }, career: newCareer(7) }

describe('save codes', () => {
  it('round-trip a career, squeezed well under the plain save', async () => {
    const code = await encodeSave(save)
    expect(code.startsWith(`${CODE_PREFIX}z`)).toBe(true)
    expect(code.length).toBeLessThan(packSave(save).length / 3)
    const back = await decodeSave(code)
    expect(back.ok && packSave(back.save)).toBe(packSave(save))
  })

  it('survive the line breaks and spaces a phone adds when pasting', async () => {
    const code = await encodeSave(save)
    const mangled = ` ${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n${code.slice(90)}\n`
    expect((await decodeSave(mangled)).ok).toBe(true)
  })

  it('catch a wrong prefix, a typo and a code cut short', async () => {
    const code = await encodeSave(save)
    expect(await decodeSave('LMB1.abc')).toEqual({ ok: false, error: 'prefix' })
    const typo = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21)
    expect(await decodeSave(typo)).toEqual({ ok: false, error: 'check' })
    expect((await decodeSave(code.slice(0, code.length - 30))).ok).toBe(false)
  })

  it('stop a small code built to unpack to something huge, without unpacking it all', async () => {
    // 80 million letters squeeze to about 80 thousand characters: over the 64 MB limit.
    const bomb = await wrapText(CODE_PREFIX, 'a'.repeat(80_000_000))
    expect(bomb.length).toBeLessThan(200_000)
    expect(await decodeSave(bomb)).toEqual({ ok: false, error: 'damaged' })
    // The limit is on what comes out: the same kind of code under the limit still reads.
    const fine = await wrapText('T1:', 'a'.repeat(300_000))
    expect(await unwrapText('T1:', fine, { maxCodeChars: 10_000, maxTextBytes: 300_000 })).toEqual({ ok: true, text: 'a'.repeat(300_000) })
    expect(await unwrapText('T1:', fine, { maxCodeChars: 10_000, maxTextBytes: 299_999 })).toEqual({ ok: false, error: 'damaged' })
    // And a paste too long to be a code is turned away before any work is done.
    expect(await unwrapText('T1:', fine, { maxCodeChars: fine.length - 1, maxTextBytes: 300_000 })).toEqual({ ok: false, error: 'damaged' })
    expect(CODE_LIMITS.maxTextBytes).toBeGreaterThan(8_000_000)
  })

  it('say when a code comes from a newer Laminar', async () => {
    const head = `${CODE_PREFIX}p${Buffer.from(JSON.stringify({ v: SAVE_VERSION + 1 })).toString('base64url')}`
    const { hashString } = await import('../src/sim/rng')
    expect(await decodeSave(`${head}.${hashString(head).toString(36)}`)).toEqual({ ok: false, error: 'newer' })
  })
})
