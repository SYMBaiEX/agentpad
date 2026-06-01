# Concepts

OpenController has four core concepts:

- Controller profile: the logical shape of a controller, such as Xbox or PlayStation.
- Controller runtime: the queue, safety guard, state store, replay logger, and adapter.
- Adapter: the output backend that receives normalized commands.
- Overlay: a visual renderer that reads controller state.

Commands flow through the runtime in this order:

```txt
Controller API
  -> Command queue
  -> Safety guard
  -> Profile normalization
  -> State store
  -> Replay logger
  -> Adapter
```
