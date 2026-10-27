# The soundtrack

`tandav.mp3` here is the recording the piece is choreographed to, with `tandav.cues.json`
(acts, climax, beats) and `tandav.lyrics.json` (timed verses).

To use a different recording:

1. Save it as `tandav.mp3` in this folder (`.m4a`, `.ogg`, `.wav` also work). Reload.
   It is detected, analysed (acts, climax, tempo, accents) and choreographed automatically.
2. Optional — time the verses: open `http://localhost:5173/?sync`, tap Space at the start of
   each half-verse, then save the downloaded file here as `tandav.lyrics.json`.
3. Optional — override the automatic structure with `tandav.cues.json`
   (copy `tandav.cues.example.json`).
