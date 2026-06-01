import {
  type XInputGamepadReport,
  createXInputReport,
  decodeXInputReport,
  encodeXInputReport,
} from "../hid/xinput";
import type { ControllerProfileName, ControllerState } from "../types";

export const nativeBridgeProtocolVersion = 1;

export type NativeBridgeReportFormat = "xinput";
export type NativeBridgeHidReportFormat = "hid-gamepad";

export type NativeBridgeHidGamepadReport = {
  reportId: 1;
  buttons: number;
  leftTrigger: number;
  rightTrigger: number;
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
};

export type NativeBridgeStateMessage = {
  type: "opencontroller.bridge.state";
  version: typeof nativeBridgeProtocolVersion;
  controllerId: string;
  profile: ControllerProfileName;
  timestamp: number;
  reportFormat: NativeBridgeReportFormat;
  report: XInputGamepadReport;
  reportBase64: string;
  hidReportFormat?: NativeBridgeHidReportFormat;
  hidReport?: NativeBridgeHidGamepadReport;
  hidReportBase64?: string;
  state?: ControllerState;
};

export type NativeBridgeDisconnectMessage = {
  type: "opencontroller.bridge.disconnect";
  version: typeof nativeBridgeProtocolVersion;
  controllerId: string;
  timestamp: number;
};

export type NativeBridgeMessage =
  | NativeBridgeStateMessage
  | NativeBridgeDisconnectMessage;

export type CreateNativeBridgeStateMessageOptions = {
  includeState?: boolean;
  timestamp?: number;
};

export function createNativeBridgeStateMessage(
  state: ControllerState,
  options: CreateNativeBridgeStateMessageOptions = {},
): NativeBridgeStateMessage {
  const includeState = options.includeState ?? true;
  const report = createXInputReport(state);
  const bytes = encodeXInputReport(report);
  const hidReport = xInputReportToHidGamepadReport(report);
  const hidBytes = encodeNativeBridgeHidGamepadReport(hidReport);

  return {
    type: "opencontroller.bridge.state",
    version: nativeBridgeProtocolVersion,
    controllerId: state.id,
    profile: state.profile,
    timestamp: options.timestamp ?? Date.now(),
    reportFormat: "xinput",
    report,
    reportBase64: bytesToBase64(bytes),
    hidReportFormat: "hid-gamepad",
    hidReport,
    hidReportBase64: bytesToBase64(hidBytes),
    ...(includeState ? { state } : {}),
  };
}

export function createNativeBridgeDisconnectMessage(
  controllerId: string,
  timestamp = Date.now(),
): NativeBridgeDisconnectMessage {
  return {
    type: "opencontroller.bridge.disconnect",
    version: nativeBridgeProtocolVersion,
    controllerId,
    timestamp,
  };
}

export function serializeNativeBridgeMessage(
  message: NativeBridgeMessage,
): string {
  return `${JSON.stringify(message)}\n`;
}

export function parseNativeBridgeMessage(line: string): NativeBridgeMessage {
  const parsed = JSON.parse(line.trim());
  if (!isNativeBridgeMessage(parsed)) {
    throw new TypeError("Invalid OpenController native bridge message");
  }
  return parsed;
}

export function nativeBridgeMessageToReportBytes(
  message: NativeBridgeStateMessage,
): Uint8Array {
  const bytes = base64ToBytes(message.reportBase64);
  const decoded = decodeXInputReport(bytes);

  if (
    decoded.buttons !== message.report.buttons ||
    decoded.leftTrigger !== message.report.leftTrigger ||
    decoded.rightTrigger !== message.report.rightTrigger ||
    decoded.leftStickX !== message.report.leftStickX ||
    decoded.leftStickY !== message.report.leftStickY ||
    decoded.rightStickX !== message.report.rightStickX ||
    decoded.rightStickY !== message.report.rightStickY
  ) {
    throw new TypeError("Native bridge report bytes do not match report JSON");
  }

  return bytes;
}

export function nativeBridgeMessageToHidGamepadReportBytes(
  message: NativeBridgeStateMessage,
): Uint8Array {
  if (message.hidReportBase64 && message.hidReport) {
    const bytes = base64ToBytes(message.hidReportBase64);
    const decoded = decodeNativeBridgeHidGamepadReport(bytes);

    if (!hidReportsEqual(decoded, message.hidReport)) {
      throw new TypeError(
        "Native bridge HID report bytes do not match HID report JSON",
      );
    }

    return bytes;
  }

  return encodeNativeBridgeHidGamepadReport(
    xInputReportToHidGamepadReport(message.report),
  );
}

