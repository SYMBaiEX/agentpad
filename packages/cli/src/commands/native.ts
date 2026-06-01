import {
  type LinuxUinputDiagnostics,
  diagnoseLinuxUinput,
  formatLinuxUinputDiagnostics,
} from "@opencontroller/native-linux-uinput";
import {
  type MacosDriverKitDiagnostics,
  diagnoseMacosDriverKit,
  formatMacosDriverKitDiagnostics,
} from "@opencontroller/native-macos-driverkit";
import {
  type WindowsVirtualGamepadDiagnostics,
  diagnoseWindowsVirtualGamepad,
  formatWindowsVirtualGamepadDiagnostics,
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
    case "help":
    case "--help":
    case "-h":
      printNativeHelp();
      return;
    default:
      throw new Error(`Unknown native command: ${subcommand}`);
  }
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

Backends:
  current
  all
  linux-uinput
  windows-virtual-gamepad
  macos-driverkit
`);
}
