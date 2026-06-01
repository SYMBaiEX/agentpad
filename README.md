# AgentPad SDK

AgentPad is a Bun-first TypeScript SDK that lets AI agents act as a virtual
controller. It provides a typed controller API, profile normalization, safety
guards, replay logs, visual overlays, and working output adapters.

AgentPad is designed for local agents, accessibility tooling, testing,
research, plugins, emulators, streaming overlays, and controlled single-player
experiments. It is not intended for anti-cheat bypasses, stealth automation, or
online competitive game automation.

## Packages

| Package | Purpose |
| --- | --- |
| `@agentpad/core` | Controller runtime, profiles, adapters, safety, replay logs |
| `@agentpad/overlay` | React overlays and OBS browser-source server |
| `@agentpad/cli` | Doctor, test, overlay, replay, and init commands |

## Install

AgentPad is currently a source release. Once the npm packages are published:

```bash
npm install @agentpad/core
```

For overlays or CLI workflows:

```bash
npm install @agentpad/core @agentpad/overlay
npm install -D @agentpad/cli
```

## Quick Start

```bash
bun install
bun test
bun run build
```

```ts
import { createController } from "@agentpad/core";

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

## React Overlay

```tsx
import { ControllerOverlay } from "@agentpad/overlay";

export function App({ state }) {
  return <ControllerOverlay profile="xbox" state={state} />;
}
```

## CLI

```bash
agentpad doctor
agentpad test --profile xbox --adapter dry-run
agentpad overlay --profile xbox --port 4317
agentpad replay ./replays/session/events.jsonl
```

## Examples

```bash
bun --cwd examples/basic-dry-run dev
bun run dev:fighter
bun --cwd examples/react-overlay dev
bun --cwd examples/obs-overlay dev
bun --cwd examples/websocket-bridge dev
```

Agent Fighter runs at `http://127.0.0.1:5173/`. Its controller telemetry and
Start/Stop/Reset controls are at `http://127.0.0.1:5173/controllers`.

## Publishing

The publishable packages build into `dist` and are configured for public scoped
npm publishing. Before publishing, confirm that the npm account owns the
`@agentpad` scope or rename the packages to an owned scope.

```bash
bun run clean
bun run build
npm pack --workspace packages/core --dry-run
npm pack --workspace packages/overlay --dry-run
npm pack --workspace packages/cli --dry-run
```

## Status

This v0.1.0 release ships dry-run, WebSocket, replay, safety, profile mapping,
overlay, examples, and CLI workflows as the supported package surface.

The SDK is ready for local experiments and package hardening. Native virtual HID
drivers, game-specific perception, headless match running, and broad
cross-platform install testing are intentionally outside the v0.1.0 surface.
