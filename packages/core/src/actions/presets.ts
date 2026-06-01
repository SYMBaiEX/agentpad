import type { ActionMapDefinition } from "./action-map";

export const xboxActionPreset = {
  interact: [{ type: "press", button: "A", durationMs: 100 }],
  dodge: [{ type: "press", button: "B", durationMs: 90 }],
  lightAttack: [{ type: "press", button: "X", durationMs: 120 }],
  heavyAttack: [{ type: "press", button: "Y", durationMs: 160 }],
  moveForward: [{ type: "stick", stick: "LEFT", x: 0, y: -1, durationMs: 300 }],
  stop: [{ type: "neutral" }],
} satisfies ActionMapDefinition;

export const playstationActionPreset = {
  interact: [{ type: "press", button: "CROSS", durationMs: 100 }],
  dodge: [{ type: "press", button: "CIRCLE", durationMs: 90 }],
  lightAttack: [{ type: "press", button: "SQUARE", durationMs: 120 }],
  heavyAttack: [{ type: "press", button: "TRIANGLE", durationMs: 160 }],
  moveForward: [{ type: "stick", stick: "LEFT", x: 0, y: -1, durationMs: 300 }],
  stop: [{ type: "neutral" }],
} satisfies ActionMapDefinition;
