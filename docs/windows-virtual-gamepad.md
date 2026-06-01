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

## Prepare A Reviewed VHF Kit

Use the setup command to stage the generated driver source, INF, host bridge
source, README, and reviewed commands in one folder:

```bash
opencontroller-windows-vhf-setup --output ./opencontroller-windows-vhf
opencontroller-windows-vhf-setup --json
```

The setup command creates files only. It does not install drivers, sign
packages, or make privileged system changes. Build and sign the generated
KMDF/VHF driver package with the Windows Driver Kit, then install the reviewed
INF from an elevated Windows terminal:

```powershell
pnputil /add-driver ".\opencontroller-windows-vhf\driver\OpenControllerVhfGamepad.inf" /install
```

After the signed driver and user-mode host bridge are installed, smoke-test the
native path:

```powershell
opencontroller native test --backend windows-vhf --id player-1 --host-bridge-path "C:\OpenController\bin\OpenControllerVhfHostBridge.exe"
```

## VHF Assets

VHF is Microsoft's maintained virtual HID path. It requires a kernel-mode HID
source driver that calls `VhfCreate`, loads `vhf` as a lower filter, and submits
HID input reports to Windows. OpenController does not install that driver yet,
but this package now emits the OpenController-specific pieces a driver needs.

```bash
opencontroller-windows-vhf-assets --descriptor-c
opencontroller-windows-vhf-assets --driver-c
opencontroller-windows-vhf-assets --driver-h
opencontroller-windows-vhf-assets --host-c
opencontroller-windows-vhf-assets --host-h
opencontroller-windows-vhf-assets --inf
```

```ts
import {
  createWindowsVhfDriverSourceFiles,
  createWindowsVhfHostBridgeSourceFiles,
  createWindowsVhfInf,
  windowsVhfInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-windows-virtual-gamepad/vhf";

const reportBytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
const infTemplate = createWindowsVhfInf();
const driverSourceFiles = createWindowsVhfDriverSourceFiles();
const hostBridgeFiles = createWindowsVhfHostBridgeSourceFiles();
```

The descriptor and input report bytes come from the shared
[HID Gamepad Reports](hid-gamepad-reports.md) contract. The INF template includes
the required `LowerFilters` entry for `vhf`.

The generated driver source is a WDK/KMDF starting point that wires the shared
descriptor into `VHF_CONFIG_INIT`, creates and starts a VHF device, accepts a
13-byte OpenController HID input report through a buffered IOCTL, and submits it
with `VhfReadReportSubmit`. It still needs a signed driver package and a
reviewed user-mode host path before installation.

The generated host bridge C source reads OpenController native bridge JSONL from
stdin, prefers direct `hidReportBase64` payloads, falls back to converting
legacy `reportBase64` XInput packets, opens the VHF driver with `CreateFileA`,
and writes 13-byte HID reports through `DeviceIoControl`. Set
`OPENCONTROLLER_CONTROLLER_ID` or pass `--controller-id` when the host bridge is
reading a shared stream so each virtual device only reacts to its assigned
controller.

After the driver and host bridge are built and reviewed, SDK code can spawn the
host bridge directly:

```ts
import { createController } from "@opencontroller/core";
import {
  createWindowsVhfHostBridgeAdapter
} from "@opencontroller/native-windows-virtual-gamepad/vhf";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createWindowsVhfHostBridgeAdapter({
    controllerId: "player-1",
    hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    devicePath: "\\\\.\\OpenControllerVhfGamepad"
  }),
  replay: false
});
```

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

- VHF signing/install flow is not implemented yet
- no automatic driver installation; setup emits reviewed source files and
  commands only
- generated host bridge source still needs a Windows build project and signed
  device install verification
- legacy ViGEmBus diagnostics are compatibility-only
