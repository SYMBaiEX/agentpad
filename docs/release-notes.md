# Release Notes

## Unreleased

- Added native bridge `device` identity metadata to
  `opencontroller.bridge.connect`, including device name, manufacturer, vendor
  ID, product ID, version, bus type, and serial number for OS virtual device
  creation.
- Added `opencontroller.bridge.connect` lifecycle messages for native bridge
  streams so host helpers can create/select virtual devices before state
  reports arrive, with advertised report formats and feedback channels.
- Added `ControllerState.feedback` tracking for latest host rumble/light output
  and replay `feedback` events written to `events.jsonl` plus
  `feedback.jsonl`.
- Added `controller.setStatus(...)`, `ControllerState.status`, and native
  bridge `extensions.status` for virtual battery and connection-health
  telemetry across state snapshots, replay logs, WebSocket streams, and native
  helper JSONL.
- Added HID light/player-indicator output reports and native bridge light
  feedback messages so hosts can surface lightbar and player LED state through
  `controller.onFeedback(...)`.
- Windows VHF and macOS DriverKit generated templates now capture HID light
  output reports alongside rumble reports and expose `"hid-gamepad-lights"`
  feedback paths for native host bridges.
- Linux `uinput` helper now advertises `EV_LED` player LEDs and converts host
  LED output events into `"hid-gamepad-lights"` feedback JSONL.
- Added `bun run npm:status` to compare local OpenController package versions
  against the live npm registry before and after publish.
- README, docs, and demo-facing labels now consistently present the project as
  OpenController, including OpenController Agent Fighter startup guidance.
- Added direct `HidGamepadReportAdapter` and
  `HidPlayStationExtendedReportAdapter` callback adapters for in-process HID
  report byte streams.
- Added `hid-switch-extended` reports and
  `HidSwitchExtendedReportAdapter` for Switch profile motion payloads.
- Windows VHF, macOS DriverKit, and the Linux `uinput` helper now consume
  Switch profile HID reports for native host bridge paths.
- `--report-profile switch` is now accepted by native setup and asset commands
  for Windows VHF and macOS DriverKit generated sources.
- HID report adapters now accept 5-byte rumble output reports through
  `receiveOutputReport(...)` / `receiveRumbleReport(...)` and surface haptics
  through `controller.onFeedback(...)`.
- Added `controller.setState(...)` and raw `setState` commands for atomic
  partial controller-state patches across buttons, triggers, sticks, D-pad,
  touchpad, and motion.
- Added explicit persistent-state commands and helpers: `setButton`,
  `setStick`, `setTrigger`, and `setDpad`.
- `setDpad("NEUTRAL")` now clears structured D-pad state without resetting the
  rest of the controller.
- Adapter capability metadata now advertises persistent state command support.
- Added `controller.press(button, { durationMs, pressure, context })` so agents
  can express analog button pressure without dropping to raw command objects.
- Direct trigger button presses now map to full analog trigger state, and direct
  D-pad button presses now keep structured `state.dpad` values synchronized.
- `controller.dpad()` now supports diagonal directions such as `UP_RIGHT`,
  encoded as combined cardinal D-pad state and report bits.
- D-pad helper commands now honor disabled-button, disabled-combo, and
  max-button-hold safety policies through their underlying `DPAD_*` buttons.
- Prepared workspace package manifests for the next `0.1.14` npm patch release.
- Added a guarded `publish:npm` helper that publishes packages in dependency
  order and supports npm two-factor `--otp` codes.
- `CODE_OF_CONDUCT.md` added for open-source community participation.
- README and contributing release guidance updated for ongoing `@opencontroller`
  npm package maintenance and live `npm view` verification.

## v0.1.0

Initial npm package release for OpenController, published under the
`@opencontroller` scope.

Published packages:

- `@opencontroller/core`
- `@opencontroller/overlay`
- `@opencontroller/cli`
- `@opencontroller/native`
- `@opencontroller/native-linux-uinput`
- `@opencontroller/native-windows-virtual-gamepad`
- `@opencontroller/native-macos-driverkit`

### Published SDK Updates

- adapter contract now supports full controller state synchronization
- WebSocket adapter now emits `controller.state` messages
- XInput report encoder added for native virtual-device bridge processes
- `xinput-report` adapter added for testing and native bridge integration
- native bridge JSONL protocol added for platform driver processes
- native bridge JSONL state messages now include descriptor-backed
  `hidReportBase64` payloads alongside XInput compatibility payloads
- native bridge JSONL state messages now include PlayStation
  `hid-playstation-extended` profile HID payloads for touchpad contacts and
  motion vectors
- native bridge JSONL state messages now include optional `extensions` for
  touchpad and motion state without requiring the full state payload
- descriptor-backed HID reports now carry Home/Guide/PS through bit `0x0400`
  while preserving standard XInput compatibility reports
- `native-bridge` adapter and CLI sample stream added
- `NativeProcessBridgeAdapter` added for SDK-owned native helper processes
- adapter capabilities now describe supported profiles, command types, output
  formats, report formats, feedback channels, transport, and virtual-device kind
- controller runtime now tracks PlayStation touchpad and PlayStation/Switch
  motion commands for dry-run, replay, and WebSocket integrations
- OpenController Agent Fighter example now includes a headless Chromium
  match-series runner for repeatable agent duels, telemetry polling, aggregate
  win/decision scoring, HP damage metrics, configurable quality gates, summary
  JSON, and local smoke checks
