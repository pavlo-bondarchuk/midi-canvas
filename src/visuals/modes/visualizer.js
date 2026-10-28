import { hsl } from "../../palette/palettes.js";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** A field of animated vertical light columns and low reflections. */
export default class VisualizerRenderer {
  constructor(paletteColor = null) {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.rise = 0.18;
    this.beams = [];
    this.paletteColor = paletteColor;
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.beams = Array.from({ length: 104 }, (_, i) => {
      const u = i / 103;
      const seed = Math.sin((i + 1) * 91.7) * 43758.5453;
      const random = seed - Math.floor(seed);
      return {
        u,
        baseHeight: 0.13 + Math.pow(random, 1.45) * 0.56,
        phase: random * Math.PI * 2,
        energy: 0.035 + random * 0.055,
        target: 0.012 + random * 0.035,
        width: 0.35 + random * 0.85,
        hue: u < 0.5 ? 330 + 96 * u : 18 - 96 * (u - 0.5),
        color: this.paletteColor ? this.paletteColor(21 + Math.round(u * 87)) : null,
        hotness: 0.45 + random * 0.55,
      };
    });
    this.rise = 0.18;
  }
  noteOn(note, velocity = 90, color) {
    if (!this.beams.length) this.resize(this.width, this.height);
    const n = clamp((note - 21) / 87, 0, 1),
      strength = clamp(velocity / 127, 0.05, 1),
      index = Math.round(n * (this.beams.length - 1));
    for (let offset = -10; offset <= 10; offset++) {
      const beam = this.beams[index + offset];
      if (!beam) continue;
      const weight = Math.exp(-(offset * offset) / 29);
      beam.target = Math.min(1.65, beam.target + strength * 0.88 * weight);
      if (color) {
        beam.color = color;
        beam.hue = color.hue;
      }
    }
    this.rise = Math.min(0.95, this.rise + strength * 0.12);
  }
  noteOff() {}
  sustain() {}
  updateAndDraw(ctx, dt = 1 / 60) {
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    const { width: w, height: h } = this;
    ctx.globalCompositeOperation = "source-over";
    const background = ctx.createLinearGradient(0, 0, 0, h);
    background.addColorStop(0, "#10030c");
    background.addColorStop(0.55, "#260413");
    background.addColorStop(0.8, "#500b20");
    background.addColorStop(1, "#16040d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    this.rise += (0.18 - this.rise) * (1 - Math.exp(-0.24 * dt));
    ctx.globalCompositeOperation = "lighter";
    const baseline = h * 0.79;
    const reflectionEnd = h * 0.99;
    for (const beam of this.beams) {
      beam.target *= Math.exp(-0.62 * dt);
      beam.energy += (beam.target - beam.energy) * (1 - Math.exp(-3.2 * dt));
      beam.phase += dt * (0.3 + beam.hotness * 0.3);
      const x = beam.u * w;
      const pulse = 0.82 + 0.18 * Math.sin(beam.phase + this.time * 1.1);
      const energy = beam.energy * pulse;
      const peak = 0.026 * Math.sin(beam.u * Math.PI * 2.2 + this.time * 0.12)
        + 0.016 * Math.sin(beam.u * Math.PI * 4.7 - this.time * 0.09);
      const height = h * clamp(beam.baseHeight + peak + energy * 0.16 + this.rise * 0.035, 0.12, 0.76);
      const top = baseline - height;
      const hue = beam.color?.hue ?? beam.hue;
      const palette = beam.color || { hue, saturation: 100, lightness: 58 };
      const warmth = beam.color ? 8 : 20 + (1 - Math.abs(beam.u - 0.5) * 2) * 27;
      const warm = { ...palette, hue: (hue + warmth) % 360, lightness: 60 };
      const gold = { hue: beam.color ? (hue + 14) % 360 : 43, saturation: 100, lightness: 63 };
      const width = Math.max(0.7, w / this.beams.length * beam.width);

      // Tall fine column with a hot core and a soft tapered top.
      const ray = ctx.createLinearGradient(0, top, 0, baseline);
      ray.addColorStop(0, hsl(palette, 6, 0.015 + energy * 0.035));
      ray.addColorStop(0.32, hsl(palette, 2, 0.035 + energy * 0.08));
      ray.addColorStop(0.72, hsl(warm, 5, 0.09 + energy * 0.18));
      ray.addColorStop(0.94, hsl(warm, 16, 0.2 + energy * 0.25));
      ray.addColorStop(1, hsl(gold, 18, 0.28 + energy * 0.34));
      ctx.fillStyle = ray;
      ctx.fillRect(x - width * 1.7, top, width * 3.4, height);

      const core = ctx.createLinearGradient(0, top + height * 0.35, 0, baseline);
      core.addColorStop(0, hsl(palette, 18, 0));
      core.addColorStop(0.65, hsl(warm, 18, 0.08 + energy * 0.16));
      core.addColorStop(1, hsl(gold, 25, 0.18 + energy * 0.32));
      ctx.fillStyle = core;
      ctx.fillRect(x - width * 0.35, top + height * 0.35, width * 0.7, height * 0.65);

      // Mirrored fragments fade within the short reflection below the horizon.
      const reflection = ctx.createLinearGradient(0, baseline, 0, reflectionEnd);
      reflection.addColorStop(0, hsl(warm, 12, 0.07 + energy * 0.09));
      reflection.addColorStop(0.18, hsl(palette, 5, 0.035 + energy * 0.045));
      reflection.addColorStop(0.55, hsl(palette, 0, 0.012 + energy * 0.02));
      reflection.addColorStop(1, hsl(palette, 0, 0));
      ctx.fillStyle = reflection;
      const reflectH = reflectionEnd - baseline;
      const reflectX = x + Math.sin(beam.phase + this.time) * w * 0.0015;
      ctx.fillRect(reflectX - width * 0.62, baseline, width * 1.24, reflectH * (0.35 + beam.hotness * 0.42));
    }

    const horizonGlow = ctx.createLinearGradient(0, baseline - h * 0.03, 0, baseline + h * 0.04);
    horizonGlow.addColorStop(0, "rgba(255,87,46,0)");
    horizonGlow.addColorStop(0.45, "rgba(255,89,38,0.28)");
    horizonGlow.addColorStop(0.53, "rgba(255,210,103,0.46)");
    horizonGlow.addColorStop(1, "rgba(255,67,56,0)");
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, baseline - h * 0.03, w, h * 0.07);
    ctx.globalCompositeOperation = "source-over";
  }
}
