# Adapters

Adapters receive normalized controller commands from the runtime.

Current adapters:

- `dry-run`
- `websocket`
- `xinput-report`

Adapters receive normalized commands from the runtime. Adapters can also
implement `syncState(state)` to receive the complete controller state after each
runtime mutation.

Native virtual controller drivers should use state sync rather than command
events as their primary source of truth. A virtual device usually needs a full
current report every time state changes.
