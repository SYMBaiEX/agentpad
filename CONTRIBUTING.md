# Contributing

Thanks for helping with OpenController.

## Development Setup

```bash
bun install
bun run release:check
```

Use focused changes, keep generated artifacts out of commits unless they are
intentional package outputs, and keep package versions aligned across the
workspace.

## Pull Request Checklist

- Explain the user-facing behavior change.
- Add or update focused tests for runtime, adapter, CLI, native bridge, or demo
  behavior.
- Run `bun run release:check`.
- Check package contents with `bun run pack:check` before release changes.
- Do not commit secrets, `.env` files, private keys, local replay data, or
  generated native drivers signed for a private account.

## Release Checklist

Before publishing npm packages:

- Confirm the npm account owns or belongs to the `@opencontroller` scope.
- Use npm 2FA or a granular access token that is allowed to publish.
- Run `bun run release:check`.
- Publish packages in dependency order:
  `@opencontroller/core`, `@opencontroller/overlay`,
  `@opencontroller/native-linux-uinput`,
  `@opencontroller/native-windows-virtual-gamepad`,
  `@opencontroller/native-macos-driverkit`, `@opencontroller/native`,
  `@opencontroller/cli`.
- Verify a clean install in a temporary directory before announcing the release.

## Safety Expectations

OpenController should make agent controller input observable, replayable, and
constrained. Contributions should preserve local-first behavior, neutral-on-error
paths, explicit native setup steps, and clear user control over privileged
actions.

Do not add features intended to bypass anti-cheat systems, hide automation from
online services, steal credentials, or manipulate multiplayer competitive play.
