const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;

export default class AuroraRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.energy = 0.12;
    this.targetEnergy = 0.12;
    this.impulses = [];
    this.curtains = [
      this.makeCurtain(146, 0.22, 0.74, 0.24, 0.03),
      this.makeCurtain(176, 0.38, 0.68, 0.19, -0.02),
      this.makeCurtain(214, 0.56, 0.61, 0.16, 0.018),
      this.makeCurtain(310, 0.72, 0.55, 0.14, -0.025),
    ];
    this.stars = Array.from({ length: 115 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.86,
      radius: 0.35 + Math.random() * 0.85,
      alpha: 0.08 + Math.random() * 0.22,
      phase: Math.random() * TAU,
      speed: 0.12 + Math.random() * 0.42,
    }));
  }

  makeCurtain(hue, base, reach, amplitude, drift) {
    return {
      hue,
      targetHue: hue,
      base,
      reach,
      amplitude,
      drift,
      phase: Math.random() * TAU,
      phase2: Math.random() * TAU,
      speed: 0.035 + Math.random() * 0.035,
      frequency: 0.52 + Math.random() * 0.42,
      folds: 2.2 + Math.random() * 1.7,
      breathing: Math.random() * TAU,
    };
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  noteOn(note, velocity = 90, color) {
    const strength = clamp(velocity / 127, 0.08, 1);
    const x = clamp((note - 21) / 87, 0, 1);
    this.targetEnergy = clamp(this.targetEnergy + 0.1 + strength * 0.24, 0.12, 0.82);
    this.impulses.push({ x, strength, life: 1, width: 0.035 + strength * 0.055 });
    if (this.impulses.length > 12) this.impulses.shift();
    if (color && Number.isFinite(color.hue)) {
      const index = Math.min(this.curtains.length - 1, Math.floor(x * this.curtains.length));
      this.curtains[index].targetHue = color.hue;
    }
  }

  noteOff() {}
  sustain() {}

  updateAndDraw(ctx, dt = 1 / 60) {
    const delta = Math.min(0.05, dt);
    this.time += delta;
    this.targetEnergy = mix(this.targetEnergy, 0.12, 1 - Math.exp(-0.22 * delta));
    this.energy = mix(this.energy, this.targetEnergy, 1 - Math.exp(-1.15 * delta));

    for (const impulse of this.impulses) impulse.life -= delta * 0.34;
    this.impulses = this.impulses.filter((impulse) => impulse.life > 0);

    for (const curtain of this.curtains) {
      curtain.hue = this.mixHue(curtain.hue, curtain.targetHue, 1 - Math.exp(-0.3 * delta));
      curtain.targetHue = this.mixHue(curtain.targetHue, curtain.hue, 1 - Math.exp(-0.05 * delta));
    }

    this.drawSky(ctx);
    this.drawStars(ctx);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = this.curtains.length - 1; i >= 0; i--) this.drawCurtain(ctx, this.curtains[i], i);
    ctx.restore();

    this.drawVignette(ctx);
  }

  mixHue(a, b, t) {
    let d = ((b - a + 540) % 360) - 180;
    return (a + d * t + 360) % 360;
  }

  drawSky(ctx) {
    const w = this.width;
    const h = this.height;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#02050d");
    sky.addColorStop(0.45, "#06101c");
    sky.addColorStop(0.8, "#071018");
    sky.addColorStop(1, "#020407");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const horizon = ctx.createRadialGradient(w * 0.5, h * 0.82, 0, w * 0.5, h * 0.82, w * 0.72);
    horizon.addColorStop(0, `rgba(25,70,73,${0.035 + this.energy * 0.035})`);
    horizon.addColorStop(0.5, "rgba(10,28,38,.025)");
    horizon.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
  }

  drawStars(ctx) {
    const w = this.width;
    const h = this.height;
    for (const star of this.stars) {
      const shimmer = 0.6 + 0.4 * Math.sin(this.time * star.speed + star.phase);
      ctx.fillStyle = `rgba(196,219,238,${star.alpha * shimmer})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.radius, 0, TAU);
      ctx.fill();
    }
  }

  localImpulse(u) {
    let lift = 0;
    let glow = 0;
    for (const impulse of this.impulses) {
      const d = (u - impulse.x) / impulse.width;
      const influence = Math.exp(-d * d * 1.6) * impulse.life * impulse.strength;
      lift += influence;
      glow += influence;
    }
    return { lift: clamp(lift, 0, 1.4), glow: clamp(glow, 0, 1.4) };
  }

  edge(c, u, layer = 0) {
    const t = this.time;
    const slow = Math.sin(u * TAU * c.frequency + c.phase + t * c.speed);
    const fold = Math.sin(u * TAU * c.folds - c.phase2 + t * c.speed * 0.63);
    const micro = Math.sin(u * TAU * (c.folds * 2.7) + c.phase2 - t * c.speed * 0.38);
    const breathing = Math.sin(t * 0.09 + c.breathing) * 0.035;
    const impulse = this.localImpulse(u);
    const y = c.base + breathing + slow * c.amplitude + fold * c.amplitude * 0.34 + micro * c.amplitude * 0.08 - impulse.lift * 0.085 + layer * 0.012;
    return clamp(y, 0.035, 0.88);
  }

  curtainDepth(c, u, layer = 0) {
    const t = this.time;
    const fold = 0.5 + 0.5 * Math.sin(u * TAU * c.folds + c.phase2 - t * c.speed * 0.45);
    const slow = 0.5 + 0.5 * Math.sin(u * TAU * (c.frequency * 0.66) - c.phase + t * c.speed * 0.25);
    const impulse = this.localImpulse(u);
    return clamp(c.reach * (0.78 + fold * 0.22 + slow * 0.08 + impulse.glow * 0.06 - layer * 0.045), 0.25, 0.96);
  }

  drawCurtain(ctx, c, index) {
    const w = this.width;
    const h = this.height;
    const energy = clamp(this.energy, 0, 1);
    const layers = 3;
    const segments = 100;

    for (let layer = 0; layer < layers; layer++) {
      const hue = (c.hue + layer * 10 + 360) % 360;
      const top = [];
      const bottom = [];
      let minY = h;
      let maxY = 0;

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const edgeY = this.edge(c, u, layer) * h;
        const depth = this.curtainDepth(c, u, layer) * h;
        const lower = Math.min(h * 1.02, edgeY + depth);
        const drift = Math.sin(u * TAU * 0.72 + c.phase + this.time * 0.04) * w * 0.012 + c.drift * w;
        top.push([u * w + drift * 0.18, edgeY]);
        bottom.push([u * w + drift, lower]);
        minY = Math.min(minY, edgeY);
        maxY = Math.max(maxY, lower);
      }

      const body = ctx.createLinearGradient(0, minY, 0, maxY);
      const alpha = (0.018 + energy * 0.052) * (1 - layer * 0.18) * (1 - index * 0.055);
      body.addColorStop(0, `hsla(${hue},86%,62%,0)`);
      body.addColorStop(0.08, `hsla(${hue},88%,61%,${alpha * 0.18})`);
      body.addColorStop(0.28, `hsla(${hue},91%,59%,${alpha * 0.75})`);
      body.addColorStop(0.56, `hsla(${(hue + 14) % 360},93%,60%,${alpha})`);
      body.addColorStop(0.78, `hsla(${hue},88%,56%,${alpha * 0.48})`);
      body.addColorStop(1, `hsla(${hue},82%,46%,0)`);

      ctx.beginPath();
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1]);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();

      this.drawFibers(ctx, c, hue, layer, energy);
      this.drawHem(ctx, c, hue, layer, energy);
    }
  }

  drawFibers(ctx, c, hue, layer, energy) {
    const w = this.width;
    const h = this.height;
    const count = clamp(Math.round(w / 9), 70, 150);
    ctx.lineCap = "round";

    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const edgeY = this.edge(c, u, layer) * h;
      const depth = this.curtainDepth(c, u, layer) * h;
      const lower = Math.min(h * 1.015, edgeY + depth);
      const impulse = this.localImpulse(u);
      const fold = 0.5 + 0.5 * Math.sin(u * TAU * c.folds + c.phase2 - this.time * c.speed * 0.48);
      const alpha = clamp(0.018 + fold * 0.04 + energy * 0.042 + impulse.glow * 0.07, 0.012, 0.15) * (1 - layer * 0.18);
      const x = u * w;
      const tilt = Math.sin(u * TAU * 0.75 + c.phase + this.time * 0.04) * w * 0.012 + c.drift * w;
      const fiberTop = mix(edgeY, lower, 0.04 + fold * 0.08);
      const gradient = ctx.createLinearGradient(0, fiberTop, 0, lower);
      gradient.addColorStop(0, `hsla(${(hue + 36) % 360},95%,72%,0)`);
      gradient.addColorStop(0.12, `hsla(${(hue + 22) % 360},96%,68%,${alpha * 0.32})`);
      gradient.addColorStop(0.48, `hsla(${hue},96%,62%,${alpha})`);
      gradient.addColorStop(0.82, `hsla(${(hue + 8) % 360},92%,58%,${alpha * 0.42})`);
      gradient.addColorStop(1, `hsla(${hue},88%,52%,0)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 0.7 + fold * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, fiberTop);
      ctx.bezierCurveTo(x + tilt * 0.18, mix(fiberTop, lower, 0.35), x + tilt * 0.72, mix(fiberTop, lower, 0.72), x + tilt, lower);
      ctx.stroke();
    }
  }

  drawHem(ctx, c, hue, layer, energy) {
    const w = this.width;
    const h = this.height;
    const segments = 130;
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, `hsla(${hue},90%,62%,0)`);
    gradient.addColorStop(0.18, `hsla(${(hue + 16) % 360},95%,68%,${0.07 + energy * 0.07})`);
    gradient.addColorStop(0.5, `hsla(${hue},98%,70%,${0.12 + energy * 0.08})`);
    gradient.addColorStop(0.82, `hsla(${(hue + 12) % 360},95%,66%,${0.07 + energy * 0.07})`);
    gradient.addColorStop(1, `hsla(${hue},90%,62%,0)`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.2 + energy * 1.6;
    ctx.shadowColor = `hsla(${hue},92%,62%,${0.1 + energy * 0.08})`;
    ctx.shadowBlur = 5 + energy * 5;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const edgeY = this.edge(c, u, layer) * h;
      const depth = this.curtainDepth(c, u, layer) * h;
      const lower = Math.min(h * 1.01, edgeY + depth);
      const drift = Math.sin(u * TAU * 0.72 + c.phase + this.time * 0.04) * w * 0.012 + c.drift * w;
      i ? ctx.lineTo(u * w + drift, lower) : ctx.moveTo(u * w + drift, lower);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawVignette(ctx) {
    const w = this.width;
    const h = this.height;
    ctx.globalCompositeOperation = "source-over";
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.47, Math.min(w, h) * 0.2, w * 0.5, h * 0.47, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,.06)");
    vignette.addColorStop(1, "rgba(0,0,0,.32)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }
}
