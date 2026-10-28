import {
  rasterDimensions,
  renderRadiance,
  toneMapRadiance,
} from "../aurora/radiance.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;

export default class AuroraRenderer {
  constructor() {
    this.width = 1;
    this.height = 1;
    this.time = 0;
    this.baseStorm = 0.38;
    this.storm = this.baseStorm;
    this.targetStorm = this.baseStorm;
    this.depth = 0.34;
    this.targetDepth = this.depth;
    this.motion = 0.24;
    this.targetMotion = this.motion;
    this.lastNoteAt = 0;
    this.sustainDown = false;
    this.impulses = [];
    this.exposure = { value: 1 };
    this.stars = Array.from({ length: 105 }, () => ({
      x: Math.random(),
      y: Math.pow(Math.random(), 1.1),
      r: 0.35 + Math.random() * 0.7,
      a: 0.055 + Math.random() * 0.15,
      phase: Math.random() * TAU,
    }));
    this.offscreen = null;
    this.offctx = null;
    this.glow = null;
    this.glowctx = null;
    this.rasterCanvas = null;
    this.rasterCtx = null;
    this.imageData = null;
    this.radiance = null;
    this.rasterWidth = 0;
    this.rasterHeight = 0;
    if (typeof document !== "undefined") {
      this.offscreen = document.createElement("canvas");
      this.offctx = this.offscreen.getContext("2d", { alpha: false });
      this.glow = document.createElement("canvas");
      this.glowctx = this.glow.getContext("2d", { alpha: true });
      this.rasterCanvas = document.createElement("canvas");
      this.rasterCtx = this.rasterCanvas.getContext("2d", { alpha: true });
    }
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const dimensions = rasterDimensions(this.width, this.height);
    if (
      this.offscreen &&
      this.glow &&
      (this.offscreen.width !== dimensions.renderWidth ||
        this.offscreen.height !== dimensions.renderHeight)
    ) {
      this.offscreen.width = dimensions.renderWidth;
      this.offscreen.height = dimensions.renderHeight;
      this.glow.width = dimensions.renderWidth;
      this.glow.height = dimensions.renderHeight;
    }
    const rasterWidth = dimensions.width;
    const rasterHeight = dimensions.height;
    if (
      rasterWidth !== this.rasterWidth ||
      rasterHeight !== this.rasterHeight
    ) {
      this.rasterWidth = rasterWidth;
      this.rasterHeight = rasterHeight;
      this.radiance = new Float32Array(rasterWidth * rasterHeight * 3);
      if (this.rasterCanvas) {
        this.rasterCanvas.width = rasterWidth;
        this.rasterCanvas.height = rasterHeight;
        this.imageData =
          this.rasterCtx?.createImageData(rasterWidth, rasterHeight) ?? null;
      }
    }
  }

  setStorm(value) {
    if (Number.isFinite(value)) {
      this.baseStorm = clamp(value, 0, 1);
      this.targetStorm = this.baseStorm;
    }
  }

  triggerSubstorm(normalizedX = 0.5) {
    const x = clamp(normalizedX, 0, 1);
    this.impulses.push({
      x,
      pitch: x,
      strength: 0.9,
      hue: null,
      life: 1.5,
      width: 0.14,
    });
    if (this.impulses.length > 22) this.impulses.shift();
    this.targetStorm = clamp(this.targetStorm + 0.3, this.baseStorm, 1);
    this.targetMotion = Math.max(this.targetMotion, 0.72);
  }

