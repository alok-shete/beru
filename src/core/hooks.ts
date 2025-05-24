import {
  SetStateAction,
  useSyncExternalStore,
  useMemo,
  useDebugValue,
} from "react";
import { Store, Selector, StoreWithActions, ANY } from "../utils/types";

const useDebugValueReact = useDebugValue;

const useSyncExternalStoreReact = <TState>(
  store: Store<TState> | StoreWithActions<TState & {}, {}>
) => useSyncExternalStore(store.subscribe, store.get, store.getInitial);

/**
 * A custom hook that subscribes to a store and allows selecting a slice of state, with optional actions, using a selector function.
 *
 * @template TState - The type representing the shape of the store's state.
 * @template TActions - The type representing the actions of the store. Default is `Record<string, unknown>`.
 * @template TSelected - The type representing the selected slice of state. Default is `TState & TActions`.
 *
 * @param {Store<TState> | StoreWithActions<TState, TActions>} store - The store object to subscribe to, which can either be a basic store or a store with actions.
 * @param {Selector<TState & TActions, TSelected>} [selector] - A function to select a slice of the store's state. Defaults to selecting the entire state.
 * @returns {TSelected} - The selected slice of state.
 *
 */
export const useSelect = <
  TState,
  TActions extends Record<string, ANY> = Record<string, unknown>,
  TSelected = TState & TActions,
>(
  store: Store<TState> | StoreWithActions<TState & {}, TActions>,
  selector: Selector<TState & TActions, TSelected> = (state) =>
    state as TSelected
): TSelected => {
  const state = useSyncExternalStoreReact(store);

  const selected = useMemo(
    () =>
      selector(
        "getActions" in store
          ? { ...state, ...store.getActions() }
          : (state as TState & TActions)
      ),
    [state, selector]
  );

  useDebugValueReact(selected);

  return selected;
};

/**
 * A custom React hook that provides state and a setter function from a custom store.
 *
 * @template TState - The type representing the shape of the store's state.
 * @param {Store<TState>} store - The store instance to subscribe to.
 * @returns {[TState, (value: SetStateAction<TState>) => void]} - An array containing the current state and a setter function.
 *
 */
export const useState = <TState>(
  store: Store<TState>
): [TState, (value: SetStateAction<TState>) => void] => {
  const selectedState = useSyncExternalStoreReact(store);
  useDebugValueReact(selectedState);

  return [selectedState, store.set];
};
