import type { ControllerState } from "@agentpad/core";
import type { OverlayTheme } from "../themes";

export type OverlaySize = "sm" | "md" | "lg" | "xl";
export type OverlayVariant = "flat" | "modern" | "minimal" | "stream";

export type OverlayCommonProps = {
  state: ControllerState;
  theme: OverlayTheme;
  size: OverlaySize;
  variant: OverlayVariant;
  showLabels: boolean;
  showSticks: boolean;
  showTriggers: boolean;
  showConnectionStatus: boolean;
  className?: string;
};

export const sizeWidths: Record<OverlaySize, number> = {
  sm: 320,
  md: 520,
  lg: 720,
  xl: 960,
};

export function isPressed(state: ControllerState, button: string): boolean {
  return Boolean(state.buttons[button]);
}

export function analogValue(state: ControllerState, button: string): number {
  return Math.max(0, Math.min(1, state.analogButtons[button] ?? 0));
}

export function ControlCircle({
  cx,
  cy,
  r,
  label,
  active,
  theme,
  showLabel,
}: {
  cx: number;
  cy: number;
  r: number;
  label: string;
  active: boolean;
  theme: OverlayTheme;
  showLabel: boolean;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={active ? theme.active : theme.control}
        stroke={active ? theme.activeStroke : theme.controlStroke}
        strokeWidth="3"
      />
      {showLabel ? (
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fill={active ? "#08111f" : theme.text}
          fontSize="18"
          fontFamily="Inter, ui-sans-serif, system-ui"
          fontWeight="700"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function Stick({
  cx,
  cy,
  x,
  y,
  theme,
  show,
}: {
  cx: number;
  cy: number;
  x: number;
  y: number;
  theme: OverlayTheme;
  show: boolean;
}) {
  if (!show) {
    return null;
  }

  const knobX = cx + x * 24;
  const knobY = cy + y * 24;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r="42"
        fill="none"
        stroke={theme.controlStroke}
        strokeDasharray="4 8"
        strokeWidth="2"
      />
      <circle
        cx={cx}
        cy={cy}
        r="28"
        fill={theme.control}
        stroke={theme.controlStroke}
        strokeWidth="3"
      />
      <line
        x1={cx}
        y1={cy}
        x2={knobX}
        y2={knobY}
        stroke={theme.active}
        strokeWidth="4"
      />
      <circle
        cx={knobX}
        cy={knobY}
        r="18"
        fill={theme.active}
        stroke={theme.activeStroke}
        strokeWidth="3"
      />
    </g>
  );
}

export function TriggerBar({
  x,
  y,
  label,
  value,
  theme,
  show,
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  theme: OverlayTheme;
  show: boolean;
}) {
  if (!show) {
    return null;
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width="116"
        height="24"
        rx="6"
        fill={theme.control}
        stroke={theme.controlStroke}
      />
      <rect
        x={x + 3}
        y={y + 3}
        width={110 * value}
        height="18"
        rx="4"
        fill={theme.active}
      />
      <text
        x={x + 58}
        y={y + 17}
        textAnchor="middle"
        fill={theme.text}
        fontSize="12"
        fontFamily="Inter, ui-sans-serif, system-ui"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

export function ConnectionDot({
  connected,
  theme,
  show,
}: {
  connected: boolean;
  theme: OverlayTheme;
  show: boolean;
}) {
  if (!show) {
    return null;
  }

  return (
    <g>
      <circle
        cx="318"
        cy="44"
        r="7"
        fill={connected ? theme.active : "#ef4444"}
      />
      <text
        x="332"
        y="49"
        fill={theme.muted}
        fontSize="14"
        fontFamily="Inter, ui-sans-serif, system-ui"
      >
        {connected ? "connected" : "offline"}
      </text>
    </g>
  );
}
