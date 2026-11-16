# Laminar: status

Where the build stands against `docs/LAMINAR-PLAN.md` section 14.

| PR | Scope | State |
| --- | --- | --- |
| 0 | Scaffold, CI, deploy, loading screen, brand, look, address, grey tunnel with a sphere and a fan | **Done** (v0.1.0.0) |
| 1a | Aero sim core, part 1: shape descriptors and drag (friction with transition, separation, front corners, interference, cavities); the sphere's drag crisis in the tunnel | **Done** (v0.2.0.0) |
| 1b | Aero sim core, part 2: lift, stall, induced drag, ground effect, yaw forces | **Done** (v0.2.1.0) |
| 1c | Aero sim core, part 3: truth / tunnel / field split, reference rider, node harness | **Done** (v0.2.2.0) |
| 2a | Shaping, part 1: the cyclist as numbers (posture, helmet, suit, bars, wheels, frame), comfort and power, TCF rule checks, readouts, desk estimate | **Done** (v0.3.0.0) |
| 2b | Shaping, part 2: the Shape screen (3D rider and bike from the design, slider sheet, readouts, comfort meter, rule breaks with a "change this" jump), Shape / Tunnel switch | **Done** (v0.3.1.0) |
| 2c | Shaping, part 3: drag handles, the rule box drawn in 3D, glossary and tooltips | **Done** (v0.3.2.0) |
| 3a | The tunnel, part 1: your design on the yaw turntable at 1:2, live balance readouts (model drag, side force, full-size CdA), Sphere / Your rider switch | **Done** (v0.3.3.0) |
| 3b | The tunnel, part 2: runs (fan-up to fan-down), run billing, live force charts | **Done** (v0.3.4.0) |
| 3c | The tunnel, part 3: run history with A/B compare and noise bands | **Done** (v0.3.5.0) |
| 3d | The tunnel, part 4: smoke wand and rake, tufts round the rider | **Done** (v0.3.6.0) |
| 4a | Correlation, part 1: the tunnel's hidden quirks (blockage, turbulent air, mount drag), tare runs, sphere calibration against the book, corrections on the rider's CdA | **Done** (v0.4.0.0) |
| 4b | Correlation, part 2: static legs (crank-angle runs and the pedalling average), repeat runs pooled | **Done** (v0.4.1.0) |
| 4c | Correlation, part 3: static wheels and a known-wheel calibration | **Done** (v0.4.2.0) |
| 4d | Correlation, part 4: model shop (scale, finish, accuracy), the Reynolds trap and trip strips | **Done** (v0.4.3.0) |
| 4e | Correlation, part 5: pressure taps and the Cp map | **Done** (v0.4.4.0) |
| 5a | Contracts, part 1: the lab's state lifted out of the tunnel, and autosave (one slot) | **Done** (v0.5.0.0) |
| 5b | Save slots, save code (`LAM1:`) and a Saves sheet | **Done** (v0.5.1.0) |
| 5c | Briefs, money and the job clock: the Jobs screen, runs and models charged, days spent, deliver and get paid | **Done** (v0.5.2.0) |
| 5d | The model follows the design: parts swap for a fee, a new position needs a new model (Kelbo's call) | **Done** (v0.5.3.0) |
| 5e | Promise and prediction, the debrief, payment and penalties | **Done** (v0.5.4.0) |
| 5f | Sealed bids against a rival firm | **Done** (v0.5.5.0) |
| 5g | Time-trial replay | **Done** (v0.5.6.0) |
| 5h | Velodrome | **Done** (v0.5.7.0) |
| 5i | Guided first job | **Done** (v0.5.8.0) |
| 6a | Failures: the tunnel's failure model (sim, saves) | **Done** (v0.6.0.0) |
| 6b | Failures on the tunnel screen | **Done** (v0.6.1.0) |
| 6c | Failures in the field: crosswind steer, fading position | **Done** (v0.6.2.0) |
| 6d | Field failures in the 3D replay: the wobble in a gust, the rider sitting up | **Done** (v0.6.3.0) |
| 7a | Reputation and correlation score: bigger clients and close bids for a good name | **Done** (v0.7.0.0) |
| 7b | The named rivals, Bystro Aero and Vysota Aerolab | **Done** (v0.7.1.0) |
| 7c | Your own tunnel: save up and build it (cash only), 90 days, cheap runs and daily upkeep | **Done** (v0.7.2.0) |
| 7d | Tunnel upgrades: turbulence screens, bigger turntable, wheel-drive rig, bigger fan | **Done** (v0.7.3.0) |
| 7e | Workshop chain: FDM printer, resin printer, CNC mill | **Done** (v0.7.4.0) |
| 7f | Staff with traits, paid per day that passes | **Done** (v0.7.5.0) |
| 7g | Going broke: the soft landing | **Done** (v0.7.6.0) |
| 7h | Backup file and reminder | Next |
| 7i–14 | See the plan (2040 ending, then PRs 8–14) | Not started |

## Versions

- **0.7.6.0** (PR 7g): going broke, the soft landing.
  - If a job leaves cash below zero, kit is sold for half what it cost,
    cheapest first, until cash is back above zero. Your own tunnel goes
    only once every machine and upgrade has, and then runs are back in the
    university's tunnel.
  - Staff stay. Reputation drops 5. There is no game over: small briefs
    are always on the board.
  - The race-day debrief shows a "Cash ran out" box with what was sold.
- **0.7.5.0** (PR 7f): staff.
  - A Staff card on the Jobs screen: one person per role (model maker,
    tunnel tech, analyst), two to choose from in each, three at most.
  - Each is paid their wage for every day that passes, job or not, and
    stays until you let them go (nobody gets poached). Wages show on the
    race-day debrief.
  - Model makers make models and repairs quicker (Daria Orlik) or cheaper
    (Bogdan Venko). Tunnel techs halve the balance's scatter (Timur Basov)
    or make the mount posts hold 40 % more (Lidiya Krasna). Analysts
    narrow the desk estimate (Artyom Zhelin a lot, Milena Sorokova a little).
- **0.7.4.0** (PR 7e): the workshop.
  - A Workshop card on the Jobs screen sells three machines for cash:
    - an FDM printer (₽120k): cheap, any scale, rough and a little bendy;
    - a resin printer (₽220k): quick and smooth, 1:4 and 1:3 only, brittle;
    - a CNC mill (₽900k): aluminium, twice as true to size and stiff.
  - The model shop gains a "Made by" row for the outside shop and any
    machine you own. Your own machines make models for a share of the
    shop's price and days; options a machine can't do are greyed out.
  - Material matters in the tunnel: resin parts flutter sooner, aluminium
    later.
- **0.7.3.0** (PR 7d): upgrades for your own tunnel.
  - Once your tunnel is open, its card lists four upgrades, each paid in
    cash and fitted over some days while you keep working:
    - turbulence screens (₽180k, 14 days): calmer air;
    - a bigger turntable (₽120k, 10 days): yaw out to ±30°;
    - a wheel-drive rig (₽350k, 21 days): the wheels spin, so no
      static-wheel correction is needed;
    - a bigger fan (₽600k, 30 days): top speed 55 m/s.
  - The tunnel screen's fan and yaw sliders, the yaw chart and the model
    shop's speed check follow whatever is fitted.
- **0.7.2.0** (PR 7c): your own tunnel.
  - The Jobs screen has a "Your own tunnel" card: ₽2,000,000, cash only.
    Pay (two taps) and it's built over 90 days while you keep working in
    the university's tunnel.
  - Once it opens, runs cost power only (₽500 a kWh, no run fee), its air
    is calmer and its mount cleaner, and upkeep (₽400 a day) is paid for
    every day that passes. The debrief shows the upkeep.
  - Its quirks are its own: the tunnel screen says "Your tunnel" and only
    runs made there count towards its tare and calibration.
- **0.7.1.0** (PR 7b): the named rivals.
  - Bystro Aero bids on every paid brief: cheap, and it promises big.
    Vysota Aerolab only bids on the big jobs (top fee ₽120k or more), at a
    high price, with a big name behind it.
  - The Jobs screen lists both under "Rival firms", with their reputation
    and correlation score (they move a little each week). Each brief says
    who else is bidding.
  - The bids sheet shows every firm's price, promise, reputation and value,
    and names the firm that won if it wasn't you.
- **0.7.0.0** (PR 7a): reputation and correlation score.
  - The Jobs screen shows your reputation (out of 100, starting at 20) and
    your correlation score: how close your predictions came to the road over
    the last five jobs (100 is spot on, 0 is 10 % off or worse).
  - Keeping a promise and a close read raise your name; a missed promise
    costs more the further you fell short.
  - The coast, pursuit and national championship clients only call once your
    name is big enough (25, 35 and 45).
  - In sealed bids, every 50 reputation counts as a point of promised cut,
    so a better-known firm wins close bids. The debrief shows the change.
- **0.6.3.0** (PR 6d): race-day trouble in the 3D replay.
  - On a stretch where the rider eased off in the gusts, they rock side to
    side every couple of seconds (more the harder they fought it). The old
    setup rocks too if it struggled, out of step with yours. With reduced
    motion, nobody rocks.
  - Once a rider can't hold the position, they're drawn sitting up for the
    rest of the race: back up, head up.

- **0.6.2.0** (PR 6c): trouble on race day.
  - **Crosswind steer** (Kelbo's call: loses time in gusts). In a gust, side
    force ahead of the rider's balance point turns the bike. Past what the
    rider can hold (more for a heavier rider), they ease off for the gust:
    never a stop. A deep front wheel is touchy on a windy day and a disc
    front is a real handful; a disc at the back steadies the bike. Indoors
    there's no wind, so no steer.
  - **Unholdable position** (Kelbo's call: fades in the last third). Past
    the comfort limit, the rider sits up for the last third and loses power,
    so the drag saved comes back as lost time. It's now slower than the
    best position the rider can hold.
  - The debrief says how much time each cost, with a "change this" jump
    to the front wheel or to the position slider that strains most. It
    also says when the client's old setup lost time in the gusts.
  - The replay commentator calls the gust and the moment the rider sits
    up. The promise is still checked on road CdA, so trouble costs time,
    not the fee.

- **0.6.1.0** (PR 6b): failures you can see in the tunnel.
  - Push a weak part too hard and a red warning flashes at the top ("The
    tail is fluttering!") while the model buzzes and the readings jitter.
    Ease the fan or the yaw and it calms down.
  - Hold it there and the part breaks: the tail, the disc cover or the
    helmet flies down the tunnel and lands by the end screen, or the whole
    model tears off its posts.
  - A sheet says what broke, why, and the repair price and days. Repair
    from the sheet or the red note at the top, or jump straight to the part
    on the Shape screen (or the model shop) to change it.
  - The fan is locked on a broken model; the run that broke it shows
    "broke" in the runs list.

- **0.6.0.0** (PR 6a): the tunnel's failure model, under the hood.
  - Kelbo's calls: a broken model is repaired for half its price and half its
    build days (plus the screens if it tore off the mount); the tunnel always
    warns before a break.
  - Weak points on a rider model: a long aero-helmet tail and a disc wheel's
    cover can flutter (bigger and printed models flutter sooner); the mount's
    posts take at most 60 N; a printed model's glued helmet lets go past
    36 m/s.
  - A part past its limit for a moment is forgiven; held there for a couple of
    seconds, it breaks.
  - Saves remember a broken model and which run broke it. Nothing shows on
    screen yet: that's PR 6b.

- **0.5.8.0** (PR 5i): the guided first job.
  - **Irina Talova**, your partner, has a card at the top of Jobs during the
    first job: one line on what to do next, and a seven-step checklist
    (bid, model her setup, run it, shape, model your design, run it,
    deliver).
  - Each step ticks when you really do it, and the button that does it
    glows (a still outline with reduced motion).
  - "Hide the guide" (two taps) hides it for that career; it goes on its
    own after the first delivery. Older saves that already delivered never
    see it.

- **0.5.7.0** (PR 5h): the velodrome.
  - A new brief: **Alina Vesnina**, a track pursuiter, riding the 4 km
    individual pursuit at the indoor **Stavren Velodrome**. Still air, so
    her promise is about drag straight on; she already rides deep and disc
    wheels and a sloping position, so the cut is harder to find (−5 %).
  - The track is a 250 m oval (two straights, two bends), 16 laps. Brief
    cards say "Indoors" for the wind.
  - The replay on the track uses a broadcast camera high over the end of the
    oval, so the whole lap fits a phone held upright. Rings under the riders
    (cobalt for yours, grey for the old setup) make them easy to spot.
  - The readout counts laps ("Lap 9 of 16") and says "Still air"; the
    commentator rings the bell for the last lap. The strip ticks each lap.

- **0.5.6.0** (PR 5g): race day plays out.
  - After "Lock it in and race", a short 3D replay (about 22 seconds) shows
    the time trial: your design on the road, the client's old setup as a
    see-through twin in the next lane, wind flags on the verge, a chase
    camera that swings round at the turn.
  - A live readout gives the race clock, distance, speed, the wind (head,
    cross or tail, with the yaw angle) and the gap to the old setup in
    seconds, plus a strip with both riders as dots.
  - The commentator speaks at the start, the turn, halfway, when you meet
    the old setup still heading out, and at the finish.
  - At the line it shows your prediction next to what the road read, then
    **See the debrief**. **Skip** goes straight there, and the debrief has
    **Watch the replay**.
  - Every number comes from the same field result as the debrief; nothing is
    re-run.

- **0.5.5.0** (PR 5f): sealed bids.
  - **Bid for this job…** opens a sheet: your price (inside the brief's fee
    range, ₽1,000 steps) and your promise (half-point steps). Brief cards
    show the fee range.
  - One unnamed rival firm bids too (the named rivals come in PR 7). The
    client counts each promised point as worth 8 % of the middle fee, the
    same share a missed point costs you, plus how far your price is under
    the top of the range. The higher value wins; a tie goes to you.
  - The bids are opened at once: both prices, both promises and both
    values, so you can see why you won or lost.
  - Win: the client's setup goes on the bench, at your price and promise.
    Lose: that brief goes and another comes in while any are left. If the
    rival takes them all, **Wait a week for new briefs** brings a new board.
  - Marta Selivan, the first job, asks for your firm by name: no rival.

- **0.5.4.0** (PR 5e): delivering a job is a real test now.
  - Each brief carries a **promise**: cut the client's drag by a set share
    against their old setup (10 % for Marta Selivan, 2 % for the national
    rider). Job cards show it.
  - **Deliver…** opens a sheet: you say what the road will read (the design's
    wind-averaged CdA, full size), prefilled from the desk estimate, with
    −/+ steppers. Then "Lock it in and race".
  - On race day both setups are ridden in that day's air and wind. Half a
    point short is forgiven; each point beyond costs 8 % of the fee, half the
    fee at most.
  - The **debrief** says kept or missed, the time against the old setup,
    your prediction against the road CdA, how close your read was
    (good within 2 %), the penalty and what you were paid, and why: the
    design itself, or just the day.
  - Every delivered job goes into the firm's history (for reputation later).

- **0.5.3.0** (PR 5d): the tunnel model is a real thing now (Kelbo's
  "parts swap, position re-orders").
  - The model on the mount keeps the design it was built of. Changing the
    design on Shape no longer changes the model for free.
  - **New parts** (helmet, skinsuit, bars, a wheel, the frame): the tunnel
    shows a slim bar, e.g. "Model: old rear wheel · Swap · ₽1,500". Swapping
    costs ₽ 1,500 a part and no days.
  - **New position:** the bar says "Model: old position" with a **New
    model** button that opens the shop. You can still swap the parts on the
    old model if you only want to test those.
  - Taking a job puts the client's setup on the bench, so the first thing a
    job needs is a model of it.
  - Run notes, the pooled crank-angle average and the flow pictures all
    follow the model's design, not the bench's.
  - The firm now starts with ₽ 150,000, enough for a model and a session
    before the first fee.
  - Fixed: the CdA readout named the old model's scale until the fan ran.

- **0.5.2.0** (PR 5c): jobs, money and the days clock.
  - **Jobs screen:** a new first tab (Jobs · Shape · Tunnel). It shows your
    firm's money (you start with ₽ 100,000 on Mar 1, 2010) and a board of
    three briefs: who the client is, what they want, the event, the fee,
    the days to the event and the rider's power. A new career always offers
    Marta Selivan's regional time trial first, and there's always one small
    job on the board.
  - **Take a job** (tap twice): the client's current position and kit go on
    the Shape bench, and the job card shows the days left, the fee, what
    you've spent and race day. Shape's subtitle names the client, and
    "Start over" goes back to their setup.
  - **Money chip:** beside Saves on every screen, e.g. "₽99.5k · 21 d".
    Tap it to open Jobs.
  - **Runs cost money:** every tunnel run (sphere, wheel and tare runs
    too) comes off the firm's money, with or without a job.
  - **Models need a job:** the shop charges the job and the model's days
    pass at once (Kelbo's call). It won't take an order with no job or
    with too few days left, and says why.
  - **Deliver and race** (tap twice): the calendar jumps to race day, the
    rider races your design on that day's wind and air, and you see the
    time, speed, conditions and the fee. The board then moves on.
  - The desk estimate and the shop's Reynolds note now use the job's event.
    Each new career gets its own tunnel quirks; a save from before careers
    keeps the old ones, so its calibrations still hold.
  - **For now:** the fee is paid in full whatever happens. Promises, the
    declared prediction and the debrief are PR 5e; bids are 5f. Money can go
    below zero (shown in red); the soft landing is PR 7.

- **0.5.1.0** (PR 5b): save slots and save codes.
  - **Saves button:** top right on every screen, under Shape / Tunnel. It
    opens a sheet with three slots, each its own career, showing how many
    runs it has and when it was last saved.
  - **Play** another slot, or **New career** to wipe a slot and start
    fresh (tap twice: the first tap turns the button red and asks again).
    Switching reloads the page into that career.
  - **Save code:** "Copy save code" puts the whole career on the clipboard
    as one line starting `LAM1:` (a short session is about 1 KB). Paste a
    code into the box and tap "Load into slot n" twice to bring a career
    over from another phone. A cut-short or mistyped code is caught by its
    checksum and nothing is loaded.
  - The model shop now uses the same slide-up sheet as Saves.
  - **Not yet:** backup files and the "you haven't backed up in a while"
    reminder (PR 7).

- **0.5.0.0** (PR 5a): your work now survives closing the page.
  - **Autosave:** a second after any change (a finished run, a new model,
    the crank, the design), and at once when you switch away from the tab
    or close it. Your design, every finished run, calibration, tare and
    wheel checks, the model on order and the crank angle come back next
    time. A run still in progress when you leave is lost.
  - **Where:** the browser's own storage on your phone (IndexedDB database
    `laminar`, or `laminar.slot.1` if that's blocked). Nothing leaves the
    phone. A save that's damaged or from a newer version is left alone
    and the game starts fresh.
  - The run line's total now reads "All runs", since runs carry over.
  - **Not yet:** more than one slot, a way to start over, or a save code
    to move your career between devices. Those come in 5b.
  - Kelbo's PR 5 calls are in plan section 2.

- **0.4.4.0** (PR 4e): pressure taps and the Cp map. This finishes PR 4.
  - **Taps at the shop:** a new "Pressure taps" choice (₽ 8,000, 2 more
    days) fits pinholes over the rider, piped to the tunnel's scanner. They
    don't change the drag.
  - **Cp chip:** with a tapped model on the mount, a "Cp" chip joins the
    flow instruments. Turn it on and fan up: each tap shows as a dot,
    orange where the air pushes (the fronts of the forearms and shins),
    grey near zero, blue where it pulls (round the back, the arms and the
    helmet's sides). The scale is blue to orange with grey at 0, so it
    reads for colour-blind players too.
  - **Numbers, not just colour:** a slim legend at the side gives the
    scale (−2 to +1) and the highest and lowest readings with the part
    they're on. Below reading speed it asks you to fan up.
  - **Known simplification:** the taps read the flow field's attached-flow
    estimate, which runs away in the tight gaps between the legs and arms.
    Past −1.2 a reading eases off and never goes below −2.5, so the
    lowest reading is usually in a gap between parts.

- **0.4.3.0** (PR 4d): the model shop and the Reynolds trap. Kelbo's
  calls (15 November 2026): the shop is a sheet in the Tunnel, scales are
  1:4, 1:3 and 1:2, and until jobs arrive it shows ₽ and days without
  spending them.
  - **Model shop:** the "Model 1:2" button in the fan row opens it. Pick
    scale, finish (printed, sanded, polished), accuracy (standard ±1 %,
    fine ±0.4 %) and trip strips; see the price and days; order. Each
    build has its own small size errors.
  - **Reynolds trap:** the model drag readout now says how near the
    model's Reynolds number is to the full-size rider's on the day. A
    1:2 model matches at about 24 m/s; a 1:4 model would need 48, so even
    flat out it reads a few per cent high. Run a 1:2 flat out and its
    round parts hit their drag crisis early: it reads well low. A printed
    finish does that sooner.
  - **Trip strips on the model:** the shop tapes the long parts (torso,
    helmet, forearms), which go turbulent at full size but not on a small
    model. That brings a 1:4 or 1:3 model within about 1 %. A textured
    skinsuit still reads better on a small model than it really is: its
    weave doesn't shrink with the model.
  - Runs remember which build they used: the This design card pools only
    the current build, and A/B says when the model changed.

  The posts are the same for every scale, so their tare matters much more
  on a small model. "Reynolds trap" joins the glossary.
- **0.4.2.0** (PR 4c): the wheels stand still. The university tunnel has
  no wheel drive, so the rider model's wheels don't spin. A spinning
  wheel's spokes churn the air; still ones churn about half as much, so
  spoked wheels read low (about 3 % of the whole rider) and a disc looks
  less of a gain than it really is.
  - **Wheel:** a third model on the posts, the lab's 32-spoke reference
    wheel at 1:2, held still. Its readout shows its drag (with the posts
    taken off once tared) beside the book's figure for it spinning.
  - **Calibrate:** a new line holds the still wheel against the book and
    says how much your rider's spokes miss. The rider's CdA readout and
    the This design card then add it back, scaled by your own wheels
    (nothing for discs, less for deep rims).

  The corrected CdA's note now reads "Corrected · raw …" so it fits a
  phone; the This design card still lists what was corrected. "Static
  wheels" joins the glossary.
- **0.4.1.0** (PR 4b): the legs go round. A scale model's legs are fixed
  at one crank angle, and the legs' drag swings with the cranks: most with
  a thigh up in the air, least with the cranks level. A pedalling rider
  gets the average, so a single tunnel run can read up to about 6 % off.
  - **Cranks:** pick the model's crank angle beside the yaw setting.
    Changing it stops the fan while the tunnel is opened.
  - **This design:** a card at the top of the Runs tab pools every run of
    the design you're shaping at each crank angle, with the run-to-run
    spread. With two or more angles it gives the pedalling average. Four
    angles spread over half a turn (0°, 45°, 90°, 135°) cancel the swing
    exactly. Its numbers take off the tare and blockage once known.

  The standard pose's cranks moved from 20° to 15° to sit on the dial.
  "Pedalling average" joins the glossary.

- **0.4.0.0** (PR 4a): the tunnel lies, a little. The university tunnel
  now has hidden faults, drawn once from a seed, that creep into every
  reading:
  - **Blockage:** a big model squeezes the air, so it reads high.
  - **Turbulent air:** the drag crisis comes early.
  - **Mount drag:** the sting and the rider's posts add drag of their own.

  Your rider’s raw CdA now reads about 10–17 % high. To find out by how
  much:
  - **Tare:** take the model off and run the bare mount to measure its
    drag.
  - **Calibrate:** a new tab plots the sphere's Cd against Reynolds number
    over the book curve (a smooth sphere in calm air). Sweep the sphere
    through the crisis and it tells you how turbulent the air is. Tare the
    sting and hold a few slow speeds, and it finds the blockage too.

  Once a tare or calibration is done, the rider's CdA readout takes off
  what's known and shows the raw number beside it. "Calibration run" joins
  the glossary. Static wheels and legs, the model shop and the Cp map come
  in 4b to 4d.

- **0.3.6.0** (PR 3d): see the air. Four chips sit over the tunnel view
  when your rider is on the turntable:
  - **Rake:** a row of smoke streams up the rider's middle.
  - **Wand:** one stream from a tip you drag with a finger.
  - **Tufts:** wool tufts on the rider that lie flat where the air holds on
    and flail red where it lets go.
  - **Dark wall:** darkens the lab so the white smoke stands out.

  The smoke follows a flow field built from the model's own drag at tunnel
  speed, so it slows and churns in the wake exactly where the numbers say
  the flow separates, and it swings with the yaw. The turntable now turns
  the same way as the sim: positive yaw turns the rider's nose to its
  right, so the wind comes from its left. Also recorded: Kelbo's -ize
  spelling and the TCF name.

- **0.3.5.0** (PR 3c): is it real, or is it noise? A new Runs tab lists
  the session's runs, each with its CdA and noise band. Tap two to compare
  them: the first is A, the second B. The report says whether B is lower
  or higher than A beyond the noise, or within it, and lists what changed
  in the design between the two. A small chart shows both runs' readings
  at each yaw, with error bars (A as dots, B as rings). Only readings taken
  with the fan and table settled count, and holding a setting longer
  narrows the band. "Noise band" joins the glossary.

- **0.3.4.0** (PR 3b): tunnel runs and the bill. Every fan-up to fan-down
  is now a run: the balance logs a reading four times a second, and the
  sheet shows the run number, its time and what it has cost so far, plus
  the session's total. A run costs ₽ 500 plus the fan's power, which
  climbs with the cube of air speed (a minute at 30 m/s is about ₽ 1,330
  all in). New tabs swap the readouts for live charts: Drag over time, and
  a Yaw sweep that plots CdA against yaw using only settled readings. The
  last run shows faint behind this one. Swapping the model stops the fan
  and ends the run.

- **0.3.3.0** (PR 3a): your rider in the tunnel. The Tunnel screen now
  opens on a 1:2 scale model of whatever you shaped, standing on the yaw
  turntable. Turn the fan up and the balance reads the model's drag, the
  side force and the full-size CdA (the model's reading scaled up), with a
  small wobble from the balance's noise. A yaw slider turns the table up to
  20° each way; "Square on" brings it back. A Model switch swaps back to
  the calibration sphere and its smoke. The tunnel view now fits the space
  between the header and the sheet, so nothing hides behind them on short
  phones.

- **0.3.2.0** (PR 2c): pull the rider into shape. Six blue dots sit on the
  rider (hands, both elbows, back, head and helmet tail); press one and drag
  to reshape, or tap it to jump to its slider. A pull moves the same numbers
  the sliders do, stops at their limits and lands on their steps. The TCF
  rule box is drawn in 3D as see-through boxes around the hands and the
  helmet, which go red when a part breaks out. A glossary arrives: tap any
  dotted term (Reynolds number, drag, desk estimate, comfort and more) for a
  plain explanation, or open the Glossary from the Shape sheet to search all
  48 terms.

- **0.3.1.0** (PR 2b): the Shape screen. The game now opens on a 3D rider
  and bike you can turn with a finger, drawn from the design (the helmet's
  outline is the very shape the aero model tests). The sheet below has the
  desk estimate, a comfort meter, frontal area, mass and price, and the
  TCF rule check, plus three tabs of controls: Position (back angle, head,
  arm width, hand reach and height), Kit (helmet, tail, vents, fabric, arm
  trip strips) and Bike (bars, wheels, frame tubes). Broken rules turn the
  part red and list a "Change this" button that jumps to the control; a
  position that strains the rider lights the worst part amber. A Shape /
  Tunnel switch sits top right.

- **0.3.0.0** (PR 2a): the cyclist you'll shape. A design is a set of
  numbers (back angle, head, arm width, hand reach and height, helmet tail
  and vents, suit fabric and arm trip strips, drop or aero bars, spoked,
  deep or disc wheels, round or Kamm-tail tubes) that turns into the bodies
  the aero model reads. Each choice moves drag the way it does on a real
  bike: a flatter back is faster, a vented road helmet slower, a rear disc
  helps in a crosswind. Low positions strain the rider, costing a few per
  cent of power, and past their limit they can't be held. The Tarnovian
  Cycling Federation's time-trial rules check helmet length, hand reach
  and height, front wheels and tube shape. The desk estimate gives a
  wind-averaged CdA with error bars. Nothing new to see yet; the Shape
  screen comes next.

- **0.2.2.0** (PR 1c): one truth, three views. The model now gives three
  answers for any design: the hidden truth (full size, in the event's real
  air), the tunnel reading (a scale model with its own small build errors
  and surface finish, at tunnel speed, through the balance's scatter) and
  the field result (a seeded race day with its own wind, temperature and
  rider form, over a 40 km time trial). A plain reference rider reads CdA
  0.22 m² tucked and 0.31 m² on the hoods, and rides the 40 km in about
  54 minutes on a still day. Small models can fall into the Reynolds trap,
  reading laminar drag where the real thing is turbulent. `npm run aero --
  rider-tt` prints the numbers for a reference shape. Nothing new to see on
  the site yet.

- **0.2.1.0** (PR 1b): lift and crosswinds in the aero model. Wings, fins,
  disc wheels and diffusers make lift (or side force) with a stall, induced
  drag and ground effect that collapses when a wing gets too close. Bodies
  in a crosswind get side force and extra drag, and the model works out the
  centre of pressure, so it can tell whether a shape settles into the wind
  or gets pushed off line. Nothing new to see in the tunnel yet: the yaw
  turntable comes with the live sweep controls (PR 3).

- **0.2.0.0** (PR 1a): the aero model's drag. Bodies are described by their
  cross-sections; the model finds where the boundary layer goes turbulent
  and where the flow separates, and adds up skin friction, wake drag,
  front-corner drag, interference and cavity drag. Tests hold it to
  reference numbers (a sphere's drag crisis, flat-plate friction, a
  cylinder, a rounded box). In the tunnel the sphere now goes through its
  drag crisis near 20 m/s: its drag coefficient falls from 0.46 to 0.17,
  and a red ring marks where the flow leaves the sphere.

- **0.1.0.0** (PR 0): the repo, checks and deploy; the Longlight loading
  splash; the "Cobalt lab" look; a grey test section with a calibration
  sphere on a sting, a fan slider that spins up at the fan's ramp rate, smoke
  streaks over the sphere, and live air speed, dynamic pressure, Reynolds
  number and a textbook sphere drag.

## Build notes

- PR 1 is split into 1a, 1b and 1c so each PR stays small enough to read on
  a phone. Versions: PR n is 0.(n+1).x.0, and each part bumps the third
  number.

## Setup notes

- Repo: renamed from `Jxstrr0/Laminar-` to `Jxstrr0/Laminar` on
  15 November 2026. Old links redirect.
- DNS: `laminar.longlight.games` is a CNAME to `jxstrr0.github.io` in
  Cloudflare (added 15 November 2026, not proxied, like Quench).
- GitHub Pages: **Source: GitHub Actions** (switched on 15 November 2026),
  custom domain `laminar.longlight.games`, **Enforce HTTPS** on.

## Decisions (15 November 2026)

- Spelling: Canadian with **-ize** (organize, realize), as the Canadian
  Oxford does. `tests/glossary.test.ts` flags -ise forms in glossary text.
- The cycling body stays the **Tarnovian Cycling Federation** (TCF).
