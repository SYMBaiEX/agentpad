import type { Controller } from "../controller";
import type { CommandContext, ControllerCommand } from "../types";

export type ActionMapDefinition = Record<string, ControllerCommand[]>;

export type ActionRunOptions = CommandContext & {
  durationMs?: number;
};

export type ActionMap = {
  run(actionName: string, options?: ActionRunOptions): Promise<void>;
  list(): string[];
  has(actionName: string): boolean;
};

export function createActionMap(
  controller: Controller,
  definition: ActionMapDefinition,
): ActionMap {
  return {
    async run(actionName, options = {}) {
      const commands = definition[actionName];
      if (!commands) {
        throw new Error(`Unknown action: ${actionName}`);
      }

      const durationMs = options.durationMs;
      const resolved =
        durationMs !== undefined
          ? commands.map((command) => applyDuration(command, durationMs))
          : commands;

      await controller.sequence(resolved, {
        intent: options.intent ?? actionName,
        source: options.source ?? "action-map",
      });
    },
    list() {
      return Object.keys(definition);
    },
    has(actionName) {
      return Boolean(definition[actionName]);
    },
  };
}

function applyDuration(
  command: ControllerCommand,
  durationMs: number,
): ControllerCommand {
  switch (command.type) {
    case "press":
    case "stick":
    case "trigger":
    case "dpad":
    case "combo":
      return {
        ...command,
        durationMs,
      };
    case "sequence":
      return {
        ...command,
        commands: command.commands.map((child) =>
          applyDuration(child, durationMs),
        ),
      };
    case "release":
    case "wait":
    case "neutral":
      return command;
  }
}
