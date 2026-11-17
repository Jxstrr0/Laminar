/**
 * Design codes (PR 11h): a challenge as one line of text, to send to a
 * friend.
 *
 *   LAMD1:<flag><body>.<check>
 *
 * Built like a save code (src/persist/code.ts). The body holds the
 * delivered design, the brief, the career's seed and day, and the firm's
 * name. Nothing else from the career goes in it: no money, history or saves.
 */
import { CHALLENGE, DESIGN_CODE_PREFIX } from '../data/challenge'
import { briefTemplate, tidyFirmName } from '../sim/career'
import { challengeable, type Challenge } from '../sim/challenge'
import { sportOf } from '../sim/design'
import { unwrapText, wrapText } from './code'
import { soundBrief, soundDesign } from './save'

export type ChallengeError = 'prefix' | 'check' | 'damaged' | 'newer' | 'unknown'

export type DecodedChallenge = { ok: true; challenge: Challenge } | { ok: false; error: ChallengeError }

const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0

export async function encodeChallenge(c: Challenge): Promise<string> {
  const body = { v: CHALLENGE.version, brief: c.brief, seed: c.seed, day: c.day, design: c.design, firm: c.firm }
  return wrapText(DESIGN_CODE_PREFIX, JSON.stringify(body))
}

/** A challenge the game could have written, or null. */
export function soundChallenge(x: unknown): Challenge | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  const brief = soundBrief(o.brief)
  const design = soundDesign(o.design)
  if (!brief || !design || !challengeable(brief.id)) return null
  // The design must be for the brief's sport: a ski jumper can't ride a time trial.
  if (sportOf(design) !== sportOf(briefTemplate(brief.id)!.setup)) return null
  if (!isCount(o.seed) || o.seed > 0xffffffff || !isCount(o.day)) return null
  if (typeof o.firm !== 'string') return null
  const firm = tidyFirmName(o.firm)
  if (!firm) return null
  return { brief, seed: o.seed, day: o.day, design, firm }
}

export async function decodeChallenge(input: string): Promise<DecodedChallenge> {
  const open = await unwrapText(DESIGN_CODE_PREFIX, input)
  if (!open.ok) return open
  let body: unknown
  try {
    body = JSON.parse(open.text)
  } catch {
    return { ok: false, error: 'damaged' }
  }
  const v = (body as { v?: unknown } | null)?.v
  if (typeof v === 'number' && v > CHALLENGE.version) return { ok: false, error: 'newer' }
  if (v !== CHALLENGE.version) return { ok: false, error: 'damaged' }
  const challenge = soundChallenge(body)
  // A sound code for a job this Laminar doesn't have (or can't challenge) is "unknown", not damaged.
  if (!challenge) {
    const id = (body as { brief?: { id?: unknown } }).brief?.id
    return { ok: false, error: typeof id === 'string' && !challengeable(id) ? 'unknown' : 'damaged' }
  }
  return { ok: true, challenge }
}
