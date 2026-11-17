/**
 * The lab's sounds (PR 13a), made in code with the Web Audio API: Kelbo
 * chose sounds synthesized live (17 November 2026), with ElevenLabs effects
 * perhaps later, after a quote. Volumes are gains (1 is full scale); pitches
 * are in hertz; times in seconds. The game works muted: every sound has a
 * text or picture twin already.
 */
export const AUDIO = {
  /** Everything passes through this before the speakers. */
  master: 0.7,
  /** How quickly a level or pitch follows its target (a time constant). */
  glide: 0.12,
  fan: {
    /** The motor's hum: a low buzz rising with the air's speed. */
    humBase: 34,
    humPerMs: 2.4,
    humGain: 0.05,
    /** The hum fades in over the first share of the top speed. */
    humFadeIn: 0.15,
    humCutoff: 380,
    /** The rushing air: filtered noise, louder and brighter as the air speeds up. */
    rushGain: 0.16,
    rushBase: 260,
    rushPerMs: 38,
    rushQ: 0.8,
  },
  /** The turntable's motor while it turns: a soft whirr with a wobble. */
  whirr: { pitch: 150, gain: 0.03, wobble: 11, wobbleDepth: 12 },
  /** The turntable locking at its angle: a low knock and a scrape. */
  clunk: { pitch: 72, gain: 0.22, noiseGain: 0.1, noiseCutoff: 900, decay: 0.16 },
  /** A model part letting go: a sharp crack. */
  snap: { gain: 0.3, cutoff: 2400, decay: 0.12 },
} as const
