import { Store, Selector, StoreWithActions, ANY } from "../utils/types";
import { useSyncExternalStore, useMemo } from "react";

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
  // Retrieve the current state from the store
  const state = useSyncExternalStore(
    store.subscribe,
    () => store.get(),
    () => store.getInitialState()
  );

  // Memoize the result of applying the selector to prevent unnecessary re-renders
  return useMemo(() => {
    // Merge state with actions (if available)
    const stateWithActions = (
      "getActions" in store
        ? {
            ...state,
            ...store.getActions(),
          }
        : state
    ) as TState & TActions;

    // Apply the selector function
    return selector(stateWithActions);
  }, [state, selector]);
};
