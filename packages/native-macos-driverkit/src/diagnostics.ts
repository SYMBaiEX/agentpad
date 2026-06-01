export type MacosDriverKitCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type MacosDriverKitToolDiagnostic = {
  name: string;
  available: boolean;
  path?: string;
  error?: string;
};

export type MacosDriverKitDiagnostics = {
  platform: NodeJS.Platform;
  supportedPlatform: boolean;
  ok: boolean;
  tools: MacosDriverKitToolDiagnostic[];
  recommendations: string[];
};

export type DiagnoseMacosDriverKitOptions = {
  platform?: NodeJS.Platform;
  runCommand?: (
    command: string,
    args: string[],
  ) => Promise<MacosDriverKitCommandResult>;
};

const requiredTools = [
  { name: "xcodebuild", command: "xcrun", args: ["--find", "xcodebuild"] },
  { name: "codesign", command: "xcrun", args: ["--find", "codesign"] },
  {
    name: "systemextensionsctl",
    command: "/usr/bin/which",
    args: ["systemextensionsctl"],
  },
] as const;

export async function diagnoseMacosDriverKit(
  options: DiagnoseMacosDriverKitOptions = {},
): Promise<MacosDriverKitDiagnostics> {
  const platform = options.platform ?? process.platform;

  if (platform !== "darwin") {
    return {
      platform,
      supportedPlatform: false,
      ok: false,
      tools: [],
      recommendations: [
        "@opencontroller/native-macos-driverkit only prepares DriverKit assets on macOS.",
      ],
    };
  }

  const runCommand = options.runCommand ?? runCommandDefault;
  const tools = await Promise.all(
    requiredTools.map((tool) => inspectTool(tool, runCommand)),
  );
  const recommendations = createRecommendations(tools);

  return {
    platform,
    supportedPlatform: true,
    ok: tools.every((tool) => tool.available),
    tools,
    recommendations,
  };
}

export function formatMacosDriverKitDiagnostics(
  diagnostics: MacosDriverKitDiagnostics,
): string {
  const lines = [
    "OpenController macOS DriverKit Doctor",
    "",
    `Platform: ${diagnostics.platform}`,
    `Supported: ${diagnostics.supportedPlatform ? "yes" : "no"}`,
    `Ready: ${diagnostics.ok ? "yes" : "no"}`,
  ];

  if (diagnostics.tools.length > 0) {
    lines.push("", "Tools:");
    for (const tool of diagnostics.tools) {
      lines.push(
        `  ${tool.name}: ${tool.available ? "available" : "missing"}${
          tool.path ? ` (${tool.path})` : ""
        }`,
      );
      if (tool.error) {
        lines.push(`    ${tool.error}`);
      }
    }
  }

  if (diagnostics.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const recommendation of diagnostics.recommendations) {
      lines.push(`  - ${recommendation}`);
    }
  }

  return lines.join("\n");
}

async function inspectTool(
  tool: (typeof requiredTools)[number],
  runCommand: (
    command: string,
    args: string[],
  ) => Promise<MacosDriverKitCommandResult>,
): Promise<MacosDriverKitToolDiagnostic> {
  const result = await runCommand(tool.command, [...tool.args]);
  const output = (result.stdout || result.stderr).trim();

  if (result.exitCode !== 0) {
    return {
      name: tool.name,
      available: false,
      ...(output ? { error: output } : {}),
    };
  }

  return {
    name: tool.name,
    available: true,
    ...(output ? { path: output.split("\n")[0] } : {}),
  };
}

async function runCommandDefault(
  command: string,
  args: string[],
): Promise<MacosDriverKitCommandResult> {
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

function createRecommendations(
  tools: MacosDriverKitToolDiagnostic[],
): string[] {
  const recommendations: string[] = [
    "DriverKit virtual HID distribution requires Apple-approved entitlements, code signing, notarization, and user-approved System Extension activation.",
    "Ship the dext inside a host app under Contents/Library/SystemExtensions and activate it with the SystemExtensions framework.",
  ];
  const missing = tools.filter((tool) => !tool.available);

  if (missing.length > 0) {
    recommendations.push(
      `Install or select Xcode command line tools so these commands are available: ${missing
        .map((tool) => tool.name)
        .join(", ")}.`,
    );
  } else {
    recommendations.push(
      "Local DriverKit authoring tools appear available for asset generation and signing prep.",
    );
  }

  return recommendations;
}
