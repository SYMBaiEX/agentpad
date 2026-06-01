import { createHidGamepadButtonMask } from "../hid/hid-buttons";
import {
  type XInputGamepadReport,
  createXInputReport,
  decodeXInputReport,
  encodeXInputReport,
} from "../hid/xinput";
import type {
  ControllerFeedbackEvent,
  ControllerProfileName,
  ControllerState,
  ControllerTouchpadContact,
  ControllerVector3,
} from "../types";

export const nativeBridgeProtocolVersion = 1;
export const nativeBridgeHidGamepadRumbleReportId = 2;
export const nativeBridgeHidGamepadRumbleReportByteLength = 5;

export type NativeBridgeReportFormat = "xinput";
export type NativeBridgeHidReportFormat = "hid-gamepad";
export type NativeBridgeFeedbackType = "rumble";
export type NativeBridgeFeedbackReportFormat = "hid-gamepad-rumble";

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

export type NativeBridgeTouchpadExtension = {
  pressed: boolean;
  contacts: ControllerTouchpadContact[];
};

export type NativeBridgeMotionExtension = {
  acceleration: ControllerVector3;
  gyroscope: ControllerVector3;
  orientation: ControllerVector3;
};

export type NativeBridgeStateExtensions = {
  touchpad?: NativeBridgeTouchpadExtension;
  motion?: NativeBridgeMotionExtension;
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
  extensions?: NativeBridgeStateExtensions;
  state?: ControllerState;
};

export type NativeBridgeDisconnectMessage = {
  type: "opencontroller.bridge.disconnect";
  version: typeof nativeBridgeProtocolVersion;
  controllerId: string;
  timestamp: number;
};

export type NativeBridgeRumbleFeedbackMessage = {
  type: "opencontroller.bridge.feedback";
  version: typeof nativeBridgeProtocolVersion;
  controllerId: string;
  timestamp: number;
  feedbackType: "rumble";
  reportFormat: "hid-gamepad-rumble";
  reportId: typeof nativeBridgeHidGamepadRumbleReportId;
  reportBase64: string;
  weakMotor: number;
  strongMotor: number;
  leftTriggerMotor: number;
  rightTriggerMotor: number;
  durationMs?: number;
};

export type NativeBridgeFeedbackMessage = NativeBridgeRumbleFeedbackMessage;

export type NativeBridgeMessage =
  | NativeBridgeStateMessage
  | NativeBridgeDisconnectMessage
  | NativeBridgeFeedbackMessage;

export type CreateNativeBridgeStateMessageOptions = {
  includeState?: boolean;
  includeExtensions?: boolean;
  timestamp?: number;
};

export type CreateNativeBridgeRumbleFeedbackMessageOptions = {
  controllerId: string;
  timestamp?: number;
  weakMotor?: number;
  strongMotor?: number;
  leftTriggerMotor?: number;
  rightTriggerMotor?: number;
  durationMs?: number;
};

export function createNativeBridgeStateMessage(
  state: ControllerState,
  options: CreateNativeBridgeStateMessageOptions = {},
): NativeBridgeStateMessage {
  const includeState = options.includeState ?? true;
  const report = createXInputReport(state);
  const bytes = encodeXInputReport(report);
  const hidReport = xInputReportToHidGamepadReport(report, state);
  const hidBytes = encodeNativeBridgeHidGamepadReport(hidReport);
  const extensions =
    options.includeExtensions === false
      ? undefined
      : createNativeBridgeStateExtensions(state);

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
    ...(extensions ? { extensions } : {}),
    ...(includeState ? { state } : {}),
  };
}

export function createNativeBridgeStateExtensions(
  state: ControllerState,
): NativeBridgeStateExtensions | undefined {
  const extensions: NativeBridgeStateExtensions = {};

  if (state.touchpad.pressed || state.touchpad.contacts.length > 0) {
    extensions.touchpad = {
      pressed: state.touchpad.pressed,
      contacts: state.touchpad.contacts.map((contact) => ({ ...contact })),
    };
  }

  if (
    !isNeutralVector3(state.motion.acceleration) ||
    !isNeutralVector3(state.motion.gyroscope) ||
    !isNeutralVector3(state.motion.orientation)
  ) {
    extensions.motion = {
      acceleration: { ...state.motion.acceleration },
      gyroscope: { ...state.motion.gyroscope },
      orientation: { ...state.motion.orientation },
    };
  }

  return Object.keys(extensions).length > 0 ? extensions : undefined;
}

