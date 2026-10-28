const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

const CURTAINS = [
  { offset: -118, phase: 0.15, scale: 1 },
  { offset: -39, phase: 1.7, scale: 0.84 },
  { offset: 47, phase: 3.2, scale: 0.92 },
  { offset: 126, phase: 4.7, scale: 0.72 },
];

export function rasterDimensions(width, height) {
  const w0 = Math.max(1, width),
    h0 = Math.max(1, height);
  const scale = Math.min(0.58, 720 / Math.max(w0, h0));
  const renderWidth = Math.max(320, Math.round(w0 * scale));
  const renderHeight = Math.max(180, Math.round(h0 * scale));
  return {
    renderWidth,
    renderHeight,
    width: clamp(Math.round(renderWidth * 0.68), 300, 440),
    height: clamp(Math.round(renderHeight * 0.56), 160, 220),
  };
}

function smoothstep(a, b, value) {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function createEmissionTable(size = 201, storm = 0.38) {
  const lut = new Float32Array(size * 3);
  for (let i = 0; i < size; i++) {
    const altitude = 90 + (210 * i) / (size - 1);
    const green =
      smoothstep(98, 108, altitude) * (1 - smoothstep(139, 186, altitude));
    const red =
      smoothstep(184, 225, altitude) * (1 - smoothstep(280, 316, altitude));
    const pink =
      (1 - smoothstep(104, 132, altitude)) *
      smoothstep(88, 98, altitude) *
      smoothstep(0.62, 0.88, storm);
    lut[i * 3] = green * 0.12 + red * (0.12 + storm * 0.22) + pink * 0.92;
    lut[i * 3 + 1] = green * 0.94 + red * 0.03 + pink * 0.13;
    lut[i * 3 + 2] = green * 0.36 + red * 0.03 + pink * 0.68;
  }
  return lut;
}

export const EMISSION_LUT = createEmissionTable();

function addTent(buffer, width, height, x, y, r, g, b, strength) {
  if (x < -1 || y < -1 || x >= width || y >= height) return;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  for (let oy = 0; oy <= 1; oy++) {
    const py = iy + oy;
    if (py < 0 || py >= height) continue;
    const wy = oy === 0 ? 1 - fy : fy;
    for (let ox = 0; ox <= 1; ox++) {
      const px = ix + ox;
      if (px < 0 || px >= width) continue;
      const wx = ox === 0 ? 1 - fx : fx;
      const amount = strength * wx * wy;
      const at = (py * width + px) * 3;
      buffer[at] += r * amount;
      buffer[at + 1] += g * amount;
      buffer[at + 2] += b * amount;
    }
  }
}

function impulseAt(impulses, x) {
  let power = 0,
    strongest = null;
  for (let i = 0; i < impulses.length; i++) {
    const note = impulses[i];
    const d = (x - note.x) / note.width;
    const influence = Math.exp(-d * d * 1.6) * note.life * note.strength;
    power += influence;
    if (!strongest || influence > strongest.influence)
      strongest = { influence, pitch: note.pitch, hue: note.hue };
  }
  return {
    power: clamp(power, 0, 2),
    pitch: strongest?.pitch ?? 0.5,
    hue: strongest?.hue ?? null,
  };
}

function hueRgb(hue) {
  const h = (((hue % 360) + 360) % 360) / 60;
  const c = 0.64;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = 0.68 - c / 2;
  if (h < 1) return [c + m, x + m, m];
  if (h < 2) return [x + m, c + m, m];
  if (h < 3) return [m, c + m, x + m];
  if (h < 4) return [m, x + m, c + m];
  if (h < 5) return [x + m, m, c + m];
  return [c + m, m, x + m];
}

function project(xKm, altitudeKm, northKm, width, height) {
  const pitch = 0.31;
  const y = altitudeKm * Math.cos(pitch) - northKm * Math.sin(pitch);
  const z = altitudeKm * Math.sin(pitch) + northKm * Math.cos(pitch) + 240;
  const curve = (xKm * xKm) / (2 * 6371);
  const depth = Math.max(50, z + curve);
  const nx = xKm / depth;
  const ny = y / depth;
  return { x: width * (0.5 + nx * 1.17), y: height * (0.535 - ny * 1.08) };
}

function writeLine(buffer, width, height, a, b, red, green, blue, strength) {
  const span = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  // Never leave gaps between altitude samples: a fixed step count makes a
  // checkerboard when long projected segments are magnified for a display.
  const steps = Math.max(1, Math.ceil(span * 1.4));
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    addTent(
      buffer,
      width,
      height,
      mix(a.x, b.x, t),
      mix(a.y, b.y, t),
      red,
      green,
      blue,
      strength,
    );
  }
}

