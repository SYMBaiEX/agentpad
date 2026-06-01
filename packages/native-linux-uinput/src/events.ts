import type { NativeBridgeMessage } from "@opencontroller/core/bridge";
import { nativeBridgeMessageToReportBytes } from "@opencontroller/core/bridge";
import {
  type XInputGamepadReport,
  decodeXInputReport,
  xInputButtonBits,
} from "@opencontroller/core/hid";

export type LinuxInputEventType = "EV_KEY" | "EV_ABS" | "EV_SYN";

export type LinuxInputEventPlan = {
  type: LinuxInputEventType;
  code: string;
  value: number;
};

export const linuxUinputButtonMap: Array<{
  xInputBit: number;
  linuxCode: string;
}> = [
  { xInputBit: xInputButtonBits.A, linuxCode: "BTN_SOUTH" },
  { xInputBit: xInputButtonBits.B, linuxCode: "BTN_EAST" },
  { xInputBit: xInputButtonBits.X, linuxCode: "BTN_WEST" },
  { xInputBit: xInputButtonBits.Y, linuxCode: "BTN_NORTH" },
  { xInputBit: xInputButtonBits.LB, linuxCode: "BTN_TL" },
  { xInputBit: xInputButtonBits.RB, linuxCode: "BTN_TR" },
  { xInputBit: xInputButtonBits.BACK, linuxCode: "BTN_SELECT" },
  { xInputBit: xInputButtonBits.START, linuxCode: "BTN_START" },
  { xInputBit: xInputButtonBits.LS, linuxCode: "BTN_THUMBL" },
  { xInputBit: xInputButtonBits.RS, linuxCode: "BTN_THUMBR" },
  { xInputBit: xInputButtonBits.DPAD_UP, linuxCode: "BTN_DPAD_UP" },
  { xInputBit: xInputButtonBits.DPAD_DOWN, linuxCode: "BTN_DPAD_DOWN" },
  { xInputBit: xInputButtonBits.DPAD_LEFT, linuxCode: "BTN_DPAD_LEFT" },
  { xInputBit: xInputButtonBits.DPAD_RIGHT, linuxCode: "BTN_DPAD_RIGHT" },
];

export function linuxEventsFromNativeBridgeMessage(
  message: NativeBridgeMessage,
): LinuxInputEventPlan[] {
  if (message.type === "opencontroller.bridge.disconnect") {
    return linuxNeutralEvents();
  }

  const bytes = nativeBridgeMessageToReportBytes(message);
  return linuxEventsFromXInputReport(decodeXInputReport(bytes));
}

export function linuxEventsFromXInputReport(
  report: XInputGamepadReport,
): LinuxInputEventPlan[] {
  const events: LinuxInputEventPlan[] = [];

  for (const { xInputBit, linuxCode } of linuxUinputButtonMap) {
    events.push({
      type: "EV_KEY",
      code: linuxCode,
      value: (report.buttons & xInputBit) !== 0 ? 1 : 0,
    });
  }

  events.push(
    { type: "EV_ABS", code: "ABS_X", value: report.leftStickX },
    { type: "EV_ABS", code: "ABS_Y", value: invertAxis(report.leftStickY) },
    { type: "EV_ABS", code: "ABS_RX", value: report.rightStickX },
    { type: "EV_ABS", code: "ABS_RY", value: invertAxis(report.rightStickY) },
    { type: "EV_ABS", code: "ABS_Z", value: report.leftTrigger },
    { type: "EV_ABS", code: "ABS_RZ", value: report.rightTrigger },
    { type: "EV_SYN", code: "SYN_REPORT", value: 0 },
  );

  return events;
}

export function linuxNeutralEvents(): LinuxInputEventPlan[] {
  return linuxEventsFromXInputReport({
    buttons: 0,
    leftTrigger: 0,
    rightTrigger: 0,
    leftStickX: 0,
    leftStickY: 0,
    rightStickX: 0,
    rightStickY: 0,
  });
}

function invertAxis(value: number): number {
  return value <= -32768 ? 32767 : -value;
}
