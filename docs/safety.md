# Safety

OpenController includes safety checks before commands reach an adapter.

Default checks:

- maximum commands per second
- maximum button hold duration
- maximum stick hold duration
- disabled guide and home buttons
- disabled combo list
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
    disabledButtons: ["GUIDE", "START"]
  }
});
```

OpenController should be used for local, controlled, and permissioned environments.
Do not use it for stealth automation or online competitive game automation.
