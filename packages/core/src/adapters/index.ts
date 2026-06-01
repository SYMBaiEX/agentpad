import { AdapterError } from "../errors";
import type { CreateControllerOptions } from "../types";
import type { ControllerAdapter } from "./adapter";
import { DryRunAdapter } from "./dry-run";
import { WebSocketAdapter } from "./websocket";

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
  }
}

export * from "./adapter";
export * from "./dry-run";
export * from "./websocket";
