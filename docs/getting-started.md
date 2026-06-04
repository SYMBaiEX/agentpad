# Getting Started

Install dependencies and run the checks:

```bash
bun install
bun test
bun run build
```

Create a dry-run controller:

```ts
import { createController } from "@opencontroller/core";

const controller = await createController({
  profile: "xbox",
  adapter: "dry-run"
});

await controller.press("A", 100);
await controller.press("RT", { durationMs: 120, pressure: 0.35 });
await controller.moveStick("LEFT", { x: 0, y: -1 }, 300);
await controller.setButton("LB", true);
await controller.setTrigger("RT", 0.25);
await controller.setDpad("UP_RIGHT");
await controller.setState({
  buttons: { LB: true },
  triggers: { RT: 0.1 },
  sticks: { LEFT: { x: 0.4, y: 0 } },
  dpad: "NEUTRAL"
});
await controller.setButton("LB", false);
await controller.neutral();
await controller.disconnect();
```

Dry-run is the default adapter because it requires no native permissions and
still updates state, safety, and replay logs.

Timed helpers such as `press`, `moveStick`, `trigger`, and `dpad` return to
neutral after their duration. Stateful helpers such as `setButton`, `setStick`,
`setTrigger`, and `setDpad` hold their values until the same control changes or
the controller is neutralized. `setState` applies a partial multi-control patch
as one command, which is useful when an agent emits a complete control decision
for a single frame or planning tick.

When you are ready to target a real OS virtual controller bridge, use the
unified native package:

```ts
import { createController } from "@opencontroller/core";
import { createNativeHostBridgeAdapter } from "@opencontroller/native";

const controller = await createController({
  profile: "xbox",
  adapter: createNativeHostBridgeAdapter(),
  replay: false
});
```

That adapter selects Linux `uinput`, Windows VHF, or macOS DriverKit for the
current host. The native helper/driver still needs to be installed and trusted
outside the TypeScript runtime.
