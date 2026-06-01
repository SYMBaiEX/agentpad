import type { NativeBridgeStateMessage } from "@opencontroller/core/bridge";
import { nativeBridgeMessageToReportBytes } from "@opencontroller/core/bridge";
import {
  type XInputGamepadReport,
  decodeXInputReport,
  encodeXInputReport,
} from "@opencontroller/core/hid";

export type WindowsXusbReport = XInputGamepadReport;

export function windowsXusbReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): WindowsXusbReport {
  return decodeXInputReport(nativeBridgeMessageToReportBytes(message));
}

export function encodeWindowsXusbReport(report: WindowsXusbReport): Uint8Array {
  return encodeXInputReport(report);
}

export function decodeWindowsXusbReport(bytes: Uint8Array): WindowsXusbReport {
  return decodeXInputReport(bytes);
}
