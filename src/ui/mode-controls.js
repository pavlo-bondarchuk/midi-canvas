export function bindModeControls(
  modeButtons,
  paletteButtons,
  onMode,
  onPalette,
) {
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => onMode(button.dataset.mode));
  });
  paletteButtons.forEach((button) => {
    button.addEventListener("click", () => onPalette(button.dataset.palette));
  });
}
