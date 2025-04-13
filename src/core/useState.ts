import React, { useDebugValue, useCallback } from "react";
import { Store } from "../utils/types";
import useSyncExternalStoreExports from "use-sync-external-store/shim/with-selector.js";

const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

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
  const selectedState = useSyncExternalStoreWithSelector(
    store.subscribe,
    store.get,
    store.getInitialState,
    (state) => state
  );
  useDebugValue(selectedState);

  const setState = useCallback(
    (value: React.SetStateAction<TState>) => {
      store.set(value);
    },
    [store]
  );

  return [selectedState, setState];
};
