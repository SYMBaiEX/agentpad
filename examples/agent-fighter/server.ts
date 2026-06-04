import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Controller,
  type ControllerCommand,
  type ControllerState,
  type DpadDirection,
  createControllerHub,
  createInitialControllerState,
  dpadButtons,
  resolveProfile,
} from "@opencontroller/core";
import type { ServerWebSocket } from "bun";

type PlayerId = "player-1" | "player-2";
type ClientKind = "game" | "controller";
type SocketData = {
  kind: ClientKind;
  playerId?: PlayerId;
};
type ArenaSnapshot = {
  mode: string;
  timeRemaining: number;
  players: Array<{
    id: PlayerId;
    x: number;
    y: number;
    hp: number;
    facing: number;
    grounded: boolean;
    attacking: boolean;
    blocking: boolean;
  }>;
  projectiles: Array<{ ownerId: PlayerId; x: number; y: number; vx: number }>;
};
type FighterAction =
  | "advance"
  | "retreat"
  | "jump"
  | "light"
  | "heavy"
  | "block"
  | "dash"
  | "special"
  | "neutral";
type AgentRuntime = {
  id: PlayerId;
  controller: Controller;
  style: string;
  lastOpenAiAt: number;
  history: FighterAction[];
  thinking: boolean;
};
type DecisionSource = "openai" | "local" | "local-fallback";
type DecisionResult = {
  action: FighterAction;
  rationale: string;
  source: DecisionSource;
  model: string;
  latencyMs: number;
  responseId?: string;
};
type AgentDecisionEvent = DecisionResult & {
  timestamp: number;
  playerId: PlayerId;
  style: string;
  observation: ReturnType<typeof observationFor>;
  controls: ControllerCommand[];
};
type ManagementState = {
  agentsRunning: boolean;
  status: "stopped" | "running" | "rate-limited";
  message: string;
  updatedAt: number;
  openAiRequestsThisMinute: number;
  openAiWindowStartedAt: number;
  openAiMaxRequestsPerMinute: number;
  openAiDecisionMs: number;
  agentTickMs: number;
  openAiEnabled: boolean;
};

