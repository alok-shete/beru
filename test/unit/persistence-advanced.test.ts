import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { persist } from "../../src/middleware/persistence";
import { create } from "../../src";

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
  };
};

const fakeAsyncStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => map.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      map.delete(key);
    }),
  };
};

describe("Persistence Advanced Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Hydration Edge Cases", () => {
    it("should preserve store updates made while async hydration is pending", async () => {
      let finishHydration: ((value: string) => void) | undefined;
      const storage = {
        getItem: vi.fn(
          () =>
            new Promise<string>((resolve) => {
              finishHydration = resolve;
            })
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const store = create({ count: 0 });
      const persistent = persist(store, { name: "hydration-race", storage });

      store.set({ count: 2 });
      finishHydration!(
        JSON.stringify({ state: { count: 1 }, version: 0 })
      );
      await persistent.waitForPersistence();

      expect(store.get()).toEqual({ count: 2 });
    });

    it("should handle hydration with corrupted data", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      storage.getItem.mockReturnValueOnce("invalid-json-data");

      const persistent = persist(store, {
        name: "test-key",
        storage,
        onError,
      });

      persistent.hydrate();

      expect(onError).toHaveBeenCalledWith("migration", expect.any(Error));
      expect(store.get()).toEqual({ count: 0 }); // Should remain initial state
    });

    it("should handle hydration with missing version", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({ state: { count: 42 } }) // Missing version
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
        migrate: (state, version) => {
          expect(version).toBeUndefined();
          return state;
        },
      });

      persistent.hydrate();
      expect(store.get()).toEqual({ count: 42 });
    });

    it("should handle hydration with null state", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({ state: null, version: 0 })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      persistent.hydrate();
      expect(store.get()).toEqual({ count: 0 }); // Should remain initial state
    });

    it("should handle force hydration", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      storage.getItem.mockResolvedValue(
        JSON.stringify({ state: { count: 42 }, version: 0 })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      // First hydration
      await persistent.hydrate();
      expect(store.get()).toEqual({ count: 42 });

      // Change state
      store.set({ count: 100 });

      // Force hydration should reload from storage
      storage.getItem.mockResolvedValue(
        JSON.stringify({ state: { count: 999 }, version: 0 })
      );

      await persistent.forceHydrate();
      expect(store.get()).toEqual({ count: 999 });
    });

    it("should wait for pending hydration", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      storage.getItem.mockResolvedValue(
        JSON.stringify({ state: { count: 42 }, version: 0 })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      const hydrationPromise = persistent.hydrate();
      const waitPromise = persistent.waitForPersistence();

      expect(waitPromise).toBe(hydrationPromise);
      await waitPromise;
      expect(store.get()).toEqual({ count: 42 });
    });
  });

  describe("Clear Operations", () => {
    it("should cancel debounced writes before clearing storage", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "clear-pending-timer",
        storage,
        debounceTime: 100,
      });

      store.set({ count: 1 });
      await persistent.clear();
      vi.advanceTimersByTime(100);

      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).toHaveBeenCalledWith("clear-pending-timer");
    });

    it("should wait for an in-flight write before clearing storage", async () => {
      const persisted = new Map<string, string>();
      let finishWrite: (() => void) | undefined;
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(
          (key: string, value: string) =>
            new Promise<void>((resolve) => {
              finishWrite = () => {
                persisted.set(key, value);
                resolve();
              };
            })
        ),
        removeItem: vi.fn((key: string) => {
          persisted.delete(key);
        }),
      };
      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "clear-in-flight",
        storage,
        debounceTime: 0,
      });

      vi.useFakeTimers();
      store.set({ count: 1 });
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      expect(finishWrite).toBeDefined();

      const clearing = persistent.clear();
      finishWrite!();
      await clearing;

      expect(persisted.has("clear-in-flight")).toBe(false);
    });

    it("should handle clear with async storage", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      await persistent.clear();
      expect(storage.removeItem).toHaveBeenCalledWith("test-key");
    });

    it("should handle clear errors gracefully", async () => {
      const onError = vi.fn();
      const store = create({ count: 0 });

      const badStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(() => {
          throw new Error("Remove failed");
        }),
      };

      const persistent = persist(store, {
        name: "test-key",
        storage: badStorage,
        onError,
      });

      await persistent.clear();
      expect(onError).toHaveBeenCalledWith("clear", expect.any(Error));
    });

    it("should clear state and stop persistence", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        debounceTime: 100,
      });

      store.set({ count: 1 });
      await persistent.clear();

      vi.advanceTimersByTime(200);
      expect(storage.removeItem).toHaveBeenCalledWith("test-key");
    });
  });

  describe("Flush Operations", () => {
    it("should wait for an in-flight storage write", async () => {
      vi.useFakeTimers();
      let finishWrite: (() => void) | undefined;
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              finishWrite = resolve;
            })
        ),
        removeItem: vi.fn(),
      };
      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "wait-for-write",
        storage,
        debounceTime: 0,
      });

      store.set({ count: 1 });
      vi.advanceTimersByTime(0);
      await Promise.resolve();

      const waiting = persistent.waitForPersistence();
      expect(waiting).not.toBeNull();
      let waitResolved = false;
      waiting!.then(() => {
        waitResolved = true;
      });
      await Promise.resolve();
      expect(waitResolved).toBe(false);

      finishWrite!();
      await waiting;
      expect(waitResolved).toBe(true);
    });

    it("should wait for earlier writes before flushing the latest state", async () => {
      vi.useFakeTimers();
      const persisted = new Map<string, string>();
      const writes: Array<{ value: string; resolve: () => void }> = [];
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(
          (key: string, value: string) =>
            new Promise<void>((resolve) => {
              writes.push({
                value,
                resolve: () => {
                  persisted.set(key, value);
                  resolve();
                },
              });
            })
        ),
        removeItem: vi.fn(),
      };
      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "flush-order",
        storage,
        debounceTime: 10,
      });

      store.set({ count: 1 });
      vi.advanceTimersByTime(10);
      await Promise.resolve();
      expect(writes).toHaveLength(1);

      store.set({ count: 2 });
      let flushResolved = false;
      const flushing = persistent.flush().then(() => {
        flushResolved = true;
      });
      await Promise.resolve();
      expect(flushResolved).toBe(false);
      expect(writes).toHaveLength(1);

      writes[0].resolve();
      for (let i = 0; i < 5; i++) await Promise.resolve();
      expect(writes).toHaveLength(2);
      writes[1].resolve();
      await flushing;

      expect(JSON.parse(persisted.get("flush-order")!).state.count).toBe(2);
    });

    it("should flush pending changes immediately", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        debounceTime: 1000,
      });

      store.set({ count: 1 });
      store.set({ count: 2 });

      // Flush before debounce timer
      await persistent.flush();

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify({ state: { count: 2 }, version: 0 })
      );

      // Timer should be cleared
      vi.advanceTimersByTime(1000);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it("should handle flush with async storage", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      store.set({ count: 42 });
      await persistent.flush();

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify({ state: { count: 42 }, version: 0 })
      );
    });
  });

  describe("Error Recovery", () => {
    it("should report rejected hydration and initialize persistence afterward", async () => {
      vi.useFakeTimers();
      const error = new Error("Storage unavailable");
      const onError = vi.fn();
      const storage = {
        getItem: vi.fn(() => Promise.reject(error)),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "rejected-hydration",
        storage,
        onError,
        debounceTime: 0,
      });

      await persistent.waitForPersistence();
      expect(onError).toHaveBeenCalledWith("storage", error);

      store.set({ count: 1 });
      await vi.advanceTimersByTimeAsync(0);

      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it("should recover from storage initialization errors", () => {
      const store = create({ count: 0 });
      const onError = vi.fn();

      const badStorageFactory = () => {
        throw new Error("Storage initialization failed");
      };

      const persistent = persist(store, {
        name: "test-key",
        storage: badStorageFactory,
        onError,
      });

      // Should not throw and use fallback storage
      expect(() => persistent.hydrate()).not.toThrow();
      expect(onError).toHaveBeenCalledWith("storage", expect.any(Error));
    });

    it("should handle serialization errors", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      const badSerialize = () => {
        throw new Error("Serialization failed");
      };

      persist(store, {
        name: "test-key",
        storage,
        serialize: badSerialize,
        onError,
      });

      store.set({ count: 1 });
      vi.advanceTimersByTime(100);

      expect(onError).toHaveBeenCalledWith("persistence", expect.any(Error));
    });

    it("should handle deserialization errors", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      storage.getItem.mockReturnValueOnce("valid-json-but-bad-structure");

      const badDeserialize = () => {
        throw new Error("Deserialization failed");
      };

      const persistent = persist(store, {
        name: "test-key",
        storage,
        deserialize: badDeserialize,
        onError,
      });

      persistent.hydrate();
      expect(onError).toHaveBeenCalledWith("migration", expect.any(Error));
    });
  });

  describe("Storage Provider Edge Cases", () => {
    it("should handle storage provider that returns different instances", () => {
      const storage1 = fakeStorage();
      const storage2 = fakeStorage();
      let callCount = 0;

      const storageProvider = () => {
        callCount++;
        return callCount === 1 ? storage1 : storage2;
      };

      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "test-key",
        storage: storageProvider,
      });

      persistent.hydrate(); // Uses storage1
      expect(storage1.getItem).toHaveBeenCalled();

      persistent.clear(); // Uses storage2
      expect(storage2.removeItem).toHaveBeenCalled();
    });

    it("should handle mixed sync/async storage operations", async () => {
      const mixedStorage = {
        getItem: vi.fn(() => "sync-result"),
        setItem: vi.fn(async () => Promise.resolve()),
        removeItem: vi.fn(() => undefined),
      };

      const store = create({ count: 0 });
      const persistent = persist(store, {
        name: "test-key",
        storage: mixedStorage,
      });

      // Sync hydration
      persistent.hydrate();
      expect(mixedStorage.getItem).toHaveBeenCalled();

      // Async persistence
      store.set({ count: 1 });
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mixedStorage.setItem).toHaveBeenCalled();
    });
  });
});
