/**
 * Air at an event: density and viscosity from temperature and altitude.
 * Thinner, warmer air means less drag: the reason hour records chase altitude.
 */
import { ATMOSPHERE } from '../../data/field'
import { detPow } from '../det'

export function pressureAt(altitude: number): number {
  return ATMOSPHERE.seaLevelPressure * detPow(1 - ATMOSPHERE.lapse * altitude, ATMOSPHERE.exponent)
}

/** Air density, kg/m³, for a temperature in °C at an altitude in metres. */
export function densityAt(temperatureC: number, altitude: number): number {
  return pressureAt(altitude) / (ATMOSPHERE.gasConstant * (temperatureC + ATMOSPHERE.kelvin))
}

/** Dynamic viscosity, Pa·s (Sutherland's law). */
export function viscosityAt(temperatureC: number): number {
  const t = temperatureC + ATMOSPHERE.kelvin
  const ratio = t / ATMOSPHERE.temperatureRef
  return (
    ATMOSPHERE.viscosityRef * ratio * Math.sqrt(ratio) * ((ATMOSPHERE.temperatureRef + ATMOSPHERE.sutherland) / (t + ATMOSPHERE.sutherland))
  )
}