const playerIds = ["player-1", "player-2"] as const;
const publicDir = join(import.meta.dir, "src");
const dataDir = join(import.meta.dir, "data");
mkdirSync(dataDir, { recursive: true });
const db = new Database(join(dataDir, "agent-fighter.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS agent_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    source TEXT NOT NULL,
    model TEXT NOT NULL,
    style TEXT NOT NULL,
    action TEXT NOT NULL,
    rationale TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    response_id TEXT,
    observation_json TEXT NOT NULL,
    controls_json TEXT NOT NULL
  );
`);

const kvGet = db.query("SELECT value FROM kv WHERE key = ?");
const kvSet = db.query(`
  INSERT INTO kv (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);
const insertAgentEvent = db.query(`
  INSERT INTO agent_events (
    timestamp,
    player_id,
    source,
    model,
    style,
    action,
    rationale,
    latency_ms,
    response_id,
    observation_json,
    controls_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const recentAgentEvents = db.query(`
  SELECT
    id,
    timestamp,
    player_id AS playerId,
    source,
    model,
    style,
    action,
    rationale,
    latency_ms AS latencyMs,
    response_id AS responseId,
    observation_json AS observationJson,
    controls_json AS controlsJson
  FROM agent_events
  ORDER BY id DESC
  LIMIT ?
`);
const pruneAgentEvents = db.query(`
  DELETE FROM agent_events
  WHERE id NOT IN (
    SELECT id FROM agent_events ORDER BY id DESC LIMIT 500
  )
`);
const agentStyles: Record<PlayerId, string> = {
  "player-1": "aggressive pressure fighter",
  "player-2": "defensive counter fighter",
};
const openAiMaxRequestsPerMinute = Math.max(
  1,
  Number(
    Bun.env.OPENCONTROLLER_OPENAI_ACTIONS_PER_MINUTE ??
      Bun.env.OPENCONTROLLER_OPENAI_REQUESTS_PER_MINUTE ??
      "160",
  ),
);
const openAiDecisionMs = Math.max(
  0,
  Number(Bun.env.OPENCONTROLLER_OPENAI_DECISION_MS ?? "0"),
);
const agentTickMs = Math.max(
  1,
  Number(Bun.env.OPENCONTROLLER_AGENT_TICK_MS ?? "16"),
);
const profile = resolveProfile("xbox");
const controllerStates: Record<PlayerId, ControllerState> = {
  "player-1": createInitialControllerState("player-1", profile),
  "player-2": createInitialControllerState("player-2", profile),
};
const releaseTimers = new Map<string, Timer>();
const gameSockets = new Set<ServerWebSocket<SocketData>>();
const agentRuntimes = new Map<PlayerId, AgentRuntime>();
let arenaSnapshot: ArenaSnapshot =
  loadArenaSnapshot() ?? initialArenaSnapshot();
let lastArenaPersistAt = 0;
const managementState: ManagementState = {
  agentsRunning: false,
  status: "stopped",
  message: "Agents are stopped. Press Start Agents to begin OpenAI decisions.",
  updatedAt: Date.now(),
  openAiRequestsThisMinute: 0,
  openAiWindowStartedAt: Date.now(),
  openAiMaxRequestsPerMinute,
  openAiDecisionMs,
  agentTickMs,
  openAiEnabled: Boolean(Bun.env.OPENAI_API_KEY),
};

for (const playerId of playerIds) {
  controllerStates[playerId].connected = true;
}

const requestedPort = Number(Bun.env.OPENCONTROLLER_FIGHTER_PORT ?? "5173");
const server = Bun.serve<SocketData>({
  port: requestedPort,
  hostname: "127.0.0.1",
  async fetch(request, serverInstance) {
    const url = new URL(request.url);
    if (url.pathname === "/game") {
      return upgrade(request, serverInstance, { kind: "game" });
    }
    if (url.pathname === "/controller") {
      return upgrade(request, serverInstance, { kind: "controller" });
    }
    if (url.pathname.startsWith("/controller/")) {
      const playerId = url.pathname.split("/").at(-1);
      if (playerId === "player-1" || playerId === "player-2") {
        return upgrade(request, serverInstance, {
          kind: "controller",
          playerId,
        });
      }
      return new Response("Unknown player", { status: 404 });
    }
    if (url.pathname === "/state") {
      return Response.json(snapshotPayload(), {
        headers: { "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/telemetry") {
      return Response.json(telemetryPayload(), {
        headers: { "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/management/start" && request.method === "POST") {
      startAgentDecisions("Agents started from controller page.");
      return Response.json(telemetryPayload(), {
        headers: { "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/management/stop" && request.method === "POST") {
      await stopAgentDecisions("Agents stopped from controller page.");
      return Response.json(telemetryPayload(), {
        headers: { "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/management/reset" && request.method === "POST") {
      resetArenaSnapshot();
      return Response.json(telemetryPayload(), {
        headers: { "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/client.js") {
      return serveFile("client.js", "text/javascript; charset=utf-8");
    }
    if (url.pathname === "/controller-panel.js") {
      return serveFile("controller-panel.js", "text/javascript; charset=utf-8");
    }
    if (url.pathname === "/controllers" || url.pathname === "/management") {
      return serveFile("controllers.html", "text/html; charset=utf-8");
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return serveFile("index.html", "text/html; charset=utf-8");
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      if (ws.data.kind === "game") {
        gameSockets.add(ws);
        ws.send(
          JSON.stringify({
            type: "controller.states",
            states: controllerStates,
          }),
        );
        ws.send(
          JSON.stringify({
            type: "arena.snapshot",
            snapshot: arenaSnapshot,
          }),
        );
      }
      if (ws.data.kind === "controller" && ws.data.playerId) {
        controllerStates[ws.data.playerId].connected = true;
        broadcastControllerStates();
      }
    },
    message(ws, message) {
      const raw = typeof message === "string" ? message : message.toString();
      const parsed = safeJson(raw);
      if (!parsed) {
        return;
      }
      if (ws.data.kind === "controller") {
        const playerId =
          ws.data.playerId ?? playerIdFromControllerMessage(parsed);
        if (playerId) {
          receiveControllerMessage(playerId, parsed);
        }
      }
      if (
        ws.data.kind === "game" &&
        isRecord(parsed) &&
        parsed.type === "arena.state"
      ) {
        arenaSnapshot = parsed.snapshot as ArenaSnapshot;
        persistArenaSnapshot();
      }
    },
    close(ws) {
      if (ws.data.kind === "game") {
        gameSockets.delete(ws);
      }
    },
  },
});

console.log(
  `Agent Fighter running at http://${server.hostname}:${server.port}/`,
);
void startAgents();

function upgrade(
  request: Request,
  serverInstance: Parameters<
    NonNullable<Parameters<typeof Bun.serve<SocketData>>[0]["fetch"]>
  >[1],
  data: SocketData,
): Response | undefined {
  if (serverInstance.upgrade(request, { data })) {
    return undefined;
  }
  return new Response("WebSocket upgrade failed", { status: 400 });
}

async function serveFile(
  fileName: string,
  contentType: string,
): Promise<Response> {
  const body = await readFile(join(publicDir, fileName), "utf8");
  return new Response(body, {
    headers: {
      "content-type": contentType,
    },
  });
}

function initialArenaSnapshot(): ArenaSnapshot {
  return {
    mode: "playing",
    timeRemaining: 90,
    players: [
      {
        id: "player-1",
        x: 260,
        y: 548,
        hp: 100,
        facing: 1,
        grounded: true,
        attacking: false,
        blocking: false,
      },
      {
        id: "player-2",
        x: 1020,
        y: 548,
        hp: 100,
        facing: -1,
        grounded: true,
        attacking: false,
        blocking: false,
      },
    ],
    projectiles: [],
  };
}

function loadArenaSnapshot(): ArenaSnapshot | undefined {
  const row = kvGet.get("arenaSnapshot") as { value?: string } | null;
  if (!row?.value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(row.value);
    return isArenaSnapshot(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function persistArenaSnapshot(force = false): void {
  const now = Date.now();
  if (!force && now - lastArenaPersistAt < 250) {
    return;
  }
  lastArenaPersistAt = now;
  kvSet.run("arenaSnapshot", JSON.stringify(arenaSnapshot), now);
}

function resetArenaSnapshot(): void {
  arenaSnapshot = initialArenaSnapshot();
  persistArenaSnapshot(true);
  broadcastArenaSnapshot();
}

function broadcastArenaSnapshot(): void {
  const payload = JSON.stringify({
    type: "arena.snapshot",
    snapshot: arenaSnapshot,
  });
  for (const socket of gameSockets) {
    socket.send(payload);
  }
}

function isArenaSnapshot(value: unknown): value is ArenaSnapshot {
  return (
    isRecord(value) &&
    typeof value.mode === "string" &&
    typeof value.timeRemaining === "number" &&
    Array.isArray(value.players) &&
    Array.isArray(value.projectiles)
  );
}

function receiveControllerMessage(playerId: PlayerId, message: unknown): void {
  if (!isRecord(message)) {
    return;
  }
  if (message.type === "controller.command" && isRecord(message.command)) {
    applyCommand(playerId, message.command as ControllerCommand);
    broadcastControllerStates();
    return;
  }
  if (message.type === "controller.state" && isControllerState(message.state)) {
    controllerStates[playerId] = {
      ...message.state,
      id: playerId,
      connected: true,
      updatedAt: Date.now(),
    };
    broadcastControllerStates();
    return;
  }
  if (message.type === "controller.neutral") {
    applyCommand(playerId, { type: "neutral" });
    broadcastControllerStates();
  }
}

function playerIdFromControllerMessage(message: unknown): PlayerId | undefined {
  if (!isRecord(message)) {
    return undefined;
  }
  const controllerId = message.controllerId;
  return controllerId === "player-1" || controllerId === "player-2"
    ? controllerId
    : undefined;
}

function isControllerState(value: unknown): value is ControllerState {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.profile === "string" &&
    typeof value.connected === "boolean" &&
    isRecord(value.buttons) &&
    isRecord(value.analogButtons) &&
    isRecord(value.sticks) &&
    isRecord(value.dpad) &&
    isRecord(value.touchpad) &&
    isRecord(value.motion) &&
    typeof value.updatedAt === "number"
  );
}

function applyCommand(playerId: PlayerId, command: ControllerCommand): void {
  const state = controllerStates[playerId];
  state.updatedAt = Date.now();
  switch (command.type) {
    case "press":
      setButtonState(state, command.button, true, command.pressure);
      scheduleRelease(playerId, command.button, command.durationMs);
      return;
    case "release":
      setButtonState(state, command.button, false);
      return;
    case "stick": {
      const stick =
        command.stick === "LEFT" ? state.sticks.left : state.sticks.right;
      stick.x = command.x;
      stick.y = command.y;
      scheduleStickNeutral(playerId, command.stick, command.durationMs);
      return;
    }
    case "trigger":
      state.analogButtons[command.trigger] = command.value;
      state.buttons[command.trigger] = command.value > 0;
      scheduleTriggerNeutral(playerId, command.trigger, command.durationMs);
      return;
    case "dpad": {
      for (const button of dpadButtons(command.direction)) {
        setButtonState(state, button, true);
      }
      scheduleDpadRelease(playerId, command.direction, command.durationMs);
      return;
    }
    case "touchpad":
      state.touchpad.pressed = command.pressed ?? false;
      state.touchpad.contacts =
        command.contacts?.map((contact, index) => ({
          id: contact.id ?? index,
          x: contact.x,
          y: contact.y,
          active: contact.active ?? true,
          pressure: contact.pressure ?? 1,
        })) ?? [];
      return;
    case "motion":
      if (command.acceleration) {
        state.motion.acceleration = { ...command.acceleration };
      }
      if (command.gyroscope) {
        state.motion.gyroscope = { ...command.gyroscope };
      }
      if (command.orientation) {
        state.motion.orientation = { ...command.orientation };
      }
      return;
    case "neutral":
      neutralize(state);
      return;
    case "combo":
    case "sequence":
    case "wait":
      return;
  }
}

function neutralize(state: ControllerState): void {
  for (const button of Object.keys(state.buttons)) {
    state.buttons[button] = false;
  }
  for (const button of Object.keys(state.analogButtons)) {
    state.analogButtons[button] = 0;
  }
  state.sticks.left = { x: 0, y: 0 };
  state.sticks.right = { x: 0, y: 0 };
  state.dpad = { up: false, down: false, left: false, right: false };
  state.touchpad = { pressed: false, contacts: [] };
  state.motion = {
    acceleration: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0 },
  };
}

function scheduleRelease(
  playerId: PlayerId,
  button: string,
  durationMs = 0,
): void {
  if (durationMs <= 0) {
    return;
  }
  schedule(`${playerId}:${button}`, durationMs, () => {
    applyCommand(playerId, { type: "release", button });
    broadcastControllerStates();
  });
}

function scheduleStickNeutral(
  playerId: PlayerId,
  stick: "LEFT" | "RIGHT",
  durationMs = 0,
): void {
  if (durationMs <= 0) {
    return;
  }
  schedule(`${playerId}:stick:${stick}`, durationMs, () => {
    applyCommand(playerId, { type: "stick", stick, x: 0, y: 0 });
    broadcastControllerStates();
  });
}

function scheduleTriggerNeutral(
  playerId: PlayerId,
  trigger: string,
  durationMs = 0,
): void {
  if (durationMs <= 0) {
    return;
  }
  schedule(`${playerId}:trigger:${trigger}`, durationMs, () => {
    applyCommand(playerId, { type: "trigger", trigger, value: 0 });
    broadcastControllerStates();
  });
}

function scheduleDpadRelease(
  playerId: PlayerId,
  direction: DpadDirection,
  durationMs = 0,
): void {
  if (durationMs <= 0) {
    return;
  }
  schedule(`${playerId}:dpad:${direction}`, durationMs, () => {
    for (const button of dpadButtons(direction)) {
      applyCommand(playerId, { type: "release", button });
    }
    broadcastControllerStates();
  });
}

function setButtonState(
  state: ControllerState,
  button: string,
  pressed: boolean,
  pressure?: number,
): void {
  state.buttons[button] = pressed;
  if (pressure !== undefined) {
    state.analogButtons[button] = pressure;
  } else if (button in state.analogButtons) {
    state.analogButtons[button] = pressed ? 1 : 0;
  }

  const dpadKey = dpadKeyFromButton(button);
  if (dpadKey) {
    state.dpad[dpadKey] = pressed;
  }
}

function dpadKeyFromButton(
  button: string,
): keyof ControllerState["dpad"] | undefined {
  switch (button) {
    case "DPAD_UP":
      return "up";
    case "DPAD_DOWN":
      return "down";
    case "DPAD_LEFT":
      return "left";
    case "DPAD_RIGHT":
      return "right";
    default:
      return undefined;
  }
}

function schedule(key: string, durationMs: number, callback: () => void): void {
  const existing = releaseTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  releaseTimers.set(
    key,
    setTimeout(() => {
      releaseTimers.delete(key);
      callback();
    }, durationMs),
  );
}

function broadcastControllerStates(): void {
  const payload = JSON.stringify({
    type: "controller.states",
    states: controllerStates,
  });
  for (const socket of gameSockets) {
    socket.send(payload);
  }
}

function snapshotPayload() {
  return {
    controllers: controllerStates,
    arena: arenaSnapshot,
  };
}

function telemetryPayload() {
  const events = loadRecentAgentEvents(100);
  return {
    ...snapshotPayload(),
    management: managementPayload(),
    agents: Object.fromEntries(
      playerIds.map((playerId) => {
        const recent = events.filter((event) => event.playerId === playerId);
        return [
          playerId,
          {
            id: playerId,
            style: agentStyles[playerId],
            controller: controllerStates[playerId],
            last: recent[0] ?? null,
            recent,
          },
        ];
      }),
    ),
    events,
  };
}

function managementPayload() {
  rollOpenAiWindow();
  return {
    ...managementState,
    secondsUntilBudgetReset: Math.max(
      0,
      Math.ceil(
        (60_000 - (Date.now() - managementState.openAiWindowStartedAt)) / 1000,
      ),
    ),
  };
}

function loadRecentAgentEvents(limit: number) {
  const rows = recentAgentEvents.all(limit) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    playerId: row.playerId,
    source: row.source,
    model: row.model,
    style: row.style,
    action: row.action,
    rationale: row.rationale,
    latencyMs: row.latencyMs,
    responseId: row.responseId,
    observation: parseJsonValue(row.observationJson),
    controls: parseJsonValue(row.controlsJson),
  }));
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function startAgentDecisions(message: string): void {
  rollOpenAiWindow();
  managementState.agentsRunning = true;
  managementState.status = "running";
  managementState.message = message;
  managementState.updatedAt = Date.now();
  for (const agent of agentRuntimes.values()) {
    agent.lastOpenAiAt = 0;
  }
}

