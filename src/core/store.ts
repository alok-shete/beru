import { useState } from "./useState";
import { useSelect } from "./useSelect";
import { AnyRecord } from "dns";
import {
  BaseStore,
  Listener,
  Updater,
  Selector,
  Store,
  StoreWithActions,
} from "../utils/types";

/**
 * Creates a basic store with state management capabilities including get, set, subscribe, and select methods.
 *
 * @template TState - The type representing the shape of the store's state.
 * @param {TState} initialState - The initial state to initialize the store with.
 * @returns {BaseStore<TState>} - An object containing core state management functions.
 *
 */
const createBaseStore = <TState>(initialState: TState): BaseStore<TState> => {
  let state = initialState;
  const listeners = new Set<Listener<TState>>();

  const get = () => state;
  const getInitialState = () => initialState;

  const set = (action: Updater<TState>) => {
    state =
      typeof action === "function"
        ? (action as (prev: TState) => TState)(state)
        : action;
    notify();
  };

  const select = <TSelected>(selector: Selector<TState, TSelected>) =>
    selector(state);

  const subscribe = (listener: Listener<TState>) => {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  };

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  return { get, set, select, subscribe, getInitialState };
};

/**
 * Creates a new store with a given initial state and provides the capability to extend it with custom actions.
 *
 * @template TState - The type representing the shape of the initial state.
 * @param {TState} initialState - The initial state of the store. This is the default state that will be managed and updated within the store.
 * @returns {Store<TState>} - A store object that contains state management utilities and an optional method to extend the store with actions.
 */
export const create = <TState>(initialState: TState): Store<TState> => {
  // Create a base store with the provided initial state
  const baseStore = createBaseStore(initialState);

  // Create the main store, which manages state updates and provides state retrieval functionality
  const store = (() => useState(store)) as Store<TState>;

  /**
   * Extends the store with custom actions, allowing the store to be enhanced with new functionality.
   *
   * @template TActions - The type representing the actions to be added to the store.
   * @param {function} createActions - A function that takes the store as an argument and returns an object of actions.
   * @returns {StoreWithActions<TState & {}, TActions>} - The extended store with both state management and actions.
   */
  const withActions = <TActions extends AnyRecord>(
    createActions: (store: Store<TState>) => TActions
  ): StoreWithActions<TState & {}, TActions> => {
    // Create actions based on the provided function
    const actions = createActions(store);

    // Create a new selector function that allows state and actions to be accessed together
    const extendedStore = (<TSelected>(
      selector: Selector<TState & TActions, TSelected>
    ) => useSelect(extendedStore, selector)) as StoreWithActions<
      TState & {},
      TActions
    >;

    // Extended selector to retrieve state and actions together
    const extendedSelect = <TSelected>(
      selector: Selector<TState & TActions, TSelected>
    ): TSelected => selector({ ...baseStore.get(), ...actions });

    // Assign the base store and extended functionality (select and actions) to the extended store
    Object.assign(extendedStore, {
      ...baseStore,
      select: extendedSelect,
      getActions: () => actions,
    });

    return extendedStore;
  };

  // Assign base store methods and withActions to the main store
  Object.assign(store, {
    ...baseStore,
    withActions,
  });

  return store;
};
