/** Number formatting for readouts (Canadian English). */
const LOCALE = 'en-CA'

export function fixed(value: number, digits: number): string {
  return value.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** A promise in points: whole numbers plain, half points with one decimal (10 → "10", 10.5 → "10.5"). */
export function pct(value: number): string {
  return fixed(value, Number.isInteger(value) ? 0 : 1)
}

/** A big number like a Reynolds number: 678 000 → "6.78 × 10⁵". */
export function scientific(value: number): string {
  if (value <= 0 || !Number.isFinite(value)) return '0'
  const exp = Math.floor(Math.log10(value))
  const mant = value / 10 ** exp
  const sup = String(exp)
    .split('')
    .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)] ?? c)
    .join('')
  return `${fixed(mant, 2)} × 10${sup}`
}

/** Money: 98500 → "₽ 98,500"; below zero "−₽ 4,200". */
export function rubles(value: number): string {
  const r = Math.round(value)
  return `${r < 0 ? '−' : ''}₽\u00a0${fixed(Math.abs(r), 0)}`
}

/** Money in a few characters for a chip: "₽98.5k", "₽120k", "₽850". */
export function rublesShort(value: number): string {
  const a = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (a < 1000) return `${sign}₽${fixed(a, 0)}`
  const k = a / 1000
  return `${sign}₽${fixed(k, k < 100 ? 1 : 0).replace(/\.0$/, '')}k`
}

/** A career day as a date: 0 → "Mar 1, 2010". */
export function careerDate(day: number, start: { year: number; month: number; day: number }): string {
  const when = new Date(Date.UTC(start.year, start.month - 1, start.day + day))
  return when.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** A race time: 3725.4 s → "1:02:05". */
/** A short span of race time: "16 s" under a minute, else as `raceTime`. */
export function shortTime(seconds: number): string {
  return Math.round(seconds) < 60 ? `${Math.round(seconds)}\u00a0s` : raceTime(seconds)
}

export function raceTime(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
