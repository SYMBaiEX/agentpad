import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type Browser, type Page, chromium } from "playwright";

type PlayerId = "player-1" | "player-2";

type RunnerOptions = {
  durationMs: number;
  pollMs: number;
  startupTimeoutMs: number;
  port: number;
  url?: string;
  output?: string;
  headed: boolean;
  verbose: boolean;
};

type ArenaSnapshot = {
  mode?: string;
  timeRemaining?: number;
  winner?: PlayerId | null;
  round?: number;
  players?: Array<{
    id: PlayerId;
    hp?: number;
    x?: number;
    y?: number;
  }>;
};

type TelemetryPayload = {
  arena?: ArenaSnapshot;
  management?: Record<string, unknown>;
  events?: Array<{
    playerId?: PlayerId;
    source?: string;
    action?: string;
    timestamp?: number;
  }>;
};

type MatchSummary = {
  baseUrl: string;
  durationMs: number;
  pollMs: number;
  startedServer: boolean;
  roundsCompleted: number;
  winners: Record<PlayerId, number>;
  decisions: {
    total: number;
    byPlayer: Record<PlayerId, number>;
    bySource: Record<string, number>;
  };
  finalArena?: ArenaSnapshot;
  management?: Record<string, unknown>;
};

const options = parseArgs(Bun.argv.slice(2));
const baseUrl = options.url ?? `http://127.0.0.1:${options.port}`;
let serverProcess: Bun.Subprocess | undefined;
let browser: Browser | undefined;
let agentsStarted = false;

try {
  if (!options.url) {
    serverProcess = startServer(options);
    await waitForServer(baseUrl, options.startupTimeoutMs, serverProcess);
  }

  browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  pipeBrowserDiagnostics(page, options.verbose);

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      typeof (window as Window & { advanceTime?: unknown }).advanceTime ===
      "function",
  );

  await postJson(`${baseUrl}/management/reset`);
  await postJson(`${baseUrl}/management/start`);
  agentsStarted = true;

  let summary = await runMatch(baseUrl, options);
  await postJson(`${baseUrl}/management/stop`);
  agentsStarted = false;

  const stoppedTelemetry = await getJson<TelemetryPayload>(
    `${baseUrl}/telemetry`,
  );
  summary = {
    ...summary,
    ...(stoppedTelemetry.arena ? { finalArena: stoppedTelemetry.arena } : {}),
    ...(stoppedTelemetry.management
      ? { management: stoppedTelemetry.management }
      : {}),
  };

  const json = `${JSON.stringify(summary, null, 2)}\n`;
  if (options.output) {
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json);
    console.log(`Headless match summary written to ${outputPath}`);
  } else {
    console.log(json);
  }
} finally {
  if (agentsStarted) {
    await postJson(`${baseUrl}/management/stop`).catch(() => undefined);
  }
  await browser?.close();
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await Promise.race([serverProcess.exited, sleep(1000)]);
  }
}

async function runMatch(
  baseUrl: string,
  options: RunnerOptions,
): Promise<MatchSummary> {
  const startedAt = Date.now();
  const winners: Record<PlayerId, number> = {
    "player-1": 0,
    "player-2": 0,
  };
  let roundsCompleted = 0;
  let lastWinner: PlayerId | null = null;
  let latest: TelemetryPayload = {};

  while (Date.now() - startedAt < options.durationMs) {
    latest = await getJson<TelemetryPayload>(`${baseUrl}/telemetry`);
    const winner = normalizeWinner(latest.arena?.winner);
    if (winner && winner !== lastWinner) {
      winners[winner] += 1;
      roundsCompleted += 1;
      lastWinner = winner;
    }
    if (!winner && latest.arena?.mode === "playing") {
      lastWinner = null;
    }
    await sleep(options.pollMs);
  }

  latest = await getJson<TelemetryPayload>(`${baseUrl}/telemetry`);
  const events = (latest.events ?? []).filter(
    (event) =>
      typeof event.timestamp === "number" && event.timestamp >= startedAt,
  );

  return {
    baseUrl,
    durationMs: Date.now() - startedAt,
    pollMs: options.pollMs,
    startedServer: !options.url,
    roundsCompleted,
    winners,
    decisions: {
      total: events.length,
      byPlayer: countByPlayer(events),
      bySource: countBySource(events),
    },
    ...(latest.arena ? { finalArena: latest.arena } : {}),
    ...(latest.management ? { management: latest.management } : {}),
  };
}

