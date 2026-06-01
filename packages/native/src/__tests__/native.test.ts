import { describe, expect, test } from "bun:test";
import {
  type NativeProcessBridgeSpawner,
  createController,
} from "@opencontroller/core";
import {
  createNativeHostBridgeAdapter,
  defaultNativeHostBridgePath,
  nativeHostBridgeBackends,
  normalizeNativeHostBridgeBackend,
  resolveNativeHostBridgeBackend,
} from "../index";

describe("native host bridge facade", () => {
  test("selects the platform default backend", () => {
    expect(resolveNativeHostBridgeBackend({ platform: "linux" })).toBe(
      "linux-uinput",
    );
    expect(resolveNativeHostBridgeBackend({ platform: "win32" })).toBe(
      "windows-vhf",
    );
    expect(resolveNativeHostBridgeBackend({ platform: "darwin" })).toBe(
      "macos-driverkit",
    );
  });

  test("normalizes common backend aliases", () => {
    expect(normalizeNativeHostBridgeBackend("uinput")).toBe("linux-uinput");
    expect(normalizeNativeHostBridgeBackend("vhf")).toBe("windows-vhf");
    expect(normalizeNativeHostBridgeBackend("driverkit")).toBe(
      "macos-driverkit",
    );
    expect(nativeHostBridgeBackends.map((backend) => backend.id)).toEqual([
      "linux-uinput",
      "windows-vhf",
      "macos-driverkit",
    ]);
  });

  test("reports default helper paths by backend", () => {
    expect(defaultNativeHostBridgePath({ backend: "linux-uinput" })).toContain(
      "opencontroller-uinput-bridge",
    );
    expect(defaultNativeHostBridgePath({ backend: "windows-vhf" })).toContain(
      "OpenControllerVhfHostBridge.exe",
    );
    expect(
      defaultNativeHostBridgePath({ backend: "macos-driverkit" }),
    ).toContain("OpenControllerDriverKitHostBridge");
  });

  test("wraps Linux uinput through the unified adapter factory", async () => {
    const { calls, writes, spawn } = createMockSpawner();
    const adapter = createNativeHostBridgeAdapter({
      platform: "linux",
      waitForExitMs: 50,
      spawn,
      linux: {
        helperPath: "/tmp/opencontroller-uinput-bridge",
        devicePath: "/tmp/uinput",
        deviceName: "OpenController Unified Linux",
        dryRun: true,
      },
    });

    await driveAdapter(adapter);

    expect(calls[0]?.command).toBe("/tmp/opencontroller-uinput-bridge");
    expect(calls[0]?.args).toEqual(["--dry-run"]);
    expect(calls[0]?.env?.OPENCONTROLLER_UINPUT_DEVICE).toBe("/tmp/uinput");
    expect(calls[0]?.env?.OPENCONTROLLER_UINPUT_NAME).toBe(
      "OpenController Unified Linux",
    );
    expect(calls[0]?.env?.OPENCONTROLLER_UINPUT_DRY_RUN).toBe("1");
    expect(writes.some((line) => line.includes('"hidReportBase64"'))).toBe(
      true,
    );
    expect(writes.at(-1)).toContain("opencontroller.bridge.disconnect");
  });

  test("wraps Windows VHF through the unified adapter factory", async () => {
    const { calls, writes, spawn } = createMockSpawner();
    const adapter = createNativeHostBridgeAdapter({
      platform: "win32",
      waitForExitMs: 50,
      spawn,
      windows: {
        hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
        devicePath: "\\\\.\\OpenControllerVhfGamepad",
      },
    });

    await driveAdapter(adapter);

    expect(calls[0]?.command).toBe(
      "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    );
    expect(calls[0]?.args).toEqual([]);
    expect(calls[0]?.env?.OPENCONTROLLER_VHF_DEVICE_PATH).toBe(
      "\\\\.\\OpenControllerVhfGamepad",
    );
    expect(writes.some((line) => line.includes('"hidReportBase64"'))).toBe(
      true,
    );
    expect(writes.at(-1)).toContain("opencontroller.bridge.disconnect");
  });

  test("wraps macOS DriverKit through the unified adapter factory", async () => {
    const { calls, writes, spawn } = createMockSpawner();
    const adapter = createNativeHostBridgeAdapter({
      platform: "darwin",
      waitForExitMs: 50,
      spawn,
      macos: {
        hostBridgePath: "/tmp/OpenControllerDriverKitHostBridge",
        driverBundleIdentifier: "com.example.opencontroller.driver",
        driverClassName: "ExampleOpenControllerDriver",
      },
    });

    await driveAdapter(adapter);

    expect(calls[0]?.command).toBe("/tmp/OpenControllerDriverKitHostBridge");
    expect(calls[0]?.args).toEqual([]);
    expect(calls[0]?.env?.OPENCONTROLLER_DRIVERKIT_DRIVER_BUNDLE_ID).toBe(
      "com.example.opencontroller.driver",
    );
    expect(calls[0]?.env?.OPENCONTROLLER_DRIVERKIT_SERVICE_NAME).toBe(
      "ExampleOpenControllerDriver",
    );
    expect(writes.some((line) => line.includes('"hidReportBase64"'))).toBe(
      true,
    );
    expect(writes.at(-1)).toContain("opencontroller.bridge.disconnect");
  });
});

function createMockSpawner() {
  const writes: string[] = [];
  const calls: Array<{
    command: string;
    args: string[];
    env?: Record<string, string | undefined>;
  }> = [];
  let resolveExit: (exitCode: number) => void = () => {};
  const spawn: NativeProcessBridgeSpawner = (command, args, options) => {
    calls.push({ command, args, env: options.env });
    return {
      stdin: {
        write(chunk) {
          writes.push(chunk);
          return chunk.length;
        },
        flush() {
          return 0;
        },
        end() {
          resolveExit(0);
          return 0;
        },
      },
      stdout: null,
      stderr: null,
      exited: new Promise<number>((resolve) => {
        resolveExit = resolve;
      }),
      kill() {},
    };
  };

  return { calls, writes, spawn };
}

async function driveAdapter(
  adapter: ReturnType<typeof createNativeHostBridgeAdapter>,
): Promise<void> {
  const controller = await createController({
    id: "native-player",
    profile: "xbox",
    adapter,
    replay: false,
  });

  await controller.press("A", 1);
  await controller.disconnect();
}
