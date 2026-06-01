import {
  type AdapterName,
  type ControllerProfileName,
  createController,
} from "@opencontroller/core";

export type TestCommandOptions = {
  profile?: string;
  adapter?: string;
  url?: string;
};

export async function testCommand(options: TestCommandOptions): Promise<void> {
  const profile = (options.profile ?? "xbox") as ControllerProfileName;
  const adapter = (options.adapter ?? "dry-run") as AdapterName;

  const controller = await createController({
    profile,
    adapter,
    replay: {
      enabled: true,
      source: "opencontroller-cli-test",
    },
    ...(options.url ? { url: options.url } : {}),
  });

  await controller.press(profile === "playstation" ? "CROSS" : "A", 80, {
    intent: "test_press",
    source: "opencontroller-cli",
  });
  await controller.moveStick("LEFT", { x: 0, y: -1 }, 120, {
    intent: "test_move",
    source: "opencontroller-cli",
  });
  await controller.trigger(profile === "playstation" ? "R2" : "RT", 0.5, 90, {
    intent: "test_trigger",
    source: "opencontroller-cli",
  });
  await controller.neutral({
    intent: "test_neutral",
    source: "opencontroller-cli",
  });

  const state = controller.getState();
  await controller.disconnect();

  console.log("OpenController test completed");
  console.log(JSON.stringify({ profile, adapter, state }, null, 2));
}
