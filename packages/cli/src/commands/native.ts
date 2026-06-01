import type { ControllerProfileName } from "@opencontroller/core";
import { createController } from "@opencontroller/core";
import {
  type NativeHostBridgeAdapterOptions,
  type NativeHostBridgeBackendId,
  createNativeHostBridgeAdapter,
  resolveNativeHostBridgeBackend,
} from "@opencontroller/native";
import {
  type LinuxUinputDiagnostics,
  type LinuxUinputSetupPlan,
  diagnoseLinuxUinput,
  formatLinuxUinputDiagnostics,
  formatLinuxUinputSetupPlan,
  prepareLinuxUinputSetup,
} from "@opencontroller/native-linux-uinput";
import {
  type MacosDriverKitDiagnostics,
  type MacosDriverKitSetupPlan,
  diagnoseMacosDriverKit,
  formatMacosDriverKitDiagnostics,
  formatMacosDriverKitSetupPlan,
  prepareMacosDriverKitSetup,
} from "@opencontroller/native-macos-driverkit";
import {
  type WindowsVhfSetupPlan,
  type WindowsVirtualGamepadDiagnostics,
  diagnoseWindowsVirtualGamepad,
  formatWindowsVhfSetupPlan,
  formatWindowsVirtualGamepadDiagnostics,
  prepareWindowsVhfSetup,
} from "@opencontroller/native-windows-virtual-gamepad";

export type NativeCommandFlags = Record<string, string | boolean | undefined>;

export type NativeBackendId =
  | "linux-uinput"
  | "windows-virtual-gamepad"
  | "macos-driverkit";

export type NativeBackendSelection = NativeBackendId | "current" | "all";

export type NativeBackendReport = {
  backend: NativeBackendId;
  label: string;
  hostPlatform: NodeJS.Platform;
  platform: NodeJS.Platform;
  supportedPlatform: boolean;
  ok: boolean;
  recommendations: string[];
  diagnostics: unknown;
  formatted: string;
};

export type NativeDoctorResult = {
  selection: NativeBackendSelection;
  platform: NodeJS.Platform;
  ok: boolean;
  reports: NativeBackendReport[];
};

export type DiagnoseNativeBackendsOptions = {
  selection?: string;
  platform?: NodeJS.Platform;
  diagnoseBackend?: (backend: NativeBackendId) => Promise<NativeBackendReport>;
};

export type NativeTestPlan = {
  id: string;
  profile: ControllerProfileName;
  backend: NativeHostBridgeBackendId;
  adapterOptions: NativeHostBridgeAdapterOptions;
  dryRun: boolean;
  action: NativeTestAction;
};

export type NativeTestAction = {
  button: string;
  trigger: string;
};

export type NativeSetupBackendPlan =
  | LinuxUinputSetupPlan
  | WindowsVhfSetupPlan
  | MacosDriverKitSetupPlan;

export type NativeSetupPlan = {
  backend: NativeHostBridgeBackendId;
  platform: NodeJS.Platform;
  plan: NativeSetupBackendPlan;
  formatted: string;
};

export type PrepareNativeSetupOptions = {
  platform?: NodeJS.Platform;
  prepareLinux?: typeof prepareLinuxUinputSetup;
  prepareWindows?: typeof prepareWindowsVhfSetup;
  prepareMacos?: typeof prepareMacosDriverKitSetup;
};

const backendIds = [
  "linux-uinput",
  "windows-virtual-gamepad",
  "macos-driverkit",
] as const satisfies readonly NativeBackendId[];

export async function nativeCommand(
  args: string[],
  flags: NativeCommandFlags,
): Promise<void> {
  const subcommand = firstPositionalArg(args) ?? "doctor";

  switch (subcommand) {
    case "doctor":
      await nativeDoctorCommand(flags);
      return;
    case "test":
      await nativeTestCommand(flags);
      return;
    case "setup":
      await nativeSetupCommand(flags);
      return;
    case "help":
    case "--help":
    case "-h":
      printNativeHelp();
      return;
    default:
      throw new Error(`Unknown native command: ${subcommand}`);
  }
}

