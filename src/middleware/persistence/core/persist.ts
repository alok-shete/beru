import {
  createFallbackStorage,
  LOG,
  runImmediately,
} from "../../../utils/common";
import {
  AnyRecord,
  BaseStore,
  PersistConfig,
  PersistentStore,
  StorageInterface,
  StoreState,
} from "../../../utils/types";

const isPlainObject = (value: unknown): value is AnyRecord => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

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
export function persist<S extends BaseStore<any>>(
  store: S,
  config: PersistConfig<StoreState<S>>
): PersistentStore<S> {
  const {
    name: storageKey,
    debounceTime = 100,
    version = 0,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    migrate = (state, persistedVersion) =>
      persistedVersion === version ? state : null,
    partial = (state) => state,
    merge = (initialState, persistedState) =>
      isPlainObject(initialState) && isPlainObject(persistedState)
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
  let isDisposed = false;
  let pendingHydration: Promise<void> | null = null;
  let hydrationGeneration = 0;
  const activeHydrations = new Set<Promise<void>>();
  let pendingWrites: Promise<void> = Promise.resolve();
  let pendingPersistenceOperations = 0;
  let isProcessingPersistenceQueue = false;
  const persistenceQueue: Array<{
    operation: () => Promise<void> | void;
    resolve: () => void;
    reject: (reason?: unknown) => void;
  }> = [];
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

  const persistStateToStorage = async (state: StoreState<S>) => {
    try {
      const serialized = serialize({ state: partial(state), version });
      await getStorageInstance().setItem(storageKey, serialized);
    } catch (error) {
      onError("persistence", error);
    }
  };

  const enqueuePersistenceOperation = (
    operation: () => Promise<void> | void
  ) => {
    pendingPersistenceOperations++;
    pendingWrites = new Promise<void>((resolve, reject) => {
      persistenceQueue.push({ operation, resolve, reject });
    });
    const processQueue = () => {
      const next = persistenceQueue.shift();
      if (!next) {
        isProcessingPersistenceQueue = false;
        return;
      }

      isProcessingPersistenceQueue = true;
      const finish = (error?: unknown, failed = false) => {
        pendingPersistenceOperations--;
        if (failed) next.reject(error);
        else next.resolve();
        processQueue();
      };

      try {
        Promise.resolve(next.operation()).then(
          () => finish(),
          (error) => finish(error, true)
        );
      } catch (error) {
        finish(error, true);
      }
    };
    if (!isProcessingPersistenceQueue) processQueue();
    return pendingWrites;
  };

  const enqueuePersistence = (state: StoreState<S>) =>
    enqueuePersistenceOperation(() => persistStateToStorage(state));

  const hydrateFromStoredData = (
    storedData: string | null,
    generation: number,
    shouldApplyHydration: () => boolean
  ) => {
    if (storedData) {
      try {
        const { state: storedState, version: storedVersion } =
          deserialize(storedData);
        const migratedState = migrate(storedState, storedVersion);

        if (
          migratedState !== null &&
          migratedState !== undefined &&
          shouldApplyHydration()
        ) {
          store.set(
            merge(originalGet(), migratedState) as StoreState<S> & AnyRecord
          );
        }
      } catch (error) {
        onError("migration", error);
      }
    }
    initializeSubscription(generation);
  };

  const hydrate = () => {
    if (pendingHydration instanceof Promise) return pendingHydration;

    isDisposed = false;
    const generation = ++hydrationGeneration;
    let isInitialNotification = true;
    let hasUpdatedDuringHydration = false;
    const unsubscribeFromHydrationTracking = store.subscribe(() => {
      if (isInitialNotification) {
        isInitialNotification = false;
      } else {
        hasUpdatedDuringHydration = true;
      }
    });
    const applyHydration = (storedData: string | null) => {
      try {
        hydrateFromStoredData(
          storedData,
          generation,
          () =>
            !hasUpdatedDuringHydration && generation === hydrationGeneration
        );
      } finally {
        unsubscribeFromHydrationTracking();
      }
    };

    try {
      const storageInstance = getStorageInstance();
      const storedData = storageInstance.getItem(storageKey);

      if (storedData instanceof Promise) {
        const hydrationPromise = runImmediately(async () => {
          try {
            let resolvedData: string | null;
            try {
              resolvedData = await storedData;
            } catch (error) {
              unsubscribeFromHydrationTracking();
              try {
                onError("storage", error);
              } finally {
                initializeSubscription(generation);
              }
              return;
            }
            applyHydration(resolvedData);
          } finally {
            activeHydrations.delete(hydrationPromise);
          }
        });
        pendingHydration = hydrationPromise;
        activeHydrations.add(hydrationPromise);
        return pendingHydration;
      } else {
        return applyHydration(storedData);
      }
    } catch (error) {
      unsubscribeFromHydrationTracking();
      try {
        onError("storage", error);
      } finally {
        initializeSubscription(generation);
      }
    }
  };

  const scheduleStatePersistence = (data: StoreState<S>) => {
    if (persistenceTimer !== null) clearTimeout(persistenceTimer);
    persistenceTimer = setTimeout(() => {
      enqueuePersistence(data);
      persistenceTimer = null;
    }, debounceTime);
  };

  const initializeSubscription = (generation: number) => {
    if (isDisposed || generation !== hydrationGeneration) return;
    stopPersistenceSubscription();
    storeUnsubscribe = store.subscribe(scheduleStatePersistence);
  };

  const stopPersistenceSubscription = () => {
    storeUnsubscribe?.();
    storeUnsubscribe = null;
    if (persistenceTimer !== null) {
      clearTimeout(persistenceTimer);
      persistenceTimer = null;
    }
  };

  const dispose = () => {
    isDisposed = true;
    stopPersistenceSubscription();
  };

  const clear = () => {
    hydrationGeneration++;
    if (persistenceTimer !== null) {
      clearTimeout(persistenceTimer);
      persistenceTimer = null;
    }
    if (
      activeHydrations.size > 0 &&
      !isDisposed &&
      storeUnsubscribe === null
    ) {
      storeUnsubscribe = store.subscribe(scheduleStatePersistence);
    }

    return enqueuePersistenceOperation(() =>
      runImmediately(async () => {
        try {
          await getStorageInstance().removeItem(storageKey);
        } catch (error) {
          onError("clear", error);
        }
      })
    );
  };

  if (!isStoreInitialized) {
    isStoreInitialized = true;
    if (!skipHydrate) hydrate();
  }

  ///todo: need refactor
  const flush = async (): Promise<void> => {
    if (persistenceTimer !== null) {
      clearTimeout(persistenceTimer);
      persistenceTimer = null;
    }

    const currentState = store.get();
    await enqueuePersistence(currentState);
  };

  return Object.assign(store, {
    hydrate,
    dispose,
    clear,
    flush,
    waitForPersistence: () => {
      const pending: Promise<void>[] = [];
      pending.push(...Array.from(activeHydrations));
      if (pendingPersistenceOperations > 0) pending.push(pendingWrites);
      if (pending.length === 0) return null;
      if (pending.length === 1) return pending[0];
      return Promise.all(pending).then(() => undefined);
    },
    forceHydrate: () => {
      pendingHydration = null;
      return hydrate();
    },
  });
}
