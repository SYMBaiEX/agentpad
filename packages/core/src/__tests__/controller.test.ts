import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ControllerFeedbackEvent,
  DryRunAdapter,
  HidGamepadReportAdapter,
  HidPlayStationExtendedReportAdapter,
  HidSwitchExtendedReportAdapter,
  NativeBridgeAdapter,
  NativeProcessBridgeAdapter,
  WebSocketAdapter,
  XInputReportAdapter,
  createActionMap,
  createController,
  createControllerHub,
  createNativeBridgeLightFeedbackMessage,
  createNativeBridgeRumbleFeedbackMessage,
  createNativeBridgeStateMessage,
  decodeHidGamepadLightReport,
  decodeHidGamepadReport,
  decodeHidGamepadRumbleReport,
  decodeHidPlayStationExtendedReport,
  decodeHidSwitchExtendedReport,
  decodeXInputReport,
  encodeHidGamepadLightReport,
  encodeHidGamepadReport,
  encodeHidGamepadRumbleReport,
  encodeHidPlayStationExtendedReport,
  encodeHidSwitchExtendedReport,
  encodeXInputReport,
  hidGamepadButtonBits,
  hidGamepadLightOutputReportDescriptor,
  hidGamepadLightReportByteLength,
  hidGamepadLightReportId,
  hidGamepadReportByteLength,
  hidGamepadReportDescriptor,
  hidGamepadReportDescriptorWithFeedback,
  hidGamepadReportDescriptorWithRumble,
  hidGamepadReportFromNativeBridgeMessage,
  hidGamepadRumbleOutputReportDescriptor,
  hidGamepadRumbleReportByteLength,
  hidGamepadRumbleReportId,
  hidPlayStationExtendedReportByteLength,
  hidPlayStationExtendedReportDescriptor,
  hidPlayStationExtendedReportDescriptorWithRumble,
  hidPlayStationExtendedReportId,
  hidSwitchExtendedReportByteLength,
  hidSwitchExtendedReportDescriptor,
  hidSwitchExtendedReportDescriptorWithRumble,
  hidSwitchExtendedReportId,
  nativeBridgeFeedbackMessageToControllerFeedback,
  nativeBridgeFeedbackMessageToLightReportBytes,
  nativeBridgeFeedbackMessageToRumbleReportBytes,
  nativeBridgeMessageToHidGamepadReportBytes,
  nativeBridgeMessageToProfileHidReportBytes,
  nativeBridgeMessageToReportBytes,
  parseNativeBridgeMessage,
  serializeNativeBridgeMessage,
  xInputButtonBits,
} from "../index";

const cleanupDirs: string[] = [];

