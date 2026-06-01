import { NativeBridgeAdapter, createController } from "@opencontroller/core";

export type BridgeCommandOptions = {
  id?: string;
};

export async function bridgeCommand(
  options: BridgeCommandOptions,
): Promise<void> {
  const adapter = new NativeBridgeAdapter({
    includeState: false,
    write(line) {
      process.stdout.write(line);
    },
  });

  const controller = await createController({
    id: options.id ?? "player-1",
    profile: "xbox",
    adapter,
    replay: false,
  });

  await controller.press("A", 80);
  await controller.moveStick("LEFT", { x: 0, y: -1 }, 120);
  await controller.trigger("RT", 0.5, 90);
  await controller.neutral();
  await controller.disconnect();
}
