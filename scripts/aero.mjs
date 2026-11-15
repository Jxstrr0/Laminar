// The aero harness: prints the model's numbers for a reference shape.
// Usage: npm run aero -- rider-tt [seed]
// Loads the TypeScript sim through Vite, so nothing needs building first.
import { runnerImport } from 'vite'

const [name = 'rider-tt', seed = '1'] = process.argv.slice(2)
const { module } = await runnerImport('/src/sim/harness.ts')
for (const line of module.harnessReport(name, Number(seed))) console.log(line)
