# Contributing

Thanks for helping with OpenController.

Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) when participating.

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

Before publishing a new npm package version:

- Use npm 2FA or a granular access token that is allowed to publish.
- Run `bun run release:check`.
- Preview publish output with `bun run publish:npm:dry-run`.
- Run `npm view @opencontroller/core version` and the same command for changed
  packages to inspect current npm registry versions.
- Publish packages in dependency order:
  `@opencontroller/core`, `@opencontroller/overlay`,
  `@opencontroller/native-linux-uinput`,
  `@opencontroller/native-windows-virtual-gamepad`,
  `@opencontroller/native-macos-driverkit`, `@opencontroller/native`,
  `@opencontroller/cli`.
- Use `bun run publish:npm -- --confirm --otp <code>` for a 2FA-protected
  account, or omit `--otp` when using a granular publish token with 2FA bypass.
- Run `npm view <package> version` after publishing to confirm npm sees every
  changed package at the expected version.
- Verify a clean install in a temporary directory before announcing the release.

## Safety Expectations

OpenController should make agent controller input observable, replayable, and
constrained. Contributions should preserve local-first behavior, neutral-on-error
paths, explicit native setup steps, and clear user control over privileged
actions.

Do not add features intended to bypass anti-cheat systems, hide automation from
online services, steal credentials, or manipulate multiplayer competitive play.
