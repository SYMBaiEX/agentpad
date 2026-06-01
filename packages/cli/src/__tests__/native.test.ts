import { describe, expect, test } from "bun:test";
import {
  type NativeBackendId,
  type NativeBackendReport,
  diagnoseNativeBackends,
  formatNativeDoctor,
  normalizeNativeBackendSelection,
  resolveNativeBackendIds,
} from "../commands/native";

describe("native backend selection", () => {
  test("selects the current platform backend", () => {
    expect(resolveNativeBackendIds("current", "linux")).toEqual([
      "linux-uinput",
    ]);
    expect(resolveNativeBackendIds("current", "win32")).toEqual([
      "windows-virtual-gamepad",
    ]);
    expect(resolveNativeBackendIds("current", "darwin")).toEqual([
      "macos-driverkit",
    ]);
  });

  test("normalizes backend aliases", () => {
    expect(normalizeNativeBackendSelection("uinput")).toBe("linux-uinput");
    expect(normalizeNativeBackendSelection("vhf")).toBe(
      "windows-virtual-gamepad",
    );
    expect(normalizeNativeBackendSelection("driverkit")).toBe(
      "macos-driverkit",
    );
  });

  test("selects every backend for all", () => {
    expect(resolveNativeBackendIds("all", "darwin")).toEqual([
      "linux-uinput",
      "windows-virtual-gamepad",
      "macos-driverkit",
    ]);
  });
});

describe("native backend diagnostics", () => {
  test("aggregates injected backend reports", async () => {
    const result = await diagnoseNativeBackends({
      selection: "all",
      platform: "darwin",
      diagnoseBackend: async (backend) =>
        fakeReport(backend, backend !== "windows-virtual-gamepad"),
    });

    expect(result.ok).toBe(false);
    expect(result.reports.map((report) => report.backend)).toEqual([
      "linux-uinput",
      "windows-virtual-gamepad",
      "macos-driverkit",
    ]);
  });

  test("formats a native doctor summary", () => {
    const output = formatNativeDoctor({
      selection: "current",
      platform: "linux",
      ok: true,
      reports: [fakeReport("linux-uinput", true)],
    });

    expect(output).toContain("OpenController Native Backend Doctor");
    expect(output).toContain("Linux uinput");
    expect(output).toContain("ready: yes");
    expect(output).toContain("fake linux-uinput report");
  });
});

function fakeReport(
  backend: NativeBackendId,
  ok: boolean,
): NativeBackendReport {
  const label = {
    "linux-uinput": "Linux uinput",
    "windows-virtual-gamepad": "Windows virtual gamepad",
    "macos-driverkit": "macOS DriverKit",
  }[backend];
  const hostPlatform = {
    "linux-uinput": "linux",
    "windows-virtual-gamepad": "win32",
    "macos-driverkit": "darwin",
  }[backend] as NodeJS.Platform;

  return {
    backend,
    label,
    hostPlatform,
    platform: hostPlatform,
    supportedPlatform: true,
    ok,
    recommendations: ok ? ["ready"] : ["not ready"],
    diagnostics: {
      platform: hostPlatform,
      supportedPlatform: true,
      ok,
    },
    formatted: `fake ${backend} report`,
  };
}
