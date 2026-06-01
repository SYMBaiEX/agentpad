# Adapters

Adapters receive normalized controller commands from the runtime.

Current adapters:

- `dry-run`
- `websocket`
- `xinput-report`
- `native-bridge`
- `NativeProcessBridgeAdapter`

Adapters receive normalized commands from the runtime. Adapters can also
implement `syncState(state)` to receive the complete controller state after each
runtime mutation.

Native virtual controller drivers should use state sync rather than command
events as their primary source of truth. A virtual device usually needs a full
current report every time state changes.

## Capability Metadata

Every adapter returns a `ControllerAdapterCapabilities` object through
`controller.capabilities()`. The original boolean fields are still present, and
new metadata fields make backend selection easier for agents and host apps:

- `supportedProfiles`: profiles accepted by the adapter
- `supportedCommands`: command types accepted by the runtime/adapter path
- `outputFormats`: normalized command, state, WebSocket, XInput, HID, or JSONL outputs
- `reportFormats`: packed report formats such as `xinput`, `hid-gamepad`, and `hid-gamepad-rumble`
- `feedbackTypes`: host feedback channels such as `rumble`
- `transport`: memory, callback, WebSocket, or native process
- `virtualDeviceKind`: none, native helper, or OS virtual gamepad

```ts
const capabilities = controller.capabilities();

if (capabilities.feedbackTypes.includes("rumble")) {
  controller.onFeedback((event) => {
    console.log(event.type, event.weakMotor, event.strongMotor);
  });
}
```

Use `native-bridge` when a separate process needs JSONL messages with packed
XInput report bytes. Use `xinput-report` when code in the same process wants
direct access to reports without a wire format.

Use `NativeProcessBridgeAdapter` when OpenController should spawn and own a
helper process such as `opencontroller-uinput-bridge`. It writes the same JSONL
protocol to helper stdin, sends a disconnect message, closes stdin, and reports
non-zero helper exits as adapter errors.

Before wiring a helper into an app, run the unified native doctor:

```bash
opencontroller native doctor --backend current
opencontroller native doctor --backend all --json
```

The `--check` flag sets a non-zero exit code when the selected backend is not
ready, which makes it useful in local setup scripts and CI smoke checks.

To stage the native backend assets from the same CLI surface, use:

```bash
opencontroller native setup --backend current
```

The setup command dispatches to the Linux, Windows, or macOS setup workflow and
prints reviewed commands without hiding privileged driver or permission changes.