async function stopAgentDecisions(message: string): Promise<void> {
  managementState.agentsRunning = false;
  managementState.status =
    message.includes("budget") || message.includes("rate")
      ? "rate-limited"
      : "stopped";
  managementState.message = message;
  managementState.updatedAt = Date.now();
  await Promise.all(
    [...agentRuntimes.values()].map((agent) => agent.controller.neutral()),
  );
}

function rollOpenAiWindow(): void {
  const now = Date.now();
  if (now - managementState.openAiWindowStartedAt < 60_000) {
    return;
  }
  managementState.openAiWindowStartedAt = now;
  managementState.openAiRequestsThisMinute = 0;
  if (managementState.status === "rate-limited") {
    managementState.status = "stopped";
    managementState.message =
      "OpenAI request budget reset. Press Start Agents to resume.";
    managementState.updatedAt = now;
  }
}

async function consumeOpenAiBudget(): Promise<boolean> {
  rollOpenAiWindow();
  if (managementState.openAiRequestsThisMinute >= openAiMaxRequestsPerMinute) {
    await stopAgentDecisions(
      `OpenAI action budget reached (${openAiMaxRequestsPerMinute}/minute). Agents stopped.`,
    );
    return false;
  }
  managementState.openAiRequestsThisMinute += 1;
  return true;
}

