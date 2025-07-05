# Mini Framework - A Lightweight JavaScript Framework

A modern, lightweight JavaScript framework designed for building interactive web applications with a focus on simplicity, performance, and developer experience.

## 🚀 Features

- **Virtual DOM** with efficient diffing algorithm
- **Reactive State Management** with batched updates
- **Client-side Routing** with hash-based navigation
- **Event Delegation System** with intuitive API
- **Component-based Architecture** with functional components
- **Performance Optimized** with requestAnimationFrame batching
- **Developer Friendly** with chainable API and helpful utilities
- **Error Handling** with custom error pages
- **TypeScript Ready** (types can be added)

## 📦 Installation

Simply include the framework in your project:

```html
<script type="module" src="src/framework/framework.js"></script>
```

## 🏁 Quick Start

```javascript
import { Framework } from './framework/framework.js';

// Create a new framework instance
const app = Framework.create({
  initialState: {
    count: 0
  },
  routes: {
    '/': () => app.div({},
      app.h1({}, 'Hello World!'),
      app.p({}, `Count: ${app.get('count')}`),
      app.button({ class: 'increment' }, 'Increment')
    )
  }
});

// Add event handlers
app.click('.increment', () => {
  app.set('count', app.get('count') + 1, () => app.render());
});
```

## 📚 API Reference

### Framework Creation

#### `Framework.create(options)`
Creates a new framework instance with optional configuration.

```javascript
const app = Framework.create({
  initialState: {},      // Initial application state
  routes: {},           // Route definitions
  errorPage: null,      // Error page component
  autoStart: true       // Auto-start the application
});
```

#### `new Framework()`
Creates a new framework instance (manual setup required).

```javascript
const app = new Framework();
app.init(options);
```

### Element Creation

The framework provides shorthand methods for creating common HTML elements:

#### Basic Elements
```javascript
app.div(props, ...children)     // <div>
app.span(props, ...children)    // <span>
app.p(props, ...children)       // <p>
app.h1(props, ...children)      // <h1>
app.h2(props, ...children)      // <h2>
app.h3(props, ...children)      // <h3>
app.button(props, ...children)  // <button>
app.input(props)                // <input>
app.label(props, ...children)   // <label>
app.ul(props, ...children)      // <ul>
app.li(props, ...children)      // <li>
app.a(props, ...children)       // <a>
app.section(props, ...children) // <section>
app.header(props, ...children)  // <header>
app.footer(props, ...children)  // <footer>
```

#### Generic Element Creation
```javascript
app.createElement(tag, props, ...children)
```

**Example:**
```javascript
const todoItem = app.li(
  { class: 'todo-item', 'data-id': todo.id },
  app.input({ type: 'checkbox', checked: todo.completed }),
  app.label({}, todo.text),
  app.button({ class: 'delete' }, '×')
);
```

### State Management

#### Basic State Operations
```javascript
// Get entire state
const state = app.getState();

// Get specific property
const todos = app.get('todos');

// Set entire state
app.setState({ todos: [], filter: 'all' });

// Set specific property
app.set('filter', 'completed', callback);

// Merge object into state
app.merge('user', { name: 'John', age: 30 }, callback);
```

#### Array Operations
```javascript
// Add item to array
app.push('todos', newTodo, callback);

// Remove items from array
app.remove('todos', todo => todo.id !== deletedId, callback);

// Update item in array
app.updateItem('todos',
  todo => todo.id === targetId,
  todo => ({ ...todo, completed: !todo.completed }),
  callback
);
```

#### State Subscription
```javascript
// Subscribe to state changes
const unsubscribe = app.subscribe((newState) => {
  console.log('State changed:', newState);
});

// Unsubscribe
unsubscribe();
```

### Routing

#### Route Definition
```javascript
// Single route
app.route('/about', AboutComponent);

// Multiple routes
app.routes({
  '/': HomeComponent,
  '/about': AboutComponent,
  '/contact': ContactComponent
});
```

