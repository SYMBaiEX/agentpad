import {
  ConnectionDot,
  ControlCircle,
  type OverlayCommonProps,
  Stick,
  isPressed,
} from "./shared";

export function GenericOverlay(props: OverlayCommonProps) {
  const { state, theme, showLabels, showSticks, showConnectionStatus } = props;
  const buttons = Object.keys(state.buttons).slice(0, 12);

  return (
    <svg
      viewBox="0 0 640 360"
      role="img"
      aria-label="Generic controller overlay"
    >
      <rect
        width="640"
        height="360"
        fill={theme.transparent ? "transparent" : theme.background}
        rx="0"
      />
      <rect
        x="88"
        y="86"
        width="464"
        height="204"
        rx="36"
        fill={theme.shell}
        stroke={theme.shellStroke}
        strokeWidth="4"
      />
      <Stick
        cx={210}
        cy={204}
        x={state.sticks.left.x}
        y={state.sticks.left.y}
        theme={theme}
        show={showSticks}
      />
      <Stick
        cx={430}
        cy={204}
        x={state.sticks.right.x}
        y={state.sticks.right.y}
        theme={theme}
        show={showSticks}
      />
      {buttons.map((button, index) => (
        <ControlCircle
          key={button}
          cx={288 + (index % 4) * 34}
          cy={132 + Math.floor(index / 4) * 34}
          r={13}
          label={button.replace("BUTTON_", "")}
          active={isPressed(state, button)}
          theme={theme}
          showLabel={showLabels}
        />
      ))}
      <ConnectionDot
        connected={state.connected}
        theme={theme}
        show={showConnectionStatus}
      />
    </svg>
  );
}
