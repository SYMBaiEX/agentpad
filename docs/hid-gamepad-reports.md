# HID Gamepad Reports

OpenController includes a canonical HID gamepad report shape for native virtual
device backends that need a HID descriptor and packed input report bytes.

This is the bridge contract for maintained Windows virtual HID backends, macOS
DriverKit experiments, and any future platform bridge that wants a generic HID
gamepad instead of an XInput-shaped report.

## Report Descriptor

```ts
import { hidGamepadReportDescriptor } from "@opencontroller/core/hid";
```

The descriptor declares:

- one gamepad application collection
- report id `1`
- 16 one-bit buttons
- four signed 16-bit stick axes: `X`, `Y`, `Rx`, `Ry`
- two unsigned 8-bit trigger axes: `Z`, `Rz`

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
