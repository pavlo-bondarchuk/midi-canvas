export function decodeMIDIMessage(data) {
  const [status, first, second] = data;
  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (command === 0x90 && second > 0) {
    return { type: "noteOn", note: first, velocity: second, channel };
  }
  if (command === 0x80 || (command === 0x90 && second === 0)) {
    return { type: "noteOff", note: first, velocity: second, channel };
  }
  if (command === 0xb0) {
    return { type: "control", controller: first, value: second, channel };
  }
  return null;
}
