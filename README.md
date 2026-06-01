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
- CLI commands for doctor, native backend doctor, native bridge smoke tests, dry-run tests, overlay, replay, and starter action maps
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
Windows VHF host bridge helpers, and macOS DriverKit host bridge helpers. The
next milestone is turning those host bridge surfaces into signed, installable
native device flows.

If you are evaluating it for another project, use it now for controller-state
or command-stream integrations. Linux users can start testing the `uinput`
bridge. Windows users can inspect VHF/HID assets, legacy ViGEmBus compatibility,
and XUSB report mapping. macOS users can generate DriverKit HID assets, wrap a
signed host bridge process, and check local signing/tool readiness.

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
| `@opencontroller/native` | One-import native host bridge adapter selection for Linux, Windows, and macOS |
| `@opencontroller/native-linux-uinput` | Linux `/dev/uinput` bridge helper and event mapping |
| `@opencontroller/native-windows-virtual-gamepad` | Windows VHF/HID assets, XUSB helpers, and legacy ViGEmBus diagnostics |
| `@opencontroller/native-macos-driverkit` | macOS DriverKit HID assets, host bridge adapter factory, and local authoring diagnostics |

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

For cross-platform native bridge work:

```bash
npm install @opencontroller/core @opencontroller/native
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

The unified native package adds:

- `createNativeHostBridgeAdapter` for selecting the host bridge backend for the
  current platform
- `resolveNativeHostBridgeBackend` and `defaultNativeHostBridgePath` for install
  and packaging workflows
- backend aliases for Linux `uinput`, Windows VHF, and macOS DriverKit

The Linux native package adds:

- OpenController JSONL to Linux event mapping
- host diagnostics for `/dev/uinput`, module, and permission readiness
- C helper source for `/dev/uinput`
- build helper for producing `opencontroller-uinput-bridge`
- Linux `FF_RUMBLE` feedback handling with native bridge feedback JSONL
- setup helper for compiling the bridge and printing reviewed udev-rule commands

The Windows native package adds:

- VHF-ready HID descriptor, input report helpers, and rumble feedback contract
- INF, WDK C source, host bridge C source, C-array asset generators, and a host bridge adapter factory for a maintained Windows VHF driver path
- generated VHF source templates that capture HID output reports and emit native bridge feedback JSONL
- setup helper for staging reviewed VHF driver/host source files and install/test commands without privileged changes
- XUSB report helpers
- legacy ViGEmBus service diagnostics
- `opencontroller-windows-gamepad-doctor`

The macOS native package adds:

- DriverKit-ready HID descriptor, input report helpers, and rumble output
  report codecs
- Info.plist and entitlement templates for a virtual HID gamepad dext
- C++ DriverKit source and byte-array asset generation, including `setReport`
  rumble capture and a `copyRumbleReport` hook for signed host bridges
- host bridge adapter factory for a signed DriverKit host process
- setup helper for staging reviewed DriverKit/host source files and activation/test commands without privileged changes
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
  encodeHidGamepadRumbleReport,
  hidGamepadReportDescriptor
} from "@opencontroller/core/hid";

const descriptor = hidGamepadReportDescriptor;
const bytes = encodeHidGamepadReport(controller.getState());
const rumble = encodeHidGamepadRumbleReport({
  weakMotor: 0.25,
  strongMotor: 0.8
});
```

HID reports are the handoff point for descriptor-backed virtual device APIs.
The report shape includes 16 buttons, four signed stick axes, and two trigger
axes. OpenController also defines a compact vendor output report for rumble
channels so native drivers have a shared haptics contract to implement. Native
helpers can also send rumble feedback back to agents through
`controller.onFeedback(...)`. See [HID Gamepad Reports](docs/hid-gamepad-reports.md).

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
    includeState: false,
    supportsRumble: true
  }),
  replay: false
});

