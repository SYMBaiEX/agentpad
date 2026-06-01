# @opencontroller/native-macos-driverkit

macOS DriverKit HID virtual gamepad assets and diagnostics for OpenController.

This package prepares the macOS path toward OS-level virtual controller
emulation. It does not install a DriverKit extension yet; Apple requires a host
app, approved entitlements, code signing, notarization, and user-approved System
Extension activation.

This package provides:

- DriverKit-ready HID report descriptor and input report helpers
- Info.plist and entitlement templates for a virtual HID gamepad dext
- C++ byte-array asset generation for DriverKit source
- `opencontroller-macos-driverkit-doctor` for local tool checks

Upstream context:

- [DriverKit](https://developer.apple.com/documentation/driverkit)
- [IOUserHIDDevice](https://developer.apple.com/documentation/hiddriverkit/iouserhiddevice)
- [Installing System Extensions and Drivers](https://developer.apple.com/documentation/systemextensions/installing-system-extensions-and-drivers)

## Assets

```bash
opencontroller-macos-driverkit-assets --descriptor-cpp
opencontroller-macos-driverkit-assets --info-plist
opencontroller-macos-driverkit-assets --dext-entitlements
opencontroller-macos-driverkit-assets --host-entitlements
opencontroller-macos-driverkit-assets --manifest
```

```ts
import {
  createMacosDriverKitInfoPlist,
  macosDriverKitInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-macos-driverkit/driverkit";

const bytes = macosDriverKitInputReportBytesFromNativeBridgeMessage(message);
const infoPlist = createMacosDriverKitInfoPlist();
```

The generated assets are source material for a DriverKit project. Review the
bundle identifiers, team identifier, entitlements, and IOKit personality before
building or signing a real dext.

## Diagnose

```bash
opencontroller-macos-driverkit-doctor
opencontroller-macos-driverkit-doctor --json
opencontroller-macos-driverkit-doctor --check
```

The doctor checks local authoring tools such as Xcode, `codesign`, and
`systemextensionsctl`. It cannot verify that Apple has approved the DriverKit
entitlements for your developer account.

## Safety

DriverKit is safer than legacy kernel extensions, but virtual HID drivers still
need explicit user trust. Keep install/activation flows visible and reversible,
and never hide input injection from the user.
