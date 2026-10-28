import { palettes, paletteColor } from "./palette/palettes.js";
import { KeyboardInput } from "./input/keyboard.js";
import { decodeMIDIMessage } from "./input/midi.js";
import { ModeRenderer } from "./visuals/renderer.js";
import { bindModeControls } from "./ui/mode-controls.js";
import AuroraRenderer from "./visuals/modes/aurora.js";
import FirefliesRenderer from "./visuals/modes/fireflies.js";
import RainRenderer from "./visuals/modes/rain.js";
import SpotsRenderer from "./visuals/modes/spots.js";
import LinesRenderer from "./visuals/modes/lines.js";
import VisualizerRenderer from "./visuals/modes/visualizer.js";

const connectButton = document.getElementById("connectButton"),
  inputSource = document.getElementById("inputSource"),
  midiDeviceField = document.getElementById("midiDeviceField"),
  keyboardHelp = document.getElementById("keyboardHelp"),
  octaveLabel = document.getElementById("octaveLabel"),
  deviceSelect = document.getElementById("deviceSelect"),
  status = document.getElementById("status"),
  statusText = document.getElementById("statusText"),
  eventValue = document.getElementById("eventValue"),
  noteValue = document.getElementById("noteValue"),
  midiValue = document.getElementById("midiValue"),
  velocityValue = document.getElementById("velocityValue"),
  message = document.getElementById("message"),
  visual = document.getElementById("visual"),
  visualLabel = document.getElementById("visualLabel"),
  canvas = document.getElementById("canvas"),
  fullscreenButton = document.getElementById("fullscreenButton"),
  fullscreenIcon = document.getElementById("fullscreenIcon"),
  modeButtons = [...document.querySelectorAll(".mode-button")],
  paletteButtons = [...document.querySelectorAll(".palette-button")],
  paletteName = document.getElementById("paletteName"),
  auroraControls = document.getElementById("auroraControls"),
  auroraStormInput = document.getElementById("auroraStorm"),
  auroraStormLabel = document.getElementById("auroraStormLabel"),
  context = canvas.getContext("2d", { alpha: false });
let midiAccess = null,
  selectedInput = null,
  inputMode = "midi",
  visualizationMode = "aurora",
  colorPalette = "original",
  width = 0,
  height = 0,
  pixelRatio = 1,
  lastFrameTime = 0;
let auroraStorm = 0.38;
const modeRenderer = new ModeRenderer({
  aurora: () => new AuroraRenderer(),
  fireflies: () => new FirefliesRenderer(),
  rain: () => new RainRenderer(),
  spots: () => new SpotsRenderer(),
  lines: () => new LinesRenderer(),
  visualizer: () =>
    new VisualizerRenderer(
      colorPalette === "original"
        ? undefined
        : (note, offset = 0) => paletteColor(note, offset, colorPalette),
    ),
});
const keyboardInput = new KeyboardInput({
  isEnabled: () => inputMode === "keyboard",
  onNoteOn: (note, velocity) => emitNoteOn(note, velocity, "Keyboard emulator"),
  onNoteOff: (note, velocity) =>
    emitNoteOff(note, velocity, "Keyboard emulator"),
  onOctaveChange: (base) => {
    updateKeyboardLabel(base);
    message.textContent = `Keyboard emulator · ${noteName(base)}–${noteName(base + 23)}`;
  },
});

