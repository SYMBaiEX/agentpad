# WebSocket Bridge

Use the WebSocket adapter when an app, emulator, browser game, or plugin wants
to receive controller commands directly.

```ts
const controller = await createController({
  profile: "xbox",
  adapter: "websocket",
  url: "ws://localhost:7777/controller"
});
```

Message shape:

```json
{
  "type": "controller.command",
  "controllerId": "player-1",
  "profile": "xbox",
  "command": {
    "type": "press",
    "button": "A",
    "durationMs": 100
  },
  "timestamp": 1770000000
}
```