  noteOn(note, velocity = 90, color) {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const interval = this.lastNoteAt
      ? clamp(now - this.lastNoteAt, 40, 1500)
      : 650;
    this.lastNoteAt = now;
    const rate = clamp(1 - (interval - 70) / 880, 0, 1);
    const strength = clamp(velocity / 127, 0.06, 1);
    const x = clamp((note - 21) / 87, 0, 1);
    this.targetDepth = clamp(
      this.targetDepth * 0.48 + rate * 0.56 + strength * 0.18,
      0.12,
      1,
    );
    this.targetMotion = clamp(0.2 + rate * 0.65 + strength * 0.15, 0.2, 1);
    this.targetStorm = clamp(
      this.targetStorm + 0.04 + strength * 0.18 + rate * 0.11,
      this.baseStorm,
      1,
    );
    this.impulses.push({
      x,
      pitch: x,
      strength,
      hue: color?.hue ?? null,
      life: 1,
      width: 0.025 + strength * 0.045,
    });
    if (this.impulses.length > 22) this.impulses.shift();
  }

  noteOff() {}

  sustain(down) {
    this.sustainDown = Boolean(down);
  }

  advance(dt = 1 / 60) {
    const delta = Math.max(
      0,
      Math.min(0.05, Number.isFinite(dt) ? dt : 1 / 60),
    );
    this.time += delta;
    const base = this.baseStorm;
    this.targetStorm = mix(
      this.targetStorm,
      base,
      1 - Math.exp(-(this.sustainDown ? 0.13 : 0.3) * delta),
    );
    this.targetDepth = mix(this.targetDepth, 0.34, 1 - Math.exp(-0.22 * delta));
    this.targetMotion = mix(
      this.targetMotion,
      0.24,
      1 - Math.exp(-0.26 * delta),
    );
    this.storm = mix(this.storm, this.targetStorm, 1 - Math.exp(-0.9 * delta));
    this.depth = mix(this.depth, this.targetDepth, 1 - Math.exp(-0.72 * delta));
    this.motion = mix(
      this.motion,
      this.targetMotion,
      1 - Math.exp(-0.82 * delta),
    );
    const decay = this.sustainDown ? 0.18 : 0.48 + this.motion * 0.16;
    for (const impulse of this.impulses) impulse.life -= delta * decay;
    this.impulses = this.impulses.filter((impulse) => impulse.life > 0.015);
    return delta;
  }

