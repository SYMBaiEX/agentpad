import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ControllerFeedbackEvent,
  DryRunAdapter,
  NativeBridgeAdapter,
  NativeProcessBridgeAdapter,
  WebSocketAdapter,
  XInputReportAdapter,
  createActionMap,
  createController,
  createControllerHub,
  createNativeBridgeRumbleFeedbackMessage,
  decodeHidGamepadReport,
  decodeHidGamepadRumbleReport,
  decodeXInputReport,
  encodeHidGamepadReport,
  encodeHidGamepadRumbleReport,
  hidGamepadButtonBits,
  hidGamepadReportByteLength,
  hidGamepadReportDescriptor,
  hidGamepadReportDescriptorWithRumble,
  hidGamepadReportFromNativeBridgeMessage,
  hidGamepadRumbleOutputReportDescriptor,
  hidGamepadRumbleReportByteLength,
  hidGamepadRumbleReportId,
  nativeBridgeFeedbackMessageToControllerFeedback,
  nativeBridgeFeedbackMessageToRumbleReportBytes,
  nativeBridgeMessageToHidGamepadReportBytes,
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
      virtualDeviceKind: "os-virtual-gamepad",
    }).capabilities();

    expect(dryRun.supportedProfiles).toContain("keyboard-mouse");
    expect(dryRun.supportedCommands).toContain("combo");
    expect(dryRun.supportedCommands).toContain("touchpad");
    expect(dryRun.supportedCommands).toContain("motion");
    expect(dryRun.supportsTouchpad).toBe(true);
    expect(dryRun.supportsGyro).toBe(true);
    expect(dryRun.outputFormats).toEqual([
      "normalized-command",
      "controller-state",
    ]);
    expect(dryRun.transport).toBe("memory");
    expect(dryRun.virtualDeviceKind).toBe("none");

    expect(websocket.outputFormats).toContain("websocket-json");
    expect(websocket.supportsTouchpad).toBe(true);
    expect(websocket.supportsGyro).toBe(true);
    expect(websocket.transport).toBe("websocket");

    expect(xinput.reportFormats).toEqual(["xinput"]);
    expect(xinput.supportsTouchpad).toBe(false);
    expect(xinput.supportsGyro).toBe(false);
    expect(xinput.outputFormats).toContain("xinput-report");

    expect(nativeBridge.outputFormats).toContain("native-bridge-jsonl");
    expect(nativeBridge.reportFormats).toEqual(["xinput", "hid-gamepad"]);
    expect(nativeBridge.supportedCommands).not.toContain("touchpad");
    expect(nativeBridge.supportedCommands).not.toContain("motion");
    expect(nativeBridge.supportsTouchpad).toBe(false);
    expect(nativeBridge.supportsGyro).toBe(false);

    expect(nativeProcess.supportsVirtualDevice).toBe(true);
    expect(nativeProcess.supportsRumble).toBe(true);
    expect(nativeProcess.feedbackTypes).toEqual(["rumble"]);
    expect(nativeProcess.reportFormats).toContain("hid-gamepad-rumble");
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

  test("surfaces native process rumble feedback from helper stdout", async () => {
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
    const acceptedLine = serializeNativeBridgeMessage(accepted);

    stdoutController.enqueue(
      encoder.encode(`helper ready\n${serializeNativeBridgeMessage(ignored)}`),
    );
    stdoutController.enqueue(encoder.encode(acceptedLine.slice(0, 8)));
    stdoutController.enqueue(encoder.encode(acceptedLine.slice(8)));

    await waitFor(() => feedbackEvents.length === 1);

    expect(controller.capabilities().supportsRumble).toBe(true);
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
