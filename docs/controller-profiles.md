# Controller Profiles

Supported profile names:

- `xbox`
- `playstation`
- `switch`
- `generic-hid`
- `keyboard-mouse`

Profiles expose native button names while also mapping to a universal model.
For example, Xbox `A`, PlayStation `CROSS`, and Switch `B` all map to the
universal `SOUTH` face button.

PlayStation aliases are supported:

```ts
await controller.press("X", 100); // resolves to CROSS
await controller.press("O", 100); // resolves to CIRCLE
```

## Touchpad And Motion

The runtime includes first-class state for PlayStation touchpad input and
PlayStation/Switch motion input:

```ts
await controller.touchpad(
  {
    pressed: true,
    contacts: [{ id: 0, x: 0.5, y: 0.35, pressure: 0.8 }],
  },
  120,
);

await controller.motion({
  acceleration: { x: 0, y: 0, z: 1 },
  gyroscope: { x: 0.1, y: 0, z: 0 },
});
```

Touchpad coordinates and pressure are normalized to `0..1`. Touchpad input is
enabled for the `playstation` profile. Motion input is enabled for
`playstation` and `switch`.

Dry-run and WebSocket adapters can carry these commands and state snapshots
today. Current XInput and generic HID native bridge reports still encode the
common gamepad subset, so native adapters report `supportsTouchpad` and
`supportsGyro` as `false` until their platform descriptors include those
channels.
