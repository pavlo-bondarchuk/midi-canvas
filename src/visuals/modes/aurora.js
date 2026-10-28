const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Layered polar-light curtains with slow undulation and note-driven energy. */
export default class AuroraRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.energy = 0;
    this.targetEnergy = 0;
    this.curtains = Array.from({ length: 3 }, (_, index) => ({
      hue: [142, 171, 318][index],
      phase: Math.random() * TAU,
      speed: 0.035 + Math.random() * 0.045,
      amplitude: 0.075 + Math.random() * 0.09,
      frequency: 1.2 + Math.random() * 2.4,
      drift: (Math.random() - 0.5) * 0.18,
      depth: index / 2,
    }));
    this.stars = Array.from({ length: 130 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.73,
      r: 0.35 + Math.random() * 1.05,
      phase: Math.random() * TAU,
      twinkle: 0.25 + Math.random() * 0.8,
    }));
    this.strikes = [];
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  noteOn(note, velocity = 90) {
    const strength = clamp(velocity / 127, 0.08, 1);
    this.targetEnergy = Math.min(
      1.2,
      this.targetEnergy + 0.18 + strength * 0.62,
    );
    this.strikes.push({
      x: clamp((note - 21) / 87, 0, 1),
      strength,
      life: 1,
      phase: Math.random() * TAU,
    });
    if (this.strikes.length > 18) this.strikes.shift();
  }

  noteOff() {}
  sustain() {}

  updateAndDraw(ctx, dt = 1 / 60) {
    const w = this.width,
      h = this.height;
    this.time += Math.min(0.05, dt);
    this.targetEnergy *= Math.exp(-0.22 * dt);
    this.energy +=
      (this.targetEnergy - this.energy) * (1 - Math.exp(-1.2 * dt));
    ctx.globalCompositeOperation = "source-over";
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#030815");
    sky.addColorStop(0.52, "#071321");
    sky.addColorStop(0.78, "#101a2b");
    sky.addColorStop(1, "#03050b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Fine stars add scale and depth without competing with the curtains.
    for (const star of this.stars) {
      const alpha =
        0.18 +
        (0.5 + 0.5 * Math.sin(this.time * star.twinkle + star.phase)) * 0.48;
      ctx.fillStyle = `rgba(207,229,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, TAU);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "screen";
    for (const curtain of this.curtains) this.drawCurtain(ctx, curtain, w, h);
    this.drawHorizon(ctx, w, h);
    for (const strike of this.strikes) strike.life -= dt * 0.72;
    this.strikes = this.strikes.filter((strike) => strike.life > 0);
    ctx.globalCompositeOperation = "source-over";
  }

  curtainPoint(c, u, h, layer = 0) {
    const t = this.time;
    const wave = Math.sin(u * TAU * c.frequency + c.phase + t * c.speed);
    const fold = Math.sin(
      u * TAU * (c.frequency * 2.17) - t * c.speed * 1.7 + c.phase * 0.63,
    );
    const broad = Math.sin(u * TAU * 0.48 + t * 0.16 + c.phase) * 0.04;
    const noteLift = this.strikes.reduce((sum, strike) => {
      const distance = Math.abs(u - strike.x);
      return (
        sum +
        Math.exp(-(distance * distance) / 0.0028) *
          strike.life *
          strike.strength *
          0.09
      );
    }, 0);
    const lift =
      0.08 +
      c.depth * 0.12 +
      wave * c.amplitude +
      fold * c.amplitude * 0.38 +
      broad -
      noteLift;
    return h * clamp(lift + layer * 0.035, 0.025, 0.56);
  }

  edgePoint(c, u, h) {
    const noteLift = this.strikes.reduce((sum, strike) => {
      const distance = Math.abs(u - strike.x);
      return sum + Math.exp(-(distance * distance) / 0.0028) * strike.life * strike.strength * 0.055;
    }, 0);
    return h * (0.49 + c.depth * 0.105 +
      0.058 * Math.sin(u * 7.2 + c.phase + this.time * 0.18) +
      0.024 * Math.sin(u * 17.3 - c.phase * 0.72 + this.time * 0.31) +
      0.014 * Math.sin(u * 29 + c.phase * 1.6 - this.time * 0.24) - noteLift);
  }

  drawCurtain(ctx, c, w, h) {
    const energy = clamp(this.energy, 0, 1);
    const layers = 1;
    const segments = 220;
    for (let layer = 0; layer < layers; layer++) {
      const yOffset = layer * h * 0.035;
      const topPath = [];
      const bottomPath = [];
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const x = u * w;
        const y = this.curtainPoint(c, u, h) + yOffset;
        const lower = this.edgePoint(c, u, h) + yOffset;
        topPath.push([x, y]);
        bottomPath.push([x + c.drift * h * 0.16, lower]);
      }
      const minY = Math.max(0, Math.min(...topPath.map((p) => p[1])));
      const maxY = Math.min(h, Math.max(...bottomPath.map((p) => p[1])));
      if (maxY <= minY) continue;
      const gradient = ctx.createLinearGradient(0, minY, 0, maxY);
      const alpha =
        (0.008 + energy * 0.025) * (1 - layer * 0.3) * (1 - c.depth * 0.28);
      gradient.addColorStop(0, `hsla(${c.hue},100%,58%,0)`);
      gradient.addColorStop(0.18, `hsla(${c.hue},100%,55%,${alpha * 0.18})`);
      gradient.addColorStop(0.42, `hsla(${c.hue},100%,52%,${alpha * 0.58})`);
      gradient.addColorStop(0.7, `hsla(${c.hue + 8},100%,58%,${alpha * 0.42})`);
      gradient.addColorStop(0.9, `hsla(${c.hue},100%,45%,${alpha * 0.2})`);
      gradient.addColorStop(1, `hsla(${c.hue},100%,38%,0)`);
      ctx.beginPath();
      topPath.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = bottomPath.length - 1; i >= 0; i--)
        ctx.lineTo(...bottomPath[i]);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Dense, overlapping color columns create a continuous luminous sheet.
      const stripCount = clamp(Math.round(w * 0.9), 400, 600);
      for (let i = 0; i < stripCount; i++) {
        const u = (i + 0.5) / stripCount;
        const upper = this.curtainPoint(c, u, h) + yOffset;
        const lower = this.edgePoint(c, u, h) + yOffset;
        const fold = 0.5 + 0.5 * Math.sin(u * TAU * c.frequency + c.phase + this.time * c.speed);
        const secondaryFold = 0.5 + 0.5 * Math.sin(u * TAU * (c.frequency * 2.2) - c.phase + this.time * c.speed * 1.4);
        const localNote = this.strikes.reduce((sum, strike) => {
          const distance = Math.abs(u - strike.x);
          return sum + Math.exp(-(distance * distance) / 0.0022) * strike.life * strike.strength;
        }, 0);
        const alpha = clamp(0.13 + fold * 0.13 + secondaryFold * 0.09 + energy * 0.12 + localNote * 0.4, 0.1, 0.58);
        const fadeLength = Math.max(h * 0.12, lower - upper);
        const top = Math.max(0, lower - fadeLength * (0.78 + secondaryFold * 0.28 + localNote * 0.16));
        const tilt = Math.sin(u * 5.1 + c.phase + this.time * 0.13) * w * 0.014 + c.drift * w * 0.035;
        const stripWidth = (w / stripCount) * (1.8 + fold * 0.28);
        const gradient = ctx.createLinearGradient(0, top, 0, lower);
        gradient.addColorStop(0, `hsla(${c.hue + 145},100%,62%,0)`);
        gradient.addColorStop(0.12, `hsla(${c.hue + 145},100%,60%,${alpha * 0.56})`);
        gradient.addColorStop(0.36, `hsla(${c.hue + 115},100%,55%,${alpha * 0.78})`);
        gradient.addColorStop(0.68, `hsla(${c.hue},100%,54%,${alpha * 0.88})`);
        gradient.addColorStop(0.9, `hsla(${c.hue + 8},100%,61%,${alpha})`);
        gradient.addColorStop(1, `hsla(${c.hue},100%,58%,${alpha * 0.52})`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(u * w, top);
        ctx.lineTo(u * w + stripWidth, top);
        ctx.lineTo(u * w + stripWidth + tilt, lower);
        ctx.lineTo(u * w + tilt, lower);
        ctx.closePath();
        ctx.fill();
      }

      // One vivid curved hem per curtain carries the glow without parallel outlines.
      const edgeGradient = ctx.createLinearGradient(0, 0, w, 0);
      edgeGradient.addColorStop(0, `hsla(${c.hue},100%,58%,0.1)`);
      edgeGradient.addColorStop(0.28, `hsla(${c.hue + 8},100%,61%,${0.24 + energy * 0.2})`);
      edgeGradient.addColorStop(0.58, `hsla(${c.hue + 24},100%,65%,${0.2 + energy * 0.18})`);
      edgeGradient.addColorStop(0.84, `hsla(${c.hue},100%,61%,${0.24 + energy * 0.2})`);
      edgeGradient.addColorStop(1, `hsla(${c.hue},100%,56%,0.08)`);
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const y = this.edgePoint(c, u, h) + yOffset;
        i ? ctx.lineTo(u * w, y) : ctx.moveTo(u * w, y);
      }
      ctx.strokeStyle = edgeGradient;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 17 + energy * 13;
      ctx.shadowColor = `hsla(${c.hue},100%,58%,0.65)`;
      ctx.shadowBlur = 26 + energy * 18;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  drawHorizon(ctx, w, h) {
    const baseY = h * 0.62;
    const glow = ctx.createLinearGradient(0, baseY - h * 0.09, 0, h);
    glow.addColorStop(0, `rgba(55,255,171,${0.012 + this.energy * 0.035})`);
    glow.addColorStop(0.25, "rgba(40,190,155,0.012)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, baseY - h * 0.09, w, h * 0.3);
  }
}
