import type { ControllerAdapter } from "./adapters";
import type { Unsubscribe } from "./events";
import {
  type ControllerProfile,
  dpadButtons,
  normalizeCommand,
  resolveProfile,
} from "./profiles";
import { CommandQueue } from "./queue";
import { ReplayLogger } from "./replay";
import { SafetyGuard } from "./safety";
import { ControllerStateStore } from "./state";
import type {
  CommandContext,
  ControllerCommand,
  ControllerState,
  CreateControllerOptions,
  FeedbackListener,
  StateListener,
} from "./types";

export type ControllerRuntimeOptions = Required<
  Pick<CreateControllerOptions, "id">
> &
  Pick<CreateControllerOptions, "profile" | "safety" | "replay"> & {
    adapter: ControllerAdapter;
  };

export class ControllerRuntime {
  readonly id: string;
  readonly profile: ControllerProfile;
  readonly adapter: ControllerAdapter;
  readonly safety: SafetyGuard;
  private readonly queue = new CommandQueue();
  private readonly state: ControllerStateStore;
  private readonly replay?: ReplayLogger;

  constructor(options: ControllerRuntimeOptions) {
    this.id = options.id;
    this.profile = resolveProfile(options.profile);
    this.adapter = options.adapter;
    this.safety = new SafetyGuard(this.profile, options.safety);
    this.state = new ControllerStateStore(this.id, this.profile);

    if (options.replay !== false) {
      this.replay = new ReplayLogger(
        this.id,
        this.profile.name,
        options.replay,
      );
    }
  }

  async connect(): Promise<void> {
    await this.adapter.connect();
    const next = this.state.setConnected(true);
    await this.replay?.start();
    await this.replay?.state(next);
    await this.syncState(next);
  }

  async send(
    command: ControllerCommand,
    context: CommandContext = {},
  ): Promise<void> {
    await this.queue.enqueue(async () => {
      try {
        await this.processCommand(command, context);
      } catch (error) {
        await this.replay?.error(error, command);
        if (this.safety.getConfig().neutralOnError) {
          await this.forceNeutral();
        }
        throw error;
      }
    });
  }

  getState(): ControllerState {
    return this.state.getState();
  }

  onStateChange(listener: StateListener) {
    return this.state.subscribe(listener);
  }

  onFeedback(listener: FeedbackListener): Unsubscribe {
    return this.adapter.onFeedback?.(listener) ?? (() => {});
  }

  capabilities() {
    return this.adapter.capabilities();
  }

  async disconnect(): Promise<void> {
    await this.queue.drain();
    if (this.safety.getConfig().neutralOnDisconnect) {
      await this.forceNeutral();
    }
    await this.adapter.disconnect();
    const next = this.state.setConnected(false);
    await this.replay?.state(next);
  }

  private async processCommand(
    command: ControllerCommand,
    context: CommandContext,
  ): Promise<void> {
    this.safety.assert(command);

    switch (command.type) {
      case "sequence":
        for (const child of command.commands) {
          await this.processCommand(child, context);
        }
        return;
      case "combo":
        await this.runCombo(command, context);
        return;
      case "wait":
        await sleep(command.ms);
        await this.logCommand(
          command,
          this.state.getState(),
          this.state.getState(),
          context,
        );
        return;
      case "neutral":
        await this.forceNeutral(command, context);
        return;
      case "press":
        await this.runPress(command, context);
        return;
      case "release":
        await this.runRelease(command, context);
        return;
      case "setButton":
        await this.runSetButton(command, context);
        return;
      case "stick":
        await this.runStick(command, context);
        return;
      case "trigger":
        await this.runTrigger(command, context);
        return;
      case "setStick":
        await this.runSetStick(command, context);
        return;
      case "setTrigger":
        await this.runSetTrigger(command, context);
        return;
      case "touchpad":
        await this.runTouchpad(command, context);
        return;
      case "motion":
        await this.runMotion(command, context);
        return;
      case "dpad":
        await this.runDpad(command, context);
        return;
      case "setDpad":
        await this.runSetDpad(command, context);
        return;
    }
  }

  private async runPress(
    command: Extract<ControllerCommand, { type: "press" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "press") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setButton(
      normalized.command.button,
      true,
      normalized.command.pressure,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);

    if (
      normalized.command.durationMs !== undefined &&
      normalized.command.durationMs > 0
    ) {
      await sleep(normalized.command.durationMs);
      await this.runRelease(
        { type: "release", button: normalized.command.button },
        context,
      );
    }
  }

