export type UniversalFaceButton = "SOUTH" | "EAST" | "WEST" | "NORTH";

export type UniversalShoulder =
  | "LEFT_BUMPER"
  | "RIGHT_BUMPER"
  | "LEFT_TRIGGER"
  | "RIGHT_TRIGGER";

export type UniversalSystem =
  | "SELECT"
  | "START"
  | "HOME"
  | "CAPTURE"
  | "TOUCHPAD";

export type UniversalStick = "LEFT_STICK" | "RIGHT_STICK";

export type UniversalDpad =
  | "DPAD_UP"
  | "DPAD_DOWN"
  | "DPAD_LEFT"
  | "DPAD_RIGHT";

export type UniversalControl =
  | UniversalFaceButton
  | UniversalShoulder
  | UniversalSystem
  | UniversalStick
  | UniversalDpad;
