import type { NormalizedControllerCommand } from "../types";
import { type ControllerAdapter, baseCapabilities } from "./adapter";

export class DryRunAdapter implements ControllerAdapter {
  readonly name = "dry-run";
  readonly platform = "all" as const;
  readonly history: NormalizedControllerCommand[] = [];
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
    this.history.push(command);
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return {
      ...baseCapabilities,
      supportsVirtualDevice: false,
    };
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("DryRunAdapter is not connected");
    }
  }
}
