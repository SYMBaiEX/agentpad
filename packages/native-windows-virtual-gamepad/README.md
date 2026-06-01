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
- INF and C-array asset generators for a maintained Windows VHF driver path
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

## VHF Assets

Microsoft's Virtual HID Framework is the maintained Windows path this package is
preparing for. VHF still requires a signed kernel-mode HID source driver; these
helpers provide the OpenController-specific descriptor, report bytes, and INF
template inputs for that driver.

```bash
opencontroller-windows-vhf-assets --descriptor-c
opencontroller-windows-vhf-assets --inf
```

```ts
import {
  createWindowsVhfInf,
  windowsVhfInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-windows-virtual-gamepad/vhf";

const bytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
const inf = createWindowsVhfInf();
```

The generated INF template includes the VHF lower filter declaration required
for a HID source driver. Treat it as source material for a real signed driver
package, not as an installer.

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
