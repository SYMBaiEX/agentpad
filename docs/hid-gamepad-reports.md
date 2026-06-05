# HID Gamepad Reports

OpenController includes a canonical HID gamepad report shape for native virtual
device backends that need a HID descriptor and packed input report bytes.

This is the bridge contract for maintained Windows virtual HID backends, macOS
DriverKit experiments, and any future platform bridge that wants a generic HID
gamepad instead of an XInput-shaped report.

OpenController also includes a profile-specific PlayStation extended input
report for bridge authors who need packed touchpad and motion bytes instead of
JSON-only extensions.

## Report Descriptor

```ts
import {
  hidGamepadReportDescriptor,
  hidGamepadReportDescriptorWithRumble
} from "@opencontroller/core/hid";
```

The descriptor declares:

- one gamepad application collection
- report id `1`
- 16 one-bit buttons
- four signed 16-bit stick axes: `X`, `Y`, `Rx`, `Ry`
- two unsigned 8-bit trigger axes: `Z`, `Rz`

`hidGamepadReportDescriptorWithRumble` extends the same input descriptor with a
vendor-defined output report for native backends that are ready to receive
haptics from the host.

## Input Report Bytes

```ts
import {
  HidGamepadReportAdapter,
  createController
} from "@opencontroller/core";
import { encodeHidGamepadReport } from "@opencontroller/core/hid";

const adapter = new HidGamepadReportAdapter({
  onReport({ controllerId, bytes }) {
    console.log(controllerId, bytes);
  },
  onFeedback(event) {
    console.log("rumble", event.weakMotor, event.strongMotor);
  }
});

const controller = await createController({
  profile: "xbox",
  adapter,
  replay: false
});

const bytes = encodeHidGamepadReport(controller.getState());
```

The encoded report is 13 bytes:

| Offset | Size | Field |
| --- | --- | --- |
| `0` | 1 byte | report id |
| `1` | 2 bytes | button bitfield, little-endian |
| `3` | 2 bytes | left stick X, little-endian signed int16 |
| `5` | 2 bytes | left stick Y, little-endian signed int16 |
| `7` | 2 bytes | right stick X, little-endian signed int16 |
| `9` | 2 bytes | right stick Y, little-endian signed int16 |
| `11` | 1 byte | left trigger |
| `12` | 1 byte | right trigger |

Button bits match the existing XInput button mapping. D-pad directions are
represented as buttons so the same report can be derived from every current
OpenController profile.

Descriptor-backed HID reports also reserve the two XInput-compatible unused
button bits for system controls:

| Bit | Control |
| --- | --- |
| `0x0400` | Home / Guide / PS |
| `0x0800` | Capture or Touchpad auxiliary control |

These bits are intentionally HID-only. The 12-byte XInput compatibility payload
keeps the standard XInput button mask and does not carry Home, Capture, or
Touchpad.

## Native Bridge Conversion

```ts
import {
  encodeHidGamepadReport,
  hidGamepadReportFromNativeBridgeMessage,
} from "@opencontroller/core/hid";

const report = hidGamepadReportFromNativeBridgeMessage(message);
const bytes = encodeHidGamepadReport(report);
```

Native bridge processes can keep consuming the existing JSONL protocol and
convert each state message into this HID report when their platform API expects
descriptor-backed HID input. New native bridge messages also include
`hidReportBase64`, so descriptor-backed drivers can consume the packed 13-byte
report directly and use `hidGamepadReportFromNativeBridgeMessage` as a checked
fallback.

## PlayStation Extended Input Report

```ts
import {
  HidPlayStationExtendedReportAdapter,
  createController
} from "@opencontroller/core";
import {
  decodeHidPlayStationExtendedReport,
  encodeHidPlayStationExtendedReport,
  hidPlayStationExtendedReportDescriptor
} from "@opencontroller/core/hid";

const adapter = new HidPlayStationExtendedReportAdapter({
  onReport({ bytes }) {
    console.log(bytes);
  }
});

const controller = await createController({
  profile: "playstation",
  adapter,
  replay: false
});

const bytes = encodeHidPlayStationExtendedReport(controller.getState());
const report = decodeHidPlayStationExtendedReport(bytes);
```

The PlayStation extended report uses report id `3` and is 47 bytes. The first
13 bytes mirror the common HID gamepad report layout. The remaining bytes carry
two touchpad contacts plus signed motion vectors:

| Offset | Size | Field |
| --- | --- | --- |
| `0` | 1 byte | report id `3` |
| `1` | 12 bytes | common gamepad payload: buttons, sticks, triggers |
| `13` | 1 byte | touchpad pressed flag |
| `14` | 1 byte | active touch contact count, max `2` |
| `15` | 7 bytes | contact 0: id, active, x uint16, y uint16, pressure |
| `22` | 7 bytes | contact 1: id, active, x uint16, y uint16, pressure |
| `29` | 6 bytes | acceleration X/Y/Z signed int16 |
| `35` | 6 bytes | gyroscope X/Y/Z signed int16 |
| `41` | 6 bytes | orientation X/Y/Z signed int16 |

Touch coordinates are normalized from `0` to `1` into unsigned 16-bit values.
Touch pressure is normalized from `0` to `1` into an unsigned byte. Motion
vectors are clamped to `-1` through `1` and encoded as signed 16-bit values.

Native bridge state messages for PlayStation profiles include
`profileHidReportFormat: "hid-playstation-extended"` and
`profileHidReportBase64` by default. Set `includeProfileHidReport: false` on
`NativeBridgeAdapter` or `NativeProcessBridgeAdapter` to keep a legacy compact
stream.

## Rumble Output Report

```ts
import {
  decodeHidGamepadRumbleReport,
  encodeHidGamepadRumbleReport
} from "@opencontroller/core/hid";

const bytes = encodeHidGamepadRumbleReport({
  weakMotor: 0.25,
  strongMotor: 1,
  leftTriggerMotor: 0,
  rightTriggerMotor: 0.5
});

const report = decodeHidGamepadRumbleReport(bytes);
```

The rumble output report is 5 bytes:

| Offset | Size | Field |
| --- | --- | --- |
| `0` | 1 byte | report id `2` |
| `1` | 1 byte | weak/high-frequency motor |
| `2` | 1 byte | strong/low-frequency motor |
| `3` | 1 byte | left trigger motor |
| `4` | 1 byte | right trigger motor |

Effect inputs are normalized from `0` to `1` and encoded as unsigned bytes. The
descriptor uses a vendor-defined output report because HID gamepad haptics are
not consistently standardized across platforms. Native host bridges should
translate this report to the platform's preferred rumble API when available.
Helpers can report host haptics back to the SDK by emitting an
`opencontroller.bridge.feedback` JSONL message whose `reportFormat` is
`"hid-gamepad-rumble"`; process adapters surface those messages through
`controller.onFeedback(...)`.

In-process HID report adapters can surface the same output report without JSONL:

```ts
import { HidGamepadReportAdapter, createController } from "@opencontroller/core";
import { encodeHidGamepadRumbleReport } from "@opencontroller/core/hid";

const adapter = new HidGamepadReportAdapter();
const controller = await createController({
  profile: "xbox",
  adapter,
  replay: false
});

controller.onFeedback((event) => {
  console.log(event.type, event.weakMotor, event.strongMotor);
});

adapter.receiveOutputReport(
  encodeHidGamepadRumbleReport({
    weakMotor: 0.25,
    strongMotor: 0.8
  })
);
```
