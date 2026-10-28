# MIDI Canvas

A browser MIDI visualizer for digital pianos and MIDI keyboards. It runs as native ES modules without a build step.

## Project layout

```text
index.html                     App shell and mode controls
assets/
  modes/                        Original PNG mode-card previews
  styles/app.css                Application styles
src/
  app.js                        Startup, orchestration, MIDI UI and animation loop
  input/
    keyboard.js                 Computer keyboard note lifecycle and octave mapping
    midi.js                     MIDI message decoding
  palette/palettes.js           Palette data and color helpers
  ui/mode-controls.js           Mode and palette button wiring
  visuals/renderer.js           Adapter for stateful visualization modes
  visuals/aurora/radiance.js     Projected rays, spectral emission and tone mapping
  visuals/modes/
    aurora.js                   Aurora curtain renderer
    fireflies.js                Note-triggered firefly renderer
    rain.js                     Rain, splash and pooled-water renderer
    spots.js                    Expanding particle glows
    lines.js                    Flowing light trails
    visualizer.js               Ambient light beams
```

The app routes note events to the selected renderer. Stateful renderers implement `resize(width, height)`, `noteOn(note, velocity, color)`, `noteOff(note)`, `sustain(down)`, and `updateAndDraw(context, deltaSeconds)`. Palette helpers return `{ hue, saturation, lightness }` colors.

## Run locally

Web MIDI requires HTTPS or localhost. Start a local server from the project root:

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080> in Chrome or Edge. Run the renderer and input checks with `npm test`.

## Reference comparison

The mode cards use the six supplied original PNG images in `assets/modes/`.
The default **Original** palette preserves each mode's reference colors; the
five alternate palettes tint new note events.

Open <http://localhost:8080/tools/reference-lab.html> to compare each reference
with its live renderer. **Reference frame · 4 seconds** runs the same note
phrase for every mode and pauses the results side by side. The per-mode timing
reports Canvas command submission time, not end-to-end display frame rate.

The live renderers do not use reference images as static visualization backgrounds.

## Aurora Curtains

Aurora's motion reference is [Aurora Curtains by Emergent Mind Labs](https://www.emergentmind.com/visualizations/aurora-curtains).
The renderer independently projects four folded light curtains, accumulates
altitude-dependent emission into a bounded floating-point RGB buffer, and
tone-maps it with a soft glow. A dark shoreline separates the sky from its
rippled lake reflection. Green dominates the lower curtain, with dim red
emission above and a pink lower fringe during stronger storms.

Use **Aurora intensity** for a quiet arc or an overhead storm. MIDI velocity,
pitch and playing rate add smooth, localized surges; sustain extends the fade.
Click the sky for a substorm. The other five palettes tint new note surges.
The intensity control is shown only while Aurora is selected.

Focused comparison: <http://localhost:8080/tools/reference-lab.html?mode=aurora>.
The pure raster tests in `tests/aurora.test.cjs` exercise the actual light
calculation without requiring browser Canvas; browser inspection is still
needed to assess the final glow, composition and playback performance.

## Input

Connect a MIDI keyboard through the browser's Web MIDI API, or select Computer keyboard and use Z–M and Q–U. The arrow keys change the computer keyboard octave. Notes remain correctly paired when the octave changes while a key is held.

The initial target hardware is a Casio CDP-S110 connected over USB MIDI. The visual output can fill a projector or external display.
