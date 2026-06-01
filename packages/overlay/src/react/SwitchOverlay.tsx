import {
  ConnectionDot,
  ControlCircle,
  type OverlayCommonProps,
  Stick,
  TriggerBar,
  analogValue,
  isPressed,
} from "./shared";

export function SwitchOverlay(props: OverlayCommonProps) {
  const {
    state,
    theme,
    showLabels,
    showSticks,
    showTriggers,
    showConnectionStatus,
  } = props;

  return (
    <svg
      viewBox="0 0 640 360"
      role="img"
      aria-label="Switch controller overlay"
    >
      <rect
        width="640"
        height="360"
        fill={theme.transparent ? "transparent" : theme.background}
        rx="0"
      />
      <path
        d="M150 82 L490 82 C542 82 578 126 578 188 C578 250 542 302 490 302 L150 302 C98 302 62 250 62 188 C62 126 98 82 150 82 Z"
        fill={theme.shell}
        stroke={theme.shellStroke}
        strokeWidth="4"
      />
      <TriggerBar
        x={126}
        y={46}
        label="ZL"
        value={analogValue(state, "ZL")}
        theme={theme}
        show={showTriggers}
      />
      <TriggerBar
        x={398}
        y={46}
        label="ZR"
        value={analogValue(state, "ZR")}
        theme={theme}
        show={showTriggers}
      />
      <rect
        x="146"
        y="88"
        width="96"
        height="28"
        rx="8"
        fill={isPressed(state, "L") ? theme.active : theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x="398"
        y="88"
        width="96"
        height="28"
        rx="8"
        fill={isPressed(state, "R") ? theme.active : theme.control}
        stroke={theme.controlStroke}
      />
      {showLabels ? (
        <>
          <text
            x="194"
            y="108"
            textAnchor="middle"
            fill={theme.text}
            fontSize="13"
            fontWeight="700"
          >
            L
          </text>
          <text
            x="446"
            y="108"
            textAnchor="middle"
            fill={theme.text}
            fontSize="13"
            fontWeight="700"
          >
            R
          </text>
        </>
      ) : null}
      <Stick
        cx={206}
        cy={180}
        x={state.sticks.left.x}
        y={state.sticks.left.y}
        theme={theme}
        show={showSticks}
      />
      <Stick
        cx={414}
        cy={230}
        x={state.sticks.right.x}
        y={state.sticks.right.y}
        theme={theme}
        show={showSticks}
      />
      <Dpad state={state} theme={theme} showLabels={showLabels} />
      <ControlCircle
        cx={478}
        cy={158}
        r={20}
        label="X"
        active={isPressed(state, "X")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={518}
        cy={198}
        r={20}
        label="A"
        active={isPressed(state, "A")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={438}
        cy={198}
        r={20}
        label="Y"
        active={isPressed(state, "Y")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={478}
        cy={238}
        r={20}
        label="B"
        active={isPressed(state, "B")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={292}
        cy={172}
        r={12}
        label="-"
        active={isPressed(state, "MINUS")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={348}
        cy={172}
        r={12}
        label="+"
        active={isPressed(state, "PLUS")}
        theme={theme}
        showLabel={showLabels}
      />
      <ConnectionDot
        connected={state.connected}
        theme={theme}
        show={showConnectionStatus}
      />
    </svg>
  );
}

function Dpad({
  state,
  theme,
  showLabels,
}: Pick<OverlayCommonProps, "state" | "theme" | "showLabels">) {
  const fill = (button: string) =>
    isPressed(state, button) ? theme.active : theme.control;

  return (
    <g>
      <rect
        x="128"
        y="232"
        width="32"
        height="30"
        rx="4"
        fill={fill("DPAD_LEFT")}
        stroke={theme.controlStroke}
      />
      <rect
        x="160"
        y="200"
        width="30"
        height="32"
        rx="4"
        fill={fill("DPAD_UP")}
        stroke={theme.controlStroke}
      />
      <rect
        x="160"
        y="232"
        width="30"
        height="30"
        rx="4"
        fill={theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x="160"
        y="262"
        width="30"
        height="32"
        rx="4"
        fill={fill("DPAD_DOWN")}
        stroke={theme.controlStroke}
      />
      <rect
        x="190"
        y="232"
        width="32"
        height="30"
        rx="4"
        fill={fill("DPAD_RIGHT")}
        stroke={theme.controlStroke}
      />
      {showLabels ? (
        <text
          x="175"
          y="251"
          textAnchor="middle"
          fill={theme.text}
          fontSize="12"
          fontWeight="700"
        >
          D
        </text>
      ) : null}
    </g>
  );
}
