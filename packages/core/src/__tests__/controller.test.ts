import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DryRunAdapter,
  NativeBridgeAdapter,
  NativeProcessBridgeAdapter,
  XInputReportAdapter,
  createActionMap,
  createController,
  createControllerHub,
  decodeHidGamepadReport,
  decodeXInputReport,
  encodeHidGamepadReport,
  hidGamepadButtonBits,
  hidGamepadReportByteLength,
  hidGamepadReportDescriptor,
  hidGamepadReportFromNativeBridgeMessage,
  nativeBridgeMessageToHidGamepadReportBytes,
  nativeBridgeMessageToReportBytes,
  parseNativeBridgeMessage,
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
