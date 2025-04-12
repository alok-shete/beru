// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ANY = any;
type AnyRecord = Record<string, ANY>;
type Updater<T> = T | ((prev: T) => T);
type Listener<T> = (state: T) => void;
type Selector<TState, TSelected> = (state: TState) => TSelected;

interface BaseStore<TState> {
  get: () => TState;
  getInitialState: () => TState;
  set: (action: Updater<TState>) => void;
  select: <TSelected>(selector: Selector<TState, TSelected>) => TSelected;
  subscribe: (listener: Listener<TState>) => () => void;
}

interface Store<TState> extends BaseStore<TState> {
  <S = TState>(): [S, (value: React.SetStateAction<TState>) => void];
  withActions: <TActions extends AnyRecord>(
    createActions: (store: Store<TState>) => TActions
  ) => StoreWithActions<TState & {}, TActions>;
}

interface StoreHook<TState> {
  <S = TState>(): S;
  <S = TState>(selector: (state: TState) => S): S;
}

interface StoreWithActions<TState extends AnyRecord, TActions extends AnyRecord>
  extends Omit<BaseStore<TState>, "select">,
    StoreHook<TState & TActions> {
  select: <TSelected = TState & TActions>(
    selector?: Selector<TState & TActions, TSelected>
  ) => TSelected;
  getActions: () => TActions;
}

export type {
  Listener,
  Selector,
  Updater,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
  ANY,
};
