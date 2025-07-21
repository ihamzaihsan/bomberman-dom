# Framework Documentation

## Overview

The Framework is a lightweight, modular JavaScript framework designed for building high-performance interactive applications, particularly games. It features a component-based architecture with built-in performance optimization, selective rendering, and comprehensive state management.

### Key Features
- **Modular Architecture**: Composed of focused, single-responsibility modules
- **Performance Optimized**: Built-in selective rendering and caching systems
- **Event-Driven**: Comprehensive event management with DOM delegation
- **State Management**: Reactive state with batched updates
- **Game Loop**: RequestAnimationFrame-based game loop with performance monitoring
- **Routing**: Client-side routing with history management
- **Developer Friendly**: Clean API with method chaining and error handling

## Architecture

The Framework uses a modular composition pattern where the main Framework class delegates functionality to specialized modules:

```
Framework (Main Class)
├── StateManager      # State management and reactivity
├── EventManager      # Event emission and DOM delegation
├── PerformanceMonitor # Performance tracking and optimization
├── SelectiveRenderer  # Optimized rendering and caching
├── GameLoop          # Game loop with performance monitoring
├── Router            # Client-side routing
└── VirtualDOM        # Virtual DOM (future expansion)
```

## Module Structure

### StateManager
**Purpose**: Manages application state with reactive updates and batching.

**Key Responsibilities**:
- State storage and mutation
- Subscriber notification
- Batched updates for performance
- Dirty component tracking

**Key Methods**:
```javascript
setState(newState, callback)    // Update state with optional callback
getState()                      // Get current state
get(key)                       // Get specific state property
set(key, value, callback)      // Set specific property
merge(key, object, callback)   // Merge object into state property
push(key, item, callback)      // Add item to array in state
remove(key, predicate, callback) // Remove items from array
subscribe(callback)            // Subscribe to state changes
```

### EventManager
**Purpose**: Handles event emission and DOM event delegation.

**Key Responsibilities**:
- Custom event emission
- DOM event delegation
- Event handler management
- Error handling for events

**Key Methods**:
```javascript
emit(eventName, ...args)       // Emit custom event
addEventListener(name, listener) // Add custom event listener
on(eventType, selector, handler) // DOM event delegation
off(eventType, selector, handler) // Remove event handler
click(selector, handler)       // Shorthand for click events
keydown(selector, handler)     // Shorthand for keydown events
// ... other event shortcuts
```

### PerformanceMonitor
**Purpose**: Tracks performance metrics and provides optimization insights.

**Key Responsibilities**:
- Frame time tracking
- FPS monitoring
- Performance counter management
- Long task detection
- Performance callback notifications

**Key Methods**:
```javascript
getPerformanceMetrics()        // Get current performance data
onPerformanceUpdate(callback)  // Subscribe to performance updates
incrementCounter(name)         // Increment performance counter
getCounter(name)              // Get counter value
getAllCounters()              // Get all counters
```

### SelectiveRenderer
**Purpose**: Optimizes rendering through selective updates and caching.

**Key Responsibilities**:
- Element caching for fast access
- Dirty element tracking
- Render queue management
- Conditional rendering helpers

**Key Methods**:
```javascript
markElementDirty(id, data)     // Mark element for re-render
getCachedElement(id)           // Get cached DOM element
updateElement(id, fn, force)   // Update element with function
processDirtyElements()         // Process all dirty elements
when(condition, element)       // Conditional rendering
map(array, callback, keyFn)    // List rendering with caching
```

### GameLoop
**Purpose**: Manages the main game loop with performance optimization.

**Key Responsibilities**:
- RequestAnimationFrame loop management
- FPS calculation and monitoring
- Performance metric integration
- Selective rendering coordination

**Key Methods**:
```javascript
startGameLoop(callback)        // Start the game loop
stopGameLoop()                 // Stop the game loop
getFPS()                      // Get current FPS
```

### Router
**Purpose**: Handles client-side routing and navigation.

**Key Responsibilities**:
- Route definition and matching
- History management
- Navigation with state
- Error page handling

**Key Methods**:
```javascript
route(path, component)         // Define a route
routes(routeMap)              // Define multiple routes
navigate(path, state)         // Navigate to path
back()                        // Go back in history
forward()                     // Go forward in history
getCurrentRoute()             // Get current route
```

### VirtualDOM
**Purpose**: Placeholder for future virtual DOM implementation.

**Current State**: Basic structure for future expansion
**Future Features**: Virtual DOM diffing, patching, and optimization

## API Reference

The Framework class provides a unified API that delegates to the appropriate modules:

### State Management
```javascript
const framework = new Framework();

// Basic state operations
framework.setState({ count: 0 });
framework.set('count', 5);
const count = framework.get('count');

// Array operations
framework.push('items', newItem);
framework.remove('items', item => item.id === targetId);

// Subscribe to changes
const unsubscribe = framework.subscribe(state => {
  console.log('State changed:', state);
});
```