function startServer(options: RunnerOptions): Bun.Subprocess {
  const proc = Bun.spawn(["bun", "run", "server.ts"], {
    cwd: import.meta.dir,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...Bun.env,
      OPENCONTROLLER_FIGHTER_PORT: String(options.port),
      OPENCONTROLLER_AGENT_TICK_MS: String(
        Bun.env.OPENCONTROLLER_AGENT_TICK_MS ?? "16",
      ),
    },
  });
  drainStream(proc.stdout, "server", options.verbose);
  drainStream(proc.stderr, "server", true);
  return proc;
}

function drainStream(
  stream: ReadableStream<Uint8Array> | null,
  label: string,
  verbose: boolean,
): void {
  if (!stream) {
    return;
  }
  const decoder = new TextDecoder();
  void (async () => {
    const reader = stream.getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) {
          break;
        }
        const text = decoder.decode(next.value, { stream: true });
        if (verbose && text.trim()) {
          process.stderr.write(`[${label}] ${text}`);
        }
      }
    } finally {
      reader.releaseLock();
    }
  })();
}

function pipeBrowserDiagnostics(page: Page, verbose: boolean): void {
  if (!verbose) {
    return;
  }
  page.on("console", (message) => {
    process.stderr.write(`[browser:${message.type()}] ${message.text()}\n`);
  });
  page.on("pageerror", (error) => {
    process.stderr.write(`[browser:error] ${error.message}\n`);
  });
}

async function waitForServer(
  baseUrl: string,
  startupTimeoutMs: number,
  serverProcess?: Bun.Subprocess,
): Promise<void> {
  const startedAt = Date.now();
  let serverExitCode: number | undefined;
  void serverProcess?.exited.then((exitCode) => {
    serverExitCode = exitCode;
  });

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (serverExitCode !== undefined) {
      throw new Error(
        `Spawned Agent Fighter server exited before ${baseUrl} was ready (code ${serverExitCode})`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/state`, {
        headers: { accept: "application/json" },
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson(url: string): Promise<void> {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
}

function countByPlayer(
  events: NonNullable<TelemetryPayload["events"]>,
): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = { "player-1": 0, "player-2": 0 };
  for (const event of events) {
    const playerId = normalizeWinner(event.playerId);
    if (playerId) {
      counts[playerId] += 1;
    }
  }
  return counts;
}

function countBySource(
  events: NonNullable<TelemetryPayload["events"]>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const source = event.source ?? "unknown";
    counts[source] = (counts[source] ?? 0) + 1;
  }
  return counts;
}

function normalizeWinner(value: unknown): PlayerId | null {
  return value === "player-1" || value === "player-2" ? value : null;
}

function parseArgs(args: string[]): RunnerOptions {
  const options: RunnerOptions = {
    durationMs: 15_000,
    pollMs: 250,
    startupTimeoutMs: 6_000,
    port: 5173,
    headed: false,
    verbose: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--duration-ms":
        options.durationMs = readPositiveNumber(args[++index], arg);
        break;
      case "--poll-ms":
        options.pollMs = readPositiveNumber(args[++index], arg);
        break;
      case "--startup-timeout-ms":
        options.startupTimeoutMs = readPositiveNumber(args[++index], arg);
        break;
      case "--port":
        options.port = readPositiveNumber(args[++index], arg);
        break;
      case "--url":
        options.url = readRequiredValue(args[++index], arg);
        break;
      case "--output":
        options.output = readRequiredValue(args[++index], arg);
        break;
      case "--headed":
        options.headed = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readPositiveNumber(value: string | undefined, option: string): number {
  const parsed = Number(readRequiredValue(value, option));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive number`);
  }
  return Math.round(parsed);
}

function readRequiredValue(value: string | undefined, option: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`OpenController Agent Fighter Headless Runner

Usage:
  bun --cwd examples/agent-fighter headless [options]

Options:
  --duration-ms <ms>          Match runtime before summarizing (default: 15000)
  --poll-ms <ms>              Telemetry polling interval (default: 250)
  --startup-timeout-ms <ms>   Time to wait for spawned server (default: 6000)
  --port <port>               Port for spawned server (default: 5173)
  --url <url>                 Use an already-running server instead of spawning
  --output <path>             Write JSON summary to a file
  --headed                    Show the Chromium window
  --verbose                   Print server and browser diagnostics
  --help                      Show this help
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
