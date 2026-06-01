import { describe, expect, test } from "bun:test";
import {
  diagnoseMacosDriverKit,
  formatMacosDriverKitDiagnostics,
} from "../diagnostics";

describe("macOS DriverKit diagnostics", () => {
  test("reports non-macOS platforms as unsupported", async () => {
    const diagnostics = await diagnoseMacosDriverKit({
      platform: "linux",
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.supportedPlatform).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("macOS");
  });

  test("detects required local tools", async () => {
    const diagnostics = await diagnoseMacosDriverKit({
      platform: "darwin",
      runCommand: async (_command, args) => ({
        exitCode: 0,
        stdout: `/usr/bin/${args.at(-1) ?? "tool"}\n`,
        stderr: "",
      }),
    });

    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.tools.map((tool) => tool.available)).toEqual([
      true,
      true,
      true,
    ]);
    expect(formatMacosDriverKitDiagnostics(diagnostics)).toContain(
      "Ready: yes",
    );
  });

  test("recommends Xcode tools when a required tool is missing", async () => {
    const diagnostics = await diagnoseMacosDriverKit({
      platform: "darwin",
      runCommand: async (_command, args) => {
        if (args.includes("xcodebuild")) {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "xcode-select: error: tool 'xcodebuild' requires Xcode",
          };
        }
        return {
          exitCode: 0,
          stdout: `/usr/bin/${args.at(-1) ?? "tool"}\n`,
          stderr: "",
        };
      },
    });

    expect(diagnostics.ok).toBe(false);
    expect(
      diagnostics.tools.find((tool) => tool.name === "xcodebuild")?.available,
    ).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("Xcode");
  });
});
