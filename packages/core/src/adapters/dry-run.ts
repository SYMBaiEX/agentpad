import type { ControllerState, NormalizedControllerCommand } from "../types";
import {
  type ControllerAdapter,
  controllerCommandTypes,
  createAdapterCapabilities,
} from "./adapter";

export class DryRunAdapter implements ControllerAdapter {
  readonly name = "dry-run";
  readonly platform = "all" as const;
  readonly history: NormalizedControllerCommand[] = [];
  readonly stateHistory: ControllerState[] = [];
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
    this.history.push(command);
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    this.stateHistory.push(state);
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsTouchpad: true,
      supportsGyro: true,
      supportsDeviceStatus: true,
      supportsVirtualDevice: false,
      supportedCommands: controllerCommandTypes,
      outputFormats: ["normalized-command", "controller-state"],
      transport: "memory",
      virtualDeviceKind: "none",
    });
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("DryRunAdapter is not connected");
    }
  }
}
