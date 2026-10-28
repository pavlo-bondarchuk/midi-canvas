const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Notes create short-lived fireflies that drift in loose, changing spirals. */
export default class FirefliesRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.lights = [];
    this.sparks = [];
    this.trails = [];
    this.sustainDown = false;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  noteOn(note, velocity = 90, color) {
    const strength = clamp(velocity / 127, 0.12, 1);
    const x = this.width * (0.1 + clamp((note - 21) / 87, 0, 1) * 0.8);
    const y = this.height * (0.35 + Math.random() * 0.35);
    const hue =
      typeof color?.hue === "number" ? color.hue : 38 + Math.random() * 14;
    const count = 3 + Math.round(strength * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const radius = 3 + Math.random() * 22;
      this.lights.push({
        note,
        released: false,
        pendingRelease: false,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        originX: x,
        originY: y,
        phase: angle,
        phaseSpeed:
          (Math.random() < 0.5 ? -1 : 1) * (1.1 + Math.random() * 2.1),
        radius: 7 + Math.random() * 20,
        radialSpeed: 4 + Math.random() * 13,
        driftPhase: Math.random() * TAU,
        driftSpeed: 0.3 + Math.random() * 0.8,
        drift: 5 + Math.random() * 24,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        strength: strength * (0.62 + Math.random() * 0.38),
        hue: hue + (Math.random() - 0.5) * 13,
        life: 5.5 + Math.random() * 4,
        age: 0,
        size: 1.2 + strength * (1.5 + Math.random() * 1.8),
        phaseOffset: Math.random() * TAU,
      });
    }
    // A compact solar flare: curved radial filaments, not a generic circular ring.
    const sparkCount = 32 + Math.round(strength * 26);
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * TAU + (Math.random() - 0.5) * 0.19;
      const speed = 70 + Math.random() * (100 + strength * 220);
      this.sparks.push({
        x,
        y,
        angle,
        speed,
        bend: (Math.random() - 0.5) * 1.2,
        life: 0.45 + Math.random() * 0.55,
        age: 0,
        hue: hue + (Math.random() - 0.5) * 26,
        strength,
        width: 0.5 + Math.random() * 1.4,
      });
    }
    this.trails.push({ x, y, hue, life: 0.72, strength });
    this.trim();
  }

  releaseLights(note) {
    for (const light of this.lights) {
      if (light.note === note) {
        light.released = true;
        light.life = Math.min(light.life, light.age + 3.4);
      }
    }
  }

  noteOff(note) {
    if (this.sustainDown) {
      for (const light of this.lights) {
        if (light.note === note) light.pendingRelease = true;
      }
      return;
    }
    this.releaseLights(note);
  }

  sustain(down) {
    const nextDown = Boolean(down);
    if (this.sustainDown && !nextDown) {
      const notes = new Set(this.lights.filter((light) => light.pendingRelease).map((light) => light.note));
      for (const note of notes) this.releaseLights(note);
      for (const light of this.lights) light.pendingRelease = false;
    }
    this.sustainDown = nextDown;
  }

  trim() {
    if (this.lights.length > 220)
      this.lights.splice(0, this.lights.length - 220);
    if (this.sparks.length > 1600)
      this.sparks.splice(0, this.sparks.length - 1600);
    if (this.trails.length > 80) this.trails.splice(0, this.trails.length - 80);
  }

  updateAndDraw(ctx, dt = 1 / 60) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    const w = this.width,
      h = this.height;
    ctx.globalCompositeOperation = "source-over";
    const fade = 1 - Math.exp(-24.95 * dt);
    ctx.fillStyle = `rgba(3, 3, 5, ${fade})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    this.drawSparks(ctx, dt, w, h);
    this.drawLights(ctx, dt, w, h);
    this.drawFlashes(ctx, dt);
    ctx.globalCompositeOperation = "source-over";
  }

  drawSparks(ctx, dt, w, h) {
    for (const spark of this.sparks) {
      spark.age += dt;
      const p = spark.age / spark.life;
      if (p >= 1) continue;
      const distance = spark.speed * spark.age * (1 - 0.3 * p);
      const curve = spark.bend * spark.age * spark.age * 34;
      const perpX = -Math.sin(spark.angle),
        perpY = Math.cos(spark.angle);
      const x = spark.x + Math.cos(spark.angle) * distance + perpX * curve;
      const y = spark.y + Math.sin(spark.angle) * distance + perpY * curve;
      const tail = distance * (0.08 + 0.1 * spark.strength);
      const tx = x - Math.cos(spark.angle) * tail,
        ty = y - Math.sin(spark.angle) * tail;
      const alpha = Math.pow(1 - p, 1.6) * spark.strength;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.strokeStyle = `hsla(${spark.hue},100%,72%,${alpha})`;
      ctx.lineWidth = spark.width * (1 - p * 0.65);
      ctx.stroke();
      ctx.fillStyle = `hsla(${spark.hue},100%,88%,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + (1 - p) * 1.4, 0, TAU);
      ctx.fill();
    }
    this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
  }

  drawLights(ctx, dt, w, h) {
    for (const light of this.lights) {
      light.age += dt;
      if (light.age >= light.life) continue;
      const fadeIn = clamp(light.age / 0.24, 0, 1);
      const fadeOut = clamp((light.life - light.age) / 1.4, 0, 1);
      const alpha = fadeIn * fadeOut * light.strength;
      light.phase += light.phaseSpeed * dt;
      light.driftPhase += light.driftSpeed * dt;
      light.radius += light.radialSpeed * dt * (light.age < 0.8 ? 1 : 0.13);
      light.vx += Math.sin(light.driftPhase * 0.8) * dt * 2.6;
      light.vy += Math.cos(light.driftPhase * 0.67) * dt * 2.1;
      light.originX += light.vx * dt * 0.035;
      light.originY += light.vy * dt * 0.035;
      const spiralRadius =
        light.radius + Math.sin(light.driftPhase) * light.drift;
      const x = light.originX + Math.cos(light.phase) * spiralRadius;
      const y =
        light.originY +
        Math.sin(light.phase) * spiralRadius * 0.72 +
        Math.sin(light.driftPhase) * light.drift * 0.35;
      const pulse = 0.78 + 0.22 * Math.sin(this.time * 4.2 + light.phaseOffset);
      const core = light.size * pulse;
      const haloRadius = core * (6 + alpha * 4);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      glow.addColorStop(0, `hsla(${light.hue},100%,94%,${alpha})`);
      glow.addColorStop(0.08, `hsla(${light.hue},100%,70%,${alpha * 0.95})`);
      glow.addColorStop(
        0.25,
        `hsla(${light.hue - 8},100%,53%,${alpha * 0.34})`,
      );
      glow.addColorStop(1, `hsla(${light.hue - 14},100%,40%,0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,250,204,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, core * 0.55, 0, TAU);
      ctx.fill();
      if (light.age < 1.3) {
        const tailAlpha = alpha * (1 - light.age / 1.3) * 0.32;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(light.originX, light.originY);
        ctx.strokeStyle = `hsla(${light.hue},100%,72%,${tailAlpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    this.lights = this.lights.filter((light) => light.age < light.life);
  }

  drawFlashes(ctx, dt) {
    for (const flash of this.trails) {
      flash.life -= dt;
      if (flash.life <= 0) continue;
      const a = flash.life * flash.strength * 0.27;
      const g = ctx.createRadialGradient(
        flash.x,
        flash.y,
        0,
        flash.x,
        flash.y,
        26 + (0.72 - flash.life) * 48,
      );
      g.addColorStop(0, `hsla(${flash.hue},100%,84%,${a})`);
      g.addColorStop(1, `hsla(${flash.hue},100%,58%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, 90, 0, TAU);
      ctx.fill();
    }
    this.trails = this.trails.filter((flash) => flash.life > 0);
  }
}
