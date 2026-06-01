import type { ControllerState } from "@agentpad/core";
import { type OverlayThemeName, resolveOverlayTheme } from "../themes";

export type CanvasRendererOptions = {
  canvas: HTMLCanvasElement;
  theme?: OverlayThemeName;
};

export function renderControllerCanvas(
  state: ControllerState,
  options: CanvasRendererOptions,
): void {
  const context = options.canvas.getContext("2d");
  if (!context) {
    return;
  }

  const theme = resolveOverlayTheme(options.theme ?? "default");
  const width = options.canvas.width;
  const height = options.canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = theme.transparent ? "rgba(0,0,0,0)" : theme.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = theme.shell;
  context.strokeStyle = theme.shellStroke;
  context.lineWidth = 4;
  roundedRect(
    context,
    width * 0.14,
    height * 0.24,
    width * 0.72,
    height * 0.48,
    36,
  );
  context.fill();
  context.stroke();
  drawStick(
    context,
    width * 0.34,
    height * 0.56,
    state.sticks.left.x,
    state.sticks.left.y,
    theme.active,
  );
  drawStick(
    context,
    width * 0.62,
    height * 0.62,
    state.sticks.right.x,
    state.sticks.right.y,
    theme.active,
  );
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawStick(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  valueX: number,
  valueY: number,
  color: string,
): void {
  context.beginPath();
  context.arc(x, y, 32, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.fillStyle = color;
  context.arc(x + valueX * 22, y + valueY * 22, 16, 0, Math.PI * 2);
  context.fill();
}
