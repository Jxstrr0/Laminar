import { describe, expect, it } from 'vitest'
import { GLOSSARY, GLOSSARY_IDS, GLOSSARY_UI, glossaryId, isGlossaryId, type GlossaryId } from '../src/data/glossary'

const entries = GLOSSARY_IDS.map((id) => [id, GLOSSARY[id]] as const)

/** Every bit of glossary text a player reads. */
const playerText: [string, string][] = [
  ...entries.flatMap(([id, e]): [string, string][] => [
    [`${id}.term`, e.term],
    [`${id}.short`, e.short],
    [`${id}.long`, e.long],
  ]),
  ...Object.entries(GLOSSARY_UI).map(([k, v]): [string, string] => [`ui.${k}`, v]),
]

describe('glossary entries', () => {
  it('covers the terms the plan asks for', () => {
    const required: GlossaryId[] = [
      'cda', 'cd', 'frontalArea', 'dynamicPressure', 'reynolds', 'boundaryLayer', 'laminar', 'turbulent',
      'transition', 'separation', 'wake', 'dragCrisis', 'skinFriction', 'pressureDrag', 'tripStrip', 'roughness',
      'yaw', 'apparentWind', 'windAveragedCda', 'sideForce', 'centreOfPressure', 'lift', 'downforce',
      'angleOfAttack', 'stall', 'inducedDrag', 'aspectRatio', 'groundEffect', 'liftToDrag', 'kammTail',
      'interferenceDrag', 'cavityDrag', 'scaleModel', 'forceBalance', 'sting', 'deskEstimate', 'comfort',
      'ruleBox', 'tcf',
    ]
    for (const id of required) expect(GLOSSARY[id], id).toBeDefined()
    expect(GLOSSARY_IDS.length).toBeGreaterThanOrEqual(required.length)
  })

  it.each(entries)('%s has a term, a one-line short and a 2–4 sentence long', (_id, e) => {
    expect(e.term.trim()).not.toBe('')
    expect(e.short.trim()).not.toBe('')
    expect(e.short).not.toMatch(/\n/)
    expect(e.short.length).toBeLessThanOrEqual(110)
    expect(e.long.trim()).not.toBe('')
    const sentences = e.long.split(/[.!?](?:\s|$)/).filter((s) => s.trim() !== '')
    expect(sentences.length).toBeGreaterThanOrEqual(2)
    expect(sentences.length).toBeLessThanOrEqual(4)
  })

  it.each(entries)('%s only points at entries that exist, and not at itself', (id, e) => {
    const see = e.seeAlso ?? []
    for (const other of see) {
      expect(isGlossaryId(other), `${id} → ${other}`).toBe(true)
      expect(other).not.toBe(id)
    }
    expect(new Set(see).size).toBe(see.length)
  })

  it('never names a real sport body', () => {
    for (const [where, text] of playerText) {
      expect(text, where).not.toMatch(/\bUCI\b|Union Cycliste|\bFIA\b|\bFIS\b/i)
    }
  })
})

describe('Canadian spelling', () => {
  // US spellings that have a Canadian twin. Word boundaries keep "diameter",
  // "parameter" and "comfort meter" (a gauge, spelled the same in Canada) out.
  const US: [RegExp, string][] = [
    [/\bcolor/i, 'colour'],
    [/\bbehavior/i, 'behaviour'],
    [/\bcenter/i, 'centre'],
    [/\b(kilo|centi|milli)?meters\b/i, 'metres'],
    [/\b(kilo|centi|milli)meter\b/i, 'metre'],
    [/\b(square|cubic|per|one|a|\d[\d.,]*)\s+meter\b/i, 'metre (the unit)'],
    [/\bfavorite/i, 'favourite'],
    [/\bgray/i, 'grey'],
    [/\banalyz/i, 'analyse'],
    [/\b(neighbor|honor|labor|flavor|rumor|harbor|armor|vapor|odor|vigor)/i, '-our'],
    [/\b(fiber|theater|liter|caliber)s?\b/i, '-re'],
    [/\b(maneuver|aluminum|catalog|defense)/i, 'Canadian form'],
    [/\b(traveled|traveling|modeled|modeling|labeled|labeling|canceled|fueled|leveled|signaled)\b/i, 'double l'],
  ]

  it.each(US)('no glossary text uses %s', (pattern, canadian) => {
    const hits = playerText.filter(([, text]) => pattern.test(text)).map(([where]) => where)
    expect(hits, `use ${canadian}: ${hits.join(', ')}`).toEqual([])
  })

  // Kelbo chose -ize (15 November 2026), as the Canadian Oxford does:
  // organize, realize, stabilize. Words that are always -ise (size, noise,
  // rise, precise...) are fine; "analyse" keeps its -yse.
  const ALWAYS_ISE = new Set([
    'size', 'sizes', 'sized', 'noise', 'noises', 'rise', 'rises', 'risen', 'wise', 'otherwise', 'precise',
    'exercise', 'surprise', 'promise', 'advise', 'devise', 'revise', 'comprise', 'compromise', 'expertise',
    'raise', 'raised', 'seize', 'prize', 'premise', 'enterprise', 'porpoise', 'cruise', 'praise', 'concise',
    'demise', 'paradise', 'disguise', 'supervise', 'improvise', 'televise', 'despise', 'incise', 'excise',
    'arise', 'arises', 'porpoising', 'poise', 'bruise', 'chastise', 'guise', 'franchise', 'merchandise', 'apprise',
  ])
  it('uses -ize, not -ise, where the ending is a choice', () => {
    const hits: string[] = []
    for (const [where, text] of playerText) {
      for (const word of text.toLowerCase().match(/\b[a-z]+is(e|es|ed|ing|ation|ations)\b/g) ?? []) {
        if (!ALWAYS_ISE.has(word)) hits.push(`${where}: ${word}`)
      }
    }
    expect(hits).toEqual([])
  })
})

describe('glossaryId', () => {
  it('finds an entry from its term, id or an alias, ignoring case and spacing', () => {
    expect(glossaryId('CdA')).toBe('cda')
    expect(glossaryId('cda')).toBe('cda')
    expect(glossaryId('Drag coefficient (Cd)')).toBe('cd')
    expect(glossaryId('drag coefficient')).toBe('cd')
    expect(glossaryId('CD')).toBe('cd')
    expect(glossaryId('  Reynolds   NUMBER ')).toBe('reynolds')
    expect(glossaryId('Re')).toBe('reynolds')
    expect(glossaryId('pressure drag')).toBe('pressureDrag')
    expect(glossaryId('Form drag')).toBe('pressureDrag')
    expect(glossaryId('L/D')).toBe('liftToDrag')
    expect(glossaryId('lift-to-drag ratio')).toBe('liftToDrag')
    expect(glossaryId('wind averaged CdA')).toBe('windAveragedCda')
    expect(glossaryId('Tarnovian Cycling Federation')).toBe('tcf')
    expect(glossaryId('q')).toBe('dynamicPressure')
    expect(glossaryId('Kammback')).toBe('kammTail')
    expect(glossaryId('rule box')).toBe('ruleBox')
    expect(glossaryId('drag crisis')).toBe('dragCrisis')
  })

  it('finds every entry from its own term and its own aliases', () => {
    for (const [id, e] of entries) {
      expect(glossaryId(e.term), e.term).toBe(id)
      for (const alias of e.aliases ?? []) expect(glossaryId(alias), `${id}: ${alias}`).toBe(id)
    }
  })

  it('returns undefined for words it does not know', () => {
    expect(glossaryId('flux capacitor')).toBeUndefined()
    expect(glossaryId('')).toBeUndefined()
  })
})
