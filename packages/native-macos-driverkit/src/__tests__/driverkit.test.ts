import { describe, expect, test } from "bun:test";
import type { ControllerState } from "@opencontroller/core";
import { createNativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  hidGamepadReportDescriptor,
  hidGamepadReportId,
  xInputButtonBits,
} from "@opencontroller/core/hid";
import {
  createMacosDriverKitAssetManifest,
  createMacosDriverKitEntitlements,
  createMacosDriverKitInfoPlist,
  createMacosHostAppEntitlements,
  decodeMacosDriverKitInputReport,
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
});
