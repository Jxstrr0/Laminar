# Laminar UI overhaul: "Isobar"

Build brief for Laminar (repo `Jxstrr0/Laminar`). Written against **v0.13.2.0** (PR 12c, the CFD panel). Hand this file to a Claude Code session, e.g.:

> Read `CLAUDE.md`, then `docs/UI-ISOBAR-PLAN.md`. Do PR 13a only. Stop when it's merged and give me the phone test.

Commit this file as `docs/UI-ISOBAR-PLAN.md` in the first PR so every session can find it. Tick off PRs in the checklist at the bottom as they land.

> **Numbering (17 November 2026).** By the time this brief reached the repo, PR 13a–13d had already landed as the plan's PR 13 work (13a lab sounds, 13b the university tunnel in Blender, 13c the Credits sheet and voice pack, 13d your own tunnel in Blender; v0.14.0.0–v0.14.3.0). So the Isobar PRs take the next letters: **this brief's 13a–13f land as PR 13e–13j** (v0.14.4.0 onward), and the note about moving the art, sound and credits work to 13g no longer applies. The section headings below keep the brief's own letters; the checklist at the bottom gives both.

Kelbo picked this look on 16 November 2026 from three mockups (Schlieren, Livery, Isobar). He also chose: **restyle the 3D scenes too**, **move the Jobs / Shape / Tunnel switch to a bottom bar**, and **keep both light and dark modes**. He answered the open questions the same night (section 9). The mockups are on Kelbo's private design canvas (*Laminar UI overhaul: 3 directions*), which a coding session may not be able to open, so **the token tables in this file are the source of truth**.

---

## 0. Ground rules (from CLAUDE.md, restated so they aren't skipped)

- `CLAUDE.md` wins over this file where they disagree.
- Branch, PR, merge on green; never push to `main`. One PR per section below, small enough to read on a phone. Title: `PR 13a: <summary> — v0.14.0.0`, then 13b… bumping the third number. This lands **now**, before the rest of the CFD polish; the plan's PR 13 art, sound and credits work moves to 13g onward (update the plan's section 14 table in 13a). Bump `VERSION` and add a `docs/STATUS.md` line in every PR.
- **Every colour stays a CSS variable at the top of `src/style.css`; nothing else in the CSS names a colour.** 3D colours live in one table (section 5), not inline.
- **Both themes in every PR.** Laminar follows `prefers-color-scheme` (no in-game toggle today); test both on the phone (iOS Settings › Display › Dark).
- Phone portrait first. The `min-width: 720px` layouts must still work.
- **No sim change.** The renderer only draws what the sim says: any pressure colour on a model comes from the sim's field (section 6), never a made-up gradient.
- Every chart and colour scale keeps a readable number, not colour alone. Text passes 4.5:1. Touch targets ≥ 44px. Respect `prefers-reduced-motion`.
- Fonts self-hosted from `@fontsource`, each with a `CREDITS.md` line (all SIL OFL 1.1).
- The loading splash, credit line and studio link are studio pieces: **leave them on Longlight colours and Space Grotesk.**
- Kelbo's answers are in section 9. Anything new that's a real design decision gets asked, not guessed.
- End each PR with a plain-language "what changed / how to test on a phone" summary.

## 1. Direction: "Isobar"

