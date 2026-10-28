import { hsl, paletteColor as paletteHue } from "../../palette/palettes.js";

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const randomFrom = (seed) => {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** A diagonal galactic current of colored dust with note-triggered star knots. */
export default class SpotsRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.energy = 0;
    this.dust = [];
    this.bursts = [];
    this.knots = [];
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const rand = randomFrom(1729);
    const count = clamp(Math.round((width * height) / 145), 900, 5200);
    this.dust = Array.from({ length: count }, () => {
      // A broad diagonal galaxy with two branching currents and deep stray stars.
      const x = rand();
      const centerY = 0.8 - x * 0.58;
      const branch = rand();
      let spread;
      if (branch < 0.58) spread = (rand() + rand() + rand() - 1.5) * 0.28;
      else if (branch < 0.76) spread = -0.06 - Math.pow(x, 0.8) * 0.29 + (rand() - 0.5) * 0.16;
      else if (branch < 0.93) spread = 0.05 + Math.pow(x, 0.7) * 0.25 + (rand() - 0.5) * 0.18;
      else spread = (rand() - 0.5) * 0.95;
      return {
        x,
        y: clamp(centerY + spread, 0.015, 0.985),
        radius: rand() < 0.085 ? 1.5 + rand() * 3.2 : 0.3 + rand() * 1.2,
        phase: rand() * TAU,
        speed: 0.1 + rand() * 0.8,
        alpha: 0.2 + rand() * 0.68,
        hue: this.nativeHue(x, rand()),
        lane: Math.abs(spread),
        twinkle: rand() * 0.5 + 0.5,
      };
    });
  }
  nativeHue(x, seed = 0.5) {
    // Reference moves from amber and hot pink through violet to ice blue.
    const hue = x < 0.42
      ? 12 - (x / 0.42) * 46
      : x < 0.72
        ? 326 - ((x - 0.42) / 0.3) * 58
        : 268 - ((x - 0.72) / 0.28) * 52;
    return hue + (seed - 0.5) * 18;
  }
  noteOn(note, velocity = 90, color) {
    const x = clamp((note - 21) / 87, 0, 1);
    const centerY = 0.8 - x * 0.58;
    const strength = clamp(velocity / 127, 0.06, 1);
    const hue = color?.hue ?? this.nativeHue(x);
    this.energy = Math.min(1, this.energy + strength * 0.34);
    this.knots.push({ x, y: centerY, strength, hue, age: 0, life: 1.7 + strength * 1.8, phase: Math.random() * TAU });
    const count = 55 + Math.round(strength * 105);
    const angleBase = -0.5;
    for (let i = 0; i < count; i++) {
      const angle = angleBase + (Math.random() - 0.5) * 2.5;
      const speed = 0.035 + Math.random() * (0.13 + strength * 0.18);
      const spread = 0.004 + Math.random() * (0.012 + strength * 0.025);
      this.bursts.push({
        x: x + (Math.random() - 0.5) * 0.008,
        y: centerY + (Math.random() - 0.5) * 0.018,
        originX: x,
        originY: centerY,
        angle,
        speed,
        spiral: (Math.random() - 0.5) * 1.1,
        spread,
        radius: 0.45 + Math.random() * (strength * 1.2 + 0.4),
        hue: hue + (Math.random() - 0.5) * 45,
        alpha: 0.4 + Math.random() * 0.6,
        strength,
        life: 1.6 + Math.random() * 2.4,
        age: 0,
      });
    }
    if (this.bursts.length > 1100) this.bursts.splice(0, this.bursts.length - 1100);
    if (this.knots.length > 22) this.knots.shift();
  }
  noteOff() {}
  sustain() {}
  updateAndDraw(ctx, dt = 1 / 60) {
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    this.energy *= Math.exp(-0.7 * dt);
    const { width: w, height: h } = this;
    ctx.globalCompositeOperation = "source-over";
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#090515");
    bg.addColorStop(0.48, "#08091e");
    bg.addColorStop(1, "#030a1b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Diffuse nebulae give the dust a broad, diagonal field of colored light.
    ctx.globalCompositeOperation = "screen";
    const nebula = ctx.createLinearGradient(0, h * 0.86, w, h * 0.16);
    nebula.addColorStop(0, "rgba(255,44,39,0.095)");
    nebula.addColorStop(0.24, "rgba(255,37,132,0.105)");
    nebula.addColorStop(0.52, "rgba(155,42,255,0.08)");
    nebula.addColorStop(0.76, "rgba(48,96,255,0.09)");
    nebula.addColorStop(1, "rgba(13,116,255,0.09)");
    ctx.fillStyle = nebula;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.53);
    ctx.bezierCurveTo(w * 0.22, h * 0.34, w * 0.33, h * 0.98, w * 0.57, h * 0.53);
    ctx.bezierCurveTo(w * 0.77, h * 0.2, w * 0.87, h * 0.32, w, h * 0.03);
    ctx.lineTo(w, h * 0.4);
    ctx.bezierCurveTo(w * 0.79, h * 0.67, w * 0.72, h * 0.76, w * 0.55, h * 0.82);
    ctx.bezierCurveTo(w * 0.3, h * 0.96, w * 0.25, h * 0.54, 0, h * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";

    // Tiny stars beyond the galactic disk establish the dark cosmic depth.
    for (const p of this.dust) {
      p.phase += dt * p.speed;
      const twinkle = 0.55 + 0.45 * Math.sin(p.phase);
      const alpha = p.alpha * twinkle * (p.lane < 0.1 ? 0.9 : 0.68);
      const x = p.x * w + Math.sin(p.phase * 0.24) * 1.4;
      const y = p.y * h + Math.cos(p.phase * 0.2) * 1.2;
      if (p.radius > 1.5) {
        const r = p.radius * (5 + this.energy * 3);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
        glow.addColorStop(0, `hsla(${p.hue},100%,78%,${alpha * 0.12})`);
        glow.addColorStop(0.28, `hsla(${p.hue},95%,64%,${alpha * 0.055})`);
        glow.addColorStop(1, `hsla(${p.hue},90%,45%,0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.fillStyle = `hsla(${p.hue},100%,${p.radius > 1.5 ? 74 : 81}%,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, p.radius * twinkle, 0, TAU);
      ctx.fill();
    }

    // Layered curved arm filaments shape the diagonal stellar river.
    const arms = 11;
    for (let arm = 0; arm < arms; arm++) {
      const phase = this.time * (0.08 + arm * 0.004) + arm * 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        const x = u * w;
        const centerY = h * (0.8 - u * 0.58);
        const fan = (arm - (arms - 1) * 0.5) / ((arms - 1) * 0.5);
        const spread = 0.035 + 0.21 * Math.pow(u, 1.15);
        const branch = Math.sin(u * TAU * 0.7 + phase) * h * 0.018;
        const y = centerY + h * fan * spread + branch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const hue = 330 - arm * 13;
      ctx.strokeStyle = `hsla(${hue},100%,${65 + (arm % 3) * 4}%,${0.025 + this.energy * 0.05})`;
      ctx.lineWidth = 0.5 + (arm % 3) * 0.35;
      ctx.stroke();
    }

    for (const knot of this.knots) {
      knot.age += dt;
      const t = knot.age / knot.life;
      const x = knot.x * w, y = knot.y * h;
      const radius = Math.min(w, h) * (0.014 + t * 0.025) * knot.strength;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.9);
      glow.addColorStop(0, `hsla(${knot.hue},100%,80%,${(1 - t) * 0.72})`);
      glow.addColorStop(0.12, `hsla(${knot.hue + 12},100%,64%,${(1 - t) * 0.38})`);
      glow.addColorStop(1, `hsla(${knot.hue},100%,45%,0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius * 1.9, y - radius * 1.9, radius * 3.8, radius * 3.8);
      knot.phase += dt * 0.9;
    }
    this.knots = this.knots.filter((knot) => knot.age < knot.life);

    for (const p of this.bursts) {
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) continue;
      const travel = p.speed * p.age;
      const angle = p.angle + p.spiral * Math.log1p(p.age * 1.5);
      p.x = p.originX + Math.cos(angle) * travel;
      p.y = p.originY + Math.sin(angle) * travel * 0.6;
      const x = p.x * w, y = p.y * h;
      const fade = (1 - t) * p.alpha;
      const r = p.radius * (1 - 0.32 * t);
      if (r > 1.1) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
        halo.addColorStop(0, `hsla(${p.hue},100%,73%,${fade * 0.55})`);
        halo.addColorStop(0.3, `hsla(${p.hue},100%,60%,${fade * 0.15})`);
        halo.addColorStop(1, `hsla(${p.hue},100%,45%,0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
      }
      ctx.fillStyle = `hsla(${p.hue},100%,${68 + (1 - t) * 20}%,${fade})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, TAU);
      ctx.fill();
    }
    this.bursts = this.bursts.filter((p) => p.age < p.life);
    ctx.globalCompositeOperation = "source-over";
  }
}
