import { NativeBridgeAdapter, createController } from "@opencontroller/core";

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

await controller.press("A", 80);
await controller.moveStick("LEFT", { x: 0, y: -1 }, 120);
await controller.trigger("RT", 0.5, 90);
await controller.neutral();
await controller.disconnect();

for (const line of lines) {
  process.stdout.write(line);
}
