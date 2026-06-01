# OpenController

[![CI](https://github.com/SYMBaiEX/OpenController/actions/workflows/ci.yml/badge.svg)](https://github.com/SYMBaiEX/OpenController/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/SYMBaiEX/OpenController)](https://github.com/SYMBaiEX/OpenController/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OpenController is a Bun-first TypeScript SDK for giving AI agents a real
controller interface.

Instead of building one-off tools for every game, simulator, overlay, emulator,
or browser app, OpenController exposes a small typed API that feels like a gamepad:
press buttons, move sticks, pull triggers, run combos, stream controller state,
record replays, and visualize what happened.

The goal is simple: make controller input a clean, inspectable, reusable
software primitive for local agents and experiments.

```ts
import { createController } from "@opencontroller/core";

const controller = await createController({
  profile: "xbox",
  adapter: "dry-run"
});

await controller.press("A", 100);
await controller.moveStick("LEFT", { x: 0, y: -1 }, 500);
await controller.trigger("RT", 0.5, 200);
await controller.neutral();
await controller.disconnect();
```

## Why This Exists

AI agents need a better input layer than brittle app-specific scripts. A
controller is already the shared language for games, emulators, robotics
simulators, browser experiments, overlays, accessibility tooling, and testing
harnesses.

OpenController turns that language into an SDK:

- agent code can express intent as controller actions
- apps can consume input through a stable state stream
- replays can show exactly what the agent did
- safety policies can constrain dangerous or repetitive input
- native bridge processes can translate state into virtual device reports

The long-term aim is full virtual controller emulation with a clean TypeScript
developer experience on top.

## What You Get

- Typed controller runtime for Xbox, PlayStation, Switch, generic HID, and keyboard/mouse-style profiles
- Safety guardrails for rate limits, max hold durations, disabled buttons, repeated input loops, and neutral-on-error behavior
- Replay logs for commands, state snapshots, annotations, and errors
- Adapter model with dry-run, WebSocket, XInput report, native bridge, and native process output backends
- XInput-compatible binary report encoding for native virtual-device bridges
- Canonical HID gamepad report descriptor and input report encoder
- Versioned JSONL native bridge protocol with XInput and HID report payloads
- Controller hub for managing multiple virtual controllers
- React and OBS-friendly overlays for showing controller state
- CLI commands for doctor, native backend doctor, test, overlay, replay, and starter action maps
- A playable two-agent browser fighting game demo

OpenController is designed for local agents, accessibility tooling, testing,
research, plugins, emulators, stream overlays, and controlled single-player
experiments. It is not intended for anti-cheat bypasses, stealth automation, or
online competitive game automation.

## Where It Stands

OpenController is ready to use as a source SDK today. The core runtime, package
layout, CLI, overlays, examples, docs, CI, release notes, and npm package
manifests are in place.

The SDK surface is complete enough for local builds, demos, browser games,
WebSocket integrations, overlays, replay capture, and native bridge prototyping.
It is not yet a full cross-platform native virtual controller driver stack. The
current emulation boundary is the adapter layer, XInput-compatible binary report
encoding, a descriptor-backed HID gamepad report format, a versioned JSONL
protocol for native bridge processes, the first Linux `uinput` bridge package,
and Windows XUSB compatibility helpers. The next milestone is wiring that HID
contract into maintained Windows virtual HID and macOS DriverKit-compatible
flows.

If you are evaluating it for another project, use it now for controller-state
or command-stream integrations. Linux users can start testing the `uinput`
bridge. Windows users can inspect VHF/HID assets, legacy ViGEmBus compatibility,
and XUSB report mapping. macOS users can generate DriverKit HID assets and check
local signing/tool readiness.

## Try Agent Fighter

Agent Fighter is the flagship demo: two autonomous agents drive two separate
OpenController channels and fight inside a browser game. The game reads
controller state only, so the agents interact through the same input surface a
player would.

```bash
bun install
bun run dev:fighter
```

Open the game:

```txt
http://127.0.0.1:5173/
```

Open the controller telemetry panel:

```txt
http://127.0.0.1:5173/controllers
```

Agents start stopped by default. Use the telemetry panel to start, stop, and
reset the duel.

If `OPENAI_API_KEY` is present, Agent Fighter uses the OpenAI Responses API for
agent decisions. Without a key, local policies drive the same controller
channels, so the demo still works offline.

## Packages

| Package | Purpose |
| --- | --- |
| `@opencontroller/core` | Controller runtime, profiles, adapters, safety, state, replay logs |
| `@opencontroller/overlay` | React overlays, canvas rendering helpers, OBS browser-source server |
| `@opencontroller/cli` | Doctor, test, overlay, replay, and init commands |
| `@opencontroller/native-linux-uinput` | Linux `/dev/uinput` bridge helper and event mapping |
| `@opencontroller/native-windows-virtual-gamepad` | Windows VHF/HID assets, XUSB helpers, and legacy ViGEmBus diagnostics |
| `@opencontroller/native-macos-driverkit` | macOS DriverKit HID assets and local authoring diagnostics |

## Install

OpenController is currently published as a source release on GitHub. The package
manifests are prepared for npm, but the packages are not published yet.

Once published:

```bash
npm install @opencontroller/core
```

For overlays:

```bash
npm install @opencontroller/core @opencontroller/overlay
```

For CLI workflows:

```bash
npm install -D @opencontroller/cli
```

For Linux native bridge work:

```bash
npm install @opencontroller/core @opencontroller/native-linux-uinput
```

For Windows virtual gamepad compatibility work:

```bash
npm install @opencontroller/core @opencontroller/native-windows-virtual-gamepad
```

For macOS DriverKit virtual HID work:

```bash
npm install @opencontroller/core @opencontroller/native-macos-driverkit
```

Important npm note: these packages are configured for the `@opencontroller`
scope. Before publishing, confirm ownership of that npm scope or rename the
packages to an owned scope such as `@symbaiex/*`.

## SDK Surface

The core package exports:

- `createController` for a single virtual controller runtime
- `createControllerHub` for multi-controller sessions
- built-in profiles for common controller families
- dry-run, WebSocket, and XInput report adapters
- native process bridge adapter for helper processes
- native bridge JSONL protocol helpers with direct HID report bytes
- safety policies and replay logging
- XInput report helpers from `@opencontroller/core/hid`
- HID gamepad report descriptor and report helpers from `@opencontroller/core/hid`
- bridge helpers from `@opencontroller/core/bridge`
- profile, action-map, and browser-friendly entry points

The Linux native package adds:

- OpenController JSONL to Linux event mapping
- host diagnostics for `/dev/uinput`, module, and permission readiness
- C helper source for `/dev/uinput`
- build helper for producing `opencontroller-uinput-bridge`

The Windows native package adds:

- VHF-ready HID descriptor and input report helpers
- INF, WDK C source, host bridge C source, C-array asset generators, and a host bridge adapter factory for a maintained Windows VHF driver path
- XUSB report helpers
- legacy ViGEmBus service diagnostics
- `opencontroller-windows-gamepad-doctor`

The macOS native package adds:

- DriverKit-ready HID descriptor and input report helpers
- Info.plist and entitlement templates for a virtual HID gamepad dext
- C++ DriverKit source and byte-array asset generation
- `opencontroller-macos-driverkit-doctor`

### Core API

```ts
const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: "websocket",
  url: "ws://127.0.0.1:5173/controller",
  replay: {
    enabled: true,
    source: "my-agent"
  },
  safety: {
    maxCommandsPerSecond: 20,
    maxButtonHoldMs: 1000,
    disabledButtons: ["GUIDE", "START"]
  }
});

await controller.press("X", 80, { intent: "light_attack" });
await controller.combo(["A", "X"], 60, 20, { intent: "jump_attack" });
await controller.moveStick("LEFT", { x: 1, y: 0 }, 250);
await controller.neutral();
```

### Multiple Controllers

```ts
import { createControllerHub } from "@opencontroller/core";

const hub = await createControllerHub({
  controllers: [
    { id: "player-1", profile: "xbox", adapter: "dry-run" },
    { id: "player-2", profile: "xbox", adapter: "dry-run" }
  ]
});

await hub.get("player-1").press("A", 80);
await hub.get("player-2").press("X", 80);

console.log(hub.states());
await hub.disconnectAll();
```

### XInput Reports

```ts
import {
  XInputReportAdapter,
  createController,
  decodeXInputReport
} from "@opencontroller/core";

const adapter = new XInputReportAdapter({
  onReport(report) {
    const decoded = decodeXInputReport(report.bytes);
    console.log(decoded);
  }
});

const controller = await createController({ profile: "xbox", adapter });
await controller.press("A", 80);
```

XInput reports are the handoff point for native bridge processes. They do not
install a driver by themselves, but they provide the packed state a driver or
local bridge needs.

### HID Gamepad Reports

```ts
import {
  encodeHidGamepadReport,
  hidGamepadReportDescriptor
} from "@opencontroller/core/hid";

const descriptor = hidGamepadReportDescriptor;
const bytes = encodeHidGamepadReport(controller.getState());
```

HID reports are the handoff point for descriptor-backed virtual device APIs.
The report shape includes 16 buttons, four signed stick axes, and two trigger
axes. See [HID Gamepad Reports](docs/hid-gamepad-reports.md).

### Native Bridge JSONL

```ts
import { NativeBridgeAdapter, createController } from "@opencontroller/core";

const adapter = new NativeBridgeAdapter({
  includeState: false,
  write(line) {
    process.stdout.write(line);
  }
});

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter,
  replay: false
});

await controller.press("A", 80);
await controller.disconnect();
```

Each line is a versioned bridge message containing the controller id, profile,
diagnostic report fields, and base64-encoded XInput/HID report bytes. Native
bridge processes can consume the same stream over stdio, pipes, sockets, or any
ordered byte transport.

### Native Process Helpers

```ts
import {
  NativeProcessBridgeAdapter,
  createController
} from "@opencontroller/core";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: new NativeProcessBridgeAdapter({
    command: "/home/me/.opencontroller/bin/opencontroller-uinput-bridge",
    includeState: false
  }),
  replay: false
});

await controller.press("A", 80);
await controller.disconnect();
```

Linux projects can use the package-level helper instead of wiring the process
adapter manually:

```ts
import { createController } from "@opencontroller/core";
import {
  createLinuxUinputBridgeAdapter
} from "@opencontroller/native-linux-uinput";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createLinuxUinputBridgeAdapter(),
  replay: false
});
```

This adapter spawns a helper process, streams native bridge JSONL to stdin,
sends a disconnect message, closes stdin, and surfaces non-zero helper exits.

### Linux uinput

```bash
bun --cwd packages/native-linux-uinput build
bun packages/native-linux-uinput/dist/bin/build-helper.js
opencontroller-linux-uinput-doctor
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --dry-run
```

The Linux helper reads the native bridge JSONL stream, creates an
`OpenController Virtual Gamepad` through `/dev/uinput`, emits Linux gamepad
events, and destroys the device when the stream closes. It prefers the direct
HID payload and keeps XInput fallback for older streams. Dry-run mode decodes
the same stream without opening `/dev/uinput`. Real device mode requires Linux
and write access to `/dev/uinput`.

### React Overlay

```tsx
import { ControllerOverlay } from "@opencontroller/overlay";

export function GamepadHud({ state }) {
  return <ControllerOverlay profile="xbox" state={state} />;
}
```

### CLI

```bash
opencontroller doctor
opencontroller test --profile xbox --adapter dry-run
opencontroller overlay --profile xbox --port 4317
opencontroller replay ./replays/session/events.jsonl
opencontroller bridge --id player-1
opencontroller native doctor --backend current
opencontroller native doctor --backend all --json
opencontroller init
```

Use `opencontroller native doctor --backend current --check` in setup scripts
when you want a non-zero exit code unless the host's native backend is ready.
The command can also target `linux-uinput`, `windows-virtual-gamepad`, or
`macos-driverkit` directly.

## Architecture

Commands flow through a predictable pipeline before they reach an adapter:

```txt
Controller API
  -> Command queue
  -> Safety guard
  -> Profile normalization
  -> State store
  -> Replay logger
  -> Adapter
```

Adapters receive normalized controller commands. That keeps the runtime stable
while different targets decide how to consume input.

Current adapters:

- `dry-run`: updates state, safety, and replay logs without touching a real device
- `websocket`: streams normalized controller commands to an app, game, bridge, or emulator
- `xinput-report`: turns controller state into 12-byte XInput gamepad reports for native bridge processes
- `native-bridge`: emits versioned JSONL messages with XInput and HID report payloads for native bridge processes
- `NativeProcessBridgeAdapter`: streams JSONL directly to a helper process stdin

Runtime adapters can also opt into full state synchronization. This is the
important boundary for virtual controller emulation: native drivers generally
want the current complete gamepad state, not only an event like "A was pressed."

## Examples

```bash
bun --cwd examples/basic-dry-run dev
bun run dev:fighter
bun --cwd examples/react-overlay dev
bun --cwd examples/obs-overlay dev
bun --cwd examples/websocket-bridge dev
bun --cwd examples/native-bridge-jsonl dev
```

Example folders:

- `examples/basic-dry-run`: minimal controller API usage
- `examples/agent-fighter`: two-agent browser fighting game
- `examples/react-overlay`: React controller visualization
- `examples/obs-overlay`: local OBS browser-source overlay server
- `examples/websocket-bridge`: WebSocket adapter target example
- `examples/native-bridge-jsonl`: JSONL stream for native bridge authors

## Development

```bash
bun install
bun run typecheck
bun run lint
bun test
bun run build
```

Clean generated files:

```bash
bun run clean
```

## Publishing Checklist

Before publishing packages to npm:

```bash
bun run clean
bun run build
npm pack --workspace packages/core --dry-run
npm pack --workspace packages/overlay --dry-run
npm pack --workspace packages/cli --dry-run
npm pack --workspace packages/native-linux-uinput --dry-run
npm pack --workspace packages/native-windows-virtual-gamepad --dry-run
npm pack --workspace packages/native-macos-driverkit --dry-run
```

Then confirm:

- npm scope ownership is settled
- package names are final
- `dist` files are built from the current source
- examples still run from a fresh install
- GitHub Actions is green
- release tags and notes match the package version

## Current Status

The main branch is ready for local experiments, demos, package hardening, and
integration work.

Included:

- controller runtime
- profile normalization
- safety checks
- replay logs
- dry-run and WebSocket adapters
- XInput binary report bridge
- HID gamepad report descriptor and encoder
- native bridge JSONL protocol
- Linux `uinput` bridge package and helper source
- Windows VHF/HID virtual gamepad source and asset helpers
- macOS DriverKit virtual HID source and asset helpers
- multi-controller hub
- React/OBS overlays
- CLI workflows
- docs and examples
- Agent Fighter demo

Not included yet:

- signed Windows/macOS native virtual HID drivers
- game-specific perception
- headless match runner
- npm publication
- broad cross-platform installation testing
- production hardening for long-running agent tournaments

## Roadmap

- Publish npm packages under a confirmed scope
- Harden Linux `uinput` packaging, diagnostics, and install guidance
- Add signed Windows virtual HID and macOS DriverKit bridge drivers
- Add native bridge daemon templates with install and permission diagnostics
- Add a headless match runner for repeated agent duels
- Export replay data to JSON, CSV, and training-friendly formats
- Add richer telemetry dashboards for agents and controller state
- Expand adapter examples for emulators, desktop apps, and browser games

## License

MIT. See [LICENSE](LICENSE).
