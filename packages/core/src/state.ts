import { EventEmitter, type Unsubscribe } from "./events";
import type { ControllerProfile } from "./profiles";
import type {
  ControllerState,
  ControllerTouchpadContactInput,
  ControllerVector3,
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
    this.state.buttons[button] = pressed;
    if (pressure !== undefined) {
      this.state.analogButtons[button] = pressure;
    } else if (this.profile.triggers.includes(button)) {
      this.state.analogButtons[button] = pressed ? 1 : 0;
    }

    const dpadKey = dpadKeyFromButton(button);
    if (dpadKey) {
      this.state.dpad[dpadKey] = pressed;
    }
    return this.commit();
  }

  setTrigger(trigger: string, value: number): ControllerState {
    this.state.analogButtons[trigger] = value;
    this.state.buttons[trigger] = value > 0;
    return this.commit();
  }

  setStick(stick: "LEFT" | "RIGHT", x: number, y: number): ControllerState {
    const target =
      stick === "LEFT" ? this.state.sticks.left : this.state.sticks.right;
    target.x = x;
    target.y = y;
    return this.commit();
  }

  setDpad(
    direction: "UP" | "DOWN" | "LEFT" | "RIGHT",
    pressed: boolean,
  ): ControllerState {
    this.state.dpad[direction.toLowerCase() as keyof ControllerState["dpad"]] =
      pressed;
    this.state.buttons[`DPAD_${direction}`] = pressed;
    return this.commit();
  }

  setTouchpad(
    contacts: ControllerTouchpadContactInput[] = [],
    pressed = false,
  ): ControllerState {
    this.state.touchpad.pressed = pressed;
    this.state.touchpad.contacts = contacts.map((contact, index) => ({
      id: contact.id ?? index,
      x: contact.x,
      y: contact.y,
      active: contact.active ?? true,
      pressure: contact.pressure ?? 1,
    }));
    return this.commit();
  }

  setMotion(motion: {
    acceleration?: ControllerVector3;
    gyroscope?: ControllerVector3;
    orientation?: ControllerVector3;
  }): ControllerState {
    if (motion.acceleration) {
      this.state.motion.acceleration = { ...motion.acceleration };
    }
    if (motion.gyroscope) {
      this.state.motion.gyroscope = { ...motion.gyroscope };
    }
    if (motion.orientation) {
      this.state.motion.orientation = { ...motion.orientation };
    }
    return this.commit();
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
