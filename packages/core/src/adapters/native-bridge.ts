import {
  type NativeBridgeMessage,
  createNativeBridgeDisconnectMessage,
  createNativeBridgeStateMessage,
  serializeNativeBridgeMessage,
} from "../bridge";
import type { ControllerState, NormalizedControllerCommand } from "../types";
import { type ControllerAdapter, createAdapterCapabilities } from "./adapter";

export type NativeBridgeWrite = (
  line: string,
  message: NativeBridgeMessage,
) => Promise<void> | void;

export type NativeBridgeAdapterOptions = {
  write?: NativeBridgeWrite;
  includeState?: boolean;
};

export class NativeBridgeAdapter implements ControllerAdapter {
  readonly name = "native-bridge";
  readonly platform = "all" as const;
  readonly messages: NativeBridgeMessage[] = [];
  private connected = false;
  private controllerId: string | undefined;

  constructor(private readonly options: NativeBridgeAdapterOptions = {}) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    this.controllerId = state.id;
    const options =
      this.options.includeState === undefined
        ? {}
        : { includeState: this.options.includeState };
    await this.emit(createNativeBridgeStateMessage(state, options));
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  async disconnect(): Promise<void> {
    if (this.connected && this.controllerId) {
      await this.emit(createNativeBridgeDisconnectMessage(this.controllerId));
    }
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsXInputReports: true,
      supportsNativeBridge: true,
      outputFormats: [
        "controller-state",
        "xinput-report",
        "hid-gamepad-report",
        "native-bridge-jsonl",
      ],
      reportFormats: ["xinput", "hid-gamepad"],
      transport: "callback",
    });
  }

  private async emit(message: NativeBridgeMessage): Promise<void> {
    const line = serializeNativeBridgeMessage(message);
    this.messages.push(message);
    await this.options.write?.(line, message);
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("NativeBridgeAdapter is not connected");
    }
  }
}
