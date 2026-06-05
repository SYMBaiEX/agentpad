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

await controller.press("A", 80);
await controller.press("RT", { durationMs: 120, pressure: 0.5 });
await controller.moveStick("LEFT", { x: 0.75, y: 0 });
await controller.setButton("LB", true);
await controller.setTrigger("RT", 0.25);
await controller.setDpad("UP_RIGHT");
await controller.setState({
  buttons: { LB: true },
  triggers: { RT: 0.1 },
  sticks: { LEFT: { x: 0.4, y: 0 } },
  dpad: "NEUTRAL",
});
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

await playerOne.press("A", 80);
await playerTwo.press("B", 80);
await hub.disconnectAll();
```

## Analog Button Pressure

```ts
await controller.press("RT", {
  durationMs: 120,
  pressure: 0.35,
  context: { intent: "feather_throttle" },
});
```

`press` still supports the original `press(button, durationMs, context)` form.
Use the object form when an agent needs analog pressure on a button. Pressure is
normalized to `0..1`, stored in `state.analogButtons`, included in replay/native
bridge state, and mapped into XInput/HID trigger bytes for trigger-like buttons.
Plain binary presses on trigger-like buttons, such as `press("RT", 0)`, map to a
full analog pull.

Direct D-pad button presses also keep the structured D-pad state synchronized:

```ts
await controller.press("DPAD_UP", 0);

console.log(controller.getState().buttons.DPAD_UP);
console.log(controller.getState().dpad.up);
```

The D-pad helper supports cardinal and diagonal directions. Diagonals are stored
as combined cardinal state and encode as combined D-pad report bits:

```ts
await controller.dpad("UP_RIGHT", 120);
```

## Persistent Controller State

Timed helpers are great for taps and nudges. For agent policies that plan across
several ticks, use the stateful helpers instead:

```ts
await controller.setButton("LB", true);
await controller.setStick("LEFT", { x: 0.6, y: -0.25 });
await controller.setTrigger("RT", 0.4);
await controller.setDpad("UP_RIGHT");

// Later, release or reset only the controls you intended to change.
await controller.setDpad("NEUTRAL");
await controller.setButton("LB", false);
```

These commands do not auto-release. They update `controller.getState()`, replay
logs, WebSocket state messages, XInput/HID report adapters, and native bridge
JSONL state snapshots until another command changes the same control or
`controller.neutral()` resets everything.

When one agent decision changes several controls, send a single atomic patch:

```ts
await controller.setState({
  buttons: {
    LB: true,
    A: false,
  },
  triggers: {
    RT: 0.35,
  },
  sticks: {
    LEFT: { x: 0.5, y: -0.2 },
  },
  dpad: "NEUTRAL",
});
```

`setState` accepts a partial patch. Omitted controls keep their current values,
and the runtime emits one normalized command, one replay entry, and one state
sync snapshot.

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

## Report Adapters

```ts
import {
  HidGamepadReportAdapter,
  HidPlayStationExtendedReportAdapter,
  XInputReportAdapter
} from "@opencontroller/core";

const xinput = new XInputReportAdapter({
  onReport({ bytes }) {
    console.log("xinput", bytes);
  },
});

const hid = new HidGamepadReportAdapter({
  onReport({ bytes }) {
    console.log("hid", bytes);
  },
  onFeedback(event) {
    console.log("hid rumble", event.weakMotor, event.strongMotor);
  },
});

const playstation = new HidPlayStationExtendedReportAdapter({
  onReport({ bytes }) {
    console.log("playstation", bytes);
  },
});
```

Use `xinput-report` for the compact 12-byte XInput compatibility payload,
`hid-gamepad-report` for the 13-byte descriptor-backed generic HID gamepad
payload, and `hid-playstation-extended-report` for the 47-byte PlayStation
profile payload that carries touchpad contacts and motion vectors. The HID
report adapters also accept the shared 5-byte rumble output report through
`adapter.receiveOutputReport(bytes)` and surface it through
`controller.onFeedback(...)`.

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
