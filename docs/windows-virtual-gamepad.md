# Windows Virtual Gamepad

`@opencontroller/native-windows-virtual-gamepad` is the Windows compatibility
package for OpenController.

The first version focuses on XUSB report helpers and diagnostics for legacy
ViGEmBus installations. ViGEmBus is still common in Windows gamepad tooling, but
the original project has been retired and archived, so OpenController does not
treat it as the final Windows backend. See the
[official ViGEmBus repository](https://github.com/nefarius/ViGEmBus) and
[project status page](https://vigembusdriver.com/) for that upstream status.

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
- legacy ViGEmBus diagnostics only
- no automatic driver installation
- no maintained successor backend integration yet
