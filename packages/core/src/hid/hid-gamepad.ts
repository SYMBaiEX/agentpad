import type { NativeBridgeStateMessage } from "../bridge/native";
import { nativeBridgeMessageToHidGamepadReportBytes } from "../bridge/native";
import type { ControllerState } from "../types";
import { type XInputGamepadReport, createXInputReport } from "./xinput";

export const hidGamepadReportId = 1;
export const hidGamepadReportByteLength = 13;

export type HidGamepadReport = {
  reportId: typeof hidGamepadReportId;
  buttons: number;
  leftTrigger: number;
  rightTrigger: number;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
};

export const hidGamepadReportDescriptor = Uint8Array.from([
  0x05,
  0x01, // Usage Page (Generic Desktop)
  0x09,
  0x05, // Usage (Game Pad)
  0xa1,
  0x01, // Collection (Application)
  0x85,
  hidGamepadReportId, // Report ID
  0x05,
  0x09, // Usage Page (Button)
  0x19,
  0x01, // Usage Minimum (Button 1)
  0x29,
  0x10, // Usage Maximum (Button 16)
  0x15,
  0x00, // Logical Minimum (0)
  0x25,
  0x01, // Logical Maximum (1)
  0x75,
  0x01, // Report Size (1)
  0x95,
  0x10, // Report Count (16)
  0x81,
  0x02, // Input (Data, Variable, Absolute)
  0x05,
  0x01, // Usage Page (Generic Desktop)
  0x09,
  0x30, // Usage (X)
  0x09,
  0x31, // Usage (Y)
  0x09,
  0x33, // Usage (Rx)
  0x09,
  0x34, // Usage (Ry)
  0x16,
  0x00,
  0x80, // Logical Minimum (-32768)
  0x26,
  0xff,
  0x7f, // Logical Maximum (32767)
  0x75,
  0x10, // Report Size (16)
  0x95,
  0x04, // Report Count (4)
  0x81,
  0x02, // Input (Data, Variable, Absolute)
  0x09,
  0x32, // Usage (Z)
  0x09,
  0x35, // Usage (Rz)
  0x15,
  0x00, // Logical Minimum (0)
  0x26,
  0xff,
  0x00, // Logical Maximum (255)
  0x75,
  0x08, // Report Size (8)
  0x95,
  0x02, // Report Count (2)
  0x81,
  0x02, // Input (Data, Variable, Absolute)
  0xc0, // End Collection
]);

export function createHidGamepadReport(
  stateOrReport: ControllerState | XInputGamepadReport,
): HidGamepadReport {
  const report =
    "connected" in stateOrReport
      ? createXInputReport(stateOrReport)
      : stateOrReport;

  return {
    reportId: hidGamepadReportId,
    buttons: report.buttons,
    leftTrigger: report.leftTrigger,
    rightTrigger: report.rightTrigger,
    leftStickX: report.leftStickX,
    leftStickY: report.leftStickY,
    rightStickX: report.rightStickX,
    rightStickY: report.rightStickY,
  };
}

export function hidGamepadReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): HidGamepadReport {
  return decodeHidGamepadReport(
    nativeBridgeMessageToHidGamepadReportBytes(message),
  );
}

export function encodeHidGamepadReport(
  stateOrReport: ControllerState | XInputGamepadReport | HidGamepadReport,
): Uint8Array {
  const report =
    "reportId" in stateOrReport
      ? stateOrReport
      : createHidGamepadReport(stateOrReport);
  const bytes = new Uint8Array(hidGamepadReportByteLength);
  const view = new DataView(bytes.buffer);

  view.setUint8(0, report.reportId);
  view.setUint16(1, report.buttons, true);
  view.setInt16(3, report.leftStickX, true);
  view.setInt16(5, report.leftStickY, true);
  view.setInt16(7, report.rightStickX, true);
  view.setInt16(9, report.rightStickY, true);
  view.setUint8(11, report.leftTrigger);
  view.setUint8(12, report.rightTrigger);

  return bytes;
}

export function decodeHidGamepadReport(bytes: Uint8Array): HidGamepadReport {
  if (bytes.byteLength < hidGamepadReportByteLength) {
    throw new RangeError(
      `HID gamepad reports must be at least ${hidGamepadReportByteLength} bytes`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reportId = view.getUint8(0);
  if (reportId !== hidGamepadReportId) {
    throw new RangeError(
      `Unexpected HID gamepad report id ${reportId}; expected ${hidGamepadReportId}`,
    );
  }

  return {
    reportId: hidGamepadReportId,
    buttons: view.getUint16(1, true),
    leftStickX: view.getInt16(3, true),
    leftStickY: view.getInt16(5, true),
    rightStickX: view.getInt16(7, true),
    rightStickY: view.getInt16(9, true),
    leftTrigger: view.getUint8(11),
    rightTrigger: view.getUint8(12),
  };
}
