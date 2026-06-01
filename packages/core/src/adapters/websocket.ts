import { AdapterError } from "../errors";
import type { ControllerState, NormalizedControllerCommand } from "../types";
import {
  type ControllerAdapter,
  controllerCommandTypes,
  createAdapterCapabilities,
} from "./adapter";

export type WebSocketAdapterOptions = {
  url: string;
};

export class WebSocketAdapter implements ControllerAdapter {
  readonly name = "websocket";
  readonly platform = "all" as const;
  private socket: WebSocket | undefined;

  constructor(private readonly options: WebSocketAdapterOptions) {}

  async connect(): Promise<void> {
    this.socket = new WebSocket(this.options.url);
    await new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(
          new AdapterError(
            "WEBSOCKET_UNAVAILABLE",
            "WebSocket could not be created",
          ),
        );
        return;
      }

      const handleOpen = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(
          new AdapterError(
            "WEBSOCKET_CONNECT_FAILED",
            `Unable to connect to ${this.options.url}`,
          ),
        );
      };
      const cleanup = () => {
        this.socket?.removeEventListener("open", handleOpen);
        this.socket?.removeEventListener("error", handleError);
      };

      this.socket.addEventListener("open", handleOpen);
      this.socket.addEventListener("error", handleError);
    });
  }

  async send(command: NormalizedControllerCommand): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new AdapterError(
        "WEBSOCKET_NOT_CONNECTED",
        "WebSocket adapter is not connected",
      );
    }

    this.socket.send(
      JSON.stringify({
        type: "controller.command",
        controllerId: command.controllerId,
        profile: command.profile,
        command: command.command,
        timestamp: command.timestamp,
        universal: command.universal,
      }),
    );
  }

  async neutral(command?: NormalizedControllerCommand): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: "controller.neutral",
        controllerId: command?.controllerId,
        profile: command?.profile,
        timestamp: Date.now(),
      }),
    );
  }

  async syncState(state: ControllerState): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: "controller.state",
        controllerId: state.id,
        profile: state.profile,
        state,
        timestamp: Date.now(),
      }),
    );
  }

  async disconnect(): Promise<void> {
    this.socket?.close();
    this.socket = undefined;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsTouchpad: true,
      supportsGyro: true,
      supportsVirtualDevice: false,
      supportedCommands: controllerCommandTypes,
      outputFormats: [
        "normalized-command",
        "controller-state",
        "websocket-json",
      ],
      transport: "websocket",
      virtualDeviceKind: "none",
    });
  }
}
