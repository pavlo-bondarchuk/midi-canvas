import { hsl } from "../../palette/palettes.js";

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Slow, silky crossing ribbons with dense filaments and note-driven light. */
export default class LinesRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.energy = 0;
    this.notes = [];
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  noteOn(note, velocity = 90, color) {
    const x = this.width * (0.12 + clamp((note - 21) / 87, 0, 1) * 0.76);
    const strength = clamp(velocity / 127, 0.08, 1);
    this.energy = Math.min(1, this.energy + strength * 0.5);
    this.notes.push({ x, strength, life: 1, color: color || null });
    if (this.notes.length > 32) this.notes.shift();
  }

  noteOff() {}
  sustain() {}

  hueAt(u, offset = 0) {
    // Native reference palette: electric cyan and blue melting into violet and pink.
    const base = { hue: 207 + 108 * u + offset, saturation: 100, lightness: 62 };
    let hueX = base.hue, weightSum = 0, saturation = base.saturation, lightness = base.lightness;
    for (const note of this.notes) {
      if (!note.color) continue;
      const d = (u * this.width - note.x) / Math.max(1, this.width * 0.14);
      const weight = Math.exp(-d * d * 2) * note.life * note.strength * 0.82;
      let delta = ((note.color.hue - base.hue + 540) % 360) - 180;
      hueX += delta * weight;
      saturation += (note.color.saturation - base.saturation) * weight;
      lightness += (note.color.lightness - base.lightness) * weight;
      weightSum += weight;
    }
    return { hue: hueX / (1 + weightSum), saturation: saturation / (1 + weightSum), lightness: lightness / (1 + weightSum) };
  }

  updateAndDraw(ctx, dt = 1 / 60) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    this.energy *= Math.exp(-0.42 * dt);
    for (const note of this.notes) note.life -= dt * 0.42;
    this.notes = this.notes.filter((note) => note.life > 0);

    const { width: w, height: h } = this;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(3,5,20,${1 - Math.exp(-dt * 8)})`;
    ctx.fillRect(0, 0, w, h);

    // A quiet blue-violet field keeps the ribbons luminous between notes.
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(4,17,49,0.24)");
    bg.addColorStop(0.55, "rgba(8,8,43,0.12)");
    bg.addColorStop(1, "rgba(25,4,39,0.2)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ribbons = [
      { phase: 0.15, amp: 0.23, center: 0.4, hue: -7 },
      { phase: 2.0, amp: 0.2, center: 0.57, hue: 4 },
      { phase: 4.1, amp: 0.18, center: 0.49, hue: 16 },
    ];
    for (let ri = 0; ri < ribbons.length; ri++) {
      const ribbon = ribbons[ri];
      const points = 100;
      const centerline = new Float32Array(points + 1);
      const topEdge = new Float32Array(points + 1);
      const bottomEdge = new Float32Array(points + 1);
      const halfWidth = h * (0.072 + 0.018 * Math.sin(this.time * 0.16 + ribbon.phase));
      for (let i = 0; i <= points; i++) {
        const u = i / points;
        const ripple = this.notes.reduce((sum, note) => {
          const d = (u * w - note.x) / Math.max(1, w * 0.22);
          return sum + Math.exp(-d * d * 2.2) * note.life * note.strength * 0.014;
        }, 0);
        centerline[i] = h * (ribbon.center
          + ribbon.amp * Math.sin(u * TAU * 1.1 + ribbon.phase + this.time * 0.28)
          + 0.016 * Math.sin(u * TAU * 1.8 - ribbon.phase * 0.7 - this.time * 0.18)
          + ripple);
        const widthWave = 0.9 + 0.1 * Math.sin(u * TAU * 0.64 - ribbon.phase);
        topEdge[i] = -halfWidth * (0.82 + 0.16 * Math.sin(u * TAU * 0.72 + ribbon.phase));
        bottomEdge[i] = halfWidth * widthWave;
      }

      // Build a broad, translucent sheet around the slow centerline.
      const sheet = ctx.createLinearGradient(0, 0, 0, h);
      sheet.addColorStop(0, "rgba(4,15,43,0)");
      sheet.addColorStop(0.45, `hsla(${this.hueAt(0.55, ribbon.hue).hue},100%,60%,${0.035 + this.energy * 0.025})`);
      sheet.addColorStop(0.55, `hsla(${this.hueAt(0.55, ribbon.hue).hue},100%,58%,${0.075 + this.energy * 0.045})`);
      sheet.addColorStop(1, "rgba(26,5,42,0)");
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w;
        const y = centerline[i] + topEdge[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let i = points; i >= 0; i--) ctx.lineTo((i / points) * w, centerline[i] + bottomEdge[i]);
      ctx.closePath();
      ctx.fillStyle = sheet;
      ctx.fill();

      // A shared horizontal color gradient keeps every continuous fiber in sync.
      const fiberGradient = ctx.createLinearGradient(0, 0, w, 0);
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        fiberGradient.addColorStop(u, hsl(this.hueAt(u, ribbon.hue), 12, 0.19 + this.energy * 0.07));
      }
      const fibers = Math.min(128, Math.max(88, Math.round(w * 0.11)));
      for (let i = 0; i < fibers; i++) {
        const q = (i + 0.5) / fibers;
        const offset = (q * 2 - 1) * 0.93;
        ctx.beginPath();
        for (let j = 0; j <= points; j++) {
          const edge = offset < 0 ? topEdge[j] : bottomEdge[j];
          const y = centerline[j] + edge * Math.abs(offset);
          const x = (j / points) * w;
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = fiberGradient;
        ctx.lineWidth = i % 13 === 0 ? 0.78 : 0.42;
        ctx.stroke();
      }

      // Bright edge stitches trace the most luminous crest of each ribbon.
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * w, y = centerline[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const edge = ctx.createLinearGradient(0, 0, w, 0);
      edge.addColorStop(0, `rgba(31,132,255,${0.42 + this.energy * 0.25})`);
      edge.addColorStop(0.42, `rgba(89,135,255,${0.42 + this.energy * 0.22})`);
      edge.addColorStop(0.72, `rgba(179,66,255,${0.5 + this.energy * 0.24})`);
      edge.addColorStop(1, `rgba(255,50,221,${0.45 + this.energy * 0.2})`);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.4 + this.energy * 1.3;
      ctx.shadowBlur = 10 + this.energy * 15;
      ctx.shadowColor = ri === 0 ? "#438cff" : "#cf43ff";
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalCompositeOperation = "source-over";
  }
}
