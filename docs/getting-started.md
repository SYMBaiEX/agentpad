# Getting Started

Install dependencies and run the checks:

```bash
bun install
bun test
bun run build
```

Create a dry-run controller:

```ts
import { createController } from "@agentpad/core";

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
