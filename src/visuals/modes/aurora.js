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
    this.curtains = [
      { start: -0.04, end: 0.68, hue: 324, hemHue: 34, edgeY: 0.405, slope: 0.38, height: 0.34, phase: Math.random() * TAU, speed: 0.038, frequency: 1.25, depth: 0.75 },
      { start: 0.4, end: 1.06, hue: 156, hemHue: 168, edgeY: 0.44, slope: -0.2, height: 0.43, phase: Math.random() * TAU, speed: 0.031, frequency: 1.05, depth: 1 },
      { start: -0.16, end: 0.72, hue: 164, hemHue: 178, edgeY: 0.61, slope: -0.12, height: 0.18, phase: Math.random() * TAU, speed: 0.024, frequency: 0.8, depth: 0.34 },
    ];
    this.stars = this.makeStars(320);
    this.strikes = [];
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const count = clamp(Math.round((this.width * this.height) / 1200), 320, 1800);
    if (count !== this.stars.length) this.stars = this.makeStars(count);
  }

  makeStars(count) {
    return Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random() * 0.73,
      r: 0.35 + Math.random() * 1.05,
      phase: Math.random() * TAU,
      twinkle: 0.25 + Math.random() * 0.8,
    }));
  }

  noteOn(note, velocity = 90, color) {
    const strength = clamp(velocity / 127, 0.08, 1);
    this.targetEnergy = Math.min(
      1.2,
      this.targetEnergy + 0.18 + strength * 0.62,
    );
    this.strikes.push({
      x: clamp((note - 21) / 87, 0, 1),
      strength,
      color: color && { ...color },
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
    this.drawLandscape(ctx, w, h);
    for (const strike of this.strikes) strike.life -= dt * 0.72;
    this.strikes = this.strikes.filter((strike) => strike.life > 0);
    ctx.globalCompositeOperation = "source-over";
  }

  edgePoint(c, u, h) {
    const t = (u - c.start) / (c.end - c.start);
    const fold = Math.sin(t * TAU * c.frequency + c.phase + this.time * c.speed);
    const secondary = Math.sin(t * TAU * 0.46 - c.phase * 0.7 + this.time * c.speed * 0.5);
    const fine = Math.sin(t * 13.2 + c.phase * 1.8 - this.time * c.speed * 1.2);
    const noteLift = this.strikes.reduce((sum, strike) => {
      const distance = (u - strike.x) / Math.max(0.02, c.end - c.start);
      return sum + Math.exp(-(distance * distance) / 0.006) * strike.life * strike.strength * 0.035;
    }, 0);
    return h * (c.edgeY + c.slope * (t - 0.5) + fold * 0.095 + secondary * 0.045 + fine * 0.018 - noteLift);
  }

  curtainPoint(c, u, h) {
    const t = (u - c.start) / (c.end - c.start);
    const lower = this.edgePoint(c, u, h);
    const sweep = 0.5 + 0.5 * Math.sin(t * TAU * 0.52 + c.phase + this.time * c.speed * 0.55);
    const fold = Math.sin(t * TAU * c.frequency + c.phase + this.time * c.speed);
    return lower - h * c.height * (0.55 + sweep * 0.35 + fold * 0.1);
  }

  drawCurtain(ctx, c, w, h) {
    const energy = clamp(this.energy, 0, 1);
    const left = Math.max(0, c.start * w);
    const right = Math.min(w, c.end * w);
    const segments = 180;
    const topPath = [];
    const bottomPath = [];
    for (let i = 0; i <= segments; i++) {
      const u = c.start + (c.end - c.start) * i / segments;
      topPath.push([u * w, this.curtainPoint(c, u, h)]);
      bottomPath.push([u * w, this.edgePoint(c, u, h)]);
    }

    // A faint body joins the filaments into one broad, independent ribbon.
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, `hsla(${c.hue},100%,60%,0)`);
    body.addColorStop(0.18, `hsla(${c.hue},100%,54%,${0.025 + energy * 0.035})`);
    body.addColorStop(0.46, `hsla(${c.hue},100%,49%,${0.09 + energy * 0.1})`);
    body.addColorStop(0.76, `hsla(${c.hue},100%,52%,${0.19 + energy * 0.2})`);
    body.addColorStop(0.94, `hsla(${c.hue},100%,59%,${0.25 + energy * 0.24})`);
    body.addColorStop(1, `hsla(${c.hue},100%,54%,${0.08 + energy * 0.1})`);
    ctx.beginPath();
    topPath.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    for (let i = bottomPath.length - 1; i >= 0; i--) ctx.lineTo(...bottomPath[i]);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();

    // Irregular, individually fading rays retain dark gaps between curtains.
    const rayCount = clamp(Math.round((right - left) * 0.3), 180, 560);
    for (let i = 0; i < rayCount; i++) {
      const seed = Math.sin((i + 1) * 127.1 + c.phase * 311) * 43758.5453;
      const jitter = seed - Math.floor(seed);
      const u = c.start + (c.end - c.start) * (i + 0.15 + jitter * 0.7) / rayCount;
      const local = (u - c.start) / (c.end - c.start);
      const lower = this.edgePoint(c, u, h);
      const upper = this.curtainPoint(c, u, h);
      const localNote = this.strikes.reduce((sum, strike) => {
        const d = (u - strike.x) / Math.max(0.02, c.end - c.start);
        return sum + Math.exp(-(d * d) / 0.004) * strike.life * strike.strength;
      }, 0);
      const activity = 0.34 + 0.66 * Math.pow(Math.max(0, Math.sin(local * 18 + c.phase + Math.sin(local * 7) * 2)), 1.25);
      const top = Math.max(-h * 0.03, lower - (lower - upper) * (0.48 + jitter * 0.5 + localNote * 0.2));
      const drift = Math.sin(local * 5 + c.phase + this.time * 0.08) * w * 0.018;
      const color = localNote > 0.12 ? Math.round((c.hue * (1 - Math.min(0.4, localNote * 0.2)) + ((this.strikes.find(s => s.color)?.color.hue ?? c.hue) * Math.min(0.4, localNote * 0.2)))) : c.hue;
      const alpha = clamp(activity * (0.2 + energy * 0.16 + localNote * 0.36) * Math.max(0.68, c.depth), 0.12, 0.68);
      const ray = ctx.createLinearGradient(0, top, 0, lower);
      ray.addColorStop(0, `hsla(${color},100%,62%,0)`);
      ray.addColorStop(0.35, `hsla(${color},100%,55%,${alpha * 0.12})`);
      ray.addColorStop(0.72, `hsla(${color},100%,56%,${alpha * 0.56})`);
      ray.addColorStop(0.94, `hsla(${color},100%,${c.hemHue === 34 ? 76 : 69}%,${alpha})`);
      ray.addColorStop(1, `hsla(${color},100%,${c.hemHue === 34 ? 76 : 69}%,${alpha * 0.38})`);
      ctx.strokeStyle = ray;
      ctx.lineWidth = ((right - left) / rayCount) * (0.95 + jitter * 1.05 + localNote * 0.65);
      ctx.beginPath();
      ctx.moveTo(u * w + drift * 0.32, top);
      ctx.quadraticCurveTo(u * w + drift, top + (lower - top) * 0.55, u * w + drift * 0.18, lower);
      ctx.stroke();
    }

    // The overlapping ray tips form a soft luminous hem without a wire outline.
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

  drawLandscape(ctx, w, h) {
    const horizon = h * 0.825;
    ctx.globalCompositeOperation = "source-over";

    // Distant ridges anchor the moving light curtains in a real night scene.
    ctx.beginPath();
    ctx.moveTo(0, h * 0.79);
    ctx.lineTo(w * 0.1, h * 0.765);
    ctx.lineTo(w * 0.22, h * 0.79);
    ctx.lineTo(w * 0.36, h * 0.745);
    ctx.lineTo(w * 0.48, h * 0.775);
    ctx.lineTo(w * 0.56, h * 0.695);
    ctx.lineTo(w * 0.63, h * 0.768);
    ctx.lineTo(w * 0.78, h * 0.75);
    ctx.lineTo(w * 0.9, h * 0.786);
    ctx.lineTo(w, h * 0.755);
    ctx.lineTo(w, horizon);
    ctx.lineTo(0, horizon);
    ctx.closePath();
    const distant = ctx.createLinearGradient(0, h * 0.695, 0, horizon);
    distant.addColorStop(0, "#13274c");
    distant.addColorStop(0.56, "#09172c");
    distant.addColorStop(1, "#050a15");
    ctx.fillStyle = distant;
    ctx.fill();

    // A central snow peak catches cyan light from the aurora.
    ctx.beginPath();
    ctx.moveTo(w * 0.27, horizon);
    ctx.lineTo(w * 0.43, h * 0.756);
    ctx.lineTo(w * 0.535, h * 0.61);
    ctx.lineTo(w * 0.66, h * 0.766);
    ctx.lineTo(w * 0.83, horizon);
    ctx.closePath();
    const mountain = ctx.createLinearGradient(0, h * 0.61, 0, horizon);
    mountain.addColorStop(0, "#3278d0");
    mountain.addColorStop(0.36, "#102f62");
    mountain.addColorStop(1, "#071326");
    ctx.fillStyle = mountain;
    ctx.fill();

    // Broken blue shadows and snow cuts keep the mountain from reading as one triangle.
    const facets = [
      [[0.43, 0.756], [0.48, 0.721], [0.506, 0.723], [0.488, 0.758]],
      [[0.488, 0.758], [0.506, 0.723], [0.535, 0.61], [0.523, 0.762]],
      [[0.523, 0.762], [0.535, 0.61], [0.566, 0.746], [0.59, 0.768]],
      [[0.59, 0.768], [0.566, 0.746], [0.66, 0.766], [0.714, 0.797]],
      [[0.27, 0.825], [0.354, 0.778], [0.43, 0.756], [0.395, 0.816]],
      [[0.715, 0.797], [0.79, 0.768], [0.83, 0.825], [0.758, 0.817]],
    ];
    for (let i = 0; i < facets.length; i++) {
      ctx.beginPath();
      facets[i].forEach(([x, y], index) => {
        const px = x * w;
        const py = y * h;
        index ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = i % 2
        ? "rgba(28,82,157,0.66)"
        : "rgba(5,20,48,0.72)";
      ctx.fill();
    }

    // Faceted snow planes make the peak read clearly at projector distance.
    ctx.beginPath();
    ctx.moveTo(w * 0.535, h * 0.61);
    ctx.lineTo(w * 0.506, h * 0.723);
    ctx.lineTo(w * 0.535, h * 0.695);
    ctx.lineTo(w * 0.566, h * 0.746);
    ctx.lineTo(w * 0.66, h * 0.766);
    ctx.closePath();
    ctx.fillStyle = "rgba(122,190,255,0.76)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.535, h * 0.61);
    ctx.lineTo(w * 0.506, h * 0.723);
    ctx.lineTo(w * 0.475, h * 0.756);
    ctx.lineTo(w * 0.43, h * 0.756);
    ctx.closePath();
    ctx.fillStyle = "rgba(203,229,255,0.9)";
    ctx.fill();

    const summit = ctx.createRadialGradient(
      w * 0.535, h * 0.612, 0, w * 0.535, h * 0.612, Math.min(w, h) * 0.13,
    );
    summit.addColorStop(0, "rgba(225,248,255,0.95)");
    summit.addColorStop(0.07, "rgba(112,203,255,0.7)");
    summit.addColorStop(1, "rgba(50,150,255,0)");
    ctx.fillStyle = summit;
    ctx.fillRect(w * 0.37, h * 0.49, w * 0.33, h * 0.3);

    // The lake mirrors the aurora in long horizontal ribbons.
    const lake = ctx.createLinearGradient(0, horizon, 0, h);
    lake.addColorStop(0, "#07172b");
    lake.addColorStop(0.28, "#071126");
    lake.addColorStop(1, "#020710");
    ctx.fillStyle = lake;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.globalCompositeOperation = "screen";
    const reflectionColors = ["#ff438a", "#9b51ff", "#39f3d0", "#298cff"];
    for (let i = 0; i < 46; i++) {
      const u = i / 45;
      const center = (0.16 + u * 0.72) * w;
      const width = (0.006 + 0.025 * (0.5 + 0.5 * Math.sin(i * 8.3))) * w;
      const y = horizon + h * (0.025 + (i % 7) * 0.018);
      const color = reflectionColors[i % reflectionColors.length];
      const alpha = 0.08 + 0.16 * (0.5 + 0.5 * Math.sin(i * 3.7));
      const reflection = ctx.createLinearGradient(center - width, 0, center + width, 0);
      reflection.addColorStop(0, `${color}00`);
      reflection.addColorStop(0.5, color);
      reflection.addColorStop(1, `${color}00`);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = reflection;
      ctx.fillRect(center - width, y, width * 2, 0.7 + (i % 4) * 0.45);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const shoreline = ctx.createLinearGradient(0, horizon - h * 0.04, 0, horizon + h * 0.04);
    shoreline.addColorStop(0, "rgba(110,190,255,0)");
    shoreline.addColorStop(0.5, "rgba(108,203,255,0.26)");
    shoreline.addColorStop(1, "rgba(45,128,255,0)");
    ctx.fillStyle = shoreline;
    ctx.fillRect(0, horizon - h * 0.04, w, h * 0.08);
  }
}
