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
await controller.moveStick("LEFT", { x: 0, y: -1 }, 300);
await controller.neutral();
await controller.disconnect();
```

Dry-run is the default adapter because it requires no native permissions and
still updates state, safety, and replay logs.

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
