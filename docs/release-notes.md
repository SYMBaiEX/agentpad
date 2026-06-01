# Release Notes

## Unreleased

- adapter contract now supports full controller state synchronization
- WebSocket adapter now emits `controller.state` messages
- XInput report encoder added for native virtual-device bridge processes
- `xinput-report` adapter added for testing and native bridge integration
- native bridge JSONL protocol added for platform driver processes
- native bridge JSONL state messages now include descriptor-backed
  `hidReportBase64` payloads alongside XInput compatibility payloads
- `native-bridge` adapter and CLI sample stream added
- `NativeProcessBridgeAdapter` added for SDK-owned native helper processes
- `@opencontroller/native-linux-uinput` package added with Linux event mapping
  and `/dev/uinput` helper source
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
- macOS DriverKit asset generator now emits C++ source/header templates for an
  `IOUserHIDDevice` virtual gamepad dext

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
