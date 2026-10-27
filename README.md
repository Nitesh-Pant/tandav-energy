# TANDAV

*When the universe moves, it dances.*

An immersive, music-reactive WebGL experience inspired by Shiva's Tandav and the Shiv Tandav Stotram. You enter a dark void. A distant blue glow appears, and a four-armed Nataraja silhouette awakens inside a ring of fire. The dance builds through five acts. Lightning, shockwaves, embers and orbiting debris respond to the music. Everything comes to a climax and then returns to stillness.

Built with React 19, TypeScript, Vite, Three.js / React Three Fiber, custom GLSL, `postprocessing`, and the Web Audio API.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Development server with hot reload           |
| `npm run build`     | Type-check (`tsc -b`) and production build   |
| `npm run preview`   | Serve the production build locally           |
| `npm run typecheck` | Type-check only                              |
| `npm run lint`      | ESLint                                       |

Requires Node 20.19+ (or 22.12+) and a browser with WebGL (WebGL 2 preferred).

---

## Sound

No copyrighted audio is included. The experience works in one of three modes, picked automatically:

1. **Your recording (optional).** Put the audio file at **`public/audio/tandav.mp3`**. `.m4a`, `.ogg` and `.wav` also work, but the name must be `tandav`. Reload the page. The intro shows *"Soundtrack loaded"*, and the track plays after **Enter**. Nothing else is required, because the recording is analysed automatically (see below).
2. **The built-in procedural score (default).** This is an original piece, about 2 min 52 s long, synthesised in real time with Web Audio. It has a tanpura-style drone, damaru strokes, taiko, thunder, temple bells, metallic shimmer and a low vocal-formant "Om". The drum pattern follows the *Panchachamara* metre of the Stotram: a light stroke and then a heavy one, *da-DUM da-DUM*. The score is written as data in `src/choreography/composition.ts`, and the visual timeline is generated from the same data, so every lightning strike lands on its thunder clap.
3. **Silent fallback.** If Web Audio is unavailable, the choreography still runs on a clock.

Audio never starts before the visitor interacts with the page. Audio files in `public/audio/` are git-ignored. If you deploy the site publicly, use a recording you have the rights to share.

### Automatic choreography for your recording

When a recording is found, the whole file is decoded once, in the background during the intro (`src/audio/trackAnalysis.ts`). From its loudness and onset envelopes, the analysis finds:

- the five acts: where the sound wakes, where the dance proper begins, the final stretch, and the release into stillness
- the **climax**, the loudest moment before the release
- up to 28 of the **strongest hits**, which become stamps, energy rings and shockwaves (and because they are known in advance, the figure can anticipate them)
- the **tempo**, so the dance lands its poses on the beat. Free-tempo chanting is detected and left free.

The browser console logs what was found, for example `[tandav] Soundtrack structure: acts at 11.2 / 30.0 / 100.3 / 127.6 s, climax 120.0 s, 99.4 BPM, 13 accents`. Live analysis still drives the beat-level detail on top.

### The shloka, sung along

If you time the verses to your recording, the line being chanted appears beside the dancer (in a column on the left on wide screens, and in a band above the controls on phones). The Devanagari fills with light word by word as it is sung, with the IAST transliteration and a short English rendering beneath it. Press **V** (or the verses button) to cycle between *Sanskrit + English*, *Sanskrit only* and *hidden*.

The words also drive the visuals (`src/shloka/stotram.ts` tags each half-verse with its imagery):