/** CPU radiance rasterizer. Output is additive linear-light RGB, without DOM dependencies. */
export function renderRadiance({
  width,
  height,
  time,
  storm,
  depth,
  motion,
  impulses,
  output,
  lut,
}) {
  const pixels = width * height;
  if (!output || output.length !== pixels * 3)
    output = new Float32Array(pixels * 3);
  else output.fill(0);
  lut ||= storm <= 0.38 ? EMISSION_LUT : createEmissionTable(201, storm);

  const rayCount = clamp(Math.round(width * 0.74), 350, 600);
  const altitudes = 23;
  const stride = 3;
  const speed = 0.18 + motion * 1.55;
  const magneticTilt = (78 * Math.PI) / 180;
  const cosTilt = Math.cos(magneticTilt),
    sinTilt = Math.sin(magneticTilt);
  const horizon = Math.floor(height * 0.68);

  for (let curtain = 0; curtain < CURTAINS.length; curtain++) {
    const band = CURTAINS[curtain];
    // Storms bring the sheets toward the observer, so the same field lines
    // climb above the horizon instead of merely becoming more saturated.
    const baseNorth = 560 - storm * 380 - depth * 80 + band.offset * 0.15;
    for (let ray = 0; ray < rayCount; ray++) {
      const u = ray / (rayCount - 1);
      const xKm = mix(-420, 420, u);
      const impulse = impulseAt(impulses, u);
      const noteTint = impulse.hue == null ? null : hueRgb(impulse.hue);
      const xWave = xKm * 0.0062;
      const foldA =
        Math.sin(xWave + time * 0.045 * speed + band.phase) * (42 + storm * 36);
      const foldB =
        Math.sin(xWave * 2.1 - time * 0.077 * speed + band.phase * 1.3) *
        (20 + depth * 12);
      const foldC =
        Math.sin(xWave * 4.3 + time * 0.11 * speed + band.phase * 0.4) * 8;
      const centerNorth = Math.max(
        45,
        baseNorth + foldA + foldB + foldC + band.offset,
      );
      const noteLift = impulse.power * (8 + storm * 30);
      const broad =
        0.47 + 0.25 * Math.sin(xWave * 1.2 + time * 0.035 * speed + band.phase);
      const rib =
        0.56 +
        0.44 *
          Math.sin(
            xKm * 0.093 + time * 0.19 * speed + Math.sin(xWave * 2) * 1.3,
          );
      const fine = 0.72 + 0.28 * Math.sin(xKm * 0.36 - time * 0.48 * speed);
      const rayPower =
        (0.11 +
          storm * 0.22 +
          broad * rib * fine * 0.44 +
          impulse.power * 0.45) *
        band.scale;
      const localPhase = impulse.pitch * TAU;
      let previous = null;

      for (let ai = 0; ai < altitudes; ai++) {
        const altitude = 100 + ai * 9;
        const normalized = ((altitude - 90) / 210) * 200;
        const li = clamp(Math.round(normalized), 0, 200) * stride;
        let emissionR = lut[li],
          emissionG = lut[li + 1],
          emissionB = lut[li + 2];
        if (noteTint && impulse.power > 0.01) {
          const greenEmission = emissionG;
          const tint =
            Math.min(0.5, impulse.power * 0.48) *
            smoothstep(94, 118, altitude) *
            (1 - smoothstep(162, 184, altitude));
          emissionR = mix(emissionR, greenEmission * noteTint[0], tint);
          emissionG = mix(emissionG, greenEmission * noteTint[1], tint);
          emissionB = mix(emissionB, greenEmission * noteTint[2], tint);
        }
        const field = (altitude - 190) * sinTilt * 0.19;
        const lateralField =
          field * cosTilt +
          Math.sin(altitude * 0.055 + xWave + time * 0.04 * speed) * 3.5;
        const verticalField = field * sinTilt;
        const altitudeShear =
          Math.sin(
            altitude * 0.036 + xWave * 1.7 + time * 0.06 * speed + band.phase,
          ) *
          (3 + storm * 9);
        const noteSurge =
          Math.sin(altitude * 0.07 + localPhase + time * 0.35) * noteLift;
        const p = project(
          xKm + lateralField + impulse.power * 4,
          altitude + verticalField + altitudeShear + noteSurge,
          centerNorth + altitudeShear * 0.6,
          width,
          height,
        );
        if (previous) {
          const altitudeWeight =
            altitude < 155 ? 0.92 : altitude < 194 ? 0.58 : 0.78;
          const surge =
            1 +
            impulse.power * Math.exp(-Math.pow((altitude - 160) / 38, 2)) * 1.1;
          const intensity =
            rayPower * altitudeWeight * surge * (1 - 0.24 * Math.abs(u - 0.5));
          writeLine(
            output,
            width,
            height,
            previous,
            p,
            emissionR,
            emissionG,
            emissionB,
            intensity,
          );
        }
        previous = p;
      }
    }
  }

  // Lake reflection: ripple and fade each curtain's radiance around an irregular shoreline.
  const shoreline = horizon + Math.floor(height * 0.012);
  for (let y = shoreline; y < height; y++) {
    const distance = y - shoreline;
    const fade =
      (0.62 * Math.exp(-distance / Math.max(3, height * 0.42)) + 0.12) * 0.7;
    const sourceY = clamp(shoreline - Math.max(1, distance), 0, height - 1);
    for (let x = 0; x < width; x++) {
      const ripple = Math.round(
        Math.sin(y * 0.43 + x * 0.08 + time * 1.4) * (1 + distance * 0.018),
      );
      const sx = clamp(x + ripple, 0, width - 1);
      const src = (sourceY * width + sx) * 3;
      const dst = (y * width + x) * 3;
      const glint = 0.78 + 0.22 * Math.sin(y * 0.9 + x * 0.12);
      output[dst] = output[src] * fade * glint;
      output[dst + 1] = output[src + 1] * fade * glint;
      output[dst + 2] = output[src + 2] * fade * glint;
    }
  }
  return { data: output, horizon };
}

