# Agent Fighter

Agent Fighter is a complete two-player browser game example for OpenController.

Run it:

```bash
bun --cwd examples/agent-fighter dev
```

Open:

```txt
http://127.0.0.1:5173/
```

Controller telemetry:

```txt
http://127.0.0.1:5173/controllers
```

Run a headless match series:

```bash
bun --cwd examples/agent-fighter headless --matches 5 --duration-ms 10000 --output ./agent-fighter-series.json
bun --cwd examples/agent-fighter headless --matches 3 --duration-ms 10000 --min-decisions-per-player 10 --min-total-damage 1
```

The headless runner opens the real browser game in Chromium, starts agents
through the management API, polls telemetry, stops agents after each match, and
writes a JSON series summary. It includes aggregate win rates, decision counts,
HP damage, per-match snapshots, and a `quality` block for benchmark gates. By
default it fails if either player produces zero controller decisions; use
`--min-decisions`, `--min-decisions-per-player`, `--min-total-damage`, and
`--min-rounds` for stricter local or CI checks.

Agents start stopped by default. Start, stop, and reset controls live on the
controller telemetry page. The OpenAI decision loop is also guarded by
`OPENCONTROLLER_OPENAI_ACTIONS_PER_MINUTE` to prevent runaway action volume.

The controller agent loop ticks at `OPENCONTROLLER_AGENT_TICK_MS` (16ms by default)
so trained/local policies can make frame-level decisions. The OpenAI sample
policy defaults to `OPENCONTROLLER_OPENAI_DECISION_MS=0`; model latency and the
per-minute action cap are the practical constraints.

The game reads controller state from two equivalent sources:

- OpenController controllers connected over WebSocket
- physical controllers through the browser Gamepad API

Two autonomous agents start with the server. If `OPENAI_API_KEY` is present,
they use the OpenAI Responses API to choose controller actions. If the key is
absent, local agents drive the same controller channels so the game remains
playable.

The default OpenAI model is `gpt-5.4-mini`. Both agents connect through the
single controller hub endpoint at `ws://127.0.0.1:5173/controller`; each
virtual controller keeps a separate player id (`player-1`, `player-2`).

The active arena snapshot and recent agent decisions persist to the local
SQLite database at `examples/agent-fighter/data/agent-fighter.sqlite`.
Refreshing the browser hydrates the game from that state before the simulation
continues.

Agents can only send controller inputs. The game does not expose direct player
actions to the agents.
