import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  NativeProcessBridgeAdapter,
  type NativeProcessBridgeAdapterOptions,
} from "@opencontroller/core";
import {
  type LinuxUinputUdevRule,
  createLinuxUinputUdevRules,
} from "./diagnostics";

export const linuxUinputHelperSourcePath = new URL(
  "../src/helper/opencontroller-uinput-bridge.c",
  import.meta.url,
).pathname;

export type BuildLinuxUinputHelperOptions = {
  cc?: string;
  outputPath?: string;
};

export type PrepareLinuxUinputSetupOptions = BuildLinuxUinputHelperOptions & {
  platform?: NodeJS.Platform;
  udevGroup?: string;
  buildHelper?: (options: BuildLinuxUinputHelperOptions) => Promise<string>;
};

export type LinuxUinputSetupPlan = {
  platform: NodeJS.Platform;
  helperPath: string;
  udevRules: LinuxUinputUdevRule[];
  doctorCommand: string;
  dryRunCommand: string;
  bridgeCommand: string;
};

export type LinuxUinputBridgeProcessOptions = {
  helperPath: string;
  controllerId?: string;
  devicePath?: string;
  deviceName?: string;
  dryRun?: boolean;
};

export type LinuxUinputBridgeAdapterOptions = Pick<
  NativeProcessBridgeAdapterOptions,
  | "args"
  | "cwd"
  | "env"
  | "includeConnectMessage"
  | "device"
  | "includeState"
  | "includeExtensions"
  | "includeProfileHidReport"
  | "waitForExitMs"
  | "killSignal"
  | "spawn"
  | "supportsVirtualDevice"
  | "supportsRumble"
  | "supportsLights"
  | "virtualDeviceKind"
  | "requiresNativeInstall"
  | "requiresElevatedPermissions"
  | "onFeedback"
  | "onStdout"
  | "onStderr"
  | "onExit"
> & {
  helperPath?: string;
  controllerId?: string;
  devicePath?: string;
  deviceName?: string;
  dryRun?: boolean;
};

export function defaultLinuxUinputHelperPath(
  homeDirectory = homedir(),
): string {
  return join(
    homeDirectory,
    ".opencontroller",
    "bin",
    "opencontroller-uinput-bridge",
  );
}

