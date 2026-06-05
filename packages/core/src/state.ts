import { EventEmitter, type Unsubscribe } from "./events";
import { type ControllerProfile, dpadDirections } from "./profiles";
import type {
  ControllerButtonStateInput,
  ControllerDeviceStatus,
  ControllerDeviceStatusPatch,
  ControllerFeedbackEvent,
  ControllerFeedbackState,
  ControllerState,
  ControllerStatePatch,
  ControllerTouchpadContactInput,
  ControllerVector3,
  DpadCardinalDirection,
  DpadDirection,
  DpadState,
  StateListener,
} from "./types";

type StateEvents = {
  change: ControllerState;
};

export class ControllerStateStore {
  private state: ControllerState;
  private readonly events = new EventEmitter<StateEvents>();

  constructor(
    id: string,
    private readonly profile: ControllerProfile,
  ) {
    this.state = createInitialControllerState(id, profile);
  }

  getState(): ControllerState {
    return cloneState(this.state);
  }

  subscribe(listener: StateListener): Unsubscribe {
    return this.events.on("change", listener);
  }

  setConnected(connected: boolean): ControllerState {
    this.state.connected = connected;
    return this.commit();
  }

  setButton(
    button: string,
    pressed: boolean,
    pressure?: number,
  ): ControllerState {
    this.setButtonInPlace(button, pressed, pressure);
    return this.commit();
  }

  setTrigger(trigger: string, value: number): ControllerState {
    this.setTriggerInPlace(trigger, value);
    return this.commit();
  }

  setStick(stick: "LEFT" | "RIGHT", x: number, y: number): ControllerState {
    this.setStickInPlace(stick, x, y);
    return this.commit();
  }

  setDpad(direction: DpadDirection, pressed: boolean): ControllerState {
    for (const cardinal of dpadDirections(direction)) {
      const key = dpadKeyFromCardinal(cardinal);
      this.state.dpad[key] = pressed;
      this.state.buttons[`DPAD_${cardinal}`] = pressed;
    }
    return this.commit();
  }

  setDpadState(direction: DpadState): ControllerState {
    this.setDpadStateInPlace(direction);
    return this.commit();
  }

  setTouchpad(
    contacts: ControllerTouchpadContactInput[] = [],
    pressed = false,
  ): ControllerState {
    this.setTouchpadInPlace(contacts, pressed);
    return this.commit();
  }

  setMotion(motion: {
    acceleration?: ControllerVector3;
    gyroscope?: ControllerVector3;
    orientation?: ControllerVector3;
  }): ControllerState {
    this.setMotionInPlace(motion);
    return this.commit();
  }

  setStatus(status: ControllerDeviceStatusPatch): ControllerState {
    this.setStatusInPlace(status);
    return this.commit();
  }

  applyFeedback(feedback: ControllerFeedbackEvent): ControllerState {
    this.applyFeedbackInPlace(feedback);
    return this.commit();
  }

  applyPatch(patch: ControllerStatePatch): ControllerState {
    if (patch.buttons) {
      for (const [button, value] of Object.entries(patch.buttons)) {
        const input = normalizeButtonStateInput(value);
        this.setButtonInPlace(
          button,
          input.pressed,
          input.pressed ? input.pressure : 0,
        );
      }
    }

    if (patch.triggers) {
      for (const [trigger, value] of Object.entries(patch.triggers)) {
        this.setTriggerInPlace(trigger, value);
      }
    }

    if (patch.sticks) {
      for (const [stick, value] of Object.entries(patch.sticks)) {
        if (stick === "LEFT" || stick === "RIGHT") {
          this.setStickInPlace(stick, value.x, value.y);
        }
      }
    }

    if (patch.dpad !== undefined) {
      this.setDpadStateInPlace(patch.dpad);
    }

    if (patch.touchpad) {
      this.patchTouchpadInPlace(patch.touchpad);
    }

    if (patch.motion) {
      this.setMotionInPlace(patch.motion);
    }

    if (patch.status) {
      this.setStatusInPlace(patch.status);
    }

    return this.commit();
  }

