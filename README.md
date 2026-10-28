# MIDI Canvas

A browser MIDI visualizer for digital pianos and MIDI keyboards. It runs as native ES modules without a build step.

## Project layout

```text
index.html                     App shell and mode controls
assets/
  modes/                        SVG mode-card previews
  styles/app.css                Application styles
src/
  app.js                        Startup, orchestration, MIDI UI and animation loop
  input/
    keyboard.js                 Computer keyboard note lifecycle and octave mapping
    midi.js                     MIDI message decoding
  palette/palettes.js           Palette data and color helpers
  ui/mode-controls.js           Mode and palette button wiring
  visuals/renderer.js           Adapter for stateful visualization modes
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

## Input

Connect a MIDI keyboard through the browser's Web MIDI API, or select Computer keyboard and use Z–M and Q–U. The arrow keys change the computer keyboard octave. Notes remain correctly paired when the octave changes while a key is held.

The initial target hardware is a Casio CDP-S110 connected over USB MIDI. The visual output can fill a projector or external display.
