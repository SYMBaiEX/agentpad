import { resolveAdapter } from "./adapters";
import { ControllerRuntime } from "./runtime";
import type {
  CommandContext,
  ControllerCommand,
  ControllerTouchpadContactInput,
  ControllerVector3,
  CreateControllerOptions,
  DpadDirection,
  FeedbackListener,
  StateListener,
  StickName,
} from "./types";

export class Controller {
  constructor(private readonly runtime: ControllerRuntime) {}

  async press(
    button: string,
    durationMs = 90,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send({ type: "press", button, durationMs }, context);
  }

  async release(button: string, context?: CommandContext): Promise<void> {
    await this.runtime.send({ type: "release", button }, context);
  }

  async moveStick(
    stick: StickName,
    value: { x: number; y: number },
    durationMs = 120,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "stick",
        stick,
        x: value.x,
        y: value.y,
        durationMs,
      },
      context,
    );
  }

  async trigger(
    trigger: string,
    value: number,
    durationMs = 120,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "trigger",
        trigger,
        value,
        durationMs,
      },
      context,
    );
  }

  async dpad(
    direction: DpadDirection,
    durationMs = 90,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send({ type: "dpad", direction, durationMs }, context);
  }

  async combo(
    buttons: string[],
    durationMs = 80,
    staggerMs = 0,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "combo",
        buttons,
        durationMs,
        staggerMs,
      },
      context,
    );
  }

  async sequence(
    commands: ControllerCommand[],
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send({ type: "sequence", commands }, context);
  }

  async wait(ms: number, context?: CommandContext): Promise<void> {
    await this.runtime.send({ type: "wait", ms }, context);
  }

  async touchpad(
    input: {
      contacts?: ControllerTouchpadContactInput[];
      pressed?: boolean;
    },
    durationMs = 120,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "touchpad",
        ...input,
        durationMs,
      },
      context,
    );
  }

  async motion(
    input: {
      acceleration?: ControllerVector3;
      gyroscope?: ControllerVector3;
      orientation?: ControllerVector3;
    },
    durationMs = 0,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "motion",
        ...input,
        durationMs,
      },
      context,
    );
  }

  async neutral(context?: CommandContext): Promise<void> {
    await this.runtime.send({ type: "neutral" }, context);
  }

  getState() {
    return this.runtime.getState();
  }

  onStateChange(callback: StateListener) {
    return this.runtime.onStateChange(callback);
  }

  onFeedback(callback: FeedbackListener) {
    return this.runtime.onFeedback(callback);
  }

  capabilities() {
    return this.runtime.capabilities();
  }

  async disconnect(): Promise<void> {
    await this.runtime.disconnect();
  }
}

export async function createController(
  options: CreateControllerOptions,
): Promise<Controller> {
  const adapter = await resolveAdapter(options);
  const runtime = new ControllerRuntime({
    id: options.id ?? "player-1",
    profile: options.profile,
    adapter,
    ...(options.safety ? { safety: options.safety } : {}),
    ...(options.replay !== undefined ? { replay: options.replay } : {}),
  });

  await runtime.connect();
  return new Controller(runtime);
}