export function isNativeBridgeMessage(
  value: unknown,
): value is NativeBridgeMessage {
  if (!isRecord(value)) {
    return false;
  }
  if (value.version !== nativeBridgeProtocolVersion) {
    return false;
  }
  if (typeof value.controllerId !== "string") {
    return false;
  }
  if (typeof value.timestamp !== "number") {
    return false;
  }

  if (value.type === "opencontroller.bridge.disconnect") {
    return true;
  }

  return (
    value.type === "opencontroller.bridge.state" &&
    typeof value.profile === "string" &&
    value.reportFormat === "xinput" &&
    typeof value.reportBase64 === "string" &&
    isXInputReport(value.report) &&
    hasValidOptionalHidReport(value)
  );
}

function isXInputReport(value: unknown): value is XInputGamepadReport {
  return (
    isRecord(value) &&
    typeof value.buttons === "number" &&
    typeof value.leftTrigger === "number" &&
    typeof value.rightTrigger === "number" &&
    typeof value.leftStickX === "number" &&
    typeof value.leftStickY === "number" &&
    typeof value.rightStickX === "number" &&
    typeof value.rightStickY === "number"
  );
}

function hasValidOptionalHidReport(value: Record<string, unknown>): boolean {
  const hasAnyHidReportField =
    "hidReportFormat" in value ||
    "hidReport" in value ||
    "hidReportBase64" in value;

  if (!hasAnyHidReportField) {
    return true;
  }

  return (
    value.hidReportFormat === "hid-gamepad" &&
    typeof value.hidReportBase64 === "string" &&
    isHidGamepadReport(value.hidReport)
  );
}

function isHidGamepadReport(
  value: unknown,
): value is NativeBridgeHidGamepadReport {
  return (
    isRecord(value) &&
    value.reportId === 1 &&
    typeof value.buttons === "number" &&
    typeof value.leftTrigger === "number" &&
    typeof value.rightTrigger === "number" &&
    typeof value.leftStickX === "number" &&
    typeof value.leftStickY === "number" &&
    typeof value.rightStickX === "number" &&
    typeof value.rightStickY === "number"
  );
}

function xInputReportToHidGamepadReport(
  report: XInputGamepadReport,
): NativeBridgeHidGamepadReport {
  return {
    reportId: 1,
    buttons: report.buttons,
    leftTrigger: report.leftTrigger,
    rightTrigger: report.rightTrigger,
    leftStickX: report.leftStickX,
    leftStickY: report.leftStickY,
    rightStickX: report.rightStickX,
    rightStickY: report.rightStickY,
  };
}

function encodeNativeBridgeHidGamepadReport(
  report: NativeBridgeHidGamepadReport,
): Uint8Array {
  const bytes = new Uint8Array(13);
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

function decodeNativeBridgeHidGamepadReport(
  bytes: Uint8Array,
): NativeBridgeHidGamepadReport {
  if (bytes.byteLength < 13) {
    throw new RangeError("HID gamepad reports must be at least 13 bytes");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reportId = view.getUint8(0);
  if (reportId !== 1) {
    throw new RangeError(`Unexpected HID gamepad report id ${reportId}`);
  }

  return {
    reportId: 1,
    buttons: view.getUint16(1, true),
    leftStickX: view.getInt16(3, true),
    leftStickY: view.getInt16(5, true),
    rightStickX: view.getInt16(7, true),
    rightStickY: view.getInt16(9, true),
    leftTrigger: view.getUint8(11),
    rightTrigger: view.getUint8(12),
  };
}

function hidReportsEqual(
  a: NativeBridgeHidGamepadReport,
  b: NativeBridgeHidGamepadReport,
): boolean {
  return (
    a.reportId === b.reportId &&
    a.buttons === b.buttons &&
    a.leftTrigger === b.leftTrigger &&
    a.rightTrigger === b.rightTrigger &&
    a.leftStickX === b.leftStickX &&
    a.leftStickY === b.leftStickY &&
    a.rightStickX === b.rightStickX &&
    a.rightStickY === b.rightStickY
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
