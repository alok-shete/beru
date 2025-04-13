import { Store, Selector, StoreWithActions, ANY } from "../utils/types";
import useSyncExternalStoreExports from "use-sync-external-store/shim/with-selector.js";

const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

export const useSelect = <
  TState,
  TActions extends Record<string, ANY> = Record<string, unknown>,
  TSelected = TState & TActions,
>(
  store: Store<TState> | StoreWithActions<TState & {}, TActions>,
  selector: Selector<TState & TActions, TSelected> = (state) =>
    state as TSelected
): TSelected => {
  function getStateWithSelector() {
    return store.select((state) => selector(state as TState & TActions));
  }

  const selectedState = useSyncExternalStoreWithSelector(
    store.subscribe,
    store.get,
    store.getInitialState,
    getStateWithSelector,
    undefined
  );

  return selectedState;
};