export function createNativeBridgeRumbleFeedbackMessage(
  options: CreateNativeBridgeRumbleFeedbackMessageOptions,
): NativeBridgeRumbleFeedbackMessage {
  const weakMotor = clampNormalized(options.weakMotor ?? 0);
  const strongMotor = clampNormalized(options.strongMotor ?? 0);
  const leftTriggerMotor = clampNormalized(options.leftTriggerMotor ?? 0);
  const rightTriggerMotor = clampNormalized(options.rightTriggerMotor ?? 0);
  const bytes = encodeNativeBridgeRumbleReport({
    reportId: nativeBridgeHidGamepadRumbleReportId,
    weakMotor,
    strongMotor,
    leftTriggerMotor,
    rightTriggerMotor,
  });

  return {
    type: "opencontroller.bridge.feedback",
    version: nativeBridgeProtocolVersion,
    controllerId: options.controllerId,
    timestamp: options.timestamp ?? Date.now(),
    feedbackType: "rumble",
    reportFormat: "hid-gamepad-rumble",
    reportId: nativeBridgeHidGamepadRumbleReportId,
    reportBase64: bytesToBase64(bytes),
    weakMotor,
    strongMotor,
    leftTriggerMotor,
    rightTriggerMotor,
    ...(options.durationMs !== undefined
      ? { durationMs: options.durationMs }
      : {}),
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

export function nativeBridgeFeedbackMessageToRumbleReportBytes(
  message: NativeBridgeRumbleFeedbackMessage,
): Uint8Array {
  const bytes = base64ToBytes(message.reportBase64);
  const decoded = decodeNativeBridgeRumbleReport(bytes);

  if (!rumbleReportsEqual(decoded, message)) {
    throw new TypeError(
      "Native bridge rumble report bytes do not match feedback JSON",
    );
  }

  return bytes;
}

export function nativeBridgeFeedbackMessageToControllerFeedback(
  message: NativeBridgeFeedbackMessage,
): ControllerFeedbackEvent {
  nativeBridgeFeedbackMessageToRumbleReportBytes(message);

  return {
    type: "rumble",
    controllerId: message.controllerId,
    timestamp: message.timestamp,
    weakMotor: message.weakMotor,
    strongMotor: message.strongMotor,
    leftTriggerMotor: message.leftTriggerMotor,
    rightTriggerMotor: message.rightTriggerMotor,
    source: "native-bridge",
    reportFormat: message.reportFormat,
    reportId: message.reportId,
    reportBase64: message.reportBase64,
    ...(message.durationMs !== undefined
      ? { durationMs: message.durationMs }
      : {}),
  };
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

  if (value.type === "opencontroller.bridge.feedback") {
    return isNativeBridgeFeedbackMessage(value);
  }

  return (
    value.type === "opencontroller.bridge.state" &&
    typeof value.profile === "string" &&
    value.reportFormat === "xinput" &&
    typeof value.reportBase64 === "string" &&
    isXInputReport(value.report) &&
    hasValidOptionalHidReport(value) &&
    hasValidOptionalStateExtensions(value)
  );
}

export function isNativeBridgeFeedbackMessage(
  value: unknown,
): value is NativeBridgeFeedbackMessage {
  return (
    isRecord(value) &&
    value.version === nativeBridgeProtocolVersion &&
    typeof value.controllerId === "string" &&
    typeof value.timestamp === "number" &&
    value.type === "opencontroller.bridge.feedback" &&
    value.feedbackType === "rumble" &&
    value.reportFormat === "hid-gamepad-rumble" &&
    value.reportId === nativeBridgeHidGamepadRumbleReportId &&
    typeof value.reportBase64 === "string" &&
    isNormalizedNumber(value.weakMotor) &&
    isNormalizedNumber(value.strongMotor) &&
    isNormalizedNumber(value.leftTriggerMotor) &&
    isNormalizedNumber(value.rightTriggerMotor) &&
    hasValidOptionalDuration(value)
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

function hasValidOptionalStateExtensions(
  value: Record<string, unknown>,
): boolean {
  if (!("extensions" in value)) {
    return true;
  }
  return isNativeBridgeStateExtensions(value.extensions);
}

function isNativeBridgeStateExtensions(
  value: unknown,
): value is NativeBridgeStateExtensions {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.touchpad === undefined ||
      isNativeBridgeTouchpadExtension(value.touchpad)) &&
    (value.motion === undefined || isNativeBridgeMotionExtension(value.motion))
  );
}

function isNativeBridgeTouchpadExtension(
  value: unknown,
): value is NativeBridgeTouchpadExtension {
  return (
    isRecord(value) &&
    typeof value.pressed === "boolean" &&
    Array.isArray(value.contacts) &&
    value.contacts.every(isNativeBridgeTouchpadContact)
  );
}

function isNativeBridgeTouchpadContact(
  value: unknown,
): value is ControllerTouchpadContact {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    value.id >= 0 &&
    isNormalizedNumber(value.x) &&
    isNormalizedNumber(value.y) &&
    typeof value.active === "boolean" &&
    isNormalizedNumber(value.pressure)
  );
}

function isNativeBridgeMotionExtension(
  value: unknown,
): value is NativeBridgeMotionExtension {
  return (
    isRecord(value) &&
    isVector3(value.acceleration) &&
    isVector3(value.gyroscope) &&
    isVector3(value.orientation)
  );
}

function isVector3(value: unknown): value is ControllerVector3 {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    typeof value.z === "number" &&
    Number.isFinite(value.z)
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
  state?: ControllerState,
): NativeBridgeHidGamepadReport {
  return {
    reportId: 1,
    buttons: state ? createHidGamepadButtonMask(state) : report.buttons,
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

type NativeBridgeRumbleReport = {
  reportId: typeof nativeBridgeHidGamepadRumbleReportId;
  weakMotor: number;
  strongMotor: number;
  leftTriggerMotor: number;
  rightTriggerMotor: number;
};

function encodeNativeBridgeRumbleReport(
  report: NativeBridgeRumbleReport,
): Uint8Array {
  const bytes = new Uint8Array(nativeBridgeHidGamepadRumbleReportByteLength);
  const view = new DataView(bytes.buffer);

  view.setUint8(0, nativeBridgeHidGamepadRumbleReportId);
  view.setUint8(1, normalizedToByte(report.weakMotor));
  view.setUint8(2, normalizedToByte(report.strongMotor));
  view.setUint8(3, normalizedToByte(report.leftTriggerMotor));
  view.setUint8(4, normalizedToByte(report.rightTriggerMotor));

  return bytes;
}

function decodeNativeBridgeRumbleReport(
  bytes: Uint8Array,
): NativeBridgeRumbleReport {
  if (bytes.byteLength < nativeBridgeHidGamepadRumbleReportByteLength) {
    throw new RangeError(
      `HID gamepad rumble reports must be at least ${nativeBridgeHidGamepadRumbleReportByteLength} bytes`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reportId = view.getUint8(0);
  if (reportId !== nativeBridgeHidGamepadRumbleReportId) {
    throw new RangeError(`Unexpected HID gamepad rumble report id ${reportId}`);
  }

  return {
    reportId: nativeBridgeHidGamepadRumbleReportId,
    weakMotor: view.getUint8(1),
    strongMotor: view.getUint8(2),
    leftTriggerMotor: view.getUint8(3),
    rightTriggerMotor: view.getUint8(4),
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

function rumbleReportsEqual(
  report: NativeBridgeRumbleReport,
  message: NativeBridgeRumbleFeedbackMessage,
): boolean {
  return (
    report.reportId === message.reportId &&
    report.weakMotor === normalizedToByte(message.weakMotor) &&
    report.strongMotor === normalizedToByte(message.strongMotor) &&
    report.leftTriggerMotor === normalizedToByte(message.leftTriggerMotor) &&
    report.rightTriggerMotor === normalizedToByte(message.rightTriggerMotor)
  );
}

function hasValidOptionalDuration(value: Record<string, unknown>): boolean {
  return (
    value.durationMs === undefined ||
    (typeof value.durationMs === "number" &&
      Number.isFinite(value.durationMs) &&
      value.durationMs >= 0)
  );
}

function isNormalizedNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizedToByte(value: number): number {
  return Math.round(clampNormalized(value) * 255);
}

function isNeutralVector3(value: ControllerVector3): boolean {
  return value.x === 0 && value.y === 0 && value.z === 0;
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
