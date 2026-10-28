import { keyboardMap } from "./keyboard-map.js";

export class KeyboardInput {
  constructor({ isEnabled, onNoteOn, onNoteOff, onOctaveChange }) {
    this.isEnabled = isEnabled;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.onOctaveChange = onOctaveChange;
    this.base = 48;
    this.pressed = new Map();
  }
  setBase(base) {
    this.base = Math.max(24, Math.min(84, base));
  }
  clear() {
    for (const note of this.pressed.values()) this.onNoteOff(note, 0);
    this.pressed.clear();
  }
  handleDown = (event) => {
    if (!this.isEnabled() || event.metaKey || event.ctrlKey || event.altKey)
      return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (event.repeat) return;
      this.setBase(this.base + (event.key === "ArrowUp" ? 12 : -12));
      this.onOctaveChange(this.base);
      return;
    }
    const key = event.key.toLowerCase();
    if (!(key in keyboardMap) || this.pressed.has(key) || event.repeat) return;
    event.preventDefault();
    const note = this.base + keyboardMap[key];
    this.pressed.set(key, note);
    this.onNoteOn(note, 92);
  };
  handleUp = (event) => {
    if (!this.isEnabled()) return;
    const key = event.key.toLowerCase();
    const note = this.pressed.get(key);
    if (note === undefined) return;
    event.preventDefault();
    this.pressed.delete(key);
    this.onNoteOff(note, 0);
  };
}
