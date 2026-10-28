import { hsl } from "../../palette/palettes.js";

export default class SpotsRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.particles = [];
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }
  noteOn(note, velocity, color) {
    const n = Math.max(0, Math.min(1, (note - 21) / 87));
    const strength = Math.max(0.05, velocity / 127);
    this.particles.push({
      x: this.width * (0.1 + n * 0.8),
      y: this.height * (0.5 + (Math.random() - 0.5) * 0.18),
      radius: 12 + strength * 72,
      alpha: 0.35 + strength * 0.65,
      color,
      vx: (Math.random() - 0.5) * (1 + strength * 2.5),
      vy: -(0.3 + Math.random() * 1.8 + strength),
      life: 1,
      decay: 0.006 + Math.random() * 0.008,
    });
    if (this.particles.length > 220)
      this.particles.splice(0, this.particles.length - 220);
  }
  noteOff() {}
  sustain() {}
  updateAndDraw(ctx, dt = 1 / 60) {
    const step = dt * 60;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(5,5,5,${1 - Math.pow(0.88, step)})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.life -= p.decay * step;
      p.radius *= Math.pow(1.004, step);
      const alpha = Math.max(0, p.alpha * p.life),
        gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      gradient.addColorStop(0, hsl(p.color, 10, alpha));
      gradient.addColorStop(0.35, hsl(p.color, 0, alpha * 0.55));
      gradient.addColorStop(1, hsl(p.color, -16, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalCompositeOperation = "source-over";
  }
}
