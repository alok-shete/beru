// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * A type alias for `any`, used to represent any value.
 * 
 * @deprecated Use specific types wherever possible to maintain type safety.
 */
type ANY = any;

/**
 * A record type where the keys are strings and the values can be any type.
 */
type AnyRecord = Record<string, ANY>;

/**
 * Type for an updater function or a direct value.
 * 
 * If a function is provided, it will receive the previous state and return the new state.
 * If a value is provided, it will directly set the new state.
 * 
 * @example
 * const setState: Updater<number> = 5;  // Direct value
 * const setState: Updater<number> = (prev) => prev + 1;  // Function
 */
type Updater<T> = T | ((prev: T) => T);

/**
 * A listener function type that is called when the state changes.
 * 
 * @param state - The new state of the store.
 */
type Listener<T> = (state: T) => void;

/**
 * A selector function type that selects a part of the state.
 * 
 * @param state - The full state of the store.
 * @returns The selected part of the state.
 */
type Selector<TState, TSelected> = (state: TState) => TSelected;

/**
 * A base store interface that provides basic store operations.
 */
interface BaseStore<TState> {
  /**
   * Returns the current state of the store.
   * 
   * @returns The current state of the store.
   */
  get: () => TState;

  /**
   * Returns the initial state of the store.
   * 
   * @returns The initial state of the store.
   */
  getInitialState: () => TState;

  /**
   * Updates the state with the provided action (value or function).
   * 
   * @param action - The value or function to update the state.
   */
  set: (action: Updater<TState>) => void;

  /**
   * Selects a specific part of the state using the provided selector.
   * 
   * @param selector - The function used to select a part of the state.
   * @returns The selected part of the state.
   */
  select: <TSelected>(selector: Selector<TState, TSelected>) => TSelected;

  /**
   * Subscribes to state changes and calls the listener when the state changes.
   * Returns a function to unsubscribe from state changes.
   * 
   * @param listener - The function to call when the state changes.
   * @returns A function to unsubscribe from state changes.
   */
  subscribe: (listener: Listener<TState>) => () => void;
}

/**
 * Store interface that extends `BaseStore` and adds functionality for React hooks.
 */
interface Store<TState> extends BaseStore<TState> {
  /**
   * A hook for accessing and updating the state.
   * It returns the current state and a function to update it.
   * 
   * @returns A tuple containing the current state and a setter function.
   */
  <S = TState>(): [S, (value: React.SetStateAction<TState>) => void];

  /**
   * Adds actions to the store by wrapping the store and providing a set of actions.
   * 
   * @param createActions - A function that defines actions to add to the store.
   * @returns A store with actions added.
   */
  withActions: <TActions extends AnyRecord>(
    createActions: (store: Store<TState>) => TActions
  ) => StoreWithActions<TState & {}, TActions>;
}

/**
 * A hook interface for accessing and selecting state from the store.
 */
interface StoreHook<TState> {
  /**
   * Accesses the entire state of the store.
   * 
   * @returns The entire state of the store.
   */
  <S = TState>(): S;

  /**
   * Accesses a specific part of the state using a selector function.
   * 
   * @param selector - A function that extracts part of the state.
   * @returns The selected part of the state.
   */
  <S = TState>(selector: (state: TState) => S): S;
}

/**
 * Store with actions interface that extends `BaseStore` and `StoreHook`.
 * It provides actions and selectors to manipulate and select state.
 */
interface StoreWithActions<TState extends AnyRecord, TActions extends AnyRecord>
  extends Omit<BaseStore<TState>, "select">,
    StoreHook<TState & TActions> {
  /**
   * Selects a part of the state, including actions if provided.
   * Optionally accepts a selector to define what part of the state to select.
   * 
   * @param selector - (Optional) A function to select part of the state.
   * @returns The selected part of the state, including actions.
   */
  select: <TSelected = TState & TActions>(
    selector?: Selector<TState & TActions, TSelected>
  ) => TSelected;

  /**
   * Returns the actions for the store.
   * 
   * @returns The actions defined for the store.
   */
  getActions: () => TActions;
}

