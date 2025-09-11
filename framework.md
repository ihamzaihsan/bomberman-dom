# Custom DOM framework

This project uses a small JavaScript framework implemented in `src/framework/`. It works with real DOM nodes and separates state notifications, delegated input events, client routing, rendering caches, and animation timing. It has no Virtual DOM or diffing implementation.

## Modules

| Module               | Responsibility                                                    |
| -------------------- | ----------------------------------------------------------------- |
| `StateManager`       | Shallow state updates, subscriptions, and frame-batched callbacks |
| `EventManager`       | Custom events and delegated DOM listeners                         |
| `Router`             | History navigation, route matching, and the 404 component         |
| `SelectiveRenderer`  | DOM creation, element caches, dirty flags, and queued updates     |
| `GameLoop`           | `requestAnimationFrame` scheduling and FPS sampling               |
| `PerformanceMonitor` | Frame timing, named counters, and observer-based measurements     |

`Framework` composes these modules and exposes their common methods. The game builds its screens with DOM nodes. Its map renderer compares cell snapshots and updates changed cells instead of rebuilding the arena every frame.

## State

```js
import { Framework } from './src/framework/framework.js';

const app = new Framework();
app.setState({ score: 0, messages: [] });
app.set('score', 10);
app.push('messages', { text: 'Ready' });
const unsubscribe = app.subscribe((state) => {
  document.querySelector('#score').textContent = state.score;
});
// Call unsubscribe() when the subscription is no longer needed.
```

State setters update the stored state synchronously. Notifications and setter callbacks are batched into an animation frame. Updates are shallow; treat values returned by `get()` and `getState()` as read-only and replace nested objects when changing them. `remove(key, predicate)` retains array items for which the predicate returns true, following `Array.filter` semantics.

## DOM and events

```js
const button = app.createElement('button', {
  id: 'ready-button',
  type: 'button',
  textContent: 'Ready',
});
document.querySelector('#controls').appendChild(button);

const onReady = () => app.set('ready', true);
app.click('#ready-button', onReady);
// Delegation handles matching descendants created after registration.
app.off('click', '#ready-button', onReady);
```

`createElement` accepts DOM properties and attributes. Use `textContent` for user-supplied values. `innerHTML` is reserved for static, trusted markup. `find`, `findAll`, `cacheElement`, and `getCachedElement` support element access; detached cache entries are discarded when accessed.

## Routes and rendering

```js
app.routes({ '/': () => document.createElement('main') });
app.navigate('/');
```

The game registers the root route and manages its gameplay screens directly. Unknown routes render the DOM-based `NotFound404` component. Navigation uses the History API. The framework delegates event handling through document listeners; application code must avoid registering the same callback repeatedly.

## Animation and performance

```js
app.startGameLoop((deltaTime, currentTime) => {
  // Process pending visual changes. This does not advance server game rules.
});
app.stopGameLoop();
const metrics = app.getPerformanceMetrics();
```

The loop processes queued rendering work and samples frame timing. Named performance measures are cleared after use to prevent the browser's performance timeline growing without bound. The game's optional F2 panel shows local rendering measurements. The network server advances authoritative rules independently at 10 ticks per second.
