# Balance

The balance bot (PR 14c) plays whole careers headless, so the economy can be
checked across many seeds without anyone playing for thirty game years.

```
npm run balance              # 8 careers (BOT.seeds), about 6 minutes
npm run balance -- 20        # more careers
npm run balance -- 4 --json out.json   # also write the numbers as JSON
```

It changes nothing in the game. Its habits live in `src/data/bot.ts`; the
player is `src/sim/bot.ts`; the report is `scripts/balance.mjs`.

## How the bot plays

It plays like a careful player whose tunnel tells the truth:

- **Shaping.** It starts from the client's setup and tries about 40 designs
  with half the sliders set at random (some briefs have a gate, like the stall
  check, that only clears when two parts change together), then nudges every
  slider up and down, tries every pick and flips every flag, keeping whatever
  helps. It judges each design on three practice days, made-up event days,
  never the real one, so it can't see race day's weather. It keeps to the rule
  box: the cycling and sliding federations' rules (cars and trucks are trimmed
  by the scrutineers and the road code anyway).
- **Bidding.** It goes for the board's best fee per day first, promises its
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

### What looks off

1. **Reputation climbs far too fast.** A kept promise (+6) and a good read
   (+4) add 10 a job, so a strong player goes from 20 to 100 in about eight
   jobs: every client in the game (the top needs 85) and defence clearance
   (60) open inside the first year.
2. **The asks are easy, so bids aren't a contest.** On its worst practice day
   the bot beats almost every ask by 5 to 25 points. The rivals promise the
   ask plus a point or two, so a strong player wins 96% of bids.
3. **The military pods and the jets pay three to five times as much a day.**
   The pods net about ₽16k a day and the jet record cars ₽9–13k, against a
   median brief's ₽3k. With reputation open early, they take over the career.
4. **Small briefs lose money at the university.** A 1:2 model (₽52k) and
   eight runs (about ₽22k) cost more than a ₽35–60k fee. The small brief that
   is always on the board is a trap for a new firm, unless the player knows to
   order a cheap 1:4 printed model.
5. **Cash piles up.** The median career ends 2040 with about ₽78M, nearly
   forty times the price of your own tunnel, with nothing left to buy.
6. **The Proryv jet's ask is out of reach.** It asks for 54 km/h; the bot
   reaches about 36 on its worst day, so the brief is never taken.
7. **Bug: an illegal cyclist or bobsled can be delivered.** The plan says you
   can't deliver an illegal design, but only cars and trucks are trimmed on
   the day; a cyclist or sled outside the rule box races and gets paid.

Fixes are Kelbo's call; they'll be listed here as they land.
