# macOS DriverKit

`@opencontroller/native-macos-driverkit` prepares the macOS virtual HID path for
OpenController.

The package emits DriverKit-ready HID descriptor/report assets, Info.plist and
entitlement templates, and local authoring diagnostics. It does not install a
DriverKit extension yet. Apple requires a host app, approved DriverKit
entitlements, code signing, notarization, and user-approved System Extension
activation.

Relevant Apple references:

- [DriverKit](https://developer.apple.com/documentation/driverkit)
- [IOUserHIDDevice](https://developer.apple.com/documentation/hiddriverkit/iouserhiddevice)
- [Installing System Extensions and Drivers](https://developer.apple.com/documentation/systemextensions/installing-system-extensions-and-drivers)
- [System Extensions and DriverKit](https://developer.apple.com/system-extensions/)

## Install From The Monorepo

```bash
bun install
bun --cwd packages/native-macos-driverkit build
```

## Diagnose

```bash
opencontroller-macos-driverkit-doctor
opencontroller-macos-driverkit-doctor --json
opencontroller-macos-driverkit-doctor --check
```

The doctor checks:

- whether the current platform is macOS
- whether Xcode tooling is discoverable
- whether `codesign` is discoverable
- whether `systemextensionsctl` is discoverable

It cannot verify Apple Developer Program entitlement approval.

## DriverKit Assets

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

const reportBytes = macosDriverKitInputReportBytesFromNativeBridgeMessage(message);
const infoPlist = createMacosDriverKitInfoPlist();
```

The descriptor and input report bytes come from the shared
[HID Gamepad Reports](hid-gamepad-reports.md) contract.

## Current Limitations

- no macOS DriverKit source target yet
- no host app SystemExtensions activation flow yet
- no signing, notarization, or entitlement automation
- no automatic driver installation
