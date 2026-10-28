const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;

export default class AuroraRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.energy = 0.16;
    this.targetEnergy = 0.16;
    this.depth = 0.2;
    this.targetDepth = 0.2;
    this.motion = 0.16;
    this.targetMotion = 0.16;
    this.lastNoteAt = 0;
    this.impulses = [];
    this.stars = Array.from({ length: 260 }, () => ({
      x: Math.random(),
      y: Math.pow(Math.random(), 0.94),
      r: 0.3 + Math.random() * 0.9,
      a: 0.08 + Math.random() * 0.28,
      phase: Math.random() * TAU,
      speed: 0.12 + Math.random() * 0.46,
    }));
    this.camera = { pitch: 0.23, focal: 1.16, centerY: 0.61 };
    this.offscreen = null;
    this.offctx = null;
    this.glow = null;
    this.glowctx = null;
    if (typeof document !== "undefined") {
      this.offscreen = document.createElement("canvas");
      this.offctx = this.offscreen.getContext("2d", { alpha: true });
      this.glow = document.createElement("canvas");
      this.glowctx = this.glow.getContext("2d", { alpha: true });
    }
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (!this.offscreen || !this.glow) return;
    const scale = Math.min(0.58, Math.max(0.36, 720 / Math.max(this.width, this.height)));
    const w = Math.max(320, Math.round(this.width * scale));
    const h = Math.max(180, Math.round(this.height * scale));
    if (this.offscreen.width !== w || this.offscreen.height !== h) {
      this.offscreen.width = w;
      this.offscreen.height = h;
      this.glow.width = w;
      this.glow.height = h;
    }
  }

  noteOn(note, velocity = 90, color) {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const interval = this.lastNoteAt ? clamp(now - this.lastNoteAt, 45, 1400) : 700;
    this.lastNoteAt = now;
    const rate = clamp(1 - (interval - 70) / 900, 0, 1);
    const strength = clamp(velocity / 127, 0.06, 1);
    const x = clamp((note - 21) / 87, 0, 1);
    this.targetDepth = clamp(this.targetDepth * 0.55 + rate * 0.62 + strength * 0.18, 0.08, 1);
    this.targetMotion = clamp(0.12 + rate * 0.78 + strength * 0.12, 0.12, 1);
    this.targetEnergy = clamp(this.targetEnergy + 0.06 + strength * 0.22 + rate * 0.08, 0.12, 0.92);
    this.impulses.push({
      x,
      pitch: x,
      strength,
      hue: color && Number.isFinite(color.hue) ? color.hue : null,
      life: 1,
      width: 0.032 + strength * 0.055,
    });
    if (this.impulses.length > 18) this.impulses.shift();
  }

  noteOff() {}
  sustain() {}

  updateAndDraw(ctx, dt = 1 / 60) {
    const delta = Math.min(0.05, dt || 1 / 60);
    this.time += delta;
    this.targetEnergy = mix(this.targetEnergy, 0.16, 1 - Math.exp(-0.24 * delta));
    this.targetDepth = mix(this.targetDepth, 0.2, 1 - Math.exp(-0.18 * delta));
    this.targetMotion = mix(this.targetMotion, 0.16, 1 - Math.exp(-0.2 * delta));
    this.energy = mix(this.energy, this.targetEnergy, 1 - Math.exp(-1.55 * delta));
    this.depth = mix(this.depth, this.targetDepth, 1 - Math.exp(-1.2 * delta));
    this.motion = mix(this.motion, this.targetMotion, 1 - Math.exp(-1.3 * delta));
    for (const impulse of this.impulses) impulse.life -= delta * (0.3 + this.motion * 0.16);
    this.impulses = this.impulses.filter((impulse) => impulse.life > 0);

    if (this.offscreen && this.offctx && this.glow && this.glowctx && typeof ctx.drawImage === "function") {
      const ow = this.offscreen.width;
      const oh = this.offscreen.height;
      this.renderScene(this.offctx, ow, oh);
      this.glowctx.clearRect(0, 0, ow, oh);
      this.glowctx.save();
      this.glowctx.filter = `blur(${7 + this.energy * 10}px)`;
      this.glowctx.globalAlpha = 0.66 + this.energy * 0.12;
      this.glowctx.drawImage(this.offscreen, 0, 0);
      this.glowctx.restore();
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.glow, 0, 0, this.width, this.height);
      ctx.globalAlpha = 0.98;
      ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
      return;
    }

    this.renderScene(ctx, this.width, this.height);
  }

  renderScene(ctx, w, h) {
    this.drawSky(ctx, w, h);
    this.drawStars(ctx, w, h);
    this.drawCurtain(ctx, w, h);
    this.drawVignette(ctx, w, h);
  }

  drawSky(ctx, w, h) {
    ctx.globalCompositeOperation = "source-over";
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#02050c");
    sky.addColorStop(0.42, "#071626");
    sky.addColorStop(0.76, "#0a2230");
    sky.addColorStop(1, "#06141d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const haze = ctx.createRadialGradient(w * 0.5, h * 0.7, 0, w * 0.5, h * 0.7, w * 0.72);
    haze.addColorStop(0, `rgba(70,148,148,${0.025 + this.energy * 0.028})`);
    haze.addColorStop(0.55, "rgba(20,50,67,0.02)");
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  }

  drawStars(ctx, w, h) {
    for (const star of this.stars) {
      const shimmer = 0.55 + 0.45 * Math.sin(this.time * star.speed + star.phase);
      ctx.fillStyle = `rgba(216,234,249,${star.a * shimmer})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, TAU);
      ctx.fill();
    }
  }

  localImpulse(u) {
    let lift = 0;
    let brightness = 0;
    let pitch = 0.5;
    let hue = null;
    let strongest = 0;
    for (const impulse of this.impulses) {
      const d = (u - impulse.x) / impulse.width;
      const influence = Math.exp(-d * d * 1.5) * impulse.life * impulse.strength;
      lift += influence;
      brightness += influence;
      if (influence > strongest) {
        strongest = influence;
        pitch = impulse.pitch;
        hue = impulse.hue;
      }
    }
    return {
      lift: clamp(lift, 0, 1.6),
      brightness: clamp(brightness, 0, 1.8),
      pitch,
      hue,
    };
  }

  curtainFootprint(xKm, u) {
    const t = this.time;
    const speed = 0.16 + this.motion * 0.78;
    const wave1 = Math.sin(xKm * 0.0105 + t * 0.2 * speed);
    const wave2 = Math.sin(xKm * 0.024 - t * 0.46 * speed + 1.35);
    const wave3 = Math.sin(xKm * 0.051 + t * 0.92 * speed + 2.1);
    const local = this.localImpulse(u);
    const baseDistance = 390 - this.depth * 205;
    const foldDepth = 25 * wave1 + 15 * wave2 + 7 * wave3;
    const notePull = local.lift * (18 + this.depth * 22);
    return baseDistance + foldDepth - notePull;
  }

  project(xKm, altitudeKm, northKm, w, h) {
    const pitch = this.camera.pitch;
    const y = altitudeKm * Math.cos(pitch) - northKm * Math.sin(pitch);
    const z = altitudeKm * Math.sin(pitch) + northKm * Math.cos(pitch);
    if (z <= 1) return null;
    const nx = xKm / z;
    const ny = y / z;
    return {
      x: w * (0.5 + nx * this.camera.focal),
      y: h * (this.camera.centerY - ny * this.camera.focal),
      z,
    };
  }

  rayBrightness(xKm, u) {
    const t = this.time;
    const speed = 0.3 + this.motion * 1.4;
    const broad = 0.5 + 0.5 * Math.sin(xKm * 0.013 + t * 0.24 * speed + Math.sin(xKm * 0.004) * 2.1);
    const streak = 0.5 + 0.5 * Math.sin(xKm * 0.11 - t * 1.7 * speed + Math.sin(xKm * 0.032 + t * 0.4) * 0.9);
    const fine = 0.5 + 0.5 * Math.sin(xKm * 0.37 + t * 4.2 * speed);
    const local = this.localImpulse(u);
    return clamp(0.18 + broad * 0.5 + streak * 0.18 + fine * 0.08 + local.brightness * 0.42 + this.energy * 0.18, 0.06, 1.65);
  }

  emission(altitude, alpha, local) {
    const greenRise = clamp((altitude - 100) / 22, 0, 1);
    const greenFall = 1 - clamp((altitude - 165) / 45, 0, 1);
    const green = greenRise * greenFall;
    const red = clamp((altitude - 190) / 90, 0, 1);
    const pink = clamp((119 - altitude) / 14, 0, 1) * clamp((this.energy + this.depth - 0.72) * 1.25, 0, 1);
    const noteHue = local.hue;

    if (pink > 0.001) {
      return `hsla(${noteHue ?? 318},88%,72%,${alpha * pink * 0.68})`;
    }
    if (red > green * 0.72) {
      const r = 250;
      const g = Math.round(55 + red * 60);
      const b = Math.round(82 + red * 78);
      return `rgba(${r},${g},${b},${alpha * red * 0.66})`;
    }
    const hue = noteHue == null ? 151 : mix(151, noteHue, 0.14);
    return `hsla(${hue},78%,68%,${alpha * Math.max(0.05, green)})`;
  }

  drawCurtain(ctx, w, h) {
    const xMin = -310;
    const xMax = 310;
    const rayCount = clamp(Math.round(300 + w * 0.17 + this.depth * 120), 300, 560);
    const altMin = 100;
    const altMax = 306;
    const altStep = 7;
    const movement = 0.3 + this.motion * 1.7;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (let i = 0; i < rayCount; i++) {
      const u = i / (rayCount - 1);
      const xKm = mix(xMin, xMax, u);
      const local = this.localImpulse(u);
      const north = this.curtainFootprint(xKm, u);
      const brightness = this.rayBrightness(xKm, u);
      const alphaBase = clamp(0.012 + brightness * 0.035, 0.01, 0.082);
      let previous = null;

      for (let altitude = altMin; altitude <= altMax; altitude += altStep) {
        const fieldTilt = 4.5 * Math.sin(altitude * 0.043 + xKm * 0.01 - this.time * 0.34 * movement);
        const fold = 8.5 * Math.sin(xKm * 0.019 + altitude * 0.027 + this.time * 0.42 * movement);
        const fine = 2.8 * Math.sin(xKm * 0.061 - altitude * 0.019 - this.time * 1.15 * movement);
        const pitchLift = (local.pitch - 0.5) * local.lift * 11;
        const point = this.project(xKm + fieldTilt, altitude + pitchLift, north + fold + fine, w, h);
        if (!point) continue;
        if (previous) {
          ctx.strokeStyle = this.emission(altitude, alphaBase, local);
          ctx.lineWidth = 0.42 + brightness * 0.72 + local.brightness * 0.16;
          ctx.beginPath();
          ctx.moveTo(previous.x, previous.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
        previous = point;
      }
    }

    ctx.restore();
  }

  drawVignette(ctx, w, h) {
    ctx.globalCompositeOperation = "source-over";
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.2, w * 0.5, h * 0.48, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.74, "rgba(0,0,0,0.06)");
    vignette.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }
}
