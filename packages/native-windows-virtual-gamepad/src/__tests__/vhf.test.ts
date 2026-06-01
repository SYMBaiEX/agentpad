import { describe, expect, test } from "bun:test";
import type { ControllerState } from "@opencontroller/core";
import { createNativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  hidGamepadReportDescriptor,
  hidGamepadReportId,
  xInputButtonBits,
} from "@opencontroller/core/hid";
import {
  createWindowsVhfDriverHeader,
  createWindowsVhfDriverSource,
  createWindowsVhfDriverSourceFiles,
  createWindowsVhfHostBridgeHeader,
  createWindowsVhfHostBridgeSource,
  createWindowsVhfHostBridgeSourceFiles,
  createWindowsVhfInf,
  decodeWindowsVhfInputReport,
  encodeWindowsVhfInputReport,
  formatWindowsVhfHidDescriptorForC,
  formatWindowsVhfInputReportForC,
  windowsVhfHidReportDescriptor,
  windowsVhfInputReportBytesFromNativeBridgeMessage,
  windowsVhfInputReportFromNativeBridgeMessage,
} from "../vhf";

describe("windows VHF helpers", () => {
  test("reuses the canonical HID gamepad descriptor", () => {
    expect(Array.from(windowsVhfHidReportDescriptor)).toEqual(
      Array.from(hidGamepadReportDescriptor),
    );
  });

  test("creates VHF input report bytes from native bridge messages", () => {
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
    const report = windowsVhfInputReportFromNativeBridgeMessage(message);
    const bytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
    const decoded = decodeWindowsVhfInputReport(bytes);

    expect(report.reportId).toBe(hidGamepadReportId);
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.leftTrigger).toBe(64);
    expect(report.rightTrigger).toBe(128);
    expect(decoded).toEqual(report);
  });

  test("formats descriptor and report arrays for WDK driver source", () => {
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

    const descriptor = formatWindowsVhfHidDescriptorForC();
    const inputReport = formatWindowsVhfInputReportForC(report);

    expect(descriptor).toContain(
      "static const UCHAR OpenControllerHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x05, 0x01");
    expect(inputReport).toContain(
      "static const UCHAR OpenControllerSampleInputReport[]",
    );
    expect(
      decodeWindowsVhfInputReport(encodeWindowsVhfInputReport(report)),
    ).toEqual(report);
  });

  test("creates an INF template that loads VHF as a lower filter", () => {
    const inf = createWindowsVhfInf();

    expect(inf).toContain("Class=HIDClass");
    expect(inf).toContain("[Standard.NTamd64]");
    expect(inf).toContain("Root\\OpenControllerVhfGamepad");
    expect(inf).toContain('HKR,,"LowerFilters",0x00010000,"vhf"');
    expect(inf).toContain("OpenControllerVhfGamepad.sys");
  });

  test("creates WDK VHF driver source templates", () => {
    const header = createWindowsVhfDriverHeader();
    const source = createWindowsVhfDriverSource();
    const files = createWindowsVhfDriverSourceFiles();

    expect(header).toContain("#include <vhf.h>");
    expect(header).toContain("IOCTL_OPENCONTROLLERVHFGAMEPAD_SUBMIT_REPORT");
    expect(header).toContain("VHFHANDLE VhfHandle");
    expect(source).toContain("VHF_CONFIG_INIT");
    expect(source).toContain("VhfCreate(&vhfConfig");
    expect(source).toContain("VhfStart(context->VhfHandle)");
    expect(source).toContain("WdfDeviceInitSetIoType");
    expect(source).toContain("WdfDeviceCreateSymbolicLink");
    expect(source).toContain("DECLARE_CONST_UNICODE_STRING(symbolicLinkName");
    expect(source).toContain("OpenControllerVhfGamepad");
    expect(source).toContain("VhfReadReportSubmit(context->VhfHandle");
    expect(source).toContain("OpenControllerInputReportLength = 13");
    expect(Object.keys(files)).toEqual([
      "OpenControllerVhfGamepad.h",
      "OpenControllerVhfGamepad.c",
    ]);
  });

  test("creates Windows host bridge source templates for VHF IOCTL writes", () => {
    const header = createWindowsVhfHostBridgeHeader();
    const source = createWindowsVhfHostBridgeSource();
    const files = createWindowsVhfHostBridgeSourceFiles();

    expect(header).toContain("#include <windows.h>");
    expect(header).toContain("OPENCONTROLLER_HID_REPORT_BYTES 13");
    expect(header).toContain("IOCTL_OPENCONTROLLERVHFHOSTBRIDGE_SUBMIT_REPORT");
    expect(header).toContain("OPENCONTROLLERVHFHOSTBRIDGE_DEFAULT_DEVICE_PATH");
    expect(header).toContain("OpenControllerVhfGamepad");
    expect(source).toContain("CreateFileA");
    expect(source).toContain("DeviceIoControl");
    expect(source).toContain('const char *key = "\\"reportBase64\\":\\""');
    expect(source).toContain("opencontroller_decode_xinput_report");
    expect(source).toContain("opencontroller_encode_hid_report");
    expect(source).toContain("OPENCONTROLLER_VHF_DEVICE_PATH");
    expect(Object.keys(files)).toEqual([
      "OpenControllerVhfHostBridge.h",
      "OpenControllerVhfHostBridge.c",
    ]);
  });
});