async function startAgents(): Promise<void> {
  const controllerUrl = `ws://${server.hostname}:${server.port}/controller`;
  const hub = await createControllerHub({
    controllers: playerIds.map((id) => ({
      id,
      profile: "xbox",
      adapter: "websocket",
      url: controllerUrl,
      replay: false,
      safety: {
        maxCommandsPerSecond: 240,
        maxButtonHoldMs: 900,
        maxStickHoldMs: 900,
      },
    })),
  });
  const red = hub.get("player-1");
  const blue = hub.get("player-2");

  const openAiEnabled = Boolean(Bun.env.OPENAI_API_KEY);
  console.log(
    openAiEnabled
      ? `OpenAI agents configured with ${Bun.env.OPENAI_MODEL ?? "gpt-5.4-mini"}. Agents start stopped.`
      : "Local agents configured. Agents start stopped. Set OPENAI_API_KEY to use OpenAI decisions.",
  );

  runAgentLoop({
    id: "player-1",
    controller: red,
    style: agentStyles["player-1"],
    lastOpenAiAt: 0,
    history: [],
    thinking: false,
  });
  runAgentLoop({
    id: "player-2",
    controller: blue,
    style: agentStyles["player-2"],
    lastOpenAiAt: 0,
    history: [],
    thinking: false,
  });
}