### Event Handling
```javascript
// DOM event delegation
framework.click('.button', (event, element) => {
  console.log('Button clicked:', element);
});

// Custom events
framework.addEventListener('custom-event', data => {
  console.log('Custom event:', data);
});

framework.emit('custom-event', { message: 'Hello' });
```

### Performance Monitoring
```javascript
// Monitor performance
framework.onPerformanceUpdate(metrics => {
  console.log(`FPS: ${metrics.fps}`);
  console.log(`Frame time: ${metrics.frameTime}ms`);
});

// Track custom metrics
framework.incrementCounter('user-actions');
const actionCount = framework.getCounter('user-actions');
```

### Selective Rendering
```javascript
// Mark elements for update
framework.markElementDirty('game-board', gameState);

// Update specific elements
framework.updateElement('score', element => {
  element.textContent = `Score: ${score}`;
});

// Conditional rendering
const playerElement = framework.when(player.alive,
  `<div class="player">${player.name}</div>`
);

// List rendering with caching
const itemElements = framework.map(items, item =>
  `<div class="item">${item.name}</div>`,
  item => item.id // key extractor
);
```

### Game Loop
```javascript
// Start game loop
framework.startGameLoop((deltaTime, currentTime) => {
  // Update game logic
  updateGame(deltaTime);

  // Rendering is handled automatically by selective renderer
});

// Monitor FPS
const currentFPS = framework.getFPS();
```

### Routing
```javascript
// Define routes
framework.routes({
  '/': () => renderHomePage(),
  '/game': () => renderGamePage(),
  '/settings': () => renderSettingsPage()
});

// Navigate
framework.navigate('/game', { level: 1 });

// Check current route
if (framework.isRoute('/game')) {
  // Game-specific logic
}
```

## Usage Examples

### Basic Application Setup
```javascript
import { Framework } from './framework/framework.js';

const app = new Framework();

// Initialize state
app.setState({
  user: { name: '', score: 0 },
  gameState: 'menu',
  items: []
});

// Set up routes
app.routes({
  '/': () => renderMenu(),
  '/game': () => renderGame(),
  '/leaderboard': () => renderLeaderboard()
});

// Set up event handlers
app.click('.start-button', () => {
  app.navigate('/game');
});

app.click('.menu-button', () => {
  app.navigate('/');
});

// Start the application
app.navigate('/');
```

### Game Implementation
```javascript
class Game {
  constructor() {
    this.framework = new Framework();
    this.setupGame();
  }

  setupGame() {
    // Initialize game state
    this.framework.setState({
      player: { x: 0, y: 0, health: 100 },
      enemies: [],
      score: 0
    });

    // Set up input handling
    this.framework.keydown('body', (event) => {
      this.handleInput(event.key);
    });

    // Start game loop
    this.framework.startGameLoop((deltaTime) => {
      this.update(deltaTime);
    });

    // Monitor performance
    this.framework.onPerformanceUpdate(metrics => {
      if (metrics.fps < 30) {
        console.warn('Low FPS detected, reducing quality');
        this.reduceQuality();
      }
    });
  }

  update(deltaTime) {
    const state = this.framework.getState();

    // Update game logic
    this.updatePlayer(state.player, deltaTime);
    this.updateEnemies(state.enemies, deltaTime);

    // Mark UI elements for update
    this.framework.markElementDirty('player-health', state.player.health);
    this.framework.markElementDirty('score-display', state.score);
  }

  handleInput(key) {
    const player = this.framework.get('player');

    switch(key) {
      case 'ArrowUp':
        this.framework.set('player', { ...player, y: player.y - 1 });
        break;
      case 'ArrowDown':
        this.framework.set('player', { ...player, y: player.y + 1 });
        break;
      // ... other keys
    }
  }
}
```

### Performance Optimization Example
```javascript
class OptimizedRenderer {
  constructor(framework) {
    this.framework = framework;
    this.setupOptimizations();
  }

  setupOptimizations() {
    // Cache frequently accessed elements
    this.framework.cacheElement('game-board', document.getElementById('game-board'));
    this.framework.cacheElement('ui-panel', document.getElementById('ui-panel'));

    // Set up selective rendering
    this.framework.subscribe(state => {
      // Only update what changed
      if (this.lastPlayerPosition !== `${state.player.x},${state.player.y}`) {
        this.framework.markElementDirty('player-sprite', state.player);
        this.lastPlayerPosition = `${state.player.x},${state.player.y}`;
      }

      if (this.lastScore !== state.score) {
        this.framework.markElementDirty('score', state.score);
        this.lastScore = state.score;
      }
    });

    // Batch UI updates
    this.framework.updateElement('score', element => {
      element.textContent = `Score: ${this.framework.get('score')}`;
    });
  }
}
```

## Architecture Benefits

### 1. Maintainability
- **Single Responsibility**: Each module has a focused purpose
- **Separation of Concerns**: Clear boundaries between functionality
- **Easier Debugging**: Issues can be isolated to specific modules
- **Code Organization**: Logical structure makes navigation easier

