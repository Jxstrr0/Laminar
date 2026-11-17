# Laminar voice pack v1 (ElevenLabs)

Status: **in the game (PR 14b, v0.15.1.0).** Kelbo approved the quote on 17 November 2026; 4,972 credits were used (2 takes of each line). Kelbo picked **take 2 of every line**. Each one is in `public/voice/` under its `file_name`, and the script sheet's `generation_id` names it.

- **Fixes (PR 13ab, v0.15.19.0):** four lines said "road" but play at every venue, so they were re-recorded with new words on the flow "LAM — Laminar voice fixes v2 (road lines)": LAM-ZHELIN-0006, LAM-ZHELIN-0007, LAM-SOROKOVA-0006 and LAM-CLIENT-0003. Kelbo approved the quote (398 credits, about CA$0.10; 2 takes each) and left the pick to Claude: take 2 of each. Their files end `_t4` (takes 3 and 4 of the line), which also makes phones that cached the old lines offline fetch the new ones.
- **New lines (PR 13ag, v0.15.20.0):** the commentator said "Let's see the time" at the end of every race, though riders' and skaters' jobs are judged on drag and trucks' on fuel. Two lines were added on the flow "LAM — Laminar voice fixes v3 (finish lines)": LAM-COMM-0017 ("Across the line! Now, what did the drag really do?") for riders and skaters, and LAM-COMM-0018 ("That's the run done. Let's see what it burned.") for trucks. Kelbo approved the quote (199 credits, about CA$0.05; 2 takes each; 200 used). Take 2 of each, levelled to -20 LUFS. Cars, sleds, drones and record cars keep LAM-COMM-0006.
- Script sheet: `lam-voice-pack-v1.csv` (62 lines, game code `LAM`). Line IDs never change once shipped.
- Flow on ElevenLabs: "LAM — Laminar voice pack v1" (one node per line, labelled with its line ID).
- Quote (17 November 2026): 4,973 credits for 60 lines × 2 takes on `eleven_v4`,
  about US$0.87 of the Creator plan's monthly credits. One take each is about half.
- Voice lines never carry numbers: the on-screen text keeps the times, gaps and km/h,
  so one recording fits every run.

## Cast

| Character | Who | Voice | voice_id | Direction |
| --- | --- | --- | --- | --- |
| `basov` | Timur Basov, tunnel tech | Petr | `YmVg4ttFt2KSPXVlxpRw` | Mature, calm, seen it all. Short and unhurried, never alarmed even when a model breaks. |
| `krasna` | Lidiya Krasna, tunnel tech | Natasha | `rl5Q2u6U81iTG1BKztyX` | Quick, dry humour, confident. Talks like she's already walking to the next job. |
| `zhelin` | Artyom Zhelin, senior analyst | Alex (calm) | `XaEUesE01wKIKaa0xI0h` | Precise, measured, faintly amused. Praise is rare and means it. |
| `sorokova` | Milena Sorokova, junior analyst | Milly | `u4vKLcnECLknah2Kl9fU` | Young, eager, warm, a little unsure. Excited when the numbers agree. |
| `boss` | Client: team manager (any male client) | Maxim | `IGRoDkfYV2Frq7Ly0PRu` | Gruff baritone, short sentences, pays for results. |
| `engineer` | Client: race engineer (any female client) | Kate | `xVQH621DS3eyBYrseRt5` | Brisk, professional, numbers first. |
| `comm` | Field commentator (all replays) | Nathaniel | `9rR45HW0vcBmpCbkc4m9` | Patient build-up, then real big-race lift. Never shouts over a crash; nobody is ever hurt. |

The six staff and client voices speak English with a light Eastern European accent, to fit
Tarnovia. The commentator is a British broadcast voice: the first pick, a Slavic-accented
voice called Roman, isn't available to this workspace.

## In the game

- `src/data/voice.ts`: every line, each cue's line per speaker, and the client voice for each brief.
- `src/audio/voice.ts` plays them one at a time through the game's sound, so the mute chip
  silences them too. A caption names who's speaking. A file loads the first time its line plays
  (never in the first load), and the offline worker keeps it in `laminar-voice-1`.
- The tech and the analyst only speak once they're on the staff. The client speaks as a job
  starts, on the day, and at the debrief. The commentator speaks over every replay.