| When the line names…                          | …the scene answers                                       |
| --------------------------------------------- | -------------------------------------------------------- |
| *dhagad-dhagad*, *lalāṭa-pāvaka* (brow fire)   | the third eye opens, the ring of fire flares, sparks fly |
| *bhujaṅga* (serpents)                          | the serpent garland's rim and eyes glow                  |
| *jaṭā… nirjharī* (Ganga in the locks)          | the stream of light falling from the jata brightens      |
| *candra / śekhara* (the crescent)              | the crescent moon flares                                 |
| *nīla-kaṇṭha* (the dark-blue throat)           | the Neelakantha glow rises                               |
| *ḍamaḍ ḍamaḍ* / *dhimid dhimid* (drums)        | he shakes the damaru overhead, a rattle on each word / a small stamp and a drum pulse on each |
| *dhagad … jvalad* (the blaze)                  | he lifts the fire in his hand as the word is sung        |
| *navīna-megha* (storm clouds)                  | lightning across the ranges                              |
| *smaracchidaṃ… antakacchidaṃ* (the destroyer)  | one shockwave per epithet, the last the largest          |
| the start of each verse                        | a stamp and an energy ring, and a new set of dance poses |

Word-level moments are placed by where the word falls in the line (chant moves at a near-even pace per syllable), so they land close to the word rather than exactly on it.