### 2. Testability
- **Unit Testing**: Modules can be tested independently
- **Mocking**: Easy to mock dependencies between modules
- **Focused Tests**: Tests can target specific functionality
- **Better Coverage**: Smaller modules are easier to test thoroughly

### 3. Extensibility
- **Module Enhancement**: Add features to specific modules without affecting others
- **New Modules**: Easy to add new modules for additional functionality
- **Plugin Architecture**: Modules can be extended or replaced
- **Future-Proof**: Architecture supports growth and changes

### 4. Performance
- **Selective Loading**: Only load needed modules
- **Optimized Delegation**: Minimal overhead in method calls
- **Caching**: Built-in caching at multiple levels
- **Monitoring**: Performance tracking helps identify bottlenecks

## File Structure
```
src/framework/
├── framework.js              # Main Framework class (delegation layer)
├── modules/
│   ├── index.js             # Module exports
│   ├── StateManager.js      # State management
│   ├── EventManager.js      # Event handling
│   ├── PerformanceMonitor.js # Performance tracking
│   ├── SelectiveRenderer.js # Rendering optimization
│   ├── GameLoop.js          # Game loop management
│   ├── Router.js            # Client-side routing
│   └── VirtualDOM.js        # Virtual DOM (future)
```

## Migration Guide

### Backward Compatibility
The refactored Framework maintains 100% backward compatibility with existing code:

```javascript
// All existing code continues to work unchanged
const framework = new Framework();

// These calls work exactly as before
framework.setState({ count: 0 });
framework.click('.button', handler);
framework.startGameLoop(callback);
framework.getPerformanceMetrics();
```

### No Breaking Changes
- **API Preservation**: All public methods remain unchanged
- **Property Access**: Legacy property access still works via getters
- **Event Handling**: Existing event handlers continue to function
- **State Management**: State operations work identically

### Gradual Migration
While not required, you can gradually adopt the modular approach:

```javascript
// Option 1: Continue using Framework as before
framework.setState({ data: value });

// Option 2: Access modules directly for advanced usage
framework.stateManager.setState({ data: value });
framework.performanceMonitor.incrementCounter('actions');
```

## Performance Features

### Selective Rendering
The Framework includes a sophisticated selective rendering system:

```javascript
// Mark specific elements as dirty
framework.markElementDirty('player-health', playerHealth);

// Batch process dirty elements
framework.processDirtyElements();

// Conditional rendering
const healthBar = framework.when(player.health > 0,
  `<div class="health-bar" style="width: ${player.health}%"></div>`
);
```

### Element Caching
Automatic DOM element caching for performance:

```javascript
// Elements are automatically cached on first access
const element = framework.getCachedElement('game-board');

// Manual caching for frequently accessed elements
framework.cacheElement('ui-panel', document.getElementById('ui-panel'));
```

### Performance Monitoring
Comprehensive performance tracking:

```javascript
// Built-in metrics
const metrics = framework.getPerformanceMetrics();
console.log(`FPS: ${metrics.fps}`);
console.log(`Frame Time: ${metrics.frameTime}ms`);
console.log(`Dropped Frames: ${metrics.droppedFrames}`);

// Custom counters
framework.incrementCounter('player-moves');
framework.incrementCounter('enemies-spawned');
const stats = framework.getAllCounters();
```

### Render Queue Management
Automatic render queue processing with time budgets:

```javascript
// Renders are automatically batched and processed
// with 8ms time budgets to maintain 60fps
framework.updateElement('score', element => {
  element.textContent = `Score: ${score}`;
});
```

### Memory Management
Automatic cleanup and cache management:

```javascript
// Clear all caches when needed
framework.clearAllCaches();

// Automatic cleanup of removed elements
// Elements are automatically removed from cache when no longer in DOM
```

## Best Practices

### 1. State Management
```javascript
// Use specific state methods for better performance
framework.set('score', newScore);  // Better than setState for single values
framework.push('items', newItem);  // Better than setState for arrays
```

### 2. Event Handling
```javascript
// Use event delegation for dynamic content
framework.click('.dynamic-button', handler);  // Works for future buttons

// Clean up event listeners when needed
framework.off('click', '.button', handler);
```

### 3. Performance Optimization
```javascript
// Cache frequently accessed elements
framework.cacheElement('game-board', gameBoard);

// Use selective rendering for dynamic content
framework.markElementDirty('player-position', player);

// Monitor performance in development
framework.onPerformanceUpdate(metrics => {
  if (metrics.fps < 30) console.warn('Performance issue detected');
});
```

### 4. Module Usage
```javascript
// Access modules directly for advanced features
const stateManager = framework.stateManager;
const performanceMonitor = framework.performanceMonitor;

// Use the unified API for common operations
framework.setState({ data: value });  // Recommended
```

## Conclusion

The refactored Framework provides a powerful, modular foundation for building high-performance interactive applications. Its architecture promotes maintainable code while preserving all existing functionality and performance optimizations. The modular design makes it easy to extend and customize for specific needs while maintaining excellent performance characteristics.
