# Linux uinput Bridge

`@opencontroller/native-linux-uinput` is the first OpenController platform
backend for OS-level virtual controller emulation.

It consumes OpenController native bridge JSONL and writes Linux gamepad events to
`/dev/uinput`. Linux then exposes the virtual device through the normal input
subsystem, so games and tools can see it as a gamepad-like input device.

## Install From The Monorepo

```bash
bun install
bun --cwd packages/native-linux-uinput build
```

On Linux, build the native helper:

```bash
bun packages/native-linux-uinput/dist/bin/build-helper.js
```

That prints the compiled helper path, normally:

```txt
~/.opencontroller/bin/opencontroller-uinput-bridge
```

## Run

Check the host first:

```bash
opencontroller-linux-uinput-doctor
```

Use JSON for automation or `--check` for a non-zero exit when the host is not
ready:

```bash
opencontroller-linux-uinput-doctor --json
opencontroller-linux-uinput-doctor --check
```

Then stream controller reports into the helper:

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge
```

Or let the SDK own the helper process:

```ts
import {
  NativeProcessBridgeAdapter,
  createController
} from "@opencontroller/core";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: new NativeProcessBridgeAdapter({
    command: `${process.env.HOME}/.opencontroller/bin/opencontroller-uinput-bridge`,
    includeState: false
  }),
  replay: false
});
```

The helper:

- opens `/dev/uinput`
- creates an `OpenController Virtual Gamepad`
- maps OpenController XInput reports to Linux gamepad event codes
- emits `SYN_REPORT` after each state update
- neutralizes and destroys the virtual device when the stream ends

## Permissions

Linux systems usually restrict `/dev/uinput`. You may need root, membership in
an input-related group, or a local udev rule.

OpenController does not install permission rules automatically. Virtual input
devices can control real applications, so permission changes should stay
explicit and reviewable.

The doctor prints two udev rule templates:

- `desktop-uaccess` for logind/seat-managed user access
- `input-group` for systems where users are explicitly added to an input group

Review either rule before installing it under `/etc/udev/rules.d/`.

## Event Mapping

| XInput | Linux event |
| --- | --- |
| A | `BTN_SOUTH` |
| B | `BTN_EAST` |
| X | `BTN_WEST` |
| Y | `BTN_NORTH` |
| LB/RB | `BTN_TL` / `BTN_TR` |
| Back/Start | `BTN_SELECT` / `BTN_START` |
| LS/RS | `BTN_THUMBL` / `BTN_THUMBR` |
| D-pad | `BTN_DPAD_*` |
| Left stick | `ABS_X` / `ABS_Y` |
| Right stick | `ABS_RX` / `ABS_RY` |
| LT/RT | `ABS_Z` / `ABS_RZ` |

OpenController's XInput report uses positive Y for up. Linux gamepad axes use
negative Y for up, so the bridge inverts `ABS_Y` and `ABS_RY`.

## Current Limitations

- Linux only
- no rumble or force feedback yet
- no installer or udev-rule generator yet
- no automatic permission changes
- helper source is included and buildable, but not prebuilt
- CI validates TypeScript mapping and package builds; real `/dev/uinput`
  verification requires a Linux host with permissions
