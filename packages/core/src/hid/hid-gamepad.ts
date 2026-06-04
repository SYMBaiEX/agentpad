import type { NativeBridgeStateMessage } from "../bridge/native";
import type { ControllerState } from "../types";
import { createHidGamepadButtonMask } from "./hid-buttons";
import { type XInputGamepadReport, createXInputReport } from "./xinput";

export const hidGamepadInputReportId = 1;
export const hidGamepadReportId = hidGamepadInputReportId;
export const hidGamepadInputReportByteLength = 13;
export const hidGamepadReportByteLength = hidGamepadInputReportByteLength;
export const hidGamepadRumbleReportId = 2;
export const hidGamepadRumbleReportByteLength = 5;

export type HidGamepadReport = {
  reportId: typeof hidGamepadInputReportId;
  buttons: number;
  leftTrigger: number;
  rightTrigger: number;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
};

export type HidGamepadRumbleReport = {
  reportId: typeof hidGamepadRumbleReportId;
  weakMotor: number;
  strongMotor: number;
  leftTriggerMotor: number;
  rightTriggerMotor: number;
};

export type HidGamepadRumbleEffect = {
  weakMotor?: number;
  strongMotor?: number;
  leftTriggerMotor?: number;
  rightTriggerMotor?: number;
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

export const hidGamepadRumbleOutputReportDescriptor = Uint8Array.from([
  0x85,
  hidGamepadRumbleReportId, // Report ID
  0x06,
  0x00,
  0xff, // Usage Page (Vendor Defined)
  0x19,
  0x01, // Usage Minimum (Rumble channel 1)
  0x29,
  0x04, // Usage Maximum (Rumble channel 4)
  0x15,
  0x00, // Logical Minimum (0)
  0x26,
  0xff,
  0x00, // Logical Maximum (255)
  0x75,
  0x08, // Report Size (8)
  0x95,
  0x04, // Report Count (4)
  0x91,
  0x02, // Output (Data, Variable, Absolute)
]);

export const hidGamepadReportDescriptorWithRumble = Uint8Array.from([
  ...hidGamepadReportDescriptor.slice(0, -1),
  ...hidGamepadRumbleOutputReportDescriptor,
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
    buttons:
      "connected" in stateOrReport
        ? createHidGamepadButtonMask(stateOrReport)
        : report.buttons,
    leftTrigger: report.leftTrigger,
    rightTrigger: report.rightTrigger,
    leftStickX: report.leftStickX,
    leftStickY: report.leftStickY,
    rightStickX: report.rightStickX,
    rightStickY: report.rightStickY,
  };
}

export function createHidGamepadRumbleReport(
  effect: HidGamepadRumbleEffect = {},
): HidGamepadRumbleReport {
  return {
    reportId: hidGamepadRumbleReportId,
    weakMotor: toU8(effect.weakMotor ?? 0),
    strongMotor: toU8(effect.strongMotor ?? 0),
    leftTriggerMotor: toU8(effect.leftTriggerMotor ?? 0),
    rightTriggerMotor: toU8(effect.rightTriggerMotor ?? 0),
  };
}

export function hidGamepadReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): HidGamepadReport {
  if (message.hidReportFormat === "hid-gamepad" && message.hidReportBase64) {
    return decodeHidGamepadReport(base64ToBytes(message.hidReportBase64));
  }
  if (message.hidReportFormat === "hid-gamepad" && message.hidReport) {
    return createHidGamepadReport(message.hidReport);
  }
  return createHidGamepadReport(message.report);
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

export function encodeHidGamepadRumbleReport(
  effectOrReport: HidGamepadRumbleEffect | HidGamepadRumbleReport,
): Uint8Array {
  const report =
    "reportId" in effectOrReport
      ? effectOrReport
      : createHidGamepadRumbleReport(effectOrReport);
  const bytes = new Uint8Array(hidGamepadRumbleReportByteLength);
  const view = new DataView(bytes.buffer);

  view.setUint8(0, report.reportId);
  view.setUint8(1, clampByte(report.weakMotor));
  view.setUint8(2, clampByte(report.strongMotor));
  view.setUint8(3, clampByte(report.leftTriggerMotor));
  view.setUint8(4, clampByte(report.rightTriggerMotor));

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

export function decodeHidGamepadRumbleReport(
  bytes: Uint8Array,
): HidGamepadRumbleReport {
  if (bytes.byteLength < hidGamepadRumbleReportByteLength) {
    throw new RangeError(
      `HID gamepad rumble reports must be at least ${hidGamepadRumbleReportByteLength} bytes`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reportId = view.getUint8(0);
  if (reportId !== hidGamepadRumbleReportId) {
    throw new RangeError(
      `Unexpected HID gamepad rumble report id ${reportId}; expected ${hidGamepadRumbleReportId}`,
    );
  }

  return {
    reportId: hidGamepadRumbleReportId,
    weakMotor: view.getUint8(1),
    strongMotor: view.getUint8(2),
    leftTriggerMotor: view.getUint8(3),
    rightTriggerMotor: view.getUint8(4),
  };
}

function toU8(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(255, Math.max(0, value)));
}
