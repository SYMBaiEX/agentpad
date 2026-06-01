# Native Bridge Protocol

OpenController native bridges consume JSON Lines messages from the SDK and turn
them into platform-specific virtual device calls.

The current protocol is intentionally small:

- transport: JSON Lines over stdout, stdin, pipes, sockets, or any ordered byte stream
- version: `1`
- report format: `xinput`
- report payload: 12-byte XInput-compatible report encoded as base64
- lifecycle: state messages followed by an optional disconnect message

This protocol is the contract for Linux `uinput`, Windows virtual gamepad/HID,
and macOS bridge packages. The TypeScript SDK does not install a driver by
itself.

The first platform consumer is documented in
[Linux uinput Bridge](linux-uinput.md).
Windows compatibility helpers are documented in
[Windows Virtual Gamepad](windows-virtual-gamepad.md).
macOS DriverKit helpers are documented in
[macOS DriverKit](macos-driverkit.md).
Descriptor-backed HID reports are documented in
[HID Gamepad Reports](hid-gamepad-reports.md).

## Emit JSONL

```ts
import { NativeBridgeAdapter, createController } from "@opencontroller/core";

const adapter = new NativeBridgeAdapter({
  includeState: false,
  write(line) {
    process.stdout.write(line);
  }
});

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter,
  replay: false
});

await controller.press("A", 80);
await controller.neutral();
await controller.disconnect();
```

The CLI can emit a deterministic sample stream:

```bash
opencontroller bridge --id player-1
```

For SDK-owned helper processes, use `NativeProcessBridgeAdapter`:

```ts
import {
  NativeProcessBridgeAdapter,
  createController
} from "@opencontroller/core";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: new NativeProcessBridgeAdapter({
    command: "/home/me/.opencontroller/bin/opencontroller-uinput-bridge",
    includeState: false
  }),
  replay: false
});
```

## State Message

```json
{
  "type": "opencontroller.bridge.state",
  "version": 1,
  "controllerId": "player-1",
  "profile": "xbox",
  "timestamp": 1770000000000,
  "reportFormat": "xinput",
  "report": {
    "buttons": 4096,
    "leftTrigger": 0,
    "rightTrigger": 0,
    "leftStickX": 0,
    "leftStickY": 0,
    "rightStickX": 0,
    "rightStickY": 0
  },
  "reportBase64": "ABAAAAAAAAAAAAAA",
  "hidReportFormat": "hid-gamepad",
  "hidReport": {
    "reportId": 1,
    "buttons": 4096,
    "leftTrigger": 0,
    "rightTrigger": 0,
    "leftStickX": 0,
    "leftStickY": 0,
    "rightStickX": 0,
    "rightStickY": 0
  },
  "hidReportBase64": "AQAQAAAAAAAAAAAAAA=="
}
```

Set `includeState: true` to include the full OpenController state object in
each message. `reportBase64` remains the compatibility XInput payload.
Descriptor-backed native drivers should prefer `hidReportBase64`, which is the
13-byte OpenController HID gamepad report matching the shared descriptor.

## Disconnect Message

```json
{
  "type": "opencontroller.bridge.disconnect",
  "version": 1,
  "controllerId": "player-1",
  "timestamp": 1770000000000
}
```

Native bridges should neutralize and release the virtual device when they
receive a disconnect message or when the stream closes unexpectedly.

## Parse Messages

```ts
import {
  nativeBridgeMessageToHidGamepadReportBytes,
  nativeBridgeMessageToReportBytes,
  parseNativeBridgeMessage
} from "@opencontroller/core/bridge";

const message = parseNativeBridgeMessage(line);

if (message.type === "opencontroller.bridge.state") {
  const xinputBytes = nativeBridgeMessageToReportBytes(message);
  const hidBytes = nativeBridgeMessageToHidGamepadReportBytes(message);
  // Write the payload required by the platform virtual-device backend.
}
```

Platform packages can either consume the XInput bytes directly or convert them
to a descriptor-backed HID report. New descriptor-backed bridges should consume
`hidReportBase64` directly. The Windows VHF helpers generate a host bridge C
template that reads this JSONL stream from stdin and submits HID reports to the
VHF driver with `DeviceIoControl`. The HID payload also carries Home/Guide/PS
and auxiliary Capture/Touchpad controls; the XInput compatibility payload keeps
the standard XInput button mask and omits those system controls.
