import {
  createActionMap,
  createController,
  xboxActionPreset,
} from "@agentpad/core";

const controller = await createController({
  profile: "xbox",
  adapter: "dry-run",
  replay: {
    source: "basic-dry-run-example",
  },
});

const actions = createActionMap(controller, xboxActionPreset);

await controller.press("A", 100, { intent: "interact" });
await controller.moveStick("LEFT", { x: 0, y: -1 }, 250, {
  intent: "move_forward",
});
await actions.run("dodge");
await controller.neutral();

console.log(controller.getState());

await controller.disconnect();