export function toneMapRadiance(
  source,
  destination,
  exposure,
  width,
  height,
  horizon,
) {
  const n = source.length;
  let peak = 0;
  for (let i = 0; i < n; i += 3)
    peak = Math.max(peak, source[i], source[i + 1], source[i + 2]);
  const targetExposure = clamp(4.2 / (0.5 + peak * 0.32), 1.8, 6.5);
  exposure.value = mix(exposure.value || 1, targetExposure, 0.055);
  const gain = exposure.value;
  const lutSize = 2048;
  const quantizedGain = Math.round(gain * 64) / 64;
  if (exposure.lutGain !== quantizedGain || !exposure.toneLut) {
    const toneLut = new Uint8Array(lutSize);
    for (let i = 0; i < lutSize; i++)
      toneLut[i] = Math.round(
        255 * (1 - Math.exp(-((i * 12) / (lutSize - 1)) * quantizedGain)),
      );
    exposure.toneLut = toneLut;
    exposure.lutGain = quantizedGain;
  }
  const toneLut = exposure.toneLut;
  const scale = (lutSize - 1) / 12;
  let sourceAt = 0,
    destAt = 0;
  for (let y = 0; y < height; y++) {
    const lake = y >= horizon ? 0.72 : 1;
    for (let x = 0; x < width; x++) {
      const ri = Math.min(lutSize - 1, (source[sourceAt] * lake * scale) | 0);
      const gi = Math.min(
        lutSize - 1,
        (source[sourceAt + 1] * lake * scale) | 0,
      );
      const bi = Math.min(
        lutSize - 1,
        (source[sourceAt + 2] * lake * scale) | 0,
      );
      const r = toneLut[ri];
      const g = toneLut[gi];
      const b = toneLut[bi];
      destination[destAt] = r;
      destination[destAt + 1] = g;
      destination[destAt + 2] = b;
      destination[destAt + 3] = 255;
      sourceAt += 3;
      destAt += 4;
    }
  }
  return exposure.value;
}
