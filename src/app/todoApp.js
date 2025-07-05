import { Framework } from '../framework/framework.js';

// Create framework instance with enhanced API
const app = Framework.create({
  initialState: {
    todos: [],
    filter: 'all',
    editingId: null
  },
  autoStart: false // We'll start manually after setting up routes and events
});

// Error page component using enhanced API
const ErrorPage = (errorMessage = 'Something went wrong') => {
  return app.div({ class: 'error-page' },
    app.div({ class: 'error-container' },
      app.h1({}, 'Oops! Houston, we have a problem!'),
      app.p({ class: 'error-message' }, errorMessage),
      app.div({ class: 'error-actions' },
        app.button({ class: 'error-home-btn' }, 'Return to Mission Control'),
        app.button({ class: 'error-reload-btn' }, 'Restart Systems')
      )
    )
  );
};

// Set error page
app.setErrorPage(ErrorPage);

const TodoList = (todos, filter = 'all') => {
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return app.ul({ class: 'todo-list' },
    ...app.map(filteredTodos, todo =>
      app.li({
        class: `todo-item ${todo.completed ? 'completed' : ''} ${app.get('editingId') === todo.id ? 'editing' : ''}`,
        'data-id': todo.id
      },
        app.div({ class: 'view' },
          app.input({
            class: 'toggle',
            type: 'checkbox',
            checked: todo.completed
          }),
          app.label({ class: 'todo-label' }, todo.text),
          app.button({ class: 'destroy' })
        ),
        // Edit input (only shown when editing)
        ...app.when(app.get('editingId') === todo.id, [
          app.input({
            class: 'edit',
            type: 'text',
            value: todo.text
          })
        ])
      )
    )
  );
};

const TodoApp = () => {
  const state = app.getState();
  const currentFilter = getCurrentFilter();
  const hasCompletedTodos = state.todos.some(todo => todo.completed);
  const allCompleted = state.todos.length > 0 && state.todos.every(todo => todo.completed);

  // Dynamic text for toggle all button
  const toggleAllText = allCompleted ? 'Mark all as active' : 'Mark all as complete';

  return app.div({ class: 'todoapp' },
    app.header({ class: 'header' },
      app.h1({}, 'todos'),
      app.input({
        class: 'new-todo',
        placeholder: 'What needs to be done?',
        autofocus: true
      })
    ),
    app.when(state.todos.length > 0,
      app.section({ class: 'main' },
        app.input({
          id: 'toggle-all',
          class: 'toggle-all',
          type: 'checkbox',
          checked: allCompleted
        }),
        app.label({ for: 'toggle-all' }, toggleAllText),
        TodoList(state.todos, currentFilter)
      )
    ),
    app.when(state.todos.length > 0,
      app.footer({ class: 'footer' },
        app.span({ class: 'todo-count' }, getTodoCountText(state.todos)),
        app.ul({ class: 'filters' },
          app.li({},
            app.a({
              href: '#/',
              class: currentFilter === 'all' ? 'selected' : ''
            }, 'All')
          ),
          app.li({},
            app.a({
              href: '#/active',
              class: currentFilter === 'active' ? 'selected' : ''
            }, 'Active')
          ),
          app.li({},
            app.a({
              href: '#/completed',
              class: currentFilter === 'completed' ? 'selected' : ''
            }, 'Completed')
          )
        ),
        app.when(hasCompletedTodos,
          app.button({ class: 'clear-completed' }, 'Clear completed')
        )
      )
    )
  );
};

// Helper functions
const getCurrentFilter = () => {
  const hash = window.location.hash;
  if (hash === '#/active') return 'active';
  if (hash === '#/completed') return 'completed';
  return 'all';
};

const getTodoCountText = (todos) => {
  const count = todos.filter(todo => !todo.completed).length;
  return `${count} item${count !== 1 ? 's' : ''} left`;
};

// Set up routes
app.route('/', TodoApp);
app.route('/active', TodoApp);
app.route('/completed', TodoApp);

// Event handlers using enhanced framework API
const addTodo = (text) => {
  try {
    if (!text.trim()) return;
    app.push('todos', {
      id: Date.now(),
      text: text.trim(),
      completed: false
    }, () => app.render());
  } catch (error) {
    app.handleError(error);
  }
};

