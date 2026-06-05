import type { ControllerState, ControllerTouchpadContact } from "../types";
import {
  createHidGamepadReport,
  hidGamepadLightOutputReportDescriptor,
  hidGamepadRumbleOutputReportDescriptor,
} from "./hid-gamepad";

export const hidPlayStationExtendedInputReportId = 3;
export const hidPlayStationExtendedReportId =
  hidPlayStationExtendedInputReportId;
export const hidPlayStationExtendedInputReportByteLength = 47;
export const hidPlayStationExtendedReportByteLength =
  hidPlayStationExtendedInputReportByteLength;

export type HidPlayStationExtendedContactReport = {
  id: number;
  active: boolean;
  x: number;
  y: number;
  pressure: number;
};

export type HidPlayStationExtendedReport = {
  reportId: typeof hidPlayStationExtendedInputReportId;
  buttons: number;
  leftTrigger: number;
  rightTrigger: number;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  touchpadPressed: boolean;
  touchpadContacts: [
    HidPlayStationExtendedContactReport,
    HidPlayStationExtendedContactReport,
  ];
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

export const hidPlayStationExtendedReportDescriptor = Uint8Array.from([
  0x05,
  0x01, // Usage Page (Generic Desktop)
  0x09,
  0x05, // Usage (Game Pad)
  0xa1,
  0x01, // Collection (Application)
  0x85,
  hidPlayStationExtendedReportId, // Report ID
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
  0x03, // Usage (OpenController PlayStation touchpad and motion payload)
  0x15,
  0x00, // Logical Minimum (0)
  0x26,
  0xff,
  0x00, // Logical Maximum (255)
  0x75,
  0x08, // Report Size (8)
  0x95,
  0x22, // Report Count (34)
  0x81,
  0x02, // Input (Data, Variable, Absolute)
  0xc0, // End Collection
]);

export const hidPlayStationExtendedReportDescriptorWithRumble = Uint8Array.from(
  [
    ...hidPlayStationExtendedReportDescriptor.slice(0, -1),
    ...hidGamepadRumbleOutputReportDescriptor,
    0xc0, // End Collection
  ],
);

export const hidPlayStationExtendedReportDescriptorWithFeedback =
  Uint8Array.from([
    ...hidPlayStationExtendedReportDescriptor.slice(0, -1),
    ...hidGamepadRumbleOutputReportDescriptor,
    ...hidGamepadLightOutputReportDescriptor,
    0xc0, // End Collection
  ]);

export function createHidPlayStationExtendedReport(
  state: ControllerState,
): HidPlayStationExtendedReport {
  const gamepad = createHidGamepadReport(state);
  const contacts = state.touchpad.contacts
    .filter((contact) => contact.active)
    .slice(0, 2);

  return {
    reportId: hidPlayStationExtendedReportId,
    buttons: gamepad.buttons,
    leftTrigger: gamepad.leftTrigger,
    rightTrigger: gamepad.rightTrigger,
    leftStickX: gamepad.leftStickX,
    leftStickY: gamepad.leftStickY,
    rightStickX: gamepad.rightStickX,
    rightStickY: gamepad.rightStickY,
    touchpadPressed: state.touchpad.pressed,
    touchpadContacts: [
      createContactReport(contacts[0]),
      createContactReport(contacts[1]),
    ],
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

export function encodeHidPlayStationExtendedReport(
  stateOrReport: ControllerState | HidPlayStationExtendedReport,
): Uint8Array {
  const report =
    "connected" in stateOrReport
      ? createHidPlayStationExtendedReport(stateOrReport)
      : stateOrReport;
  const bytes = new Uint8Array(hidPlayStationExtendedReportByteLength);
  const view = new DataView(bytes.buffer);

  view.setUint8(0, report.reportId);
  view.setUint16(1, report.buttons, true);
  view.setInt16(3, report.leftStickX, true);
  view.setInt16(5, report.leftStickY, true);
  view.setInt16(7, report.rightStickX, true);
  view.setInt16(9, report.rightStickY, true);
  view.setUint8(11, report.leftTrigger);
  view.setUint8(12, report.rightTrigger);
  view.setUint8(13, report.touchpadPressed ? 1 : 0);
  view.setUint8(
    14,
    report.touchpadContacts.filter((contact) => contact.active).length,
  );
  writeContact(view, 15, report.touchpadContacts[0]);
  writeContact(view, 22, report.touchpadContacts[1]);
  view.setInt16(29, report.accelerationX, true);
  view.setInt16(31, report.accelerationY, true);
  view.setInt16(33, report.accelerationZ, true);
  view.setInt16(35, report.gyroscopeX, true);
  view.setInt16(37, report.gyroscopeY, true);
  view.setInt16(39, report.gyroscopeZ, true);
  view.setInt16(41, report.orientationX, true);
  view.setInt16(43, report.orientationY, true);
  view.setInt16(45, report.orientationZ, true);

  return bytes;
}

export function decodeHidPlayStationExtendedReport(
  bytes: Uint8Array,
): HidPlayStationExtendedReport {
  if (bytes.byteLength < hidPlayStationExtendedReportByteLength) {
    throw new RangeError(
      `PlayStation extended HID reports must be at least ${hidPlayStationExtendedReportByteLength} bytes`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reportId = view.getUint8(0);
  if (reportId !== hidPlayStationExtendedReportId) {
    throw new RangeError(
      `Unexpected PlayStation extended HID report id ${reportId}; expected ${hidPlayStationExtendedReportId}`,
    );
  }

  return {
    reportId: hidPlayStationExtendedReportId,
    buttons: view.getUint16(1, true),
    leftStickX: view.getInt16(3, true),
    leftStickY: view.getInt16(5, true),
    rightStickX: view.getInt16(7, true),
    rightStickY: view.getInt16(9, true),
    leftTrigger: view.getUint8(11),
    rightTrigger: view.getUint8(12),
    touchpadPressed: view.getUint8(13) !== 0,
    touchpadContacts: [readContact(view, 15), readContact(view, 22)],
    accelerationX: view.getInt16(29, true),
    accelerationY: view.getInt16(31, true),
    accelerationZ: view.getInt16(33, true),
    gyroscopeX: view.getInt16(35, true),
    gyroscopeY: view.getInt16(37, true),
    gyroscopeZ: view.getInt16(39, true),
    orientationX: view.getInt16(41, true),
    orientationY: view.getInt16(43, true),
    orientationZ: view.getInt16(45, true),
  };
}

export function isHidPlayStationExtendedReport(
  value: unknown,
): value is HidPlayStationExtendedReport {
  return (
    isRecord(value) &&
    value.reportId === hidPlayStationExtendedReportId &&
    isU16(value.buttons) &&
    isU8(value.leftTrigger) &&
    isU8(value.rightTrigger) &&
    isI16(value.leftStickX) &&
    isI16(value.leftStickY) &&
    isI16(value.rightStickX) &&
    isI16(value.rightStickY) &&
    typeof value.touchpadPressed === "boolean" &&
    Array.isArray(value.touchpadContacts) &&
    value.touchpadContacts.length === 2 &&
    value.touchpadContacts.every(isContactReport) &&
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

export function hidPlayStationExtendedReportsEqual(
  a: HidPlayStationExtendedReport,
  b: HidPlayStationExtendedReport,
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
    a.touchpadPressed === b.touchpadPressed &&
    contactsEqual(a.touchpadContacts[0], b.touchpadContacts[0]) &&
    contactsEqual(a.touchpadContacts[1], b.touchpadContacts[1]) &&
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

function createContactReport(
  contact: ControllerTouchpadContact | undefined,
): HidPlayStationExtendedContactReport {
  if (!contact) {
    return {
      id: 0,
      active: false,
      x: 0,
      y: 0,
      pressure: 0,
    };
  }

  return {
    id: toU8(contact.id),
    active: contact.active,
    x: toU16(contact.x),
    y: toU16(contact.y),
    pressure: normalizedToU8(contact.pressure),
  };
}

function writeContact(
  view: DataView,
  offset: number,
  contact: HidPlayStationExtendedContactReport,
): void {
  view.setUint8(offset, contact.id);
  view.setUint8(offset + 1, contact.active ? 1 : 0);
  view.setUint16(offset + 2, contact.x, true);
  view.setUint16(offset + 4, contact.y, true);
  view.setUint8(offset + 6, contact.pressure);
}

function readContact(
  view: DataView,
  offset: number,
): HidPlayStationExtendedContactReport {
  return {
    id: view.getUint8(offset),
    active: view.getUint8(offset + 1) !== 0,
    x: view.getUint16(offset + 2, true),
    y: view.getUint16(offset + 4, true),
    pressure: view.getUint8(offset + 6),
  };
}

function contactsEqual(
  a: HidPlayStationExtendedContactReport,
  b: HidPlayStationExtendedContactReport,
): boolean {
  return (
    a.id === b.id &&
    a.active === b.active &&
    a.x === b.x &&
    a.y === b.y &&
    a.pressure === b.pressure
  );
}

function isContactReport(
  value: unknown,
): value is HidPlayStationExtendedContactReport {
  return (
    isRecord(value) &&
    isU8(value.id) &&
    typeof value.active === "boolean" &&
    isU16(value.x) &&
    isU16(value.y) &&
    isU8(value.pressure)
  );
}

function toU8(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(255, Math.max(0, value)));
}

function toU16(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 65535);
}

function normalizedToU8(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
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
