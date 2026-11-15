/**
 * Air properties. Real values, used as they are.
 *
 * PR 1 adds temperature, altitude and humidity; for now the tunnel breathes
 * standard sea-level air at 15 °C.
 */
export const AIR = {
  /** Density in kg/m³ (ISA sea level, 15 °C). */
  density: 1.225,
  /** Dynamic viscosity in Pa·s (15 °C). */
  viscosity: 1.81e-5,
} as const
