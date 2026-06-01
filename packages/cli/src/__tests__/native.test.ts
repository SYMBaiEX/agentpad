import { describe, expect, test } from "bun:test";
import {
  type NativeBackendId,
  type NativeBackendReport,
  createNativeTestPlan,
  diagnoseNativeBackends,
  formatNativeDoctor,
  normalizeNativeBackendSelection,
  prepareNativeSetup,
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
    expect(normalizeNativeBackendSelection("windows-vhf")).toBe(
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

describe("native backend test plan", () => {
  test("creates a Linux dry-run plan with helper options", () => {
    const plan = createNativeTestPlan(
      {
        backend: "linux-uinput",
        "dry-run": true,
        "helper-path": "/tmp/opencontroller-uinput-bridge",
        "device-name": "OpenController Test Gamepad",
        profile: "switch",
        id: "player-test",
        "wait-for-exit-ms": "250",
      },
      "darwin",
    );

    expect(plan).toMatchObject({
      id: "player-test",
      profile: "switch",
      backend: "linux-uinput",
      dryRun: true,
      action: {
        button: "B",
        trigger: "ZR",
      },
      adapterOptions: {
        backend: "linux-uinput",
        waitForExitMs: 250,
        linux: {
          controllerId: "player-test",
          helperPath: "/tmp/opencontroller-uinput-bridge",
          deviceName: "OpenController Test Gamepad",
          dryRun: true,
        },
      },
    });
  });

  test("normalizes Windows aliases for native tests", () => {
    const plan = createNativeTestPlan({
      backend: "vhf",
      "helper-path": "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    });

    expect(plan.backend).toBe("windows-vhf");
    expect(plan.adapterOptions.windows?.hostBridgePath).toBe(
      "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    );
  });

  test("rejects all-backend native tests", () => {
    expect(() => createNativeTestPlan({ backend: "all" })).toThrow(
      "Native test runs one backend",
    );
  });
});

describe("native backend setup plan", () => {
  test("dispatches Windows setup flags to the VHF package", async () => {
    const seen: unknown[] = [];
    const result = await prepareNativeSetup(
      {
        backend: "windows-vhf",
        output: "./opencontroller-windows-vhf",
        "host-bridge-path":
          "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
        "device-path": "\\\\.\\OpenControllerTestGamepad",
      },
      {
        platform: "darwin",
        prepareWindows: async (options) => {
          seen.push(options);
          return fakeWindowsSetupPlan;
        },
      },
    );

    expect(result.backend).toBe("windows-vhf");
    expect(result.formatted).toContain("OpenController Windows VHF Setup");
    expect(seen).toEqual([
      {
        platform: "darwin",
        outputDirectory: "./opencontroller-windows-vhf",
        hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
        devicePath: "\\\\.\\OpenControllerTestGamepad",
      },
    ]);
  });

  test("dispatches macOS setup flags to the DriverKit package", async () => {
    const seen: unknown[] = [];
    const result = await prepareNativeSetup(
      {
        backend: "macos-driverkit",
        output: "./opencontroller-macos-driverkit",
        "host-bridge-path":
          "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
        "driver-bundle-id": "com.example.opencontroller.driver",
        "driver-class-name": "ExampleOpenControllerDriver",
        "team-id": "TEAM42",
      },
      {
        platform: "linux",
        prepareMacos: async (options) => {
          seen.push(options);
          return fakeMacosSetupPlan;
        },
      },
    );

    expect(result.backend).toBe("macos-driverkit");
    expect(result.formatted).toContain("OpenController macOS DriverKit Setup");
    expect(seen).toEqual([
      {
        platform: "linux",
        outputDirectory: "./opencontroller-macos-driverkit",
        hostBridgePath:
          "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
        bundle: {
          driverBundleIdentifier: "com.example.opencontroller.driver",
          driverClassName: "ExampleOpenControllerDriver",
          teamIdentifier: "TEAM42",
        },
      },
    ]);
  });

  test("dispatches Linux setup flags to the uinput package", async () => {
    const seen: unknown[] = [];
    const result = await prepareNativeSetup(
      {
        backend: "linux-uinput",
        output: "/tmp/opencontroller-uinput-bridge",
        cc: "clang",
        "udev-group": "input",
      },
      {
        platform: "linux",
        prepareLinux: async (options) => {
          seen.push(options);
          return fakeLinuxSetupPlan;
        },
      },
    );

    expect(result.backend).toBe("linux-uinput");
    expect(result.formatted).toContain("OpenController Linux uinput Setup");
    expect(seen).toEqual([
      {
        platform: "linux",
        outputPath: "/tmp/opencontroller-uinput-bridge",
        cc: "clang",
        udevGroup: "input",
      },
    ]);
  });

  test("rejects all-backend native setup", async () => {
    await expect(prepareNativeSetup({ backend: "all" })).rejects.toThrow(
      "Native setup runs one backend",
    );
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

const fakeLinuxSetupPlan = {
  platform: "linux",
  helperPath: "/tmp/opencontroller-uinput-bridge",
  udevRules: [],
  doctorCommand: "opencontroller-linux-uinput-doctor --check",
  dryRunCommand:
    "opencontroller bridge --id player-1 | /tmp/opencontroller-uinput-bridge --controller-id player-1 --dry-run",
  bridgeCommand:
    "opencontroller bridge --id player-1 | /tmp/opencontroller-uinput-bridge --controller-id player-1",
} as const;

const fakeWindowsSetupPlan = {
  platform: "win32",
  outputDirectory: "C:\\OpenController\\vhf-kit",
  driverDirectory: "C:\\OpenController\\vhf-kit\\driver",
  hostBridgeDirectory: "C:\\OpenController\\vhf-kit\\host-bridge",
  hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
  devicePath: "\\\\.\\OpenControllerVhfGamepad",
  files: ["C:\\OpenController\\vhf-kit\\driver\\OpenControllerVhfGamepad.inf"],
  infPath: "C:\\OpenController\\vhf-kit\\driver\\OpenControllerVhfGamepad.inf",
  driverHeaderPath:
    "C:\\OpenController\\vhf-kit\\driver\\OpenControllerVhfGamepad.h",
  driverSourcePath:
    "C:\\OpenController\\vhf-kit\\driver\\OpenControllerVhfGamepad.c",
  hostBridgeHeaderPath:
    "C:\\OpenController\\vhf-kit\\host-bridge\\OpenControllerVhfHostBridge.h",
  hostBridgeSourcePath:
    "C:\\OpenController\\vhf-kit\\host-bridge\\OpenControllerVhfHostBridge.c",
  readmePath: "C:\\OpenController\\vhf-kit\\README.md",
  installCommand:
    'pnputil /add-driver "C:\\OpenController\\vhf-kit\\driver\\OpenControllerVhfGamepad.inf" /install',
  nativeTestCommand:
    'opencontroller native test --backend windows-vhf --host-bridge-path "C:\\OpenController\\OpenControllerVhfHostBridge.exe"',
} as const;

const fakeMacosSetupPlan = {
  platform: "darwin",
  outputDirectory: "/tmp/opencontroller-macos-driverkit",
  driverDirectory: "/tmp/opencontroller-macos-driverkit/driverkit-extension",
  hostAppDirectory: "/tmp/opencontroller-macos-driverkit/host-app",
  hostBridgePath:
    "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
  appBundleIdentifier: "com.example.opencontroller.host",
  driverBundleIdentifier: "com.example.opencontroller.driver",
  driverClassName: "ExampleOpenControllerDriver",
  files: ["/tmp/opencontroller-macos-driverkit/driverkit-extension/Info.plist"],
  infoPlistPath:
    "/tmp/opencontroller-macos-driverkit/driverkit-extension/Info.plist",
  driverEntitlementsPath:
    "/tmp/opencontroller-macos-driverkit/driverkit-extension/OpenControllerVirtualGamepad.entitlements",
  hostEntitlementsPath:
    "/tmp/opencontroller-macos-driverkit/host-app/OpenControllerHost.entitlements",
  driverHeaderPath:
    "/tmp/opencontroller-macos-driverkit/driverkit-extension/OpenControllerVirtualGamepadDriver.h",
  driverSourcePath:
    "/tmp/opencontroller-macos-driverkit/driverkit-extension/OpenControllerVirtualGamepadDriver.cpp",
  manifestPath: "/tmp/opencontroller-macos-driverkit/manifest.json",
  readmePath: "/tmp/opencontroller-macos-driverkit/README.md",
  doctorCommand: "opencontroller-macos-driverkit-doctor --check",
  codesignReminder:
    "codesign and notarize the host app and embedded dext with approved DriverKit entitlements",
  activationCheckCommand: "systemextensionsctl list",
  nativeTestCommand:
    "opencontroller native test --backend macos-driverkit --host-bridge-path '/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge'",
} as const;
