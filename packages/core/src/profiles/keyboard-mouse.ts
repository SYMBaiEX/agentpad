import type { ControllerProfile } from "./index";

export const keyboardMouseButtons = [
  "KEY_SPACE",
  "KEY_ESCAPE",
  "KEY_E",
  "KEY_F",
  "KEY_W",
  "KEY_A",
  "KEY_S",
  "KEY_D",
  "MOUSE_LEFT",
  "MOUSE_RIGHT",
  "MOUSE_MIDDLE",
  "DPAD_UP",
  "DPAD_DOWN",
  "DPAD_LEFT",
  "DPAD_RIGHT",
] as const;

export const keyboardMouseProfile: ControllerProfile = {
  name: "keyboard-mouse",
  buttons: keyboardMouseButtons,
  triggers: ["MOUSE_LEFT", "MOUSE_RIGHT"],
  aliases: {
    A: "KEY_SPACE",
    B: "KEY_ESCAPE",
    X: "KEY_F",
    Y: "KEY_E",
    RT: "MOUSE_LEFT",
    LT: "MOUSE_RIGHT",
  },
  toUniversal: {
    KEY_SPACE: "SOUTH",
    KEY_ESCAPE: "EAST",
    KEY_F: "WEST",
    KEY_E: "NORTH",
    MOUSE_RIGHT: "LEFT_TRIGGER",
    MOUSE_LEFT: "RIGHT_TRIGGER",
    DPAD_UP: "DPAD_UP",
    DPAD_DOWN: "DPAD_DOWN",
    DPAD_LEFT: "DPAD_LEFT",
    DPAD_RIGHT: "DPAD_RIGHT",
  },
};
