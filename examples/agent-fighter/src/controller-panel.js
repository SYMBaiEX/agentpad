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
    root.replaceChildren(agentCard(player, agent, controller));
  }
}

function setButtonsBusy(isBusy) {
  startButton.disabled = isBusy || Boolean(latestManagement?.agentsRunning);
  stopButton.disabled = isBusy || !latestManagement?.agentsRunning;
  resetButton.disabled = isBusy;
}

function agentCard(player, agent, controller) {
  const last = agent?.last;
  const fragment = document.createDocumentFragment();
  const swatch = el("span", { className: "swatch" });
  swatch.style.background = player.color;

  fragment.append(
    el("div", { className: "agentHeader" }, [
      el("div", { className: "agentName" }, [
        swatch,
        el("span", {}, [player.name]),
      ]),
      el("div", { className: "meta" }, [
        `${player.id} | ${last?.model ?? "waiting"}`,
      ]),
    ]),
    el("div", { className: "body" }, [
      controllerView(controller),
      el("div", { className: "decision" }, [
        el("div", {}, [
          el("strong", {}, [last?.action ?? "waiting"]),
          last ? ` ${last.source}` : "",
        ]),
        el("div", { className: "meta" }, [agent?.style ?? ""]),
        el("p", { className: "rationale" }, [
          last?.rationale ?? "Waiting for the next agent decision.",
        ]),
      ]),
      el("div", { className: "logs" }, [logView(agent?.recent ?? [])]),
    ]),
  );

  return fragment;
}

function controllerView(controller) {
  const buttons = controller?.buttons ?? {};
  const analog = controller?.analogButtons ?? {};
  const left = controller?.sticks?.left ?? { x: 0, y: 0 };

  const nub = el("span", { className: "nub" });
  nub.style.setProperty("--x", `${Math.round(left.x * 28)}px`);
  nub.style.setProperty("--y", `${Math.round(left.y * 28)}px`);

  return el("div", { className: "controller" }, [
    el("div", { className: "dpad" }, [
      dir("up", buttons.DPAD_UP),
      dir("left", buttons.DPAD_LEFT),
      dir("right", buttons.DPAD_RIGHT),
      dir("down", buttons.DPAD_DOWN),
    ]),
    el("div", { className: "padMid" }, [
      el("div", { className: "triggers" }, [
        trigger(analog.LT ?? 0),
        trigger(analog.RT ?? 0),
      ]),
      el("div", { className: "stick" }, [nub]),
    ]),
    el("div", { className: "buttons" }, [
      button("y", "Y", buttons.Y),
      button("x", "X", buttons.X),
      button("b", "B", buttons.B),
      button("a", "A", buttons.A),
    ]),
  ]);
}

function logView(events) {
  if (events.length === 0) {
    return el("div", { className: "log" }, [
      el("p", { className: "rationale" }, ["No decisions recorded yet."]),
    ]);
  }
  const fragment = document.createDocumentFragment();
  for (const event of events) {
    fragment.append(
      el("article", { className: "log" }, [
        el("div", { className: "logTop" }, [
          el("span", {}, [new Date(event.timestamp).toLocaleTimeString()]),
          el("span", {}, [`${event.source} | ${event.model}`]),
        ]),
        el("div", { className: "logAction" }, [event.action]),
        el("p", { className: "rationale" }, [event.rationale]),
        el("div", { className: "controls" }, [commandSummary(event.controls)]),
      ]),
    );
  }
  return fragment;
}

function button(slot, label, active) {
  return el("span", { className: `button ${slot} ${active ? "active" : ""}` }, [
    label,
  ]);
}

function dir(slot, active) {
  const label = { up: "U", down: "D", left: "L", right: "R" }[slot];
  return el("span", { className: `dir ${slot} ${active ? "active" : ""}` }, [
    label,
  ]);
}

function trigger(value) {
  const fill = el("span");
  fill.style.setProperty("--value", String(Math.max(0, Math.min(1, value))));
  return el("div", { className: "trigger" }, [fill]);
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

function el(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  for (const child of children) {
    element.append(
      child instanceof Node ? child : document.createTextNode(child),
    );
  }
  return element;
}
