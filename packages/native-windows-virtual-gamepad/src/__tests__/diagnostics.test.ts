import { describe, expect, test } from "bun:test";
import {
  diagnoseWindowsVirtualGamepad,
  formatWindowsVirtualGamepadDiagnostics,
  parseScQueryViGEmBus,
} from "../diagnostics";

const runningOutput = `
SERVICE_NAME: ViGEmBus
        TYPE               : 1  KERNEL_DRIVER
        STATE              : 4  RUNNING
`;

const stoppedOutput = `
SERVICE_NAME: ViGEmBus
        TYPE               : 1  KERNEL_DRIVER
        STATE              : 1  STOPPED
`;

describe("windows virtual gamepad diagnostics", () => {
  test("reports non-Windows platforms as unsupported", async () => {
    const diagnostics = await diagnoseWindowsVirtualGamepad({
      platform: "linux",
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.supportedPlatform).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("Windows");
  });

  test("parses running ViGEmBus service output", () => {
    expect(parseScQueryViGEmBus(runningOutput)).toEqual({
      installed: true,
      running: true,
      state: "RUNNING",
    });
  });

  test("detects installed but stopped ViGEmBus", async () => {
    const diagnostics = await diagnoseWindowsVirtualGamepad({
      platform: "win32",
      runCommand: async () => ({
        exitCode: 0,
        stdout: stoppedOutput,
        stderr: "",
      }),
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.legacyViGEmBus.installed).toBe(true);
    expect(diagnostics.legacyViGEmBus.running).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("not running");
  });

  test("detects running legacy ViGEmBus", async () => {
    const diagnostics = await diagnoseWindowsVirtualGamepad({
      platform: "win32",
      runCommand: async () => ({
        exitCode: 0,
        stdout: runningOutput,
        stderr: "",
      }),
    });

    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.legacyViGEmBus.running).toBe(true);
    expect(formatWindowsVirtualGamepadDiagnostics(diagnostics)).toContain(
      "Ready: yes",
    );
  });

  test("recommends trusted install path when service is missing", async () => {
    const diagnostics = await diagnoseWindowsVirtualGamepad({
      platform: "win32",
      runCommand: async () => ({
        exitCode: 1060,
        stdout: "",
        stderr: "The specified service does not exist as an installed service.",
      }),
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.legacyViGEmBus.installed).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("trusted signed");
  });
});
