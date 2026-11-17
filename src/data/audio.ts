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

/**
 * The mix (PR 13u): how the game's four kinds of sound sit together. Voice
 * lines are levelled to about -20 LUFS, the effects to about -18 and the
 * music to about -18, before the gains in their own tables; these numbers
 * then make room for whoever is speaking.
 */
export const MIX = {
  /** While a voice line plays, the music drops to this share of its level, and the effects (code-made ones too) to this. */
  duck: { music: 0.45, sfx: 0.7 },
  /** How fast the duck comes in as a line starts, and goes out after it ends (time constants, s). */
  duckAttack: 0.05,
  duckRelease: 0.3,
  /**
   * A safety limiter over everything: a cheer, an engine and a line landing
   * together are caught here instead of clipping a phone's speaker.
   * Threshold and knee in dB; attack and release in s.
   */
  limiter: { threshold: -4, knee: 3, ratio: 12, attack: 0.003, release: 0.2 },
} as const

