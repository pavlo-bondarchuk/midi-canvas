const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

async function importSource(source) {
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
}

async function loadKeyboardInput() {
  const root = path.resolve(__dirname, "../src/input");
  const [keyboardSource, mapSource] = await Promise.all([
    readFile(path.join(root, "keyboard.js"), "utf8"),
    readFile(path.join(root, "keyboard-map.js"), "utf8"),
  ]);
  const map = await importSource(mapSource);
  const source = keyboardSource.replace(
    /import\s*\{\s*keyboardMap\s*\}\s*from\s*["']\.\/keyboard-map\.js["'];?/,
    `const keyboardMap = ${JSON.stringify(map.keyboardMap)};`,
  );
  assert.notEqual(
    source,
    keyboardSource,
    "test loader resolved keyboard map import",
  );
  return (await importSource(source)).KeyboardInput;
}

function keyEvent(key, extra = {}) {
  return {
    key,
    repeat: false,
    target: null,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...extra,
  };
}

test("keyboard release retains the original note when octave changes while held", async () => {
  const KeyboardInput = await loadKeyboardInput();
  const on = [],
    off = [],
    octave = [];
  const keyboard = new KeyboardInput({
    isEnabled: () => true,
    onNoteOn: (...args) => on.push(args),
    onNoteOff: (...args) => off.push(args),
    onOctaveChange: (base) => octave.push(base),
  });
  keyboard.handleDown(keyEvent("z"));
  keyboard.handleDown(keyEvent("ArrowUp"));
  keyboard.handleUp(keyEvent("z"));
  assert.deepEqual(on, [[48, 92]]);
  assert.deepEqual(octave, [60]);
  assert.deepEqual(off, [[48, 0]]);
});

test("keyboard suppresses repeat events and clear releases every pressed voice", async () => {
  const KeyboardInput = await loadKeyboardInput();
  const on = [],
    off = [];
  const keyboard = new KeyboardInput({
    isEnabled: () => true,
    onNoteOn: (...args) => on.push(args),
    onNoteOff: (...args) => off.push(args),
    onOctaveChange() {},
  });
  keyboard.handleDown(keyEvent("z"));
  keyboard.handleDown(keyEvent("z", { repeat: true }));
  keyboard.handleDown(keyEvent("x"));
  assert.deepEqual(on, [
    [48, 92],
    [50, 92],
  ]);
  keyboard.clear(); // Called by the app on window blur or when switching inputs.
  assert.deepEqual(off, [
    [48, 0],
    [50, 0],
  ]);
  assert.equal(keyboard.pressed.size, 0);
});

test("MIDI note-on with velocity zero decodes as note-off", async () => {
  const { decodeMIDIMessage } = await importSource(
    await readFile(path.resolve(__dirname, "../src/input/midi.js"), "utf8"),
  );
  assert.deepEqual(decodeMIDIMessage([0x93, 60, 0]), {
    type: "noteOff",
    note: 60,
    velocity: 0,
    channel: 4,
  });
});

test("MIDI sustain controller reports CC64 with channel and pedal value", async () => {
  const { decodeMIDIMessage } = await importSource(
    await readFile(path.resolve(__dirname, "../src/input/midi.js"), "utf8"),
  );
  assert.deepEqual(decodeMIDIMessage([0xb1, 64, 127]), {
    type: "control",
    controller: 64,
    value: 127,
    channel: 2,
  });
  assert.deepEqual(decodeMIDIMessage([0xb1, 64, 0]), {
    type: "control",
    controller: 64,
    value: 0,
    channel: 2,
  });
});
