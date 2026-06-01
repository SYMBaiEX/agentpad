import {
  type ControllerProfileName,
  type ControllerState,
  createInitialControllerState,
  resolveProfile,
} from "@agentpad/core/browser";
import { ControllerOverlay } from "@agentpad/overlay";
import { type ReactNode, useMemo, useState } from "react";

type VisualProfile = Exclude<ControllerProfileName, "keyboard-mouse">;
type StickKey = "left" | "right";
type LogEntry = {
  timestamp: number;
  label: string;
};

const visualProfiles = [
  "xbox",
  "playstation",
  "switch",
  "generic-hid",
] as const;

const profileControls: Record<
  VisualProfile,
  {
    face: string[];
    shoulders: string[];
    triggers: string[];
    system: string[];
  }
> = {
  xbox: {
    face: ["Y", "B", "A", "X"],
    shoulders: ["LB", "RB", "LS", "RS"],
    triggers: ["LT", "RT"],
    system: ["BACK", "START"],
  },
  playstation: {
    face: ["TRIANGLE", "CIRCLE", "CROSS", "SQUARE"],
    shoulders: ["L1", "R1", "L3", "R3"],
    triggers: ["L2", "R2"],
    system: ["SHARE", "OPTIONS", "TOUCHPAD"],
  },
  switch: {
    face: ["X", "A", "B", "Y"],
    shoulders: ["L", "R", "LS", "RS"],
    triggers: ["ZL", "ZR"],
    system: ["MINUS", "PLUS", "CAPTURE"],
  },
  "generic-hid": {
    face: ["BUTTON_3", "BUTTON_1", "BUTTON_0", "BUTTON_2"],
    shoulders: ["BUTTON_4", "BUTTON_5", "BUTTON_10", "BUTTON_11"],
    triggers: ["BUTTON_6", "BUTTON_7"],
    system: ["BUTTON_8", "BUTTON_9"],
  },
};

const dpadButtons = [
  "DPAD_UP",
  "DPAD_LEFT",
  "DPAD_RIGHT",
  "DPAD_DOWN",
] as const;