**The included timing** (`public/audio/tandav.lyrics.json`) was made for the recording in `public/audio/` from its isolated vocals, by melody matching, breath points and speech recognition, then checked line by line. It covers verses 1–14 (this recording doesn't sing verse 15), plus the refrains it adds: *oṃ namaḥ śivāya* and *sadāśivaṃ bhajāmyaham*, and the *oṃ namaḥ śivāya* chant that carries Cosmic Fury. Lines that aren't in the stotram carry their own text in the file. An earlier hand-tapped timing is kept in `tandav.lyrics.user.json`.

**Timing it to your recording takes one listen.**

1. Run `npm run dev` and open `http://localhost:5173/?sync`.
2. Click **Enter**. Your track starts and a sync panel appears.
3. Tap **Space** the moment each half-verse *begins*. Use **⌫** to undo, **S** to skip a line your recording leaves out, **B** to step back, **P** to pause, and **←/→** to seek 5 s. Click a marked time to replay from just before it. Taps are shifted 0.12 s earlier to make up for reaction time.
4. The display and the motif choreography use your marks immediately. Click **Download JSON**, save the file as **`public/audio/tandav.lyrics.json`**, and reload.

The file is plain JSON, `{ "lines": [ { "id": "1a", "t": 21.4 }, … ] }`, and you can edit it by hand. Each line can optionally override `deva`, `iast` or `en` if your recording uses a variant reading. Line ids run `1a`, `1b` … `15b`, plus `x1a`–`x2b` for the two verses only some recordings include.

### The included cue file

`public/audio/tandav.cues.json` is tuned to the recording currently in `public/audio/tandav.mp3` (8:34). The dance begins at the first full verse (28.8 s). Cosmic Fury starts at the final build (402.5 s). The climax lands on the swell after the near-silence at 506 s (507.4 s). Because this recording drifts between 72 and 75 BPM, it has no single tempo (`"bpm": 0`); instead `"beats"` lists every beat (tracked offline from the instrumental stem), and the dance steps land on those. Accents that fall within 2.5 s of a sung verse start are merged into that verse's stamp. If you replace the recording, delete or edit this file.

### Overriding the structure by hand (optional)

To overrule the automatic analysis, copy `public/audio/tandav.cues.example.json` to `public/audio/tandav.cues.json`. Any field you set wins, and every field is optional:

```jsonc
{
  "acts": { "awakening": 14.5, "tandav": 52, "fury": 205, "stillness": 258 },
  "climax": 256.8,          // the single largest visual moment
  "endTitle": 272,          // when the closing title appears
  "lightning": [14.5, 52],  // authored lightning strikes
  "accents": [52, 78.4],    // stamps + energy rings + shockwaves
  "bpm": 98,                // tempo if the detected one is wrong; 0 = free tempo
  "beatOffset": 52,         // time of a downbeat
  "beats": [52.0, 52.61]    // every beat, for a recording whose tempo drifts (wins over bpm)
}
```

Precedence for each field: cue file, then automatic analysis, then fixed proportions of the track length.

## How it works

### The five acts

| Act | Name          | What happens                                                                                             |
| --- | ------------- | -------------------------------------------------------------------------------------------------------- |
| I   | The Void      | Sparse dust, a faint orb, the camera tilting down from the stars to a still bronze Nataraja              |
| II  | The Awakening | The first thunder strikes the trident and the bronze comes alive; the ring of fire climbs from the pedestal |
| III | The Tandav    | The dance on the beat, stamps with energy rings, ground shockwaves rolling across the sea                 |
| IV  | Cosmic Fury   | A full spin, denser rhythm, the third eye opening, then Urdhva Tandava and the climax burst               |
| V   | Stillness     | He returns to bronze in the climax burst; fire recedes, the closing title, replay                         |

The authored *envelopes* (energy, halo, fire, dance amplitude, dust) give the piece its build-up, climax and release. Live audio modulates them but never replaces them, so the climax always feels earned.

**The camera** (`src/scene/Camera/shots.ts`) is edited like a film through the dance. Ten framings (a hero shot, a low heroic angle, three-quarter views from both sides, a profile, a wide reveal, a medium shot, a high angle, and close shots that follow the face, the damaru hand and the stamping foot) each drift slowly while they hold. The edit cuts on each sung verse start, where the stamp lands, and blends on each half-verse. Long instrumental passages get a new framing at least every 20 s, every 9 s in Cosmic Fury. The last seconds before the climax hold the full figure inside the ring. With reduced motion there are no cuts and no close-ups of moving limbs.

**Big moments are budgeted.** At most one stamp-and-ring lands every 1.5 s, and a lightning strike that shares a moment with a stamp lights the world less and carries the ring for it, so coinciding cues read as one hit instead of a white-out.

### Audio-reactivity

`src/audio/audioAnalysis.ts` runs a 2048-point FFT and publishes normalised values:

- **bass, mid, high and loudness**, each with its own adaptive floor/peak range and attack/release smoothing
- **bass and high onsets**, from spectral flux with an adaptive threshold (mean + kσ), an absolute floor and a cooldown

The analysis knows nothing about visuals. `src/choreography/director.ts` maps it onto the scene, with gating per act:

| Signal           | Visual response                                                          |
| ---------------- | ------------------------------------------------------------------------ |
| Bass onset       | Ground shockwave, rock impulses, short camera dolly kick                 |
| Strongest hits\* | Stamp, vertical energy ring, sparks from the feet                        |
| Mid energy       | Flame height, turbulence                                                 |
| High onset       | Sparks from the hands, feet and trident; lightning in track mode\*       |
| Loudness         | Overall intensity: particle swirl, halo, bloom                           |

\* With the procedural score, these come from the authored cues instead.

Flashes are rate-limited to under three per second (WCAG 2.3.1). Lightning lights the world with one smooth pulse; only the thin bolt itself flickers.

### The figure

There is no properly licensed, rigged and animated Nataraja model available to download. So the figure is a **procedural articulated rig**, not a static image:

- `src/scene/Shiva/rig.ts` is a point-based skeleton with four arms and analytic two-bone IK, proportioned after the Chola bronzes (broad shoulders, lion waist, a full head on a short neck). Poses are written as hand and foot targets with elbow and knee hints: *Ananda Tandava* (the classic pose), *Lalita*, *Ardha-mandali* (the deep plié), *Katichhinna* (the waist twist), *Bhujangatrasita* (the leg snatched up and across), *Talasamsphotita* (the knee lifted before a stamp), *Urdhva Tandava* (leg raised to the sky), a stamp, and an anticipation pose, plus two gestures: the damaru shaken overhead and the fire lifted high.
- `dance.ts` steps between the poses on the recording's beats (four beats a step in Act III, two in Act IV). Each verse has its own set of poses, refrains and the fury have theirs, and sets change only at a step boundary. It anticipates accents, acts out sung words as gestures, holds Urdhva Tandava at the climax, and keeps the standing foot on the pedestal. Every joint target runs through a spring, stiff for the feet and looser for the hands and head, so the limbs follow through and settle instead of interpolating mechanically.
- `anatomy.ts` sculpts the body: a torso with chest, abdomen and spine, hands held in their mudras (abhaya, gaja hasta, the damaru grip, the flame on the open palm), feet, a face with brow, eyes, lips and long ear lobes, a tiered jata-makuta crown with its fan crest, and the ornaments: necklaces, the sacred thread, the belly band, girdle, armlets, bracelets, anklets and ear rings. The short dhoti and thigh cloth have folds.
- `strands.ts` simulates the flying *jata* (matted locks) and the sash with verlet physics, so they trail the motion with real inertia.
- The dancer is *living bronze* (`bronze.ts`): the same metal as the statue, lit by the scene's halo, fire and lightning, with a halo-coloured rim, warm fire light from below, a soft camera-relative key so the form reads from every angle, faint patina, and a small generated environment to reflect. Lightning outlines him rather than flooding him with light. The crescent moon, damaru, agni (the flame in the upper-left hand), the third eye, Vasuki (the serpent garland), the Ganga falling from the jata, and the Neelakantha throat glow are separate elements. Each one responds to the shloka.

**The bronze.** In the void, and again after the climax, a photogrammetry scan of a real Nataraja bronze stands in for the dancer (`src/scene/Shiva/Statue.tsx`, credited below). The statue comes alive inside the first lightning strike and returns to bronze in the climax burst. Both swaps happen within a flash, and the state comes from the timeline, so seeking and replaying stay correct. If the model fails to load, the dancer stays on screen throughout. `?statue` shows the bronze at any moment.

**To upgrade to a sculpted, rigged model:** load a skinned GLTF in `Shiva.tsx` and drive its bones from the same solved `Skeleton` (`solve()` already gives every joint position). The dance, the anchors (for sparks) and the strand frames will carry on working unchanged.

### Scene layers

`Scene.tsx` composes the layers from back to front:

1. A procedural nebula sky, starfield, occasional meteors, and a vast cloud vortex overhead that turns faster as the dance builds
2. Ridged mountain ranges with Mount Kailash and temple shikharas
3. A mirror-like cosmic sea with analytic reflections and shockwave ripples
4. A cloud sea and haze bands
5. The halo orb, shafts of light fanning out behind the figure, and the prabha mandala (ring of fire)
6. The floating island, whose lava veins ignite outward from the dancer's feet as the fire grows, and the lotus pedestal
7. The trishula (trident)
8. The figure
9. Floating rocks (instanced)
10. Shockwaves, lightning, cosmic dust, embers and sparks (all on the GPU or from preallocated pools)
11. Post-processing: bloom, ACES tone mapping, vignette, grain, and a screen-space shockwave reserved for major accents

---

## Controls

| Input              | Action                                        |
| ------------------ | --------------------------------------------- |
| Space / K          | Play / pause                                  |
| M                  | Mute / unmute (visuals keep reacting)         |
| ↑ / ↓              | Volume                                        |
| R                  | Restart                                       |
| V                  | Verses: Sanskrit + English / Sanskrit / hidden |
| C                  | Cinematic mode (hides all interface)          |
| F                  | Fullscreen                                    |
| Esc                | Leave cinematic mode                          |
| Pointer move       | Camera parallax; the dust parts               |
| Click / tap        | A restrained energy ripple (rate-limited)     |

The on-screen controls also include a **reduce effects** toggle. It turns down flashes, turns off screen distortion and camera impulses, and caps the resolution. The toggle is on by default when the OS asks for reduced motion.

---

## Performance and fallbacks

- No React state changes per frame. Per-frame values live in a plain mutable `stage` object (`src/choreography/stage.ts`), and effects read it inside `useFrame`.
- Particles are animated in shaders or written into preallocated buffers. Rocks and petals are instanced. Every effect pool has a fixed size. GPU resources are disposed on unmount.
- Quality presets (`src/config.ts`) are picked from the device, and the pixel ratio adapts to the measured frame time (`AdaptiveResolution.tsx`). Rendering stops entirely while the tab is hidden.
- If WebGL is missing or the scene fails to start, a still, composed fallback screen is shown. If the soundtrack fails, playback falls back to the procedural score. If audio is unavailable altogether, it falls back to silent mode.

On an Apple-silicon Mac, the most intense act ran at about 17 ms per frame at 2880×1800 in headless Chrome.

---

## Development aids

These query parameters skip the intro and run the choreography silently from any moment:

- `?sync` opens the shloka timing tool (see above)
- `?t=95` starts at 95 s
- `&freeze` holds that moment
- `&cam=close` / `&cam=side` frames the rig tightly or in profile
- `&lit` floods the figure with fill light to inspect its form
- `&statue` shows the bronze statue instead of the dancer

In development, `window.__tandav` exposes the live `stage`, the audio `features`, and `seek(seconds)` (soundtrack mode only).

---

## Project structure

```
src/
  audio/          audioEngine (playback, clock, seek) · audioAnalysis (live FFT features, onsets)
                  trackAnalysis (offline structure + tempo of your recording) · proceduralScore
  shloka/         stotram (the text, with imagery tags) · lyrics (timings, active line)
  choreography/   composition (the score as data) · timeline (acts, cues, envelopes)
                  director (audio + timeline → stage + events) · events · stage · anchors
  scene/
    Shiva/        rig (IK + poses) · dance · strands · geometry · anatomy · bronze · materials · Shiva.tsx · Statue.tsx
    Environment/  Sky · Stars · Meteors · Vortex · Mountains · CosmicSea · Atmosphere
                  Pedestal · Trident · FloatingRocks · Lights
    EnergyEffects/ Halo · RingOfFire · Shockwaves · waves
    Lightning/    Lightning
    Particles/    CosmicDust · Embers · Sparks
    Camera/       CameraRig · shots (shot list + edit)
    PostFX · Interaction · AdaptiveResolution · Scene
  components/
    Experience/   Experience (canvas) · DirectorTick · controller (user actions) · error boundary
    AudioControls/ Controls (playback, volume, meter, progress)
    Interface/    Intro · ActCaption · Shloka · SyncTool · EndTitle · Fallback
  hooks/ state/ utils/
```

---

## Assets that would take it further

| Asset                               | Why                                       | Where it plugs in                          |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------ |
| A licensed, skinned Nataraja GLTF   | Sculpted anatomy, ornaments, real cloth    | `src/scene/Shiva/Shiva.tsx` (keep the rig) |
| A licensed Stotram recording        | The real chant drives the visuals          | `public/audio/tandav.mp3` + lyrics file    |
| HDR star or nebula photography      | Photographic depth in the sky              | `src/scene/Environment/Sky.tsx`            |

Bronze sculpture: [*Shiva Nataraja (Lord of Dance)*](https://zenodo.org/records/10307106), Birmingham Museum of Art (2013 bronze by Sri Pradakaran, Sri Govindan and Sri Pratiban, Sri Rajan Industries, Tamil Nadu). The 3D scan is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It was changed for this project: the scanning surface was removed, the tilt was corrected, and it was simplified to about 20% and compressed (`public/models/nataraja.glb`).

Text: the full Shiv Tandav Stotram (public domain) in Devanagari and IAST, following the common recension, with original short English renderings. Recordings vary, so any line can be overridden from the lyrics file. Fonts: Cormorant Garamond, Inter and Tiro Devanagari Sanskrit, loaded from Google Fonts, with system fallbacks.
