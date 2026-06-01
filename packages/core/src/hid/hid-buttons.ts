import { resolveProfile, toUniversal } from "../profiles";
import type { ControllerState } from "../types";
import { xInputButtonBits } from "./xinput";

export type HidGamepadButtonName =
  | keyof typeof xInputButtonBits
  | "HOME"
  | "CAPTURE"
  | "TOUCHPAD";

export const hidGamepadButtonBits = {
  ...xInputButtonBits,
  HOME: 0x0400,
  CAPTURE: 0x0800,
  TOUCHPAD: 0x0800,
} satisfies Record<HidGamepadButtonName, number>;

export function createHidGamepadButtonMask(state: ControllerState): number {
  const profile = resolveProfile(state.profile);
  let buttons = 0;

  for (const [button, pressed] of Object.entries(state.buttons)) {
    if (!pressed) {
      continue;
    }

    const universal = toUniversal(profile, button);
    switch (universal) {
      case "SOUTH":
        buttons |= hidGamepadButtonBits.A;
        break;
      case "EAST":
        buttons |= hidGamepadButtonBits.B;
        break;
      case "WEST":
        buttons |= hidGamepadButtonBits.X;
        break;
      case "NORTH":
        buttons |= hidGamepadButtonBits.Y;
        break;
      case "LEFT_BUMPER":
        buttons |= hidGamepadButtonBits.LB;
        break;
      case "RIGHT_BUMPER":
        buttons |= hidGamepadButtonBits.RB;
        break;
      case "SELECT":
        buttons |= hidGamepadButtonBits.BACK;
        break;
      case "START":
        buttons |= hidGamepadButtonBits.START;
        break;
      case "HOME":
        buttons |= hidGamepadButtonBits.HOME;
        break;
      case "CAPTURE":
        buttons |= hidGamepadButtonBits.CAPTURE;
        break;
      case "TOUCHPAD":
        buttons |= hidGamepadButtonBits.TOUCHPAD;
        break;
      case "LEFT_STICK":
        buttons |= hidGamepadButtonBits.LS;
        break;
      case "RIGHT_STICK":
        buttons |= hidGamepadButtonBits.RS;
        break;
      case "DPAD_UP":
        buttons |= hidGamepadButtonBits.DPAD_UP;
        break;
      case "DPAD_DOWN":
        buttons |= hidGamepadButtonBits.DPAD_DOWN;
        break;
      case "DPAD_LEFT":
        buttons |= hidGamepadButtonBits.DPAD_LEFT;
        break;
      case "DPAD_RIGHT":
        buttons |= hidGamepadButtonBits.DPAD_RIGHT;
        break;
    }
  }

  return buttons;
}
