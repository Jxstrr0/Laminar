# Balance

The balance bot (PR 14c) plays whole careers headless, so the economy can be
checked across many seeds without anyone playing for thirty game years.

```
npm run balance              # 8 careers (BOT.seeds), about 8 minutes
npm run balance -- 20        # more careers
npm run balance -- 4 --json out.json   # also write the numbers as JSON
```

It changes nothing in the game. Its habits live in `src/data/bot.ts`; the
player is `src/sim/bot.ts`; the report is `scripts/balance.mjs`.

## How the bot plays

It plays like a careful player whose tunnel tells the truth:

- **Shaping.** It starts from the client's setup and tries 60 designs at
  random: half with about half the sliders moved (some briefs have a gate, like
  the stall check, that only clears when two parts change together), half with
  every slider moved (to look past a cliff like the sound barrier). Then it
  nudges every slider up and down, tries every pick and flips every flag,
  keeping whatever lifts its worst practice day (then the mean). Practice days
  are made-up event days, never the real one, so it can't see race day's
  weather. It keeps to the rule box, as the game now makes everyone do.
- **Bidding.** It goes for the board's best profit per day first (the fee less
  a model and the runs), promises its
  worst practice day less half a point, asks halfway up the fee range, and
  passes on a brief it couldn't promise a point on.
- **The work.** Each job pays for a model (the family's usual scale, sanded,
  standard grade) and eight four-minute runs at 30 m/s, at the rates of
  whichever tunnel it uses.
- **Spending.** It builds its own tunnel once that leaves ₽300,000 in hand,
  and applies for defence clearance whenever it may. It hires nobody, buys no
  machines or upgrades and starts no R&D: their worth is in better tunnel
  work, which the bot already gets for free.
- **Declaring.** It declares the mean of its practice days.

So the bot is a ceiling: a strong player who never misreads the tunnel. Real
players will find less of each cut and read the road less well.

## What the report shows

1. **Briefs:** each brief's ask against the cut the bot reaches on its worst
   practice day (the mean in brackets), the room between them, the
   reputation the client needs, the middle fee and the fee per day after a
   job's model and runs at the university.
2. **Careers:** the median cash, reputation and jobs done by year.
3. **When:** the year the bot bought its tunnel and got clearance; the share
   of bids won and promises kept; weeks spent waiting; times broke.
4. **Sports:** each sport's share of the work, promises kept, and net pay
   per job and per day.
5. **Flags:** briefs the bot can't reach or beats by a mile, briefs that pay
   far over or under the median per day, briefs never taken, and cash piling
   up.

## First run (17 November 2026, 8 careers, v0.15.2.0)

| Year | Cash | Reputation | Jobs |
| --- | --- | --- | --- |
| 2011 | ₽1.6M | 100 | 16 |
| 2012 | ₽2.2M | 100 | 30 |
| 2015 | ₽8.9M | 100 | 74 |
| 2020 | ₽22M | 100 | 146 |
| 2030 | ₽49M | 100 | 286 |
| 2040 | ₽78M | 100 | 429 |

Own tunnel bought around 2011; clearance applied for in 2010. Bids won 96%,
promises kept 99%, never broke.

### What it found, and what Kelbo decided

1. **Reputation climbed far too fast.** A kept promise (+6) and a good read
   (+4) added 10 a job, so a strong player went from 20 to 100 in about eight
   jobs: every client (the top needs 85) and defence clearance (60) opened in
   the first year. *Kelbo: about three years. Every reputation gain and loss
   is now about a sixth of what it was (PR 14d).*
2. **The asks were easy, so bids weren't a contest.** On its worst practice
   day the bot beats almost every ask by 5 to 25 points, and the rivals
   promised the ask plus a point or two. *Kelbo: bolder rivals. Bystro now
   promises the ask plus 3 to 8, Vysota plus 2 to 6, Vershina plus 2 to 5,
   Bereg plus 3 to 7 (PR 14d).*
3. **The military pods and the jets paid three to five times as much a
   day.** *Kelbo: 20% off their fees (PR 14d).*
4. **The small brief lost money at the university.** A 1:2 model (₽52k) and
   eight runs cost more than its ₽35–50k fee. *Kelbo: ₽25k more (PR 14d). With
   a 1:2 model it still only breaks even at the university; a cheap 1:4
   printed model makes it pay.*
5. **Cash piles up** (about ₽78M by 2040). *Kelbo: keep it, it's a score.*
6. **Bug: an illegal cyclist or bobsled could be delivered.** *Fixed in PR
   14d: the Deliver sheet says the design breaks the rules and Shape lists
   what to change.*
7. ~~The Proryv jet's ask is out of reach.~~ Wrong: the first bot got stuck
   short of the sound barrier. A pinched waist and a long nose take it through
   (the bot now finds 89 km/h against the ask of 54), so the ask stays.

## After PR 14d (17 November 2026, 8 careers, v0.15.3.0)

The same bot (with the wider scouting and worst-day shaping) on the old and
the new numbers:

| | Before | After |
| --- | --- | --- |
| Reputation 85 (every client) | mid-2010 | early 2013 |
| Defence clearance applied for | 2010 | late 2011 |
| Cash in 2012 | ₽2.3M | ₽1.1M |
| Cash in 2040 | ₽85M | ₽71M |
| Bids won | 100% | 92% |
| Pods, net per day | ₽16k | ₽13k |
| Jets, net per day | ₽11–13k | ₽8–10k |

Remember the bot is a ceiling: a player who misreads the tunnel loses more
bids and climbs slower.