const toggleTodo = (id) => {
  try {
    app.updateItem('todos',
      todo => todo.id === parseInt(id),
      todo => ({ ...todo, completed: !todo.completed }),
      () => app.render()
    );
  } catch (error) {
    app.handleError(error);
  }
};

const deleteTodo = (id) => {
  try {
    app.remove('todos',
      todo => todo.id !== parseInt(id),
      () => app.render()
    );
  } catch (error) {
    app.handleError(error);
  }
};

const toggleAll = () => {
  try {
    const todos = app.get('todos');
    const allCompleted = todos.every(todo => todo.completed);
    app.set('todos',
      todos.map(todo => ({ ...todo, completed: !allCompleted })),
      () => app.render()
    );
  } catch (error) {
    app.handleError(error);
  }
};

const clearCompleted = () => {
  try {
    app.remove('todos',
      todo => !todo.completed,
      () => app.render()
    );
  } catch (error) {
    app.handleError(error);
  }
};

const startEditing = (id) => {
  try {
    app.set('editingId', parseInt(id), () => {
      app.render();
      // Focus the edit input after render
      setTimeout(() => {
        app.focusElement('.edit');
        const editInput = app.find('.edit');
        if (editInput) editInput.select();
      }, 0);
    });
  } catch (error) {
    app.handleError(error);
  }
};

const finishEditing = (id, newText) => {
  try {
    const trimmedText = newText.trim();

    if (trimmedText === '') {
      // Delete todo if text is empty
      deleteTodo(id);
    } else {
      // Update todo text and clear editing state
      app.updateItem('todos',
        todo => todo.id === parseInt(id),
        todo => ({ ...todo, text: trimmedText }),
        () => {
          app.set('editingId', null, () => app.render());
        }
      );
    }
  } catch (error) {
    app.handleError(error);
  }
};

const cancelEditing = () => {
  try {
    app.set('editingId', null, () => app.render());
  } catch (error) {
    app.handleError(error);
  }
};

// Set up routes and error page
app.setErrorPage(ErrorPage)
   .routes({
     '/': TodoApp,
     '/active': TodoApp,
     '/completed': TodoApp
   });

// Initialize app using framework methods
app.onReady(() => {
  try {
    // Set initial route based on hash
    const hash = window.location.hash;
    app.currentRoute = hash ? hash.substring(1) : '/';
    
    // Initial render
    app.render();

    // Handle hash changes using framework method
    app.onHashChange(() => {
      const hash = window.location.hash;
      app.currentRoute = hash ? hash.substring(1) : '/';
      app.render();
    });

    // Event listeners using framework methods
    app.on('keypress', '.new-todo', (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value.trim();
        if (text) {
          addTodo(text);
          e.target.value = '';
        }
      }
    });

    app.on('keydown', '.edit', (e) => {
      if (e.key === 'Enter') {
        const li = e.target.closest('li');
        if (li && li.dataset.id) {
          finishEditing(li.dataset.id, e.target.value);
        }
      } else if (e.key === 'Escape') {
        cancelEditing();
      }
    });

    app.on('blur', '.edit', (e) => {
      const li = e.target.closest('li');
      if (li && li.dataset.id) {
        finishEditing(li.dataset.id, e.target.value);
      }
    });

    app.on('click', '.toggle:not(.toggle-all)', (e) => {
      const li = e.target.closest('li');
      if (li && li.dataset.id) {
        toggleTodo(li.dataset.id);
      }
    });
    
    app.on('click', '.destroy', (e) => {
      const li = e.target.closest('li');
      if (li && li.dataset.id) {
        deleteTodo(li.dataset.id);
      }
    });
    
    app.on('click', '.toggle-all', () => {
      toggleAll();
    });

    app.on('click', '.clear-completed', () => {
      clearCompleted();
    });

    app.on('dblclick', '.todo-label', (e) => {
      const li = e.target.closest('li');
      if (li && li.dataset.id) {
        startEditing(li.dataset.id);
      }
    });
  } catch (error) {
    app.handleError(error);
  }
});

// Make app globally available for debugging
window.todoApp = app;