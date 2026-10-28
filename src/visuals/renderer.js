/** Common lifecycle adapter for every visualization mode. */
export class ModeRenderer {
  constructor(factories) {
    this.factories = factories;
    this.width = 1;
    this.height = 1;
    this.name = null;
    this.active = null;
  }
  select(name) {
    this.name = name;
    this.active = this.factories[name]?.() ?? null;
    this.active?.resize(this.width, this.height);
    return this.active;
  }
  reset() {
    if (this.name) this.select(this.name);
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.active?.resize(this.width, this.height);
  }
  noteOn(note, velocity, color) {
    this.active?.noteOn(note, velocity, color);
  }
  noteOff(note) {
    this.active?.noteOff(note);
  }
  sustain(down) {
    this.active?.sustain(down);
  }
  updateAndDraw(context, deltaSeconds) {
    this.active?.updateAndDraw(context, deltaSeconds);
  }
}
