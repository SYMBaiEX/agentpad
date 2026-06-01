# Linux uinput Bridge

`@opencontroller/native-linux-uinput` is the first OpenController platform
backend for OS-level virtual controller emulation.

It consumes OpenController native bridge JSONL and writes Linux gamepad events
to `/dev/uinput`. Linux then exposes the virtual device through the normal
input subsystem, so games and tools can see it as a gamepad-like input device.

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

The setup command wraps the same build step and prints the exact permission
commands to review:

```bash
opencontroller-linux-uinput-setup
opencontroller-linux-uinput-setup --udev-group input
opencontroller-linux-uinput-setup --json
```

It does not run `sudo`, write `/etc/udev/rules.d`, reload udev, or change group
membership. Virtual input devices can control real applications, so
OpenController keeps those steps explicit.

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

If the helper is consuming a stream that may contain more than one controller,
pin it to the device it should own:

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --controller-id player-1
opencontroller bridge --id player-1 | OPENCONTROLLER_CONTROLLER_ID=player-1 ~/.opencontroller/bin/opencontroller-uinput-bridge
```

To verify the bridge stream without creating a virtual device, run the helper in
dry-run mode:

```bash
opencontroller bridge --id player-1 | ~/.opencontroller/bin/opencontroller-uinput-bridge --dry-run
```

Dry-run mode decodes the same JSONL stream and prints one line per parsed
report. It is useful in CI, on machines without `/dev/uinput` access, and before
reviewing local permission changes.

Or let the SDK own the helper process:

```ts
import { createController } from "@opencontroller/core";
import {
  createLinuxUinputBridgeAdapter,
  prepareLinuxUinputSetup
} from "@opencontroller/native-linux-uinput";

const setup = await prepareLinuxUinputSetup();

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createLinuxUinputBridgeAdapter({
    controllerId: "player-1",
    helperPath: setup.helperPath
  }),
  replay: false
});
```

The helper:

- opens `/dev/uinput`
- creates an `OpenController Virtual Gamepad`
- prefers PlayStation `profileHidReportBase64` payloads for touchpad contacts,
  falls back to descriptor-backed `hidReportBase64`, and then falls back to
  legacy `reportBase64` XInput payloads
- maps OpenController gamepad reports to Linux gamepad event codes
- maps PlayStation touchpad contacts to Linux multitouch event codes:
  `BTN_TOUCH`, `ABS_MT_SLOT`, `ABS_MT_TRACKING_ID`, `ABS_MT_POSITION_X`,
  `ABS_MT_POSITION_Y`, and `ABS_MT_PRESSURE`
- emits `SYN_REPORT` after each state update
- advertises Linux `FF_RUMBLE`, handles uinput upload/erase/playback callbacks,
  and emits `opencontroller.bridge.feedback` JSONL for weak/strong rumble
  events
- neutralizes and destroys the virtual device when the stream ends
- supports `--dry-run` or `OPENCONTROLLER_UINPUT_DRY_RUN=1` to decode bridge
  streams without opening `/dev/uinput`
- supports `--controller-id` or `OPENCONTROLLER_CONTROLLER_ID` so shared
  native bridge streams do not leak one controller's inputs into another
  virtual device

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

OpenController's native bridge now carries a canonical 13-byte HID gamepad
report for descriptor-backed drivers and a 12-byte XInput-compatible payload for
older helpers. The Linux bridge accepts both. HID is preferred because it is the
same report contract used by the Windows VHF and macOS DriverKit directions.

| XInput | Linux event |
| --- | --- |
| A | `BTN_SOUTH` |
| B | `BTN_EAST` |
| X | `BTN_WEST` |
| Y | `BTN_NORTH` |
| LB/RB | `BTN_TL` / `BTN_TR` |
| Back/Start | `BTN_SELECT` / `BTN_START` |
| Guide/Home/PS | `BTN_MODE` |
| LS/RS | `BTN_THUMBL` / `BTN_THUMBR` |
| D-pad | `BTN_DPAD_*` |
| Left stick | `ABS_X` / `ABS_Y` |
| Right stick | `ABS_RX` / `ABS_RY` |
| LT/RT | `ABS_Z` / `ABS_RZ` |

OpenController's HID and XInput reports use positive Y for up. Linux gamepad
axes use negative Y for up, so the bridge inverts `ABS_Y` and `ABS_RY`.

## Rumble Feedback

The helper enables `EV_FF` plus `FF_RUMBLE` and sets `ff_effects_max` on the
virtual device. When a game uploads a rumble effect, uinput sends the helper an
`EV_UINPUT` upload request; the helper completes the request with
`UI_BEGIN_FF_UPLOAD` and `UI_END_FF_UPLOAD`, stores the weak/strong magnitudes,
and emits OpenController feedback JSONL when the effect is played or stopped.

Linux `FF_RUMBLE` exposes weak and strong motors. Trigger rumble channels are
reported as zero because evdev rumble does not carry separate trigger motors.
The SDK parses helper stdout and forwards the event through
`controller.onFeedback(...)`.

## Current Limitations

- Linux only
- no trigger-motor rumble separation on Linux; evdev `FF_RUMBLE` exposes only
  weak and strong motors
- no automatic permission changes
- helper source is included and buildable, but not prebuilt
- one helper creates one virtual device; run one helper per emulated controller
  and filter shared streams with `--controller-id`
- CI validates TypeScript mapping, package builds, C syntax, and helper dry-run
  decoding; real `/dev/uinput` device verification requires a Linux host with
  permissions
