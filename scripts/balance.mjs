// The balance bot's report (PR 14c): plays whole careers headless and
// prints what a careful player's economy looks like, with flags for briefs
// and sports that look off. See docs/BALANCE.md.
// Usage: npm run balance -- [seeds] [--json out.json]
// Loads the TypeScript sim through Vite, so nothing needs building first.
import { writeFileSync } from 'node:fs'
import { runnerImport } from 'vite'

const args = process.argv.slice(2)
const jsonAt = args.indexOf('--json')
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null
const { module: bot } = await runnerImport('/src/sim/bot.ts')
const { module: data } = await runnerImport('/src/data/bot.ts')
const { module: briefs } = await runnerImport('/src/data/briefs.ts')
const { module: career } = await runnerImport('/src/sim/career.ts')
const seedCount = Number(args.find((a) => /^\d+$/.test(a)) ?? data.BOT.seeds)

const YEAR = 365.25
const START = briefs.CAREER.start.year
const rub = (n) => `${Math.round(n / 1000).toLocaleString('en-CA')}k ₽`
const pct = (n) => `${Math.round(n * 100)}%`
const median = (xs) => {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
const sportOf = (t) => t.setup.sport ?? 'cycling'

// 1. Every brief, shaped once: what a careful player can promise against the client's ask.
const cache = new Map()
const rows = []
console.log('Shaping every brief (the slow part)...')
for (const t of briefs.BRIEFS) {
  let state = career.newCareer(1)
  const brief = { id: t.id, fee: t.fee.min, days: t.days, seed: 1 }
  state = { ...state, job: { brief, promise: 0, startDay: 0, daysLeft: t.days, spent: 0 } }
  const shot = bot.shapeFor(state)
  cache.set(t.id, shot)
  const sport = sportOf(t)
  const cost = bot.modelQuote(sport).price + bot.runsCost('university')
  const mid = (t.fee.min + t.fee.max) / 2
  rows.push({
    id: t.id,
    sport,
    target: t.target,
    mean: shot.practice.mean,
    worst: shot.practice.worst,
    headroom: shot.practice.worst - t.target,
    fee: mid,
    days: t.days,
    perDay: (mid - cost) / t.days,
    minRep: t.minRep ?? 0,
  })
}

console.log('\nBriefs: the client asks for `ask`; the bot can reach `best` on its worst practice day (mean in brackets).')
console.log(`${pad('brief', 20)}${pad('sport', 10)}${lpad('ask', 6)}${lpad('best', 8)}${lpad('(mean)', 9)}${lpad('room', 7)}${lpad('rep', 5)}${lpad('fee', 10)}${lpad('net/day', 10)}`)
for (const r of rows) {
  console.log(
    `${pad(r.id, 20)}${pad(r.sport, 10)}${lpad(r.target, 6)}${lpad(r.worst.toFixed(1), 8)}${lpad(`(${r.mean.toFixed(1)})`, 9)}${lpad(r.headroom.toFixed(1), 7)}${lpad(r.minRep, 5)}${lpad(rub(r.fee), 10)}${lpad(rub(r.perDay), 10)}`,
  )
}

// 2. Whole careers.
console.log(`\nPlaying ${seedCount} careers...`)
const careers = []
for (let seed = 1; seed <= seedCount; seed++) careers.push(bot.playCareer(seed, cache))

const at = (c, year) => {
  const day = (year - START) * YEAR
  let last = null
  for (const j of c.jobs) if (j.day <= day) last = j
  return last ?? { money: briefs.CAREER.startMoney, reputation: 20 }
}
console.log('\nCareers (median over seeds):')
console.log(`${pad('year', 6)}${lpad('cash', 14)}${lpad('reputation', 12)}${lpad('jobs', 7)}`)
for (const year of [2011, 2012, 2015, 2020, 2025, 2030, 2035, 2040]) {
  const cash = median(careers.map((c) => at(c, year).money))
  const rep = median(careers.map((c) => at(c, year).reputation))
  const jobs = median(careers.map((c) => c.jobs.filter((j) => j.day <= (year - START) * YEAR).length))
  console.log(`${pad(year, 6)}${lpad(rub(cash), 14)}${lpad(rep, 12)}${lpad(jobs, 7)}`)
}
const yearOf = (day) => (day === null ? 'never' : (START + day / YEAR).toFixed(1))
const own = careers.map((c) => c.ownTunnel)
const cleared = careers.map((c) => c.clearance)
const allJobs = careers.flatMap((c) => c.jobs)
const won = careers.reduce((s, c) => s + c.bidsWon, 0)
const lost = careers.reduce((s, c) => s + c.bidsLost, 0)
console.log(`Own tunnel bought: median ${yearOf(median(own.filter((d) => d !== null)))} (${own.filter((d) => d !== null).length}/${careers.length} careers)`)
console.log(`Defence clearance: median ${yearOf(median(cleared.filter((d) => d !== null)))} (${cleared.filter((d) => d !== null).length}/${careers.length} careers)`)
console.log(`Bids won ${pct(won / Math.max(1, won + lost))} · promises kept ${pct(allJobs.filter((j) => j.kept).length / Math.max(1, allJobs.length))} · weeks waiting per career ${median(careers.map((c) => c.waits))} · went broke ${careers.reduce((s, c) => s + c.broke, 0)} times in all`)

// 3. Sports: how much of the work and the money each brings.
const sports = {}
for (const j of allJobs) {
  const s = (sports[j.sport] ??= { jobs: 0, paid: 0, spent: 0, days: 0, kept: 0 })
  s.jobs++
  s.paid += j.paid
  s.spent += j.spent
  s.kept += j.kept ? 1 : 0
}
for (const r of rows) if (sports[r.sport]) sports[r.sport].days ??= 0
const daysOf = (id) => briefs.BRIEFS.find((b) => b.id === id).days
for (const j of allJobs) sports[j.sport].days += daysOf(j.id)
console.log('\nSports (all careers):')
console.log(`${pad('sport', 10)}${lpad('jobs', 7)}${lpad('share', 7)}${lpad('kept', 7)}${lpad('net/job', 11)}${lpad('net/day', 10)}`)
const sportRows = Object.entries(sports).map(([sport, s]) => ({ sport, ...s, net: (s.paid - s.spent) / s.jobs, perDay: (s.paid - s.spent) / s.days }))
sportRows.sort((a, b) => b.jobs - a.jobs)
for (const s of sportRows) {
  console.log(`${pad(s.sport, 10)}${lpad(s.jobs, 7)}${lpad(pct(s.jobs / allJobs.length), 7)}${lpad(pct(s.kept / s.jobs), 7)}${lpad(rub(s.net), 11)}${lpad(rub(s.perDay), 10)}`)
}

// 4. Flags: what looks off.
const flags = []
for (const r of rows) {
  if (r.worst < r.target) flags.push(`${r.id} (${r.sport}): the bot can't reach the ask (${r.target}) on its worst day (${r.worst.toFixed(1)}).`)
  else if (r.headroom > Math.max(3, r.target)) flags.push(`${r.id} (${r.sport}): easy: the bot beats the ask (${r.target}) by ${r.headroom.toFixed(1)} on its worst day.`)
}
const dayRates = rows.map((r) => r.perDay)
const mid = median(dayRates)
for (const r of rows) {
  if (r.perDay > 2.5 * mid) flags.push(`${r.id} (${r.sport}): pays ${rub(r.perDay)} a day after costs, over 2.5× the median brief (${rub(mid)}).`)
  if (r.perDay < 0.3 * mid) flags.push(`${r.id} (${r.sport}): pays ${rub(r.perDay)} a day after costs, under 0.3× the median brief (${rub(mid)}).`)
}
const seen = new Set(allJobs.map((j) => j.id))
for (const t of briefs.BRIEFS) if (!t.tutorial && !seen.has(t.id)) flags.push(`${t.id} (${sportOf(t)}): never taken in ${careers.length} careers.`)
const endCash = median(careers.map((c) => c.final.money))
if (endCash > 20 * 2_000_000) flags.push(`Cash piles up: the median career ends 2040 with ${rub(endCash)}, with nothing left to buy.`)
if (careers.some((c) => c.broke > 0)) flags.push(`${careers.filter((c) => c.broke > 0).length} of ${careers.length} careers went broke at least once.`)
console.log(`\nFlags (${flags.length}):`)
for (const f of flags) console.log(`- ${f}`)

if (jsonOut) {
  const out = { seeds: seedCount, briefs: rows, sports: sportRows, careers: careers.map(({ final: _f, ...c }) => c), flags }
  writeFileSync(jsonOut, JSON.stringify(out, null, 1))
  console.log(`\nWrote ${jsonOut}`)
}
