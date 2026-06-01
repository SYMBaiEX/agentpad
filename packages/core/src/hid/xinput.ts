import { resolveProfile, toUniversal } from "../profiles";
import type { ControllerState } from "../types";

export type XInputButtonName =
  | "DPAD_UP"
  | "DPAD_DOWN"
  | "DPAD_LEFT"
  | "DPAD_RIGHT"
  | "START"
  | "BACK"
  | "LS"
  | "RS"
  | "LB"
  | "RB"
  | "A"
  | "B"
  | "X"
  | "Y";

export type XInputGamepadReport = {
  buttons: number;
  leftTrigger: number;
  rightTrigger: number;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
};

export const xInputButtonBits = {
  DPAD_UP: 0x0001,
  DPAD_DOWN: 0x0002,
  DPAD_LEFT: 0x0004,
  DPAD_RIGHT: 0x0008,
  START: 0x0010,
  BACK: 0x0020,
  LS: 0x0040,
  RS: 0x0080,
  LB: 0x0100,
  RB: 0x0200,
  A: 0x1000,
  B: 0x2000,
  X: 0x4000,
  Y: 0x8000,
} satisfies Record<XInputButtonName, number>;

const universalToXInput: Record<string, XInputButtonName | undefined> = {
  SOUTH: "A",
  EAST: "B",
  WEST: "X",
  NORTH: "Y",
  LEFT_BUMPER: "LB",
  RIGHT_BUMPER: "RB",
  SELECT: "BACK",
  START: "START",
  LEFT_STICK: "LS",
  RIGHT_STICK: "RS",
  DPAD_UP: "DPAD_UP",
  DPAD_DOWN: "DPAD_DOWN",
  DPAD_LEFT: "DPAD_LEFT",
  DPAD_RIGHT: "DPAD_RIGHT",
};

export function createXInputReport(
  state: ControllerState,
): XInputGamepadReport {
  const profile = resolveProfile(state.profile);
  let buttons = 0;
  let leftTrigger = 0;
  let rightTrigger = 0;

  for (const [button, pressed] of Object.entries(state.buttons)) {
    const universal = toUniversal(profile, button);
    if (!universal) {
      continue;
    }

    if (universal === "LEFT_TRIGGER") {
      leftTrigger = Math.max(leftTrigger, pressed ? 255 : 0);
      continue;
    }
    if (universal === "RIGHT_TRIGGER") {
      rightTrigger = Math.max(rightTrigger, pressed ? 255 : 0);
      continue;
    }

    const xInput = universalToXInput[universal];
    if (pressed && xInput) {
      buttons |= xInputButtonBits[xInput];
    }
  }

  for (const [button, value] of Object.entries(state.analogButtons)) {
    const universal = toUniversal(profile, button);
    if (universal === "LEFT_TRIGGER") {
      leftTrigger = toU8(value);
    }
    if (universal === "RIGHT_TRIGGER") {
      rightTrigger = toU8(value);
    }
  }

  return {
    buttons,
    leftTrigger,
    rightTrigger,
    leftStickX: toI16(state.sticks.left.x),
    leftStickY: toI16(-state.sticks.left.y),
    rightStickX: toI16(state.sticks.right.x),
    rightStickY: toI16(-state.sticks.right.y),
  };
}

export function encodeXInputReport(
  reportOrState: XInputGamepadReport | ControllerState,
): Uint8Array {
  const report =
    "connected" in reportOrState
      ? createXInputReport(reportOrState)
      : reportOrState;
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, report.buttons, true);
  view.setUint8(2, report.leftTrigger);
  view.setUint8(3, report.rightTrigger);
  view.setInt16(4, report.leftStickX, true);
  view.setInt16(6, report.leftStickY, true);
  view.setInt16(8, report.rightStickX, true);
  view.setInt16(10, report.rightStickY, true);
  return bytes;
}

export function decodeXInputReport(bytes: Uint8Array): XInputGamepadReport {
  if (bytes.byteLength < 12) {
    throw new RangeError("XInput reports must be at least 12 bytes");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    buttons: view.getUint16(0, true),
    leftTrigger: view.getUint8(2),
    rightTrigger: view.getUint8(3),
    leftStickX: view.getInt16(4, true),
    leftStickY: view.getInt16(6, true),
    rightStickX: view.getInt16(8, true),
    rightStickY: view.getInt16(10, true),
  };
}

function toU8(value: number): number {
  return Math.round(clamp(value, 0, 1) * 255);
}

function toI16(value: number): number {
  const clamped = clamp(value, -1, 1);
  return clamped < 0
    ? Math.round(clamped * 32768)
    : Math.round(clamped * 32767);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(max, Math.max(min, value));
}
