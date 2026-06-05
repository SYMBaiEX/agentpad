import type { ControllerState } from "../types";
import {
  createHidGamepadReport,
  hidGamepadRumbleOutputReportDescriptor,
} from "./hid-gamepad";

export const hidSwitchExtendedInputReportId = 4;
export const hidSwitchExtendedReportId = hidSwitchExtendedInputReportId;
export const hidSwitchExtendedInputReportByteLength = 31;
export const hidSwitchExtendedReportByteLength =
  hidSwitchExtendedInputReportByteLength;

export type HidSwitchExtendedReport = {
  reportId: typeof hidSwitchExtendedInputReportId;
  buttons: number;
  leftTrigger: number;
  rightTrigger: number;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  accelerationX: number;
  accelerationY: number;
  accelerationZ: number;
  gyroscopeX: number;
  gyroscopeY: number;
  gyroscopeZ: number;
  orientationX: number;
  orientationY: number;
  orientationZ: number;
};

export const hidSwitchExtendedReportDescriptor = Uint8Array.from([
  0x05,
  0x01, // Usage Page (Generic Desktop)
  0x09,
  0x05, // Usage (Game Pad)
  0xa1,
  0x01, // Collection (Application)
  0x85,
  hidSwitchExtendedReportId, // Report ID
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
  0x06,
  0x00,
  0xff, // Usage Page (Vendor Defined)
  0x09,
  0x04, // Usage (OpenController Switch motion payload)
  0x16,
  0x00,
  0x80, // Logical Minimum (-32768)
  0x26,
  0xff,
  0x7f, // Logical Maximum (32767)
  0x75,
  0x10, // Report Size (16)
  0x95,
  0x09, // Report Count (9)
  0x81,
  0x02, // Input (Data, Variable, Absolute)
  0xc0, // End Collection
]);

export const hidSwitchExtendedReportDescriptorWithRumble = Uint8Array.from([
  ...hidSwitchExtendedReportDescriptor.slice(0, -1),
  ...hidGamepadRumbleOutputReportDescriptor,
  0xc0, // End Collection
]);

export function createHidSwitchExtendedReport(
  state: ControllerState,
): HidSwitchExtendedReport {
  const gamepad = createHidGamepadReport(state);

  return {
    reportId: hidSwitchExtendedReportId,
    buttons: gamepad.buttons,
    leftTrigger: gamepad.leftTrigger,
    rightTrigger: gamepad.rightTrigger,
    leftStickX: gamepad.leftStickX,
    leftStickY: gamepad.leftStickY,
    rightStickX: gamepad.rightStickX,
    rightStickY: gamepad.rightStickY,
    accelerationX: toI16(state.motion.acceleration.x),
    accelerationY: toI16(state.motion.acceleration.y),
    accelerationZ: toI16(state.motion.acceleration.z),
    gyroscopeX: toI16(state.motion.gyroscope.x),
    gyroscopeY: toI16(state.motion.gyroscope.y),
    gyroscopeZ: toI16(state.motion.gyroscope.z),
    orientationX: toI16(state.motion.orientation.x),
    orientationY: toI16(state.motion.orientation.y),
    orientationZ: toI16(state.motion.orientation.z),
  };
}

export function encodeHidSwitchExtendedReport(
  stateOrReport: ControllerState | HidSwitchExtendedReport,
): Uint8Array {
  const report =
    "connected" in stateOrReport
      ? createHidSwitchExtendedReport(stateOrReport)
      : stateOrReport;
  const bytes = new Uint8Array(hidSwitchExtendedReportByteLength);
  const view = new DataView(bytes.buffer);

  view.setUint8(0, report.reportId);
  view.setUint16(1, report.buttons, true);
  view.setInt16(3, report.leftStickX, true);
  view.setInt16(5, report.leftStickY, true);
  view.setInt16(7, report.rightStickX, true);
  view.setInt16(9, report.rightStickY, true);
  view.setUint8(11, report.leftTrigger);
  view.setUint8(12, report.rightTrigger);
  view.setInt16(13, report.accelerationX, true);
  view.setInt16(15, report.accelerationY, true);
  view.setInt16(17, report.accelerationZ, true);
  view.setInt16(19, report.gyroscopeX, true);
  view.setInt16(21, report.gyroscopeY, true);
  view.setInt16(23, report.gyroscopeZ, true);
  view.setInt16(25, report.orientationX, true);
  view.setInt16(27, report.orientationY, true);
  view.setInt16(29, report.orientationZ, true);

  return bytes;
}

