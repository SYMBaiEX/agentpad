import type {
  ControllerAdapterCapabilities,
  ControllerState,
  NormalizedControllerCommand,
} from "../types";

export interface ControllerAdapter {
  name: string;
  platform: "all" | "linux" | "windows" | "macos" | "browser";
  connect(): Promise<void>;
  send(command: NormalizedControllerCommand): Promise<void>;
  syncState?(state: ControllerState): Promise<void>;
  neutral(command?: NormalizedControllerCommand): Promise<void>;
  disconnect(): Promise<void>;
  capabilities(): ControllerAdapterCapabilities;
}

export const baseCapabilities: ControllerAdapterCapabilities = {
  supportsButtons: true,
  supportsAnalogTriggers: true,
  supportsSticks: true,
  supportsDpad: true,
  supportsRumble: false,
  supportsTouchpad: false,
  supportsGyro: false,
  supportsStateSync: false,
  supportsXInputReports: false,
  supportsMultipleControllers: true,
  supportsVirtualDevice: false,
  requiresNativeInstall: false,
  requiresElevatedPermissions: false,
};
