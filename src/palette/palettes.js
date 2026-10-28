export const palettes = {
  warm: {
    label: "Warm",
    hues: [4, 18, 32, 44, 54, 350],
    saturation: 88,
    lightness: 61,
  },
  cool: {
    label: "Cool",
    hues: [178, 192, 208, 224, 244, 268],
    saturation: 82,
    lightness: 62,
  },
  pastel: {
    label: "Pastel",
    hues: [342, 18, 52, 154, 198, 262],
    saturation: 54,
    lightness: 76,
  },
  neon: {
    label: "Neon",
    hues: [155, 182, 202, 282, 318, 56],
    saturation: 92,
    lightness: 61,
  },
  contrast: {
    label: "Contrast",
    hues: [350, 188, 54, 268, 118, 24],
    saturation: 88,
    lightness: 59,
  },
};
export function paletteColor(note, offset = 0, palette = "warm") {
  const selected = palettes[palette] ?? palettes.warm;
  const index = Math.abs(note + offset) % selected.hues.length;
  return {
    hue: selected.hues[index],
    saturation: selected.saturation,
    lightness: selected.lightness,
  };
}
export function hsl(color, shift = 0, alpha = 1) {
  const lightness = Math.max(0, Math.min(100, color.lightness + shift));
  return `hsla(${color.hue},${color.saturation}%,${lightness}%,${alpha})`;
}
