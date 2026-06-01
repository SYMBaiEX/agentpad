import { createController } from "@agentpad/core";
import { createOverlayServer } from "@agentpad/overlay/server";

const controller = await createController({
  profile: "xbox",
  adapter: "dry-run",
  replay: false,
});

const overlay = await createOverlayServer({
  profile: "xbox",
  port: 4317,
  theme: "transparent",
  controller,
});

console.log(`OBS browser source: ${overlay.url}`);

setInterval(() => {
  void controller.sequence([
    { type: "press", button: "A", durationMs: 100 },
    { type: "trigger", trigger: "RT", value: Math.random(), durationMs: 200 },
    {
      type: "stick",
      stick: "LEFT",
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      durationMs: 300,
    },
  ]);
}, 1200);
