import { type ControllerProfileName, createController } from "@agentpad/core";
import {
  type OverlayThemeName,
  createOverlayServer,
} from "@agentpad/overlay/server";

export type OverlayCommandOptions = {
  profile?: string;
  port?: string;
  theme?: string;
};

export async function overlayCommand(
  options: OverlayCommandOptions,
): Promise<void> {
  const profile = (options.profile ?? "xbox") as Exclude<
    ControllerProfileName,
    "keyboard-mouse"
  >;
  const port = Number.parseInt(options.port ?? "4317", 10);
  const theme = (options.theme ?? "transparent") as OverlayThemeName;
  const controller = await createController({
    profile,
    adapter: "dry-run",
    replay: false,
  });
  const server = await createOverlayServer({
    profile,
    port,
    theme,
    controller,
  });

  console.log(`AgentPad overlay running at ${server.url}`);

  const interval = setInterval(() => {
    void demoTick(controller, profile);
  }, 1400);

  process.on("SIGINT", async () => {
    clearInterval(interval);
    server.stop();
    await controller.disconnect();
    process.exit(0);
  });

  await new Promise(() => undefined);
}

async function demoTick(
  controller: Awaited<ReturnType<typeof createController>>,
  profile: Exclude<ControllerProfileName, "keyboard-mouse">,
): Promise<void> {
  if (profile === "playstation") {
    await controller.press("CROSS", 120);
    await controller.trigger("R2", Math.random(), 180);
  } else {
    await controller.press("A", 120);
    await controller.trigger("RT", Math.random(), 180);
  }
  await controller.moveStick(
    "LEFT",
    { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 },
    220,
  );
}
