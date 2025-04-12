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

// === Internal Store Factory ===

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

export const create = <TState>(initialState: TState): Store<TState> => {
  const baseStore = createBaseStore(initialState);

  const store = (() => useState(store)) as Store<TState>;

  const withActions = <TActions extends AnyRecord>(
    createActions: (store: Store<TState>) => TActions
  ): StoreWithActions<TState & {}, TActions> => {
    const actions = createActions(store);

    const extendedStore = (<TSelected>(
      selector: Selector<TState & TActions, TSelected>
    ) => useSelect(extendedStore, selector)) as StoreWithActions<
      TState & {},
      TActions
    >;

    const extendedSelect = <TSelected>(
      selector: Selector<TState & TActions, TSelected>
    ): TSelected => selector({ ...baseStore.get(), ...actions });

    Object.assign(extendedStore, {
      ...baseStore,
      select: extendedSelect,
      getActions: () => actions,
    });

    return extendedStore;
  };

  Object.assign(store, {
    ...baseStore,
    withActions,
  });

  return store;
};
