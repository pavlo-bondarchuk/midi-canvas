import { hsl } from "../../palette/palettes.js";

export default class LinesRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.strokes = [];
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }
  noteOn(note, velocity, color) {
    const n = Math.max(0, Math.min(1, (note - 21) / 87)),
      strength = Math.max(0.05, velocity / 127);
    this.strokes.push({
      x: this.width * (0.08 + n * 0.84),
      y: this.height * (0.18 + (1 - n) * 0.64),
      length: 90 + strength * Math.min(this.width * 0.32, 330),
      angle: ((note % 12) / 12 - 0.5) * 0.9 + (Math.random() - 0.5) * 0.35,
      color,
      alpha: 0.4 + strength * 0.6,
      lineWidth: 1.5 + strength * 10,
      speed: 0.35 + strength * 1.7,
      wave: 8 + strength * 28,
      phase: Math.random() * Math.PI * 2,
      life: 1,
      decay: 0.005 + Math.random() * 0.006,
    });
    if (this.strokes.length > 140)
      this.strokes.splice(0, this.strokes.length - 140);
  }
  noteOff() {}
  sustain() {}
  updateAndDraw(ctx, dt = 1 / 60) {
    const step = dt * 60;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(5,5,5,${1 - Math.pow(0.915, step)})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of this.strokes) {
      s.life -= s.decay * step;
      s.phase += (0.018 + s.speed * 0.006) * step;
      s.x += Math.cos(s.angle) * s.speed * step;
      s.y += Math.sin(s.angle) * s.speed * step;
      const a = Math.max(0, s.alpha * s.life),
        dx = Math.cos(s.angle) * s.length,
        dy = Math.sin(s.angle) * s.length,
        px = -Math.sin(s.angle),
        py = Math.cos(s.angle),
        x1 = s.x - dx * 0.5,
        y1 = s.y - dy * 0.5,
        x2 = s.x + dx * 0.5,
        y2 = s.y + dy * 0.5,
        bend = Math.sin(s.phase) * s.wave,
        cx = s.x + px * bend,
        cy = s.y + py * bend;
      ctx.shadowBlur = 12 + s.lineWidth * 2;
      ctx.shadowColor = hsl(s.color, 3, a * 0.75);
      ctx.strokeStyle = hsl(s.color, 6, a);
      ctx.lineWidth = s.lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hsl(s.color, 24, a * 0.7);
      ctx.lineWidth = Math.max(1, s.lineWidth * 0.18);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
    }
    this.strokes = this.strokes.filter((s) => s.life > 0);
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
  }
}
