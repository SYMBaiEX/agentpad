import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  CommandContext,
  ControllerCommand,
  ControllerFeedbackEvent,
  ControllerProfileName,
  ControllerState,
  ReplayConfig,
  ReplayEvent,
} from "./types";

export class ReplayLogger {
  readonly dir: string;
  private readonly enabled: boolean;

  constructor(
    private readonly controllerId: string,
    private readonly profile: ControllerProfileName,
    private readonly config: ReplayConfig = {},
  ) {
    this.enabled = config.enabled ?? true;
    this.dir =
      config.dir ?? join("replays", defaultSessionDir(config.sessionId));
  }

  async start(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await mkdir(this.dir, { recursive: true });
    await writeFile(
      join(this.dir, "session.json"),
      `${JSON.stringify(
        {
          id: this.config.sessionId ?? this.dir.split("/").at(-1),
          controllerId: this.controllerId,
          profile: this.profile,
          source: this.config.source ?? "opencontroller",
          startedAt: new Date().toISOString(),
          metadata: this.config.metadata ?? {},
        },
        null,
        2,
      )}\n`,
    );
  }

  async command(
    command: ControllerCommand,
    stateBefore: ControllerState,
    stateAfter: ControllerState,
    context: CommandContext = {},
  ): Promise<void> {
    await this.write({
      type: "command",
      timestamp: Date.now(),
      controllerId: this.controllerId,
      profile: this.profile,
      command,
      stateBefore,
      stateAfter,
      ...context,
    });
  }

  async state(state: ControllerState): Promise<void> {
    await this.write({
      type: "state",
      timestamp: Date.now(),
      controllerId: this.controllerId,
      state,
    });
  }

  async feedback(
    feedback: ControllerFeedbackEvent,
    stateAfter: ControllerState,
  ): Promise<void> {
    await this.write({
      type: "feedback",
      timestamp: Date.now(),
      controllerId: this.controllerId,
      feedback,
      stateAfter,
    });
  }

  async error(error: unknown, command?: ControllerCommand): Promise<void> {
    await this.write({
      type: "error",
      timestamp: Date.now(),
      controllerId: this.controllerId,
      error: error instanceof Error ? error.message : String(error),
      ...(command ? { command } : {}),
    });
  }

  async annotation(
    label: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.write({
      type: "annotation",
      timestamp: Date.now(),
      label,
      ...(data ? { data } : {}),
    });
  }

  private async write(event: ReplayEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await appendFile(
      join(this.dir, "events.jsonl"),
      `${JSON.stringify(event)}\n`,
    );

    if (event.type === "command") {
      await appendFile(
        join(this.dir, "commands.jsonl"),
        `${JSON.stringify(event)}\n`,
      );
    }
    if (event.type === "state") {
      await appendFile(
        join(this.dir, "states.jsonl"),
        `${JSON.stringify(event)}\n`,
      );
    }
    if (event.type === "feedback") {
      await appendFile(
        join(this.dir, "feedback.jsonl"),
        `${JSON.stringify(event)}\n`,
      );
    }
    if (event.type === "error") {
      await appendFile(
        join(this.dir, "errors.jsonl"),
        `${JSON.stringify(event)}\n`,
      );
    }
  }
}

function defaultSessionDir(sessionId?: string): string {
  if (sessionId) {
    return sessionId;
  }

  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d+Z$/, "Z");
  return `${stamp}-session`;
}
