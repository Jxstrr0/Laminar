/**
 * The Tarnovian records board (PR 11a). The standing records come from
 * src/data/records.ts; each one the firm breaks is kept on the job's record
 * (`JobRecord.mark`), so the board is rebuilt from the career's history and
 * an old save shows the same board every time.
 */
import { RECORD_IDS, RECORD_RULES, RECORDS, type RecordId } from '../data/records'

/** A record broken on a job: which one, and the new mark (in the record's unit). */
export interface RecordMark {
  record: RecordId
  value: number
}

/** One line of the board as it stands. */
export interface Holding {
  id: RecordId
  /** Who holds it: the standing holder, or the client who broke it. */
  holder: string
  value: number
  /** True once the firm's work broke it (the board shows the firm's name). */
  ours: boolean
  /** The career day it was broken, or null for a standing record. */
  day: number | null
  /** The record it replaced, or null for a standing one. */
  was: { holder: string; value: number } | null
}

/** What the board needs from a finished job. */
interface Marked {
  day: number
  mark?: RecordMark
  /** The client's name for the job. */
  holder: string
}

/** A mark rounded to the precision its unit is measured to. */
export function measured(id: RecordId, value: number): number {
  const scale = RECORD_RULES.scale[RECORDS[id].unit]
  return Math.round(value * scale) / scale
}

/** Whether `value` beats `current` for this record, at the precision it's measured to. */
export function beats(id: RecordId, value: number, current: number): boolean {
  const a = measured(id, value)
  const b = measured(id, current)
  return RECORDS[id].better === 'higher' ? a > b : a < b
}

/** The board: every record in order, the standing one replaced by each mark the firm set, oldest first. */
export function recordBoard(jobs: readonly Marked[]): Holding[] {
  return RECORD_IDS.map((id) => {
    const s = RECORDS[id]
    let held: Holding = { id, holder: s.holder, value: s.value, ours: false, day: null, was: null }
    for (const job of jobs) {
      if (job.mark?.record !== id) continue
      held = { id, holder: job.holder, value: job.mark.value, ours: true, day: job.day, was: { holder: held.holder, value: held.value } }
    }
    return held
  })
}

/** The mark a result on the day sets, or null if it doesn't beat the record as it stands. */
export function claim(board: readonly Holding[], id: RecordId, value: number): RecordMark | null {
  if (!Number.isFinite(value)) return null
  const held = board.find((h) => h.id === id)
  if (!held || !beats(id, value, held.value)) return null
  return { record: id, value: measured(id, value) }
}

/** How many records the firm's work holds now. */
export function recordsHeld(board: readonly Holding[]): number {
  return board.filter((h) => h.ours).length
}
