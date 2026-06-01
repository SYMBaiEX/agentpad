import {
  type XInputGamepadReport,
  createXInputReport,
  decodeXInputReport,
  encodeXInputReport,
} from "../hid/xinput";
import type { ControllerProfileName, ControllerState } from "../types";

export const nativeBridgeProtocolVersion = 1;

export type NativeBridgeReportFormat = "xinput";

export type NativeBridgeStateMessage = {
  type: "opencontroller.bridge.state";
  version: typeof nativeBridgeProtocolVersion;
  controllerId: string;
  profile: ControllerProfileName;
  timestamp: number;
  reportFormat: NativeBridgeReportFormat;
  report: XInputGamepadReport;
  reportBase64: string;
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

  return {
    type: "opencontroller.bridge.state",
    version: nativeBridgeProtocolVersion,
    controllerId: state.id,
    profile: state.profile,
    timestamp: options.timestamp ?? Date.now(),
    reportFormat: "xinput",
    report,
    reportBase64: bytesToBase64(bytes),
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
    isXInputReport(value.report)
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
