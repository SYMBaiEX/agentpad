# Replay Logs

Replay logs are JSONL files that record commands, states, and errors.

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
  errors.jsonl
```

Inspect a replay:

```bash
agentpad replay ./replays/session-001/events.jsonl
```
