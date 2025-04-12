# Beru

[![Build Size](https://img.shields.io/bundlephobia/minzip/beru?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=beru)
[![Version](https://img.shields.io/npm/v/beru?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/beru)
[![Downloads](https://img.shields.io/npm/dm/beru.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/beru)

Beru is a small, simple, and type-safe state management solution for React and React Native. Designed to be lightweight and intuitive, Beru helps developers manage application state with ease and confidence.

## Features

- **Simple API:** Straightforward and intuitive for quick setup and easy state management
- **Type-safe:** Leverages TypeScript to ensure reliable and error-resistant code
- **Minimal Bundle Size:** Optimized for performance with a tiny footprint
- **No Dependencies:** Zero external dependencies for maximum compatibility
- **Selector Support:** Efficient component re-renders by subscribing only to needed state
- **Action Creators:** Organize state updates with custom action functions
- **React & React Native:** Works seamlessly in all React environments

## Installation

Install Beru using npm:

```bash
npm install beru
```

Or using yarn:

```bash
yarn add beru
```

## Usage

### Store Example

```tsx
import React from 'react';
import { create } from 'beru';

// Create a new instance of the store with initial state and actions
export const useCount = create({ count: 0 }).withActions(({ set, get }) => ({
  // Using get() to access current state
  increment: () => set({ count: get().count + 1 }),
  decrement: () => set({ count: get().count - 1 }),
  
  // Alternatively, using a function that receives the current state
  incrementAlt: () => set((state) => ({ count: state.count + 1 })),
  decrementAlt: () => set((state) => ({ count: state.count - 1 })),
}));

// Component using the entire store
const CounterComponent = () => {
  const { count, decrement, increment } = useCount();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
      <button onClick={decrement}>Decrement</button>
    </div>
  );
};

// Component using a selector for state (prevents unnecessary re-renders)
const CountDisplayComponent = () => {
  const count = useCount((state) => state.count);
  return <p>Count: {count}</p>;
};

// Component using a selector for actions
const CountActionsComponent = () => {
  const { increment, decrement } = useCount((state) => ({
    increment: state.increment,
    decrement: state.decrement,
  }));

  return (
    <div>
      <button onClick={increment}>Increment</button>
      <button onClick={decrement}>Decrement</button>
    </div>
  );
};
```

### Simple State Example

```tsx
export const useDarkTheme = create(true);

const ThemeComponent = () => {
  const [isDark, setDark] = useDarkTheme();

  return (
    <div>
      <p>Current Theme: {isDark ? 'Dark' : 'Light'}</p>
      <button onClick={() => setDark(true)}>DARK</button>
      <button onClick={() => setDark(false)}>LIGHT</button>
      {/* Toggle using previous state */}
      <button onClick={() => setDark(prev => !prev)}>TOGGLE</button>
    </div>
  );
}
```

### Combining Multiple Stores

```tsx
import React from 'react';
import { create } from 'beru';

// User store
const useUser = create({ name: '', email: '' }).withActions(({ set }) => ({
  updateUser: (user) => set(user),
  clearUser: () => set({ name: '', email: '' }),
  // Using function update pattern
  updateName: (name) => set((state) => ({ ...state, name })),
}));

// Authentication store
const useAuth = create({ isLoggedIn: false, token: null }).withActions(({ set }) => ({
  login: (token) => set({ isLoggedIn: true, token }),
  logout: () => set({ isLoggedIn: false, token: null }),
}));

// Profile component using multiple stores
const ProfileComponent = () => {
  const { name, email } = useUser();
  const { isLoggedIn, logout } = useAuth();

  if (!isLoggedIn) {
    return <p>Please log in to view your profile</p>;
  }

  return (
    <div>
      <h2>User Profile</h2>
      <p>Name: {name}</p>
      <p>Email: {email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
};
```

### Async Actions

```tsx
const useTodos = create({ todos: [], loading: false, error: null })
  .withActions(({ set, get }) => ({
    fetchTodos: async () => {
      set({ loading: true, error: null });
      try {
        const response = await fetch('https://api.example.com/todos');
        const todos = await response.json();
        set({ todos, loading: false });
      } catch (error) {
        set({ error: error.message, loading: false });
      }
    },
    addTodo: async (title) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch('https://api.example.com/todos', {
          method: 'POST',
          body: JSON.stringify({ title, completed: false }),
          headers: { 'Content-Type': 'application/json' },
        });
        const newTodo = await response.json();
        
        // Using function update pattern with previous state
        set((state) => ({ 
          todos: [...state.todos, newTodo], 
          loading: false 
        }));
      } catch (error) {
        set({ error: error.message, loading: false });
      }
    },
    toggleTodo: async (id) => {
      // Function update pattern is ideal for updates based on current state
      set((state) => {
        const todo = state.todos.find(t => t.id === id);
        if (!todo) return state;
        
        return {
          ...state,
          todos: state.todos.map(t => 
            t.id === id ? { ...t, completed: !t.completed } : t
          )
        };
      });
    }
  }));
```

## API Reference

### `create(initialState)`

Creates a new store with the provided initial state.

```tsx
const useStore = create(initialState);
```

### `withActions(actionsCreator)`

Adds actions to the store for updating state.

```tsx
const useStore = create(initialState).withActions(({ set, get }) => ({
  // Set object directly
  action1: (payload) => set({ ...get(), ...payload }),
  
  // Set using function that receives previous state
  action2: () => set(prevState => ({ ...prevState, value: newValue })),
  
  // Set partial state (automatically merged)
  action3: (value) => set({ value })
}));
```

### State Updates

Beru provides two ways to update state:

1. Direct object updates:
```tsx
set({ count: 10 });
```

2. Function updates (when new state depends on previous state):
```tsx
set(state => ({ count: state.count + 1 }));
```

### Selectors

Use selectors to subscribe to specific parts of the state, preventing unnecessary re-renders.

```tsx
// Subscribe to the entire state
const state = useStore();

// Subscribe to a specific value
const value = useStore(state => state.value);

// Subscribe to multiple values
const { value1, value2 } = useStore(state => ({
  value1: state.value1,
  value2: state.value2
}));
```

## Contributing

We welcome contributions from the community! If you encounter any issues or have suggestions for improvement, please feel free to [open an issue](https://github.com/alok-shete/beru/issues) or submit a pull request on the [Beru GitHub repository](https://github.com/alok-shete/beru).

## Support

If you find Beru helpful, consider supporting its development:

[!["Buy Me A Coffee"](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/shetealok)

Your support helps maintain and improve Beru for the entire community.

## License

This project is licensed under the [MIT License](https://github.com/alok-shete/beru/blob/main/LICENSE).

---

Made with ❤️ by [Alok Shete](https://alokshete.com)