function runAgentLoop(agent: AgentRuntime): void {
  agentRuntimes.set(agent.id, agent);
  setInterval(() => {
    void decideAndAct(agent);
  }, agentTickMs);
}

async function decideAndAct(agent: AgentRuntime): Promise<void> {
  if (
    !managementState.agentsRunning ||
    gameSockets.size === 0 ||
    arenaSnapshot.mode !== "playing"
  ) {
    return;
  }
  if (agent.thinking) {
    return;
  }

  agent.thinking = true;
  try {
    const observation = observationFor(agent.id);
    let decision: DecisionResult | undefined;
    if (Bun.env.OPENAI_API_KEY) {
      if (Date.now() - agent.lastOpenAiAt < openAiDecisionMs) {
        return;
      }
      agent.lastOpenAiAt = Date.now();
      if (!(await consumeOpenAiBudget())) {
        return;
      }
      decision = await decideWithOpenAI(
        agent.style,
        observation,
        agent.history,
      );
    } else {
      decision = decideLocallyWithRationale(agent.id, observation, "local");
    }

    if (!decision && Bun.env.OPENAI_API_KEY) {
      return;
    }
    decision ??= decideLocallyWithRationale(agent.id, observation, "local");
    const controls = commandsForAction(agent.id, decision.action, observation);
    recordAgentDecision({
      ...decision,
      timestamp: Date.now(),
      playerId: agent.id,
      style: agent.style,
      observation,
      controls,
    });
    agent.history = [decision.action, ...agent.history].slice(0, 8);
    await performAction(agent.controller, controls);
  } finally {
    agent.thinking = false;
  }
}

