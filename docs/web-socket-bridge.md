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
  "timestamp": 1770000000000
}
```

The adapter also emits full state synchronization messages after runtime state
changes:

```json
{
  "type": "controller.state",
  "controllerId": "player-1",
  "profile": "xbox",
  "state": {
    "id": "player-1",
    "profile": "xbox",
    "connected": true,
    "buttons": {},
    "analogButtons": {},
    "sticks": {
      "left": { "x": 0, "y": 0 },
      "right": { "x": 0, "y": 0 }
    },
    "dpad": {
      "up": false,
      "down": false,
      "left": false,
      "right": false
    },
    "updatedAt": 1770000000000
  },
  "timestamp": 1770000000000
}
```
