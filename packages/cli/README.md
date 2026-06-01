# @opencontroller/cli

Command line tools for OpenController.

The CLI is useful for local setup checks, dry-run controller tests, OBS overlay
development, replay summaries, and native bridge smoke tests.

## Install

```bash
npm install -D @opencontroller/cli
```

Then run:

```bash
npx opencontroller doctor
```

## Commands

```bash
opencontroller init
opencontroller doctor
opencontroller test --profile xbox --adapter dry-run
opencontroller overlay --profile xbox --port 4317
opencontroller replay ./replays/session/events.jsonl
opencontroller bridge --id player-1
opencontroller native doctor --backend current
opencontroller native setup --backend current
opencontroller native test --backend linux-uinput --dry-run --id player-1
```

## Native Backends

The CLI delegates native setup and diagnostics to the platform packages:

- `@opencontroller/native-linux-uinput`
- `@opencontroller/native-windows-virtual-gamepad`
- `@opencontroller/native-macos-driverkit`

OpenController does not install unsigned drivers or silently change system
permissions. Setup commands generate reviewed plans, helper assets, or local
test commands so users can make explicit platform decisions.