function observationFor(playerId: PlayerId) {
  const me = arenaSnapshot.players.find((player) => player.id === playerId);
  const enemy = arenaSnapshot.players.find((player) => player.id !== playerId);
  return {
    coordinateSystem: "origin top-left, x increases right, y increases down",
    mode: arenaSnapshot.mode,
    timeRemaining: arenaSnapshot.timeRemaining,
    me,
    enemy,
    projectiles: arenaSnapshot.projectiles,
  };
}

async function decideWithOpenAI(
  style: string,
  observation: ReturnType<typeof observationFor>,
  recentActions: FighterAction[],
): Promise<DecisionResult | undefined> {
  const startedAt = Date.now();
  const model = Bun.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${Bun.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You control a fighting game character with an Xbox controller. Respond with JSON only. Choose one action that helps you win. Include a concise visible decision rationale, not hidden chain-of-thought. Use varied controller actions over time: movement, jump, light, heavy, block, dash, and special when useful. Do not repeat the same action more than twice unless it is clearly necessary.",
          },
          {
            role: "user",
            content: JSON.stringify({
              style,
              legalActions: [
                "advance",
                "retreat",
                "jump",
                "light",
                "heavy",
                "block",
                "dash",
                "special",
                "neutral",
              ],
              observation,
              recentActions,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "fighter_action",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["action", "rationale"],
              properties: {
                action: {
                  type: "string",
                  enum: [
                    "advance",
                    "retreat",
                    "jump",
                    "light",
                    "heavy",
                    "block",
                    "dash",
                    "special",
                    "neutral",
                  ],
                },
                rationale: {
                  type: "string",
                },
              },
            },
          },
        },
        max_output_tokens: 80,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `OpenAI decision skipped: ${response.status} ${errorText.slice(0, 180)}`,
      );
      return undefined;
    }
    const payload = await response.json();
    const text = extractOutputText(payload);
    const parsed = JSON.parse(text) as {
      action?: FighterAction;
      rationale?: string;
    };
    if (!isFighterAction(parsed.action)) {
      return undefined;
    }
    return {
      action: parsed.action,
      rationale:
        typeof parsed.rationale === "string" && parsed.rationale.trim()
          ? parsed.rationale.trim()
          : "Chose a legal controller action from the current fight state.",
      source: "openai",
      model,
      latencyMs: Date.now() - startedAt,
      ...(isRecord(payload) && typeof payload.id === "string"
        ? { responseId: payload.id }
        : {}),
    };
  } catch (error) {
    console.warn(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function extractOutputText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return "{}";
  }
  const chunks: string[] = [];
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("");
}

