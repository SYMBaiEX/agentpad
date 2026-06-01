# @opencontroller/native-linux-uinput

Linux `uinput` bridge for OpenController.

This package provides:

- a pure TypeScript event mapper for tests and diagnostics
- a build helper for the native C bridge
- a C helper that reads OpenController native bridge JSONL from stdin and emits
  Linux gamepad events through `/dev/uinput`

It is the first platform backend toward full OS-level virtual controller
emulation. It only works on Linux systems with the `uinput` module and write
access to `/dev/uinput`.

## Build The Helper

```bash
bun --cwd packages/native-linux-uinput build
bun packages/native-linux-uinput/dist/bin/build-helper.js
```

The build command prints the compiled helper path.

## Run With OpenController JSONL

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge
```

The helper creates an OpenController virtual gamepad, applies each state report,
neutralizes on disconnect, and destroys the virtual device when the stream ends.

## Permissions

Most Linux systems require either root, membership in an input-related group, or
a udev rule that grants the current user access to `/dev/uinput`.

The helper intentionally does not install udev rules. OpenController should make
permission changes explicit and inspectable.
