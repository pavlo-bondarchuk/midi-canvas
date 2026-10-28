import { hsl, paletteColor as defaultPaletteColor } from "../../palette/palettes.js";

export default class VisualizerRenderer {
  constructor(paletteColor = defaultPaletteColor) {
    this.width = 1;
    this.height = 1;
    this.rise = 0.2;
    this.beams = [];
    this.paletteColor = paletteColor;
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.rise = 0.2;
    this.beams = Array.from({ length: 9 }, (_, i) => ({
      baseX: this.width * ((i + 0.5) / 9),
      x: this.width * ((i + 0.5) / 9),
      energy: 0.12 + Math.random() * 0.08,
      target: 0.12 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.005,
      width: 0.16 + Math.random() * 0.08,
      color: this.paletteColor(34 + i * 7),
    }));
  }
  noteOn(note, velocity, color) {
    if (!this.beams.length) this.resize(this.width, this.height);
    const n = Math.max(0, Math.min(1, (note - 21) / 87)),
      strength = Math.max(0.05, velocity / 127),
      index = Math.min(
        this.beams.length - 1,
        Math.round(n * (this.beams.length - 1)),
      );
    for (let offset = -2; offset <= 2; offset++) {
      const i = index + offset;
      if (i < 0 || i >= this.beams.length) continue;
      const beam = this.beams[i],
        weight = 1 - Math.abs(offset) * 0.2;
      beam.target = Math.min(1.35, beam.target + strength * 0.7 * weight);
      beam.color = this.paletteColor ? this.paletteColor(note + offset) : color;
    }
    this.rise = Math.min(0.94, this.rise + 0.055 + strength * 0.085);
  }
  noteOff() {}
  sustain() {}
  updateAndDraw(ctx, dt = 1 / 60) {
    if (!this.beams.length) this.resize(this.width, this.height);
    const step = dt * 60,
      { width, height } = this;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(3,3,4,${1 - Math.pow(0.78, step)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    this.rise +=
      (Math.max(0.16, this.rise * Math.pow(0.996, step)) - this.rise) *
      0.02 *
      step;
    const center = width * 0.5;
    for (const beam of this.beams) {
      beam.target *= Math.pow(0.986, step);
      beam.energy += (beam.target - beam.energy) * 0.055 * step;
      beam.phase += beam.speed * step * 60;
      const convergence = 0.18 + 0.74 * this.rise,
        targetX = center + (beam.baseX - center) * (1 - convergence);
      beam.x += (targetX - beam.x) * 0.025 * step;
      const rise = Math.min(0.96, 0.18 + this.rise * 0.82 + beam.energy * 0.14),
        top =
          height * (1 - rise) +
          Math.sin(beam.phase) * height * 0.018 +
          Math.sin(beam.phase * 0.47 + beam.baseX * 0.01) * height * 0.012,
        baseY = height * 1.06;
      for (let j = 0; j < 7; j++) {
        const t = j / 6,
          ease = t * t * (3 - 2 * t),
          x =
            beam.baseX +
            (beam.x - beam.baseX) * ease +
            Math.sin(beam.phase + t * 3.2) * width * 0.008 * (1 - t),
          y = baseY + (top - baseY) * t,
          radius =
            width * beam.width * (1 - t * 0.62) * (1 + beam.energy * 0.18),
          alpha = (0.035 + beam.energy * 0.075) * (1 - t * 0.12),
          gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, hsl(beam.color, 22, alpha * 1.35));
        gradient.addColorStop(0.26, hsl(beam.color, 10, alpha));
        gradient.addColorStop(0.62, hsl(beam.color, -4, alpha * 0.34));
        gradient.addColorStop(1, hsl(beam.color, -12, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      const core = ctx.createLinearGradient(0, baseY, 0, top),
        half = width * beam.width * 0.2;
      core.addColorStop(0, hsl(beam.color, 2, 0.03 + beam.energy * 0.035));
      core.addColorStop(0.55, hsl(beam.color, 14, 0.055 + beam.energy * 0.055));
      core.addColorStop(1, hsl(beam.color, 24, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.moveTo(beam.baseX - half, baseY);
      ctx.quadraticCurveTo(
        (beam.baseX + beam.x) * 0.5 - half * 0.35,
        (baseY + top) * 0.5,
        beam.x - half * 0.18,
        top,
      );
      ctx.lineTo(beam.x + half * 0.18, top);
      ctx.quadraticCurveTo(
        (beam.baseX + beam.x) * 0.5 + half * 0.35,
        (baseY + top) * 0.5,
        beam.baseX + half,
        baseY,
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
