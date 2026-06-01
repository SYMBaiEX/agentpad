import { createController } from "@agentpad/core";

const server = Bun.serve({
  port: 7777,
  fetch(request, serverInstance) {
    if (serverInstance.upgrade(request)) {
      return undefined;
    }
    return new Response(
      "AgentPad WebSocket bridge listening on ws://localhost:7777/controller",
    );
  },
  websocket: {
    message(_ws, message) {
      console.log("bridge received", message.toString());
    },
  },
});

const controller = await createController({
  profile: "xbox",
  adapter: "websocket",
  url: `ws://${server.hostname}:${server.port}/controller`,
  replay: false,
});

await controller.press("A", 100);
await controller.moveStick("LEFT", { x: 0, y: -1 }, 200);
await controller.neutral();
await controller.disconnect();

server.stop(true);
