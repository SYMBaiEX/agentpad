import {
  type ControllerProfileName,
  type ControllerState,
  createInitialControllerState,
  resolveProfile,
} from "@agentpad/core/browser";
import { type OverlayThemeName, resolveOverlayTheme } from "../themes";
import { GenericOverlay } from "./GenericOverlay";
import { PlayStationOverlay } from "./PlayStationOverlay";
import { SwitchOverlay } from "./SwitchOverlay";
import { XboxOverlay } from "./XboxOverlay";
import { type OverlaySize, type OverlayVariant, sizeWidths } from "./shared";

export type ControllerOverlayProps = {
  profile: Exclude<ControllerProfileName, "keyboard-mouse">;
  state?: ControllerState;
  size?: OverlaySize;
  theme?: OverlayThemeName;
  variant?: OverlayVariant;
  showLabels?: boolean;
  showSticks?: boolean;
  showTriggers?: boolean;
  showConnectionStatus?: boolean;
  className?: string;
};

export function ControllerOverlay({
  profile,
  state,
  size = "md",
  theme = "default",
  variant = "modern",
  showLabels = true,
  showSticks = true,
  showTriggers = true,
  showConnectionStatus = false,
  className,
}: ControllerOverlayProps) {
  const resolvedTheme = resolveOverlayTheme(theme);
  const resolvedState =
    state ??
    createInitialControllerState("overlay-preview", resolveProfile(profile));
  const style = {
    width: "100%",
    maxWidth: `${sizeWidths[size]}px`,
    display: "block",
    background: resolvedTheme.transparent
      ? "transparent"
      : resolvedTheme.background,
  };
  const common = {
    state: resolvedState,
    theme: resolvedTheme,
    size,
    variant,
    showLabels,
    showSticks,
    showTriggers,
    showConnectionStatus,
    ...(className ? { className } : {}),
  };

  return (
    <div className={className} style={style}>
      {profile === "xbox" ? <XboxOverlay {...common} /> : null}
      {profile === "playstation" ? <PlayStationOverlay {...common} /> : null}
      {profile === "switch" ? <SwitchOverlay {...common} /> : null}
      {profile === "generic-hid" ? <GenericOverlay {...common} /> : null}
    </div>
  );
}
