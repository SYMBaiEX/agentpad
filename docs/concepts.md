# Concepts

OpenController has four core concepts:

- Controller profile: the logical shape of a controller, such as Xbox or PlayStation.
- Controller runtime: the queue, safety guard, state store, replay logger, and adapter.
- Adapter: the output backend that receives normalized commands.
- Overlay: a visual renderer that reads controller state.

OpenController exposes two command styles:

- Timed commands such as `press`, `moveStick`, `trigger`, `dpad`, and `combo`
  perform an input and then return that control to neutral after the requested
  duration.
- Stateful commands such as `setButton`, `setStick`, `setTrigger`, and
  `setDpad` hold an exact controller state until the same control changes or
  `neutral` resets the controller.
- Atomic state patches through `setState` update several controls as one
  normalized command and one state-sync snapshot.

Commands flow through the runtime in this order:

```txt
Controller API
  -> Command queue
  -> Safety guard
  -> Profile normalization
  -> Adapter command event
  -> State store
  -> Replay logger
  -> Adapter state sync
```