#### Navigation
```javascript
// Navigate to route
app.navigate('/about');

// Navigate with state
app.navigate('/user/123', { userId: 123 });

// Go back/forward
app.back();
app.forward();

// Get current route
const currentRoute = app.getCurrentRoute();

// Check current route
if (app.isRoute('/about')) {
  // Do something
}
```

#### Error Handling
```javascript
// Set error page component
app.setErrorPage((errorMessage) =>
  app.div({ class: 'error' },
    app.h1({}, 'Error'),
    app.p({}, errorMessage)
  )
);
```

### Event Handling

#### Event Delegation
```javascript
// Basic event handling
app.on('click', '.button', (event, target) => {
  console.log('Button clicked:', target);
});

// Remove event handler
app.off('click', '.button', handler);

// One-time event handler
app.once('click', '.button', handler);
```

#### Shorthand Event Methods
```javascript
app.click('.button', handler);
app.change('.input', handler);
app.input('.search', handler);
app.keydown('.input', handler);
app.keyup('.input', handler);
app.keypress('.input', handler);
app.submit('.form', handler);
app.focus('.input', handler);
app.blur('.input', handler);
```

#### Event Options
```javascript
// Event with options
app.on('click', '.button', handler, { once: true });
```

### Utility Methods

#### DOM Manipulation
```javascript
// Find elements
const element = app.find('.selector');
const elements = app.findAll('.selector');

// CSS classes
app.addClass('.element', 'active');
app.removeClass('.element', 'active');
app.toggleClass('.element', 'active');

// CSS styles
app.css('.element', 'color', 'red');
app.css('.element', { color: 'red', fontSize: '16px' });

// Show/hide elements
app.show('.element');
app.hide('.element');

// Focus and scroll
app.focusElement('.input');
app.scrollTo('.section');
```

#### Rendering
```javascript
// Render current route
app.render();

// Render to specific container
app.renderTo(container, component);

// Re-render current route
app.rerender();

// Render with Virtual DOM diffing (performance optimized)
app.renderWithDiff();
```

### Helper Methods

#### Conditional Rendering
```javascript
// Render element only if condition is true
app.when(condition, element);

// Example
app.when(user.isLoggedIn,
  app.div({}, 'Welcome back!')
);
```

#### List Rendering
```javascript
// Map array to elements
app.map(array, callback);

// Example
app.ul({},
  ...app.map(todos, todo =>
    app.li({ key: todo.id }, todo.text)
  )
);
```

## 🏗️ Architecture & Design Decisions

### Virtual DOM Implementation
The framework implements a lightweight Virtual DOM with efficient diffing:

- **Minimal overhead**: Only diffs when necessary
- **Smart updates**: Only updates changed properties and children
- **Performance batching**: Uses requestAnimationFrame for smooth updates

### State Management Philosophy
- **Immutable updates**: State changes create new state objects
- **Batched rendering**: Multiple state changes trigger single re-render
- **Predictable updates**: State changes are synchronous, rendering is async

### Event System Design
- **Event delegation**: Single event listener per event type
- **Memory efficient**: Automatic cleanup and management
- **Flexible targeting**: Supports both direct matches and closest ancestor matching

### Component Architecture
- **Functional components**: Simple functions that return virtual DOM
- **No lifecycle methods**: Simplified mental model
- **Props via closure**: Components access state through framework instance

## 💡 Examples

### Counter App
```javascript
const app = Framework.create({
  initialState: { count: 0 }
});

const CounterApp = () =>
  app.div({ class: 'counter' },
    app.h1({}, `Count: ${app.get('count')}`),
    app.button({ class: 'decrement' }, '-'),
    app.button({ class: 'increment' }, '+')
  );

app.routes({ '/': CounterApp })
   .click('.increment', () =>
     app.set('count', app.get('count') + 1, () => app.render())
   )
   .click('.decrement', () =>
     app.set('count', app.get('count') - 1, () => app.render())
   );
```

