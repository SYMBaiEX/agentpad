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
    "touchpad": {
      "pressed": false,
      "contacts": []
    },
    "motion": {
      "acceleration": { "x": 0, "y": 0, "z": 0 },
      "gyroscope": { "x": 0, "y": 0, "z": 0 },
      "orientation": { "x": 0, "y": 0, "z": 0 }
    },
    "updatedAt": 1770000000000
  },
  "timestamp": 1770000000000
}
```

WebSocket is the first integration path for richer profile-specific channels.
It carries `touchpad` commands for PlayStation and `motion` commands for
PlayStation/Switch in both `controller.command` messages and full
`controller.state` snapshots.
