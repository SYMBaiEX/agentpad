import { EventEmitter, type Unsubscribe } from "./events";
import type { ControllerProfile } from "./profiles";
import type { ControllerState, StateListener } from "./types";

type StateEvents = {
  change: ControllerState;
};

export class ControllerStateStore {
  private state: ControllerState;
  private readonly events = new EventEmitter<StateEvents>();

  constructor(id: string, profile: ControllerProfile) {
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
  };
}
