/** Number formatting for readouts (Canadian English). */
const LOCALE = 'en-CA'

export function fixed(value: number, digits: number): string {
  return value.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })
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
