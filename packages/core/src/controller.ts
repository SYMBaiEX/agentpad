import { resolveAdapter } from "./adapters";
import { ControllerRuntime } from "./runtime";
import type {
  CommandContext,
  ControllerCommand,
  ControllerPressOptions,
  ControllerSetButtonOptions,
  ControllerTouchpadContactInput,
  ControllerVector3,
  CreateControllerOptions,
  DpadDirection,
  DpadState,
  FeedbackListener,
  StateListener,
  StickName,
} from "./types";

export class Controller {
  constructor(private readonly runtime: ControllerRuntime) {}

  async press(
    button: string,
    durationMs?: number,
    context?: CommandContext,
  ): Promise<void>;
  async press(button: string, options?: ControllerPressOptions): Promise<void>;
  async press(
    button: string,
    durationOrOptions: number | ControllerPressOptions = 90,
    context?: CommandContext,
  ): Promise<void> {
    const options: ControllerPressOptions =
      typeof durationOrOptions === "number"
        ? {
            durationMs: durationOrOptions,
            ...(context !== undefined ? { context } : {}),
          }
        : durationOrOptions;
    const durationMs = options?.durationMs ?? 90;
    await this.runtime.send(
      {
        type: "press",
        button,
        durationMs,
        ...(options?.pressure !== undefined
          ? { pressure: options.pressure }
          : {}),
      },
      options?.context,
    );
  }

  async release(button: string, context?: CommandContext): Promise<void> {
    await this.runtime.send({ type: "release", button }, context);
  }

  async setButton(
    button: string,
    pressed: boolean,
    context?: CommandContext,
  ): Promise<void>;
  async setButton(
    button: string,
    options: ControllerSetButtonOptions,
  ): Promise<void>;
  async setButton(
    button: string,
    pressedOrOptions: boolean | ControllerSetButtonOptions,
    context?: CommandContext,
  ): Promise<void> {
    const options: ControllerSetButtonOptions =
      typeof pressedOrOptions === "boolean"
        ? {
            pressed: pressedOrOptions,
            ...(context !== undefined ? { context } : {}),
          }
        : pressedOrOptions;
    await this.runtime.send(
      {
        type: "setButton",
        button,
        pressed: options.pressed,
        ...(options.pressure !== undefined
          ? { pressure: options.pressure }
          : {}),
      },
      options.context,
    );
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

  async setStick(
    stick: StickName,
    value: { x: number; y: number },
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "setStick",
        stick,
        x: value.x,
        y: value.y,
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

  async setTrigger(
    trigger: string,
    value: number,
    context?: CommandContext,
  ): Promise<void> {
    await this.runtime.send(
      {
        type: "setTrigger",
        trigger,
        value,
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

  async setDpad(direction: DpadState, context?: CommandContext): Promise<void> {
    await this.runtime.send({ type: "setDpad", direction }, context);
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
