import { ProfileError } from "../errors";
import type {
  ControllerCommand,
  ControllerProfileName,
  DpadDirection,
  NormalizedControllerCommand,
} from "../types";
import { genericHidProfile } from "./generic-hid";
import { keyboardMouseProfile } from "./keyboard-mouse";
import { playstationProfile } from "./playstation";
import { switchProfile } from "./switch";
import type { UniversalControl } from "./universal";
import { xboxProfile } from "./xbox";

export type ControllerProfile = {
  name: ControllerProfileName;
  buttons: readonly string[];
  triggers: readonly string[];
  aliases: Record<string, string>;
  toUniversal: Record<string, UniversalControl>;
};

export const controllerProfiles = {
  xbox: xboxProfile,
  playstation: playstationProfile,
  switch: switchProfile,
  "generic-hid": genericHidProfile,
  "keyboard-mouse": keyboardMouseProfile,
} satisfies Record<ControllerProfileName, ControllerProfile>;

export function resolveProfile(
  profileName: ControllerProfileName,
): ControllerProfile {
  const profile = controllerProfiles[profileName];
  if (!profile) {
    throw new ProfileError(`Unknown controller profile: ${profileName}`);
  }

  return profile;
}

export function resolveButton(
  profile: ControllerProfile,
  button: string,
): string {
  const resolved = profile.aliases[button] ?? button;
  if (!profile.buttons.includes(resolved)) {
    throw new ProfileError(
      `Button ${button} is not supported by ${profile.name}`,
    );
  }

  return resolved;
}

export function resolveTrigger(
  profile: ControllerProfile,
  trigger: string,
): string {
  const resolved = profile.aliases[trigger] ?? trigger;
  if (!profile.triggers.includes(resolved)) {
    throw new ProfileError(
      `Trigger ${trigger} is not supported by ${profile.name}`,
    );
  }

  return resolved;
}

export function toUniversal(
  profile: ControllerProfile,
  button: string,
): UniversalControl | undefined {
  const resolved = profile.aliases[button] ?? button;
  return profile.toUniversal[resolved];
}

export function dpadButton(direction: DpadDirection): string {
  return `DPAD_${direction}`;
}

export function normalizeCommand(
  profile: ControllerProfile,
  controllerId: string,
  command: ControllerCommand,
): NormalizedControllerCommand {
  const timestamp = Date.now();
  const id = crypto.randomUUID();

  switch (command.type) {
    case "press": {
      const button = resolveButton(profile, command.button);
      const universal = toUniversal(profile, button);
      const normalizedCommand: ControllerCommand =
        command.pressure === undefined
          ? {
              ...command,
              button,
            }
          : {
              ...command,
              button,
              pressure: clamp(command.pressure, 0, 1),
            };
      return {
        id,
        controllerId,
        profile: profile.name,
        command: normalizedCommand,
        timestamp,
        ...(universal ? { universal: { buttons: [universal] } } : {}),
      };
    }
    case "release": {
      const button = resolveButton(profile, command.button);
      const universal = toUniversal(profile, button);
      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          button,
        },
        timestamp,
        ...(universal ? { universal: { buttons: [universal] } } : {}),
      };
    }
    case "trigger": {
      const trigger = resolveTrigger(profile, command.trigger);
      const universal = toUniversal(profile, trigger);
      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          trigger,
          value: clamp(command.value, 0, 1),
        },
        timestamp,
        ...(universal ? { universal: { trigger: universal } } : {}),
      };
    }
    case "stick":
      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          x: clamp(command.x, -1, 1),
          y: clamp(command.y, -1, 1),
        },
        timestamp,
        universal: {
          stick: command.stick,
        },
      };
    case "dpad": {
      const button = resolveButton(profile, dpadButton(command.direction));
      const universal = toUniversal(profile, button);
      return {
        id,
        controllerId,
        profile: profile.name,
        command,
        timestamp,
        ...(universal ? { universal: { dpad: universal } } : {}),
      };
    }
    case "combo": {
      const buttons = command.buttons.map((button) =>
        resolveButton(profile, button),
      );
      const universalButtons = buttons
        .map((button) => toUniversal(profile, button))
        .filter((button): button is UniversalControl => Boolean(button));

      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          buttons,
        },
        timestamp,
        ...(universalButtons.length > 0
          ? { universal: { buttons: universalButtons } }
          : {}),
      };
    }
    case "sequence":
    case "wait":
    case "neutral":
      return {
        id,
        controllerId,
        profile: profile.name,
        command,
        timestamp,
      };
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    throw new ProfileError(
      `Expected a finite number, received ${String(value)}`,
    );
  }

  return Math.min(max, Math.max(min, value));
}

export * from "./universal";
export * from "./xbox";
export * from "./playstation";
export * from "./switch";
export * from "./generic-hid";
export * from "./keyboard-mouse";
