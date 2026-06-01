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

- VHF-ready HID report descriptor, input report helpers, and rumble output
  report codecs
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
opencontroller-windows-vhf-assets --driver-c --report-profile playstation
```

```ts
import {
  createWindowsVhfDriverSourceFiles,
  createWindowsVhfHostBridgeSourceFiles,
  createWindowsVhfInf,
  windowsVhfInputReportBytesFromNativeBridgeMessage,
  windowsVhfPlayStationInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-windows-virtual-gamepad/vhf";

const bytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
const inf = createWindowsVhfInf();
const driverSourceFiles = createWindowsVhfDriverSourceFiles();
const hostBridgeFiles = createWindowsVhfHostBridgeSourceFiles();
```

The generic VHF assets use the shared 13-byte HID gamepad report by default.
Generate a matching PlayStation driver and host bridge with
`reportProfile: "playstation"` when the virtual device should expose
OpenController's 47-byte `hid-playstation-extended` report:

```ts
const driverSourceFiles = createWindowsVhfDriverSourceFiles({
  reportProfile: "playstation"
});
const hostBridgeFiles = createWindowsVhfHostBridgeSourceFiles({
  reportProfile: "playstation"
});

const bytes =
  windowsVhfPlayStationInputReportBytesFromNativeBridgeMessage(message);
```

The setup command accepts the same profile flag:

```bash
opencontroller-windows-vhf-setup --report-profile playstation
```

The generated INF template includes the VHF lower filter declaration required
for a HID source driver. Treat it as source material for a real signed driver
package, not as an installer.

The generated C source wires the OpenController HID descriptor with rumble
output into VHF, submits input reports through `VhfReadReportSubmit`,
and captures HID output reports through `EvtVhfAsyncOperationWriteReport`. Treat
it as the WDK project starting point, then add signing, installation, and the
generated user-mode host bridge.

The generated host bridge C source is the user-mode side of that handoff. It
reads OpenController native bridge JSONL from stdin, prefers direct
`hidReportBase64` payloads, falls back to converting legacy `reportBase64`
XInput bytes, opens the driver device path, and sends reports with
`DeviceIoControl`. It also polls the driver's rumble IOCTL from a feedback
thread and prints `opencontroller.bridge.feedback` JSONL on stdout for
`controller.onFeedback(...)`. Set `OPENCONTROLLER_CONTROLLER_ID` or pass
`--controller-id` to bind a host bridge process to one controller from a shared
multi-agent stream.

When generated with `reportProfile: "playstation"`, the host bridge prefers
`profileHidReportBase64` so PlayStation touchpad and motion bytes reach the VHF
driver instead of being reduced to the common gamepad subset.

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
    supportsRumble: true,
    hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    devicePath: "\\\\.\\OpenControllerVhfGamepad"
  }),
  replay: false
});

controller.onFeedback((event) => {
  if (event.type === "rumble") {
    console.log(event.weakMotor, event.strongMotor);
  }
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
