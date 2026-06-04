# Safety

OpenController includes safety checks before commands reach an adapter.

Default checks:

- maximum commands per second
- maximum button hold duration
- maximum stick hold duration
- disabled guide and home buttons
- disabled combo list
- D-pad helper commands checked as their underlying `DPAD_*` buttons
- neutral on error
- neutral on disconnect
- repeated input loop detection

Example:

```ts
const controller = await createController({
  profile: "xbox",
  adapter: "dry-run",
  safety: {
    maxCommandsPerSecond: 20,
    maxButtonHoldMs: 1000,
    disabledButtons: ["GUIDE", "START", "DPAD_UP"],
    disabledCombos: [["DPAD_UP", "DPAD_RIGHT"]]
  }
});
```

`controller.dpad("UP_RIGHT")` is treated as the `DPAD_UP` and `DPAD_RIGHT`
buttons for disabled-button, disabled-combo, and hold-duration checks.

OpenController should be used for local, controlled, and permissioned environments.
Do not use it for stealth automation or online competitive game automation.
