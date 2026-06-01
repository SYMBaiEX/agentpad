import { AdapterError } from "../errors";
import type { CreateControllerOptions } from "../types";
import type { ControllerAdapter } from "./adapter";
import { DryRunAdapter } from "./dry-run";
import { NativeBridgeAdapter } from "./native-bridge";
import { WebSocketAdapter } from "./websocket";
import { XInputReportAdapter } from "./xinput-report";

export async function resolveAdapter(
  options: CreateControllerOptions,
): Promise<ControllerAdapter> {
  if (typeof options.adapter === "object" && options.adapter !== null) {
    return options.adapter;
  }

  switch (options.adapter ?? "dry-run") {
    case "dry-run":
      return new DryRunAdapter();
    case "websocket":
      if (!options.url) {
        throw new AdapterError(
          "WEBSOCKET_URL_REQUIRED",
          "WebSocket adapter requires a url option",
        );
      }
      return new WebSocketAdapter({ url: options.url });
    case "xinput-report":
      return new XInputReportAdapter();
    case "native-bridge":
      return new NativeBridgeAdapter();
  }
}

export * from "./adapter";
export * from "./dry-run";
export * from "./native-bridge";
export * from "./websocket";
export * from "./xinput-report";
