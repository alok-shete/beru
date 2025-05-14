import { useState } from "./useState";
import { useSelect } from "./useSelect";
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
    getInitialState: () => initialState,
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
 * Creates a new store with a given initial state and provides the capability to extend it with custom actions.
 *
 * @template TState - The type representing the shape of the initial state.
 * @param {TState} initialState - The initial state of the store. This is the default state that will be managed and updated within the store.
 * @returns {Store<TState>} - A store object that contains state management utilities and an optional method to extend the store with actions.
 */
export const create = <TState>(initialState: TState): Store<TState> => {
  const base = createBaseStore(initialState);
  const store = (() => useState(store)) as Store<TState>;

  Object.assign(store, base, {
    /**
     * Extends the store with custom actions, allowing the store to be enhanced with new functionality.
     *
     * @template TActions - The type representing the actions to be added to the store.
     * @param {function} createActions - A function that takes the store as an argument and returns an object of actions.
     * @returns {StoreWithActions<TState & {}, TActions>} - The extended store with both state management and actions.
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
