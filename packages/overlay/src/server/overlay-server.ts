import {
  type Controller,
  type ControllerProfileName,
  type ControllerState,
  createInitialControllerState,
  resolveProfile,
} from "@opencontroller/core";
import type { ServerWebSocket } from "bun";
import { type OverlayThemeName, resolveOverlayTheme } from "../themes";

export type OverlayServerOptions = {
  port?: number;
  profile: Exclude<ControllerProfileName, "keyboard-mouse">;
  theme?: OverlayThemeName;
  state?: ControllerState;
  controller?: Controller;
  host?: string;
};

export type OverlayServerHandle = {
  url: string;
  publishState(state: ControllerState): void;
  stop(): void;
};

export async function createOverlayServer(
  options: OverlayServerOptions,
): Promise<OverlayServerHandle> {
  let state =
    options.state ??
    createInitialControllerState(
      "overlay-server",
      resolveProfile(options.profile),
    );
  const clients = new Set<ServerWebSocket<unknown>>();
  const theme = resolveOverlayTheme(options.theme ?? "transparent");

  const server = Bun.serve({
    port: options.port ?? 4317,
    hostname: options.host ?? "127.0.0.1",
    fetch(request, serverInstance) {
      const url = new URL(request.url);
      if (url.pathname === "/ws") {
        if (serverInstance.upgrade(request)) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      if (url.pathname === "/state") {
        return Response.json(state);
      }
      if (url.pathname === "/" || url.pathname === "/overlay") {
        return new Response(renderOverlayHtml(state, theme), {
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify({ type: "state", state }));
      },
      close(ws) {
        clients.delete(ws);
      },
      message() {},
    },
  });

  const unsubscribe = options.controller?.onStateChange((next) => {
    state = next;
    broadcast(clients, state);
  });

  return {
    url: `http://${server.hostname}:${server.port}/overlay`,
    publishState(next) {
      state = next;
      broadcast(clients, state);
    },
    stop() {
      unsubscribe?.();
      server.stop(true);
    },
  };
}

function broadcast(
  clients: Set<ServerWebSocket<unknown>>,
  state: ControllerState,
): void {
  const payload = JSON.stringify({ type: "state", state });
  for (const client of clients) {
    client.send(payload);
  }
}

function renderOverlayHtml(
  state: ControllerState,
  theme: ReturnType<typeof resolveOverlayTheme>,
): string {
  const initialState = serializeScriptJson(state);
  const initialTheme = serializeScriptJson(theme);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenController Overlay</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: ${theme.transparent ? "transparent" : theme.background};
        overflow: hidden;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      #app {
        width: 100vw;
        height: 100vh;
        display: grid;
        place-items: center;
      }
      svg {
        width: min(100vw, 960px);
        height: auto;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      let state = ${initialState};
      const theme = ${initialTheme};
      const app = document.getElementById("app");

      function pressed(button) {
        return Boolean(state.buttons && state.buttons[button]);
      }

      function analog(button) {
        return Math.max(0, Math.min(1, (state.analogButtons && state.analogButtons[button]) || 0));
      }

      const svgNamespace = "http://www.w3.org/2000/svg";

      function svgElement(name, attributes, children) {
        const element = document.createElementNS(svgNamespace, name);
        for (const [key, value] of Object.entries(attributes || {})) {
          element.setAttribute(key, String(value));
        }
        for (const child of children || []) {
          element.append(child);
        }
        return element;
      }

      function svgText(x, y, label, attributes) {
        const text = svgElement("text", { x, y, ...attributes });
        text.textContent = label;
        return text;
      }

      function circle(cx, cy, r, label, active) {
        return svgElement("g", {}, [
          svgElement("circle", {
            cx,
            cy,
            r,
            fill: active ? theme.active : theme.control,
            stroke: active ? theme.activeStroke : theme.controlStroke,
            "stroke-width": 3,
          }),
          svgText(cx, cy + 5, label, {
            "text-anchor": "middle",
            fill: active ? "#08111f" : theme.text,
            "font-size": 18,
            "font-weight": 700,
          }),
        ]);
      }

      function stick(cx, cy, stickState) {
        const x = cx + ((stickState && stickState.x) || 0) * 24;
        const y = cy + ((stickState && stickState.y) || 0) * 24;
        return svgElement("g", {}, [
          svgElement("circle", {
            cx,
            cy,
            r: 42,
            fill: "none",
            stroke: theme.controlStroke,
            "stroke-dasharray": "4 8",
            "stroke-width": 2,
          }),
          svgElement("circle", {
            cx,
            cy,
            r: 28,
            fill: theme.control,
            stroke: theme.controlStroke,
            "stroke-width": 3,
          }),
          svgElement("line", {
            x1: cx,
            y1: cy,
            x2: x,
            y2: y,
            stroke: theme.active,
            "stroke-width": 4,
          }),
          svgElement("circle", {
            cx: x,
            cy: y,
            r: 18,
            fill: theme.active,
            stroke: theme.activeStroke,
            "stroke-width": 3,
          }),
        ]);
      }

      function trigger(x, y, label, value) {
        return svgElement("g", {}, [
          svgElement("rect", {
            x,
            y,
            width: 116,
            height: 24,
            rx: 6,
            fill: theme.control,
            stroke: theme.controlStroke,
          }),
          svgElement("rect", {
            x: x + 3,
            y: y + 3,
            width: 110 * value,
            height: 18,
            rx: 4,
            fill: theme.active,
          }),
          svgText(x + 58, y + 17, label, {
            "text-anchor": "middle",
            fill: theme.text,
            "font-size": 12,
            "font-weight": 700,
          }),
        ]);
      }

      function profileConfig() {
        if (state.profile === "playstation") {
          return {
            leftTrigger: "L2",
            rightTrigger: "R2",
            labels: ["TRIANGLE", "CIRCLE", "SQUARE", "CROSS"],
            text: ["△", "○", "□", "×"],
            shell: "M126 120 C170 72 252 92 320 94 C388 92 470 72 514 120 C574 184 578 298 526 314 C480 329 444 270 418 238 L222 238 C196 270 160 329 114 314 C62 298 66 184 126 120 Z"
          };
        }
        if (state.profile === "switch") {
          return {
            leftTrigger: "ZL",
            rightTrigger: "ZR",
            labels: ["X", "A", "Y", "B"],
            text: ["X", "A", "Y", "B"],
            shell: "M150 82 L490 82 C542 82 578 126 578 188 C578 250 542 302 490 302 L150 302 C98 302 62 250 62 188 C62 126 98 82 150 82 Z"
          };
        }
        if (state.profile === "generic-hid") {
          return {
            leftTrigger: "BUTTON_6",
            rightTrigger: "BUTTON_7",
            labels: ["BUTTON_3", "BUTTON_1", "BUTTON_2", "BUTTON_0"],
            text: ["B3", "B1", "B2", "B0"],
            shell: "M154 98 C208 50 432 50 486 98 C556 160 572 278 520 304 C483 323 441 278 416 238 L224 238 C199 278 157 323 120 304 C68 278 84 160 154 98 Z"
          };
        }
        return {
          leftTrigger: "LT",
          rightTrigger: "RT",
          labels: ["Y", "B", "X", "A"],
          text: ["Y", "B", "X", "A"],
          shell: "M154 98 C208 50 432 50 486 98 C556 160 572 278 520 304 C483 323 441 278 416 238 L224 238 C199 278 157 323 120 304 C68 278 84 160 154 98 Z"
        };
      }

      function render() {
        const config = profileConfig();
        const svg = svgElement("svg", {
          viewBox: "0 0 640 360",
          role: "img",
          "aria-label": "OpenController controller overlay",
        }, [
          svgElement("rect", {
            width: 640,
            height: 360,
            fill: theme.transparent ? "transparent" : theme.background,
          }),
          svgElement("path", {
            d: config.shell,
            fill: theme.shell,
            stroke: theme.shellStroke,
            "stroke-width": 4,
          }),
          trigger(126, 48, config.leftTrigger, analog(config.leftTrigger)),
          trigger(398, 48, config.rightTrigger, analog(config.rightTrigger)),
          stick(210, 204, state.sticks && state.sticks.left),
          stick(396, 224, state.sticks && state.sticks.right),
          circle(470, 176, 20, config.text[0], pressed(config.labels[0])),
          circle(510, 216, 20, config.text[1], pressed(config.labels[1])),
          circle(430, 216, 20, config.text[2], pressed(config.labels[2])),
          circle(470, 256, 20, config.text[3], pressed(config.labels[3])),
        ]);
        app.replaceChildren(svg);
      }

      render();
      const socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "state") {
          state = message.state;
          render();
        }
      });
    </script>
  </body>
</html>`;
}

function serializeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
