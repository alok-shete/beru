import { SetStateAction, useDebugValue, useCallback } from "react";
import {
  Store,
  Selector,
  StoreWithActions,
  ANY,
  StoreSnapshot,
} from "../utils/types";
import { useSyncExternalStoreWithSelector } from "../utils/useSyncExternalStoreWithSelector";

const useDebugValueReact = useDebugValue;

/**
 * A hook that provides a reactive subscription to a custom store with optional selector support.
 *
 * @template TStore - The store type, which can either be a basic `Store` or an enhanced `StoreWithActions`.
 * @template TSelected - The return type of the selector. Defaults to the full state snapshot (`StoreSnapshot<TStore>`).
 *
 * @param {TStore} store - The store instance to subscribe to.
 * @param {Selector<StoreSnapshot<TStore>, TSelected>} [selector] - An optional selector function to extract a slice of the state. Defaults to identity function returning the whole state.
 *
 * @returns {TSelected} - The selected state slice, optionally enriched with actions if the store has them.
 *
 * @example
 * const counter = useSelect(counterStore, state => state.count);
 * const { count, increment } = useSelect(counterStore);
 */
export const useSelect = <
  TStore extends Store<ANY> | StoreWithActions<ANY, ANY>,
  TSelected = StoreSnapshot<TStore>,
>(
  store: TStore,
  selector: Selector<StoreSnapshot<TStore>, TSelected> = (state) => state,
  isEqual?: (a: TSelected, b: TSelected) => boolean
): TSelected => {
  const createSelector = useCallback(
    (state: StoreSnapshot<TStore>) => {
      return selector(
        "getActions" in store
          ? Object.assign({}, store.getActions(), state)
          : state
      );
    },
    [store]
  );

  const selected = useSyncExternalStoreWithSelector(
    store.subscribe,
    store.get,
    store.getInitial,
    createSelector,
    isEqual
  );

  useDebugValueReact(selected);

  return selected;
};

/**
 * A hook that returns the current state and a setter function from a custom store.
 *
 * @template TState - The type of the store's state.
 *
 * @param {Store<TState>} store - The store instance to subscribe to.
 *
 * @returns {[TState, (value: SetStateAction<TState>) => void]} - A tuple with the current state and a function to update it.
 *
 * @example
 * const [count, setCount] = useState(counterStore);
 * setCount(prev => prev + 1);
 */
export const useState = <TState>(
  store: Store<TState>,
  isEqual?: (a: TState, b: TState) => boolean
): [TState, (value: SetStateAction<TState>) => void] => {
  const selectedState = useSyncExternalStoreWithSelector(
    store.subscribe,
    store.get,
    store.getInitial,
    (state) => state,
    isEqual
  );
  useDebugValueReact(selectedState);

  return [selectedState, store.set];
};
