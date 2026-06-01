import {
  ConnectionDot,
  ControlCircle,
  type OverlayCommonProps,
  Stick,
  TriggerBar,
  analogValue,
  isPressed,
} from "./shared";

export function PlayStationOverlay(props: OverlayCommonProps) {
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
      aria-label="PlayStation controller overlay"
    >
      <rect
        width="640"
        height="360"
        fill={theme.transparent ? "transparent" : theme.background}
        rx="0"
      />
      <path
        d="M126 120 C170 72 252 92 320 94 C388 92 470 72 514 120 C574 184 578 298 526 314 C480 329 444 270 418 238 L222 238 C196 270 160 329 114 314 C62 298 66 184 126 120 Z"
        fill={theme.shell}
        stroke={theme.shellStroke}
        strokeWidth="4"
      />
      <TriggerBar
        x={126}
        y={48}
        label="L2"
        value={analogValue(state, "L2")}
        theme={theme}
        show={showTriggers}
      />
      <TriggerBar
        x={398}
        y={48}
        label="R2"
        value={analogValue(state, "R2")}
        theme={theme}
        show={showTriggers}
      />
      <rect
        x="146"
        y="88"
        width="96"
        height="28"
        rx="8"
        fill={isPressed(state, "L1") ? theme.active : theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x="398"
        y="88"
        width="96"
        height="28"
        rx="8"
        fill={isPressed(state, "R1") ? theme.active : theme.control}
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
            L1
          </text>
          <text
            x="446"
            y="108"
            textAnchor="middle"
            fill={theme.text}
            fontSize="13"
            fontWeight="700"
          >
            R1
          </text>
        </>
      ) : null}
      <Stick
        cx={244}
        cy={232}
        x={state.sticks.left.x}
        y={state.sticks.left.y}
        theme={theme}
        show={showSticks}
      />
      <Stick
        cx={396}
        cy={232}
        x={state.sticks.right.x}
        y={state.sticks.right.y}
        theme={theme}
        show={showSticks}
      />
      <Dpad state={state} theme={theme} showLabels={showLabels} />
      <ControlCircle
        cx={470}
        cy={166}
        r={20}
        label="△"
        active={isPressed(state, "TRIANGLE")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={512}
        cy={208}
        r={20}
        label="○"
        active={isPressed(state, "CIRCLE")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={428}
        cy={208}
        r={20}
        label="□"
        active={isPressed(state, "SQUARE")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={470}
        cy={250}
        r={20}
        label="×"
        active={isPressed(state, "CROSS")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={292}
        cy={174}
        r={12}
        label="S"
        active={isPressed(state, "SHARE")}
        theme={theme}
        showLabel={false}
      />
      <ControlCircle
        cx={348}
        cy={174}
        r={12}
        label="O"
        active={isPressed(state, "OPTIONS")}
        theme={theme}
        showLabel={false}
      />
      <rect
        x="296"
        y="198"
        width="48"
        height="28"
        rx="8"
        fill={isPressed(state, "TOUCHPAD") ? theme.active : theme.control}
        stroke={theme.controlStroke}
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
        x="122"
        y="200"
        width="32"
        height="30"
        rx="4"
        fill={fill("DPAD_LEFT")}
        stroke={theme.controlStroke}
      />
      <rect
        x="154"
        y="168"
        width="30"
        height="32"
        rx="4"
        fill={fill("DPAD_UP")}
        stroke={theme.controlStroke}
      />
      <rect
        x="154"
        y="200"
        width="30"
        height="30"
        rx="4"
        fill={theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x="154"
        y="230"
        width="30"
        height="32"
        rx="4"
        fill={fill("DPAD_DOWN")}
        stroke={theme.controlStroke}
      />
      <rect
        x="184"
        y="200"
        width="32"
        height="30"
        rx="4"
        fill={fill("DPAD_RIGHT")}
        stroke={theme.controlStroke}
      />
      {showLabels ? (
        <text
          x="169"
          y="219"
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
