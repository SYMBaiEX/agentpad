# Overlays

The overlay package renders controller state without requiring a physical
controller.

```tsx
import { ControllerOverlay } from "@opencontroller/overlay";

<ControllerOverlay
  profile="xbox"
  state={state}
  theme="dark"
  showLabels
  showSticks
  showTriggers
/>;
```

The package includes Xbox, PlayStation, and generic renderers. The generic
renderer is used for Switch and generic HID in v0.1.0.
