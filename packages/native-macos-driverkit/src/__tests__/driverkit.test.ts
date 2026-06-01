import { describe, expect, test } from "bun:test";
import {
  type ControllerState,
  type NativeProcessBridgeSpawner,
  createController,
} from "@opencontroller/core";
import { createNativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  hidGamepadReportDescriptor,
  hidGamepadReportId,
  xInputButtonBits,
} from "@opencontroller/core/hid";
import {
  createMacosDriverKitAssetManifest,
  createMacosDriverKitDriverHeader,
  createMacosDriverKitDriverSource,
  createMacosDriverKitDriverSourceFiles,
  createMacosDriverKitEntitlements,
  createMacosDriverKitHostBridgeAdapter,
  createMacosDriverKitInfoPlist,
  createMacosHostAppEntitlements,
  decodeMacosDriverKitInputReport,
  defaultMacosDriverKitHostBridgePath,
  encodeMacosDriverKitInputReport,
  formatMacosDriverKitHidDescriptorForCpp,
  formatMacosDriverKitInputReportForCpp,
  macosDriverKitHidReportDescriptor,
  macosDriverKitInputReportBytesFromNativeBridgeMessage,
  macosDriverKitInputReportFromNativeBridgeMessage,
} from "../driverkit";

describe("macOS DriverKit helpers", () => {
  test("reuses the canonical HID gamepad descriptor", () => {
    expect(Array.from(macosDriverKitHidReportDescriptor)).toEqual(
      Array.from(hidGamepadReportDescriptor),
    );
  });

  test("creates DriverKit input report bytes from native bridge messages", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "xbox",
      connected: true,
      buttons: {
        A: true,
      },
      analogButtons: {
        LT: 0.25,
        RT: 0.5,
      },
      sticks: {
        left: { x: 1, y: -1 },
        right: { x: -1, y: 1 },
      },
      dpad: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      updatedAt: 1,
    };

    const message = createNativeBridgeStateMessage(state, {
      includeState: false,
    });
    const report = macosDriverKitInputReportFromNativeBridgeMessage(message);
    const bytes =
      macosDriverKitInputReportBytesFromNativeBridgeMessage(message);
    const decoded = decodeMacosDriverKitInputReport(bytes);

    expect(report.reportId).toBe(hidGamepadReportId);
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.leftTrigger).toBe(64);
    expect(report.rightTrigger).toBe(128);
    expect(decoded).toEqual(report);
  });

  test("formats descriptor and report arrays for DriverKit source", () => {
    const report = {
      reportId: hidGamepadReportId,
      buttons: xInputButtonBits.A,
      leftTrigger: 0,
      rightTrigger: 128,
      leftStickX: 32767,
      leftStickY: 32767,
      rightStickX: 0,
      rightStickY: 0,
    };

    const descriptor = formatMacosDriverKitHidDescriptorForCpp();
    const inputReport = formatMacosDriverKitInputReportForCpp(report);

    expect(descriptor).toContain(
      "static const uint8_t openControllerHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x05, 0x01");
    expect(inputReport).toContain(
      "static const uint8_t openControllerSampleInputReport[]",
    );
    expect(
      decodeMacosDriverKitInputReport(encodeMacosDriverKitInputReport(report)),
    ).toEqual(report);
  });

  test("creates DriverKit plist and entitlement templates", () => {
    const infoPlist = createMacosDriverKitInfoPlist();
    const dextEntitlements = createMacosDriverKitEntitlements();
    const hostEntitlements = createMacosHostAppEntitlements();

    expect(infoPlist).toContain("<string>DEXT</string>");
    expect(infoPlist).toContain("<string>AppleUserHIDDevice</string>");
    expect(infoPlist).toContain("<string>IOResources</string>");
    expect(dextEntitlements).toContain(
      "com.apple.developer.driverkit.family.hid.virtual.device",
    );
    expect(hostEntitlements).toContain(
      "com.apple.developer.system-extension.install",
    );
  });

  test("creates an asset manifest for host app packaging", () => {
    const manifest = createMacosDriverKitAssetManifest();

    expect(manifest.systemExtensionPath).toContain(
      "Contents/Library/SystemExtensions",
    );
    expect(manifest.inputReportByteLength).toBe(13);
    expect(manifest.requiredEntitlements).toContain(
      "com.apple.developer.driverkit.userclient-access",
    );
  });

  test("creates DriverKit C++ source templates", () => {
    const header = createMacosDriverKitDriverHeader();
    const source = createMacosDriverKitDriverSource();
    const files = createMacosDriverKitDriverSourceFiles();

    expect(header).toContain("class OpenControllerVirtualGamepadDriver");
    expect(header).toContain("newReportDescriptor() override");
    expect(header).toContain("updateInputReport");
    expect(source).toContain(
      "OSDefineMetaClassAndStructors(OpenControllerVirtualGamepadDriver",
    );
    expect(source).toContain("OSData::withBytes");
    expect(source).toContain("kIOHIDVendorIDKey");
    expect(source).toContain("openControllerNeutralInputReport[13]");
    expect(Object.keys(files)).toEqual([
      "OpenControllerVirtualGamepadDriver.h",
      "OpenControllerVirtualGamepadDriver.cpp",
    ]);
  });

  test("wraps a DriverKit host bridge as a native process adapter", async () => {
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
    const adapter = createMacosDriverKitHostBridgeAdapter({
      hostBridgePath:
        "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
      appBundleIdentifier: "com.example.opencontroller.host",
      driverBundleIdentifier: "com.example.opencontroller.driver",
      driverClassName: "ExampleOpenControllerDriver",
      waitForExitMs: 50,
      spawn,
    });
    const controller = await createController({
      id: "macos-player",
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 1);
    await controller.disconnect();

    expect(
      defaultMacosDriverKitHostBridgePath(
        "/Users/agent/Library/Application Support",
      ),
    ).toBe(
      "/Users/agent/Library/Application Support/OpenController/bin/OpenControllerDriverKitHostBridge",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe(
      "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
    );
    expect(calls[0]?.args).toEqual([]);
    expect(calls[0]?.env?.OPENCONTROLLER_DRIVERKIT_HOST_APP_BUNDLE_ID).toBe(
      "com.example.opencontroller.host",
    );
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
