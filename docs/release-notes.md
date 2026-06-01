# Release Notes

## Unreleased

- adapter contract now supports full controller state synchronization
- WebSocket adapter now emits `controller.state` messages
- XInput report encoder added for native virtual-device bridge processes
- `xinput-report` adapter added for testing and native bridge integration
- native bridge JSONL protocol added for platform driver processes
- native bridge JSONL state messages now include descriptor-backed
  `hidReportBase64` payloads alongside XInput compatibility payloads
- descriptor-backed HID reports now carry Home/Guide/PS through bit `0x0400`
  while preserving standard XInput compatibility reports
- `native-bridge` adapter and CLI sample stream added
- `NativeProcessBridgeAdapter` added for SDK-owned native helper processes
- `@opencontroller/native-linux-uinput` package added with Linux event mapping
  and `/dev/uinput` helper source
- Linux `uinput` helper now prefers descriptor-backed `hidReportBase64`
  payloads and falls back to legacy XInput payloads
- Linux `uinput` helper now supports dry-run JSONL decoding, and CI compiles
  and smoke-tests the real C helper parser
- Linux `uinput` helper now supports `--controller-id` and
  `OPENCONTROLLER_CONTROLLER_ID` filtering for multi-controller bridge streams
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
- Windows VHF host bridge templates now support `OPENCONTROLLER_CONTROLLER_ID`
  and `--controller-id` filtering for shared multi-agent streams
- Windows VHF helpers now export `createWindowsVhfHostBridgeAdapter` for
  SDK-owned host bridge processes after a VHF driver package is built
- macOS DriverKit asset generator now emits C++ source/header templates for an
  `IOUserHIDDevice` virtual gamepad dext
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
- `opencontroller-windows-vhf-setup` added to stage reviewed Windows VHF
  driver/host source files and install/test commands without privileged changes
- `opencontroller-macos-driverkit-setup` added to stage reviewed DriverKit
  source, entitlements, manifest, and activation/test commands without
  privileged changes

## v0.1.0

Initial release:

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
