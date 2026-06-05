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

## Prepare A Reviewed DriverKit Kit

Use the setup command to stage the generated DriverKit source, Info.plist,
entitlements, manifest, README, and reviewed commands in one folder:

```bash
opencontroller-macos-driverkit-setup --output ./opencontroller-macos-driverkit
opencontroller-macos-driverkit-setup --report-profile playstation
opencontroller-macos-driverkit-setup --report-profile switch
opencontroller-macos-driverkit-setup --json
```

The setup command creates files only. It does not sign, notarize, activate, or
install a DriverKit System Extension. Build a host app that embeds the generated
dext assets, sign and notarize both with approved DriverKit entitlements, and
let the user approve System Extension activation.

After the signed host app activates the DriverKit extension, smoke-test the
native path:

```bash
opencontroller native test \
  --backend macos-driverkit \
  --id player-1 \
  --host-bridge-path "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge"
```

## DriverKit Assets

```bash
opencontroller-macos-driverkit-assets --descriptor-cpp
opencontroller-macos-driverkit-assets --driver-cpp
opencontroller-macos-driverkit-assets --driver-h
opencontroller-macos-driverkit-assets --info-plist
opencontroller-macos-driverkit-assets --dext-entitlements
opencontroller-macos-driverkit-assets --host-entitlements
opencontroller-macos-driverkit-assets --manifest
opencontroller-macos-driverkit-assets --driver-cpp --report-profile playstation
opencontroller-macos-driverkit-assets --driver-cpp --report-profile switch
```

```ts
import {
  createMacosDriverKitHostBridgeAdapter,
  createMacosDriverKitDriverSourceFiles,
  createMacosDriverKitInfoPlist,
  macosDriverKitInputReportBytesFromNativeBridgeMessage,
  macosDriverKitPlayStationInputReportBytesFromNativeBridgeMessage,
  macosDriverKitSwitchInputReportBytesFromNativeBridgeMessage,
} from "@opencontroller/native-macos-driverkit/driverkit";

const reportBytes = macosDriverKitInputReportBytesFromNativeBridgeMessage(message);
const infoPlist = createMacosDriverKitInfoPlist();
const sourceFiles = createMacosDriverKitDriverSourceFiles();
const playstationSourceFiles = createMacosDriverKitDriverSourceFiles({
  reportProfile: "playstation"
});
const playstationBytes =
  macosDriverKitPlayStationInputReportBytesFromNativeBridgeMessage(message);
const switchSourceFiles = createMacosDriverKitDriverSourceFiles({
  reportProfile: "switch"
});
const switchBytes =
  macosDriverKitSwitchInputReportBytesFromNativeBridgeMessage(message);
const adapter = createMacosDriverKitHostBridgeAdapter({
  controllerId: "player-1",
  hostBridgePath:
    "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge"
});
```

The descriptor and input report bytes come from the shared
[HID Gamepad Reports](hid-gamepad-reports.md) contract.

The default generated DriverKit device uses the generic 13-byte HID gamepad
report. Use `reportProfile: "playstation"` or `--report-profile playstation` to
emit the 47-byte `hid-playstation-extended` descriptor/report for touchpad
contacts and motion vectors. Use `reportProfile: "switch"` or
`--report-profile switch` to emit the 31-byte `hid-switch-extended`
descriptor/report for Switch motion vectors.

The generated C++ source is a DriverKit starting point for an `IOUserHIDDevice`
subclass. It returns the selected OpenController report descriptor with rumble
output support, publishes the virtual gamepad description, keeps a neutral input
report sized to the chosen profile, accepts host output reports through `setReport`, and
exposes `updateInputReport` plus `copyRumbleReport` entry points for a signed
host app/user-client bridge.

## Host Bridge Adapter

Once a signed host app/bridge exists, use
`createMacosDriverKitHostBridgeAdapter` to let OpenController spawn it and stream
native bridge JSONL to stdin:

```ts
import { createController } from "@opencontroller/core";
import {
  createMacosDriverKitHostBridgeAdapter
} from "@opencontroller/native-macos-driverkit/driverkit";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createMacosDriverKitHostBridgeAdapter({
    controllerId: "player-1",
    driverBundleIdentifier: "com.opencontroller.driverkit.virtual-gamepad",
    driverClassName: "OpenControllerVirtualGamepadDriver"
  }),
  replay: false
});

await controller.press("A", 80);
await controller.disconnect();
```

The default bridge path is
`~/Library/Application Support/OpenController/bin/OpenControllerDriverKitHostBridge`.
The adapter passes `OPENCONTROLLER_DRIVERKIT_HOST_APP_BUNDLE_ID`,
`OPENCONTROLLER_DRIVERKIT_DRIVER_BUNDLE_ID`, and
`OPENCONTROLLER_DRIVERKIT_SERVICE_NAME` to the process so a host bridge can bind
to the intended DriverKit service. It also passes
`OPENCONTROLLER_CONTROLLER_ID` when `controllerId` is provided so the host bridge
can ignore other controllers in a shared multi-agent stream.

For haptics, the generated DriverKit source stores the latest 5-byte HID rumble
output report. A signed host bridge can poll `copyRumbleReport`, encode the
bytes as the shared `"hid-gamepad-rumble"` feedback payload, and write
`opencontroller.bridge.feedback` JSONL to stdout so `controller.onFeedback(...)`
receives the event.

## Current Limitations

- no host app SystemExtensions activation flow yet
- no signed host bridge binary included yet
- no signing, notarization, or entitlement automation; setup emits reviewed
  source files and commands only
- no automatic driver installation or System Extension activation
