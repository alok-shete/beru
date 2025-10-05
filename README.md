# Beru

[![Build Size](https://img.shields.io/bundlephobia/minzip/beru?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=beru)
[![Version](https://img.shields.io/npm/v/beru?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/beru)
[![Downloads](https://img.shields.io/npm/dm/beru.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/beru)
[![Release NPM Package](https://img.shields.io/github/actions/workflow/status/alok-shete/beru/release.yml?label=Release%20NPM%20Package&style=flat&colorA=000000&colorB=000000)](https://github.com/alok-shete/beru/actions/workflows/release.yml)

Beru is a small, simple, and type-safe state management solution for React and React Native. It offers efficient data persistence and seamless integration with various storage mechanisms. Designed to be lightweight and intuitive, Beru helps developers manage application state with ease and confidence.

---

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Advanced Examples](#advanced-examples)
5. [Persistence & Storage](#persistence--storage)
6. [Migration Guide](#migration-guide)
7. [API Reference](#api-reference)
8. [Contributing](#contributing)
9. [Support](#support)
10. [License](#license)

---

## Features

- **Simple API:** Straightforward and intuitive for quick setup and easy state management
- **Type-safe:** Leverages TypeScript to ensure reliable and error-resistant code
- **Minimal Bundle Size:** Optimized for performance with a tiny footprint
- **No Dependencies:** Zero external dependencies for maximum compatibility
- **Selector Support:** Efficient component re-renders by subscribing only to needed state
- **Custom Equality:** Control re-renders with custom equality comparisons for complex state
- **Action Creators:** Organize state updates with custom action functions
- **Persistence:** Optional state persistence with flexible storage options
- **React & React Native:** Works seamlessly in all React environments
- **useState-like API:** Supports callback functions for state updates, just like React's useState

---

## Installation

Install Beru using npm or yarn:

```bash
npm install beru
# or
yarn add beru
```

---

## Basic Usage

### Minimal Example

```tsx
import { create } from 'beru';

// Create a simple boolean store
export const useDarkTheme = create(true);

const ThemeComponent = () => {
  const [isDark, setDark] = useDarkTheme();
  
  return (
    <div>
      <p>Current Theme: {isDark ? 'Dark' : 'Light'}</p>
      <button onClick={() => setDark(true)}>DARK</button>
      <button onClick={() => setDark(false)}>LIGHT</button>
      {/* Toggle using callback - just like useState! */}
      <button onClick={() => setDark(prev => !prev)}>TOGGLE</button>
    </div>
  );
};
```

### Store with Actions

```tsx
import { create } from 'beru';

export const useCount = create({ count: 0 }).withActions(({ set, get }) => ({
  // Using callback for updates based on previous state
  // No need to spread since we're replacing the entire state object
  increment: () => set(prev => ({ count: prev.count + 1 })),
  
  incrementByAmount: (amount) => set(prev => ({ count: prev.count + amount })),
  
  decrement: () => set(prev => ({ count: prev.count - 1 })),
  
  // Direct reset
  reset: () => set({ count: 0 }),
}));

const Counter = () => {
  const { count, increment, decrement, incrementByAmount, reset } = useCount();
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
      <button onClick={decrement}>Decrement</button>
      <button onClick={() => incrementByAmount(5)}>Add 5</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
};
```

### Using Selectors

```tsx
// Subscribe to specific state
const count = useCount(state => state.count);

// Subscribe to actions
const { increment } = useCount(state => ({ increment: state.increment }));

// Component using a selector (prevents unnecessary re-renders)
const CountDisplayComponent = () => {
  const count = useCount((state) => state.count);
  return <p>Count: {count}</p>;
};
```

---

## Advanced Examples

### Combining Multiple Stores

```tsx
import React from 'react';
import { create } from 'beru';

// User store with callback updates
const useUser = create({ name: '', email: '' }).withActions(({ set }) => ({
  // Direct update (full state replacement)
  updateUser: (user) => set(user),
  
  // Using callback to preserve other state
  updateName: (name) => set(prev => ({ ...prev, name })),
  
  updateEmail: (email) => set(prev => ({ ...prev, email })),
  
  // Direct reset (full state replacement)
  clearUser: () => set({ name: '', email: '' }),
}));

// Authentication store
const useAuth = create({ isLoggedIn: false, token: null }).withActions(({ set }) => ({
  login: (token) => set({ isLoggedIn: true, token }),
  logout: () => set({ isLoggedIn: false, token: null }),
}));

// Profile component using multiple stores
const ProfileComponent = () => {
  const { name, email, updateName, updateEmail } = useUser();
  const { isLoggedIn, logout } = useAuth();

  if (!isLoggedIn) {
    return <p>Please log in to view your profile</p>;
  }

  return (
    <div>
      <h2>User Profile</h2>
      <input 
        value={name} 
        onChange={(e) => updateName(e.target.value)} 
        placeholder="Name"
      />
      <input 
        value={email} 
        onChange={(e) => updateEmail(e.target.value)} 
        placeholder="Email"
      />
      <button onClick={logout}>Logout</button>
    </div>
  );
};
```

### Async Actions with Callbacks

```tsx
const useTodos = create({ todos: [], loading: false, error: null })
  .withActions(({ set }) => ({
    fetchTodos: async () => {
      set(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await fetch('https://api.example.com/todos');
        const todos = await response.json();
        set(prev => ({ ...prev, todos, loading: false }));
      } catch (error) {
        set(prev => ({ ...prev, error: error.message, loading: false }));
      }
    },
    
    addTodo: async (title) => {
      set(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await fetch('https://api.example.com/todos', {
          method: 'POST',
          body: JSON.stringify({ title, completed: false }),
          headers: { 'Content-Type': 'application/json' },
        });
        const newTodo = await response.json();
        
        // Using callback pattern - ideal for state that depends on previous state
        set(prev => ({ 
          ...prev,
          todos: [...prev.todos, newTodo], 
          loading: false 
        }));
      } catch (error) {
        set(prev => ({ ...prev, error: error.message, loading: false }));
      }
    },
    
    toggleTodo: (id) => {
      // Callback pattern ensures we work with latest state
      set(prev => ({
        ...prev,
        todos: prev.todos.map(todo => 
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      }));
    },
    
    removeTodo: (id) => {
      // Using callback to filter based on current state
      set(prev => ({
        ...prev,
        todos: prev.todos.filter(todo => todo.id !== id)
      }));
    },
    
    updateTodo: (id, updates) => {
      // Callback ensures consistent state updates
      set(prev => ({
        ...prev,
        todos: prev.todos.map(todo =>
          todo.id === id ? { ...todo, ...updates } : todo
        )
      }));
    }
  }));

// Usage in component
const TodoList = () => {
  const { todos, loading, addTodo, toggleTodo, removeTodo } = useTodos();
  const [newTodoTitle, setNewTodoTitle] = React.useState('');

  const handleAdd = async () => {
    if (newTodoTitle.trim()) {
      await addTodo(newTodoTitle);
      setNewTodoTitle('');
    }
  };

  return (
    <div>
      <input 
        value={newTodoTitle}
        onChange={(e) => setNewTodoTitle(e.target.value)}
        placeholder="New todo"
      />
      <button onClick={handleAdd} disabled={loading}>Add</button>
      
      {todos.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
          />
          <span>{todo.title}</span>
          <button onClick={() => removeTodo(todo.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
};
```

### Complex State Management with Callbacks

```tsx
const useCart = create({ items: [], total: 0 }).withActions(({ set }) => ({
  addItem: (item) => {
    // Callback pattern for calculating new state based on previous state
    set(prev => {
      const existingItem = prev.items.find(i => i.id === item.id);
      
      if (existingItem) {
        // Update quantity if item exists
        return {
          ...prev,
          items: prev.items.map(i =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
          total: prev.total + item.price
        };
      } else {
        // Add new item
        return {
          ...prev,
          items: [...prev.items, { ...item, quantity: 1 }],
          total: prev.total + item.price
        };
      }
    });
  },
  
  removeItem: (itemId) => {
    set(prev => {
      const item = prev.items.find(i => i.id === itemId);
      if (!item) return prev;
      
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
        total: prev.total - (item.price * item.quantity)
      };
    });
  },
  
  updateQuantity: (itemId, quantity) => {
    set(prev => {
      const item = prev.items.find(i => i.id === itemId);
      if (!item) return prev;
      
      const quantityDiff = quantity - item.quantity;
      
      return {
        ...prev,
        items: prev.items.map(i =>
          i.id === itemId ? { ...i, quantity } : i
        ),
        total: prev.total + (item.price * quantityDiff)
      };
    });
  },
  
  clearCart: () => set({ items: [], total: 0 }),
}));
```

### Custom Equality Comparison

```tsx
// Basic usage with custom equality
const count = useCount(
  (state) => state.count,
  (a, b) => a === b
);

// Deep comparison for complex objects
const user = useStore(
  (state) => state.user,
  (prevUser, nextUser) => {
    return prevUser.id === nextUser.id && 
           prevUser.name === nextUser.name &&
           prevUser.email === nextUser.email;
  }
);

// Custom comparison for filtered results
const filteredItems = useStore(
  (state) => state.items.filter(item => item.isActive),
  (prevItems, nextItems) => {
    if (prevItems.length !== nextItems.length) return false;
    return prevItems.every((item, index) => item.id === nextItems[index].id);
  }
);
```

---

## Persistence & Storage

Beru supports state persistence for both web and React Native. By default, `localStorage` is used in browsers. For React Native, use a compatible storage (e.g., `@react-native-async-storage/async-storage`).

### Basic Persistence

```tsx
import { create } from 'beru';
import { persist } from 'beru/persistence';

const useSettings = persist(
  create({ theme: 'light', fontSize: 14 }).withActions(({ set }) => ({
    // Using callback for theme toggle
    toggleTheme: () => set(prev => ({ 
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light' 
    })),
    
    // Direct update for single property
    setTheme: (theme) => set(prev => ({ ...prev, theme })),
    
    // Callback for incremental changes
    increaseFontSize: () => set(prev => ({ 
      ...prev,
      fontSize: prev.fontSize + 1 
    })),
    
    decreaseFontSize: () => set(prev => ({ 
      ...prev,
      fontSize: prev.fontSize - 1 
    })),
  })),
  {
    name: 'settings',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
  }
);
```

### Advanced Persistence Configuration

```tsx
import { persist } from 'beru/persistence';

const persistentStore = persist(yourStore, {
  // Required
  name: 'storage-key', // Unique identifier for storage
  
  // Optional with defaults
  debounceTime: 100, // Debounce time for writes (ms)
  version: 1, // State version for migrations
  storage: localStorage, // Storage provider (defaults to localStorage)
  
  // Optional transformation functions
  serialize: JSON.stringify, // Custom serialization
  deserialize: JSON.parse, // Custom deserialization
  
  // Optional state handling
  partial: (state) => state, // Select which parts to persist
  merge: (initialState, persistedState) => ({ ...initialState, ...persistedState }),
  migrate: (storedState, storedVersion) => {
    // Migration logic based on version
    if (storedVersion === 1) {
      return storedState;
    }
    return null; // Return null to use initial state instead
  },
  
  // Other options
  skipHydrate: false, // Skip initial hydration
  onError: (type, error) => console.error(`${type} error:`, error),
});
```

### Multiple Persistent Stores

```tsx
import { create } from 'beru';
import { persist, setupHydrator } from 'beru/persistence';

// Create persistent stores with callback updates
const useSettings = persist(
  create({ theme: 'light', fontSize: 16, notifications: true }).withActions(({ set }) => ({
    toggleTheme: () => set(prev => ({ 
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light' 
    })),
    updateFontSize: (size) => set(prev => ({ ...prev, fontSize: size })),
    toggleNotifications: () => set(prev => ({ 
      ...prev,
      notifications: !prev.notifications 
    })),
  })),
  { name: 'app-settings', version: 1, storage: localStorage }
);

const useUserPrefs = persist(
  create({ language: 'en', currency: 'USD' }).withActions(({ set }) => ({
    setLanguage: (language) => set(prev => ({ ...prev, language })),
    setCurrency: (currency) => set(prev => ({ ...prev, currency })),
  })),
  { name: 'user-preferences', version: 1 }
);

// Setup hydration for both stores
const hydrateStores = setupHydrator([useSettings, useUserPrefs]);

// Use in your app's entry point
const App = () => {
  React.useEffect(() => {
    hydrateStores();
  }, []);
  
  // Your app components...
};
```

### Persistent Store Methods

```tsx
// Manually hydrate state from storage
await persistentStore.hydrate();

// Clear persisted state
await persistentStore.clear();

// Unsubscribe from persistence
persistentStore.dispose();
```

---

## Migration Guide

### From Zustand

**Zustand:**
```tsx
import create from 'zustand';

const useStore = create(set => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 })),
}));
```

**Beru:**
```tsx
import { create } from 'beru';

export const useCount = create({ count: 0 }).withActions(({ set }) => ({
  // Beru supports callback pattern just like Zustand!
  // No spread needed - single property store
  increment: () => set(prev => ({ count: prev.count + 1 })),
}));
```

### From Redux

**Redux:**
```tsx
// actions.js
export const increment = () => ({ type: 'INCREMENT' });

// reducer.js
const initialState = { count: 0 };
export default function reducer(state = initialState, action) {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    default:
      return state;
  }
}
```

**Beru:**
```tsx
import { create } from 'beru';

export const useCount = create({ count: 0 }).withActions(({ set }) => ({
  // Use callback to access previous state
  // No spread needed - single property store
  increment: () => set(prev => ({ count: prev.count + 1 })),
}));
```

### From useState

**useState:**
```tsx
const [count, setCount] = useState(0);

// Direct update
setCount(5);

// Callback update
setCount(prev => prev + 1);
```

**Beru:**
```tsx
const useCount = create(0);

// In component
const [count, setCount] = useCount();

// Direct update - works the same!
setCount(5);

// Callback update - works the same!
setCount(prev => prev + 1);
```

---

## API Reference

### `create(initialState)`

Creates a new store with the provided initial state.

```tsx
const useStore = create(initialState);
```

### `withActions(actionsCreator)`

Adds actions to the store for updating state. The `set` function supports both direct updates and callback updates.

```tsx
const useStore = create(initialState).withActions(({ set, get }) => ({
  // Direct object update (replaces entire state)
  action1: (payload) => set({ value: payload }),
  
  // Callback update with single property (no spread needed)
  action2: () => set(prev => ({ value: prev.value + 1 })),
  
  // Callback with multiple properties (spread needed to preserve other properties)
  action3: (amount) => set(prev => {
    const newValue = prev.value + amount;
    return { ...prev, value: newValue, lastUpdate: Date.now() };
  }),
}));
```

### State Updates

Beru provides two ways to update state, just like React's `useState`:

1. **Direct updates:**
```tsx
// For primitive values
set(10);

// For objects
set({ count: 10, name: 'John' });
```

2. **Callback updates** (when new state depends on previous state):
```tsx
// For primitive values
set(prev => prev + 1);

// For single-property objects (no spread needed)
set(prev => ({ count: prev.count + 1 }));

// For multi-property objects (spread needed to preserve other properties)
set(prev => ({ ...prev, count: prev.count + 1 }));
```

**Important:** 
- If your store has only **one property**, you don't need to spread: `set(prev => ({ count: prev.count + 1 }))`
- If your store has **multiple properties** and you want to update only some, spread the previous state: `set(prev => ({ ...prev, count: prev.count + 1 }))`
- If you want to **replace the entire state**, don't spread: `set({ count: 0, name: '' })`

The callback pattern is recommended when:
- Your new state depends on the previous state
- You're updating state in async operations
- You want to ensure you're working with the latest state

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

### `persist(store, config)`

Enhances a store with persistence capabilities.

```tsx
import { persist } from 'beru/persistence';

const persistentStore = persist(store, {
  name: 'unique-storage-key',
  // ...other options
});
```

### `setupHydrator(persistentStores)`

Creates a function that hydrates multiple persistent stores at once.

```tsx
import { setupHydrator } from 'beru/persistence';

const hydrateStores = setupHydrator([store1, store2, store3]);

// Call in your app's entry point
hydrateStores();
```

---

## Contributing

We welcome contributions from the community! If you encounter any issues or have suggestions for improvement, please feel free to [open an issue](https://github.com/alok-shete/beru/issues) or submit a pull request on the [Beru GitHub repository](https://github.com/alok-shete/beru).

To set up locally:

```bash
git clone https://github.com/alok-shete/beru.git
cd beru
npm install
npm test
```

---

## Support

If you find Beru helpful, consider supporting its development:

[!["Buy Me A Coffee"](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/shetealok)

Your support helps maintain and improve Beru for the entire community.

---

## License

This project is licensed under the [MIT License](https://github.com/alok-shete/beru/blob/main/LICENSE).

Made with ❤️ by [Alok Shete](https://alokshete.com)