The pressure map becomes the look. The UI takes its colours from a Cp scale (cool blue for suction, coral for pressure) on a soft lilac-ice lab. Rounded white cards float over faint isobar contour lines. Numbers are set in a crisp mono. It stays bright and clean (the plan's "clean lab"), but it should feel like an aero instrument, not a corporate dashboard.

- **What it isn't:** no frosted glass (PEW owns that), no gradient washes, and no left-border accent cards. Gradients appear only where they *are* data: the Cp legend and the little Cp bar under the wordmark.
- **One action colour:** teal, for active nav, selected controls, slider fills, handles and links. Blue and coral are kept for pressure data, plus coral for separation and failures.

### 1a. Tokens

Keep today's variable names where they exist (less churn); add the new ones.

| Token | Role | Light | Dark |
| --- | --- | --- | --- |
| `--bg` | Page | `#EDEFFA` | `#0F1226` |
| `--panel` | Cards, dock | `#FFFFFF` | `#1A1E3A` |
| `--panel-2` | Pill tracks, inset fields | `#EDEFFA` | `#151936` |
| `--scene` | Scene card / 3D backdrop | `#F6F7FF` | `#151936` |
| `--line` | Dividers, tracks | `#E4E7F6` | `#2A2F55` |
| `--ink` | Text | `#161A33` | `#EEF0FF` |
| `--muted` | Secondary text | `#5A6082` | `#A3A9CC` |
| `--accent` | Action (teal) | `#00756F` | `#2ED3C6` |
| `--accent-ink` | Text on accent | `#FFFFFF` | `#0F1226` |
| `--accent-soft` | Tinted chips | `#D5F0EE` | `rgba(46,211,198,.16)` |
| `--btn` / `--btn-ink` | Primary button | `#161A33` / `#FFFFFF` | `#EEF0FF` / `#0F1226` |
| `--cp-lo` | Suction (data) | `#3D5BFF` | `#7189FF` |
| `--cp-hi` | Pressure (data, fills) | `#FF5A4E` | `#FF7A6E` |
| `--sep` | Separation / failure (fills, lines) | `#FF5A4E` | `#FF7A6E` |
| `--sep-text` | Failure **text** | `#C2372C` | `#FF7A6E` |
| `--warn` / `--warn-text` | Warnings | `#E08A00` / `#9A5B00` | `#F2A93B` / `#F2A93B` |
| `--avatar` / `--avatar-ink` | Client / staff initials | `#FFE1DC` / `#B3261E` | `rgba(255,122,110,.18)` / `#FF9A90` |
| `--iso` | Background isobar opacity | `0.13` | `0.24` |
| `--shadow-card` | Cards | `0 12px 30px rgba(40,50,120,.12)` | `0 12px 30px rgba(0,0,0,.45)` |
| `--shadow-dock` | Bottom dock | `0 14px 34px rgba(40,50,120,.22)` | `0 14px 34px rgba(0,0,0,.55)` |
| `--r-card` / `--r-pill` / `--r-small` | Radii | `26px` / `22px` / `14px` | same |

In dark mode, cards also get a `1px solid var(--line)` border so they hold their edges on the dark page.

**Contrast, checked:** ink on bg 14.9 / 16.3; muted on panel 6.1 / 7.1; muted on bg 5.3 / 8.0; text on accent 5.6 / 9.9; accent on panel 5.6 / 8.7; accent on accent-soft 4.6 (light); avatar ink 5.3 / 8.0; `--sep-text` on white 5.4. **Coral `#FF5A4E` on white is only 3.1, so never use it for text in light mode.** That's why `--sep-text` exists. Recheck any new pair you add.

### 1b. Type

- **UI:** Bricolage Grotesque (`@fontsource-variable/bricolage-grotesque`, or the static `@fontsource/bricolage-grotesque` at 400/600/700/800). Headings 700–800 with slight negative tracking; body 400; labels 600.
- **Numbers:** Geist Mono (`@fontsource/geist-mono`, 400/600), the new `--font-num`.
- **Wordmark:** "laminar", lowercase, 800, 26px, over a 28 × 4px Cp bar (`--cp-lo` → pale → `--cp-hi`) and the place line. Kelbo chose the lowercase wordmark. This is the game's own wordmark, not the Longlight logo.
- Neither font is used by another Longlight game (checked against catalogue section 9). Once nothing references them, remove Instrument Sans and Spline Sans Mono imports from `src/main.ts` and their `CREDITS.md` lines.

### 1c. The Cp scale becomes the brand

`CP_PALETTE` in `src/data/flowViz.ts` already drives the taps and the legend (via `src/render/cpScale.ts`). Retune it to the Isobar ends so the data views and the UI agree:

```ts
suction: ['#2F45E0', '#5C78FF', '#AAB8FF'],
neutral: '#D9DCEB',
pressure: ['#FFB3A6', '#FF6F5E', '#D23A2C'],
```

Plan section 11 asks for a colour-blind-safe diverging scale. Blue against coral still holds up under deuteranopia and protanopia, but **check the new stops with a CVD simulator** and keep the numbered legend ticks. If the taps read badly on the dark scene, give `CP_PALETTE` a `neutralDark` and pick the neutral by theme in `cpScale.ts`.

---

## 2. PR 13a: Foundation (tokens, fonts, bottom dock)

### 2a. Tokens and fonts
- Replace the `:root` block and the `prefers-color-scheme: dark` block at the top of `src/style.css` with section 1a. `--accent` moves from cobalt to teal: grep every `var(--accent)` (focus ring, `.guide-card`, `.job-card.is-active`, glossary underlines, `.chip` states) and check each still reads right.
- Fonts: swap the `@fontsource` imports in `src/main.ts` and set `--font-ui` / `--font-num`.
- `index.html` `theme-color` metas → `#EDEFFA` / `#0F1226`. Leave the inline loading splash alone.
- Update `CLAUDE.md` › **Look**: "Isobar", chosen by Kelbo 16 November 2026, with the token table and fonts.

### 2b. Bottom dock (`buildNav()` in `src/main.ts`, `.screen-nav` / `.nav-button` in style.css)
- Becomes a floating pill, bottom centre, on every screen width (Kelbo: no side rail on desktop): `bottom: calc(16px + var(--safe-b))`, `--panel` background, `--shadow-dock`, radius 32px, 6px padding.
- Each button: a 22px stroke icon plus a label. The **active** button (`aria-current="page"`) is a teal pill showing the icon and label; inactive buttons show the icon only, but keep the label as `aria-label` and the `t('nav.*')` text. Buttons are at least 52px tall.
- Icons: new `src/ui/icons.ts` exporting inline SVG strings (Jobs = clipboard, Shape = bezier pen with nodes, Tunnel = wind lines, Saves = disk). Stroke `currentColor`, width 1.8–2.
- Add `--dock-h: calc(64px + 16px + var(--safe-b))` and pad the bottom of every scrolling screen (`.sheet`, `.shape-sheet`, `.board-screen`, and other sheets) by it, so the dock never hides content.
- `.top-bar` no longer reserves `222px` on the right for the old switch. `.top-chips` (money chip, Saves, job chip, preview chip) move up into the top-right row as 44px white pills with `--shadow-card`.
- Reduced motion: no transition on the active pill.

**Phone test:** both themes; switch Jobs/Shape/Tunnel from the dock; scroll each screen to the bottom (nothing hidden behind the dock, portrait and landscape); the money chip and Saves sit top right; the loading splash is unchanged.

---

## 3. PR 13b: Surfaces and controls (DOM, all three main screens)

- **Cards:** `.firm-strip`, `.job-card`, `.own-card`, `.guide-card`, `.readout`, `.panel-box`, `.runs-box`, `.piv-box`, `.cfd-box` get `--panel`, `--r-card`, `--shadow-card` and no 1px border in light mode. `.job-card.is-active` and `.guide-card` get a 2px `--accent` ring instead of a tint. `.job-goal` loses its `border-left` and becomes a `--panel-2` block with a small radius.
- **Sheets:** `.sheet` / `.shape-sheet` stop being one edge-to-edge white slab. They become a transparent scrolling column inset 12px, holding cards with a 12px gap. Keep the scroll and drag behaviour in `src/ui/sheet.ts` as is.
- **Segmented and tabs:** `.segmented`/`.segment`, `.tabs`/`.tab` and `.view-tabs` share one pill style: `--panel-2` track, 3px padding; the selected item is a `--panel` pill with teal text, weight 700 and a small shadow. The Tunnel's five view tabs (Readouts, Drag, Yaw sweep, Calibrate, Runs) scroll sideways with a fade at the edge rather than squashing.
- **Chips** (`.chip`, `.instruments`): 44px pills on `--panel` with a shadow; **on** is a teal fill with `--accent-ink` text.
- **Sliders** (`.control-slider`, Shape's position, kit and bike controls): 10px `--line` track with a teal fill to the thumb, and a 26px `--panel` thumb with a 4px teal ring. The fill uses a `--p` custom property: a small helper (new `src/ui/range.ts`) sets `--p` on `input` for every range it's given. Keep the native `<input type=range>`.
- **Buttons:** primary = `--btn` pill, 52px, weight 700; `.text-button` = teal. Press feel: `:active { transform: scale(.97) }` over 120ms (none under reduced motion).
- **Readouts:** label 11px `--muted`; value in Geist Mono 600. The glossary's dotted underline stays as the tap affordance, in teal.
- **Partner / guide card (Irina):** an initials avatar (`--avatar`), the message in a speech-bubble block (`--panel-2`, radius 4px 18px 18px 18px), and steps as rows numbered "01–07". The current step is a teal pill with `--accent-ink` text.
- **Firm strip:** a reputation ring (SVG, teal arc on `--line`) next to the number. Numbers stay as text.
- **Charts** (`src/ui/chart.ts`) already read CSS variables via `getComputedStyle`: check line, grid and label colours still map to sensible tokens, and that compare lines use `--cp-lo` / `--cp-hi`.
- **Background isobars:** one `aria-hidden`, `pointer-events:none` SVG layer behind the Jobs page and behind the sheet area, drawn once from a fixed seed: 10–14 wobbly closed loops in `--cp-lo` and a violet `#8C7BFF`, plus 3–4 small coral loops, stroke 1.2, opacity `var(--iso)`. Static: it never animates.

**Phone test:** Jobs (firm strip, job cards, Irina's card, a bid sheet); Shape (sliders, Position/Kit/Bike); Tunnel (chips, tabs scrolling, readouts, Runs list, a chart); both themes; text readable on every card.

---

## 4. PR 13c: Fan and yaw dials (Tunnel)

- New `src/ui/dial.ts`: an SVG semicircle (radius 60, 12px stroke, round caps), seven tick marks, the value in Geist Mono at the centre, and the label plus a muted sub-label above it ("Fan · Model 1:2", "Yaw · Cranks 15°"). Fan = teal arc fill; yaw = a needle from the centre.
- **Input** (Kelbo: drag plus steppers): drag along the arc (pointer events, `touch-action: none` on the dial only, so the sheet still scrolls elsewhere); **− / +** 44px stepper buttons under it (hold to repeat, ~8 steps/s); and a **native `<input type=range>` kept underneath**, visually hidden but focusable, so keyboard and VoiceOver work. The dial shows the range's focus ring. Step sizes and ranges come from the existing data tables, with no new numbers inline.
- **Fan set vs actual:** the arc shows the set speed; a thin second marker shows the actual speed as the fan ramps (replacing today's "Set 0.0 m/s" text). "Fan off" becomes a coral-outlined stop button in the fan card. "Square on" becomes a tap on the yaw dial's centre value, plus a small text button.
- Both dials sit side by side in one card with a 1px divider. Below ~360px wide, stack them.
- The run line ("Fan up to start a run · ₽ 500 + power") stays under the dial card.

**Phone test:** drag both dials; tap and hold the steppers; Fan off; Square on; start and finish a run; desktop arrow keys move the focused dial; VoiceOver reads "Fan, 14.2 metres per second".

---

## 5. PR 13d: The 3D scenes take the Isobar look

- New **`src/render/theme.ts`**: one place for scene colours, with `light` and `dark` tables, plus `onThemeChange(cb)` built on `matchMedia('(prefers-color-scheme: dark)')`'s `change` event. `tunnelScene.ts` (`COLOURS`, around line 51), `shapeScene.ts` (`COLOURS`, around line 23), `riderFigure.ts` (around line 34) and `replayScene.ts` read from it and re-set material colours when the theme changes. That's a colour change only, with no per-frame work.
- **Lab:** light background `#F6F7FF`, walls `#E9ECFA`, floor `#E2E5F7`, frame `#8A90B0`; dark background `#151936`, walls `#1C2142`, floor `#1F2447`, frame `#8D94BE`. The hemisphere light goes lilac-white over lilac-grey; the key light warms slightly. The plan said "the 3D lab stays bright in both themes"; Kelbo changed that: **the scene follows the phone's dark mode.** Note it in plan section 11.
- **Dark wall instrument** (`setInstruments`, around line 1332): in light mode it keeps today's job, a dark backdrop for the smoke, now in Isobar navy `#151936` / `#1C2142` / `#1F2447`. In dark mode it **goes darker still** (Kelbo): near-black background `#080A16`, walls `#0D1024`, floor `#10132A`, so the chip always does something.
- **Smoke:** white with a faint ink twin in light mode, so it reads on pale walls; plain white in dark mode.
- **Models look like scale models:** a matte "model shop" finish so data colours and handles stand out. Rider suit deep indigo `#3A4170`, suit panel teal, helmet `#F6F7FF`, frame `#8A90B0`, tyres `#2A2F4F`. Other sports' figures follow the same idea.
- **Shape handles:** a white core with a 4px teal ring (`handle` / `handleRing`); broken rules in coral. Rules box: teal at low opacity, edge teal.
- **Scene card:** the mockups show the 3D view inset 12px with 28px rounded corners. Keep the canvas full-screen (gestures and framing stay as they are) and add a `pointer-events:none` CSS frame over it in `--bg`, with rounded inner corners. It's cheap and needs no renderer change. Check `rvBand`-style camera framing still centres the model in the visible area.

**Phone test:** both themes in Tunnel, Shape and a field replay; flip the phone's dark mode while the game is open and the scene follows; Dark wall in light mode; handles easy to see and grab; frame rate unchanged.

---

## 6. PR 13e: Pressure colour on the model

The mockups show the rider coloured by Cp with isobar lines around it. Following CLAUDE.md, those colours must be **real**: `src/sim/flow/field.ts` already estimates Cp for the pressure map, and `src/render/cpScale.ts` turns Cp into colour.

- **Kelbo's call: only while the pressure taps instrument is on** (`taps` in `tunnelScreen.ts`'s instruments), the model's surface wears the field's Cp. Never always-on: that would give away what the taps upgrade sells. Use per-vertex colours via `cpRgb`, recomputed only when the design, yaw or air speed changes, never per frame. Map figure vertices to the field's full-size metres with the transform `flowViz.ts` already uses for tufts. With the instrument off, the model is plain matte.
- **Isobar lines on the surface:** a small `onBeforeCompile` patch on the figure material that draws thin lines where the interpolated Cp crosses each legend tick. On slower phones, skip the lines and keep only the vertex colours.
- **Legend:** `.cp-legend` gets the mockup look (white pill, 8px gradient bar, ticks in Geist Mono with "Cp" in the middle). It stays numbered.

**Phone test:** turn the pressure instrument on and off; change yaw and see the colours move; numbers on the legend match the taps; no stutter when dragging a Shape slider and then returning to the Tunnel.

---

## 7. PR 13f: Every other screen, icon and clean-up

- **Remaining screens:** saves sheet, glossary, research, model shop, records, legacy picture, export, challenge, the break / failure sheets, `replayOverlay.ts` and every `*Replay.ts` / `*Forecast.ts` overlay, the PIV and CFD panels. Same cards, pills, type and tokens.
- **PIV and CFD slices:** they're single-hue speed scales ("dark is still air, pale is the tunnel's speed"). Retint to an indigo → pale-teal ramp that reads in both themes, and keep the alt text in `src/data/strings.ts` true to the colours.
- **App icon and manifest:** `public/manifest.webmanifest` (`theme_color`, `background_color`) to the new bg. Redraw `public/icon.svg` in Isobar colours (Kelbo said yes), then `npm run icons`. Show Kelbo the new icon in the PR before merging.
- **Clean-up:** remove unused tokens, the old fonts and their credits. Update `CLAUDE.md` › Look, `docs/STATUS.md`, and a one-line note in plan section 11.
- **Screenshots:** both themes, Jobs / Shape / Tunnel / a replay, at 390 × 844, attached to the PR so Kelbo can compare with the mockups.

**Phone test:** open each sheet once in each theme; install-to-home-screen colours look right; nothing still shows cobalt.

---

## 8. Performance and accessibility budget

- **No `backdrop-filter`:** Isobar cards are opaque, which is cheaper than glass. Keep box shadows to the cards on screen (about 6 at once), no huge blur radii.
- **Nothing new per frame:** theme and Cp colour updates happen on change only.
- **Contrast and colour blindness:** recheck every new colour pair; run the Cp stops through a CVD simulator; every scale keeps numbers.
- **Reduced motion:** no dock transitions, press scales or dial easing.
- **Touch targets:** 44px minimum everywhere; the dock buttons are 52px.

## 9. Kelbo's decisions (16 November 2026)

1. **Timing:** now, as PR 13a–13f (v0.14.x). The plan's PR 13 art, sound and credits work moves to 13g onward. *(The release-title script only accepts `PR <number><letters>:`.)*
2. **Pressure colour on the model:** only while an instrument is on, never always-on.
3. **Which instrument:** the pressure taps.
4. **Dark tunnel:** the 3D lab follows the phone's dark mode.
5. **Dark wall in dark mode:** goes darker still (section 5).
6. **Dials:** drag along the arc plus − / + steppers.
7. **Desktop:** the bottom dock on every screen width; no side rail.
8. **App icon:** redraw it in Isobar colours.
9. **Wordmark:** lowercase "laminar".

## 10. Out of scope

Aero model and sim numbers, save format, new localStorage keys (stop and ask if one seems needed), the Blender art pass, audio. The studio catalogue's "Looks already in use" table lives in `Jxstrr0/Kelbo.Website`: **don't edit the copy here**. Remind Kelbo to add "Isobar: lilac-ice lab, Cp blue/coral, teal; Bricolage Grotesque / Geist Mono" there when 13a merges.

---

## Checklist

- [x] Brief's 13a → **PR 13e** (v0.14.4.0): Tokens, fonts, bottom dock, top chips
- [x] Brief's 13b → **PR 13f** (v0.14.5.0): Cards, sheets, pills, chips, sliders, buttons, background isobars
- [x] Brief's 13c → **PR 13g** (v0.14.6.0): Fan and yaw dials
- [ ] Brief's 13d → **PR 13h**: 3D scenes, theme module, model finish, handles, scene frame
- [ ] Brief's 13e → **PR 13i**: Pressure colour on the model + legend
- [ ] Brief's 13f → **PR 13j**: Remaining screens, slices, icon, clean-up, screenshots
