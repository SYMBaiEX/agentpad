# XInput Reports

OpenController can encode controller state into a compact XInput-compatible
gamepad report.

This is not a native driver by itself. It is the bridge contract that a native
process can consume when writing to ViGEm, `uinput`, DriverKit, or another
platform-specific virtual controller backend.

For an ordered JSONL wire protocol that carries these bytes to a separate
process, see [Native Bridge Protocol](native-bridge-protocol.md).

```ts
import {
  XInputReportAdapter,
  createController,
  decodeXInputReport
} from "@opencontroller/core";

const adapter = new XInputReportAdapter({
  onReport({ controllerId, bytes }) {
    // Send bytes to a native virtual-device bridge.
    console.log(controllerId, bytes);
  }
});

const controller = await createController({
  profile: "xbox",
  adapter,
  replay: false
});

await controller.press("A", 80);
await controller.trigger("RT", 0.5, 100);

const latest = adapter.reports.at(-1);
if (latest) {
  console.log(decodeXInputReport(latest.bytes));
}
```

The encoded report is 12 bytes:

| Offset | Field | Type |
| --- | --- | --- |
| `0` | buttons | `uint16le` |
| `2` | left trigger | `uint8` |
| `3` | right trigger | `uint8` |
| `4` | left stick X | `int16le` |
| `6` | left stick Y | `int16le` |
| `8` | right stick X | `int16le` |
| `10` | right stick Y | `int16le` |

Stick values are normalized from OpenController's `-1..1` range into XInput's
signed 16-bit range. OpenController uses `y = -1` for up, so Y axes are inverted
when encoded into XInput's positive-up convention.