afterEach(async () => {
  for (const dir of cleanupDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("controller runtime", () => {
  test("presses and releases a button through dry-run", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 5);

    expect(controller.getState().buttons.A).toBe(false);
    expect(adapter.history.map((entry) => entry.command.type)).toEqual([
      "press",
      "release",
    ]);

    await controller.disconnect();
  });

  test("supports analog pressure through press options", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("RT", { durationMs: 0, pressure: 0.4 });

    const state = controller.getState();
    const report = decodeXInputReport(encodeXInputReport(state));

    expect(adapter.history.at(-1)?.command).toMatchObject({
      type: "press",
      button: "RT",
      durationMs: 0,
      pressure: 0.4,
    });
    expect(state.buttons.RT).toBe(true);
    expect(state.analogButtons.RT).toBe(0.4);
    expect(report.rightTrigger).toBe(102);

    await controller.press("RT", { durationMs: 0, pressure: 2 });

    const clampedState = controller.getState();
    const clampedReport = decodeXInputReport(encodeXInputReport(clampedState));

    expect(clampedState.analogButtons.RT).toBe(1);
    expect(clampedReport.rightTrigger).toBe(255);

    await controller.release("RT");
    expect(controller.getState().analogButtons.RT).toBe(0);

    await controller.disconnect();
  });

  test("sets persistent button state without auto release", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.setButton("A", true);

    const pressedState = controller.getState();
    const pressedReport = decodeXInputReport(encodeXInputReport(pressedState));

    expect(pressedState.buttons.A).toBe(true);
    expect("A" in pressedState.analogButtons).toBe(false);
    expect(pressedReport.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(adapter.history.at(-1)?.command).toEqual({
      type: "setButton",
      button: "A",
      pressed: true,
    });

    await controller.setButton("A", false);

    const releasedState = controller.getState();
    const releasedReport = decodeXInputReport(
      encodeXInputReport(releasedState),
    );

    expect(releasedState.buttons.A).toBe(false);
    expect("A" in releasedState.analogButtons).toBe(false);
    expect(releasedReport.buttons & xInputButtonBits.A).toBe(0);

    await controller.disconnect();
  });

  test("sets persistent analog and dpad state", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.setStick("LEFT", { x: 0.5, y: -0.5 });
    await controller.setTrigger("RT", 0.25);
    await controller.setDpad("UP_RIGHT");

    const heldState = controller.getState();
    const heldReport = decodeXInputReport(encodeXInputReport(heldState));

    expect(heldState.sticks.left).toEqual({ x: 0.5, y: -0.5 });
    expect(heldState.analogButtons.RT).toBe(0.25);
    expect(heldState.dpad).toEqual({
      up: true,
      down: false,
      left: false,
      right: true,
    });
    expect(heldReport.rightTrigger).toBe(64);
    expect(heldReport.buttons & xInputButtonBits.DPAD_UP).toBe(
      xInputButtonBits.DPAD_UP,
    );
    expect(heldReport.buttons & xInputButtonBits.DPAD_RIGHT).toBe(
      xInputButtonBits.DPAD_RIGHT,
    );

    await controller.setDpad("NEUTRAL");

    expect(controller.getState().dpad).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
    });
    expect(adapter.history.map((entry) => entry.command.type)).toEqual([
      "setStick",
      "setTrigger",
      "setDpad",
      "setDpad",
    ]);

    await controller.disconnect();
  });

  test("sets an atomic persistent controller state patch", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });
    const stateSyncsBefore = adapter.stateHistory.length;

    await controller.setState({
      buttons: {
        A: true,
        RT: { pressed: true, pressure: 0.4 },
      },
      triggers: {
        LT: 0.25,
      },
      sticks: {
        LEFT: { x: 0.5, y: -0.5 },
        RIGHT: { x: -0.25, y: 0.75 },
      },
      dpad: "DOWN_LEFT",
    });

    const state = controller.getState();
    const report = decodeXInputReport(encodeXInputReport(state));

    expect(adapter.history.map((entry) => entry.command.type)).toEqual([
      "setState",
    ]);
    expect(adapter.stateHistory.length).toBe(stateSyncsBefore + 1);
    expect(state.buttons.A).toBe(true);
    expect(state.buttons.RT).toBe(true);
    expect(state.analogButtons.RT).toBe(0.4);
    expect(state.analogButtons.LT).toBe(0.25);
    expect(state.sticks.left).toEqual({ x: 0.5, y: -0.5 });
    expect(state.sticks.right).toEqual({ x: -0.25, y: 0.75 });
    expect(state.dpad).toEqual({
      up: false,
      down: true,
      left: true,
      right: false,
    });
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.buttons & xInputButtonBits.DPAD_DOWN).toBe(
      xInputButtonBits.DPAD_DOWN,
    );
    expect(report.buttons & xInputButtonBits.DPAD_LEFT).toBe(
      xInputButtonBits.DPAD_LEFT,
    );
    expect(report.leftTrigger).toBe(64);
    expect(report.rightTrigger).toBe(102);

    await controller.disconnect();
  });

  test("tracks virtual device battery and connection status", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    expect(controller.getState().status).toEqual({
      battery: {
        level: 1,
        charging: false,
        wired: true,
        low: false,
      },
      connection: {
        quality: 1,
        latencyMs: 0,
        packetLoss: 0,
      },
    });

    await controller.setStatus({
      battery: {
        level: 1.5,
        charging: true,
        wired: false,
        low: true,
      },
      connection: {
        quality: -0.2,
        latencyMs: -4,
        packetLoss: 2,
      },
    });

    expect(adapter.history.at(-1)?.command).toEqual({
      type: "setStatus",
      status: {
        battery: {
          level: 1,
          charging: true,
          wired: false,
          low: true,
        },
        connection: {
          quality: 0,
          latencyMs: 0,
          packetLoss: 1,
        },
      },
    });
    expect(controller.getState().status).toEqual({
      battery: {
        level: 1,
        charging: true,
        wired: false,
        low: true,
      },
      connection: {
        quality: 0,
        latencyMs: 0,
        packetLoss: 1,
      },
    });

    await controller.setState({
      buttons: {
        A: true,
      },
      status: {
        battery: {
          level: 0.25,
          low: false,
        },
        connection: {
          quality: 0.75,
          latencyMs: 12,
          packetLoss: 0.05,
        },
      },
    });

    expect(controller.getState().status).toEqual({
      battery: {
        level: 0.25,
        charging: true,
        wired: false,
        low: false,
      },
      connection: {
        quality: 0.75,
        latencyMs: 12,
        packetLoss: 0.05,
      },
    });

    await controller.neutral();
    expect(controller.getState().status.battery.level).toBe(0.25);
    expect(controller.getState().status.connection.latencyMs).toBe(12);

    await controller.disconnect();
  });

  test("sets PlayStation touchpad and motion state in a patch", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "playstation",
      adapter,
      replay: false,
    });

    await controller.setState({
      buttons: {
        X: true,
      },
      touchpad: {
        pressed: true,
        contacts: [{ id: 7, x: 2, y: -1, pressure: 2 }],
      },
      motion: {
        acceleration: { x: 0, y: 0, z: 1 },
        gyroscope: { x: 0.1, y: 0.2, z: 0.3 },
      },
    });

    const state = controller.getState();
    const command = adapter.history.at(-1)?.command;

    expect(state.buttons.CROSS).toBe(true);
    expect(state.touchpad.pressed).toBe(true);
    expect(state.touchpad.contacts).toEqual([
      { id: 7, x: 1, y: 0, active: true, pressure: 1 },
    ]);
    expect(state.motion.acceleration).toEqual({ x: 0, y: 0, z: 1 });
    expect(state.motion.gyroscope).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(command).toMatchObject({
      type: "setState",
      state: {
        buttons: {
          CROSS: true,
        },
      },
    });

    await controller.disconnect();
  });

  test("maps binary trigger button presses to full analog pulls", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
    });

    await controller.press("RT", 0);

    const pressedState = controller.getState();
    const pressedReport = decodeXInputReport(encodeXInputReport(pressedState));

    expect(pressedState.buttons.RT).toBe(true);
    expect(pressedState.analogButtons.RT).toBe(1);
    expect(pressedReport.rightTrigger).toBe(255);

    await controller.release("RT");

    const releasedState = controller.getState();
    const releasedReport = decodeXInputReport(
      encodeXInputReport(releasedState),
    );

    expect(releasedState.buttons.RT).toBe(false);
    expect(releasedState.analogButtons.RT).toBe(0);
    expect(releasedReport.rightTrigger).toBe(0);

    await controller.disconnect();
  });

  test("moves sticks and returns them to neutral", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
    });

    await controller.moveStick("LEFT", { x: 4, y: -4 }, 5);

    expect(controller.getState().sticks.left).toEqual({ x: 0, y: 0 });

    await controller.disconnect();
  });

  test("presses and releases dpad through adapters", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.dpad("UP", 5);

    expect(controller.getState().dpad.up).toBe(false);
    expect(adapter.history.map((entry) => entry.command)).toEqual([
      { type: "dpad", direction: "UP", durationMs: 5 },
      { type: "release", button: "DPAD_UP" },
    ]);

    await controller.disconnect();
  });

  test("presses diagonal dpad directions as combined cardinal buttons", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.dpad("UP_RIGHT", 5);

    const pressedState = adapter.stateHistory.find(
      (state) => state.dpad.up && state.dpad.right,
    );
    if (!pressedState) {
      throw new Error("Expected an UP_RIGHT D-pad state snapshot");
    }

    const pressedReport = decodeXInputReport(encodeXInputReport(pressedState));

    expect(pressedState.buttons.DPAD_UP).toBe(true);
    expect(pressedState.buttons.DPAD_RIGHT).toBe(true);
    expect(pressedReport.buttons & xInputButtonBits.DPAD_UP).toBe(
      xInputButtonBits.DPAD_UP,
    );
    expect(pressedReport.buttons & xInputButtonBits.DPAD_RIGHT).toBe(
      xInputButtonBits.DPAD_RIGHT,
    );
    expect(controller.getState().dpad).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
    });
    expect(adapter.history.map((entry) => entry.command)).toEqual([
      { type: "dpad", direction: "UP_RIGHT", durationMs: 5 },
      { type: "release", button: "DPAD_UP" },
      { type: "release", button: "DPAD_RIGHT" },
    ]);

    await controller.disconnect();
  });

  test("keeps direct dpad button state and structured dpad state in sync", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("DPAD_UP", 0);

    const pressedState = controller.getState();
    const pressedReport = decodeXInputReport(encodeXInputReport(pressedState));

    expect(pressedState.buttons.DPAD_UP).toBe(true);
    expect(pressedState.dpad.up).toBe(true);
    expect(pressedReport.buttons & xInputButtonBits.DPAD_UP).toBe(
      xInputButtonBits.DPAD_UP,
    );
    expect(adapter.stateHistory.at(-1)?.dpad.up).toBe(true);

    await controller.release("DPAD_UP");

    const releasedState = controller.getState();
    const releasedReport = decodeXInputReport(
      encodeXInputReport(releasedState),
    );

    expect(releasedState.buttons.DPAD_UP).toBe(false);
    expect(releasedState.dpad.up).toBe(false);
    expect(releasedReport.buttons & xInputButtonBits.DPAD_UP).toBe(0);
    expect(adapter.stateHistory.at(-1)?.dpad.up).toBe(false);

    await controller.disconnect();
  });

  test("blocks disabled system buttons by default", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
    });

    await expect(controller.press("GUIDE", 5)).rejects.toThrow(
      "disabled by safety config",
    );

    await controller.disconnect();
  });

  test("applies disabled button safety to dpad helper commands", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
      safety: {
        disabledButtons: ["DPAD_UP"],
      },
    });

    await expect(controller.dpad("UP", 5)).rejects.toThrow(
      "Button DPAD_UP is disabled by safety config",
    );
    await expect(controller.dpad("UP_RIGHT", 5)).rejects.toThrow(
      "Button DPAD_UP is disabled by safety config",
    );

    await controller.disconnect();
  });

  test("applies disabled combo safety to diagonal dpad helper commands", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
      safety: {
        disabledCombos: [["DPAD_UP", "DPAD_RIGHT"]],
      },
    });

    await expect(controller.dpad("UP_RIGHT", 5)).rejects.toThrow(
      "Combo DPAD_UP+DPAD_RIGHT is disabled by safety config",
    );

    await controller.disconnect();
  });

  test("limits dpad hold duration through button safety", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
      safety: {
        maxButtonHoldMs: 50,
      },
    });

    await expect(controller.dpad("UP_RIGHT", 51)).rejects.toThrow(
      "Button hold duration 51ms exceeds 50ms",
    );

    await controller.disconnect();
  });

  test("applies safety policies to persistent state commands", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
      safety: {
        disabledButtons: ["DPAD_UP", "GUIDE"],
        disabledCombos: [["DPAD_UP", "DPAD_RIGHT"]],
      },
    });

    await expect(controller.setButton("GUIDE", true)).rejects.toThrow(
      "Button GUIDE is disabled by safety config",
    );
    await expect(controller.setDpad("UP")).rejects.toThrow(
      "Button DPAD_UP is disabled by safety config",
    );
    await expect(
      controller.setState({
        buttons: { GUIDE: true },
      }),
    ).rejects.toThrow("Button GUIDE is disabled by safety config");
    await expect(
      controller.setState({
        dpad: "UP",
      }),
    ).rejects.toThrow("Button DPAD_UP is disabled by safety config");
    await controller.setDpad("NEUTRAL");

    await controller.disconnect();
  });

  test("describes adapter emulation capabilities", () => {
    const dryRun = new DryRunAdapter().capabilities();
    const websocket = new WebSocketAdapter({
      url: "ws://127.0.0.1:4317",
    }).capabilities();
    const xinput = new XInputReportAdapter().capabilities();
    const nativeBridge = new NativeBridgeAdapter().capabilities();
    const nativeProcess = new NativeProcessBridgeAdapter({
      command: "/bin/cat",
      supportsRumble: true,
      supportsLights: true,
      virtualDeviceKind: "os-virtual-gamepad",
    }).capabilities();

    expect(dryRun.supportedProfiles).toContain("keyboard-mouse");
    expect(dryRun.supportedCommands).toContain("combo");
    expect(dryRun.supportedCommands).toContain("setButton");
    expect(dryRun.supportedCommands).toContain("setStick");
    expect(dryRun.supportedCommands).toContain("setTrigger");
    expect(dryRun.supportedCommands).toContain("setDpad");
    expect(dryRun.supportedCommands).toContain("setState");
    expect(dryRun.supportedCommands).toContain("touchpad");
    expect(dryRun.supportedCommands).toContain("motion");
    expect(dryRun.supportsTouchpad).toBe(true);
    expect(dryRun.supportsGyro).toBe(true);
    expect(dryRun.supportsDeviceStatus).toBe(true);
    expect(dryRun.outputFormats).toEqual([
      "normalized-command",
      "controller-state",
    ]);
    expect(dryRun.transport).toBe("memory");
    expect(dryRun.virtualDeviceKind).toBe("none");

    expect(websocket.outputFormats).toContain("websocket-json");
    expect(websocket.supportsTouchpad).toBe(true);
    expect(websocket.supportsGyro).toBe(true);
    expect(websocket.supportsDeviceStatus).toBe(true);
    expect(websocket.transport).toBe("websocket");

    expect(xinput.reportFormats).toEqual(["xinput"]);
    expect(xinput.supportsTouchpad).toBe(false);
    expect(xinput.supportsGyro).toBe(false);
    expect(xinput.supportsDeviceStatus).toBe(true);
    expect(xinput.outputFormats).toContain("xinput-report");

    const hidGamepad = new HidGamepadReportAdapter().capabilities();
    const hidPlayStation =
      new HidPlayStationExtendedReportAdapter().capabilities();
    const hidSwitch = new HidSwitchExtendedReportAdapter().capabilities();
    expect(hidGamepad.reportFormats).toEqual([
      "hid-gamepad",
      "hid-gamepad-rumble",
      "hid-gamepad-lights",
    ]);
    expect(hidGamepad.outputFormats).toContain("hid-gamepad-report");
    expect(hidGamepad.supportsStateSync).toBe(true);
    expect(hidGamepad.supportsRumble).toBe(true);
    expect(hidGamepad.supportsLights).toBe(true);
    expect(hidGamepad.supportsDeviceStatus).toBe(true);
    expect(hidGamepad.feedbackTypes).toEqual(["rumble", "lights"]);
    expect(hidPlayStation.reportFormats).toEqual([
      "hid-playstation-extended",
      "hid-gamepad-rumble",
      "hid-gamepad-lights",
    ]);
    expect(hidPlayStation.outputFormats).toContain(
      "hid-playstation-extended-report",
    );
    expect(hidPlayStation.supportedProfiles).toEqual(["playstation"]);
    expect(hidPlayStation.supportsTouchpad).toBe(true);
    expect(hidPlayStation.supportsGyro).toBe(true);
    expect(hidPlayStation.supportsRumble).toBe(true);
    expect(hidPlayStation.supportsLights).toBe(true);
    expect(hidPlayStation.supportsDeviceStatus).toBe(true);
    expect(hidPlayStation.feedbackTypes).toEqual(["rumble", "lights"]);
    expect(hidSwitch.reportFormats).toEqual([
      "hid-switch-extended",
      "hid-gamepad-rumble",
      "hid-gamepad-lights",
    ]);
    expect(hidSwitch.outputFormats).toContain("hid-switch-extended-report");
    expect(hidSwitch.supportedProfiles).toEqual(["switch"]);
    expect(hidSwitch.supportsGyro).toBe(true);
    expect(hidSwitch.supportsRumble).toBe(true);
    expect(hidSwitch.supportsLights).toBe(true);
    expect(hidSwitch.supportsDeviceStatus).toBe(true);
    expect(hidSwitch.feedbackTypes).toEqual(["rumble", "lights"]);

    expect(nativeBridge.outputFormats).toContain("native-bridge-jsonl");
    expect(nativeBridge.outputFormats).toContain(
      "hid-playstation-extended-report",
    );
    expect(nativeBridge.outputFormats).toContain("hid-switch-extended-report");
    expect(nativeBridge.reportFormats).toEqual([
      "xinput",
      "hid-gamepad",
      "hid-playstation-extended",
      "hid-switch-extended",
    ]);
    expect(nativeBridge.supportedCommands).toContain("touchpad");
    expect(nativeBridge.supportedCommands).toContain("motion");
    expect(nativeBridge.supportsTouchpad).toBe(true);
    expect(nativeBridge.supportsGyro).toBe(true);
    expect(nativeBridge.supportsDeviceStatus).toBe(true);

    expect(nativeProcess.supportsVirtualDevice).toBe(true);
    expect(nativeProcess.supportsRumble).toBe(true);
    expect(nativeProcess.reportFormats).toContain("hid-playstation-extended");
    expect(nativeProcess.reportFormats).toContain("hid-switch-extended");
    expect(nativeProcess.feedbackTypes).toEqual(["rumble", "lights"]);
    expect(nativeProcess.reportFormats).toContain("hid-gamepad-rumble");
    expect(nativeProcess.reportFormats).toContain("hid-gamepad-lights");
    expect(nativeProcess.supportsLights).toBe(true);
    expect(nativeProcess.supportsDeviceStatus).toBe(true);
    expect(nativeProcess.transport).toBe("native-process");
    expect(nativeProcess.virtualDeviceKind).toBe("os-virtual-gamepad");
  });

  test("tracks PlayStation touchpad and motion state", async () => {
    const adapter = new DryRunAdapter();
    const controller = await createController({
      profile: "playstation",
      adapter,
      replay: false,
    });

    await controller.touchpad(
      {
        pressed: true,
        contacts: [
          {
            id: 7,
            x: 2,
            y: -1,
            pressure: 2,
          },
        ],
      },
      0,
    );
    await controller.motion(
      {
        acceleration: { x: 0.1, y: -0.2, z: 0.98 },
        gyroscope: { x: 1, y: 2, z: 3 },
        orientation: { x: 4, y: 5, z: 6 },
      },
      0,
    );

    const state = controller.getState();
    expect(state.touchpad).toEqual({
      pressed: true,
      contacts: [
        {
          id: 7,
          x: 1,
          y: 0,
          active: true,
          pressure: 1,
        },
      ],
    });
    expect(state.motion).toEqual({
      acceleration: { x: 0.1, y: -0.2, z: 0.98 },
      gyroscope: { x: 1, y: 2, z: 3 },
      orientation: { x: 4, y: 5, z: 6 },
    });
    expect(adapter.history.at(-2)?.command.type).toBe("touchpad");
    expect(adapter.history.at(-1)?.command.type).toBe("motion");

    await controller.neutral();
    expect(controller.getState().touchpad).toEqual({
      pressed: false,
      contacts: [],
    });
    expect(controller.getState().motion).toEqual({
      acceleration: { x: 0, y: 0, z: 0 },
      gyroscope: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0 },
    });

    await controller.disconnect();
  });

  test("rejects touchpad input for profiles without touchpads", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
    });

    await expect(
      controller.touchpad({ pressed: true, contacts: [{ x: 0.5, y: 0.5 }] }),
    ).rejects.toThrow("Touchpad input is not supported by xbox");

    await controller.disconnect();
  });

  test("tracks Switch motion state", async () => {
    const controller = await createController({
      profile: "switch",
      adapter: "dry-run",
      replay: false,
    });

    await controller.motion({ gyroscope: { x: 10, y: 20, z: 30 } }, 0);

    expect(controller.getState().motion.gyroscope).toEqual({
      x: 10,
      y: 20,
      z: 30,
    });

    await controller.disconnect();
  });

  test("encodes controller state as XInput reports", async () => {
    const adapter = new XInputReportAdapter();
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 5);
    await controller.trigger("RT", 0.5, 0);
    await controller.moveStick("LEFT", { x: 1, y: -1 }, 0);

    const reports = adapter.reports.map((entry) =>
      decodeXInputReport(entry.bytes),
    );
    const aPressed = reports.find(
      (report) => (report.buttons & xInputButtonBits.A) !== 0,
    );
    const latest = reports.at(-1);

    expect(aPressed?.buttons).toBe(xInputButtonBits.A);
    expect(latest?.rightTrigger).toBe(128);
    expect(latest?.leftStickX).toBe(32767);
    expect(latest?.leftStickY).toBe(32767);

    await controller.disconnect();
  });

  test("encodes controller state as HID gamepad reports", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
    });

    await controller.press("A", 0);
    await controller.trigger("RT", 0.5, 0);
    await controller.moveStick("LEFT", { x: 1, y: -1 }, 0);

    const bytes = encodeHidGamepadReport(controller.getState());
    const report = decodeHidGamepadReport(bytes);

    expect(bytes.byteLength).toBe(hidGamepadReportByteLength);
    expect(hidGamepadReportDescriptor.byteLength).toBeGreaterThan(0);
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.rightTrigger).toBe(128);
    expect(report.leftStickX).toBe(32767);
    expect(report.leftStickY).toBe(32767);

    await controller.disconnect();
  });

  test("resolves HID report adapters by adapter name", async () => {
    const hidGamepad = await createController({
      profile: "xbox",
      adapter: "hid-gamepad-report",
      replay: false,
    });
    const playstation = await createController({
      profile: "playstation",
      adapter: "hid-playstation-extended-report",
      replay: false,
    });
    const switchController = await createController({
      profile: "switch",
      adapter: "hid-switch-extended-report",
      replay: false,
    });

    expect(hidGamepad.capabilities().reportFormats).toEqual([
      "hid-gamepad",
      "hid-gamepad-rumble",
      "hid-gamepad-lights",
    ]);
    expect(playstation.capabilities().reportFormats).toEqual([
      "hid-playstation-extended",
      "hid-gamepad-rumble",
      "hid-gamepad-lights",
    ]);
    expect(switchController.capabilities().reportFormats).toEqual([
      "hid-switch-extended",
      "hid-gamepad-rumble",
      "hid-gamepad-lights",
    ]);

    await hidGamepad.disconnect();
    await playstation.disconnect();
    await switchController.disconnect();
  });

  test("streams controller state as HID gamepad reports", async () => {
    const callbackBytes: Uint8Array[] = [];
    const adapter = new HidGamepadReportAdapter({
      onReport({ bytes }) {
        callbackBytes.push(bytes);
      },
    });
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.setState({
      buttons: { A: true },
      triggers: { RT: 0.5 },
      sticks: { LEFT: { x: 1, y: -1 } },
    });

    const latest = adapter.reports.at(-1);
    if (!latest) {
      throw new Error("Expected a HID gamepad report");
    }
    const report = decodeHidGamepadReport(latest.bytes);

    expect(callbackBytes).toHaveLength(adapter.reports.length);
    expect(latest.bytes.byteLength).toBe(hidGamepadReportByteLength);
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.rightTrigger).toBe(128);
    expect(report.leftStickX).toBe(32767);
    expect(report.leftStickY).toBe(32767);

    await controller.disconnect();
  });

  test("surfaces HID gamepad rumble output reports as feedback", async () => {
    const optionFeedbackEvents: ControllerFeedbackEvent[] = [];
    const listenerFeedbackEvents: ControllerFeedbackEvent[] = [];
    const adapter = new HidGamepadReportAdapter({
      onFeedback(event) {
        optionFeedbackEvents.push(event);
      },
    });
    const controller = await createController({
      id: "hid-player",
      profile: "xbox",
      adapter,
      replay: false,
    });
    const unsubscribe = controller.onFeedback((event) => {
      listenerFeedbackEvents.push(event);
    });

    const bytes = encodeHidGamepadRumbleReport({
      weakMotor: 0.25,
      strongMotor: 0.5,
      leftTriggerMotor: 0.75,
      rightTriggerMotor: 1,
    });
    const event = adapter.receiveOutputReport(bytes, {
      timestamp: 123,
      durationMs: 60,
    });

    expect(event).toMatchObject({
      type: "rumble",
      controllerId: "hid-player",
      timestamp: 123,
      weakMotor: 64 / 255,
      strongMotor: 128 / 255,
      leftTriggerMotor: 191 / 255,
      rightTriggerMotor: 1,
      durationMs: 60,
      source: "hid-gamepad-report",
      reportFormat: "hid-gamepad-rumble",
      reportId: hidGamepadRumbleReportId,
    });
    expect(optionFeedbackEvents).toEqual([event]);
    expect(listenerFeedbackEvents).toEqual([event]);
    expect(decodeHidGamepadRumbleReport(bytes).strongMotor).toBe(128);
    expect(controller.getState().feedback.rumble).toMatchObject({
      active: true,
      weakMotor: 64 / 255,
      strongMotor: 128 / 255,
      leftTriggerMotor: 191 / 255,
      rightTriggerMotor: 1,
      updatedAt: 123,
      durationMs: 60,
      source: "hid-gamepad-report",
      reportFormat: "hid-gamepad-rumble",
      reportId: hidGamepadRumbleReportId,
    });

    unsubscribe();
    await controller.disconnect();
  });

  test("encodes HID gamepad rumble output reports", () => {
    const bytes = encodeHidGamepadRumbleReport({
      weakMotor: 0.25,
      strongMotor: 1,
      leftTriggerMotor: -1,
      rightTriggerMotor: 2,
    });
    const report = decodeHidGamepadRumbleReport(bytes);

    expect(bytes.byteLength).toBe(hidGamepadRumbleReportByteLength);
    expect(report.reportId).toBe(hidGamepadRumbleReportId);
    expect(report.weakMotor).toBe(64);
    expect(report.strongMotor).toBe(255);
    expect(report.leftTriggerMotor).toBe(0);
    expect(report.rightTriggerMotor).toBe(255);
    expect(hidGamepadRumbleOutputReportDescriptor.byteLength).toBeGreaterThan(
      0,
    );
    expect(hidGamepadReportDescriptorWithRumble.byteLength).toBeGreaterThan(
      hidGamepadReportDescriptor.byteLength,
    );
  });

  test("surfaces HID gamepad light output reports as feedback", async () => {
    const optionFeedbackEvents: ControllerFeedbackEvent[] = [];
    const listenerFeedbackEvents: ControllerFeedbackEvent[] = [];
    const adapter = new HidGamepadReportAdapter({
      onFeedback(event) {
        optionFeedbackEvents.push(event);
      },
    });
    const controller = await createController({
      id: "hid-player",
      profile: "xbox",
      adapter,
      replay: false,
    });
    const unsubscribe = controller.onFeedback((event) => {
      listenerFeedbackEvents.push(event);
    });

    const bytes = encodeHidGamepadLightReport({
      red: 1,
      green: 0.5,
      blue: 0.25,
      brightness: 0.75,
      playerIndex: 2,
      playerLightMask: 0b0101,
    });
    const event = adapter.receiveOutputReport(bytes, {
      timestamp: 124,
      source: "host-lightbar",
    });

    expect(event).toMatchObject({
      type: "lights",
      controllerId: "hid-player",
      timestamp: 124,
      red: 1,
      green: 128 / 255,
      blue: 64 / 255,
      brightness: 191 / 255,
      playerIndex: 2,
      playerLightMask: 0b0101,
      source: "host-lightbar",
      reportFormat: "hid-gamepad-lights",
      reportId: hidGamepadLightReportId,
    });
    expect(optionFeedbackEvents).toEqual([event]);
    expect(listenerFeedbackEvents).toEqual([event]);
    expect(decodeHidGamepadLightReport(bytes).playerLightMask).toBe(0b0101);
    expect(controller.getState().feedback.lights).toMatchObject({
      active: true,
      red: 1,
      green: 128 / 255,
      blue: 64 / 255,
      brightness: 191 / 255,
      playerIndex: 2,
      playerLightMask: 0b0101,
      updatedAt: 124,
      source: "host-lightbar",
      reportFormat: "hid-gamepad-lights",
      reportId: hidGamepadLightReportId,
    });

    unsubscribe();
    await controller.disconnect();
  });

  test("encodes HID gamepad light output reports", () => {
    const bytes = encodeHidGamepadLightReport({
      red: 1,
      green: 0.5,
      blue: -1,
      brightness: 2,
      playerIndex: 3.4,
      playerLightMask: 300,
    });
    const report = decodeHidGamepadLightReport(bytes);

    expect(bytes.byteLength).toBe(hidGamepadLightReportByteLength);
    expect(report.reportId).toBe(hidGamepadLightReportId);
    expect(report.red).toBe(255);
    expect(report.green).toBe(128);
    expect(report.blue).toBe(0);
    expect(report.brightness).toBe(255);
    expect(report.playerIndex).toBe(3);
    expect(report.playerLightMask).toBe(255);
    expect(hidGamepadLightOutputReportDescriptor.byteLength).toBeGreaterThan(0);
    expect(hidGamepadReportDescriptorWithFeedback.byteLength).toBeGreaterThan(
      hidGamepadReportDescriptorWithRumble.byteLength,
    );
  });

  test("encodes PlayStation extended HID reports with touchpad and motion", async () => {
    const controller = await createController({
      profile: "playstation",
      adapter: "dry-run",
      replay: false,
    });

    await controller.touchpad(
      {
        pressed: true,
        contacts: [
          { id: 2, x: 0.25, y: 0.75, pressure: 0.5 },
          { id: 3, x: 1, y: 0, pressure: 1 },
        ],
      },
      0,
    );
    await controller.motion(
      {
        acceleration: { x: 0, y: 0, z: 1 },
        gyroscope: { x: -1, y: 0.5, z: 0 },
        orientation: { x: 0.5, y: -0.5, z: 0 },
      },
      0,
    );

    const bytes = encodeHidPlayStationExtendedReport(controller.getState());
    const report = decodeHidPlayStationExtendedReport(bytes);

    expect(bytes.byteLength).toBe(hidPlayStationExtendedReportByteLength);
    expect(hidPlayStationExtendedReportDescriptor.byteLength).toBeGreaterThan(
      0,
    );
    expect(
      hidPlayStationExtendedReportDescriptorWithRumble.byteLength,
    ).toBeGreaterThan(hidPlayStationExtendedReportDescriptor.byteLength);
    expect(report.reportId).toBe(hidPlayStationExtendedReportId);
    expect(report.touchpadPressed).toBe(true);
    expect(report.touchpadContacts[0]).toEqual({
      id: 2,
      active: true,
      x: 16384,
      y: 49151,
      pressure: 128,
    });
    expect(report.touchpadContacts[1]).toEqual({
      id: 3,
      active: true,
      x: 65535,
      y: 0,
      pressure: 255,
    });
    expect(report.accelerationZ).toBe(32767);
    expect(report.gyroscopeX).toBe(-32768);
    expect(report.gyroscopeY).toBe(16384);
    expect(report.orientationX).toBe(16384);
    expect(report.orientationY).toBe(-16384);

    await controller.disconnect();
  });

  test("streams PlayStation extended HID reports", async () => {
    const callbackReports: number[] = [];
    const adapter = new HidPlayStationExtendedReportAdapter({
      onReport({ report }) {
        callbackReports.push(report.reportId);
      },
    });
    const controller = await createController({
      profile: "playstation",
      adapter,
      replay: false,
    });

    await controller.setState({
      buttons: { X: true },
      touchpad: {
        pressed: true,
        contacts: [{ id: 2, x: 0.5, y: 0.25, pressure: 0.75 }],
      },
      motion: {
        acceleration: { x: 0.1, y: 0.2, z: 0.3 },
        gyroscope: { x: -0.1, y: -0.2, z: -0.3 },
      },
    });

    const latest = adapter.reports.at(-1);
    if (!latest) {
      throw new Error("Expected a PlayStation extended HID report");
    }
    const report = decodeHidPlayStationExtendedReport(latest.bytes);

    expect(callbackReports).toHaveLength(adapter.reports.length);
    expect(latest.bytes.byteLength).toBe(
      hidPlayStationExtendedReportByteLength,
    );
    expect(report.reportId).toBe(hidPlayStationExtendedReportId);
    expect(report.touchpadPressed).toBe(true);
    expect(report.touchpadContacts[0]).toMatchObject({
      id: 2,
      active: true,
      x: 32768,
      y: 16384,
      pressure: 191,
    });
    expect(report.accelerationZ).toBe(9830);
    expect(report.gyroscopeZ).toBe(-9830);

    await controller.disconnect();
  });

  test("surfaces PlayStation HID rumble output reports as feedback", async () => {
    const feedbackEvents: ControllerFeedbackEvent[] = [];
    const adapter = new HidPlayStationExtendedReportAdapter();
    const controller = await createController({
      id: "ps-player",
      profile: "playstation",
      adapter,
      replay: false,
    });
    controller.onFeedback((event) => {
      feedbackEvents.push(event);
    });

    const event = adapter.receiveRumbleReport(
      {
        weakMotor: 0.1,
        strongMotor: 0.2,
        leftTriggerMotor: 0.3,
        rightTriggerMotor: 0.4,
      },
      {
        timestamp: 456,
        source: "signed-host-bridge",
      },
    );

    expect(event).toMatchObject({
      type: "rumble",
      controllerId: "ps-player",
      timestamp: 456,
      weakMotor: 26 / 255,
      strongMotor: 51 / 255,
      leftTriggerMotor: 77 / 255,
      rightTriggerMotor: 102 / 255,
      source: "signed-host-bridge",
      reportFormat: "hid-gamepad-rumble",
      reportId: hidGamepadRumbleReportId,
    });
    expect(feedbackEvents).toEqual([event]);

    await controller.disconnect();
  });

  test("encodes Switch extended HID reports with motion", async () => {
    const controller = await createController({
      profile: "switch",
      adapter: "dry-run",
      replay: false,
    });

    await controller.setState({
      buttons: { A: true, PLUS: true },
      triggers: { ZR: 0.75 },
      sticks: {
        LEFT: { x: -1, y: 1 },
        RIGHT: { x: 0.5, y: -0.5 },
      },
      motion: {
        acceleration: { x: -1, y: 0, z: 1 },
        gyroscope: { x: 0.25, y: -0.25, z: 0.5 },
        orientation: { x: 0.1, y: 0.2, z: -0.3 },
      },
    });

    const bytes = encodeHidSwitchExtendedReport(controller.getState());
    const report = decodeHidSwitchExtendedReport(bytes);

    expect(bytes.byteLength).toBe(hidSwitchExtendedReportByteLength);
    expect(hidSwitchExtendedReportDescriptor.byteLength).toBeGreaterThan(0);
    expect(
      hidSwitchExtendedReportDescriptorWithRumble.byteLength,
    ).toBeGreaterThan(hidSwitchExtendedReportDescriptor.byteLength);
    expect(report.reportId).toBe(hidSwitchExtendedReportId);
    expect(report.buttons & xInputButtonBits.B).toBe(xInputButtonBits.B);
    expect(report.buttons & xInputButtonBits.START).toBe(
      xInputButtonBits.START,
    );
    expect(report.rightTrigger).toBe(191);
    expect(report.leftStickX).toBe(-32768);
    expect(report.leftStickY).toBe(-32768);
    expect(report.rightStickX).toBe(16384);
    expect(report.rightStickY).toBe(16384);
    expect(report.accelerationX).toBe(-32768);
    expect(report.accelerationZ).toBe(32767);
    expect(report.gyroscopeX).toBe(8192);
    expect(report.gyroscopeY).toBe(-8192);
    expect(report.gyroscopeZ).toBe(16384);
    expect(report.orientationX).toBe(3277);
    expect(report.orientationY).toBe(6553);
    expect(report.orientationZ).toBe(-9830);

    await controller.disconnect();
  });

  test("streams Switch extended HID reports", async () => {
    const callbackReports: number[] = [];
    const adapter = new HidSwitchExtendedReportAdapter({
      onReport({ report }) {
        callbackReports.push(report.reportId);
      },
    });
    const controller = await createController({
      profile: "switch",
      adapter,
      replay: false,
    });

    await controller.motion(
      {
        acceleration: { x: 0.1, y: 0.2, z: 0.3 },
        gyroscope: { x: -0.1, y: -0.2, z: -0.3 },
      },
      0,
    );

    const latest = adapter.reports.at(-1);
    if (!latest) {
      throw new Error("Expected a Switch extended HID report");
    }
    const report = decodeHidSwitchExtendedReport(latest.bytes);

    expect(callbackReports).toHaveLength(adapter.reports.length);
    expect(latest.bytes.byteLength).toBe(hidSwitchExtendedReportByteLength);
    expect(report.reportId).toBe(hidSwitchExtendedReportId);
    expect(report.accelerationZ).toBe(9830);
    expect(report.gyroscopeZ).toBe(-9830);

    await controller.disconnect();
  });

  test("round-trips native bridge rumble feedback messages", () => {
    const message = createNativeBridgeRumbleFeedbackMessage({
      controllerId: "player-1",
      timestamp: 123,
      weakMotor: 0.25,
      strongMotor: 1,
      leftTriggerMotor: 0,
      rightTriggerMotor: 0.5,
      durationMs: 80,
    });

    const parsed = parseNativeBridgeMessage(
      serializeNativeBridgeMessage(message),
    );
    expect(parsed.type).toBe("opencontroller.bridge.feedback");
    if (parsed.type !== "opencontroller.bridge.feedback") {
      throw new Error("Expected a native bridge feedback message");
    }
    expect(parsed.feedbackType).toBe("rumble");
    if (parsed.feedbackType !== "rumble") {
      throw new Error("Expected a native bridge rumble feedback message");
    }

    const bytes = nativeBridgeFeedbackMessageToRumbleReportBytes(parsed);
    const report = decodeHidGamepadRumbleReport(bytes);
    const feedback = nativeBridgeFeedbackMessageToControllerFeedback(parsed);

    expect(bytes.byteLength).toBe(hidGamepadRumbleReportByteLength);
    expect(report.reportId).toBe(hidGamepadRumbleReportId);
    expect(report.weakMotor).toBe(64);
    expect(report.strongMotor).toBe(255);
    expect(report.leftTriggerMotor).toBe(0);
    expect(report.rightTriggerMotor).toBe(128);
    expect(feedback).toEqual({
      type: "rumble",
      controllerId: "player-1",
      timestamp: 123,
      weakMotor: 0.25,
      strongMotor: 1,
      leftTriggerMotor: 0,
      rightTriggerMotor: 0.5,
      durationMs: 80,
      source: "native-bridge",
      reportFormat: "hid-gamepad-rumble",
      reportId: hidGamepadRumbleReportId,
      reportBase64: message.reportBase64,
    });
  });

  test("round-trips native bridge light feedback messages", () => {
    const message = createNativeBridgeLightFeedbackMessage({
      controllerId: "player-1",
      timestamp: 124,
      red: 1,
      green: 0.5,
      blue: 0.25,
      brightness: 0.75,
      playerIndex: 3,
      playerLightMask: 0b1010,
    });

    const parsed = parseNativeBridgeMessage(
      serializeNativeBridgeMessage(message),
    );
    expect(parsed.type).toBe("opencontroller.bridge.feedback");
    if (parsed.type !== "opencontroller.bridge.feedback") {
      throw new Error("Expected a native bridge feedback message");
    }
    expect(parsed.feedbackType).toBe("lights");
    if (parsed.feedbackType !== "lights") {
      throw new Error("Expected a native bridge light feedback message");
    }

    const bytes = nativeBridgeFeedbackMessageToLightReportBytes(parsed);
    const report = decodeHidGamepadLightReport(bytes);
    const feedback = nativeBridgeFeedbackMessageToControllerFeedback(parsed);

    expect(bytes.byteLength).toBe(hidGamepadLightReportByteLength);
    expect(report.reportId).toBe(hidGamepadLightReportId);
    expect(report.red).toBe(255);
    expect(report.green).toBe(128);
    expect(report.blue).toBe(64);
    expect(report.brightness).toBe(191);
    expect(report.playerIndex).toBe(3);
    expect(report.playerLightMask).toBe(0b1010);
    expect(feedback).toEqual({
      type: "lights",
      controllerId: "player-1",
      timestamp: 124,
      red: 1,
      green: 0.5,
      blue: 0.25,
      brightness: 0.75,
      playerIndex: 3,
      playerLightMask: 0b1010,
      source: "native-bridge",
      reportFormat: "hid-gamepad-lights",
      reportId: hidGamepadLightReportId,
      reportBase64: message.reportBase64,
    });
  });

  test("streams native bridge extensions for touchpad and motion", async () => {
    const lines: string[] = [];
    const adapter = new NativeBridgeAdapter({
      includeState: false,
      write(line) {
        lines.push(line);
      },
    });
    const controller = await createController({
      profile: "playstation",
      adapter,
      replay: false,
    });

    await controller.touchpad(
      {
        pressed: true,
        contacts: [{ id: 2, x: 0.25, y: 0.75, pressure: 0.5 }],
      },
      0,
    );
    await controller.motion(
      {
        acceleration: { x: 0, y: 0, z: 1 },
        gyroscope: { x: 0.1, y: 0.2, z: 0.3 },
      },
      0,
    );

    const messages = lines.map(parseNativeBridgeMessage);
    const touchpadMessage = messages.find(
      (message) =>
        message.type === "opencontroller.bridge.state" &&
        message.extensions?.touchpad,
    );
    const motionMessage = messages.find(
      (message) =>
        message.type === "opencontroller.bridge.state" &&
        message.extensions?.motion,
    );
    const profileHidMessage = messages.find(
      (message) =>
        message.type === "opencontroller.bridge.state" &&
        message.profileHidReportFormat === "hid-playstation-extended" &&
        message.profileHidReport !== undefined &&
        "touchpadContacts" in message.profileHidReport &&
        message.profileHidReport.touchpadContacts[0]?.active,
    );

    expect(touchpadMessage?.type).toBe("opencontroller.bridge.state");
    if (
      !touchpadMessage ||
      touchpadMessage.type !== "opencontroller.bridge.state"
    ) {
      throw new Error("Expected a native bridge touchpad extension message");
    }
    expect(touchpadMessage.state).toBeUndefined();
    expect(touchpadMessage.extensions?.touchpad).toEqual({
      pressed: true,
      contacts: [
        {
          id: 2,
          x: 0.25,
          y: 0.75,
          active: true,
          pressure: 0.5,
        },
      ],
    });
    expect(nativeBridgeMessageToReportBytes(touchpadMessage).byteLength).toBe(
      12,
    );
    expect(
      nativeBridgeMessageToHidGamepadReportBytes(touchpadMessage).byteLength,
    ).toBe(hidGamepadReportByteLength);

    expect(motionMessage?.type).toBe("opencontroller.bridge.state");
    if (
      !motionMessage ||
      motionMessage.type !== "opencontroller.bridge.state"
    ) {
      throw new Error("Expected a native bridge motion extension message");
    }
    expect(motionMessage.extensions?.motion).toEqual({
      acceleration: { x: 0, y: 0, z: 1 },
      gyroscope: { x: 0.1, y: 0.2, z: 0.3 },
      orientation: { x: 0, y: 0, z: 0 },
    });

    expect(profileHidMessage?.type).toBe("opencontroller.bridge.state");
    if (
      !profileHidMessage ||
      profileHidMessage.type !== "opencontroller.bridge.state"
    ) {
      throw new Error("Expected a native bridge profile HID report message");
    }
    const profileHidBytes =
      nativeBridgeMessageToProfileHidReportBytes(profileHidMessage);
    expect(profileHidBytes?.byteLength).toBe(
      hidPlayStationExtendedReportByteLength,
    );
    const profileHidReport = profileHidMessage.profileHidReport;
    if (!profileHidReport || !("touchpadContacts" in profileHidReport)) {
      throw new Error("Expected a PlayStation profile HID report");
    }
    expect(profileHidReport.touchpadContacts[0]).toEqual({
      id: 2,
      active: true,
      x: 16384,
      y: 49151,
      pressure: 128,
    });
    expect(
      decodeHidPlayStationExtendedReport(profileHidBytes ?? new Uint8Array()),
    ).toEqual(profileHidReport);

    const legacyMessage = createNativeBridgeStateMessage(
      controller.getState(),
      {
        includeExtensions: false,
        includeProfileHidReport: false,
        includeState: false,
      },
    );
    expect(legacyMessage.extensions).toBeUndefined();
    expect(legacyMessage.profileHidReport).toBeUndefined();

    const legacyLines: string[] = [];
    const legacyAdapter = new NativeBridgeAdapter({
      includeState: false,
      includeExtensions: false,
      includeProfileHidReport: false,
      write(line) {
        legacyLines.push(line);
      },
    });
    const legacyController = await createController({
      profile: "playstation",
      adapter: legacyAdapter,
      replay: false,
    });

    await legacyController.touchpad(
      {
        pressed: true,
        contacts: [{ id: 3, x: 0.5, y: 0.5, pressure: 1 }],
      },
      0,
    );

    const legacyStateMessage = legacyLines
      .map(parseNativeBridgeMessage)
      .filter((message) => message.type === "opencontroller.bridge.state")
      .at(-1);
    expect(legacyStateMessage?.type).toBe("opencontroller.bridge.state");
    if (
      !legacyStateMessage ||
      legacyStateMessage.type !== "opencontroller.bridge.state"
    ) {
      throw new Error("Expected a legacy native bridge state message");
    }
    expect(legacyStateMessage.state).toBeUndefined();
    expect(legacyStateMessage.extensions).toBeUndefined();
    expect(legacyStateMessage.profileHidReport).toBeUndefined();

    await legacyController.disconnect();
    await controller.disconnect();
  });

  test("streams native bridge status extensions without full state", async () => {
    const lines: string[] = [];
    const adapter = new NativeBridgeAdapter({
      includeState: false,
      write(line) {
        lines.push(line);
      },
    });
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.setStatus({
      battery: {
        level: 0.42,
        charging: true,
        wired: false,
        low: true,
      },
      connection: {
        quality: 0.8,
        latencyMs: 24,
        packetLoss: 0.02,
      },
    });

    const statusMessage = lines
      .map(parseNativeBridgeMessage)
      .find(
        (message) =>
          message.type === "opencontroller.bridge.state" &&
          message.extensions?.status?.battery.level === 0.42,
      );

    expect(statusMessage?.type).toBe("opencontroller.bridge.state");
    if (
      !statusMessage ||
      statusMessage.type !== "opencontroller.bridge.state"
    ) {
      throw new Error("Expected a native bridge status extension message");
    }
    expect(statusMessage.state).toBeUndefined();
    expect(statusMessage.extensions?.status).toEqual({
      battery: {
        level: 0.42,
        charging: true,
        wired: false,
        low: true,
      },
      connection: {
        quality: 0.8,
        latencyMs: 24,
        packetLoss: 0.02,
      },
    });

    const legacyMessage = createNativeBridgeStateMessage(
      controller.getState(),
      {
        includeExtensions: false,
        includeState: false,
      },
    );
    expect(legacyMessage.extensions).toBeUndefined();

    await controller.disconnect();
  });

  test("streams Switch native bridge profile HID reports", async () => {
    const lines: string[] = [];
    const adapter = new NativeBridgeAdapter({
      includeState: false,
      write(line) {
        lines.push(line);
      },
    });
    const controller = await createController({
      profile: "switch",
      adapter,
      replay: false,
    });

    await controller.motion(
      {
        acceleration: { x: 0.25, y: -0.25, z: 0.5 },
        gyroscope: { x: -0.5, y: 0.5, z: 1 },
        orientation: { x: 0.1, y: 0.2, z: 0.3 },
      },
      0,
    );

    const profileHidMessage = lines
      .map(parseNativeBridgeMessage)
      .find(
        (message) =>
          message.type === "opencontroller.bridge.state" &&
          message.profileHidReportFormat === "hid-switch-extended" &&
          message.profileHidReport?.gyroscopeZ === 32767,
      );

    expect(profileHidMessage?.type).toBe("opencontroller.bridge.state");
    if (
      !profileHidMessage ||
      profileHidMessage.type !== "opencontroller.bridge.state"
    ) {
      throw new Error("Expected a Switch native bridge profile HID message");
    }
    const profileHidBytes =
      nativeBridgeMessageToProfileHidReportBytes(profileHidMessage);
    expect(profileHidBytes?.byteLength).toBe(hidSwitchExtendedReportByteLength);
    expect(profileHidMessage.profileHidReportFormat).toBe(
      "hid-switch-extended",
    );
    expect(profileHidMessage.profileHidReport?.accelerationX).toBe(8192);
    expect(profileHidMessage.profileHidReport?.gyroscopeX).toBe(-16384);
    expect(profileHidMessage.profileHidReport?.gyroscopeZ).toBe(32767);
    expect(
      decodeHidSwitchExtendedReport(profileHidBytes ?? new Uint8Array()),
    ).toEqual(profileHidMessage.profileHidReport);

    await controller.disconnect();
  });

  test("encodes system buttons in HID gamepad reports without changing XInput reports", async () => {
    const lines: string[] = [];
    const adapter = new NativeBridgeAdapter({
      includeState: false,
      write(line) {
        lines.push(line);
      },
    });
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
      safety: {
        disabledButtons: [],
        allowGuideButton: true,
      },
    });

    await controller.press("GUIDE", 0);

    const bytes = encodeHidGamepadReport(controller.getState());
    const report = decodeHidGamepadReport(bytes);
    const messages = lines.map(parseNativeBridgeMessage);
    const guidePressed = messages.find(
      (message) =>
        message.type === "opencontroller.bridge.state" &&
        (message.hidReport?.buttons ?? 0) & hidGamepadButtonBits.HOME,
    );

    expect(report.buttons & hidGamepadButtonBits.HOME).toBe(
      hidGamepadButtonBits.HOME,
    );
    expect(guidePressed?.type).toBe("opencontroller.bridge.state");
    if (!guidePressed || guidePressed.type !== "opencontroller.bridge.state") {
      throw new Error("Expected a GUIDE-pressed native bridge state message");
    }
    expect(guidePressed.report.buttons & hidGamepadButtonBits.HOME).toBe(0);
    expect(guidePressed.hidReport?.buttons).toBe(hidGamepadButtonBits.HOME);

    await controller.disconnect();
  });

  test("streams native bridge JSONL messages", async () => {
    const lines: string[] = [];
    const adapter = new NativeBridgeAdapter({
      includeState: false,
      write(line) {
        lines.push(line);
      },
    });
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 5);

    const messages = lines.map(parseNativeBridgeMessage);
    const aPressed = messages.find(
      (message) =>
        message.type === "opencontroller.bridge.state" &&
        (message.report.buttons & xInputButtonBits.A) !== 0,
    );

    expect(aPressed?.type).toBe("opencontroller.bridge.state");
    if (!aPressed || aPressed.type !== "opencontroller.bridge.state") {
      throw new Error("Expected an A-pressed native bridge state message");
    }

    expect(aPressed.state).toBeUndefined();
    expect(nativeBridgeMessageToReportBytes(aPressed).byteLength).toBe(12);
    expect(aPressed.hidReportFormat).toBe("hid-gamepad");
    expect(aPressed.hidReport?.reportId).toBe(1);
    expect(typeof aPressed.hidReportBase64).toBe("string");
    expect(
      nativeBridgeMessageToHidGamepadReportBytes(aPressed).byteLength,
    ).toBe(hidGamepadReportByteLength);
    const {
      hidReportFormat: _hidReportFormat,
      hidReport: _hidReport,
      hidReportBase64: _hidReportBase64,
      ...legacyMessage
    } = aPressed;
    expect(
      nativeBridgeMessageToHidGamepadReportBytes(legacyMessage).byteLength,
    ).toBe(hidGamepadReportByteLength);
    expect(
      encodeHidGamepadReport(hidGamepadReportFromNativeBridgeMessage(aPressed))
        .byteLength,
    ).toBe(hidGamepadReportByteLength);

    await controller.disconnect();

    const disconnect = parseNativeBridgeMessage(lines.at(-1) ?? "");
    expect(disconnect.type).toBe("opencontroller.bridge.disconnect");
  });

  test("streams native bridge JSONL to a helper process", async () => {
    const lines: string[] = [];
    let ended = false;
    let killed = false;
    let resolveExit: (code: number) => void = () => {};
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const adapter = new NativeProcessBridgeAdapter({
      command: "opencontroller-uinput-bridge",
      args: ["--example"],
      includeState: false,
      waitForExitMs: 50,
      spawn(command, args) {
        expect(command).toBe("opencontroller-uinput-bridge");
        expect(args).toEqual(["--example"]);
        return {
          stdin: {
            write(line) {
              lines.push(line);
              return line.length;
            },
            flush() {
              return 0;
            },
            end() {
              ended = true;
              resolveExit(0);
              return 0;
            },
          },
          exited,
          kill() {
            killed = true;
            resolveExit(0);
          },
        };
      },
    });
    const controller = await createController({
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 5);
    await controller.disconnect();

    const messages = lines.map(parseNativeBridgeMessage);
    const aPressed = messages.find(
      (message) =>
        message.type === "opencontroller.bridge.state" &&
        (message.report.buttons & xInputButtonBits.A) !== 0,
    );

    expect(aPressed?.type).toBe("opencontroller.bridge.state");
    expect(messages.at(-1)?.type).toBe("opencontroller.bridge.disconnect");
    expect(ended).toBe(true);
    expect(killed).toBe(false);
  });

  test("surfaces native process feedback from helper stdout", async () => {
    const lines: string[] = [];
    const stdoutChunks: string[] = [];
    const feedbackEvents: ControllerFeedbackEvent[] = [];
    const encoder = new TextEncoder();
    let stdoutController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;
    let resolveExit: (code: number) => void = () => {};
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const stdout = new ReadableStream<Uint8Array>({
      start(controller) {
        stdoutController = controller;
      },
    });
    const adapter = new NativeProcessBridgeAdapter({
      command: "opencontroller-host-bridge",
      includeState: false,
      waitForExitMs: 50,
      supportsRumble: true,
      supportsLights: true,
      onStdout(chunk) {
        stdoutChunks.push(chunk);
      },
      spawn() {
        return {
          stdin: {
            write(line) {
              lines.push(line);
              return line.length;
            },
            flush() {
              return 0;
            },
            end() {
              resolveExit(0);
              return 0;
            },
          },
          stdout,
          exited,
          kill() {
            resolveExit(0);
          },
        };
      },
    });
    const controller = await createController({
      id: "player-1",
      profile: "xbox",
      adapter,
      replay: false,
    });
    const unsubscribe = controller.onFeedback((event) => {
      feedbackEvents.push(event);
    });

    if (!stdoutController) {
      throw new Error("Expected stdout controller to be available");
    }

    const ignored = createNativeBridgeRumbleFeedbackMessage({
      controllerId: "player-2",
      timestamp: 122,
      strongMotor: 1,
    });
    const accepted = createNativeBridgeRumbleFeedbackMessage({
      controllerId: "player-1",
      timestamp: 123,
      weakMotor: 0.5,
      strongMotor: 0.25,
      leftTriggerMotor: 0,
      rightTriggerMotor: 1,
      durationMs: 50,
    });
    const acceptedLights = createNativeBridgeLightFeedbackMessage({
      controllerId: "player-1",
      timestamp: 124,
      red: 0.1,
      green: 0.2,
      blue: 0.3,
      brightness: 0.4,
      playerIndex: 1,
      playerLightMask: 0b0010,
    });
    const acceptedLine = serializeNativeBridgeMessage(accepted);
    const acceptedLightsLine = serializeNativeBridgeMessage(acceptedLights);

    stdoutController.enqueue(
      encoder.encode(`helper ready\n${serializeNativeBridgeMessage(ignored)}`),
    );
    stdoutController.enqueue(encoder.encode(acceptedLine.slice(0, 8)));
    stdoutController.enqueue(encoder.encode(acceptedLine.slice(8)));
    stdoutController.enqueue(encoder.encode(acceptedLightsLine));

    await waitFor(() => feedbackEvents.length === 2);

    expect(controller.capabilities().supportsRumble).toBe(true);
    expect(controller.capabilities().supportsLights).toBe(true);
    expect(stdoutChunks.join("")).toContain("helper ready");
    expect(feedbackEvents[0]).toMatchObject({
      type: "rumble",
      controllerId: "player-1",
      timestamp: 123,
      weakMotor: 0.5,
      strongMotor: 0.25,
      leftTriggerMotor: 0,
      rightTriggerMotor: 1,
      durationMs: 50,
      source: "native-bridge",
    });
    expect(feedbackEvents[1]).toMatchObject({
      type: "lights",
      controllerId: "player-1",
      timestamp: 124,
      red: 0.1,
      green: 0.2,
      blue: 0.3,
      brightness: 0.4,
      playerIndex: 1,
      playerLightMask: 0b0010,
      source: "native-bridge",
    });

    unsubscribe();
    stdoutController.close();
    await controller.disconnect();
    expect(lines.at(-1)).toContain("opencontroller.bridge.disconnect");
  });

  test("writes replay command events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opencontroller-replay-"));
    cleanupDirs.push(dir);
    const controller = await createController({
      profile: "playstation",
      adapter: "dry-run",
      replay: {
        dir,
      },
    });

    await controller.press("X", 5);
    await controller.disconnect();

    const events = await readFile(join(dir, "events.jsonl"), "utf8");
    expect(events).toContain('"type":"command"');
    expect(events).toContain('"button":"CROSS"');
  });

  test("tracks and replays host feedback output state once per event", async () => {
    const dir = await mkdtemp(
      join(tmpdir(), "opencontroller-feedback-replay-"),
    );
    cleanupDirs.push(dir);
    const adapter = new HidGamepadReportAdapter();
    const controller = await createController({
      id: "feedback-player",
      profile: "xbox",
      adapter,
      replay: {
        dir,
      },
    });
    const listenerFeedbackEvents: ControllerFeedbackEvent[] = [];
    const unsubscribeA = controller.onFeedback((event) => {
      listenerFeedbackEvents.push(event);
    });
    const unsubscribeB = controller.onFeedback((event) => {
      listenerFeedbackEvents.push(event);
    });

    const rumble = adapter.receiveRumbleReport(
      {
        weakMotor: 1,
        strongMotor: 0.5,
        leftTriggerMotor: 0.25,
        rightTriggerMotor: 0,
      },
      { timestamp: 200, durationMs: 90 },
    );
    const lights = adapter.receiveLightReport(
      {
        red: 0.25,
        green: 0.5,
        blue: 1,
        brightness: 0.75,
        playerIndex: 4,
        playerLightMask: 0b1111,
      },
      { timestamp: 201 },
    );

    expect(listenerFeedbackEvents).toEqual([rumble, rumble, lights, lights]);
    expect(controller.getState().feedback.rumble).toMatchObject({
      active: true,
      weakMotor: 1,
      strongMotor: 128 / 255,
      leftTriggerMotor: 64 / 255,
      rightTriggerMotor: 0,
      updatedAt: 200,
      durationMs: 90,
    });
    expect(controller.getState().feedback.lights).toMatchObject({
      active: true,
      red: 64 / 255,
      green: 128 / 255,
      blue: 1,
      brightness: 191 / 255,
      playerIndex: 4,
      playerLightMask: 0b1111,
      updatedAt: 201,
    });

    const feedbackPath = join(dir, "feedback.jsonl");
    await waitFor(
      () =>
        existsSync(feedbackPath) &&
        readFileSync(feedbackPath, "utf8").includes('"type":"lights"'),
    );
    const feedbackLines = readFileSync(feedbackPath, "utf8").trim().split("\n");
    expect(feedbackLines).toHaveLength(2);
    expect(feedbackLines[0]).toContain('"type":"feedback"');
    expect(feedbackLines[0]).toContain('"feedback":{"type":"rumble"');
    expect(feedbackLines[1]).toContain('"feedback":{"type":"lights"');
    expect(feedbackLines[1]).toContain('"stateAfter"');

    unsubscribeA();
    unsubscribeB();
    await controller.disconnect();
  });

  test("runs semantic action maps", async () => {
    const controller = await createController({
      profile: "xbox",
      adapter: "dry-run",
      replay: false,
    });
    const actions = createActionMap(controller, {
      interact: [{ type: "press", button: "A", durationMs: 5 }],
    });

    await actions.run("interact");

    expect(actions.list()).toEqual(["interact"]);
    expect(controller.getState().buttons.A).toBe(false);

    await controller.disconnect();
  });

  test("manages multiple controllers through a hub", async () => {
    const hub = await createControllerHub({
      controllers: [
        {
          id: "player-1",
          profile: "xbox",
          adapter: "dry-run",
          replay: false,
        },
        {
          id: "player-2",
          profile: "xbox",
          adapter: "dry-run",
          replay: false,
        },
      ],
    });

    await hub.get("player-1").press("A", 5);
    await hub.get("player-2").press("X", 5);

    expect(hub.list()).toEqual(["player-1", "player-2"]);
    expect(hub.states()["player-1"]?.profile).toBe("xbox");
    expect(hub.states()["player-2"]?.profile).toBe("xbox");

    await hub.disconnectAll();
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > 500) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
