# @opencontroller/native-macos-driverkit

macOS DriverKit HID virtual gamepad assets and diagnostics for OpenController.

This package prepares the macOS path toward OS-level virtual controller
emulation. It does not install a DriverKit extension yet; Apple requires a host
app, approved entitlements, code signing, notarization, and user-approved System
Extension activation.

This package provides:

- DriverKit-ready HID report descriptor and input report helpers
- Info.plist and entitlement templates for a virtual HID gamepad dext
- C++ DriverKit source and byte-array asset generation
- `createMacosDriverKitHostBridgeAdapter` for SDK-owned host bridge processes
- `opencontroller-macos-driverkit-setup` for staging reviewed DriverKit/host
  source files and activation/test commands without privileged changes
- `opencontroller-macos-driverkit-doctor` for local tool checks

Upstream context:

- [DriverKit](https://developer.apple.com/documentation/driverkit)
- [IOUserHIDDevice](https://developer.apple.com/documentation/hiddriverkit/iouserhiddevice)
- [Installing System Extensions and Drivers](https://developer.apple.com/documentation/systemextensions/installing-system-extensions-and-drivers)

## Prepare A DriverKit Setup Kit

```bash
opencontroller-macos-driverkit-setup --output ./opencontroller-macos-driverkit
opencontroller-macos-driverkit-setup --json
```

The setup command writes a DriverKit extension source folder, host app
entitlements, manifest, README, and reviewed commands. It does not sign,
notarize, activate, or trust a DriverKit System Extension.

After reviewing the generated files, attach them to a DriverKit-capable Xcode
project, build a host app that embeds the dext, sign and notarize both with
approved DriverKit entitlements, and let the user approve activation. Then test
the installed host bridge:

```bash
opencontroller native test \
  --backend macos-driverkit \
  --host-bridge-path "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge"
```

## Assets

```bash
opencontroller-macos-driverkit-assets --descriptor-cpp
opencontroller-macos-driverkit-assets --driver-cpp
opencontroller-macos-driverkit-assets --driver-h
opencontroller-macos-driverkit-assets --info-plist
opencontroller-macos-driverkit-assets --dext-entitlements
opencontroller-macos-driverkit-assets --host-entitlements
opencontroller-macos-driverkit-assets --manifest
```

```ts
import {
  createMacosDriverKitDriverSourceFiles,
  createMacosDriverKitInfoPlist,
  macosDriverKitInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-macos-driverkit/driverkit";

const bytes = macosDriverKitInputReportBytesFromNativeBridgeMessage(message);
const infoPlist = createMacosDriverKitInfoPlist();
const sourceFiles = createMacosDriverKitDriverSourceFiles();
```

The generated assets are source material for a DriverKit project. Review the
bundle identifiers, team identifier, entitlements, and IOKit personality before
building or signing a real dext.

The generated C++ source subclasses `IOUserHIDDevice`, returns the shared
OpenController report descriptor, exposes a neutral input report, and leaves the
host app/user-client update path explicit.

## Host Bridge Adapter

After you build and sign a host app/bridge that activates the DriverKit system
extension and accepts OpenController native bridge JSONL on stdin, the SDK can
own the process lifecycle:

```ts
import { createController } from "@opencontroller/core";
import {
  createMacosDriverKitHostBridgeAdapter
} from "@opencontroller/native-macos-driverkit/driverkit";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createMacosDriverKitHostBridgeAdapter({
    hostBridgePath:
      "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
    driverBundleIdentifier: "com.opencontroller.driverkit.virtual-gamepad",
    driverClassName: "OpenControllerVirtualGamepadDriver"
  }),
  replay: false
});

await controller.press("A", 80);
await controller.disconnect();
```

The adapter streams descriptor-backed `hidReportBase64` payloads to the host
bridge process and exports the driver identity through
`OPENCONTROLLER_DRIVERKIT_*` environment variables. It does not bypass Apple's
signing, notarization, entitlement, or user-approval requirements.

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
