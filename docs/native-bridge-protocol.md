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
  "reportBase64": "ABAAAAAAAAAAAAAA"
}
```

Set `includeState: true` to include the full OpenController state object in
each message. Native drivers should use `reportBase64` as the authoritative
packed report and may use `report` for diagnostics.

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
  nativeBridgeMessageToReportBytes,
  parseNativeBridgeMessage
} from "@opencontroller/core/bridge";

const message = parseNativeBridgeMessage(line);

if (message.type === "opencontroller.bridge.state") {
  const bytes = nativeBridgeMessageToReportBytes(message);
  // Write bytes to the platform virtual-device backend.
}
```
