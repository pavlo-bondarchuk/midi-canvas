const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Note-triggered rain with impacts, splashes, spreading puddles and slow drainage. */
export default class RainRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.drops = [];
    this.splashes = [];
    this.ripples = [];
    this.water = new Float32Array(96);
    this.energy = 0;
    this.sustainDown = false;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  noteOn(note, velocity = 90, color) {
    const strength = clamp(velocity / 127, 0.08, 1);
    const x = this.width * (0.08 + clamp((note - 21) / 87, 0, 1) * 0.84);
    const hue =
      typeof color?.hue === "number" ? color.hue : 214 + Math.random() * 44;
    const count = 5 + Math.round(strength * 11);
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: x + (Math.random() - 0.5) * (14 + strength * 42),
        y: -Math.random() * this.height * 0.28 - 4,
        vx: (Math.random() - 0.5) * (8 + strength * 10),
        vy: 90 + Math.random() * 55,
        gravity: 240 + Math.random() * 180,
        length: 10 + Math.random() * 23 + strength * 22,
        width: 0.6 + Math.random() * 0.65 + strength * 0.5,
        alpha: 0.32 + Math.random() * 0.34 + strength * 0.24,
        hue: hue + (Math.random() - 0.5) * 28,
        strength,
        phase: Math.random() * TAU,
      });
    }
    this.energy = Math.min(1, this.energy + strength * 0.28);
    if (this.drops.length > 950) this.drops.splice(0, this.drops.length - 950);
  }

  noteOff() {}
  sustain(down) {
    this.sustainDown = Boolean(down);
  }

  updateAndDraw(ctx, dt = 1 / 60) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    const w = this.width,
      h = this.height;
    const horizon = h * 0.88;
    this.energy *= Math.exp(-0.7 * dt);
    ctx.globalCompositeOperation = "source-over";
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#030a18");
    bg.addColorStop(0.55, "#09132a");
    bg.addColorStop(0.84, "#111332");
    bg.addColorStop(1, "#08081a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    this.updateDrops(ctx, dt, w, h, horizon);
    this.updateWater(dt);
    ctx.globalCompositeOperation = "lighter";
    this.drawWater(ctx, w, h, horizon);
    this.drawRipples(ctx, dt, w, h, horizon);
    this.drawSplashes(ctx, dt, w, h, horizon);
    ctx.globalCompositeOperation = "source-over";
  }

  updateDrops(ctx, dt, w, h, horizon) {
    ctx.globalCompositeOperation = "screen";
    for (const drop of this.drops) {
      drop.phase += dt * 2;
      drop.vy += drop.gravity * dt;
      drop.x += (drop.vx + Math.sin(drop.phase) * 2.5) * dt;
      drop.y += drop.vy * dt;
      const impactY =
        horizon - this.water[this.waterIndex(drop.x, w)] * h * 0.13;
      const fadeTop = clamp((drop.y + 20) / 50, 0, 1);
      const fadeBottom = clamp((impactY - drop.y) / 38, 0, 1);
      const alpha = drop.alpha * fadeTop * fadeBottom;
      const tail = drop.length * (0.65 + Math.min(1, drop.vy / 480));
      const gradient = ctx.createLinearGradient(
        drop.x,
        drop.y - tail,
        drop.x,
        drop.y + 3,
      );
      gradient.addColorStop(0, `hsla(${drop.hue},85%,75%,0)`);
      gradient.addColorStop(0.5, `hsla(${drop.hue},95%,70%,${alpha * 0.55})`);
      gradient.addColorStop(1, `hsla(${drop.hue + 12},100%,91%,${alpha})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = drop.width;
      ctx.beginPath();
      ctx.moveTo(drop.x - drop.vx * 0.018, drop.y - tail);
      ctx.lineTo(drop.x, drop.y);
      ctx.stroke();
      if (drop.y >= impactY && drop.y < h + drop.length)
        this.impact(drop, horizon, w, h);
    }
    this.drops = this.drops.filter(
      (drop) =>
        drop.y < horizon - this.water[this.waterIndex(drop.x, w)] * h * 0.13,
    );
  }

  waterIndex(x, width) {
    return clamp(
      Math.floor((x / width) * this.water.length),
      0,
      this.water.length - 1,
    );
  }

  impact(drop, horizon, w, h) {
    if (drop.impacted) return;
    drop.impacted = true;
    const index = this.waterIndex(drop.x, w);
    const deposit = 0.006 + drop.strength * 0.014;
    this.water[index] = Math.min(0.95, this.water[index] + deposit);
    this.ripples.push({
      x: drop.x,
      y: horizon - this.water[index] * h * 0.13,
      radius: 1,
      speed: 22 + drop.strength * 62,
      life: 1,
      hue: drop.hue,
      strength: drop.strength,
    });
    const count = 3 + Math.round(drop.strength * 5);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI + Math.random() * Math.PI;
      const speed = 22 + Math.random() * (42 + drop.strength * 75);
      this.splashes.push({
        x: drop.x,
        y: horizon - this.water[index] * h * 0.13,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(Math.abs(angle)) * speed - 16,
        gravity: 180,
        life: 0.45 + Math.random() * 0.4,
        age: 0,
        hue: drop.hue,
        strength: drop.strength,
        size: 0.6 + Math.random() * 1.3,
      });
    }
  }

  updateWater(dt) {
    // Gravity smooths each local puddle into its neighbors; evaporation is gradual.
    const next = new Float32Array(this.water.length);
    for (let i = 0; i < this.water.length; i++) {
      const left = this.water[Math.max(0, i - 1)],
        right = this.water[Math.min(this.water.length - 1, i + 1)];
      const diffusion =
        (left + right - 2 * this.water[i]) * Math.min(0.18, dt * 2.2);
      const evaporation = this.sustainDown ? 0.005 : 0.035;
      next[i] = Math.max(
        0,
        this.water[i] + diffusion - this.water[i] * dt * evaporation,
      );
    }
    this.water = next;
  }

  drawWater(ctx, w, h, horizon) {
    const level =
      this.water.reduce((sum, value) => sum + value, 0) / this.water.length;
    const crest = h * (0.006 + level * 0.115);
    const surface = (u, i) =>
      horizon -
      this.water[i] * h * 0.13 +
      Math.sin(u * 16 + this.time * 0.8) * crest * 0.18 +
      Math.sin(u * 39 - this.time * 0.53) * crest * 0.08;
    ctx.beginPath();
    for (let i = 0; i < this.water.length; i++) {
      const u = i / (this.water.length - 1),
        x = u * w,
        y = surface(u, i);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const pool = ctx.createLinearGradient(0, horizon - h * 0.04, 0, h);
    pool.addColorStop(0, `rgba(84,150,255,${0.09 + level * 0.5})`);
    pool.addColorStop(0.15, `rgba(43,87,185,${0.12 + level * 0.4})`);
    pool.addColorStop(1, "rgba(15,20,67,0.86)");
    ctx.fillStyle = pool;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < this.water.length; i++) {
      const u = i / (this.water.length - 1),
        x = u * w,
        y = surface(u, i);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = `rgba(143,196,255,${0.2 + this.energy * 0.24 + level * 0.32})`;
    ctx.lineWidth = 1 + level * 1.4;
    ctx.stroke();

    // Long dim reflections sway below the waterline after each strike.
    ctx.globalAlpha = 0.1 + level * 0.22;
    for (let i = 0; i < 26; i++) {
      const u = (i + 0.5) / 26;
      const x = u * w + Math.sin(this.time * 0.35 + i) * 4;
      const y = horizon + 5 + Math.sin(i * 3 + this.time * 0.45) * 5;
      const len =
        5 + this.water[Math.floor(u * (this.water.length - 1))] * h * 0.7;
      ctx.strokeStyle = i % 3 ? "rgba(113,165,255,.7)" : "rgba(205,188,255,.7)";
      ctx.lineWidth = 1 + (i % 3) * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y);
      ctx.lineTo(x + len / 2, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawRipples(ctx, dt, w, h, horizon) {
    for (const ripple of this.ripples) {
      ripple.radius += ripple.speed * dt;
      ripple.life -= dt * (0.46 + (ripple.radius / Math.max(1, w)) * 0.35);
      const alpha = Math.max(0, ripple.life) * (0.22 + ripple.strength * 0.34);
      ctx.beginPath();
      ctx.ellipse(
        ripple.x,
        ripple.y,
        ripple.radius,
        ripple.radius * 0.19,
        0,
        0,
        TAU,
      );
      ctx.strokeStyle = `hsla(${ripple.hue},100%,78%,${alpha})`;
      ctx.lineWidth = Math.max(0.55, 1.5 * ripple.life);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(
        ripple.x,
        ripple.y + 1,
        ripple.radius * 0.68,
        ripple.radius * 0.12,
        0,
        0,
        TAU,
      );
      ctx.strokeStyle = `hsla(${ripple.hue + 8},100%,84%,${alpha * 0.42})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    this.ripples = this.ripples.filter(
      (ripple) => ripple.life > 0 && ripple.radius < Math.max(w, h) * 0.6,
    );
  }

  drawSplashes(ctx, dt, w, h, horizon) {
    for (const drop of this.splashes) {
      drop.age += dt;
      drop.vy += drop.gravity * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      const fade = Math.max(0, 1 - drop.age / drop.life);
      ctx.fillStyle = `hsla(${drop.hue},100%,82%,${fade * drop.strength})`;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.size * fade, 0, TAU);
      ctx.fill();
    }
    this.splashes = this.splashes.filter(
      (drop) => drop.age < drop.life && drop.y < h,
    );
  }
}
