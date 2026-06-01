const players = [
  { id: "player-1", name: "RED", color: "var(--red)" },
  { id: "player-2", name: "BLUE", color: "var(--blue)" },
];

const arenaEl = document.getElementById("arena");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startAgents");
const stopButton = document.getElementById("stopAgents");
const resetButton = document.getElementById("resetDuel");
let latestManagement;
let latestPayload;
let liveSocket;

startButton.addEventListener("click", () =>
  postManagement("/management/start"),
);
stopButton.addEventListener("click", () => postManagement("/management/stop"));
resetButton.addEventListener("click", () =>
  postManagement("/management/reset"),
);

await refresh();
connectLiveControllerStream();
setInterval(refresh, 650);

async function refresh() {
  const response = await fetch("/telemetry", { cache: "no-store" });
  if (!response.ok) {
    return;
  }
  latestPayload = mergePayload(latestPayload, await response.json());
  render(latestPayload);
}

async function postManagement(path) {
  setButtonsBusy(true);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    if (response.ok) {
      latestPayload = mergePayload(latestPayload, await response.json());
      render(latestPayload);
    }
  } finally {
    setButtonsBusy(false);
  }
}

function connectLiveControllerStream() {
  liveSocket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/game`,
  );
  liveSocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "controller.states") {
      latestPayload = mergePayload(latestPayload, {
        controllers: message.states,
      });
      render(latestPayload);
    }
    if (message.type === "arena.snapshot") {
      latestPayload = mergePayload(latestPayload, {
        arena: message.snapshot,
      });
      render(latestPayload);
    }
  });
  liveSocket.addEventListener("close", () => {
    setTimeout(connectLiveControllerStream, 500);
  });
}

function mergePayload(current, next) {
  return {
    ...(current ?? {}),
    ...next,
    controllers: {
      ...(current?.controllers ?? {}),
      ...(next?.controllers ?? {}),
    },
    agents: {
      ...(current?.agents ?? {}),
      ...(next?.agents ?? {}),
    },
  };
}

function render(payload) {
  if (!payload) {
    return;
  }
  const arena = payload.arena;
  const management = payload.management;
  latestManagement = management;
  const p1 = arena?.players?.find((player) => player.id === "player-1");
  const p2 = arena?.players?.find((player) => player.id === "player-2");
  arenaEl.textContent = arena
    ? `Round ${arena.round ?? 1} | ${arena.mode} | ${Math.ceil(
        arena.timeRemaining ?? 0,
      )}s | HP ${p1?.hp ?? "-"}:${p2?.hp ?? "-"}`
    : "";
  statusEl.textContent = management
    ? `${management.status}: ${management.message} | ${management.openAiRequestsThisMinute}/${management.openAiMaxRequestsPerMinute} OpenAI actions this minute | ${management.agentTickMs}ms controller tick | ${management.openAiDecisionMs}ms OpenAI cooldown`
    : "";
  startButton.disabled = Boolean(management?.agentsRunning);
  stopButton.disabled = !management?.agentsRunning;

  for (const player of players) {
    const agent = payload.agents?.[player.id];
    const controller = payload.controllers?.[player.id];
    const root = document.getElementById(player.id);
    root.innerHTML = agentTemplate(player, agent, controller);
  }
}

function setButtonsBusy(isBusy) {
  startButton.disabled = isBusy || Boolean(latestManagement?.agentsRunning);
  stopButton.disabled = isBusy || !latestManagement?.agentsRunning;
  resetButton.disabled = isBusy;
}

function agentTemplate(player, agent, controller) {
  const last = agent?.last;
  return `
    <div class="agentHeader">
      <div class="agentName">
        <span class="swatch" style="background:${player.color}"></span>
        <span>${player.name}</span>
      </div>
      <div class="meta">${escapeHtml(player.id)} | ${escapeHtml(
        last?.model ?? "waiting",
      )}</div>
    </div>
    <div class="body">
      ${controllerTemplate(controller)}
      <div class="decision">
        <div><strong>${escapeHtml(last?.action ?? "waiting")}</strong> ${
          last ? escapeHtml(last.source) : ""
        }</div>
        <div class="meta">${escapeHtml(agent?.style ?? "")}</div>
        <p class="rationale">${escapeHtml(
          last?.rationale ?? "Waiting for the next agent decision.",
        )}</p>
      </div>
      <div class="logs">${logTemplate(agent?.recent ?? [])}</div>
    </div>
  `;
}

function controllerTemplate(controller) {
  const buttons = controller?.buttons ?? {};
  const analog = controller?.analogButtons ?? {};
  const left = controller?.sticks?.left ?? { x: 0, y: 0 };
  return `
    <div class="controller">
      <div class="dpad">
        ${dir("up", buttons.DPAD_UP)}
        ${dir("left", buttons.DPAD_LEFT)}
        ${dir("right", buttons.DPAD_RIGHT)}
        ${dir("down", buttons.DPAD_DOWN)}
      </div>
      <div class="padMid">
        <div class="triggers">
          ${trigger(analog.LT ?? 0)}
          ${trigger(analog.RT ?? 0)}
        </div>
        <div class="stick">
          <span class="nub" style="--x:${Math.round(
            left.x * 28,
          )}px; --y:${Math.round(left.y * 28)}px"></span>
        </div>
      </div>
      <div class="buttons">
        ${button("y", "Y", buttons.Y)}
        ${button("x", "X", buttons.X)}
        ${button("b", "B", buttons.B)}
        ${button("a", "A", buttons.A)}
      </div>
    </div>
  `;
}

function logTemplate(events) {
  if (events.length === 0) {
    return `<div class="log"><p class="rationale">No decisions recorded yet.</p></div>`;
  }
  return events
    .map(
      (event) => `
        <article class="log">
          <div class="logTop">
            <span>${new Date(event.timestamp).toLocaleTimeString()}</span>
            <span>${escapeHtml(event.source)} | ${escapeHtml(event.model)}</span>
          </div>
          <div class="logAction">${escapeHtml(event.action)}</div>
          <p class="rationale">${escapeHtml(event.rationale)}</p>
          <div class="controls">${escapeHtml(commandSummary(event.controls))}</div>
        </article>
      `,
    )
    .join("");
}

function button(slot, label, active) {
  return `<span class="button ${slot} ${active ? "active" : ""}">${label}</span>`;
}

function dir(slot, active) {
  const label = { up: "U", down: "D", left: "L", right: "R" }[slot];
  return `<span class="dir ${slot} ${active ? "active" : ""}">${label}</span>`;
}

function trigger(value) {
  return `<div class="trigger"><span style="--value:${Math.max(
    0,
    Math.min(1, value),
  )}"></span></div>`;
}

function commandSummary(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return "controller: neutral";
  }
  return commands
    .map((command) => {
      if (command.type === "press") {
        return `press ${command.button} ${command.durationMs ?? 0}ms`;
      }
      if (command.type === "stick") {
        return `${command.stick}(${command.x}, ${command.y}) ${
          command.durationMs ?? 0
        }ms`;
      }
      if (command.type === "trigger") {
        return `${command.trigger}=${command.value} ${command.durationMs ?? 0}ms`;
      }
      return command.type;
    })
    .join(" + ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