export function App() {
  const [profile, setProfile] = useState<VisualProfile>("xbox");
  const [state, setState] = useState<ControllerState>(() =>
    createState("xbox"),
  );
  const [log, setLog] = useState<LogEntry[]>([]);
  const controls = useMemo(() => profileControls[profile], [profile]);

  function record(label: string) {
    setLog((current) =>
      [{ timestamp: Date.now(), label }, ...current].slice(0, 8),
    );
  }

  function selectProfile(nextProfile: VisualProfile) {
    setProfile(nextProfile);
    setState(createState(nextProfile));
    record(`profile ${nextProfile}`);
  }

  function patchState(
    label: string,
    updater: (draft: ControllerState) => void,
  ) {
    setState((current) => {
      const next = structuredClone(current);
      updater(next);
      next.updatedAt = Date.now();
      return next;
    });
    record(label);
  }

  function setButton(button: string, pressed: boolean) {
    patchState(`${pressed ? "press" : "release"} ${button}`, (draft) => {
      draft.buttons[button] = pressed;
      if (button in draft.analogButtons && !pressed) {
        draft.analogButtons[button] = 0;
      }
    });
  }

  function setTrigger(trigger: string, value: number) {
    patchState(`${trigger} ${Math.round(value * 100)}%`, (draft) => {
      draft.analogButtons[trigger] = value;
      draft.buttons[trigger] = value > 0;
    });
  }

  function setDpad(button: (typeof dpadButtons)[number], pressed: boolean) {
    patchState(`${pressed ? "press" : "release"} ${button}`, (draft) => {
      const key = button
        .replace("DPAD_", "")
        .toLowerCase() as keyof ControllerState["dpad"];
      draft.buttons[button] = pressed;
      draft.dpad[key] = pressed;
    });
  }

  function setStick(stick: StickKey, axis: "x" | "y", value: number) {
    patchState(`${stick} ${axis} ${value.toFixed(2)}`, (draft) => {
      draft.sticks[stick][axis] = value;
    });
  }

  function neutral() {
    patchState("neutral", (draft) => {
      for (const button of Object.keys(draft.buttons)) {
        draft.buttons[button] = false;
      }
      for (const button of Object.keys(draft.analogButtons)) {
        draft.analogButtons[button] = 0;
      }
      draft.sticks.left = { x: 0, y: 0 };
      draft.sticks.right = { x: 0, y: 0 };
      draft.dpad = { up: false, down: false, left: false, right: false };
    });
  }

  function setConnected(connected: boolean) {
    patchState(connected ? "connect" : "disconnect", (draft) => {
      draft.connected = connected;
    });
  }

  return (
    <main>
      <section className="surface" aria-label="AgentPad controller lab">
        <div className="toolbar">
          <div className="tabs" aria-label="Controller profile">
            {visualProfiles.map((item) => (
              <button
                className={item === profile ? "tab active" : "tab"}
                key={item}
                onClick={() => selectProfile(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className={state.connected ? "status connected" : "status"}
            onClick={() => setConnected(!state.connected)}
            type="button"
          >
            {state.connected ? "connected" : "offline"}
          </button>
        </div>

        <div className="workspace">
          <div className="overlayPanel">
            <ControllerOverlay
              profile={profile}
              state={state}
              size="xl"
              theme="dark"
              showConnectionStatus
            />
          </div>

          <div className="controls" aria-label="Controller input controls">
            <ControlGroup title="Face">
              <ButtonGrid>
                {controls.face.map((button) => (
                  <HoldButton
                    active={Boolean(state.buttons[button])}
                    key={button}
                    label={buttonLabel(button)}
                    onChange={(pressed) => setButton(button, pressed)}
                  />
                ))}
              </ButtonGrid>
            </ControlGroup>

            <ControlGroup title="Shoulders">
              <ButtonGrid>
                {controls.shoulders.map((button) => (
                  <HoldButton
                    active={Boolean(state.buttons[button])}
                    key={button}
                    label={buttonLabel(button)}
                    onChange={(pressed) => setButton(button, pressed)}
                  />
                ))}
              </ButtonGrid>
            </ControlGroup>

            <ControlGroup title="Triggers">
              {controls.triggers.map((trigger) => (
                <label className="slider" key={trigger}>
                  <span>{buttonLabel(trigger)}</span>
                  <input
                    max="1"
                    min="0"
                    onChange={(event) =>
                      setTrigger(trigger, Number(event.currentTarget.value))
                    }
                    step="0.01"
                    type="range"
                    value={state.analogButtons[trigger] ?? 0}
                  />
                  <output>
                    {Math.round((state.analogButtons[trigger] ?? 0) * 100)}
                  </output>
                </label>
              ))}
            </ControlGroup>

            <ControlGroup title="Sticks">
              <StickControls
                label="left"
                state={state}
                stick="left"
                onChange={setStick}
              />
              <StickControls
                label="right"
                state={state}
                stick="right"
                onChange={setStick}
              />
            </ControlGroup>

            <ControlGroup title="D-pad">
              <ButtonGrid>
                {dpadButtons.map((button) => (
                  <HoldButton
                    active={Boolean(state.buttons[button])}
                    key={button}
                    label={button.replace("DPAD_", "")}
                    onChange={(pressed) => setDpad(button, pressed)}
                  />
                ))}
              </ButtonGrid>
            </ControlGroup>

            <ControlGroup title="System">
              <ButtonGrid>
                {controls.system.map((button) => (
                  <HoldButton
                    active={Boolean(state.buttons[button])}
                    key={button}
                    label={buttonLabel(button)}
                    onChange={(pressed) => setButton(button, pressed)}
                  />
                ))}
              </ButtonGrid>
            </ControlGroup>

            <div className="actions">
              <button className="primary" onClick={neutral} type="button">
                neutral
              </button>
            </div>
          </div>
        </div>

        <ol className="eventLog" aria-label="Input event log">
          {log.map((entry) => (
            <li key={`${entry.timestamp}-${entry.label}`}>
              <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
              <span>{entry.label}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function createState(profile: VisualProfile): ControllerState {
  const next = createInitialControllerState(
    "react-example",
    resolveProfile(profile),
  );
  next.connected = true;
  return next;
}

function ControlGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ButtonGrid({ children }: { children: ReactNode }) {
  return <div className="buttonGrid">{children}</div>;
}

function HoldButton({
  active,
  label,
  onChange,
}: {
  active: boolean;
  label: string;
  onChange: (pressed: boolean) => void;
}) {
  return (
    <button
      className={active ? "padButton active" : "padButton"}
      onPointerCancel={() => onChange(false)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(true);
      }}
      onPointerLeave={(event) => {
        if (event.buttons === 1) {
          onChange(false);
        }
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        onChange(false);
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function StickControls({
  label,
  onChange,
  state,
  stick,
}: {
  label: string;
  onChange: (stick: StickKey, axis: "x" | "y", value: number) => void;
  state: ControllerState;
  stick: StickKey;
}) {
  const value = state.sticks[stick];

  return (
    <div className="stickControl">
      <span>{label}</span>
      <label className="slider">
        <span>x</span>
        <input
          max="1"
          min="-1"
          onChange={(event) =>
            onChange(stick, "x", Number(event.currentTarget.value))
          }
          step="0.01"
          type="range"
          value={value.x}
        />
        <output>{value.x.toFixed(2)}</output>
      </label>
      <label className="slider">
        <span>y</span>
        <input
          max="1"
          min="-1"
          onChange={(event) =>
            onChange(stick, "y", Number(event.currentTarget.value))
          }
          step="0.01"
          type="range"
          value={value.y}
        />
        <output>{value.y.toFixed(2)}</output>
      </label>
    </div>
  );
}

function buttonLabel(button: string): string {
  if (button === "CROSS") {
    return "cross";
  }
  if (button === "CIRCLE") {
    return "circle";
  }
  return button.replace("BUTTON_", "B").toLowerCase();
}
