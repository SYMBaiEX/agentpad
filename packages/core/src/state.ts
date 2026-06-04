import { EventEmitter, type Unsubscribe } from "./events";
import { type ControllerProfile, dpadDirections } from "./profiles";
import type {
  ControllerButtonStateInput,
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
    updatedAt: Date.now(),
  };
}

export function cloneState(state: ControllerState): ControllerState {
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
