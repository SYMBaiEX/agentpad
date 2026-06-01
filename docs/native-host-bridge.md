# Native Host Bridge

`@opencontroller/native` is the one-import SDK path for native virtual
controller backends.

It chooses the platform backend for the current host:

- Linux: `linux-uinput`
- Windows: `windows-vhf`
- macOS: `macos-driverkit`

The package does not install drivers or bypass platform security. It wraps the
native host bridge process after that bridge has been built, installed, and
trusted by the host OS.

## Use The Current Host Backend

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

`createNativeHostBridgeAdapter()` resolves the current platform, spawns the
matching host bridge helper, streams OpenController native bridge JSONL to its
stdin, and sends a disconnect message before closing the stream.

## Override Backend Paths

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

Backend-specific options are passed to the underlying platform package. Common
native process options such as `env`, `cwd`, `waitForExitMs`, and output hooks
can be passed at the top level.

## Smoke Test A Native Bridge

The CLI can send a short button, stick, trigger, and neutral sequence through
the selected native host bridge:

```bash
opencontroller native test --backend current
```

Linux bridge authors can start with dry-run mode before touching `/dev/uinput`:

```bash
opencontroller native test \
  --backend linux-uinput \
  --dry-run \
  --helper-path ~/.opencontroller/bin/opencontroller-uinput-bridge
```

Windows and macOS host bridge paths can be supplied explicitly:

```bash
opencontroller native test \
  --backend windows-vhf \
  --host-bridge-path ./OpenControllerVhfHostBridge.exe
```

The command prints the final controller state and returns a non-zero exit if the
helper process cannot start or exits unsuccessfully.

## Resolve A Target Backend

```ts
import {
  defaultNativeHostBridgePath,
  resolveNativeHostBridgeBackend
} from "@opencontroller/native";

console.log(resolveNativeHostBridgeBackend({ platform: "linux" }));
console.log(defaultNativeHostBridgePath({ backend: "windows-vhf" }));
```

Use this in installers, diagnostics, and agent launchers that need to show the
path OpenController expects before a bridge binary is present.

## Backend Packages

| Backend | Host | Package |
| --- | --- | --- |
| `linux-uinput` | Linux | `@opencontroller/native-linux-uinput` |
| `windows-vhf` | Windows | `@opencontroller/native-windows-virtual-gamepad` |
| `macos-driverkit` | macOS | `@opencontroller/native-macos-driverkit` |