controller.onFeedback((event) => {
  if (event.type === "rumble") {
    console.log("rumble", event.weakMotor, event.strongMotor);
  }
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
sends a disconnect message, closes stdin, surfaces non-zero helper exits, and
can parse helper stdout feedback JSONL for host-side rumble events.

macOS DriverKit projects can use the same native process pattern once a signed
host app/bridge is available:

```ts
import { createController } from "@opencontroller/core";
import {
  createMacosDriverKitHostBridgeAdapter
} from "@opencontroller/native-macos-driverkit";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createMacosDriverKitHostBridgeAdapter({
    controllerId: "player-1",
    driverBundleIdentifier: "com.opencontroller.driverkit.virtual-gamepad",
    driverClassName: "OpenControllerVirtualGamepadDriver"
  }),
  replay: false
});
```

The default macOS bridge path is
`~/Library/Application Support/OpenController/bin/OpenControllerDriverKitHostBridge`.
The generated DriverKit source stores HID rumble output reports so a signed host
bridge can publish `opencontroller.bridge.feedback` JSONL back to
`controller.onFeedback(...)`.

For application code that should run on whichever native backend is installed
for the current host, use the unified native package:

```ts
import { createController } from "@opencontroller/core";
import { createNativeHostBridgeAdapter } from "@opencontroller/native";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createNativeHostBridgeAdapter(),
  replay: false
});
```

### Linux uinput

```bash
bun --cwd packages/native-linux-uinput build
bun packages/native-linux-uinput/dist/bin/build-helper.js
opencontroller-linux-uinput-setup
opencontroller-linux-uinput-doctor
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --controller-id player-1
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --dry-run
```

The Linux helper reads the native bridge JSONL stream, creates an
`OpenController Virtual Gamepad` through `/dev/uinput`, emits Linux gamepad
events, and destroys the device when the stream closes. It prefers the direct
HID payload and keeps XInput fallback for older streams. Dry-run mode decodes
the same stream without opening `/dev/uinput`. Use `--controller-id` or
`OPENCONTROLLER_CONTROLLER_ID` when a helper reads a shared stream so one
virtual device only reacts to its assigned controller. Real device mode
requires Linux and write access to `/dev/uinput`. Games that use evdev
`FF_RUMBLE` can send weak/strong rumble back through helper stdout as
`opencontroller.bridge.feedback`, which the SDK exposes through
`controller.onFeedback(...)`.

The Windows VHF and macOS DriverKit host bridge adapters use the same
`controllerId` option and `OPENCONTROLLER_CONTROLLER_ID` environment contract,
so one helper process can safely own one virtual controller even when agents
share a bridge stream.

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
opencontroller native setup --backend current
opencontroller native setup --backend windows-vhf --output ./opencontroller-windows-vhf
opencontroller native test --backend linux-uinput --dry-run --id player-1
opencontroller native test --backend current
opencontroller-windows-vhf-setup --output ./opencontroller-windows-vhf
opencontroller-macos-driverkit-setup --output ./opencontroller-macos-driverkit
opencontroller init
```

Use `opencontroller native doctor --backend current --check` in setup scripts
when you want a non-zero exit code unless the host's native backend is ready.
The command can also target `linux-uinput`, `windows-virtual-gamepad`, or
`macos-driverkit` directly.

Use `opencontroller native setup` to prepare the current host backend through
one CLI entrypoint. It dispatches to the Linux uinput helper build, Windows VHF
kit generator, or macOS DriverKit kit generator while keeping privileged system
changes explicit and reviewed.

Use `opencontroller native test` after a backend is installed to push a small
button, stick, trigger, and neutral sequence through the selected native host
bridge. On Linux, add `--dry-run` to validate JSONL/HID decoding before opening
`/dev/uinput`; the Linux helper filter is pinned to the emitted controller ID.

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
Process-backed native helpers can additionally opt into feedback events so games
and host drivers can send haptics back to AI agents.

## Examples

```bash
bun --cwd examples/basic-dry-run dev
bun run dev:fighter
bun --cwd examples/agent-fighter headless --duration-ms 15000
bun --cwd examples/agent-fighter headless --matches 5 --duration-ms 10000 --output ./agent-fighter-series.json
bun --cwd examples/agent-fighter headless --matches 3 --duration-ms 10000 --min-decisions-per-player 10 --min-total-damage 1
bun --cwd examples/react-overlay dev
bun --cwd examples/obs-overlay dev
bun --cwd examples/websocket-bridge dev
bun --cwd examples/native-bridge-jsonl dev
```

Example folders:

- `examples/basic-dry-run`: minimal controller API usage
- `examples/agent-fighter`: two-agent browser fighting game with a gated
  headless match-series runner
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
npm pack --workspace packages/native --dry-run
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
- unified native host bridge adapter package
- Linux `uinput` bridge package and helper source
- Windows VHF/HID virtual gamepad source and asset helpers
- macOS DriverKit virtual HID source, asset, and host bridge adapter helpers
- multi-controller hub
- React/OBS overlays
- CLI workflows
- docs and examples
- Agent Fighter demo and gated headless match-series runner

Not included yet:

- signed Windows/macOS native virtual HID drivers
- game-specific perception
- npm publication
- broad cross-platform installation testing
- production hardening for long-running agent tournaments

## Roadmap

- Publish npm packages under a confirmed scope
- Verify Linux `FF_RUMBLE` across more game launchers and distributions
- Add signed Windows virtual HID and macOS DriverKit bridge drivers
- Add native bridge daemon templates with install and permission diagnostics
- Add stored regression baselines for headless Agent Fighter match series
- Export replay data to JSON, CSV, and training-friendly formats
- Add richer telemetry dashboards for agents and controller state
- Expand adapter examples for emulators, desktop apps, and browser games

## License

MIT. See [LICENSE](LICENSE).