  updateAndDraw(ctx, dt = 1 / 60) {
    this.advance(dt);

    if (
      this.offscreen &&
      this.offctx &&
      this.glow &&
      this.glowctx &&
      typeof ctx.drawImage === "function"
    ) {
      if (this.imageData && typeof this.rasterCtx?.putImageData === "function")
        this.renderRasterScene();
      else
        this.renderCanvasFallback(
          this.offctx,
          this.offscreen.width,
          this.offscreen.height,
        );
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.48;
      ctx.drawImage(this.glow, 0, 0, this.width, this.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      return;
    }
    this.renderCanvasFallback(ctx, this.width, this.height);
  }

  renderRasterScene() {
    const ow = this.offscreen.width,
      oh = this.offscreen.height;
    const result = renderRadiance({
      width: this.rasterWidth,
      height: this.rasterHeight,
      time: this.time,
      storm: this.storm,
      depth: this.depth,
      motion: this.motion,
      impulses: this.impulses,
      output: this.radiance,
    });
    const exposure = toneMapRadiance(
      result.data,
      this.imageData.data,
      this.exposure,
      this.rasterWidth,
      this.rasterHeight,
      result.horizon,
    );
    // Keep exposure available for diagnostics and the next temporally smoothed frame.
    this.exposure.value = exposure;
    this.rasterCtx.putImageData(this.imageData, 0, 0);
    this.glowctx.clearRect(0, 0, this.glow.width, this.glow.height);
    this.glowctx.save();
    this.glowctx.filter = `blur(${5 + this.storm * 8}px)`;
    this.glowctx.globalAlpha = 0.58;
    this.glowctx.drawImage(
      this.rasterCanvas,
      0,
      0,
      this.glow.width,
      this.glow.height,
    );
    this.glowctx.restore();
    const ctx = this.offctx;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#02050b";
    ctx.fillRect(0, 0, ow, oh);
    const sky = ctx.createLinearGradient(0, 0, 0, oh);
    sky.addColorStop(0, "#030711");
    sky.addColorStop(0.48, "#07101a");
    sky.addColorStop(0.68, "#0b1920");
    sky.addColorStop(1, "#03090f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, ow, oh);
    ctx.globalCompositeOperation = "screen";
    ctx.filter = "blur(1.35px)";
    ctx.globalAlpha = 0.93;
    ctx.drawImage(this.rasterCanvas, 0, 0, ow, oh);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.drawStars(ctx, ow, oh);
    this.drawShoreline(ctx, ow, oh);
    this.drawVignette(ctx, ow, oh);
  }

  renderCanvasFallback(ctx, w, h) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#030812";
    ctx.fillRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#030712");
    sky.addColorStop(0.53, "#071722");
    sky.addColorStop(0.72, "#10252b");
    sky.addColorStop(1, "#030a11");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let curtain = 0; curtain < 4; curtain++) {
      const phase = curtain * 1.57;
      for (let ray = 0; ray < 180; ray++) {
        const u = ray / 179;
        const wave = Math.sin(
          u * 8 + this.time * (0.15 + this.motion * 0.3) + phase,
        );
        const x = u * w;
        const y =
          h * (0.38 + curtain * 0.023 + wave * (0.045 + this.storm * 0.045));
        ctx.strokeStyle = `rgba(${curtain === 3 ? "248,92,125" : "72,244,173"},${0.012 + this.storm * 0.017})`;
        ctx.lineWidth = 1.1 + this.storm * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - h * 0.24);
        ctx.lineTo(x + wave * 4, y + h * 0.14);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.drawStars(ctx, w, h);
    this.drawShoreline(ctx, w, h);
    this.drawVignette(ctx, w, h);
  }

  drawStars(ctx, w, h) {
    for (const star of this.stars) {
      const alpha =
        star.a * (0.62 + 0.38 * Math.sin(this.time * 0.4 + star.phase));
      ctx.fillStyle = `rgba(203,225,238,${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h * 0.72, star.r, 0, TAU);
      ctx.fill();
    }
  }

  drawShoreline(ctx, w, h) {
    const y = h * 0.68;
    ctx.save();
    ctx.fillStyle = "#03070c";
    ctx.beginPath();
    ctx.moveTo(0, y + h * 0.018);
    for (let x = 0; x <= w; x += Math.max(3, w / 150)) {
      const irregular =
        Math.sin(x * 0.042) * 3 + Math.sin(x * 0.12 + 1.1) * 1.6;
      const tree =
        Math.pow(
          Math.max(0, Math.sin(x * 0.043 + 0.6) * Math.sin(x * 0.013 + 2.1)),
          8,
        ) *
        h *
        0.025;
      ctx.lineTo(x, y + h * 0.018 + irregular - tree);
    }
    ctx.lineTo(w, y + h * 0.032);
    for (let x = w; x >= 0; x -= Math.max(3, w / 150)) {
      const irregular =
        Math.sin(x * 0.042) * 2.4 + Math.sin(x * 0.12 + 1.1) * 1.2;
      ctx.lineTo(x, y + h * 0.023 + irregular);
    }
    ctx.lineTo(0, y + h * 0.018);
    ctx.closePath();
    ctx.fill();
    const lake = ctx.createLinearGradient(0, y, 0, h);
    lake.addColorStop(0, "rgba(24,63,70,0.18)");
    lake.addColorStop(0.12, "rgba(12,38,48,0.16)");
    lake.addColorStop(1, "rgba(1,5,10,0.75)");
    ctx.fillStyle = lake;
    ctx.fillRect(0, y + h * 0.02, w, h * 0.3);
    ctx.restore();
  }

  drawVignette(ctx, w, h) {
    const gradient = ctx.createRadialGradient(
      w * 0.5,
      h * 0.43,
      Math.min(w, h) * 0.18,
      w * 0.5,
      h * 0.48,
      Math.max(w, h) * 0.75,
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.78, "rgba(0,0,0,0.08)");
    gradient.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}
