# Native Bridge Protocol

OpenController native bridges consume JSON Lines messages from the SDK and turn
them into platform-specific virtual device calls.

The current protocol is intentionally small:

- transport: JSON Lines over stdout, stdin, pipes, sockets, or any ordered byte stream
- version: `1`
- report format: `xinput`
- report payload: 12-byte XInput-compatible report encoded as base64
- extensions: optional touchpad, motion, and device-status side channels
- feedback: optional native-helper JSONL output for host haptics such as rumble
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
    includeState: false,
    supportsRumble: true
  }),
  replay: false
});

controller.onFeedback((event) => {
  if (event.type === "rumble") {
    console.log(event.weakMotor, event.strongMotor);
  }
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

For PlayStation and Switch profiles, state messages also include a
profile-specific HID payload by default. PlayStation reports use
`hid-playstation-extended`:

```json
{
  "profileHidReportFormat": "hid-playstation-extended",
  "profileHidReport": {
    "reportId": 3,
    "buttons": 0,
    "leftTrigger": 0,
    "rightTrigger": 0,
    "leftStickX": 0,
    "leftStickY": 0,
    "rightStickX": 0,
    "rightStickY": 0,
    "touchpadPressed": true,
    "touchpadContacts": [
      { "id": 0, "active": true, "x": 32768, "y": 22937, "pressure": 204 },
      { "id": 0, "active": false, "x": 0, "y": 0, "pressure": 0 }
    ],
    "accelerationX": 0,
    "accelerationY": 0,
    "accelerationZ": 32767,
    "gyroscopeX": 3277,
    "gyroscopeY": 0,
    "gyroscopeZ": 0,
    "orientationX": 0,
    "orientationY": 0,
    "orientationZ": 0
  },
  "profileHidReportBase64": "AwAAAAAAAAAAAAAAAAEBAAEAgJlZzAAAAAAAAAAAAAAA/3/NDAAAAAAAAAAAAAA="
}
```

Switch reports use `hid-switch-extended`, a 31-byte report containing the
common gamepad fields plus signed acceleration, gyroscope, and orientation
vectors:

```json
{
  "profileHidReportFormat": "hid-switch-extended",
  "profileHidReport": {
    "reportId": 4,
    "buttons": 0,
    "leftTrigger": 0,
    "rightTrigger": 0,
    "leftStickX": 0,
    "leftStickY": 0,
    "rightStickX": 0,
    "rightStickY": 0,
    "accelerationX": 8192,
    "accelerationY": -8192,
    "accelerationZ": 16384,
    "gyroscopeX": -16384,
    "gyroscopeY": 16384,
    "gyroscopeZ": 32767,
    "orientationX": 0,
    "orientationY": 0,
    "orientationZ": 0
  },
  "profileHidReportBase64": "BAAAAAAAAAAAAAAAAAAgAOAAQADAAED/fwAAAAAAAA=="
}
```

Use `nativeBridgeMessageToProfileHidReportBytes(message)` to validate and
decode `profileHidReportBase64`.

When richer profile-specific state is active, state messages may also include an
`extensions` object. This side channel is for bridge authors who want touchpad,
motion, or virtual device status data without enabling the full `state` payload:

```json
{
  "extensions": {
    "touchpad": {
      "pressed": true,
      "contacts": [
        {
          "id": 0,
          "x": 0.5,
          "y": 0.35,
          "active": true,
          "pressure": 0.8
        }
      ]
    },
    "motion": {
      "acceleration": { "x": 0, "y": 0, "z": 1 },
      "gyroscope": { "x": 0.1, "y": 0, "z": 0 },
      "orientation": { "x": 0, "y": 0, "z": 0 }
    },
    "status": {
      "battery": {
        "level": 0.72,
        "charging": true,
        "wired": false,
        "low": false
      },
      "connection": {
        "quality": 0.95,
        "latencyMs": 6,
        "packetLoss": 0
      }
    }
  }
}
```

Set `includeExtensions: false` when constructing a `NativeBridgeAdapter` or
`NativeProcessBridgeAdapter` to suppress JSON touchpad/motion/status
extensions. Set
`includeProfileHidReport: false` to suppress profile-specific HID payloads if a
legacy helper expects only the compact XInput/HID fields. Current Linux,
Windows, and macOS helper templates ignore unknown JSON fields, so both
`extensions` and `profileHidReport*` fields are backward compatible with the
existing bridge stream.

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

## Feedback Message

Native helpers can emit JSONL feedback messages on stdout. The SDK still passes
all stdout chunks to `onStdout`, but it also parses complete JSON lines with this
shape and surfaces them through `controller.onFeedback(...)`.

```json
{
  "type": "opencontroller.bridge.feedback",
  "version": 1,
  "controllerId": "player-1",
  "timestamp": 1770000000000,
  "feedbackType": "rumble",
  "reportFormat": "hid-gamepad-rumble",
  "reportId": 2,
  "reportBase64": "AkD/AIU=",
  "weakMotor": 0.25,
  "strongMotor": 1,
  "leftTriggerMotor": 0,
  "rightTriggerMotor": 0.52,
  "durationMs": 80
}
```

`reportBase64` is the 5-byte HID rumble output report documented in
[HID Gamepad Reports](hid-gamepad-reports.md). The normalized motor fields make
the same event easy for agents to consume without decoding bytes.

Helpers can also emit lightbar or player-indicator feedback:

```json
{
  "type": "opencontroller.bridge.feedback",
  "version": 1,
  "controllerId": "player-1",
  "timestamp": 1770000000000,
  "feedbackType": "lights",
  "reportFormat": "hid-gamepad-lights",
  "reportId": 5,
  "reportBase64": "BRpm/78BAg==",
  "red": 0.1,
  "green": 0.4,
  "blue": 1,
  "brightness": 0.75,
  "playerIndex": 1,
  "playerLightMask": 2
}
```

For light feedback, `reportBase64` is the 7-byte HID light output report. RGB
and brightness fields are normalized from `0` to `1`; `playerIndex` and
`playerLightMask` are unsigned byte fields for player LEDs and related host
indicators.

## Parse Messages

```ts
import {
  nativeBridgeFeedbackMessageToControllerFeedback,
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

if (message.type === "opencontroller.bridge.feedback") {
  const feedback = nativeBridgeFeedbackMessageToControllerFeedback(message);
  // Forward host feedback back to the agent, telemetry, or replay pipeline.
}
```

Platform packages can either consume the XInput bytes directly or convert them
to a descriptor-backed HID report. New descriptor-backed bridges should consume
`hidReportBase64` directly. The Windows VHF helpers generate a host bridge C
template that reads this JSONL stream from stdin and submits HID reports to the
VHF driver with `DeviceIoControl`. The HID payload also carries Home/Guide/PS
and auxiliary Capture/Touchpad controls; the XInput compatibility payload keeps
the standard XInput button mask and omits those system controls.

Native host bridges should use `controllerId` to isolate devices when a stream
contains multiple agents. OpenController adapters pass the selected ID through
`OPENCONTROLLER_CONTROLLER_ID`; Linux and generated Windows helpers also accept
`--controller-id`.
