# AI Agent Integration

Agents can use raw commands:

```ts
await controller.press("A", 100);
await controller.moveStick("LEFT", { x: 0, y: -1 }, 300);
```

Timed commands are best for taps, nudges, and short analog pulls. For controls
that should remain held across multiple agent decisions, use the stateful
helpers:

```ts
await controller.setButton("LB", true);
await controller.setStick("LEFT", { x: 0.6, y: -0.25 });
await controller.setTrigger("RT", 0.4);
await controller.setDpad("UP_RIGHT");

// Release only what changed, or call neutral() to reset everything.
await controller.setDpad("NEUTRAL");
await controller.setButton("LB", false);
```

For frame-style policies, use one atomic state patch:

```ts
await controller.setState({
  buttons: { LB: true, A: false },
  triggers: { RT: 0.35 },
  sticks: { LEFT: { x: 0.5, y: -0.2 } },
  dpad: "NEUTRAL"
});
```

The patch is partial: controls not listed keep their current state. The runtime
still performs profile normalization, safety checks, replay logging, and one
adapter state-sync message.

For safer model-facing control, prefer action maps:

```ts
const actions = createActionMap(controller, {
  interact: [{ type: "press", button: "A", durationMs: 100 }],
  holdBlock: [{ type: "setButton", button: "LB", pressed: true }],
  combatTick: [
    {
      type: "setState",
      state: {
        buttons: { LB: true },
        triggers: { RT: 0.25 },
        sticks: { LEFT: { x: 0.5, y: 0 } }
      }
    }
  ],
  releaseBlock: [{ type: "setButton", button: "LB", pressed: false }],
  stop: [{ type: "neutral" }]
});

await actions.run("interact");
```

Action maps keep model output constrained to named, reviewed behaviors.
