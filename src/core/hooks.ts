import {
  SetStateAction,
  useSyncExternalStore,
  useMemo,
  useDebugValue,
} from "react";
import {
  Store,
  Selector,
  StoreWithActions,
  ANY,
  StoreSnapshot,
} from "../utils/types";

const useDebugValueReact = useDebugValue;

const useSyncExternalStoreReact = <TState>(
  store: Store<TState> | StoreWithActions<TState & {}, {}>
) => useSyncExternalStore(store.subscribe, store.get, store.getInitial);

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
  selector: Selector<StoreSnapshot<TStore>, TSelected> = (state) => state
): TSelected => {
  const state = useSyncExternalStoreReact(store);

  const selected = useMemo(
    () =>
      selector(
        "getActions" in store ? { ...state, ...store.getActions() } : state
      ),
    [state, selector]
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
  store: Store<TState>
): [TState, (value: SetStateAction<TState>) => void] => {
  const selectedState = useSyncExternalStoreReact(store);
  useDebugValueReact(selectedState);

  return [selectedState, store.set];
};
