export type OverlayThemeName =
  | "default"
  | "dark"
  | "light"
  | "neon"
  | "transparent";

export type OverlayTheme = {
  name: OverlayThemeName;
  background: string;
  shell: string;
  shellStroke: string;
  control: string;
  controlStroke: string;
  active: string;
  activeStroke: string;
  text: string;
  muted: string;
  transparent: boolean;
};

export const overlayThemes: Record<OverlayThemeName, OverlayTheme> = {
  default: {
    name: "default",
    background: "#111827",
    shell: "#1f2937",
    shellStroke: "#6b7280",
    control: "#374151",
    controlStroke: "#9ca3af",
    active: "#22c55e",
    activeStroke: "#bbf7d0",
    text: "#f9fafb",
    muted: "#cbd5e1",
    transparent: false,
  },
  dark: {
    name: "dark",
    background: "#020617",
    shell: "#111827",
    shellStroke: "#475569",
    control: "#1e293b",
    controlStroke: "#64748b",
    active: "#38bdf8",
    activeStroke: "#bae6fd",
    text: "#f8fafc",
    muted: "#94a3b8",
    transparent: false,
  },
  light: {
    name: "light",
    background: "#f8fafc",
    shell: "#e2e8f0",
    shellStroke: "#94a3b8",
    control: "#ffffff",
    controlStroke: "#64748b",
    active: "#2563eb",
    activeStroke: "#bfdbfe",
    text: "#0f172a",
    muted: "#475569",
    transparent: false,
  },
  neon: {
    name: "neon",
    background: "#050505",
    shell: "#101820",
    shellStroke: "#00e5ff",
    control: "#111827",
    controlStroke: "#7dd3fc",
    active: "#facc15",
    activeStroke: "#fef08a",
    text: "#f8fafc",
    muted: "#a7f3d0",
    transparent: false,
  },
  transparent: {
    name: "transparent",
    background: "transparent",
    shell: "rgba(15, 23, 42, 0.72)",
    shellStroke: "rgba(148, 163, 184, 0.72)",
    control: "rgba(30, 41, 59, 0.82)",
    controlStroke: "rgba(203, 213, 225, 0.72)",
    active: "#22c55e",
    activeStroke: "#bbf7d0",
    text: "#f8fafc",
    muted: "#cbd5e1",
    transparent: true,
  },
};

export function resolveOverlayTheme(
  theme: OverlayThemeName = "default",
): OverlayTheme {
  return overlayThemes[theme] ?? overlayThemes.default;
}