### Todo List
```javascript
const app = Framework.create({
  initialState: {
    todos: [],
    filter: 'all'
  }
});

const TodoApp = () => {
  const todos = app.get('todos');
  const filter = app.get('filter');

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return app.div({ class: 'todo-app' },
    app.input({
      class: 'new-todo',
      placeholder: 'What needs to be done?'
    }),
    app.ul({ class: 'todo-list' },
      ...app.map(filteredTodos, todo =>
        app.li({
          class: todo.completed ? 'completed' : '',
          'data-id': todo.id
        },
          app.input({
            type: 'checkbox',
            checked: todo.completed,
            class: 'toggle'
          }),
          app.label({}, todo.text),
          app.button({ class: 'destroy' }, '×')
        )
      )
    ),
    app.div({ class: 'filters' },
      app.button({
        class: filter === 'all' ? 'selected' : '',
        'data-filter': 'all'
      }, 'All'),
      app.button({
        class: filter === 'active' ? 'selected' : '',
        'data-filter': 'active'
      }, 'Active'),
      app.button({
        class: filter === 'completed' ? 'selected' : '',
        'data-filter': 'completed'
      }, 'Completed')
    )
  );
};

// Event handlers
app.routes({ '/': TodoApp })
   .keypress('.new-todo', (e) => {
     if (e.key === 'Enter' && e.target.value.trim()) {
       app.push('todos', {
         id: Date.now(),
         text: e.target.value.trim(),
         completed: false
       }, () => {
         e.target.value = '';
         app.render();
       });
     }
   })
   .click('.toggle', (e) => {
     const id = parseInt(e.target.closest('li').dataset.id);
     app.updateItem('todos',
       todo => todo.id === id,
       todo => ({ ...todo, completed: !todo.completed }),
       () => app.render()
     );
   })
   .click('.destroy', (e) => {
     const id = parseInt(e.target.closest('li').dataset.id);
     app.remove('todos',
       todo => todo.id !== id,
       () => app.render()
     );
   })
   .click('[data-filter]', (e) => {
     app.set('filter', e.target.dataset.filter, () => app.render());
   });
```

## 🎯 Best Practices

### Component Organization
```javascript
// Keep components pure and focused
const TodoItem = (todo) =>
  app.li({ class: todo.completed ? 'completed' : '' },
    app.input({ type: 'checkbox', checked: todo.completed }),
    app.label({}, todo.text)
  );

// Compose larger components from smaller ones
const TodoList = (todos) =>
  app.ul({ class: 'todo-list' },
    ...app.map(todos, TodoItem)
  );
```

### State Management
```javascript
// Use specific state operations for better performance
// ✅ Good
app.push('todos', newTodo, callback);

// ❌ Avoid
app.setState({ todos: [...app.get('todos'), newTodo] }, callback);

// Use callbacks for actions after state updates
app.set('loading', true, () => {
  fetchData().then(data => {
    app.set('data', data, () => {
      app.set('loading', false, () => app.render());
    });
  });
});
```

### Event Handling
```javascript
// Use event delegation for dynamic content
app.click('.todo-item .toggle', handler); // ✅ Good

// Avoid direct element binding
document.querySelector('.toggle').onclick = handler; // ❌ Avoid
```

### Performance Tips
```javascript
// Use renderWithDiff for better performance with large lists
app.renderWithDiff();

// Batch state updates when possible
app.setState({
  todos: newTodos,
  filter: newFilter,
  loading: false
}, () => app.render());

// Use keys for list items to help with diffing
app.map(items, item =>
  app.li({ key: item.id }, item.name)
);
```

## 🔧 Development

### Running the TodoMVC Example
```bash
npm install
npm run dev
```

Open http://localhost:3000 to see the TodoMVC implementation.

### Project Structure
```
mini-framework/
├── src/
│   ├── framework/
│   │   └── framework.js     # Core framework
│   ├── app/
│   │   └── todoApp.js       # TodoMVC implementation
│   └── styles/
│       └── todo.css         # Styles
├── index.html               # Entry point
├── package.json
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - feel free to use this framework in your projects!

## 🙏 Acknowledgments

- Inspired by modern frameworks like React and Vue
- TodoMVC specification for the example implementation
- The JavaScript community for best practices and patterns
```