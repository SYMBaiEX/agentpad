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
