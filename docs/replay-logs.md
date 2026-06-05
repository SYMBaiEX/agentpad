# Replay Logs

Replay logs are JSONL files that record commands, states, host feedback, and
errors.

```ts
const controller = await createController({
  profile: "xbox",
  adapter: "dry-run",
  replay: {
    dir: "replays/session-001",
    source: "agent-runner"
  }
});
```

Directory shape:

```txt
replays/session-001/
  session.json
  events.jsonl
  commands.jsonl
  states.jsonl
  feedback.jsonl
  errors.jsonl
```

`events.jsonl` contains every replay event in timestamp order. The split files
make common review tasks easier:

- `commands.jsonl`: normalized controller commands with before/after state
- `states.jsonl`: full state snapshots, including `status` and `feedback`
- `feedback.jsonl`: host rumble/light output events plus `stateAfter`
- `errors.jsonl`: command processing errors

Inspect a replay:

```bash
opencontroller replay ./replays/session-001/events.jsonl
```
