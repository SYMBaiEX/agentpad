import { describe, expect, test } from "bun:test";
import type { ControllerState } from "@opencontroller/core";
import { createNativeBridgeStateMessage } from "@opencontroller/core/bridge";
import { hidGamepadButtonBits } from "@opencontroller/core/hid";
import {
  linuxEventsFromHidGamepadReport,
  linuxEventsFromHidPlayStationExtendedReport,
  linuxEventsFromNativeBridgeMessage,
  linuxEventsFromXInputReport,
} from "../events";

describe("linux uinput event mapping", () => {
  test("maps XInput reports to Linux gamepad events", () => {
    const events = linuxEventsFromXInputReport({
      buttons: 0x1000 | 0x2000 | 0x0100 | 0x0001,
      leftTrigger: 128,
      rightTrigger: 255,
      leftStickX: 32767,
      leftStickY: 32767,
      rightStickX: -32768,
      rightStickY: -32768,
    });

    expect(find(events, "BTN_SOUTH")).toBe(1);
    expect(find(events, "BTN_EAST")).toBe(1);
    expect(find(events, "BTN_TL")).toBe(1);
    expect(find(events, "BTN_DPAD_UP")).toBe(1);
    expect(find(events, "ABS_Z")).toBe(128);
    expect(find(events, "ABS_RZ")).toBe(255);
    expect(find(events, "ABS_X")).toBe(32767);
    expect(find(events, "ABS_Y")).toBe(-32767);
    expect(find(events, "ABS_RX")).toBe(-32768);
    expect(find(events, "ABS_RY")).toBe(32767);
    expect(events.at(-1)).toEqual({
      type: "EV_SYN",
      code: "SYN_REPORT",
      value: 0,
    });
  });

  test("maps native bridge messages to Linux events", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "xbox",
      connected: true,
      buttons: {
        A: true,
        B: false,
        X: false,
        Y: false,
        LB: false,
        RB: false,
        LT: false,
        RT: true,
        BACK: false,
        START: false,
        GUIDE: false,
        LS: false,
        RS: false,
        DPAD_UP: false,
        DPAD_DOWN: false,
        DPAD_LEFT: false,
        DPAD_RIGHT: false,
      },
      analogButtons: {
        LT: 0,
        RT: 0.5,
      },
      sticks: {
        left: { x: 1, y: -1 },
        right: { x: 0, y: 0 },
      },
      dpad: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      touchpad: {
        pressed: false,
        contacts: [],
      },
      motion: {
        acceleration: { x: 0, y: 0, z: 0 },
        gyroscope: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
      },
      updatedAt: 1,
    };

    const message = createNativeBridgeStateMessage(state, {
      includeState: false,
    });
    const events = linuxEventsFromNativeBridgeMessage(message);
    const {
      hidReportFormat: _hidReportFormat,
      hidReport: _hidReport,
      hidReportBase64: _hidReportBase64,
      ...legacyMessage
    } = message;
    const legacyEvents = linuxEventsFromNativeBridgeMessage(legacyMessage);

    expect(find(events, "BTN_SOUTH")).toBe(1);
    expect(find(events, "ABS_RZ")).toBe(128);
    expect(find(events, "ABS_X")).toBe(32767);
    expect(find(events, "ABS_Y")).toBe(-32767);
    expect(find(legacyEvents, "ABS_RZ")).toBe(128);
  });

  test("maps descriptor-backed HID gamepad reports to Linux events", () => {
    const events = linuxEventsFromHidGamepadReport({
      reportId: 1,
      buttons: 0x4000 | 0x0008 | hidGamepadButtonBits.HOME,
      leftTrigger: 32,
      rightTrigger: 64,
      leftStickX: -1234,
      leftStickY: 1234,
      rightStickX: 2345,
      rightStickY: -2345,
    });

    expect(find(events, "BTN_WEST")).toBe(1);
    expect(find(events, "BTN_DPAD_RIGHT")).toBe(1);
    expect(find(events, "BTN_MODE")).toBe(1);
    expect(find(events, "ABS_Z")).toBe(32);
    expect(find(events, "ABS_RZ")).toBe(64);
    expect(find(events, "ABS_X")).toBe(-1234);
    expect(find(events, "ABS_Y")).toBe(-1234);
    expect(find(events, "ABS_RX")).toBe(2345);
    expect(find(events, "ABS_RY")).toBe(2345);
  });

  test("maps PlayStation profile HID reports to Linux multitouch events", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "playstation",
      connected: true,
      buttons: {
        CROSS: true,
        CIRCLE: false,
        SQUARE: false,
        TRIANGLE: false,
        L1: false,
        R1: false,
        L2: false,
        R2: false,
        SHARE: false,
        OPTIONS: false,
        PS: false,
        L3: false,
        R3: false,
        TOUCHPAD: false,
        DPAD_UP: false,
        DPAD_DOWN: false,
        DPAD_LEFT: false,
        DPAD_RIGHT: false,
      },
      analogButtons: {
        L2: 0,
        R2: 0.25,
      },
      sticks: {
        left: { x: 0.5, y: -0.5 },
        right: { x: 0, y: 0 },
      },
      dpad: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      touchpad: {
        pressed: true,
        contacts: [
          {
            id: 7,
            active: true,
            x: 0.25,
            y: 0.75,
            pressure: 0.5,
          },
        ],
      },
      motion: {
        acceleration: { x: 0, y: 0, z: 1 },
        gyroscope: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
      },
      updatedAt: 1,
    };
    const message = createNativeBridgeStateMessage(state, {
      includeState: false,
    });
    const events = linuxEventsFromNativeBridgeMessage(message);
    const {
      profileHidReportFormat: _profileHidReportFormat,
      profileHidReport: _profileHidReport,
      profileHidReportBase64: _profileHidReportBase64,
      ...withoutProfileHid
    } = message;
    const legacyEvents = linuxEventsFromNativeBridgeMessage(withoutProfileHid);

    expect(find(events, "BTN_SOUTH")).toBe(1);
    expect(find(events, "ABS_RZ")).toBe(64);
    expect(find(events, "BTN_TOUCH")).toBe(1);
    expect(values(events, "ABS_MT_SLOT")).toEqual([0, 1]);
    expect(values(events, "ABS_MT_TRACKING_ID")).toEqual([7, -1]);
    expect(find(events, "ABS_MT_POSITION_X")).toBe(16384);
    expect(find(events, "ABS_MT_POSITION_Y")).toBe(49151);
    expect(find(events, "ABS_MT_PRESSURE")).toBe(128);
    expect(find(legacyEvents, "BTN_TOUCH")).toBeUndefined();
  });

  test("maps PlayStation profile HID reports directly", () => {
    const events = linuxEventsFromHidPlayStationExtendedReport({
      reportId: 3,
      buttons: hidGamepadButtonBits.HOME,
      leftTrigger: 0,
      rightTrigger: 0,
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      touchpadPressed: false,
      touchpadContacts: [
        { id: 1, active: false, x: 0, y: 0, pressure: 0 },
        { id: 2, active: true, x: 65535, y: 1, pressure: 255 },
      ],
      accelerationX: 0,
      accelerationY: 0,
      accelerationZ: 0,
      gyroscopeX: 0,
      gyroscopeY: 0,
      gyroscopeZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
    });

    expect(find(events, "BTN_MODE")).toBe(1);
    expect(find(events, "BTN_TOUCH")).toBe(1);
    expect(values(events, "ABS_MT_SLOT")).toEqual([0, 1]);
    expect(values(events, "ABS_MT_TRACKING_ID")).toEqual([-1, 2]);
    expect(find(events, "ABS_MT_POSITION_X")).toBe(65535);
    expect(find(events, "ABS_MT_POSITION_Y")).toBe(1);
    expect(find(events, "ABS_MT_PRESSURE")).toBe(255);
  });
});

function find(events: Array<{ code: string; value: number }>, code: string) {
  return events.find((event) => event.code === code)?.value;
}

function values(events: Array<{ code: string; value: number }>, code: string) {
  return events
    .filter((event) => event.code === code)
    .map((event) => event.value);
}
