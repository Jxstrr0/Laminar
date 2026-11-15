import { describe, expect, it } from 'vitest'
import { SIT_UP_CYCLIST } from '../src/data/cyclist'
import { CODE_PREFIX, decodeSave, encodeSave } from '../src/persist/code'
import { packSave, SAVE_VERSION, type SaveFile } from '../src/persist/save'
import { newLab } from '../src/sim/lab'
import type { Run } from '../src/sim/run'

const run = (id: number): Run => ({
  id,
  model: 'rider',
  samples: Array.from({ length: 200 }, (_, i) => ({ t: i * 0.25, speed: 30, yawDeg: 0, cdA: 0.214 + (i % 7) * 1e-4, cyA: 0, dragN: 25, steady: i > 20 })),
  duration: 50,
  energyKWh: 0.02,
  topSpeed: 30,
})
const save: SaveFile = { v: SAVE_VERSION, savedAt: 1_763_200_000_000, design: structuredClone(SIT_UP_CYCLIST), lab: { ...newLab(), runs: [run(1), run(2)], nextRunId: 3 } }

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

  it('say when a code comes from a newer Laminar', async () => {
    const head = `${CODE_PREFIX}p${Buffer.from(JSON.stringify({ v: SAVE_VERSION + 1 })).toString('base64url')}`
    const { hashString } = await import('../src/sim/rng')
    expect(await decodeSave(`${head}.${hashString(head).toString(36)}`)).toEqual({ ok: false, error: 'newer' })
  })
})
