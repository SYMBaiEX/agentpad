import { describe, expect, test } from "bun:test";
import type { ControllerState } from "@opencontroller/core";
import { createNativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  decodeWindowsXusbReport,
  encodeWindowsXusbReport,
  windowsXusbReportFromNativeBridgeMessage,
} from "../xusb";

describe("windows XUSB reports", () => {
  test("round-trips Windows XUSB report bytes", () => {
    const report = {
      buttons: 0x3000,
      leftTrigger: 10,
      rightTrigger: 255,
      leftStickX: -32768,
      leftStickY: 32767,
      rightStickX: 1234,
      rightStickY: -1234,
    };

    expect(decodeWindowsXusbReport(encodeWindowsXusbReport(report))).toEqual(
      report,
    );
  });

  test("creates XUSB reports from native bridge messages", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "xbox",
      connected: true,
      buttons: {
        A: true,
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

    const report = windowsXusbReportFromNativeBridgeMessage(
      createNativeBridgeStateMessage(state, { includeState: false }),
    );

    expect(report.buttons).toBe(0x1000);
    expect(report.rightTrigger).toBe(128);
    expect(report.leftStickX).toBe(32767);
    expect(report.leftStickY).toBe(32767);
  });
});
