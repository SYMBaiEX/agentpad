# @opencontroller/native-windows-virtual-gamepad

Windows virtual gamepad compatibility and VHF/HID driver-authoring helpers for
OpenController.

This package is intentionally conservative. The legacy ViGEmBus ecosystem is
still common in Windows gamepad tooling, but the original project has been
retired and archived. OpenController treats it as a compatibility backend rather
than the final Windows story.

Upstream context:

- [official ViGEmBus repository](https://github.com/nefarius/ViGEmBus)
- [project status page](https://vigembusdriver.com/)

This package provides:

- VHF-ready HID report descriptor and input report helpers
- INF, WDK C source, and C-array asset generators for a maintained Windows VHF
  driver path
- `createWindowsVhfHostBridgeAdapter` for SDK-owned user-mode host bridge
  processes after the VHF driver and host bridge have been built
- `opencontroller-windows-vhf-setup` for staging reviewed VHF driver/host source
  files and install/test commands without making privileged changes
- XUSB report helpers compatible with OpenController's XInput report format
- `opencontroller-windows-gamepad-doctor` for legacy ViGEmBus service checks
- documentation and tests that leave room for future maintained Windows virtual
  device backends

## Diagnose Legacy ViGEmBus

```bash
opencontroller-windows-gamepad-doctor
opencontroller-windows-gamepad-doctor --json
opencontroller-windows-gamepad-doctor --check
```

The doctor runs `sc.exe query ViGEmBus` on Windows and reports whether the
legacy service appears installed and running. It does not install drivers or
download binaries.

## Prepare A VHF Setup Kit

```bash
opencontroller-windows-vhf-setup --output ./opencontroller-windows-vhf
opencontroller-windows-vhf-setup --json
```

The setup command writes a driver source folder, host bridge source folder,
INF template, README, and reviewed PowerShell commands. It does not install,
sign, or trust a driver package.

After reviewing, building, and signing the KMDF/VHF driver package with the
Windows Driver Kit, install the INF from an elevated terminal:

```powershell
pnputil /add-driver ".\opencontroller-windows-vhf\driver\OpenControllerVhfGamepad.inf" /install
```

Then test the installed driver and host bridge:

```powershell
opencontroller native test --backend windows-vhf --id player-1 --host-bridge-path "C:\OpenController\bin\OpenControllerVhfHostBridge.exe"
```

## VHF Assets

Microsoft's Virtual HID Framework is the maintained Windows path this package is
preparing for. VHF still requires a signed kernel-mode HID source driver; these
helpers provide the OpenController-specific descriptor, report bytes, and INF
template inputs for that driver.

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

const bytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
const inf = createWindowsVhfInf();
const driverSourceFiles = createWindowsVhfDriverSourceFiles();
const hostBridgeFiles = createWindowsVhfHostBridgeSourceFiles();
```

The generated INF template includes the VHF lower filter declaration required
for a HID source driver. Treat it as source material for a real signed driver
package, not as an installer.

The generated C source wires the OpenController HID descriptor into VHF and
submits 13-byte input reports through `VhfReadReportSubmit`. Treat it as the
WDK project starting point, then add signing, installation, and a user-mode host
bridge that writes the buffered IOCTL.

The generated host bridge C source is the user-mode side of that handoff. It
reads OpenController native bridge JSONL from stdin, prefers direct
`hidReportBase64` payloads, falls back to converting legacy `reportBase64`
XInput bytes, opens the driver device path, and sends reports with
`DeviceIoControl`. Set `OPENCONTROLLER_CONTROLLER_ID` or pass
`--controller-id` to bind a host bridge process to one controller from a shared
multi-agent stream.

After building and reviewing that host bridge, SDK code can own the process:

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

## Report Helpers

```ts
import {
  windowsXusbReportFromNativeBridgeMessage,
} from "@opencontroller/native-windows-virtual-gamepad";

const report = windowsXusbReportFromNativeBridgeMessage(message);
```

The report shape matches the XUSB/XInput field order used by common Windows
virtual gamepad client APIs:

- buttons
- left trigger
- right trigger
- left stick X/Y
- right stick X/Y

## Safety

Only install signed drivers from sources you trust. Avoid random driver mirrors
and bundles. Virtual input drivers run with sensitive system privileges.
