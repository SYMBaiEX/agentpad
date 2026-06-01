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

Dry-run and WebSocket adapters can carry these commands and state snapshots.
Native bridge adapters also advertise touchpad and gyro support because
PlayStation state messages include a `hid-playstation-extended` profile HID
payload with packed touch contacts and motion vectors. The compatibility XInput
payload and generic `hid-gamepad` payload still encode the common gamepad
subset, so platform helpers should consume the profile HID payload when they
need those richer channels.