export async function nativeSetupCommand(
  flags: NativeCommandFlags,
): Promise<void> {
  const result = await prepareNativeSetup(flags);

  if (booleanFlag(flags, "json")) {
    console.log(
      JSON.stringify(
        {
          backend: result.backend,
          platform: result.platform,
          plan: result.plan,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(result.formatted);
  }
}

export async function prepareNativeSetup(
  flags: NativeCommandFlags,
  options: PrepareNativeSetupOptions = {},
): Promise<NativeSetupPlan> {
  const platform = options.platform ?? process.platform;
  const selection =
    stringFlag(flags, "backend") ?? stringFlag(flags, "platform") ?? "current";
  if (normalizeNativeBackendSelection(selection) === "all") {
    throw new Error(
      "Native setup runs one backend. Use current or a single backend.",
    );
  }

  const backend = resolveNativeHostBridgeBackend({
    backend: selection,
    platform,
  });

  switch (backend) {
    case "linux-uinput": {
      const plan = await (options.prepareLinux ?? prepareLinuxUinputSetup)(
        createLinuxNativeSetupOptions(flags, platform),
      );
      return {
        backend,
        platform,
        plan,
        formatted: formatLinuxUinputSetupPlan(plan),
      };
    }
    case "windows-vhf": {
      const plan = await (options.prepareWindows ?? prepareWindowsVhfSetup)(
        createWindowsNativeSetupOptions(flags, platform),
      );
      return {
        backend,
        platform,
        plan,
        formatted: formatWindowsVhfSetupPlan(plan),
      };
    }
    case "macos-driverkit": {
      const plan = await (options.prepareMacos ?? prepareMacosDriverKitSetup)(
        createMacosNativeSetupOptions(flags, platform),
      );
      return {
        backend,
        platform,
        plan,
        formatted: formatMacosDriverKitSetupPlan(plan),
      };
    }
  }
}

export async function nativeTestCommand(
  flags: NativeCommandFlags,
): Promise<void> {
  const plan = createNativeTestPlan(flags);
  const adapter = createNativeHostBridgeAdapter({
    ...plan.adapterOptions,
    onStdout(chunk) {
      process.stdout.write(chunk);
    },
    onStderr(chunk) {
      process.stderr.write(chunk);
    },
  });
  const controller = await createController({
    id: plan.id,
    profile: plan.profile,
    adapter,
    replay: false,
  });

  await controller.press(plan.action.button, 80, {
    intent: "native_test_press",
    source: "opencontroller-cli",
  });
  await controller.moveStick("LEFT", { x: 0, y: -1 }, 120, {
    intent: "native_test_move",
    source: "opencontroller-cli",
  });
  await controller.trigger(plan.action.trigger, 0.5, 90, {
    intent: "native_test_trigger",
    source: "opencontroller-cli",
  });
  await controller.neutral({
    intent: "native_test_neutral",
    source: "opencontroller-cli",
  });

  const state = controller.getState();
  await controller.disconnect();

  console.log("OpenController native test completed");
  console.log(
    JSON.stringify(
      {
        id: plan.id,
        profile: plan.profile,
        backend: plan.backend,
        dryRun: plan.dryRun,
        state,
      },
      null,
      2,
    ),
  );
}

export function createNativeTestPlan(
  flags: NativeCommandFlags,
  platform: NodeJS.Platform = process.platform,
): NativeTestPlan {
  const selection =
    stringFlag(flags, "backend") ?? stringFlag(flags, "platform") ?? "current";
  if (normalizeNativeBackendSelection(selection) === "all") {
    throw new Error(
      "Native test runs one backend. Use current or a single backend.",
    );
  }

  const backend = resolveNativeHostBridgeBackend({
    backend: selection,
    platform,
  });
  const profile = (stringFlag(flags, "profile") ??
    "xbox") as ControllerProfileName;
  const id = stringFlag(flags, "id") ?? "native-test";
  const dryRun = booleanFlag(flags, "dry-run");
  const waitForExitMs = numberFlag(flags, "wait-for-exit-ms");

  return {
    id,
    profile,
    backend,
    dryRun,
    action: nativeTestAction(profile),
    adapterOptions: {
      backend,
      ...(waitForExitMs !== undefined ? { waitForExitMs } : {}),
      linux: createLinuxNativeTestOptions(flags, dryRun, id),
      windows: createWindowsNativeTestOptions(flags, id),
      macos: createMacosNativeTestOptions(flags, id),
    },
  };
}

export async function nativeDoctorCommand(
  flags: NativeCommandFlags,
): Promise<void> {
  const selection =
    stringFlag(flags, "backend") ?? stringFlag(flags, "platform") ?? "current";
  const result = await diagnoseNativeBackends({ selection });

  if (booleanFlag(flags, "json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatNativeDoctor(result));
  }

  if (booleanFlag(flags, "check") && !result.ok) {
    process.exitCode = 1;
  }
}

export async function diagnoseNativeBackends(
  options: DiagnoseNativeBackendsOptions = {},
): Promise<NativeDoctorResult> {
  const platform = options.platform ?? process.platform;
  const selection = normalizeNativeBackendSelection(
    options.selection ?? "current",
  );
  const ids = resolveNativeBackendIds(selection, platform);
  const diagnoseBackend = options.diagnoseBackend ?? diagnoseNativeBackend;
  const reports: NativeBackendReport[] = [];

  for (const id of ids) {
    reports.push(await diagnoseBackend(id));
  }

  return {
    selection,
    platform,
    ok: reports.length > 0 && reports.every((report) => report.ok),
    reports,
  };
}

export function resolveNativeBackendIds(
  selection: string,
  platform: NodeJS.Platform = process.platform,
): NativeBackendId[] {
  const normalized = normalizeNativeBackendSelection(selection);

  if (normalized === "all") {
    return [...backendIds];
  }
  if (normalized !== "current") {
    return [normalized];
  }

  switch (platform) {
    case "linux":
      return ["linux-uinput"];
    case "win32":
      return ["windows-virtual-gamepad"];
    case "darwin":
      return ["macos-driverkit"];
    default:
      return [...backendIds];
  }
}

export function normalizeNativeBackendSelection(
  selection: string,
): NativeBackendSelection {
  switch (selection.trim().toLowerCase()) {
    case "current":
    case "host":
      return "current";
    case "all":
      return "all";
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
    case "xusb":
      return "windows-virtual-gamepad";
    case "macos":
    case "mac":
    case "darwin":
    case "macos-driverkit":
    case "driverkit":
      return "macos-driverkit";
    default:
      throw new Error(
        `Unknown native backend: ${selection}. Use current, all, linux-uinput, windows-virtual-gamepad, or macos-driverkit.`,
      );
  }
}

export function formatNativeDoctor(result: NativeDoctorResult): string {
  const lines = [
    "OpenController Native Backend Doctor",
    "",
    `Selection: ${result.selection}`,
    `Platform: ${result.platform}`,
    `Ready: ${result.ok ? "yes" : "no"}`,
  ];

  if (result.reports.length === 0) {
    lines.push("", "No native backend reports were produced.");
    return lines.join("\n");
  }

  for (const report of result.reports) {
    lines.push(
      "",
      `${report.label}:`,
      `  supported on this host: ${report.supportedPlatform ? "yes" : "no"}`,
      `  ready: ${report.ok ? "yes" : "no"}`,
      "",
      indent(report.formatted, "  "),
    );
  }

  return lines.join("\n");
}

async function diagnoseNativeBackend(
  backend: NativeBackendId,
): Promise<NativeBackendReport> {
  switch (backend) {
    case "linux-uinput":
      return linuxReport(await diagnoseLinuxUinput());
    case "windows-virtual-gamepad":
      return windowsReport(await diagnoseWindowsVirtualGamepad());
    case "macos-driverkit":
      return macosReport(await diagnoseMacosDriverKit());
  }
}

function linuxReport(diagnostics: LinuxUinputDiagnostics): NativeBackendReport {
  return {
    backend: "linux-uinput",
    label: "Linux uinput",
    hostPlatform: "linux",
    platform: diagnostics.platform,
    supportedPlatform: diagnostics.supportedPlatform,
    ok: diagnostics.ok,
    recommendations: diagnostics.recommendations,
    diagnostics,
    formatted: formatLinuxUinputDiagnostics(diagnostics),
  };
}

function windowsReport(
  diagnostics: WindowsVirtualGamepadDiagnostics,
): NativeBackendReport {
  return {
    backend: "windows-virtual-gamepad",
    label: "Windows virtual gamepad",
    hostPlatform: "win32",
    platform: diagnostics.platform,
    supportedPlatform: diagnostics.supportedPlatform,
    ok: diagnostics.ok,
    recommendations: diagnostics.recommendations,
    diagnostics,
    formatted: formatWindowsVirtualGamepadDiagnostics(diagnostics),
  };
}

function macosReport(
  diagnostics: MacosDriverKitDiagnostics,
): NativeBackendReport {
  return {
    backend: "macos-driverkit",
    label: "macOS DriverKit",
    hostPlatform: "darwin",
    platform: diagnostics.platform,
    supportedPlatform: diagnostics.supportedPlatform,
    ok: diagnostics.ok,
    recommendations: diagnostics.recommendations,
    diagnostics,
    formatted: formatMacosDriverKitDiagnostics(diagnostics),
  };
}

function stringFlag(
  flags: NativeCommandFlags,
  key: string,
): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function booleanFlag(flags: NativeCommandFlags, key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}

function numberFlag(
  flags: NativeCommandFlags,
  key: string,
): number | undefined {
  const value = stringFlag(flags, key);
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Expected --${key} to be a finite number, received ${value}`,
    );
  }
  return parsed;
}

function nativeTestAction(profile: ControllerProfileName): NativeTestAction {
  switch (profile) {
    case "playstation":
      return { button: "CROSS", trigger: "R2" };
    case "switch":
      return { button: "B", trigger: "ZR" };
    case "generic-hid":
      return { button: "BUTTON_0", trigger: "BUTTON_7" };
    case "keyboard-mouse":
      return { button: "KEY_SPACE", trigger: "MOUSE_LEFT" };
    case "xbox":
      return { button: "A", trigger: "RT" };
  }
}

function createLinuxNativeSetupOptions(
  flags: NativeCommandFlags,
  platform: NodeJS.Platform,
): Parameters<typeof prepareLinuxUinputSetup>[0] {
  const options: Parameters<typeof prepareLinuxUinputSetup>[0] = { platform };
  const outputPath =
    stringFlag(flags, "output") ?? stringFlag(flags, "helper-path");
  const cc = stringFlag(flags, "cc");
  const udevGroup = stringFlag(flags, "udev-group");

  if (outputPath) {
    options.outputPath = outputPath;
  }
  if (cc) {
    options.cc = cc;
  }
  if (udevGroup) {
    options.udevGroup = udevGroup;
  }

  return options;
}

function createWindowsNativeSetupOptions(
  flags: NativeCommandFlags,
  platform: NodeJS.Platform,
): Parameters<typeof prepareWindowsVhfSetup>[0] {
  const options: Parameters<typeof prepareWindowsVhfSetup>[0] = { platform };
  const outputDirectory = stringFlag(flags, "output");
  const hostBridgePath = stringFlag(flags, "host-bridge-path");
  const devicePath = stringFlag(flags, "device-path");

  if (outputDirectory) {
    options.outputDirectory = outputDirectory;
  }
  if (hostBridgePath) {
    options.hostBridgePath = hostBridgePath;
  }
  if (devicePath) {
    options.devicePath = devicePath;
  }

  return options;
}

function createMacosNativeSetupOptions(
  flags: NativeCommandFlags,
  platform: NodeJS.Platform,
): Parameters<typeof prepareMacosDriverKitSetup>[0] {
  const options: Parameters<typeof prepareMacosDriverKitSetup>[0] = {
    platform,
  };
  const bundle: NonNullable<
    Parameters<typeof prepareMacosDriverKitSetup>[0]
  >["bundle"] = {};
  const outputDirectory = stringFlag(flags, "output");
  const hostBridgePath = stringFlag(flags, "host-bridge-path");
  const appBundleIdentifier = stringFlag(flags, "app-bundle-id");
  const driverBundleIdentifier = stringFlag(flags, "driver-bundle-id");
  const driverClassName = stringFlag(flags, "driver-class-name");
  const teamIdentifier = stringFlag(flags, "team-id");

  if (outputDirectory) {
    options.outputDirectory = outputDirectory;
  }
  if (hostBridgePath) {
    options.hostBridgePath = hostBridgePath;
  }
  if (appBundleIdentifier) {
    bundle.appBundleIdentifier = appBundleIdentifier;
  }
  if (driverBundleIdentifier) {
    bundle.driverBundleIdentifier = driverBundleIdentifier;
  }
  if (driverClassName) {
    bundle.driverClassName = driverClassName;
  }
  if (teamIdentifier) {
    bundle.teamIdentifier = teamIdentifier;
  }
  if (Object.keys(bundle).length > 0) {
    options.bundle = bundle;
  }

  return options;
}

function createLinuxNativeTestOptions(
  flags: NativeCommandFlags,
  dryRun: boolean,
  controllerId: string,
): NonNullable<NativeHostBridgeAdapterOptions["linux"]> {
  const options: NonNullable<NativeHostBridgeAdapterOptions["linux"]> = {
    controllerId,
  };
  const helperPath = stringFlag(flags, "helper-path");
  const devicePath = stringFlag(flags, "device-path");
  const deviceName = stringFlag(flags, "device-name");

  if (helperPath) {
    options.helperPath = helperPath;
  }
  if (devicePath) {
    options.devicePath = devicePath;
  }
  if (deviceName) {
    options.deviceName = deviceName;
  }
  if (dryRun) {
    options.dryRun = true;
  }

  return options;
}

function createWindowsNativeTestOptions(
  flags: NativeCommandFlags,
  controllerId: string,
): NonNullable<NativeHostBridgeAdapterOptions["windows"]> {
  const hostBridgePath =
    stringFlag(flags, "host-bridge-path") ?? stringFlag(flags, "helper-path");
  const devicePath = stringFlag(flags, "device-path");
  const options: NonNullable<NativeHostBridgeAdapterOptions["windows"]> = {
    controllerId,
  };

  if (hostBridgePath) {
    options.hostBridgePath = hostBridgePath;
  }
  if (devicePath) {
    options.devicePath = devicePath;
  }

  return options;
}

function createMacosNativeTestOptions(
  flags: NativeCommandFlags,
  controllerId: string,
): NonNullable<NativeHostBridgeAdapterOptions["macos"]> {
  const hostBridgePath =
    stringFlag(flags, "host-bridge-path") ?? stringFlag(flags, "helper-path");
  const driverBundleIdentifier = stringFlag(flags, "driver-bundle-id");
  const driverClassName = stringFlag(flags, "driver-class-name");
  const options: NonNullable<NativeHostBridgeAdapterOptions["macos"]> = {
    controllerId,
  };

  if (hostBridgePath) {
    options.hostBridgePath = hostBridgePath;
  }
  if (driverBundleIdentifier) {
    options.driverBundleIdentifier = driverBundleIdentifier;
  }
  if (driverClassName) {
    options.driverClassName = driverClassName;
  }

  return options;
}

function firstPositionalArg(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }
    if (!arg.startsWith("--")) {
      return arg;
    }
    if (arg.includes("=")) {
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      index += 1;
    }
  }

  return undefined;
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : line))
    .join("\n");
}

function printNativeHelp(): void {
  console.log(`OpenController Native CLI

Usage:
  opencontroller native doctor
  opencontroller native doctor --backend current
  opencontroller native doctor --backend all
  opencontroller native doctor --backend linux-uinput --json
  opencontroller native doctor --backend macos-driverkit --check
  opencontroller native setup --backend current
  opencontroller native setup --backend windows-vhf --output ./opencontroller-windows-vhf
  opencontroller native test --backend linux-uinput --dry-run --id player-1
  opencontroller native test --backend current
  opencontroller native test --backend windows-vhf --id player-1 --host-bridge-path ./OpenControllerVhfHostBridge.exe

Backends:
  current
  all
  linux-uinput
  windows-vhf
  windows-virtual-gamepad
  macos-driverkit
`);
}