export function decodeHidSwitchExtendedReport(
  bytes: Uint8Array,
): HidSwitchExtendedReport {
  if (bytes.byteLength < hidSwitchExtendedReportByteLength) {
    throw new RangeError(
      `Switch extended HID reports must be at least ${hidSwitchExtendedReportByteLength} bytes`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reportId = view.getUint8(0);
  if (reportId !== hidSwitchExtendedReportId) {
    throw new RangeError(
      `Unexpected Switch extended HID report id ${reportId}; expected ${hidSwitchExtendedReportId}`,
    );
  }

  return {
    reportId: hidSwitchExtendedReportId,
    buttons: view.getUint16(1, true),
    leftStickX: view.getInt16(3, true),
    leftStickY: view.getInt16(5, true),
    rightStickX: view.getInt16(7, true),
    rightStickY: view.getInt16(9, true),
    leftTrigger: view.getUint8(11),
    rightTrigger: view.getUint8(12),
    accelerationX: view.getInt16(13, true),
    accelerationY: view.getInt16(15, true),
    accelerationZ: view.getInt16(17, true),
    gyroscopeX: view.getInt16(19, true),
    gyroscopeY: view.getInt16(21, true),
    gyroscopeZ: view.getInt16(23, true),
    orientationX: view.getInt16(25, true),
    orientationY: view.getInt16(27, true),
    orientationZ: view.getInt16(29, true),
  };
}

export function isHidSwitchExtendedReport(
  value: unknown,
): value is HidSwitchExtendedReport {
  return (
    isRecord(value) &&
    value.reportId === hidSwitchExtendedReportId &&
    isU16(value.buttons) &&
    isU8(value.leftTrigger) &&
    isU8(value.rightTrigger) &&
    isI16(value.leftStickX) &&
    isI16(value.leftStickY) &&
    isI16(value.rightStickX) &&
    isI16(value.rightStickY) &&
    isI16(value.accelerationX) &&
    isI16(value.accelerationY) &&
    isI16(value.accelerationZ) &&
    isI16(value.gyroscopeX) &&
    isI16(value.gyroscopeY) &&
    isI16(value.gyroscopeZ) &&
    isI16(value.orientationX) &&
    isI16(value.orientationY) &&
    isI16(value.orientationZ)
  );
}

export function hidSwitchExtendedReportsEqual(
  a: HidSwitchExtendedReport,
  b: HidSwitchExtendedReport,
): boolean {
  return (
    a.reportId === b.reportId &&
    a.buttons === b.buttons &&
    a.leftTrigger === b.leftTrigger &&
    a.rightTrigger === b.rightTrigger &&
    a.leftStickX === b.leftStickX &&
    a.leftStickY === b.leftStickY &&
    a.rightStickX === b.rightStickX &&
    a.rightStickY === b.rightStickY &&
    a.accelerationX === b.accelerationX &&
    a.accelerationY === b.accelerationY &&
    a.accelerationZ === b.accelerationZ &&
    a.gyroscopeX === b.gyroscopeX &&
    a.gyroscopeY === b.gyroscopeY &&
    a.gyroscopeZ === b.gyroscopeZ &&
    a.orientationX === b.orientationX &&
    a.orientationY === b.orientationY &&
    a.orientationZ === b.orientationZ
  );
}

function toI16(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(-1, value));
  return clamped < 0
    ? Math.round(clamped * 32768)
    : Math.round(clamped * 32767);
}

function isU8(value: unknown): value is number {
  return isIntegerInRange(value, 0, 255);
}

function isU16(value: unknown): value is number {
  return isIntegerInRange(value, 0, 65535);
}

function isI16(value: unknown): value is number {
  return isIntegerInRange(value, -32768, 32767);
}

function isIntegerInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
