import { ProfileError } from "../errors";
import type {
  ControllerCommand,
  ControllerDeviceStatusPatch,
  ControllerProfileName,
  ControllerStatePatch,
  DpadCardinalDirection,
  DpadDirection,
  DpadState,
  NormalizedControllerCommand,
  StickName,
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
  features?: {
    touchpad?: boolean;
    motion?: boolean;
  };
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

export function dpadButton(direction: DpadCardinalDirection): string {
  return `DPAD_${direction}`;
}

export function dpadDirections(
  direction: DpadDirection,
): readonly DpadCardinalDirection[] {
  switch (direction) {
    case "UP":
    case "DOWN":
    case "LEFT":
    case "RIGHT":
      return [direction];
    case "UP_LEFT":
      return ["UP", "LEFT"];
    case "UP_RIGHT":
      return ["UP", "RIGHT"];
    case "DOWN_LEFT":
      return ["DOWN", "LEFT"];
    case "DOWN_RIGHT":
      return ["DOWN", "RIGHT"];
  }
}

export function dpadButtons(direction: DpadDirection): string[] {
  return dpadDirections(direction).map(dpadButton);
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
    case "setButton": {
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
    case "setTrigger": {
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
    case "setStick":
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
    case "touchpad": {
      if (!profile.features?.touchpad) {
        throw new ProfileError(
          `Touchpad input is not supported by ${profile.name}`,
        );
      }

      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          ...(command.contacts
            ? {
                contacts: command.contacts.map((contact, index) => ({
                  id: contact.id ?? index,
                  x: clamp(contact.x, 0, 1),
                  y: clamp(contact.y, 0, 1),
                  active: contact.active ?? true,
                  pressure: clamp(contact.pressure ?? 1, 0, 1),
                })),
              }
            : {}),
        },
        timestamp,
        universal: {
          buttons: ["TOUCHPAD"],
        },
      };
    }
    case "motion":
      if (!profile.features?.motion) {
        throw new ProfileError(
          `Motion input is not supported by ${profile.name}`,
        );
      }

      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          ...(command.acceleration
            ? { acceleration: normalizeVector3(command.acceleration) }
            : {}),
          ...(command.gyroscope
            ? { gyroscope: normalizeVector3(command.gyroscope) }
            : {}),
          ...(command.orientation
            ? { orientation: normalizeVector3(command.orientation) }
            : {}),
        },
        timestamp,
      };
    case "dpad": {
      const buttons = dpadButtons(command.direction).map((button) =>
        resolveButton(profile, button),
      );
      const universal = buttons
        .map((button) => toUniversal(profile, button))
        .filter((button): button is UniversalControl => Boolean(button));
      return {
        id,
        controllerId,
        profile: profile.name,
        command,
        timestamp,
        ...(universal.length > 0
          ? { universal: { dpad: universal.join("+") } }
          : {}),
      };
    }
    case "setDpad": {
      const universal = universalDpadState(profile, command.direction);
      return {
        id,
        controllerId,
        profile: profile.name,
        command,
        timestamp,
        ...(universal ? { universal: { dpad: universal } } : {}),
      };
    }
    case "setState": {
      const state = normalizeControllerStatePatch(profile, command.state);
      const universal = universalStatePatch(profile, state);
      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          state,
        },
        timestamp,
        ...(universal ? { universal } : {}),
      };
    }
    case "setStatus":
      return {
        id,
        controllerId,
        profile: profile.name,
        command: {
          ...command,
          status: normalizeControllerDeviceStatusPatch(command.status),
        },
        timestamp,
      };
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

function normalizeVector3<T extends { x: number; y: number; z: number }>(
  value: T,
): T {
  assertFinite(value.x);
  assertFinite(value.y);
  assertFinite(value.z);
  return value;
}

function assertFinite(value: number): void {
  if (!Number.isFinite(value)) {
    throw new ProfileError(
      `Expected a finite number, received ${String(value)}`,
    );
  }
}

function universalDpadState(
  profile: ControllerProfile,
  direction: DpadState,
): string | undefined {
  if (direction === "NEUTRAL") {
    return "NEUTRAL";
  }

  const buttons = dpadButtons(direction).map((button) =>
    resolveButton(profile, button),
  );
  const universal = buttons
    .map((button) => toUniversal(profile, button))
    .filter((button): button is UniversalControl => Boolean(button));
  return universal.length > 0 ? universal.join("+") : undefined;
}

