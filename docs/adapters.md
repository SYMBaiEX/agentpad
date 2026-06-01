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

Use `native-bridge` when a separate process needs JSONL messages with packed
XInput report bytes. Use `xinput-report` when code in the same process wants
direct access to reports without a wire format.

Use `NativeProcessBridgeAdapter` when OpenController should spawn and own a
helper process such as `opencontroller-uinput-bridge`. It writes the same JSONL
protocol to helper stdin, sends a disconnect message, closes stdin, and reports
non-zero helper exits as adapter errors.
