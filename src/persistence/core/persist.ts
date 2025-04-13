import { createFallbackStorage, LOG, runImmediately } from "../../utils/common";
import {
  ANY,
  AnyRecord,
  PersistConfig,
  PersistentStore,
  StorageInterface,
  Store,
  StoreWithActions,
} from "../../utils/types";

/**
 * Persist a store or a store with actions to a specified storage.
 *
 * The function persists the state of the provided store (or store with actions) to a storage solution
 * according to the configuration provided. It supports automatic state serialization, migration, and more.
 *
 * @param {Store<T>} store - The store to persist.
 * @param {PersistConfig<T>} config - Configuration for persistence such as storage key, debounce time, migration, etc.
 * @returns {PersistentStore<typeof store>} The persistent store, which includes methods for hydration, disposal, and clearing.
 */
export function persist<T>(
  store: Store<T>,
  config: PersistConfig<T>
): PersistentStore<Store<T>>;

// Overload for StoreWithActions<T, A>
export function persist<T extends AnyRecord, A extends AnyRecord>(
  store: StoreWithActions<T, A>,
  config: PersistConfig<T>
): PersistentStore<StoreWithActions<T, A>>;


export function persist<T, A>(
  store: Store<T> | StoreWithActions<T & AnyRecord, A & AnyRecord>,
  config: PersistConfig<T>
): PersistentStore<typeof store> {
  const {
    key: storageKey,
    debounceTime = 100,
    version = 0,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    migrate = <A = ANY>(persistedState: A, persistedVersion: number) => {
      return persistedVersion === version ? persistedState : null;
    },
    partial = (state: T) => state,
    merge = (initialState: T, persistedState: T) =>
      typeof initialState === "object" && typeof persistedState === "object"
        ? Object.assign({}, initialState, persistedState)
        : persistedState,
    storage,
    onError = (type, error) => {
      LOG.error(`Error in ${type} for key "${storageKey}":`, error);
    },
    skipHydrate = false,
  } = config;

  let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
  let storeUnsubscribe: (() => void) | null = null;
  let isStoreInitialized = false;
  let pendingHydration: Promise<void>;
  const originalGet = store.get;

  const getStorageInstance = (): StorageInterface => {
    try {
      return typeof storage === "function"
        ? storage()
        : (storage ?? localStorage);
    } catch (error) {
      onError("storage", error);
      return createFallbackStorage();
    }
  };

  const persistStateToStorage = async (state: T) => {
    try {
      const serialized = serialize({ state: partial(state), version });
      await getStorageInstance().setItem(storageKey, serialized);
    } catch (error) {
      onError("persistence", error);
    }
  };

  const hydrateFromStoredData = (storedData: string | null) => {
    if (storedData) {
      try {
        const { state: storedState, version: storedVersion } =
          deserialize(storedData);
        const migratedState = migrate(storedState, storedVersion);

        if (migratedState) {
          store.set(merge(originalGet(), migratedState) as T & AnyRecord); 
        }
      } catch (error) {
        onError("migration", error);
      }
    }

    initializeSubscription();
  };

  const hydrate = () => {
    if (pendingHydration instanceof Promise) {
      return pendingHydration;
    }
    try {
      const storageInstance = getStorageInstance();
      const storedData = storageInstance.getItem(storageKey);

      if (storedData instanceof Promise) {
        pendingHydration = runImmediately(async () =>
          hydrateFromStoredData(await storedData)
        );
        return pendingHydration;
      } else {
        return hydrateFromStoredData(storedData);
      }
    } catch (error) {
      onError("storage", error);
    }
  };

  const scheduleStatePersistence = (data: T) => {
    if (persistenceTimer) clearTimeout(persistenceTimer);
    persistenceTimer = setTimeout(() => {
      persistStateToStorage(data);
      persistenceTimer = null;
    }, debounceTime);
  };

  const initializeSubscription = () => {
    dispose();
    storeUnsubscribe = store.subscribe(scheduleStatePersistence);
  };

  const dispose = () => {
    storeUnsubscribe?.();
    storeUnsubscribe = null;
    if (persistenceTimer) clearTimeout(persistenceTimer);
  };

  const clear = () => {
    return runImmediately(async () => {
      try {
        await getStorageInstance().removeItem(storageKey);
      } catch (error) {
        onError("clear", error);
      }
    });
  };

  store.get = () => {
    if (!isStoreInitialized) {
      isStoreInitialized = true;
      if (!skipHydrate) hydrate();
    }
    return originalGet();
  };

  return Object.assign(store, {
    hydrate,
    dispose,
    clear,
  });
}
