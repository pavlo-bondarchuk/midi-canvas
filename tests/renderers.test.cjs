const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function loadRenderer(name) {
  const url = pathToFileURL(
    path.resolve(__dirname, `../src/visuals/modes/${name}.js`),
  );
  try {
    return (await import(url.href)).default;
  } catch (error) {
    // The browser sources are native ES modules; load them from a data URL so
    // Node can exercise them without a package.json or third-party tooling.
    const source = await readFile(url, "utf8");
    return (
      await import(
        `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
      )
    ).default;
  }
}

function canvasRecorder() {
  const calls = [];
  const gradient = () => ({
    addColorStop(offset, color) {
      assert.ok(Number.isFinite(offset), `gradient stop is finite: ${offset}`);
      assert.ok(
        offset >= 0 && offset <= 1,
        `gradient stop lies in [0, 1]: ${offset}`,
      );
      assert.equal(typeof color, "string");
    },
  });
  const methods = new Set([
    "fillRect",
    "clearRect",
    "beginPath",
    "closePath",
    "moveTo",
    "lineTo",
    "quadraticCurveTo",
    "bezierCurveTo",
    "arc",
    "ellipse",
    "fill",
    "stroke",
    "translate",
    "rotate",
    "save",
    "restore",
    "setTransform",
  ]);
  const ctx = new Proxy(
    { globalAlpha: 1, globalCompositeOperation: "source-over" },
    {
      get(target, property) {
        if (
          property === "createLinearGradient" ||
          property === "createRadialGradient"
        )
          return (...args) => {
            args.forEach((value) =>
              assert.ok(
                Number.isFinite(value),
                `${String(property)} coordinate is finite: ${value}`,
              ),
            );
            calls.push(property);
            return gradient();
          };
        if (methods.has(property))
          return (...args) => {
            for (const value of args) {
              if (typeof value === "number")
                assert.ok(
                  Number.isFinite(value),
                  `${String(property)} coordinate is finite: ${value}`,
                );
            }
            calls.push(property);
          };
        return target[property];
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

const color = { hue: 186, saturation: 90, lightness: 62 };
const frame = (renderer, ctx, count = 1, dt = 1 / 60) => {
  for (let i = 0; i < count; i++) renderer.updateAndDraw(ctx, dt);
};

for (const name of ["aurora", "fireflies", "rain", "spots", "lines", "visualizer"]) {
  test(`${name} renders finite coordinates after note bursts, time advance, and resize`, async () => {
    const Renderer = await loadRenderer(name);
    const renderer = new Renderer();
    const { ctx, calls } = canvasRecorder();
    renderer.resize(320, 240);
    frame(renderer, ctx, 3);
    for (let note = 24; note < 60; note++) renderer.noteOn(note, 127, color);
    renderer.noteOff(48);
    renderer.sustain(true);
    frame(renderer, ctx, 80, 0.04);
    renderer.sustain(false);
    renderer.resize(960, 540);
    renderer.noteOn(72, 110, color);
    frame(renderer, ctx, 18, 0.04);
    assert.ok(calls.length > 0, "renderer issued canvas drawing commands");
  });
}

test("fireflies begin only after a note and fade away after release", async () => {
  const Renderer = await loadRenderer("fireflies");
  const renderer = new Renderer();
  const { ctx } = canvasRecorder();
  renderer.resize(320, 240);
  frame(renderer, ctx, 2);
  assert.equal(renderer.lights.length, 0);
  assert.equal(renderer.sparks.length, 0);
  renderer.noteOn(60, 127, color);
  assert.ok(renderer.lights.length > 0);
  assert.ok(renderer.sparks.length > 0);
  renderer.noteOff(60);
  frame(renderer, ctx, 110, 0.04);
  assert.equal(renderer.lights.length, 0);
  assert.equal(renderer.sparks.length, 0);
  assert.equal(renderer.trails.length, 0);
});

test("firefly noteOff releases only the exact MIDI note", async () => {
  const Renderer = await loadRenderer("fireflies");
  const renderer = new Renderer();
  const { ctx } = canvasRecorder();
  renderer.resize(320, 240);
  renderer.noteOn(60, 127, color);
  renderer.noteOn(61, 127, color);
  const note60 = renderer.lights.filter((light) => light.note === 60);
  const note61 = renderer.lights.filter((light) => light.note === 61);
  renderer.noteOff(60);
  assert.ok(note60.every((light) => light.released));
  assert.ok(note61.every((light) => !light.released));
  frame(renderer, ctx, 10, 0.04);
  assert.ok(
    note61.every((light) => light.life > light.age),
    "neighbor note remains alive",
  );
});

test("firefly sustain defers note release and pedal up releases only pending voices", async () => {
  const Renderer = await loadRenderer("fireflies");
  const renderer = new Renderer();
  const { ctx } = canvasRecorder();
  renderer.resize(320, 240);
  renderer.noteOn(60, 127, color);
  renderer.noteOn(64, 127, color);
  const held = renderer.lights.filter((light) => light.note === 60);
  const other = renderer.lights.filter((light) => light.note === 64);
  renderer.sustain(true);
  renderer.noteOff(60);
  assert.ok(held.every((light) => light.pendingRelease && !light.released));
  frame(renderer, ctx, 20, 0.04);
  assert.ok(
    held.every((light) => !light.released),
    "sustain holds released keys",
  );
  renderer.sustain(false);
  assert.ok(held.every((light) => light.released && !light.pendingRelease));
  assert.ok(
    other.every((light) => !light.released),
    "pedal up does not release other held keys",
  );
});

test("rain impacts add pooled water and the pool drains over time", async () => {
  const Renderer = await loadRenderer("rain");
  const renderer = new Renderer();
  const { ctx } = canvasRecorder();
  renderer.resize(320, 240);
  renderer.noteOn(60, 127, color);
  frame(renderer, ctx, 200, 0.04);
  const pooled = renderer.water.reduce((sum, amount) => sum + amount, 0);
  assert.ok(pooled > 0, "falling drops accumulated at the bottom");
  frame(renderer, ctx, 500, 0.04);
  const drained = renderer.water.reduce((sum, amount) => sum + amount, 0);
  assert.ok(drained < pooled, "standing water fades gradually");
});

test("rain sustain pedal slows the drain of accumulated water", async () => {
  const Renderer = await loadRenderer("rain");
  const dry = new Renderer();
  const held = new Renderer();
  const { ctx: dryCtx } = canvasRecorder();
  const { ctx: heldCtx } = canvasRecorder();
  dry.resize(320, 240);
  held.resize(320, 240);
  dry.water.fill(0.4);
  held.water.fill(0.4);
  dry.sustain(false);
  held.sustain(true);
  frame(dry, dryCtx, 120, 0.04);
  frame(held, heldCtx, 120, 0.04);
  const dryLevel = dry.water.reduce((sum, amount) => sum + amount, 0);
  const sustainedLevel = held.water.reduce((sum, amount) => sum + amount, 0);
  assert.ok(sustainedLevel > dryLevel, "pedal sustains a fuller water surface");
});

test("note bursts keep renderer particle collections bounded", async () => {
  for (const [name, limits] of [
    ["fireflies", { lights: 220, sparks: 1600, trails: 80 }],
    ["rain", { drops: 950 }],
  ]) {
    const Renderer = await loadRenderer(name);
    const renderer = new Renderer();
    renderer.resize(320, 240);
    for (let i = 0; i < 180; i++) renderer.noteOn(21 + (i % 88), 127, color);
    for (const [collection, limit] of Object.entries(limits)) {
      assert.ok(
        renderer[collection].length <= limit,
        `${name}.${collection} remains within ${limit}`,
      );
    }
  }
});
