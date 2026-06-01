# AI Agent Integration

Agents can use raw commands:

```ts
await controller.press("A", 100);
await controller.moveStick("LEFT", { x: 0, y: -1 }, 300);
```

For safer model-facing control, prefer action maps:

```ts
const actions = createActionMap(controller, {
  interact: [{ type: "press", button: "A", durationMs: 100 }],
  stop: [{ type: "neutral" }]
});

await actions.run("interact");
```

Action maps keep model output constrained to named, reviewed behaviors.
