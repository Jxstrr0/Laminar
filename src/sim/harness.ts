/**
 * The aero harness (plan section 14, PR 1): a plain-text report for a
 * reference shape, so the model can be checked by eye from a terminal with
 * `npm run aero -- <shape>`. Not part of the game build.
 */
import { HOODS_POSITION, TT_POSITION } from '../data/rider'
import { UNIVERSITY_TUNNEL } from '../data/tunnel'
import { STANDARD_MODEL } from '../data/model'
import { describeShape, type ShapeSpec } from './geom/body'
import { referenceRider } from './geom/rider'
import { box, sphere } from './geom/shapes'
import { Rng } from './rng'
import { fieldResult, REFERENCE_TT, truth, tunnelReading } from './views'

export const HARNESS_SHAPES: Record<string, () => ShapeSpec> = {
  sphere: () => ({ bodies: [sphere('sphere', 0.25)] }),
  'rider-tt': () => referenceRider(TT_POSITION),
  'rider-hoods': () => referenceRider(HOODS_POSITION),
  van: () => ({ bodies: [box('van', 5, 2, 2.4, 0.15)] }),
}

const f = (n: number, d = 4) => n.toFixed(d)

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds - m * 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/** The report for one shape, as lines of text. */
export function harnessReport(name: string, seed = 1): string[] {
  const make = HARNESS_SHAPES[name]
  if (!make) return [`Unknown shape "${name}". Try: ${Object.keys(HARNESS_SHAPES).join(', ')}`]
  const spec = make()
  const shape = describeShape(spec)
  const t = truth(spec, REFERENCE_TT)
  const out = [
    `${name}: frontal area ${f(shape.frontalArea)} m²`,
    `Truth (full size, event air): CdA ${f(t.cdA)} m², wind-averaged ${f(t.windAveragedCdA)} m²`,
    'Yaw  CdA     CyA',
  ]
  for (let i = 0; i < t.curve.yawsDeg.length; i++) {
    const yaw = t.curve.yawsDeg[i]!
    if (yaw < 0 || yaw % 5 !== 0) continue
    out.push(`${String(yaw).padStart(3)}  ${f(t.curve.cdA[i]!)}  ${f(t.curve.cyA[i]!)}`)
  }
  const rng = new Rng(seed)
  const model = { ...STANDARD_MODEL, seed }
  out.push(`Tunnel, 1:${Math.round(1 / model.scale)} model, ${model.finish} finish:`)
  for (const speed of [10, 20, 30, 40]) {
    const r = tunnelReading(spec, model, UNIVERSITY_TUNNEL, { speed, yawDeg: 0 }, rng.fork(`run-${speed}`))
    out.push(`  ${String(speed).padStart(2)} m/s  Re ${r.reynolds.toExponential(2)}  CdA ${f(r.cdA)} m² (full-size equivalent)`)
  }
  const day = fieldResult(spec, REFERENCE_TT, seed)
  out.push(
    `Field, 40 km TT (seed ${seed}): ${clock(day.time)}, ${f(day.temperature, 1)} °C, wind ${f(day.windSpeed, 1)} m/s from ${Math.round(day.windFromDeg)}°, ${Math.round(day.power)} W`,
  )
  return out
}
