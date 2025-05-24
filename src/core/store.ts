import { useState, useSelect } from "./hooks";
import {
  BaseStore,
  Listener,
  Store,
  StoreWithActions,
  AnyRecord,
} from "../utils/types";

/**
 * Creates a basic store with state management capabilities
 */
const createBaseStore = <TState>(initialState: TState): BaseStore<TState> => {
  let state = initialState;
  const listeners = new Set<Listener<TState>>();

  return {
    get: () => state,
    getInitial: () => initialState,
    set: (action) => {
      state =
        typeof action === "function"
          ? (action as (prev: TState) => TState)(state)
          : action;
      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
};

/**
 * Creates a new reactive store with the given initial state.
 *
 * This store provides state subscription and update capabilities, and can optionally be extended
 * with custom actions using the `withActions` method.
 *
 * @template TState - The shape of the store's state.
 *
 * @param {TState} initialState - The initial state that the store will manage.
 *
 * @returns {Store<TState>} - A store object with hooks for accessing and updating state,
 * and a `withActions` method to enhance the store with custom actions.
 *
 * @example
 * const useCounterStore = create({ count: 0 });
 * const [count, setCount] = useExtendedStore();
 * setCount(prev => ({ count: prev.count + 1 }));
 *
 * const useExtendedStore = useExtendedStore.withActions(store => ({
 *   increment: () => store.set(prev => ({ count: prev.count + 1 })),
 * }));
 */
export const create = <TState>(initialState: TState): Store<TState> => {
  const base = createBaseStore(initialState);
  const store = (() => useState(store)) as Store<TState>;

  Object.assign(store, base, {
    /**
     * Enhances the store by attaching custom action methods that can use and modify the store's state.
     *
     * @template TActions - The shape of the custom actions object.
     *
     * @param {(store: BaseStore<TState>) => TActions} createActions - A function that receives the base store and returns an object containing action methods.
     *
     * @returns {StoreWithActions<TState & {}, TActions>} - The store extended with typed actions alongside state access and management utilities.
     *
     * @example
     * const useExtendedStore = store.withActions(store => ({
     *   increment: () => store.set(prev => ({ count: prev.count + 1 })),
     * }));
     *
     * const { count, increment } = useExtendedStore();
     * increment();
     */
    withActions: <TActions extends AnyRecord>(
      createActions: (store: BaseStore<TState>) => TActions
    ) => {
      const actions = createActions(base);
      const extendedStore = ((selector) =>
        useSelect(extendedStore, selector)) as StoreWithActions<
        TState & {},
        TActions
      >;

      return Object.assign(extendedStore, base, {
        getActions: () => actions,
      });
    },
  });

  return store;
};
