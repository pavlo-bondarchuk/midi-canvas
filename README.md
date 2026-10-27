# MIDI Canvas

Browser-based Web MIDI visualizer for digital pianos and MIDI keyboards.

The first prototype connects directly to a MIDI device from the browser, displays live MIDI events and turns played notes into a generative Canvas visualization.

## Current prototype

- Web MIDI connection initiated by user action
- MIDI input device selector
- Live Note On / Note Off monitoring
- Note name and MIDI note number
- Velocity monitoring
- Sustain pedal / Control Change monitoring
- Generative Canvas reaction to played notes
- Responsive single-file prototype

## Run locally

Web MIDI should be opened from a secure context. Use either HTTPS or localhost.

For a simple local server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

Use a current Chromium-based browser such as Chrome or Edge.

## Hardware flow

```text
Digital piano / MIDI keyboard
        ↓ USB MIDI
Laptop / desktop
        ↓ Web MIDI API
Browser
        ↓
Canvas visualization
        ↓ HDMI / external display
Projector
```

## Initial target hardware

Casio CDP-S110 connected to the laptop by USB.

## Planned direction

- Fullscreen projector mode
- Separate control and visual views
- Multiple visualization modes
- Note range mapping
- Velocity-sensitive visuals
- Sustain-aware visual persistence
- Chord-aware generative structures