  private setButtonInPlace(
    button: string,
    pressed: boolean,
    pressure?: number,
  ): void {
    this.state.buttons[button] = pressed;
    if (pressure !== undefined) {
      if (pressed || button in this.state.analogButtons || pressure !== 0) {
        this.state.analogButtons[button] = pressure;
      }
    } else if (this.profile.triggers.includes(button)) {
      this.state.analogButtons[button] = pressed ? 1 : 0;
    }

    const dpadKey = dpadKeyFromButton(button);
    if (dpadKey) {
      this.state.dpad[dpadKey] = pressed;
    }
  }

  private setTriggerInPlace(trigger: string, value: number): void {
    this.state.analogButtons[trigger] = value;
    this.state.buttons[trigger] = value > 0;
  }

  private setStickInPlace(stick: "LEFT" | "RIGHT", x: number, y: number): void {
    const target =
      stick === "LEFT" ? this.state.sticks.left : this.state.sticks.right;
    target.x = x;
    target.y = y;
  }

  private setDpadStateInPlace(direction: DpadState): void {
    this.clearDpadState();
    if (direction !== "NEUTRAL") {
      for (const cardinal of dpadDirections(direction)) {
        const key = dpadKeyFromCardinal(cardinal);
        this.state.dpad[key] = true;
        this.state.buttons[`DPAD_${cardinal}`] = true;
      }
    }
  }

  private setTouchpadInPlace(
    contacts: ControllerTouchpadContactInput[] = [],
    pressed = false,
  ): void {
    this.state.touchpad.pressed = pressed;
    this.state.touchpad.contacts = contacts.map((contact, index) => ({
      id: contact.id ?? index,
      x: contact.x,
      y: contact.y,
      active: contact.active ?? true,
      pressure: contact.pressure ?? 1,
    }));
  }

  private patchTouchpadInPlace(
    touchpad: NonNullable<ControllerStatePatch["touchpad"]>,
  ): void {
    if (touchpad.pressed !== undefined) {
      this.state.touchpad.pressed = touchpad.pressed;
    }
    if (touchpad.contacts !== undefined) {
      this.state.touchpad.contacts = touchpad.contacts.map(
        (contact, index) => ({
          id: contact.id ?? index,
          x: contact.x,
          y: contact.y,
          active: contact.active ?? true,
          pressure: contact.pressure ?? 1,
        }),
      );
    }
  }

  private setMotionInPlace(motion: {
    acceleration?: ControllerVector3;
    gyroscope?: ControllerVector3;
    orientation?: ControllerVector3;
  }): void {
    if (motion.acceleration) {
      this.state.motion.acceleration = { ...motion.acceleration };
    }
    if (motion.gyroscope) {
      this.state.motion.gyroscope = { ...motion.gyroscope };
    }
    if (motion.orientation) {
      this.state.motion.orientation = { ...motion.orientation };
    }
  }

  private setStatusInPlace(status: ControllerDeviceStatusPatch): void {
    if (status.battery) {
      if (status.battery.level !== undefined) {
        this.state.status.battery.level = clampNormalized(status.battery.level);
      }
      if (status.battery.charging !== undefined) {
        this.state.status.battery.charging = status.battery.charging;
      }
      if (status.battery.wired !== undefined) {
        this.state.status.battery.wired = status.battery.wired;
      }
      if (status.battery.low !== undefined) {
        this.state.status.battery.low = status.battery.low;
      }
    }

    if (status.connection) {
      if (status.connection.quality !== undefined) {
        this.state.status.connection.quality = clampNormalized(
          status.connection.quality,
        );
      }
      if (status.connection.latencyMs !== undefined) {
        this.state.status.connection.latencyMs = nonNegativeFinite(
          status.connection.latencyMs,
        );
      }
      if (status.connection.packetLoss !== undefined) {
        this.state.status.connection.packetLoss = clampNormalized(
          status.connection.packetLoss,
        );
      }
    }
  }

