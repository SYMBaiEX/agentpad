# OBS Overlay

Start the overlay server:

```bash
agentpad overlay --profile xbox --port 4317
```

Add this URL as an OBS browser source:

```txt
http://127.0.0.1:4317/overlay
```

The overlay server uses a transparent theme by default and streams state updates
over WebSocket.