const noteNames = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
function noteName(n) {
  return `${noteNames[n % 12]}${Math.floor(n / 12) - 1}`;
}
function setStatus(ok, text) {
  status.dataset.state = ok ? "connected" : "disconnected";
  statusText.textContent = text;
}
function updateKeyboardLabel(base = keyboardInput.base) {
  octaveLabel.textContent = `${noteName(base)}–${noteName(base + 23)}`;
}
function emitNoteOn(note, velocity = 92, source = "Keyboard") {
  eventValue.textContent = "Note On";
  noteValue.textContent = noteName(note);
  midiValue.textContent = note;
  velocityValue.textContent = velocity;
  modeRenderer.noteOn(
    note,
    velocity,
    colorPalette === "original"
      ? undefined
      : paletteColor(note, 0, colorPalette),
  );
  message.textContent = source;
}
function emitNoteOff(note, velocity = 0, source = "Keyboard") {
  eventValue.textContent = "Note Off";
  noteValue.textContent = noteName(note);
  midiValue.textContent = note;
  velocityValue.textContent = velocity;
  modeRenderer.noteOff(note);
  message.textContent = source;
}
function setInputMode(mode) {
  inputMode = mode;
  if (selectedInput)
    selectedInput.onmidimessage = mode === "midi" ? handleMIDIMessage : null;
  keyboardInput.clear();
  const keyboard = mode === "keyboard";
  midiDeviceField.style.display = keyboard ? "none" : "grid";
  keyboardHelp.style.display = keyboard ? "block" : "none";
  connectButton.style.display = keyboard ? "none" : "block";
  if (keyboard) {
    setStatus(true, "Computer keyboard");
    message.textContent = "Play with Z–M and Q–U. Use ↑/↓ to change octave.";
    updateKeyboardLabel();
  } else {
    if (selectedInput) {
      selectedInput.onmidimessage = handleMIDIMessage;
      setStatus(true, selectedInput.name || "MIDI connected");
    } else setStatus(false, "MIDI disconnected");
    message.textContent = "Connect a MIDI device and click “Connect MIDI”.";
  }
}
function resizeCanvas() {
  const r = visual.getBoundingClientRect(),
    max = ["rain", "aurora", "visualizer", "fireflies"].includes(
      visualizationMode,
    )
      ? 1.35
      : 2;
  pixelRatio = Math.min(devicePixelRatio || 1, max);
  width = Math.max(1, Math.round(r.width));
  height = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#050505";
  context.fillRect(0, 0, width, height);
  modeRenderer.resize(width, height);
}
function clearVisuals() {
  modeRenderer.reset();
  modeRenderer.active?.setStorm?.(auroraStorm);
  resizeCanvas();
}
function setVisualizationMode(mode) {
  if (
    !["spots", "lines", "rain", "aurora", "visualizer", "fireflies"].includes(
      mode,
    )
  )
    return;
  visualizationMode = mode;
  modeRenderer.select(mode);
  modeRenderer.active?.setStorm?.(auroraStorm);
  auroraControls.hidden = mode !== "aurora";
  resizeCanvas();
  modeButtons.forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
  );
  visualLabel.textContent = `Live visual · ${{ spots: "Particles", lines: "Lines", rain: "Rain", aurora: "Aurora", visualizer: "Visualizer", fireflies: "Fireflies" }[mode]}`;
}
function setColorPalette(p) {
  if (p !== "original" && !palettes[p]) return;
  colorPalette = p;
  paletteButtons.forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.palette === p)),
  );
  paletteName.textContent =
    p === "original" ? "Original · mode colors" : palettes[p].label;
  clearVisuals();
}
function updateDeviceList() {
  const prev = deviceSelect.value,
    inputs = [...(midiAccess?.inputs.values() || [])];
  deviceSelect.innerHTML = "";
  if (!inputs.length) {
    deviceSelect.innerHTML = '<option value="">No devices available</option>';
    deviceSelect.disabled = true;
    selectedInput = null;
    if (inputMode === "midi") setStatus(false, "MIDI device not found");
    return;
  }
  inputs.forEach((input) => {
    const o = document.createElement("option");
    o.value = input.id;
    o.textContent = input.name || input.manufacturer || "MIDI input";
    deviceSelect.appendChild(o);
  });
  deviceSelect.disabled = false;
  deviceSelect.value = inputs.some((i) => i.id === prev) ? prev : inputs[0].id;
  selectInput(deviceSelect.value);
}
function selectInput(id) {
  if (selectedInput) selectedInput.onmidimessage = null;
  selectedInput = midiAccess?.inputs.get(id) || null;
  if (!selectedInput) {
    if (inputMode === "midi") setStatus(false, "No MIDI device selected");
    return;
  }
  selectedInput.onmidimessage = inputMode === "midi" ? handleMIDIMessage : null;
  if (inputMode === "midi") {
    setStatus(true, selectedInput.name || "MIDI connected");
    message.textContent =
      "Play a note. MIDI events will appear here in real time.";
  }
}
function handleMIDIMessage(event) {
  if (inputMode !== "midi") return;
  const midi = decodeMIDIMessage(event.data);
  if (!midi) return;
  const source = `MIDI · Channel ${midi.channel}`;
  if (midi.type === "noteOn") emitNoteOn(midi.note, midi.velocity, source);
  else if (midi.type === "noteOff")
    emitNoteOff(midi.note, midi.velocity, source);
  else {
    eventValue.textContent = midi.controller === 64 ? "Pedal" : "Control";
    noteValue.textContent =
      midi.controller === 64
        ? midi.value >= 64
          ? "Down"
          : "Up"
        : `CC ${midi.controller}`;
    midiValue.textContent = midi.controller;
    velocityValue.textContent = midi.value;
    if (midi.controller === 64) modeRenderer.sustain(midi.value >= 64);
    message.textContent = source;
  }
}
async function connectMIDI() {
  if (!("requestMIDIAccess" in navigator)) {
    setStatus(false, "Web MIDI unavailable");
    message.textContent =
      "This browser does not support Web MIDI. Use a current version of Chrome or Edge.";
    connectButton.disabled = true;
    return;
  }
  connectButton.disabled = true;
  connectButton.textContent = "Connecting…";
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.addEventListener("statechange", updateDeviceList);
    updateDeviceList();
    connectButton.textContent = "MIDI connected";
  } catch (e) {
    setStatus(false, "MIDI access denied");
    message.textContent = e?.message || "Could not access the MIDI device.";
    connectButton.disabled = false;
    connectButton.textContent = "Connect MIDI";
  }
}
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      if (visual.requestFullscreen) await visual.requestFullscreen();
      else if (visual.webkitRequestFullscreen) visual.webkitRequestFullscreen();
      return;
    }
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {
    message.textContent =
      "Fullscreen mode could not be opened in this browser.";
  }
}
function updateFullscreenState() {
  const f =
    document.fullscreenElement === visual ||
    document.webkitFullscreenElement === visual;
  fullscreenButton.setAttribute(
    "aria-label",
    f ? "Exit fullscreen" : "Open visualization in fullscreen",
  );
  fullscreenButton.title = f ? "Exit fullscreen" : "Fullscreen";
  fullscreenIcon.innerHTML = f
    ? '<path d="M9 3v6H3"></path><path d="M15 3v6h6"></path><path d="M9 21v-6H3"></path><path d="M15 21v-6h6"></path>'
    : '<path d="M8 3H3v5"></path><path d="M16 3h5v5"></path><path d="M8 21H3v-5"></path><path d="M16 21h5v-5"></path>';
  requestAnimationFrame(resizeCanvas);
}
function animate(t) {
  requestAnimationFrame(animate);
  if (t - lastFrameTime < 15.5) return;
  const delta = lastFrameTime ? Math.min(50, t - lastFrameTime) : 16.67;
  lastFrameTime = t;
  modeRenderer.updateAndDraw(context, delta / 1000);
}
connectButton.addEventListener("click", connectMIDI);
inputSource.addEventListener("change", (e) => setInputMode(e.target.value));
deviceSelect.addEventListener("change", (e) => selectInput(e.target.value));
fullscreenButton.addEventListener("click", toggleFullscreen);
auroraStormInput.addEventListener("input", () => {
  auroraStorm = Number(auroraStormInput.value) / 100;
  modeRenderer.active?.setStorm?.(auroraStorm);
  auroraStormLabel.value =
    auroraStorm < 0.3
      ? "Quiet arc"
      : auroraStorm < 0.72
        ? "Active curtains"
        : "Storm overhead";
});
visual.addEventListener("click", (event) => {
  if (
    visualizationMode !== "aurora" ||
    event.target.closest("button, .aurora-controls")
  )
    return;
  const bounds = visual.getBoundingClientRect();
  if (event.clientY - bounds.top < bounds.height * 0.7) {
    modeRenderer.active?.triggerSubstorm?.(
      (event.clientX - bounds.left) / bounds.width,
    );
  }
});
bindModeControls(
  modeButtons,
  paletteButtons,
  setVisualizationMode,
  setColorPalette,
);
visual.addEventListener("dblclick", (e) => {
  if (!e.target.closest(".fullscreen-button")) toggleFullscreen();
});
document.addEventListener("fullscreenchange", updateFullscreenState);
document.addEventListener("webkitfullscreenchange", updateFullscreenState);
document.addEventListener("keydown", keyboardInput.handleDown);
document.addEventListener("keyup", keyboardInput.handleUp);
window.addEventListener("blur", () => keyboardInput.clear());
window.addEventListener("resize", () => {
  resizeCanvas();
});
updateKeyboardLabel();
paletteName.textContent = "Original · mode colors";
modeRenderer.select(visualizationMode);
modeRenderer.active?.setStorm?.(auroraStorm);
visualLabel.textContent = "Live visual · Aurora";
setInputMode("midi");
resizeCanvas();
requestAnimationFrame(() => {
  requestAnimationFrame(animate);
});