function decideLocally(
  playerId: PlayerId,
  observation: ReturnType<typeof observationFor>,
): FighterAction {
  const me = observation.me;
  const enemy = observation.enemy;
  if (!me || !enemy || observation.mode !== "playing") {
    return "neutral";
  }
  const distance = Math.abs(enemy.x - me.x);
  const enemyAttacking = enemy.attacking;
  if (me.hp < 28 && distance < 110 && enemyAttacking) {
    return "block";
  }
  if (distance > 430) {
    return "special";
  }
  if (distance > 150) {
    return playerId === "player-1" ? "advance" : "dash";
  }
  if (enemyAttacking && distance < 120) {
    return "retreat";
  }
  if (distance < 76) {
    return Math.random() > 0.62 ? "heavy" : "light";
  }
  return Math.random() > 0.72 ? "jump" : "advance";
}

function decideLocallyWithRationale(
  playerId: PlayerId,
  observation: ReturnType<typeof observationFor>,
  source: DecisionSource,
): DecisionResult {
  const action = decideLocally(playerId, observation);
  return {
    action,
    rationale: localRationale(action, observation, source),
    source,
    model: source === "local" ? "local-policy" : "openai-fallback-policy",
    latencyMs: 0,
  };
}

function localRationale(
  action: FighterAction,
  observation: ReturnType<typeof observationFor>,
  source: DecisionSource,
): string {
  const me = observation.me;
  const enemy = observation.enemy;
  const distance = me && enemy ? Math.abs(enemy.x - me.x) : undefined;
  const prefix =
    source === "local-fallback"
      ? "OpenAI decision was unavailable; local policy chose"
      : "Local policy chose";
  if (!me || !enemy || observation.mode !== "playing") {
    return `${prefix} neutral while waiting for a playable arena state.`;
  }
  if (action === "block") {
    return `${prefix} block because health is low or the opponent is threatening at close range.`;
  }
  if (action === "special") {
    return `${prefix} special to pressure across ${Math.round(distance ?? 0)} pixels of space.`;
  }
  if (action === "advance" || action === "dash") {
    return `${prefix} ${action} to close ${Math.round(distance ?? 0)} pixels of distance.`;
  }
  if (action === "retreat") {
    return `${prefix} retreat because the opponent is attacking nearby.`;
  }
  if (action === "jump") {
    return `${prefix} jump to vary approach timing.`;
  }
  return `${prefix} ${action} because both fighters are in striking range.`;
}

