import type { ControllerAdapter } from "./adapters/adapter";

export type ControllerProfileName =
  | "xbox"
  | "playstation"
  | "switch"
  | "generic-hid"
  | "keyboard-mouse";

export type StickName = "LEFT" | "RIGHT";
export type DpadDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type ControllerCommand =
  | {
      type: "press";
      button: string;
      durationMs?: number;
      pressure?: number;
    }
  | {
      type: "release";
      button: string;
    }
  | {
      type: "stick";
      stick: StickName;
      x: number;
      y: number;
      durationMs?: number;
    }
  | {
      type: "trigger";
      trigger: string;
      value: number;
      durationMs?: number;
    }
  | {
      type: "dpad";
      direction: DpadDirection;
      durationMs?: number;
    }
  | {
      type: "combo";
      buttons: string[];
      durationMs?: number;
      staggerMs?: number;
    }
  | {
      type: "sequence";
      commands: ControllerCommand[];
    }
  | {
      type: "wait";
      ms: number;
    }
  | {
      type: "neutral";
    };

export type NormalizedControllerCommand = {
  id: string;
  controllerId: string;
  profile: ControllerProfileName;
  command: ControllerCommand;
  timestamp: number;
  universal?: {
    buttons?: string[];
    trigger?: string;
    stick?: StickName;
    dpad?: string;
  };
};

export type ControllerState = {
  id: string;
  profile: ControllerProfileName;
  connected: boolean;
  buttons: Record<string, boolean>;
  analogButtons: Record<string, number>;
  sticks: {
    left: {
      x: number;
      y: number;
    };
    right: {
      x: number;
      y: number;
    };
  };
  dpad: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  updatedAt: number;
};

export type ControllerAdapterCapabilities = {
  supportsButtons: boolean;
  supportsAnalogTriggers: boolean;
  supportsSticks: boolean;
  supportsDpad: boolean;
  supportsRumble: boolean;
  supportsTouchpad: boolean;
  supportsGyro: boolean;
  supportsStateSync: boolean;
  supportsXInputReports: boolean;
  supportsNativeBridge: boolean;
  supportsMultipleControllers: boolean;
  supportsVirtualDevice: boolean;
  requiresNativeInstall: boolean;
  requiresElevatedPermissions: boolean;
};

export type SafetyConfig = {
  maxCommandsPerSecond: number;
  maxButtonHoldMs: number;
  maxStickHoldMs: number;
  neutralOnError: boolean;
  neutralOnDisconnect: boolean;
  disabledButtons: string[];
  disabledCombos: string[][];
  requireApprovalFor: string[];
  allowGuideButton: boolean;
  allowSystemButtons: boolean;
};

export type ReplayConfig = {
  enabled?: boolean;
  dir?: string;
  sessionId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type ReplayEvent =
  | {
      type: "command";
      timestamp: number;
      controllerId: string;
      profile: string;
      command: ControllerCommand;
      stateBefore?: ControllerState;
      stateAfter?: ControllerState;
      intent?: string;
      source?: string;
    }
  | {
      type: "state";
      timestamp: number;
      controllerId: string;
      state: ControllerState;
    }
  | {
      type: "error";
      timestamp: number;
      controllerId: string;
      error: string;
      command?: ControllerCommand;
    }
  | {
      type: "annotation";
      timestamp: number;
      label: string;
      data?: Record<string, unknown>;
    };

export type AdapterName =
  | "dry-run"
  | "websocket"
  | "xinput-report"
  | "native-bridge";

export type CreateControllerOptions = {
  id?: string;
  profile: ControllerProfileName;
  adapter?: AdapterName | ControllerAdapter;
  url?: string;
  safety?: Partial<SafetyConfig>;
  replay?: ReplayConfig | false;
};

export type CommandContext = {
  intent?: string;
  source?: string;
};

export type StateListener = (state: ControllerState) => void;
