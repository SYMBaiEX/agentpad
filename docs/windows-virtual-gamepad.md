# Windows Virtual Gamepad

`@opencontroller/native-windows-virtual-gamepad` is the Windows compatibility
package for OpenController.

The package now focuses on Microsoft Virtual HID Framework (VHF) preparation,
XUSB report helpers, and diagnostics for legacy ViGEmBus installations. ViGEmBus
is still common in Windows gamepad tooling, but the original project has been
retired and archived, so OpenController does not treat it as the final Windows
backend. See the
[official ViGEmBus repository](https://github.com/nefarius/ViGEmBus) and
[project status page](https://vigembusdriver.com/) for that upstream status.

For the VHF direction, see Microsoft's
[Virtual HID Framework documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/hid/virtual-hid-framework--vhf-).

## Install From The Monorepo

```bash
bun install
bun --cwd packages/native-windows-virtual-gamepad build
```

## Diagnose

```bash
opencontroller-windows-gamepad-doctor
opencontroller-windows-gamepad-doctor --json
opencontroller-windows-gamepad-doctor --check
```

The doctor checks:

- whether the current platform is Windows
- whether the legacy `ViGEmBus` service appears installed
- whether the service is running
- what compatibility/safety recommendations apply

It does not install drivers. That is deliberate: Windows virtual input drivers
are sensitive system components and should stay explicit and inspectable.

## VHF Assets

VHF is Microsoft's maintained virtual HID path. It requires a kernel-mode HID
source driver that calls `VhfCreate`, loads `vhf` as a lower filter, and submits
HID input reports to Windows. OpenController does not install that driver yet,
but this package now emits the OpenController-specific pieces a driver needs.

```bash
opencontroller-windows-vhf-assets --descriptor-c
opencontroller-windows-vhf-assets --inf
```

```ts
import {
  createWindowsVhfInf,
  windowsVhfInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-windows-virtual-gamepad/vhf";

const reportBytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
const infTemplate = createWindowsVhfInf();
```

The descriptor and input report bytes come from the shared
[HID Gamepad Reports](hid-gamepad-reports.md) contract. The INF template includes
the required `LowerFilters` entry for `vhf`.

## XUSB Reports

```ts
import {
  windowsXusbReportFromNativeBridgeMessage,
} from "@opencontroller/native-windows-virtual-gamepad";

const report = windowsXusbReportFromNativeBridgeMessage(message);
```

The report shape is the same packed XUSB/XInput layout OpenController already
emits for native bridge processes.

## Current Limitations

- no Windows helper process yet
- VHF driver source/signing/install flow is not implemented yet
- no automatic driver installation
- legacy ViGEmBus diagnostics are compatibility-only