function recordAgentDecision(event: AgentDecisionEvent): void {
  insertAgentEvent.run(
    event.timestamp,
    event.playerId,
    event.source,
    event.model,
    event.style,
    event.action,
    event.rationale,
    event.latencyMs,
    event.responseId ?? null,
    JSON.stringify(event.observation),
    JSON.stringify(event.controls),
  );
  pruneAgentEvents.run();
}

function commandsForAction(
  playerId: PlayerId,
  action: FighterAction,
  observation: ReturnType<typeof observationFor>,
): ControllerCommand[] {
  const me = observation.me;
  const enemy = observation.enemy;
  const directionToEnemy = me && enemy && me.x < enemy.x ? 1 : -1;
  const forward = directionToEnemy;
  const backward = -directionToEnemy;
  switch (action) {
    case "advance":
      return [
        { type: "stick", stick: "LEFT", x: forward, y: 0, durationMs: 150 },
      ];
    case "retreat":
      return [
        { type: "stick", stick: "LEFT", x: backward, y: 0, durationMs: 150 },
      ];
    case "jump":
      return [{ type: "press", button: "A", durationMs: 90 }];
    case "light":
      return [{ type: "press", button: "X", durationMs: 70 }];
    case "heavy":
      return [{ type: "press", button: "Y", durationMs: 90 }];
    case "block":
      return [{ type: "trigger", trigger: "LT", value: 1, durationMs: 170 }];
    case "dash":
      return [
        {
          type: "stick",
          stick: "LEFT",
          x: playerId === "player-1" ? 1 : -1,
          y: 0,
          durationMs: 80,
        },
        { type: "press", button: "B", durationMs: 80 },
      ];
    case "special":
      return [{ type: "trigger", trigger: "RT", value: 1, durationMs: 120 }];
    case "neutral":
      return [{ type: "neutral" }];
  }
}

async function performAction(
  controller: Controller,
  commands: ControllerCommand[],
): Promise<void> {
  for (const command of commands) {
    switch (command.type) {
      case "press":
        await controller.press(command.button, command.durationMs);
        break;
      case "release":
        await controller.release(command.button);
        break;
      case "stick":
        await controller.moveStick(
          command.stick,
          { x: command.x, y: command.y },
          command.durationMs,
        );
        break;
      case "trigger":
        await controller.trigger(
          command.trigger,
          command.value,
          command.durationMs,
        );
        break;
      case "dpad":
        await controller.dpad(command.direction, command.durationMs);
        break;
      case "touchpad":
        await controller.touchpad(touchpadInput(command), command.durationMs);
        break;
      case "motion":
        await controller.motion(motionInput(command), command.durationMs);
        break;
      case "combo":
        await controller.combo(
          command.buttons,
          command.durationMs,
          command.staggerMs,
        );
        break;
      case "sequence":
        await controller.sequence(command.commands);
        break;
      case "wait":
        await controller.wait(command.ms);
        break;
      case "neutral":
        await controller.neutral();
        break;
    }
  }
}

function touchpadInput(
  command: Extract<ControllerCommand, { type: "touchpad" }>,
) {
  return {
    ...(command.contacts ? { contacts: command.contacts } : {}),
    ...(command.pressed !== undefined ? { pressed: command.pressed } : {}),
  };
}

function motionInput(command: Extract<ControllerCommand, { type: "motion" }>) {
  return {
    ...(command.acceleration ? { acceleration: command.acceleration } : {}),
    ...(command.gyroscope ? { gyroscope: command.gyroscope } : {}),
    ...(command.orientation ? { orientation: command.orientation } : {}),
  };
}

function isFighterAction(value: unknown): value is FighterAction {
  return (
    value === "advance" ||
    value === "retreat" ||
    value === "jump" ||
    value === "light" ||
    value === "heavy" ||
    value === "block" ||
    value === "dash" ||
    value === "special" ||
    value === "neutral"
  );
}

function safeJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
