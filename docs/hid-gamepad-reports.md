# HID Gamepad Reports

OpenController includes a canonical HID gamepad report shape for native virtual
device backends that need a HID descriptor and packed input report bytes.

This is the bridge contract for maintained Windows virtual HID backends, macOS
DriverKit experiments, and any future platform bridge that wants a generic HID
gamepad instead of an XInput-shaped report.

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
import { encodeHidGamepadReport } from "@opencontroller/core/hid";

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
