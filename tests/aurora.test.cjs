const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const moduleUrl = (relativePath) =>
  pathToFileURL(path.resolve(__dirname, relativePath)).href;

async function loadAurora() {
  const [radiance, rendererModule] = await Promise.all([
    import(moduleUrl("../src/visuals/aurora/radiance.js")),
    import(moduleUrl("../src/visuals/modes/aurora.js")),
  ]);
  return { ...radiance, AuroraRenderer: rendererModule.default };
}

const scene = (overrides = {}) => ({
  width: 72,
  height: 54,
  time: 1.25,
  storm: 0.45,
  depth: 0.34,
  motion: 0.24,
  impulses: [],
  ...overrides,
});

function totalEnergy(rgb) {
  let sum = 0;
  for (let i = 0; i < rgb.length; i++) sum += rgb[i];
  return sum;
}

function normalizedRows(rgb, width, height) {
  const rows = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 3;
      rows[y] += rgb[at] + rgb[at + 1] + rgb[at + 2];
    }
  }
  const sum = rows.reduce((a, b) => a + b, 0);
  return Array.from(rows, (value) => value / sum);
}

function positiveDifferenceCentroidX(reference, sample, width) {
  let weightedX = 0;
  let weight = 0;
  for (let i = 0; i < sample.length; i += 3) {
    const delta = Math.max(
      0,
      sample[i] +
        sample[i + 1] +
        sample[i + 2] -
        reference[i] -
        reference[i + 1] -
        reference[i + 2],
    );
    weightedX += delta * ((i / 3) % width);
    weight += delta;
  }
  return weightedX / weight;
}

test("aurora radiance is finite, linear-light, and reuses a correctly sized buffer", async () => {
  const { renderRadiance, rasterDimensions, AuroraRenderer } =
    await loadAurora();
  const width = 72;
  const height = 54;
  const output = new Float32Array(width * height * 3);
  const impulses = Array.from({ length: 22 }, (_, i) => {
    const x = i / 21;
    return { x, pitch: x, strength: 1, life: 1, width: 0.2 };
  });

  const result = renderRadiance(
    scene({ width, height, storm: 1, motion: 1, impulses, output }),
  );
  assert.strictEqual(
    result.data,
    output,
    "the supplied radiance buffer is reused",
  );
  assert.equal(result.data.length, width * height * 3);
  assert.ok(
    result.data.every(Number.isFinite),
    "each RGB radiance value is finite",
  );
  assert.ok(
    result.data.every((value) => value >= 0),
    "additive radiance never becomes negative",
  );
  assert.ok(
    Math.max(...result.data) < 100,
    "a saturated note burst remains bounded",
  );

  const smaller = renderRadiance(scene({ width: 48, height: 36, output }));
  assert.equal(
    smaller.data.length,
    48 * 36 * 3,
    "a buffer for another size is replaced safely",
  );
  assert.ok(smaller.data.every(Number.isFinite));

  const renderer = new AuroraRenderer();
  for (const [w, h] of [
    [1, 1],
    [320, 240],
    [8000, 5000],
    [1920, 1080],
    [1, 1],
  ]) {
    renderer.resize(w, h);
    const dimensions = rasterDimensions(w, h);
    assert.equal(
      renderer.radiance.length,
      dimensions.width * dimensions.height * 3,
    );
    assert.ok(
      dimensions.width <= 440 && dimensions.height <= 220,
      "raster allocation is capped independently of viewport size",
    );
    assert.ok(
      renderer.radiance.length <= 440 * 220 * 3,
      "resize cannot grow the linear-light buffer without bound",
    );
  }
});

test("storm changes both aurora energy and the vertical curtain distribution", async () => {
  const { renderRadiance } = await loadAurora();
  const calm = renderRadiance(scene({ storm: 0.05 })).data;
  const active = renderRadiance(scene({ storm: 0.95 })).data;
  const calmEnergy = totalEnergy(calm);
  const activeEnergy = totalEnergy(active);
  assert.ok(
    activeEnergy > calmEnergy * 1.15,
    "stronger storm adds visible emission",
  );

  const calmRows = normalizedRows(calm, 72, 54);
  const activeRows = normalizedRows(active, 72, 54);
  const distributionChange = calmRows.reduce(
    (sum, value, index) => sum + Math.abs(value - activeRows[index]),
    0,
  );
  assert.ok(
    distributionChange > 0.025,
    "storm reshapes the curtain instead of only recoloring it",
  );
});

test("note energy decays smoothly and a substorm stays near its trigger longitude", async () => {
  const { renderRadiance } = await loadAurora();
  const base = scene();
  const reference = renderRadiance(base).data;
  const energyAt = (life) =>
    totalEnergy(
      renderRadiance(
        scene({
          ...base,
          impulses:
            life > 0
              ? [{ x: 0.22, pitch: 0.22, strength: 0.9, life, width: 0.055 }]
              : [],
        }),
      ).data,
    );
  const bright = energyAt(1);
  const fading = energyAt(0.55);
  const faint = energyAt(0.2);
  const quiet = totalEnergy(reference);
  assert.ok(
    bright > fading && fading > faint && faint > quiet,
    "note-driven radiance fades in ordered steps",
  );

  const left = renderRadiance(
    scene({
      ...base,
      impulses: [{ x: 0.2, pitch: 0.2, strength: 0.9, life: 1, width: 0.055 }],
    }),
  ).data;
  const right = renderRadiance(
    scene({
      ...base,
      impulses: [{ x: 0.8, pitch: 0.8, strength: 0.9, life: 1, width: 0.055 }],
    }),
  ).data;
  const leftCenter = positiveDifferenceCentroidX(reference, left, 72);
  const rightCenter = positiveDifferenceCentroidX(reference, right, 72);
  assert.ok(
    leftCenter < 72 * 0.38,
    `left substorm remains left-weighted (${leftCenter})`,
  );
  assert.ok(
    rightCenter > 72 * 0.62,
    `right substorm remains right-weighted (${rightCenter})`,
  );
});

test("transient life decays continuously, sustain extends it, and dt=0 pauses", async () => {
  const { AuroraRenderer } = await loadAurora();
  const dry = new AuroraRenderer();
  const held = new AuroraRenderer();
  dry.noteOn(48, 112);
  held.noteOn(48, 112);
  dry.sustain(false);
  held.sustain(true);

  const originalLife = dry.impulses[0].life;
  dry.advance(0);
  assert.equal(dry.time, 0, "zero delta does not move the simulation clock");
  assert.equal(
    dry.impulses[0].life,
    originalLife,
    "zero delta does not decay note energy",
  );

  const samples = [];
  for (let i = 0; i < 8; i++) {
    dry.advance(0.04);
    held.advance(0.04);
    samples.push(dry.impulses[0]?.life ?? 0);
  }
  assert.ok(
    samples.every((life, index) => index === 0 || life < samples[index - 1]),
    "transient fades frame by frame",
  );
  assert.ok(samples.at(-1) > 0, "fade is gradual, with no early cutoff");
  assert.ok(
    held.impulses[0].life > dry.impulses[0].life,
    "sustain pedal slows the decay",
  );

  for (let i = 0; i < 100; i++) dry.triggerSubstorm((i % 17) / 16);
  assert.ok(
    dry.impulses.length <= 22,
    "note and substorm burst storage remains bounded",
  );
  for (let i = 0; i < 1000; i++) dry.advance(0.05);
  assert.equal(dry.impulses.length, 0, "expired transient state is reclaimed");
});