/**
 * Interface for storage providers, which can handle `get`, `set`, and `remove` operations.
 * This is used for persisting state.
 */
export type StorageInterface = {
  /**
   * Gets the stored value for a given key.
   * 
   * @param name - The key for the stored item.
   * @returns The stored value, or `null` if not found.
   */
  getItem: (name: string) => Promise<string | null> | string | null;

  /**
   * Sets a value for a given key.
   * 
   * @param name - The key for the item to store.
   * @param value - The value to store.
   */
  setItem: (name: string, value: string) => Promise<void> | void;

  /**
   * Removes the stored value for a given key.
   * 
   * @param name - The key of the item to remove.
   */
  removeItem: (name: string) => Promise<void> | void;
} & Record<string, ANY>;

/**
 * A storage provider can be either a `StorageInterface` or a function returning a `StorageInterface`.
 */
type StorageProvider = StorageInterface | (() => StorageInterface);

/**
 * Configuration options for persisting the store state.
 */
export interface PersistConfig<T> {
  /**
   * The key used for storing the state.
   * 
   * @example
   * const config = { key: 'userStore' }
   */
  key: string;

  /**
   * Optional debounce time (in milliseconds) for persistence actions.
   * Delays storage updates to avoid frequent writes.
   * 
   * @default 0
   */
  debounceTime?: number;

  /**
   * Optional version number for persistence, used for migration.
   * The version is used to determine if a migration is needed for the state.
   * 
   * @default 1
   */
  version?: number;

  /**
   * A migration function to transform the stored value based on the version.
   * 
   * @param storedValue - The previous state value to migrate.
   * @param version - The version number of the persisted data.
   * @returns The transformed state value.
   */
  migrate?: (storedValue: Partial<T> | T, version?: number) => Partial<T>;

  /**
   * A function to partially select which state to persist.
   * 
   * @param state - The state of the store.
   * @returns The partial state to persist.
   */
  partial?: (state: T) => Partial<T> | T;

  /**
   * A function to merge the initial value with the stored value.
   * 
   * @param initialValue - The initial value of the state.
   * @param storedValue - The stored value to merge with.
   * @returns The merged state value.
   */
  merge?: (initialValue: T, storedValue: Partial<T>) => T;

  /**
   * A storage provider to persist the state (defaults to `localStorage`).
   * 
   * @default localStorage
   */
  storage?: StorageProvider;

  /**
   * A function to serialize the store value before persisting it.
   * 
   * @param storeValue - The value of the store to serialize.
   * @returns The serialized value.
   */
  serialize?: <R = string>(storeValue: { state: T; version: number }) => R;

  /**
   * A function to deserialize the persisted value back into the state.
   * 
   * @param persisted - The persisted value to deserialize.
   * @returns The deserialized state.
   */
  deserialize?: <R = string>(
    persisted: R
  ) => Partial<{ state: T; version: number }>;

  /**
   * Whether to skip hydration (state loading from storage).
   * 
   * @default false
   */
  skipHydrate?: boolean;

  /**
   * A callback function for handling errors during persistence operations.
   * 
   * @param type - The type of error (storage, migration, persistence, or clear).
   * @param error - The error that occurred.
   */
  onError?: (
    type: "storage" | "migration" | "persistence" | "clear",
    error: unknown
  ) => void;
}

/**
 * A persistent store extends the base store with additional methods for hydration, disposal, and clearing.
 */
type PersistentStore<S> = S & {
  /**
   * Hydrates the store with persisted data.
   * 
   * @returns A promise if the hydration process is asynchronous.
   */
  hydrate: () => void | Promise<void>;

  /**
   * Disposes of the store, cleaning up any resources.
   */
  dispose: () => void;

  /**
   * Clears the persisted state.
   * 
   * @returns A promise that resolves when the state is cleared.
   */
  clear: () => Promise<void>;
};


export type {
  Listener,
  Selector,
  Updater,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
  ANY,
  PersistentStore,
};
