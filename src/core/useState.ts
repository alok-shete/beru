import React, { useDebugValue, useCallback } from "react";
import { Store } from "../utils/types";

import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

export const useState = <TState,>(
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
