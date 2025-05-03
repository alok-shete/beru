import React, { useDebugValue } from "react";
import { Store } from "../utils/types";
import { useSyncExternalStore } from "react";

/**
 * A custom React hook that provides state and a setter function from a custom store.
 *
 * @template TState - The type representing the shape of the store's state.
 * @param {Store<TState>} store - The store instance to subscribe to.
 * @returns {[TState, (value: React.SetStateAction<TState>) => void]} - An array containing the current state and a setter function.
 *
 */
export const useState = <TState>(
  store: Store<TState>
): [TState, (value: React.SetStateAction<TState>) => void] => {
  const selectedState = useSyncExternalStore(
    store.subscribe,
    store.get,
    store.getInitialState
  );
  useDebugValue(selectedState);

  return [selectedState, store.set];
};