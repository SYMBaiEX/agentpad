import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

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
};

export async function buildLinuxUinputHelper(
  options: BuildLinuxUinputHelperOptions = {},
): Promise<string> {
  if (process.platform !== "linux") {
    throw new Error("The Linux uinput helper can only be built on Linux");
  }

  const outputPath = resolve(
    options.outputPath ??
      join(homedir(), ".opencontroller", "bin", "opencontroller-uinput-bridge"),
  );
  await mkdir(dirname(outputPath), { recursive: true });

  const cc = options.cc ?? Bun.env.CC ?? "cc";
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

export function spawnLinuxUinputBridgeProcess(
  options: LinuxUinputBridgeProcessOptions,
): ReturnType<typeof Bun.spawn> {
  return Bun.spawn([options.helperPath], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...Bun.env,
      ...(options.devicePath
        ? { OPENCONTROLLER_UINPUT_DEVICE: options.devicePath }
        : {}),
      ...(options.deviceName
        ? { OPENCONTROLLER_UINPUT_NAME: options.deviceName }
        : {}),
    },
  });
}
