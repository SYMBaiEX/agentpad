import {
  AdapterError,
  type NativeProcessBridgeAdapterOptions,
} from "@opencontroller/core";
import {
  type LinuxUinputBridgeAdapterOptions,
  createLinuxUinputBridgeAdapter,
  defaultLinuxUinputHelperPath,
} from "@opencontroller/native-linux-uinput";
import {
  type MacosDriverKitHostBridgeAdapterOptions,
  createMacosDriverKitHostBridgeAdapter,
  defaultMacosDriverKitHostBridgePath,
} from "@opencontroller/native-macos-driverkit";
import {
  type WindowsVhfHostBridgeAdapterOptions,
  createWindowsVhfHostBridgeAdapter,
  defaultWindowsVhfHostBridgePath,
} from "@opencontroller/native-windows-virtual-gamepad";

export type NativeHostBridgeBackendId =
  | "linux-uinput"
  | "windows-vhf"
  | "macos-driverkit";

export type NativeHostBridgeBackendSelection =
  | NativeHostBridgeBackendId
  | "current"
  | "auto";

export type NativeHostBridgeBackendInfo = {
  id: NativeHostBridgeBackendId;
  label: string;
  platform: NodeJS.Platform;
  packageName: string;
};

type CommonNativeProcessBridgeOptions = Pick<
  NativeProcessBridgeAdapterOptions,
  | "args"
  | "cwd"
  | "env"
  | "includeState"
  | "waitForExitMs"
  | "killSignal"
  | "spawn"
  | "onStdout"
  | "onStderr"
  | "onExit"
>;

export type NativeHostBridgeAdapterOptions =
  CommonNativeProcessBridgeOptions & {
    backend?: string;
    platform?: NodeJS.Platform;
    linux?: Omit<
      LinuxUinputBridgeAdapterOptions,
      keyof CommonNativeProcessBridgeOptions
    >;
    windows?: Omit<
      WindowsVhfHostBridgeAdapterOptions,
      keyof CommonNativeProcessBridgeOptions
    >;
    macos?: Omit<
      MacosDriverKitHostBridgeAdapterOptions,
      keyof CommonNativeProcessBridgeOptions
    >;
  };

export type NativeHostBridgePathOptions = {
  backend?: string;
  platform?: NodeJS.Platform;
};

export const nativeHostBridgeBackends = [
  {
    id: "linux-uinput",
    label: "Linux uinput",
    platform: "linux",
    packageName: "@opencontroller/native-linux-uinput",
  },
  {
    id: "windows-vhf",
    label: "Windows VHF",
    platform: "win32",
    packageName: "@opencontroller/native-windows-virtual-gamepad",
  },
  {
    id: "macos-driverkit",
    label: "macOS DriverKit",
    platform: "darwin",
    packageName: "@opencontroller/native-macos-driverkit",
  },
] as const satisfies readonly NativeHostBridgeBackendInfo[];

export function normalizeNativeHostBridgeBackend(
  selection: string,
): NativeHostBridgeBackendSelection {
  switch (selection.trim().toLowerCase()) {
    case "auto":
    case "current":
    case "host":
      return "current";
    case "linux":
    case "linux-uinput":
    case "uinput":
      return "linux-uinput";
    case "windows":
    case "win32":
    case "windows-vhf":
    case "windows-virtual-gamepad":
    case "virtual-gamepad":
    case "vhf":
      return "windows-vhf";
    case "macos":
    case "mac":
    case "darwin":
    case "macos-driverkit":
    case "driverkit":
      return "macos-driverkit";
    default:
      throw new AdapterError(
        "NATIVE_BACKEND_UNKNOWN",
        `Unknown native host bridge backend: ${selection}. Use current, linux-uinput, windows-vhf, or macos-driverkit.`,
      );
  }
}

export function resolveNativeHostBridgeBackend(
  options: NativeHostBridgePathOptions = {},
): NativeHostBridgeBackendId {
  const platform = options.platform ?? process.platform;
  const selection = normalizeNativeHostBridgeBackend(
    options.backend ?? "current",
  );

  if (selection !== "current" && selection !== "auto") {
    return selection;
  }

  switch (platform) {
    case "linux":
      return "linux-uinput";
    case "win32":
      return "windows-vhf";
    case "darwin":
      return "macos-driverkit";
    default:
      throw new AdapterError(
        "NATIVE_BACKEND_UNSUPPORTED",
        `No default OpenController native host bridge backend is available for platform ${platform}. Choose linux-uinput, windows-vhf, or macos-driverkit explicitly.`,
      );
  }
}

export function defaultNativeHostBridgePath(
  options: NativeHostBridgePathOptions = {},
): string {
  switch (resolveNativeHostBridgeBackend(options)) {
    case "linux-uinput":
      return defaultLinuxUinputHelperPath();
    case "windows-vhf":
      return defaultWindowsVhfHostBridgePath();
    case "macos-driverkit":
      return defaultMacosDriverKitHostBridgePath();
  }
}

export function createNativeHostBridgeAdapter(
  options: NativeHostBridgeAdapterOptions = {},
) {
  const common = commonNativeProcessBridgeOptions(options);

  switch (resolveNativeHostBridgeBackend(options)) {
    case "linux-uinput":
      return createLinuxUinputBridgeAdapter({
        ...common,
        ...options.linux,
      });
    case "windows-vhf":
      return createWindowsVhfHostBridgeAdapter({
        ...common,
        ...options.windows,
      });
    case "macos-driverkit":
      return createMacosDriverKitHostBridgeAdapter({
        ...common,
        ...options.macos,
      });
  }
}

function commonNativeProcessBridgeOptions(
  options: CommonNativeProcessBridgeOptions,
): CommonNativeProcessBridgeOptions {
  const common: CommonNativeProcessBridgeOptions = {};

  if (options.args !== undefined) {
    common.args = options.args;
  }
  if (options.cwd !== undefined) {
    common.cwd = options.cwd;
  }
  if (options.env !== undefined) {
    common.env = options.env;
  }
  if (options.includeState !== undefined) {
    common.includeState = options.includeState;
  }
  if (options.waitForExitMs !== undefined) {
    common.waitForExitMs = options.waitForExitMs;
  }
  if (options.killSignal !== undefined) {
    common.killSignal = options.killSignal;
  }
  if (options.spawn !== undefined) {
    common.spawn = options.spawn;
  }
  if (options.onStdout !== undefined) {
    common.onStdout = options.onStdout;
  }
  if (options.onStderr !== undefined) {
    common.onStderr = options.onStderr;
  }
  if (options.onExit !== undefined) {
    common.onExit = options.onExit;
  }

  return common;
}
