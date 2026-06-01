# @opencontroller/native-linux-uinput

Linux `uinput` bridge for OpenController.

This package provides:

- a pure TypeScript event mapper for tests and diagnostics
- a Linux uinput doctor for device, module, and permission checks
- build and setup helpers for the native C bridge
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

## Prepare A Host

```bash
opencontroller-linux-uinput-setup
opencontroller-linux-uinput-setup --udev-group input
opencontroller-linux-uinput-setup --json
```

Setup compiles the helper, prints the default bridge commands, and prints
reviewable udev-rule install commands. It does not run `sudo` or install
permission rules automatically.

## Diagnose The Host

```bash
opencontroller-linux-uinput-doctor
opencontroller-linux-uinput-doctor --json
opencontroller-linux-uinput-doctor --check
```

The doctor checks Linux support, `/dev/uinput` candidates, write access, whether
the `uinput` module appears in `/proc/modules`, and prints explicit udev rule
templates. It does not change system permissions.

## Run With OpenController JSONL

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge
```

When the input stream may contain multiple controllers, bind one helper process
to one controller:

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --controller-id player-1
opencontroller bridge --id player-1 | OPENCONTROLLER_CONTROLLER_ID=player-1 ~/.opencontroller/bin/opencontroller-uinput-bridge
```

The helper creates an OpenController virtual gamepad, applies each state report,
neutralizes on disconnect, and destroys the virtual device when the stream ends.
It prefers descriptor-backed `hidReportBase64` payloads and falls back to the
legacy XInput-compatible `reportBase64` payload for older bridge streams.
Descriptor-backed payloads map Home/Guide/PS to Linux `BTN_MODE`.

Use dry-run mode to verify the stream without opening `/dev/uinput`:

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --dry-run
```

You can also set `OPENCONTROLLER_UINPUT_DRY_RUN=1` for CI scripts.

SDK code can also spawn the helper directly:

```ts
import { createController } from "@opencontroller/core";
import {
  createLinuxUinputBridgeAdapter,
  prepareLinuxUinputSetup
} from "@opencontroller/native-linux-uinput";

const setup = await prepareLinuxUinputSetup();
console.log(setup.helperPath);

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createLinuxUinputBridgeAdapter({
    controllerId: "player-1",
    deviceName: "OpenController Virtual Gamepad"
  }),
  replay: false
});
```

## Permissions

Most Linux systems require either root, membership in an input-related group, or
a udev rule that grants the current user access to `/dev/uinput`.

The setup command intentionally does not install udev rules. OpenController
should make permission changes explicit and inspectable.