- npm pack checks now verify every publishable workspace includes package-local
  docs, built entrypoints, exports, executable bins, and clean tarball contents
- `@opencontroller/native-linux-uinput` package added with Linux event mapping
  and `/dev/uinput` helper source
- Linux `uinput` helper now prefers descriptor-backed `hidReportBase64`
  payloads and falls back to legacy XInput payloads
- Linux `uinput` helper now consumes PlayStation `profileHidReportBase64`
  payloads and maps touchpad contacts to Linux multitouch events
- Linux `uinput` helper now supports dry-run JSONL decoding, and CI compiles
  and smoke-tests the real C helper parser
- Linux `uinput` helper now supports `--controller-id` and
  `OPENCONTROLLER_CONTROLLER_ID` filtering for multi-controller bridge streams
- Linux `uinput` helper now advertises `FF_RUMBLE`, handles uinput
  upload/erase/playback callbacks, and emits native bridge feedback JSONL for
  weak/strong rumble events
- Linux package now exports `createLinuxUinputBridgeAdapter` for SDK-owned
  helper processes with default helper path, device naming, and dry-run options
- Linux package now exports `prepareLinuxUinputSetup` and
  `opencontroller-linux-uinput-setup` for compiling the helper and printing
  reviewed udev-rule commands without making privileged changes
- package builds now rewrite emitted relative ESM imports for Node-compatible
  npm consumption
- `NativeProcessBridgeAdapter` now falls back to Node `child_process` when Bun
  is not the active runtime
- Linux uinput doctor added for module, device, permission, and udev-rule
  diagnostics
- `@opencontroller/native-windows-virtual-gamepad` package added with XUSB
  helpers and legacy ViGEmBus diagnostics
- HID gamepad report descriptor and encoder added for descriptor-backed native
  virtual device backends
- HID rumble output report descriptor and codecs added as the shared haptics
  contract for native virtual device backends
- native bridge feedback messages added so helper stdout can report HID rumble
  output events through `controller.onFeedback(...)`
- Windows VHF helpers added for HID descriptor/report bytes, C-array assets,
  and a VHF lower-filter INF template
- `@opencontroller/native-macos-driverkit` package added with DriverKit HID
  assets, plist/entitlement templates, and local authoring diagnostics
- `opencontroller native doctor` added as a unified CLI readiness check for
  Linux `uinput`, Windows virtual gamepad, and macOS DriverKit backends
- Windows VHF asset generator now emits WDK C source/header templates for a
  VHF-backed virtual HID gamepad
- Windows VHF asset generator now emits host bridge C source/header templates
  that stream OpenController JSONL reports to the driver with `DeviceIoControl`
- Windows VHF generated driver and host bridge templates now include a rumble
  output-report callback, pop IOCTL, feedback polling thread, and
  `opencontroller.bridge.feedback` stdout events
- Windows VHF source generators now support `reportProfile: "playstation"` for
  the 47-byte `hid-playstation-extended` descriptor/report and host bridge
  `profileHidReportBase64` consumption
- Windows VHF host bridge templates now support `OPENCONTROLLER_CONTROLLER_ID`
  and `--controller-id` filtering for shared multi-agent streams
- Windows VHF helpers now export `createWindowsVhfHostBridgeAdapter` for
  SDK-owned host bridge processes after a VHF driver package is built
- macOS DriverKit asset generator now emits C++ source/header templates for an
  `IOUserHIDDevice` virtual gamepad dext
- macOS DriverKit generated source now returns the rumble-capable HID
  descriptor, accepts output reports through `setReport`, and exposes a
  `copyRumbleReport` hook for signed host bridge feedback publishing
- macOS DriverKit source generators now support `reportProfile: "playstation"`
  for the 47-byte `hid-playstation-extended` descriptor/report
- macOS DriverKit helpers now export `createMacosDriverKitHostBridgeAdapter`
  for SDK-owned host bridge processes after a signed host app is built
- Windows VHF and macOS DriverKit host bridge adapters now pass
  `OPENCONTROLLER_CONTROLLER_ID` when `controllerId` is configured
- `@opencontroller/native` package added with `createNativeHostBridgeAdapter`
  for selecting Linux `uinput`, Windows VHF, or macOS DriverKit from one import
- `opencontroller native test` added to smoke-test a selected native host
  bridge from the CLI, including Linux `--dry-run` support
- `opencontroller native test` now passes its emitted controller ID through to
  every native host bridge adapter so smoke tests and controller filters stay
  aligned
- `opencontroller native setup` added as a unified CLI entrypoint for Linux
  uinput, Windows VHF, and macOS DriverKit setup workflows
- `opencontroller native setup --report-profile playstation` now forwards
  profile-specific HID generation to Windows VHF and macOS DriverKit kits
- `opencontroller-windows-vhf-setup` added to stage reviewed Windows VHF
  driver/host source files and install/test commands without privileged changes
- `opencontroller-macos-driverkit-setup` added to stage reviewed DriverKit
  source, entitlements, manifest, and activation/test commands without
  privileged changes

### Initial Source Release

Initial source release contents:

- OpenController project branding
- `@opencontroller/core`
- `@opencontroller/overlay`
- `@opencontroller/cli`
- `opencontroller` CLI binary
- Xbox and PlayStation profiles
- Switch and generic HID profile support
- universal profile mapping
- dry-run adapter
- WebSocket adapter
- safety guard
- command queue
- replay logger
- React controller overlays
- OBS-compatible overlay server
- examples and tests
