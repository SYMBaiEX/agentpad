import {
  type CreateNativeBridgeStateMessageOptions,
  type NativeBridgeConnectReportFormat,
  type NativeBridgeMessage,
  createNativeBridgeConnectMessage,
  createNativeBridgeDisconnectMessage,
  createNativeBridgeStateMessage,
  serializeNativeBridgeMessage,
} from "../bridge";
import type { ControllerState, NormalizedControllerCommand } from "../types";
import {
  type ControllerAdapter,
  controllerCommandTypes,
  createAdapterCapabilities,
} from "./adapter";

export type NativeBridgeWrite = (
  line: string,
  message: NativeBridgeMessage,
) => Promise<void> | void;

export type NativeBridgeAdapterOptions = {
  write?: NativeBridgeWrite;
  includeConnectMessage?: boolean;
  includeState?: boolean;
  includeExtensions?: boolean;
  includeProfileHidReport?: boolean;
};

export class NativeBridgeAdapter implements ControllerAdapter {
  readonly name = "native-bridge";
  readonly platform = "all" as const;
  readonly messages: NativeBridgeMessage[] = [];
  private readonly connectedControllerIds = new Set<string>();
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
    await this.emitConnectIfNeeded(state);
    this.controllerId = state.id;
    await this.emit(
      createNativeBridgeStateMessage(state, this.stateMessageOptions()),
    );
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  async disconnect(): Promise<void> {
    if (this.connected && this.controllerId) {
      await this.emit(createNativeBridgeDisconnectMessage(this.controllerId));
    }
    this.connectedControllerIds.clear();
    this.controllerId = undefined;
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsXInputReports: true,
      supportsNativeBridge: true,
      supportsTouchpad: true,
      supportsGyro: true,
      supportsDeviceStatus: true,
      supportedCommands: controllerCommandTypes,
      outputFormats: [
        "controller-state",
        "xinput-report",
        "hid-gamepad-report",
        "hid-playstation-extended-report",
        "hid-switch-extended-report",
        "native-bridge-jsonl",
      ],
      reportFormats: [
        "xinput",
        "hid-gamepad",
        "hid-playstation-extended",
        "hid-switch-extended",
      ],
      transport: "callback",
    });
  }

  private async emit(message: NativeBridgeMessage): Promise<void> {
    const line = serializeNativeBridgeMessage(message);
    this.messages.push(message);
    await this.options.write?.(line, message);
  }

  private async emitConnectIfNeeded(state: ControllerState): Promise<void> {
    if (
      this.options.includeConnectMessage === false ||
      this.connectedControllerIds.has(state.id)
    ) {
      return;
    }

    await this.emit(
      createNativeBridgeConnectMessage(state, {
        reportFormats: this.connectReportFormats(state),
      }),
    );
    this.connectedControllerIds.add(state.id);
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("NativeBridgeAdapter is not connected");
    }
  }

  private connectReportFormats(
    state: ControllerState,
  ): NativeBridgeConnectReportFormat[] {
    return [
      "xinput",
      "hid-gamepad",
      ...(this.options.includeProfileHidReport !== false &&
      state.profile === "playstation"
        ? (["hid-playstation-extended"] as const)
        : []),
      ...(this.options.includeProfileHidReport !== false &&
      state.profile === "switch"
        ? (["hid-switch-extended"] as const)
        : []),
    ];
  }

  private stateMessageOptions(): CreateNativeBridgeStateMessageOptions {
    return {
      ...(this.options.includeState !== undefined
        ? { includeState: this.options.includeState }
        : {}),
      ...(this.options.includeExtensions !== undefined
        ? { includeExtensions: this.options.includeExtensions }
        : {}),
      ...(this.options.includeProfileHidReport !== undefined
        ? { includeProfileHidReport: this.options.includeProfileHidReport }
        : {}),
    };
  }
}
