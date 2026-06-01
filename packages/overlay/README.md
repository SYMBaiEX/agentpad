# @opencontroller/overlay

React and OBS-friendly controller overlays for OpenController.

Use this package to render live controller state for debugging, demos, stream
overlays, agent telemetry, and OBS browser sources.

## Install

```bash
npm install @opencontroller/core @opencontroller/overlay react react-dom
```

## React Overlay

```tsx
import { ControllerOverlay } from "@opencontroller/overlay";
import type { ControllerState } from "@opencontroller/core";

export function ControllerView({ state }: { state: ControllerState }) {
  return <ControllerOverlay state={state} profile="xbox" />;
}
```

## Profile-Specific Components

```tsx
import {
  GenericOverlay,
  PlayStationOverlay,
  SwitchOverlay,
  XboxOverlay,
} from "@opencontroller/overlay";
```

## Entry Points

- `@opencontroller/overlay`: React overlays, themes, canvas renderers, and SVG helpers
- `@opencontroller/overlay/react`: `ControllerOverlay`
- `@opencontroller/overlay/server`: local overlay server helpers for OBS-style browser sources

## Notes

`react` and `react-dom` are peer dependencies so host apps can keep one React
version. The overlays consume OpenController state; they do not create or drive
controllers directly.
