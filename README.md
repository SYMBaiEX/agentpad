# OpenController

[![CI](https://github.com/SYMBaiEX/OpenController/actions/workflows/ci.yml/badge.svg)](https://github.com/SYMBaiEX/OpenController/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/SYMBaiEX/OpenController)](https://github.com/SYMBaiEX/OpenController/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OpenController is a Bun-first TypeScript SDK for giving AI agents a real controller
interface.

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

## What You Get

- Typed controller runtime for Xbox, PlayStation, Switch, generic HID, and keyboard/mouse-style profiles
- Safety guardrails for rate limits, max hold durations, disabled buttons, repeated input loops, and neutral-on-error behavior
- Replay logs for commands, state snapshots, annotations, and errors
- Adapter model with dry-run and WebSocket output backends
- Controller hub for managing multiple virtual controllers
- React and OBS-friendly overlays for showing controller state
- CLI commands for doctor, test, overlay, replay, and starter action maps
- A playable two-agent browser fighting game demo

OpenController is designed for local agents, accessibility tooling, testing,
research, plugins, emulators, stream overlays, and controlled single-player
experiments. It is not intended for anti-cheat bypasses, stealth automation, or
online competitive game automation.

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

Important npm note: these packages are configured for the `@opencontroller`
scope. Before publishing, confirm ownership of that npm scope or rename the
packages to an owned scope such as `@symbaiex/*`.

## Core API

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

## Multiple Controllers

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

## React Overlay

```tsx
import { ControllerOverlay } from "@opencontroller/overlay";

export function GamepadHud({ state }) {
  return <ControllerOverlay profile="xbox" state={state} />;
}
```

## CLI

```bash
opencontroller doctor
opencontroller test --profile xbox --adapter dry-run
opencontroller overlay --profile xbox --port 4317
opencontroller replay ./replays/session/events.jsonl
opencontroller init
```

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

## Examples

```bash
bun --cwd examples/basic-dry-run dev
bun run dev:fighter
bun --cwd examples/react-overlay dev
bun --cwd examples/obs-overlay dev
bun --cwd examples/websocket-bridge dev
```

Example folders:

- `examples/basic-dry-run`: minimal controller API usage
- `examples/agent-fighter`: two-agent browser fighting game
- `examples/react-overlay`: React controller visualization
- `examples/obs-overlay`: local OBS browser-source overlay server
- `examples/websocket-bridge`: WebSocket adapter target example

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
```

Then confirm:

- npm scope ownership is settled
- package names are final
- `dist` files are built from the current source
- examples still run from a fresh install
- GitHub Actions is green

## v0.1.0 Status

This release is ready for local experiments, demos, package hardening, and
integration work.

Included:

- controller runtime
- profile normalization
- safety checks
- replay logs
- dry-run and WebSocket adapters
- multi-controller hub
- React/OBS overlays
- CLI workflows
- docs and examples
- Agent Fighter demo

Not included yet:

- native virtual HID drivers
- game-specific perception
- headless match runner
- npm publication
- broad cross-platform installation testing
- production hardening for long-running agent tournaments

## Roadmap

- Publish npm packages under a confirmed scope
- Add a native virtual controller adapter where platform permissions allow it
- Add a headless match runner for repeated agent duels
- Export replay data to JSON, CSV, and training-friendly formats
- Add richer telemetry dashboards for agents and controller state
- Expand adapter examples for emulators, desktop apps, and browser games

## License

MIT. See [LICENSE](LICENSE).
