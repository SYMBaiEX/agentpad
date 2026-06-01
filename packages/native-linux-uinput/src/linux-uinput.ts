import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  NativeProcessBridgeAdapter,
  type NativeProcessBridgeAdapterOptions,
} from "@opencontroller/core";

export const linuxUinputHelperSourcePath = new URL(
  "../src/helper/opencontroller-uinput-bridge.c",
  import.meta.url,
).pathname;

export type BuildLinuxUinputHelperOptions = {
  cc?: string;
  outputPath?: string;
};

export type LinuxUinputBridgeProcessOptions = {
  helperPath: string;
  devicePath?: string;
  deviceName?: string;
  dryRun?: boolean;
};

export type LinuxUinputBridgeAdapterOptions = Pick<
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
> & {
  helperPath?: string;
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

  return new NativeProcessBridgeAdapter({
    command: helperPath,
    args,
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: createLinuxUinputBridgeEnv(options),
    includeState: options.includeState ?? false,
    ...(options.waitForExitMs !== undefined
      ? { waitForExitMs: options.waitForExitMs }
      : {}),
    ...(options.killSignal ? { killSignal: options.killSignal } : {}),
    ...(options.spawn ? { spawn: options.spawn } : {}),
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
    },
  });
}

function createLinuxUinputBridgeEnv(
  options: Pick<
    LinuxUinputBridgeAdapterOptions,
    "devicePath" | "deviceName" | "dryRun" | "env"
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
  };
}
