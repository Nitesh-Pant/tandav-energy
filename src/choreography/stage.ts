/**
 * Per-frame shared values written by the director and read by every effect
 * inside useFrame. A plain mutable object: no React state, no allocation.
 */
export const stage = {
  /** True once the visitor has entered. Before that the scene idles in the void. */
  running: false,
  /** Rendered frame counter. */
  frame: 0,
  /** 1 while the bronze statue stands in for the dancer (before the awakening, after the climax). */
  statue: 0,
  /** Set once the statue model has loaded; without it the dancer stays throughout. */
  statueReady: false,
  time: 0,
  dt: 0,
  /** 0..4, index into ACTS. */
  act: 0,
  actProgress: 0,

  /** Authored macro arc of the piece (0..1). */
  energy: 0,
  /** Energy modulated by live loudness. Drives most continuous intensity. */
  intensity: 0,
  halo: 0.04,
  fire: 0,
  dance: 0,
  dust: 0.15,
  thirdEye: 0,
  /** Rate at which particles orbit; integrated into `swirlPhase` (avoids jumps when the rate changes). */
  swirl: 0.05,
  swirlPhase: 0,
  turbulence: 0,

  /** Decaying global flash from lightning (0..1) and where it came from. */
  flash: 0,
  flashX: 0,
  flashY: 30,
  flashZ: -60,
  glint: 0,
  /** 1 at the climax, decays over several seconds. */
  climax: 0,
  /** Camera impulse energy; the rig turns it into a short damped kick. */
  impulse: 0,

  /** Beat phase 0..1 and beat index when the tempo is known; -1 otherwise. */
  beatPhase: 0,
  beatIndex: -1,
  /** Seconds until the next authored accent (Infinity when none soon). Lets the dance anticipate. */
  nextAccentIn: Infinity,
  /** Seconds relative to the climax (negative before it). */
  toClimax: -Infinity,
  /** Seconds per beat when the tempo is known. */
  beatLength: 0.625,

  /** Index of the shloka line being sung (-1 when none). */
  lineIndex: -1,
  /** Verse of the stotram being sung, held through short gaps; 0 between verses (refrains, interludes). */
  verse: 0,
  /**
   * Imagery of the line being sung, each 0..1 and decaying — set when a
   * shloka line names fire, the moon, serpents, the river…
   */
  motif: { fire: 0, eye: 0, moon: 0, serpent: 0, ganga: 0, throat: 0, storm: 0, calm: 0, radiance: 0, damaru: 0 },

  bass: 0,
  mid: 0,
  high: 0,
  loudness: 0,

  /** Pointer in normalised device coordinates. */
  pointerX: 0,
  pointerY: 0,
  pointerActive: 0,

  /** Pre-entry glow used by the intro screen. */
  intro: 1,
  reduced: false,
  reducedMotion: false,
}

export type Stage = typeof stage
