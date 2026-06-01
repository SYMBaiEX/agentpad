import type { NativeBridgeMessage } from "@opencontroller/core/bridge";
import {
  nativeBridgeMessageToHidGamepadReportBytes,
  nativeBridgeMessageToProfileHidReportBytes,
} from "@opencontroller/core/bridge";
import {
  type HidGamepadReport,
  type HidPlayStationExtendedReport,
  type XInputGamepadReport,
  createHidGamepadReport,
  decodeHidGamepadReport,
  decodeHidPlayStationExtendedReport,
  hidGamepadButtonBits,
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
  { xInputBit: hidGamepadButtonBits.HOME, linuxCode: "BTN_MODE" },
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
  if (message.type === "opencontroller.bridge.feedback") {
    return [];
  }

  const profileBytes = nativeBridgeMessageToProfileHidReportBytes(message);
  if (profileBytes) {
    return linuxEventsFromHidPlayStationExtendedReport(
      decodeHidPlayStationExtendedReport(profileBytes),
    );
  }

  const bytes = nativeBridgeMessageToHidGamepadReportBytes(message);
  return linuxEventsFromHidGamepadReport(decodeHidGamepadReport(bytes));
}

export function linuxEventsFromXInputReport(
  report: XInputGamepadReport,
): LinuxInputEventPlan[] {
  return linuxEventsFromHidGamepadReport(createHidGamepadReport(report));
}

export function linuxEventsFromHidGamepadReport(
  report: HidGamepadReport,
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

export function linuxEventsFromHidPlayStationExtendedReport(
  report: HidPlayStationExtendedReport,
): LinuxInputEventPlan[] {
  const events = linuxEventsFromHidGamepadReport({
    reportId: 1,
    buttons: report.buttons,
    leftTrigger: report.leftTrigger,
    rightTrigger: report.rightTrigger,
    leftStickX: report.leftStickX,
    leftStickY: report.leftStickY,
    rightStickX: report.rightStickX,
    rightStickY: report.rightStickY,
  }).filter((event) => event.type !== "EV_SYN");
  const activeContacts = report.touchpadContacts.filter(
    (contact) => contact.active,
  );

  events.push({
    type: "EV_KEY",
    code: "BTN_TOUCH",
    value: report.touchpadPressed || activeContacts.length > 0 ? 1 : 0,
  });

  for (let slot = 0; slot < report.touchpadContacts.length; slot += 1) {
    const contact = report.touchpadContacts[slot];
    if (!contact) {
      continue;
    }

    events.push({
      type: "EV_ABS",
      code: "ABS_MT_SLOT",
      value: slot,
    });
    events.push({
      type: "EV_ABS",
      code: "ABS_MT_TRACKING_ID",
      value: contact.active ? contact.id : -1,
    });

    if (contact.active) {
      events.push(
        {
          type: "EV_ABS",
          code: "ABS_MT_POSITION_X",
          value: contact.x,
        },
        {
          type: "EV_ABS",
          code: "ABS_MT_POSITION_Y",
          value: contact.y,
        },
        {
          type: "EV_ABS",
          code: "ABS_MT_PRESSURE",
          value: contact.pressure,
        },
      );
    }
  }

  events.push({ type: "EV_SYN", code: "SYN_REPORT", value: 0 });
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
