const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const floorY = 548;
const gravity = 1750;
const players = [
  makePlayer("player-1", "RED", 260, "#dc4d4d", 1),
  makePlayer("player-2", "BLUE", 1020, "#4d82dc", -1),
];
const game = {
  mode: "playing",
  timeRemaining: 90,
  winner: null,
  round: 1,
  players,
  projectiles: [],
  sparks: [],
};
const virtualStates = {
  "player-1": emptyControllerState("player-1"),
  "player-2": emptyControllerState("player-2"),
};
const previousInputs = {
  "player-1": neutralInput(),
  "player-2": neutralInput(),
};
const keys = new Set();
let socket;
let lastFrame = performance.now();
let lastPublish = 0;
let roundResetTimer;

void bootstrap();

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyR") {
    resetRound();
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

window.render_game_to_text = () => JSON.stringify(gameTextPayload());
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let index = 0; index < steps; index += 1) {
    update(1 / 60);
  }
  render();
  publishArenaState();
};

async function bootstrap() {
  await hydrateFromServer();
  connectGameSocket();
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

async function hydrateFromServer() {
  try {
    const response = await fetch("/state", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (payload.controllers) {
      applyControllerStates(payload.controllers);
    }
    if (payload.arena) {
      applyArenaSnapshot(payload.arena);
    }
  } catch {
    // Keep the local initial state if the server snapshot is not available.
  }
}

function makePlayer(id, name, x, color, facing) {
  return {
    id,
    name,
    x,
    y: floorY,
    w: 48,
    h: 98,
    vx: 0,
    vy: 0,
    color,
    facing,
    hp: 100,
    energy: 35,
    grounded: true,
    blocking: false,
    hitstun: 0,
    dashTimer: 0,
    attack: null,
    cooldowns: {
      light: 0,
      heavy: 0,
      dash: 0,
      special: 0,
      jump: 0,
    },
  };
}

function emptyControllerState(id) {
  const buttons = {};
  for (const button of [
    "A",
    "B",
    "X",
    "Y",
    "LB",
    "RB",
    "LT",
    "RT",
    "BACK",
    "START",
    "GUIDE",
    "LS",
    "RS",
    "DPAD_UP",
    "DPAD_DOWN",
    "DPAD_LEFT",
    "DPAD_RIGHT",
  ]) {
    buttons[button] = false;
  }
  return {
    id,
    profile: "xbox",
    connected: true,
    buttons,
    analogButtons: {
      LT: 0,
      RT: 0,
    },
    sticks: {
      left: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
    },
    dpad: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    updatedAt: Date.now(),
  };
}

function connectGameSocket() {
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/game`,
  );
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "controller.states") {
      applyControllerStates(message.states);
    }
    if (message.type === "arena.snapshot") {
      applyArenaSnapshot(message.snapshot);
    }
  });
  socket.addEventListener("close", () => {
    setTimeout(connectGameSocket, 500);
  });
}

function applyControllerStates(states) {
  if (states?.["player-1"]) {
    Object.assign(virtualStates["player-1"], states["player-1"]);
  }
  if (states?.["player-2"]) {
    Object.assign(virtualStates["player-2"], states["player-2"]);
  }
}

function applyArenaSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.players)) {
    return;
  }
  game.mode = typeof snapshot.mode === "string" ? snapshot.mode : game.mode;
  game.timeRemaining =
    typeof snapshot.timeRemaining === "number"
      ? snapshot.timeRemaining
      : game.timeRemaining;
  game.winner = snapshot.winner ?? game.winner;
  game.round = typeof snapshot.round === "number" ? snapshot.round : game.round;

  for (const playerSnapshot of snapshot.players) {
    const player = players.find(
      (candidate) => candidate.id === playerSnapshot.id,
    );
    if (!player) {
      continue;
    }
    player.x = Number.isFinite(playerSnapshot.x) ? playerSnapshot.x : player.x;
    player.y = Number.isFinite(playerSnapshot.y) ? playerSnapshot.y : player.y;
    player.hp = Number.isFinite(playerSnapshot.hp)
      ? playerSnapshot.hp
      : player.hp;
    player.facing = playerSnapshot.facing === -1 ? -1 : 1;
    player.grounded = Boolean(playerSnapshot.grounded);
    player.blocking = Boolean(playerSnapshot.blocking);
  }

  game.projectiles = Array.isArray(snapshot.projectiles)
    ? snapshot.projectiles.map((projectile) => ({
        ownerId: projectile.ownerId,
        x: projectile.x,
        y: projectile.y,
        vx: projectile.vx,
        r: 12,
        damage: 9,
      }))
    : [];

  if (game.mode === "round-over") {
    scheduleRoundReset();
  }
}

function frame(now) {
  const dt = Math.min(0.04, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  if (now - lastPublish > 100) {
    publishArenaState();
    lastPublish = now;
  }
  requestAnimationFrame(frame);
}

function update(dt) {
  if (game.mode !== "playing") {
    return;
  }
  game.timeRemaining = Math.max(0, game.timeRemaining - dt);
  if (game.timeRemaining <= 0) {
    finishRound(players[0].hp >= players[1].hp ? players[0] : players[1]);
  }

  const inputs = {
    "player-1": readInput("player-1", 0),
    "player-2": readInput("player-2", 1),
  };

  for (const player of players) {
    const enemy = player.id === "player-1" ? players[1] : players[0];
    player.facing = enemy.x >= player.x ? 1 : -1;
    tickTimers(player, dt);
    applyInput(player, inputs[player.id], previousInputs[player.id], dt);
  }

  for (const player of players) {
    integratePlayer(player, dt);
  }

  separatePlayers(players[0], players[1]);
  resolveAttacks();
  updateProjectiles(dt);
  updateSparks(dt);

  for (const player of players) {
    previousInputs[player.id] = inputs[player.id];
  }
}

function readInput(playerId, gamepadIndex) {
  const physical = readGamepadState(gamepadIndex);
  const state = physical ?? virtualStates[playerId];
  const keyboard = keyboardState(playerId);
  const x = clamp(
    (state.sticks.left?.x ?? 0) +
      (state.buttons.DPAD_RIGHT ? 1 : 0) -
      (state.buttons.DPAD_LEFT ? 1 : 0) +
      keyboard.x,
    -1,
    1,
  );
  const y = clamp(
    (state.sticks.left?.y ?? 0) +
      (state.buttons.DPAD_DOWN ? 1 : 0) -
      (state.buttons.DPAD_UP ? 1 : 0) +
      keyboard.y,
    -1,
    1,
  );
  return {
    x,
    y,
    jump: state.buttons.A || y < -0.72 || keyboard.jump,
    dash: state.buttons.B || keyboard.dash,
    light: state.buttons.X || keyboard.light,
    heavy: state.buttons.Y || keyboard.heavy,
    block:
      (state.analogButtons.LT ?? 0) > 0.35 ||
      state.buttons.LB ||
      keyboard.block,
    special:
      (state.analogButtons.RT ?? 0) > 0.35 ||
      state.buttons.RB ||
      keyboard.special,
  };
}

function keyboardState(playerId) {
  if (playerId === "player-1") {
    return {
      x: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      y: keys.has("KeyW") ? -1 : 0,
      jump: keys.has("KeyW"),
      dash: keys.has("ShiftLeft"),
      light: keys.has("KeyF"),
      heavy: keys.has("KeyG"),
      block: keys.has("KeyS"),
      special: keys.has("KeyH"),
    };
  }
  return {
    x: (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0),
    y: keys.has("ArrowUp") ? -1 : 0,
    jump: keys.has("ArrowUp"),
    dash: keys.has("Slash"),
    light: keys.has("KeyJ"),
    heavy: keys.has("KeyK"),
    block: keys.has("ArrowDown"),
    special: keys.has("KeyL"),
  };
}

function readGamepadState(index) {
  const pad = navigator.getGamepads?.()[index];
  if (!pad || !pad.connected || pad.mapping !== "standard") {
    return undefined;
  }
  const button = (buttonIndex) => Boolean(pad.buttons[buttonIndex]?.pressed);
  const value = (buttonIndex) => pad.buttons[buttonIndex]?.value ?? 0;
  return {
    buttons: {
      A: button(0),
      B: button(1),
      X: button(2),
      Y: button(3),
      LB: button(4),
      RB: button(5),
      LT: button(6),
      RT: button(7),
      BACK: button(8),
      START: button(9),
      LS: button(10),
      RS: button(11),
      DPAD_UP: button(12),
      DPAD_DOWN: button(13),
      DPAD_LEFT: button(14),
      DPAD_RIGHT: button(15),
    },
    analogButtons: {
      LT: value(6),
      RT: value(7),
    },
    sticks: {
      left: {
        x: applyDeadzone(pad.axes[0] ?? 0),
        y: applyDeadzone(pad.axes[1] ?? 0),
      },
      right: {
        x: applyDeadzone(pad.axes[2] ?? 0),
        y: applyDeadzone(pad.axes[3] ?? 0),
      },
    },
  };
}

function neutralInput() {
  return {
    x: 0,
    y: 0,
    jump: false,
    dash: false,
    light: false,
    heavy: false,
    block: false,
    special: false,
  };
}

function tickTimers(player, dt) {
  player.hitstun = Math.max(0, player.hitstun - dt);
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  if (player.attack) {
    player.attack.remaining -= dt;
    if (player.attack.remaining <= 0) {
      player.attack = null;
    }
  }
  for (const key of Object.keys(player.cooldowns)) {
    player.cooldowns[key] = Math.max(0, player.cooldowns[key] - dt);
  }
}

function applyInput(player, input, previous, dt) {
  player.blocking = input.block && player.hitstun <= 0 && player.grounded;
  if (player.hitstun > 0) {
    return;
  }

  if (input.dash && !previous.dash && player.cooldowns.dash <= 0) {
    player.dashTimer = 0.16;
    player.cooldowns.dash = 0.55;
    player.vx = player.facing * 760;
  }

  if (
    input.jump &&
    !previous.jump &&
    player.grounded &&
    player.cooldowns.jump <= 0
  ) {
    player.vy = -720;
    player.grounded = false;
    player.cooldowns.jump = 0.22;
  }

  if (input.light && !previous.light && player.cooldowns.light <= 0) {
    startAttack(player, "light", 0.16, 64, 8, 300);
  }

  if (input.heavy && !previous.heavy && player.cooldowns.heavy <= 0) {
    startAttack(player, "heavy", 0.24, 84, 14, 520);
  }

  if (input.special && !previous.special && player.cooldowns.special <= 0) {
    fireProjectile(player);
  }

  if (player.dashTimer <= 0 && !player.attack) {
    const speed = player.blocking ? 110 : 285;
    player.vx = input.x * speed;
  }

  if (player.attack) {
    player.vx *= 0.08 ** dt;
  }
}

function startAttack(player, kind, remaining, reach, damage, knockback) {
  player.attack = {
    kind,
    remaining,
    reach,
    damage,
    knockback,
    hit: new Set(),
  };
  player.cooldowns[kind] = kind === "light" ? 0.34 : 0.62;
}

function fireProjectile(player) {
  player.cooldowns.special = 1.25;
  player.energy = Math.max(0, player.energy - 8);
  game.projectiles.push({
    ownerId: player.id,
    x: player.x + player.facing * 54,
    y: player.y - 62,
    vx: player.facing * 620,
    r: 12,
    damage: 9,
  });
}

function integratePlayer(player, dt) {
  player.vy += gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.vx *= 0.02 ** dt;
  player.x = clamp(player.x, 56, W - 56);
  if (player.y >= floorY) {
    player.y = floorY;
    player.vy = 0;
    player.grounded = true;
  }
}

function separatePlayers(a, b) {
  const minDistance = 54;
  const delta = b.x - a.x;
  const overlap = minDistance - Math.abs(delta);
  if (overlap > 0) {
    const push = overlap / 2;
    const direction = delta >= 0 ? 1 : -1;
    a.x -= push * direction;
    b.x += push * direction;
  }
}

function resolveAttacks() {
  for (const attacker of players) {
    if (!attacker.attack) {
      continue;
    }
    const defender = attacker.id === "player-1" ? players[1] : players[0];
    if (attacker.attack.hit.has(defender.id)) {
      continue;
    }
    const hitbox = attackBox(attacker);
    const hurtbox = playerBox(defender);
    if (intersects(hitbox, hurtbox)) {
      attacker.attack.hit.add(defender.id);
      damagePlayer(
        defender,
        attacker,
        attacker.attack.damage,
        attacker.attack.knockback,
      );
    }
  }
}

function updateProjectiles(dt) {
  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * dt;
  }
  for (const projectile of game.projectiles) {
    const defender = players.find((player) => player.id !== projectile.ownerId);
    const attacker = players.find((player) => player.id === projectile.ownerId);
    if (!defender || !attacker || projectile.consumed) {
      continue;
    }
    if (circleRect(projectile, playerBox(defender))) {
      projectile.consumed = true;
      damagePlayer(defender, attacker, projectile.damage, 360);
    }
  }
  game.projectiles = game.projectiles.filter(
    (projectile) =>
      !projectile.consumed && projectile.x > -40 && projectile.x < W + 40,
  );
}

function damagePlayer(defender, attacker, damage, knockback) {
  const facingBlock = defender.blocking && defender.facing === -attacker.facing;
  const appliedDamage = facingBlock ? Math.ceil(damage * 0.22) : damage;
  defender.hp = Math.max(0, defender.hp - appliedDamage);
  defender.hitstun = facingBlock ? 0.08 : 0.22;
  defender.vx = attacker.facing * (facingBlock ? knockback * 0.25 : knockback);
  defender.vy = facingBlock ? defender.vy : Math.min(defender.vy, -170);
  attacker.energy = Math.min(100, attacker.energy + (facingBlock ? 3 : 8));
  game.sparks.push({
    x: defender.x - defender.facing * 26,
    y: defender.y - 66,
    life: 0.24,
    color: facingBlock ? "#8bd3ff" : "#f7c66a",
  });
  if (defender.hp <= 0) {
    finishRound(attacker);
  }
}

function updateSparks(dt) {
  for (const spark of game.sparks) {
    spark.life -= dt;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
}

function finishRound(winner) {
  if (game.mode !== "playing") {
    return;
  }
  game.mode = "round-over";
  game.winner = winner.id;
  scheduleRoundReset();
}

function scheduleRoundReset() {
  if (roundResetTimer) {
    return;
  }
  roundResetTimer = setTimeout(() => {
    roundResetTimer = undefined;
    resetRound();
  }, 2200);
}

function resetRound() {
  if (roundResetTimer) {
    clearTimeout(roundResetTimer);
    roundResetTimer = undefined;
  }
  game.mode = "playing";
  game.timeRemaining = 90;
  game.winner = null;
  game.projectiles = [];
  game.sparks = [];
  Object.assign(players[0], makePlayer("player-1", "RED", 260, "#dc4d4d", 1));
  Object.assign(
    players[1],
    makePlayer("player-2", "BLUE", 1020, "#4d82dc", -1),
  );
}

function attackBox(player) {
  const reach = player.attack?.reach ?? 0;
  return {
    x: player.x + player.facing * (player.w / 2 + reach / 2),
    y: player.y - 72,
    w: reach,
    h: 42,
  };
}

function playerBox(player) {
  return {
    x: player.x,
    y: player.y - player.h / 2,
    w: player.w,
    h: player.h,
  };
}

function intersects(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

function circleRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x - rect.w / 2, rect.x + rect.w / 2);
  const closestY = clamp(circle.y, rect.y - rect.h / 2, rect.y + rect.h / 2);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function render() {
  drawStage();
  drawHud();
  for (const projectile of game.projectiles) {
    drawProjectile(projectile);
  }
  for (const player of players) {
    drawPlayer(player);
  }
  for (const spark of game.sparks) {
    drawSpark(spark);
  }
  if (game.mode === "round-over") {
    drawRoundOver();
  }
}

function drawStage() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#3b4950");
  sky.addColorStop(0.58, "#c99a62");
  sky.addColorStop(1, "#302a1e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#243640";
  for (let index = 0; index < 8; index += 1) {
    const x = index * 180 - 60;
    ctx.fillRect(x, 180 + (index % 3) * 18, 96, 230);
  }

  ctx.fillStyle = "#4c4433";
  ctx.fillRect(0, floorY, W, H - floorY);
  ctx.fillStyle = "#74664a";
  ctx.fillRect(0, floorY, W, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, floorY + 12);
    ctx.lineTo(x - 90, H);
    ctx.stroke();
  }
}

function drawHud() {
  ctx.fillStyle = "rgba(24, 23, 19, 0.84)";
  roundRect(32, 28, 498, 34, 8);
  roundRect(W - 530, 28, 498, 34, 8);
  ctx.fillStyle = "#dc4d4d";
  roundRect(36, 32, 490 * (players[0].hp / 100), 26, 6);
  ctx.fillStyle = "#4d82dc";
  roundRect(
    W - 526 + 490 * (1 - players[1].hp / 100),
    32,
    490 * (players[1].hp / 100),
    26,
    6,
  );

  ctx.fillStyle = "#f6f0df";
  ctx.font = "700 22px Inter, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    String(Math.ceil(game.timeRemaining)).padStart(2, "0"),
    W / 2,
    55,
  );
  ctx.textAlign = "left";
  ctx.fillText("RED", 40, 88);
  ctx.textAlign = "right";
  ctx.fillText("BLUE", W - 40, 88);
}

function drawPlayer(player) {
  const box = playerBox(player);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.facing, 1);
  ctx.fillStyle = player.blocking ? "#9fd8ff" : player.color;
  roundRect(-box.w / 2, -player.h, box.w, player.h, 12);
  ctx.fillStyle = "#f6d8aa";
  ctx.beginPath();
  ctx.arc(0, -player.h - 18, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#181713";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(8, -68);
  ctx.lineTo(34, -58);
  ctx.stroke();
  if (player.attack) {
    const reach = player.attack.reach;
    ctx.fillStyle = "rgba(247, 198, 106, 0.55)";
    roundRect(24, -88, reach, 34, 17);
  }
  ctx.restore();
}

function drawProjectile(projectile) {
  ctx.fillStyle = projectile.ownerId === "player-1" ? "#ff9f7a" : "#8bb8ff";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff3c9";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSpark(spark) {
  ctx.globalAlpha = clamp(spark.life / 0.24, 0, 1);
  ctx.fillStyle = spark.color;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, 30 * ctx.globalAlpha, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRoundOver() {
  ctx.fillStyle = "rgba(24, 23, 19, 0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f6f0df";
  ctx.font = "800 54px Inter, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    `${game.winner === "player-1" ? "RED" : "BLUE"} WINS`,
    W / 2,
    H / 2,
  );
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function gameTextPayload() {
  return {
    coordinateSystem: "origin top-left, x increases right, y increases down",
    mode: game.mode,
    timeRemaining: Number(game.timeRemaining.toFixed(2)),
    winner: game.winner,
    round: game.round,
    players: players.map((player) => ({
      id: player.id,
      x: Math.round(player.x),
      y: Math.round(player.y),
      hp: player.hp,
      facing: player.facing,
      grounded: player.grounded,
      attacking: Boolean(player.attack),
      blocking: player.blocking,
    })),
    projectiles: game.projectiles.map((projectile) => ({
      ownerId: projectile.ownerId,
      x: Math.round(projectile.x),
      y: Math.round(projectile.y),
      vx: Math.round(projectile.vx),
    })),
  };
}

function publishArenaState() {
  if (socket?.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(
    JSON.stringify({
      type: "arena.state",
      snapshot: gameTextPayload(),
    }),
  );
}

function applyDeadzone(value) {
  return Math.abs(value) < 0.12 ? 0 : clamp(value, -1, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void canvas.requestFullscreen();
  }
}
