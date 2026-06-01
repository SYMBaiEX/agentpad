export const legacyViGEmBusServiceName = "ViGEmBus";

export type WindowsVirtualGamepadCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type WindowsVirtualGamepadDiagnostics = {
  platform: NodeJS.Platform;
  supportedPlatform: boolean;
  ok: boolean;
  legacyViGEmBus: {
    serviceName: string;
    installed?: boolean;
    running?: boolean;
    state?: string;
    exitCode?: number;
    output?: string;
    error?: string;
  };
  recommendations: string[];
};

export type DiagnoseWindowsVirtualGamepadOptions = {
  platform?: NodeJS.Platform;
  runCommand?: (
    command: string,
    args: string[],
  ) => Promise<WindowsVirtualGamepadCommandResult>;
};

export async function diagnoseWindowsVirtualGamepad(
  options: DiagnoseWindowsVirtualGamepadOptions = {},
): Promise<WindowsVirtualGamepadDiagnostics> {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    return {
      platform,
      supportedPlatform: false,
      ok: false,
      legacyViGEmBus: {
        serviceName: legacyViGEmBusServiceName,
      },
      recommendations: [
        "@opencontroller/native-windows-virtual-gamepad only runs Windows host diagnostics on Windows.",
      ],
    };
  }

  const runCommand = options.runCommand ?? runCommandDefault;
  const result = await runCommand("sc.exe", [
    "query",
    legacyViGEmBusServiceName,
  ]);
  const parsed = parseScQueryViGEmBus(result.stdout || result.stderr);
  const installed = result.exitCode === 0 && parsed.installed;
  const running = installed && parsed.running;
  const recommendations = createRecommendations({
    installed,
    running,
    exitCode: result.exitCode,
    ...(parsed.state ? { state: parsed.state } : {}),
  });

  return {
    platform,
    supportedPlatform: true,
    ok: Boolean(running),
    legacyViGEmBus: {
      serviceName: legacyViGEmBusServiceName,
      installed,
      running,
      ...(parsed.state ? { state: parsed.state } : {}),
      exitCode: result.exitCode,
      output: result.stdout || result.stderr,
    },
    recommendations,
  };
}

export function parseScQueryViGEmBus(output: string): {
  installed: boolean;
  running: boolean;
  state?: string;
} {
  const installed = output.includes(
    `SERVICE_NAME: ${legacyViGEmBusServiceName}`,
  );
  const stateMatch = output.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/);
  const state = stateMatch?.[1];

  return {
    installed,
    running: state === "RUNNING",
    ...(state ? { state } : {}),
  };
}

export function formatWindowsVirtualGamepadDiagnostics(
  diagnostics: WindowsVirtualGamepadDiagnostics,
): string {
  const lines = [
    "OpenController Windows Virtual Gamepad Doctor",
    "",
    `Platform: ${diagnostics.platform}`,
    `Supported: ${diagnostics.supportedPlatform ? "yes" : "no"}`,
    `Ready: ${diagnostics.ok ? "yes" : "no"}`,
    "",
    "Legacy ViGEmBus:",
    `  service: ${diagnostics.legacyViGEmBus.serviceName}`,
  ];

  if (diagnostics.legacyViGEmBus.installed !== undefined) {
    lines.push(
      `  installed: ${diagnostics.legacyViGEmBus.installed ? "yes" : "no"}`,
    );
  }
  if (diagnostics.legacyViGEmBus.running !== undefined) {
    lines.push(
      `  running: ${diagnostics.legacyViGEmBus.running ? "yes" : "no"}`,
    );
  }
  if (diagnostics.legacyViGEmBus.state) {
    lines.push(`  state: ${diagnostics.legacyViGEmBus.state}`);
  }

  if (diagnostics.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const recommendation of diagnostics.recommendations) {
      lines.push(`  - ${recommendation}`);
    }
  }

  return lines.join("\n");
}

async function runCommandDefault(
  command: string,
  args: string[],
): Promise<WindowsVirtualGamepadCommandResult> {
  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return {
    exitCode,
    stdout,
    stderr,
  };
}

function createRecommendations(input: {
  installed: boolean;
  running: boolean;
  state?: string;
  exitCode: number;
}): string[] {
  const recommendations: string[] = [
    "ViGEmBus is a legacy compatibility backend; prefer a maintained Windows virtual-device backend when one is available.",
  ];

  if (!input.installed) {
    recommendations.push(
      "No ViGEmBus service was detected. If you choose the legacy path, install only a trusted signed driver from the original vendor/project documentation.",
    );
    return recommendations;
  }
  if (!input.running) {
    recommendations.push(
      `ViGEmBus is installed but not running${input.state ? ` (${input.state})` : ""}. Restart the service or reboot after driver installation.`,
    );
    return recommendations;
  }

  recommendations.push(
    "Legacy ViGEmBus appears available for compatibility testing.",
  );
  return recommendations;
}
