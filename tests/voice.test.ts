// The voice pack (PR 14b): every line has its file, every cue reaches a real line, and nobody speaks out of turn.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRIEFS } from '../src/data/briefs'
import { ANALYST_LINES, CLIENT_LINES, CLIENT_VOICE, COMM_BIG_WIN, COMM_LINES, TECH_LINES, VOICE_LINES } from '../src/data/voice'
import { boldPromise, commLineFor, lineForCue, roadAgreed } from '../src/audio/cues'

const sheet = readFileSync(new URL('../docs/voice/lam-voice-pack-v1.csv', import.meta.url), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((row) => row.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')))

describe('voice pack', () => {
  it('has all 62 lines from the script sheet, picked, each with its file in public/voice', () => {
    expect(sheet).toHaveLength(62)
    for (const row of sheet) {
      const [id, , , character, , text, , , , file, , , status, gen] = row
      const line = VOICE_LINES[id!]
      expect(line, id).toBeDefined()
      expect(line!.speaker).toBe(character)
      expect(line!.file).toBe(file)
      expect(line!.text).toBe(text!.replace(/\[[a-z ]+\]\s*/g, '').trim())
      expect(status).toBe('picked')
      expect(gen).toMatch(/^\w{10,}$/)
      expect(existsSync(new URL(`../public/voice/${file}`, import.meta.url)), file).toBe(true)
    }
  })

  it('reaches a real line of the right speaker from every cue, and leaves no line unused', () => {
    const used = new Set<string>()
    const check = (map: Record<string, Record<string, string>>) => {
      for (const [speaker, cues] of Object.entries(map))
        for (const id of Object.values(cues)) {
          expect(VOICE_LINES[id]?.speaker, id).toBe(speaker)
          used.add(id)
        }
    }
    check(TECH_LINES)
    check(ANALYST_LINES)
    check(CLIENT_LINES)
    for (const id of [...Object.values(COMM_LINES), COMM_BIG_WIN]) {
      expect(VOICE_LINES[id]?.speaker, id).toBe('comm')
      used.add(id)
    }
    expect([...used].sort()).toEqual(Object.keys(VOICE_LINES).sort())
  })

  it('gives every brief a client voice', () => {
    for (const b of BRIEFS) expect(CLIENT_VOICE[b.id], b.id).toMatch(/^(boss|engineer)$/)
  })

  it('only lets staff speak once they are hired', () => {
    const none = { tech: null, analyst: null, brief: null }
    expect(lineForCue('fanStart', none)).toBeNull()
    expect(lineForCue('noise', none)).toBeNull()
    expect(lineForCue('fanStart', { ...none, tech: 'basov' })).toBe('LAM-BASOV-0001')
    expect(lineForCue('break', { ...none, tech: 'krasna' })).toBe('LAM-KRASNA-0008')
    expect(lineForCue('noise', { ...none, analyst: 'zhelin' })).toBe('LAM-ZHELIN-0003')
    // A maker on the tech's line says nothing (model makers have no voice).
    expect(lineForCue('fanStart', { ...none, tech: 'orlik' })).toBeNull()
  })

  it('gives the client the voice their brief has', () => {
    const cast = { tech: null, analyst: null }
    expect(lineForCue('brief', { ...cast, brief: null })).toBeNull()
    expect(lineForCue('kept', { ...cast, brief: 'brusnik-hill' })).toBe('LAM-CLIENT-0004')
    expect(lineForCue('kept', { ...cast, brief: 'selivan-regional' })).toBe('LAM-CLIENT-0009')
  })

  it('splits halfway by who leads, and calls a big win at the finish', () => {
    expect(commLineFor('ride', 'half', { ahead: true })).toBe('LAM-COMM-0003')
    expect(commLineFor('ride', 'half', { ahead: false })).toBe('LAM-COMM-0004')
    // Drag-judged and fuel-judged jobs get their own finish; the timed ones keep "Let's see the time".
    expect(commLineFor('ride', 'finish', { gain: 0.001 })).toBe('LAM-COMM-0017')
    expect(commLineFor('truck', 'finish', { gain: 0.001 })).toBe('LAM-COMM-0018')
    expect(commLineFor('car', 'finish', { gain: 0.001 })).toBe('LAM-COMM-0006')
    expect(commLineFor('car', 'finish', { gain: 0.05 })).toBe(COMM_BIG_WIN)
    expect(commLineFor('pod', 'buffet')).toBeNull()
  })

  it('judges a bold promise and a close read', () => {
    expect(boldPromise(5, 5)).toBe(false)
    expect(boldPromise(6, 5)).toBe(true)
    expect(roadAgreed(0.01)).toBe(true)
    expect(roadAgreed(-0.05)).toBe(false)
  })
})