  private applyFeedbackInPlace(feedback: ControllerFeedbackEvent): void {
    if (feedback.type === "rumble") {
      const weakMotor = clampNormalized(feedback.weakMotor);
      const strongMotor = clampNormalized(feedback.strongMotor);
      const leftTriggerMotor = clampNormalized(feedback.leftTriggerMotor);
      const rightTriggerMotor = clampNormalized(feedback.rightTriggerMotor);
      this.state.feedback.rumble = {
        active:
          weakMotor > 0 ||
          strongMotor > 0 ||
          leftTriggerMotor > 0 ||
          rightTriggerMotor > 0,
        weakMotor,
        strongMotor,
        leftTriggerMotor,
        rightTriggerMotor,
        updatedAt: feedback.timestamp,
        ...(feedback.durationMs !== undefined
          ? { durationMs: nonNegativeFinite(feedback.durationMs) }
          : {}),
        ...(feedback.source ? { source: feedback.source } : {}),
        ...(feedback.reportFormat
          ? { reportFormat: feedback.reportFormat }
          : {}),
        ...(feedback.reportId !== undefined
          ? { reportId: feedback.reportId }
          : {}),
        ...(feedback.reportBase64
          ? { reportBase64: feedback.reportBase64 }
          : {}),
      };
      return;
    }

    const red = clampNormalized(feedback.red);
    const green = clampNormalized(feedback.green);
    const blue = clampNormalized(feedback.blue);
    const brightness = clampNormalized(feedback.brightness);
    const playerIndex = clampByte(feedback.playerIndex);
    const playerLightMask = clampByte(feedback.playerLightMask);
    this.state.feedback.lights = {
      active:
        brightness > 0 ||
        red > 0 ||
        green > 0 ||
        blue > 0 ||
        playerLightMask > 0,
      red,
      green,
      blue,
      brightness,
      playerIndex,
      playerLightMask,
      updatedAt: feedback.timestamp,
      ...(feedback.source ? { source: feedback.source } : {}),
      ...(feedback.reportFormat ? { reportFormat: feedback.reportFormat } : {}),
      ...(feedback.reportId !== undefined
        ? { reportId: feedback.reportId }
        : {}),
      ...(feedback.reportBase64 ? { reportBase64: feedback.reportBase64 } : {}),
    };
  }

  neutral(): ControllerState {
    for (const button of Object.keys(this.state.buttons)) {
      this.state.buttons[button] = false;
    }
    for (const button of Object.keys(this.state.analogButtons)) {
      this.state.analogButtons[button] = 0;
    }

    this.state.sticks.left.x = 0;
    this.state.sticks.left.y = 0;
    this.state.sticks.right.x = 0;
    this.state.sticks.right.y = 0;
    this.state.dpad.up = false;
    this.state.dpad.down = false;
    this.state.dpad.left = false;
    this.state.dpad.right = false;
    this.state.touchpad.pressed = false;
    this.state.touchpad.contacts = [];
    this.state.motion.acceleration = neutralVector3();
    this.state.motion.gyroscope = neutralVector3();
    this.state.motion.orientation = neutralVector3();

    return this.commit();
  }

  private clearDpadState(): void {
    this.state.dpad.up = false;
    this.state.dpad.down = false;
    this.state.dpad.left = false;
    this.state.dpad.right = false;
    for (const button of ["DPAD_UP", "DPAD_DOWN", "DPAD_LEFT", "DPAD_RIGHT"]) {
      if (button in this.state.buttons) {
        this.state.buttons[button] = false;
      }
    }
  }

  private commit(): ControllerState {
    this.state.updatedAt = Date.now();
    const next = this.getState();
    this.events.emit("change", next);
    return next;
  }
}

