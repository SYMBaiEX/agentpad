import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DryRunAdapter,
  createActionMap,
  createController,
  createControllerHub,
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

  test("writes replay command events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentpad-replay-"));
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