  private async runRelease(
    command: Extract<ControllerCommand, { type: "release" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "release") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setButton(normalized.command.button, false, 0);
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);
  }

  private async runSetButton(
    command: Extract<ControllerCommand, { type: "setButton" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "setButton") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setButton(
      normalized.command.button,
      normalized.command.pressed,
      normalized.command.pressed ? normalized.command.pressure : 0,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);
  }

  private async runStick(
    command: Extract<ControllerCommand, { type: "stick" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "stick") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setStick(
      normalized.command.stick,
      normalized.command.x,
      normalized.command.y,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);

    if (
      normalized.command.durationMs !== undefined &&
      normalized.command.durationMs > 0
    ) {
      await sleep(normalized.command.durationMs);
      await this.runStick(
        {
          type: "stick",
          stick: normalized.command.stick,
          x: 0,
          y: 0,
        },
        context,
      );
    }
  }

  private async runSetStick(
    command: Extract<ControllerCommand, { type: "setStick" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "setStick") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setStick(
      normalized.command.stick,
      normalized.command.x,
      normalized.command.y,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);
  }

  private async runTrigger(
    command: Extract<ControllerCommand, { type: "trigger" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "trigger") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setTrigger(
      normalized.command.trigger,
      normalized.command.value,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);

    if (
      normalized.command.durationMs !== undefined &&
      normalized.command.durationMs > 0
    ) {
      await sleep(normalized.command.durationMs);
      await this.runTrigger(
        {
          type: "trigger",
          trigger: normalized.command.trigger,
          value: 0,
        },
        context,
      );
    }
  }

  private async runSetTrigger(
    command: Extract<ControllerCommand, { type: "setTrigger" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "setTrigger") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setTrigger(
      normalized.command.trigger,
      normalized.command.value,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);
  }

  private async runDpad(
    command: Extract<ControllerCommand, { type: "dpad" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "dpad") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setDpad(normalized.command.direction, true);
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);

    if (
      normalized.command.durationMs !== undefined &&
      normalized.command.durationMs > 0
    ) {
      await sleep(normalized.command.durationMs);
      for (const button of dpadButtons(normalized.command.direction)) {
        await this.runRelease({ type: "release", button }, context);
      }
    }
  }

  private async runSetDpad(
    command: Extract<ControllerCommand, { type: "setDpad" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "setDpad") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setDpadState(normalized.command.direction);
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);
  }

  private async runTouchpad(
    command: Extract<ControllerCommand, { type: "touchpad" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "touchpad") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setTouchpad(
      normalized.command.contacts ?? [],
      normalized.command.pressed ?? false,
    );
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);

    if (
      normalized.command.durationMs !== undefined &&
      normalized.command.durationMs > 0
    ) {
      await sleep(normalized.command.durationMs);
      await this.runTouchpad(
        {
          type: "touchpad",
          contacts: [],
          pressed: false,
        },
        context,
      );
    }
  }

  private async runMotion(
    command: Extract<ControllerCommand, { type: "motion" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "motion") {
      return;
    }

    const before = this.state.getState();
    await this.adapter.send(normalized);
    const after = this.state.setMotion(normalized.command);
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);

    if (
      normalized.command.durationMs !== undefined &&
      normalized.command.durationMs > 0
    ) {
      await sleep(normalized.command.durationMs);
      await this.runMotion(
        {
          type: "motion",
          acceleration: { x: 0, y: 0, z: 0 },
          gyroscope: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0 },
        },
        context,
      );
    }
  }

  private async runCombo(
    command: Extract<ControllerCommand, { type: "combo" }>,
    context: CommandContext,
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    if (normalized.command.type !== "combo") {
      return;
    }

    for (const button of normalized.command.buttons) {
      await this.runPress({ type: "press", button }, context);
      if (normalized.command.staggerMs && normalized.command.staggerMs > 0) {
        await sleep(normalized.command.staggerMs);
      }
    }

    if (normalized.command.durationMs && normalized.command.durationMs > 0) {
      await sleep(normalized.command.durationMs);
    }

    for (const button of [...normalized.command.buttons].reverse()) {
      await this.runRelease({ type: "release", button }, context);
    }
  }

  private async forceNeutral(
    command: ControllerCommand = { type: "neutral" },
    context: CommandContext = {},
  ): Promise<void> {
    const normalized = normalizeCommand(this.profile, this.id, command);
    const before = this.state.getState();
    await this.adapter.neutral(normalized);
    const after = this.state.neutral();
    await this.logCommand(normalized.command, before, after, context);
    await this.syncState(after);
  }

  private async logCommand(
    command: ControllerCommand,
    stateBefore: ControllerState,
    stateAfter: ControllerState,
    context: CommandContext,
  ): Promise<void> {
    await this.replay?.command(command, stateBefore, stateAfter, context);
  }

  private async syncState(state: ControllerState): Promise<void> {
    await this.adapter.syncState?.(state);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
