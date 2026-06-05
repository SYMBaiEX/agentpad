import type { Unsubscribe } from "../events";
import type {
  ControllerAdapterCapabilities,
  ControllerCommandType,
  ControllerProfileName,
  ControllerState,
  FeedbackListener,
  NormalizedControllerCommand,
} from "../types";

export interface ControllerAdapter {
  name: string;
  platform: "all" | "linux" | "windows" | "macos" | "browser";
  connect(): Promise<void>;
  send(command: NormalizedControllerCommand): Promise<void>;
  syncState?(state: ControllerState): Promise<void>;
  onFeedback?(listener: FeedbackListener): Unsubscribe;
  neutral(command?: NormalizedControllerCommand): Promise<void>;
  disconnect(): Promise<void>;
  capabilities(): ControllerAdapterCapabilities;
}

export const controllerProfileNames = [
  "xbox",
  "playstation",
  "switch",
  "generic-hid",
  "keyboard-mouse",
] as const satisfies readonly ControllerProfileName[];

export const controllerCommandTypes = [
  "press",
  "release",
  "setButton",
  "stick",
  "trigger",
  "setStick",
  "setTrigger",
  "dpad",
  "setDpad",
  "setState",
  "combo",
  "sequence",
  "wait",
  "touchpad",
  "motion",
  "neutral",
] as const satisfies readonly ControllerCommandType[];

export const gamepadCommandTypes = [
  "press",
  "release",
  "setButton",
  "stick",
  "trigger",
  "setStick",
  "setTrigger",
  "dpad",
  "setDpad",
  "setState",
  "combo",
  "sequence",
  "wait",
  "neutral",
] as const satisfies readonly ControllerCommandType[];

export const baseCapabilities: ControllerAdapterCapabilities = {
  supportsButtons: true,
  supportsAnalogTriggers: true,
  supportsSticks: true,
  supportsDpad: true,
  supportsRumble: false,
  supportsLights: false,
  supportsTouchpad: false,
  supportsGyro: false,
  supportsStateSync: false,
  supportsXInputReports: false,
  supportsNativeBridge: false,
  supportsMultipleControllers: true,
  supportsVirtualDevice: false,
  requiresNativeInstall: false,
  requiresElevatedPermissions: false,
  supportedProfiles: controllerProfileNames,
  supportedCommands: gamepadCommandTypes,
  outputFormats: ["normalized-command"],
  reportFormats: [],
  feedbackTypes: [],
  transport: "memory",
  virtualDeviceKind: "none",
};

export function createAdapterCapabilities(
  overrides: Partial<ControllerAdapterCapabilities> = {},
): ControllerAdapterCapabilities {
  return {
    ...baseCapabilities,
    ...overrides,
  };
}