export async function buildLinuxUinputHelper(
  options: BuildLinuxUinputHelperOptions = {},
): Promise<string> {
  if (process.platform !== "linux") {
    throw new Error("The Linux uinput helper can only be built on Linux");
  }

  const outputPath = resolve(
    options.outputPath ?? defaultLinuxUinputHelperPath(),
  );
  await mkdir(dirname(outputPath), { recursive: true });

  const cc = options.cc ?? process.env.CC ?? "cc";
  const proc = Bun.spawn(
    [
      cc,
      "-O2",
      "-Wall",
      "-Wextra",
      "-o",
      outputPath,
      linuxUinputHelperSourcePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(
      [`Failed to build Linux uinput helper with ${cc}`, stdout, stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return outputPath;
}

export async function prepareLinuxUinputSetup(
  options: PrepareLinuxUinputSetupOptions = {},
): Promise<LinuxUinputSetupPlan> {
  const platform = options.platform ?? process.platform;
  if (platform !== "linux") {
    throw new Error("Linux uinput setup can only be prepared on Linux");
  }

  const buildOptions: BuildLinuxUinputHelperOptions = {};
  if (options.cc !== undefined) {
    buildOptions.cc = options.cc;
  }
  if (options.outputPath !== undefined) {
    buildOptions.outputPath = options.outputPath;
  }

  const helperPath = await (options.buildHelper ?? buildLinuxUinputHelper)(
    buildOptions,
  );
  const udevRules = createLinuxUinputUdevRules(
    options.udevGroup === undefined ? {} : { group: options.udevGroup },
  );

  return {
    platform,
    helperPath,
    udevRules,
    doctorCommand: "opencontroller-linux-uinput-doctor --check",
    dryRunCommand: `opencontroller bridge --id player-1 | ${quoteShell(helperPath)} --controller-id player-1 --dry-run`,
    bridgeCommand: `opencontroller bridge --id player-1 | ${quoteShell(helperPath)} --controller-id player-1`,
  };
}

export function formatLinuxUinputSetupPlan(plan: LinuxUinputSetupPlan): string {
  const lines = [
    "OpenController Linux uinput Setup",
    "",
    `Helper built: ${plan.helperPath}`,
    "",
    "No privileged system changes were made.",
    "",
    "Verify the host:",
    `  ${plan.doctorCommand}`,
    "",
    "Dry-run the bridge stream:",
    `  ${plan.dryRunCommand}`,
    "",
    "Run against /dev/uinput after permissions are ready:",
    `  ${plan.bridgeCommand}`,
    "",
    "Optional reviewed udev rules:",
  ];

  for (const rule of plan.udevRules) {
    lines.push(
      "",
      `${rule.name}:`,
      `  ${rule.description}`,
      `  ${formatInstallUdevRuleCommand(rule)}`,
      "  sudo modprobe uinput",
      "  sudo udevadm control --reload-rules",
      "  sudo udevadm trigger --subsystem-match=misc",
    );
  }

  return lines.join("\n");
}

export function createLinuxUinputBridgeAdapter(
  options: LinuxUinputBridgeAdapterOptions = {},
): NativeProcessBridgeAdapter {
  const helperPath = resolve(
    options.helperPath ?? defaultLinuxUinputHelperPath(),
  );
  const args = [...(options.args ?? [])];
  if (options.dryRun && !args.includes("--dry-run")) {
    args.push("--dry-run");
  }
  if (options.controllerId && !hasOption(args, "--controller-id")) {
    args.push("--controller-id", options.controllerId);
  }

  return new NativeProcessBridgeAdapter({
    command: helperPath,
    args,
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: createLinuxUinputBridgeEnv(options),
    ...(options.includeConnectMessage !== undefined
      ? { includeConnectMessage: options.includeConnectMessage }
      : {}),
    device: {
      deviceName: options.deviceName ?? "OpenController Linux uinput Gamepad",
      ...(options.device ?? {}),
    },
    includeState: options.includeState ?? false,
    includeExtensions: options.includeExtensions ?? true,
    includeProfileHidReport: options.includeProfileHidReport ?? true,
    ...(options.waitForExitMs !== undefined
      ? { waitForExitMs: options.waitForExitMs }
      : {}),
    ...(options.killSignal ? { killSignal: options.killSignal } : {}),
    ...(options.spawn ? { spawn: options.spawn } : {}),
    supportsVirtualDevice: options.supportsVirtualDevice ?? !options.dryRun,
    supportsRumble: options.supportsRumble ?? true,
    supportsLights: options.supportsLights ?? true,
    virtualDeviceKind:
      options.virtualDeviceKind ??
      (options.dryRun ? "native-helper" : "os-virtual-gamepad"),
    requiresNativeInstall: options.requiresNativeInstall ?? true,
    requiresElevatedPermissions: options.requiresElevatedPermissions ?? false,
    ...(options.onFeedback ? { onFeedback: options.onFeedback } : {}),
    ...(options.onStdout ? { onStdout: options.onStdout } : {}),
    ...(options.onStderr ? { onStderr: options.onStderr } : {}),
    ...(options.onExit ? { onExit: options.onExit } : {}),
  });
}

export function spawnLinuxUinputBridgeProcess(
  options: LinuxUinputBridgeProcessOptions,
): ReturnType<typeof Bun.spawn> {
  return Bun.spawn([options.helperPath], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...(options.devicePath
        ? { OPENCONTROLLER_UINPUT_DEVICE: options.devicePath }
        : {}),
      ...(options.deviceName
        ? { OPENCONTROLLER_UINPUT_NAME: options.deviceName }
        : {}),
      ...(options.dryRun ? { OPENCONTROLLER_UINPUT_DRY_RUN: "1" } : {}),
      ...(options.controllerId
        ? { OPENCONTROLLER_CONTROLLER_ID: options.controllerId }
        : {}),
    },
  });
}

function createLinuxUinputBridgeEnv(
  options: Pick<
    LinuxUinputBridgeAdapterOptions,
    "controllerId" | "devicePath" | "deviceName" | "dryRun" | "env"
  >,
): Record<string, string | undefined> {
  return {
    ...process.env,
    ...options.env,
    ...(options.devicePath
      ? { OPENCONTROLLER_UINPUT_DEVICE: options.devicePath }
      : {}),
    ...(options.deviceName
      ? { OPENCONTROLLER_UINPUT_NAME: options.deviceName }
      : {}),
    ...(options.dryRun ? { OPENCONTROLLER_UINPUT_DRY_RUN: "1" } : {}),
    ...(options.controllerId
      ? { OPENCONTROLLER_CONTROLLER_ID: options.controllerId }
      : {}),
  };
}

function hasOption(args: string[], name: string): boolean {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
}

function formatInstallUdevRuleCommand(rule: LinuxUinputUdevRule): string {
  return `printf '%s\\n' ${quoteShell(rule.rule)} | sudo tee ${quoteShell(
    rule.path,
  )} >/dev/null`;
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
