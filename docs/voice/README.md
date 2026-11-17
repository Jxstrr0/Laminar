# Laminar voice pack v1 (ElevenLabs)

Status: **generated, takes not yet picked.** Kelbo approved the quote on 17 November 2026; 4,972 credits were used (2 takes of each line). The files stay on ElevenLabs until the picked takes are added to the game.

- Script sheet: `lam-voice-pack-v1.csv` (60 lines, game code `LAM`). Line IDs never change once shipped.
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

## When they're generated

Save each picked take under its `file_name`, load voice per screen (never in the first load),
and add one line per voice to `CREDITS.md`.
