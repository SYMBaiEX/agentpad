import { SafetyError } from "./errors";
import {
  type ControllerProfile,
  dpadButtons,
  resolveButton,
  toUniversal,
} from "./profiles";
import type {
  ControllerCommand,
  ControllerStatePatch,
  SafetyConfig,
} from "./types";

export const defaultSafetyConfig: SafetyConfig = {
  maxCommandsPerSecond: 30,
  maxButtonHoldMs: 2000,
  maxStickHoldMs: 3000,
  neutralOnError: true,
  neutralOnDisconnect: true,
  disabledButtons: ["GUIDE", "PS", "HOME"],
  disabledCombos: [],
  requireApprovalFor: [],
  allowGuideButton: false,
  allowSystemButtons: false,
};

export class SafetyGuard {
  private readonly config: SafetyConfig;
  private readonly commandTimestamps: number[] = [];
  private readonly commandFingerprints: Array<{
    key: string;
    timestamp: number;
  }> = [];

  constructor(
    private readonly profile: ControllerProfile,
    config: Partial<SafetyConfig> = {},
  ) {
    this.config = {
      ...defaultSafetyConfig,
      ...config,
      disabledButtons:
        config.disabledButtons ?? defaultSafetyConfig.disabledButtons,
      disabledCombos:
        config.disabledCombos ?? defaultSafetyConfig.disabledCombos,
      requireApprovalFor:
        config.requireApprovalFor ?? defaultSafetyConfig.requireApprovalFor,
    };
  }

  getConfig(): SafetyConfig {
    return {
      ...this.config,
      disabledButtons: [...this.config.disabledButtons],
      disabledCombos: this.config.disabledCombos.map((combo) => [...combo]),
      requireApprovalFor: [...this.config.requireApprovalFor],
    };
  }

  assert(command: ControllerCommand): void {
    this.assertRateLimit();
    this.assertDurations(command);
    this.assertDisabledControls(command);
    this.assertInputLoop(command);
  }

  private assertRateLimit(): void {
    const now = Date.now();
    this.commandTimestamps.push(now);

    while (
      this.commandTimestamps.length > 0 &&
      this.commandTimestamps[0] !== undefined &&
      now - this.commandTimestamps[0] > 1000
    ) {
      this.commandTimestamps.shift();
    }

    if (this.commandTimestamps.length > this.config.maxCommandsPerSecond) {
      throw new SafetyError(
        `Command rate exceeded ${this.config.maxCommandsPerSecond} commands per second`,
      );
    }
  }

  private assertDurations(command: ControllerCommand): void {
    if (
      (command.type === "press" ||
        command.type === "combo" ||
        command.type === "dpad") &&
      command.durationMs
    ) {
      if (command.durationMs > this.config.maxButtonHoldMs) {
        throw new SafetyError(
          `Button hold duration ${command.durationMs}ms exceeds ${this.config.maxButtonHoldMs}ms`,
        );
      }
    }

    if (
      (command.type === "stick" ||
        command.type === "touchpad" ||
        command.type === "motion") &&
      command.durationMs
    ) {
      if (command.durationMs > this.config.maxStickHoldMs) {
        throw new SafetyError(
          `Analog hold duration ${command.durationMs}ms exceeds ${this.config.maxStickHoldMs}ms`,
        );
      }
    }

    if (command.type === "sequence") {
      for (const child of command.commands) {
        this.assertDurations(child);
      }
    }
  }

  private assertDisabledControls(command: ControllerCommand): void {
    switch (command.type) {
      case "press":
      case "release":
      case "setButton":
        this.assertButtonAllowed(command.button);
        return;
      case "combo":
        for (const button of command.buttons) {
          this.assertButtonAllowed(button);
        }
        this.assertComboAllowed(command.buttons);
        return;
      case "sequence":
        for (const child of command.commands) {
          this.assertDisabledControls(child);
        }
        return;
      case "trigger":
      case "setTrigger":
        this.assertButtonAllowed(command.trigger);
        return;
      case "dpad": {
        const buttons = dpadButtons(command.direction);
        for (const button of buttons) {
          this.assertButtonAllowed(button);
        }
        if (buttons.length > 1) {
          this.assertComboAllowed(buttons);
        }
        return;
      }
      case "setDpad": {
        if (command.direction === "NEUTRAL") {
          return;
        }
        const buttons = dpadButtons(command.direction);
        for (const button of buttons) {
          this.assertButtonAllowed(button);
        }
        if (buttons.length > 1) {
          this.assertComboAllowed(buttons);
        }
        return;
      }
      case "setState":
        this.assertStatePatchAllowed(command.state);
        return;
      case "stick":
      case "setStick":
      case "touchpad":
      case "motion":
      case "wait":
      case "neutral":
        return;
    }
  }

  private assertButtonAllowed(button: string): void {
    const resolved = resolveButton(this.profile, button);
    const universal = toUniversal(this.profile, resolved);

    if (
      this.config.disabledButtons.includes(button) ||
      this.config.disabledButtons.includes(resolved)
    ) {
      throw new SafetyError(`Button ${button} is disabled by safety config`);
    }

    if (!this.config.allowGuideButton && universal === "HOME") {
      throw new SafetyError(`Button ${button} requires allowGuideButton`);
    }

    if (
      !this.config.allowSystemButtons &&
      (universal === "CAPTURE" || universal === "TOUCHPAD")
    ) {
      throw new SafetyError(`Button ${button} requires allowSystemButtons`);
    }
  }

  private assertComboAllowed(buttons: string[]): void {
    const resolved = buttons
      .map((button) => resolveButton(this.profile, button))
      .sort();
    for (const combo of this.config.disabledCombos) {
      const disabled = combo
        .map((button) => resolveButton(this.profile, button))
        .sort();
      if (
        disabled.length === resolved.length &&
        disabled.every((button, index) => button === resolved[index])
      ) {
        throw new SafetyError(
          `Combo ${buttons.join("+")} is disabled by safety config`,
        );
      }
    }
  }

  private assertStatePatchAllowed(patch: ControllerStatePatch): void {
    if (patch.buttons) {
      for (const button of Object.keys(patch.buttons)) {
        this.assertButtonAllowed(button);
      }
    }

    if (patch.triggers) {
      for (const trigger of Object.keys(patch.triggers)) {
        this.assertButtonAllowed(trigger);
      }
    }

    if (patch.dpad !== undefined && patch.dpad !== "NEUTRAL") {
      const buttons = dpadButtons(patch.dpad);
      for (const button of buttons) {
        this.assertButtonAllowed(button);
      }
      if (buttons.length > 1) {
        this.assertComboAllowed(buttons);
      }
    }
  }

  private assertInputLoop(command: ControllerCommand): void {
    const now = Date.now();
    const key = JSON.stringify(command);
    this.commandFingerprints.push({ key, timestamp: now });

    while (
      this.commandFingerprints.length > 0 &&
      this.commandFingerprints[0] !== undefined &&
      now - this.commandFingerprints[0].timestamp > 1000
    ) {
      this.commandFingerprints.shift();
    }

    const repeats = this.commandFingerprints.filter(
      (entry) => entry.key === key,
    ).length;
    if (repeats > 8) {
      throw new SafetyError("Repeated identical input loop detected");
    }
  }
}
