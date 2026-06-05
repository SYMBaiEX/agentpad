# OpenController Agent Fighter

OpenController Agent Fighter is a two-player browser fighting game controlled
through OpenController controller states.

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

Run a headless benchmark match or series:

```bash
bun --cwd examples/agent-fighter headless --duration-ms 15000
bun --cwd examples/agent-fighter headless --matches 5 --duration-ms 10000 --output ./opencontroller-agent-fighter-series.json
bun --cwd examples/agent-fighter headless --matches 3 --duration-ms 10000 --min-decisions-per-player 10 --min-total-damage 1
```

The headless runner starts the real server, opens the real browser game in
headless Chromium, starts the agents through the management API, polls
telemetry, stops the agents after each match, and prints a JSON series summary
with aggregate win rates, per-match winners, decision counts, and the final
arena state. Use `--matches <count>` for repeated duels, `--output <path>` to
write the summary to a file, `--url <url>` to target an already-running server,
and `--headed` to watch the browser while the runner drives the match.

The runner also writes a `quality` block and exits non-zero if a configured gate
fails. By default it requires at least one decision from each player, which
catches broken controller connections without depending on combat outcomes. Use
`--min-decisions`, `--min-decisions-per-player`, `--min-total-damage`, and
`--min-rounds` for stronger local or CI regression checks.

Agents start stopped by default. Use the controller telemetry page to start,
stop, or reset the duel. The server also enforces
`OPENCONTROLLER_OPENAI_ACTIONS_PER_MINUTE` so an active browser cannot accidentally
run an unbounded OpenAI action loop.

The agent loop ticks at `OPENCONTROLLER_AGENT_TICK_MS` (16ms by default). OpenAI has
no artificial cooldown by default; model latency and the per-minute action cap
are the limiting factors for this sample policy.

OpenAI agents use `OPENAI_API_KEY` when present. Without that key, the same
controller channels are driven by local agents so the game remains playable.
By default, OpenAI decisions use `gpt-5.4-mini` through the Responses API.

The two agents connect through one OpenController controller hub endpoint:
`ws://127.0.0.1:5173/controller`. Each agent owns its own virtual Xbox-style
controller id, so the browser game receives two distinct gamepad states.

The game supports two input sources for each player:

- OpenController virtual controller state over WebSocket
- Browser Gamepad API using standard Xbox-style mapping

The fighting game reads player intent from controller state only. Agents do not
call game actions directly.

The server stores the current arena snapshot and agent decision log in
`examples/agent-fighter/data/agent-fighter.sqlite`, so refreshing the browser
continues the active duel instead of starting a fresh battle.
