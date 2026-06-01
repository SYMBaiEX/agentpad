# Release Notes

## Unreleased

- adapter contract now supports full controller state synchronization
- WebSocket adapter now emits `controller.state` messages
- XInput report encoder added for native virtual-device bridge processes
- `xinput-report` adapter added for testing and native bridge integration
- native bridge JSONL protocol added for platform driver processes
- `native-bridge` adapter and CLI sample stream added

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