export function createInitialControllerState(
  id: string,
  profile: ControllerProfile,
): ControllerState {
  const buttons: Record<string, boolean> = {};
  const analogButtons: Record<string, number> = {};

  for (const button of profile.buttons) {
    buttons[button] = false;
  }
  for (const trigger of profile.triggers) {
    analogButtons[trigger] = 0;
  }

  return {
    id,
    profile: profile.name,
    connected: false,
    buttons,
    analogButtons,
    sticks: {
      left: {
        x: 0,
        y: 0,
      },
      right: {
        x: 0,
        y: 0,
      },
    },
    dpad: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    touchpad: {
      pressed: false,
      contacts: [],
    },
    motion: {
      acceleration: neutralVector3(),
      gyroscope: neutralVector3(),
      orientation: neutralVector3(),
    },
    status: createDefaultControllerDeviceStatus(),
    feedback: createDefaultControllerFeedbackState(),
    updatedAt: Date.now(),
  };
}

export function cloneState(state: ControllerState): ControllerState {
  const status = state.status ?? createDefaultControllerDeviceStatus();
  const feedback = state.feedback ?? createDefaultControllerFeedbackState();
  return {
    ...state,
    buttons: {
      ...state.buttons,
    },
    analogButtons: {
      ...state.analogButtons,
    },
    sticks: {
      left: {
        ...state.sticks.left,
      },
      right: {
        ...state.sticks.right,
      },
    },
    dpad: {
      ...state.dpad,
    },
    touchpad: {
      pressed: state.touchpad.pressed,
      contacts: state.touchpad.contacts.map((contact) => ({ ...contact })),
    },
    motion: {
      acceleration: {
        ...state.motion.acceleration,
      },
      gyroscope: {
        ...state.motion.gyroscope,
      },
      orientation: {
        ...state.motion.orientation,
      },
    },
    status: {
      battery: {
        ...status.battery,
      },
      connection: {
        ...status.connection,
      },
    },
    feedback: {
      rumble: {
        ...feedback.rumble,
      },
      lights: {
        ...feedback.lights,
      },
    },
  };
}

export function createDefaultControllerDeviceStatus(): ControllerDeviceStatus {
  return {
    battery: {
      level: 1,
      charging: false,
      wired: true,
      low: false,
    },
    connection: {
      quality: 1,
      latencyMs: 0,
      packetLoss: 0,
    },
  };
}

export function createDefaultControllerFeedbackState(): ControllerFeedbackState {
  return {
    rumble: {
      active: false,
      weakMotor: 0,
      strongMotor: 0,
      leftTriggerMotor: 0,
      rightTriggerMotor: 0,
      updatedAt: 0,
    },
    lights: {
      active: false,
      red: 0,
      green: 0,
      blue: 0,
      brightness: 0,
      playerIndex: 0,
      playerLightMask: 0,
      updatedAt: 0,
    },
  };
}

function neutralVector3(): ControllerVector3 {
  return {
    x: 0,
    y: 0,
    z: 0,
  };
}

function normalizeButtonStateInput(value: ControllerButtonStateInput): {
  pressed: boolean;
  pressure?: number;
} {
  return typeof value === "boolean" ? { pressed: value } : value;
}

function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function nonNegativeFinite(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(255, Math.max(0, Math.trunc(value)));
}

function dpadKeyFromButton(
  button: string,
): keyof ControllerState["dpad"] | undefined {
  switch (button) {
    case "DPAD_UP":
      return "up";
    case "DPAD_DOWN":
      return "down";
    case "DPAD_LEFT":
      return "left";
    case "DPAD_RIGHT":
      return "right";
    default:
      return undefined;
  }
}

function dpadKeyFromCardinal(
  direction: DpadCardinalDirection,
): keyof ControllerState["dpad"] {
  switch (direction) {
    case "UP":
      return "up";
    case "DOWN":
      return "down";
    case "LEFT":
      return "left";
    case "RIGHT":
      return "right";
  }
}
