import {
  ConnectionDot,
  ControlCircle,
  type OverlayCommonProps,
  Stick,
  TriggerBar,
  analogValue,
  isPressed,
} from "./shared";

export function XboxOverlay(props: OverlayCommonProps) {
  const {
    state,
    theme,
    showLabels,
    showSticks,
    showTriggers,
    showConnectionStatus,
  } = props;

  return (
    <svg viewBox="0 0 640 360" role="img" aria-label="Xbox controller overlay">
      <rect
        width="640"
        height="360"
        fill={theme.transparent ? "transparent" : theme.background}
        rx="0"
      />
      <path
        d="M154 98 C208 50 432 50 486 98 C556 160 572 278 520 304 C483 323 441 278 416 238 L224 238 C199 278 157 323 120 304 C68 278 84 160 154 98 Z"
        fill={theme.shell}
        stroke={theme.shellStroke}
        strokeWidth="4"
      />
      <TriggerBar
        x={126}
        y={48}
        label="LT"
        value={analogValue(state, "LT")}
        theme={theme}
        show={showTriggers}
      />
      <TriggerBar
        x={398}
        y={48}
        label="RT"
        value={analogValue(state, "RT")}
        theme={theme}
        show={showTriggers}
      />
      <rect
        x="146"
        y="84"
        width="96"
        height="28"
        rx="8"
        fill={isPressed(state, "LB") ? theme.active : theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x="398"
        y="84"
        width="96"
        height="28"
        rx="8"
        fill={isPressed(state, "RB") ? theme.active : theme.control}
        stroke={theme.controlStroke}
      />
      {showLabels ? (
        <>
          <text
            x="194"
            y="104"
            textAnchor="middle"
            fill={theme.text}
            fontSize="13"
            fontWeight="700"
          >
            LB
          </text>
          <text
            x="446"
            y="104"
            textAnchor="middle"
            fill={theme.text}
            fontSize="13"
            fontWeight="700"
          >
            RB
          </text>
        </>
      ) : null}
      <Stick
        cx={210}
        cy={194}
        x={state.sticks.left.x}
        y={state.sticks.left.y}
        theme={theme}
        show={showSticks}
      />
      <Stick
        cx={396}
        cy={224}
        x={state.sticks.right.x}
        y={state.sticks.right.y}
        theme={theme}
        show={showSticks}
      />
      <Dpad state={state} theme={theme} showLabels={showLabels} />
      <ControlCircle
        cx={470}
        cy={176}
        r={20}
        label="Y"
        active={isPressed(state, "Y")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={510}
        cy={216}
        r={20}
        label="B"
        active={isPressed(state, "B")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={430}
        cy={216}
        r={20}
        label="X"
        active={isPressed(state, "X")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={470}
        cy={256}
        r={20}
        label="A"
        active={isPressed(state, "A")}
        theme={theme}
        showLabel={showLabels}
      />
      <ControlCircle
        cx={292}
        cy={182}
        r={13}
        label="B"
        active={isPressed(state, "BACK")}
        theme={theme}
        showLabel={false}
      />
      <ControlCircle
        cx={348}
        cy={182}
        r={13}
        label="S"
        active={isPressed(state, "START")}
        theme={theme}
        showLabel={false}
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
        x="132"
        y="230"
        width="32"
        height="30"
        rx="4"
        fill={fill("DPAD_LEFT")}
        stroke={theme.controlStroke}
      />
      <rect
        x="164"
        y="198"
        width="30"
        height="32"
        rx="4"
        fill={fill("DPAD_UP")}
        stroke={theme.controlStroke}
      />
      <rect
        x="164"
        y="230"
        width="30"
        height="30"
        rx="4"
        fill={theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x="164"
        y="260"
        width="30"
        height="32"
        rx="4"
        fill={fill("DPAD_DOWN")}
        stroke={theme.controlStroke}
      />
      <rect
        x="194"
        y="230"
        width="32"
        height="30"
        rx="4"
        fill={fill("DPAD_RIGHT")}
        stroke={theme.controlStroke}
      />
      {showLabels ? (
        <text
          x="179"
          y="249"
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
