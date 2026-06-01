# @opencontroller/native

Unified native host bridge adapter selection for OpenController.

This package is the one-import path for SDK users who want OpenController to
choose the native bridge backend for the current host:

- Linux: `@opencontroller/native-linux-uinput`
- Windows: `@opencontroller/native-windows-virtual-gamepad`
- macOS: `@opencontroller/native-macos-driverkit`

It does not install drivers or bypass platform security. Each platform still
requires its native helper, driver, signing, entitlement, and permission flow.

## Usage

```ts
import { createController } from "@opencontroller/core";
import { createNativeHostBridgeAdapter } from "@opencontroller/native";

const controller = await createController({
  id: "player-1",
  profile: "xbox",
  adapter: createNativeHostBridgeAdapter(),
  replay: false
});

await controller.press("A", 80);
await controller.disconnect();
```

Override backend-specific paths when you have installed helpers somewhere else:

```ts
const adapter = createNativeHostBridgeAdapter({
  linux: {
    helperPath: "/usr/local/bin/opencontroller-uinput-bridge",
    deviceName: "OpenController Virtual Gamepad"
  },
  windows: {
    hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    devicePath: "\\\\.\\OpenControllerVhfGamepad"
  },
  macos: {
    hostBridgePath:
      "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
    driverBundleIdentifier: "com.opencontroller.driverkit.virtual-gamepad"
  }
});
```

Use `backend` when you are preparing assets for a target platform from another
host:

```ts
import {
  defaultNativeHostBridgePath,
  resolveNativeHostBridgeBackend
} from "@opencontroller/native";

console.log(resolveNativeHostBridgeBackend({ platform: "linux" }));
console.log(defaultNativeHostBridgePath({ backend: "macos-driverkit" }));
```

## Backends

| Backend | Host | Native package |
| --- | --- | --- |
| `linux-uinput` | Linux | `@opencontroller/native-linux-uinput` |
| `windows-vhf` | Windows | `@opencontroller/native-windows-virtual-gamepad` |
| `macos-driverkit` | macOS | `@opencontroller/native-macos-driverkit` |