function normalizeControllerStatePatch(
  profile: ControllerProfile,
  patch: ControllerStatePatch,
): ControllerStatePatch {
  const normalized: ControllerStatePatch = {};

  if (patch.buttons) {
    const buttons: Record<
      string,
      NonNullable<ControllerStatePatch["buttons"]>[string]
    > = {};
    for (const [inputButton, value] of Object.entries(patch.buttons)) {
      const button = resolveButton(profile, inputButton);
      buttons[button] =
        typeof value === "boolean"
          ? value
          : {
              pressed: value.pressed,
              ...(value.pressure !== undefined
                ? { pressure: clamp(value.pressure, 0, 1) }
                : {}),
            };
    }
    normalized.buttons = buttons;
  }

  if (patch.triggers) {
    const triggers: Record<string, number> = {};
    for (const [inputTrigger, value] of Object.entries(patch.triggers)) {
      const trigger = resolveTrigger(profile, inputTrigger);
      triggers[trigger] = clamp(value, 0, 1);
    }
    normalized.triggers = triggers;
  }

  if (patch.sticks) {
    const sticks: NonNullable<ControllerStatePatch["sticks"]> = {};
    for (const [inputStick, value] of Object.entries(patch.sticks)) {
      const stick = normalizeStickName(inputStick);
      sticks[stick] = {
        x: clamp(value.x, -1, 1),
        y: clamp(value.y, -1, 1),
      };
    }
    normalized.sticks = sticks;
  }

  if (patch.dpad !== undefined) {
    if (patch.dpad !== "NEUTRAL") {
      for (const button of dpadButtons(patch.dpad)) {
        resolveButton(profile, button);
      }
    }
    normalized.dpad = patch.dpad;
  }

  if (patch.touchpad) {
    if (!profile.features?.touchpad) {
      throw new ProfileError(
        `Touchpad input is not supported by ${profile.name}`,
      );
    }
    normalized.touchpad = {
      ...(patch.touchpad.contacts
        ? { contacts: normalizeTouchpadContacts(patch.touchpad.contacts) }
        : {}),
      ...(patch.touchpad.pressed !== undefined
        ? { pressed: patch.touchpad.pressed }
        : {}),
    };
  }

  if (patch.motion) {
    if (!profile.features?.motion) {
      throw new ProfileError(
        `Motion input is not supported by ${profile.name}`,
      );
    }
    normalized.motion = {
      ...(patch.motion.acceleration
        ? { acceleration: normalizeVector3(patch.motion.acceleration) }
        : {}),
      ...(patch.motion.gyroscope
        ? { gyroscope: normalizeVector3(patch.motion.gyroscope) }
        : {}),
      ...(patch.motion.orientation
        ? { orientation: normalizeVector3(patch.motion.orientation) }
        : {}),
    };
  }

  if (patch.status) {
    normalized.status = normalizeControllerDeviceStatusPatch(patch.status);
  }

  return normalized;
}

function normalizeControllerDeviceStatusPatch(
  status: ControllerDeviceStatusPatch,
): ControllerDeviceStatusPatch {
  return {
    ...(status.battery
      ? {
          battery: {
            ...(status.battery.level !== undefined
              ? { level: clamp(status.battery.level, 0, 1) }
              : {}),
            ...(status.battery.charging !== undefined
              ? { charging: status.battery.charging }
              : {}),
            ...(status.battery.wired !== undefined
              ? { wired: status.battery.wired }
              : {}),
            ...(status.battery.low !== undefined
              ? { low: status.battery.low }
              : {}),
          },
        }
      : {}),
    ...(status.connection
      ? {
          connection: {
            ...(status.connection.quality !== undefined
              ? { quality: clamp(status.connection.quality, 0, 1) }
              : {}),
            ...(status.connection.latencyMs !== undefined
              ? {
                  latencyMs: clamp(
                    status.connection.latencyMs,
                    0,
                    Number.POSITIVE_INFINITY,
                  ),
                }
              : {}),
            ...(status.connection.packetLoss !== undefined
              ? { packetLoss: clamp(status.connection.packetLoss, 0, 1) }
              : {}),
          },
        }
      : {}),
  };
}

function normalizeTouchpadContacts(
  contacts: NonNullable<
    NonNullable<ControllerStatePatch["touchpad"]>["contacts"]
  >,
): NonNullable<NonNullable<ControllerStatePatch["touchpad"]>["contacts"]> {
  return contacts.map((contact, index) => ({
    id: contact.id ?? index,
    x: clamp(contact.x, 0, 1),
    y: clamp(contact.y, 0, 1),
    active: contact.active ?? true,
    pressure: clamp(contact.pressure ?? 1, 0, 1),
  }));
}

function normalizeStickName(stick: string): StickName {
  switch (stick) {
    case "LEFT":
    case "RIGHT":
      return stick;
    default:
      throw new ProfileError(`Stick ${stick} is not supported`);
  }
}

function universalStatePatch(
  profile: ControllerProfile,
  patch: ControllerStatePatch,
): NormalizedControllerCommand["universal"] | undefined {
  const universal: NonNullable<NormalizedControllerCommand["universal"]> = {};

  if (patch.buttons) {
    const buttons = Object.keys(patch.buttons)
      .map((button) => toUniversal(profile, button))
      .filter((button): button is UniversalControl => Boolean(button));
    if (buttons.length > 0) {
      universal.buttons = buttons;
    }
  }

  if (patch.dpad !== undefined) {
    const dpad = universalDpadState(profile, patch.dpad);
    if (dpad) {
      universal.dpad = dpad;
    }
  }

  if (patch.sticks) {
    const stick = Object.keys(patch.sticks).at(0);
    if (stick === "LEFT" || stick === "RIGHT") {
      universal.stick = stick;
    }
  }

  return Object.keys(universal).length > 0 ? universal : undefined;
}

export * from "./universal";
export * from "./xbox";
export * from "./playstation";
export * from "./switch";
export * from "./generic-hid";
export * from "./keyboard-mouse";
