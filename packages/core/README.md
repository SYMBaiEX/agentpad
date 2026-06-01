# @opencontroller/core

Core runtime for OpenController virtual controller control.

This package gives AI agents a typed controller API, state management, safety
guards, replay logging, semantic action maps, controller hubs, browser and
WebSocket adapters, and native bridge message helpers.

## Install

```bash
npm install @opencontroller/core
```

## Quick Start

```ts
import { createController } from "@opencontroller/core";

const controller = await createController({
  id: "agent-1",
  profile: "xbox",
  adapter: "dry-run",
});

await controller.press("A", 0.2);
await controller.moveStick("left", { x: 0.75, y: 0 });
await controller.neutral();
await controller.disconnect();
```

## Multi-Controller Hubs

```ts
import { createControllerHub } from "@opencontroller/core";

const hub = await createControllerHub();

const playerOne = await hub.createController({
  id: "player-1",
  profile: "xbox",
  adapter: "dry-run",
});

const playerTwo = await hub.createController({
  id: "player-2",
  profile: "xbox",
  adapter: "dry-run",
});

await playerOne.press("A", 0.1);
await playerTwo.press("B", 0.1);
await hub.disconnectAll();
```

## Touchpad And Motion

```ts
const playstation = await createController({
  id: "ps-agent",
  profile: "playstation",
  adapter: "websocket",
  url: "ws://localhost:7777/controller",
});

await playstation.touchpad({
  pressed: true,
  contacts: [{ id: 0, x: 0.5, y: 0.25 }],
});

await playstation.motion({
  acceleration: { x: 0, y: 0, z: 1 },
  gyroscope: { x: 0, y: 0.1, z: 0 },
});
```

Touchpad and motion state are available to dry-run and WebSocket integrations.
The current native XInput/HID report helpers still encode the common gamepad
subset, so inspect `controller.capabilities()` before assuming a backend carries
touch or sensor channels.

## Capability Metadata

```ts
const capabilities = controller.capabilities();

console.log(capabilities.supportedProfiles);
console.log(capabilities.outputFormats);
console.log(capabilities.reportFormats);

if (capabilities.feedbackTypes.includes("rumble")) {
  controller.onFeedback((event) => {
    console.log(event.weakMotor, event.strongMotor);
  });
}
```

Use capability metadata to select a backend before starting an agent run. Native
host bridge adapters report whether they are helper-only or an
`os-virtual-gamepad` path, which report formats they emit, and which feedback
channels they can surface back to agents.

## Entry Points

- `@opencontroller/core`: runtime, controllers, hubs, profiles, safety, replay
- `@opencontroller/core/profiles`: Xbox, PlayStation, Switch, and generic HID profiles
- `@opencontroller/core/adapters`: dry-run, WebSocket, XInput report, native bridge, native process adapters
- `@opencontroller/core/actions`: semantic action maps and presets
- `@opencontroller/core/bridge`: JSONL native bridge protocol helpers
- `@opencontroller/core/hid`: HID and XInput report encoding helpers
- `@opencontroller/core/browser`: browser-safe runtime helpers

## Native Bridge Output

The native bridge helpers emit JSONL messages such as
`opencontroller.bridge.state`, `opencontroller.bridge.feedback`, and
`opencontroller.bridge.disconnect`. State messages include XInput/HID payloads,
PlayStation profile HID payloads for touchpad/motion data, and optional
touchpad/motion `extensions`. Platform packages consume those messages to drive
Linux `uinput`, Windows VHF, or macOS DriverKit host bridges.

OpenController keeps privileged driver installation outside the core runtime.
The core package focuses on deterministic controller state, command safety,
portable reports, and replayable agent behavior.
