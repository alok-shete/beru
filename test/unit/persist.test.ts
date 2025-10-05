import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { persist } from "../../src/middleware/persistence";
import { createFallbackStorage, runImmediately } from "../../src/utils/common";
import { BaseStore, create } from "../../src";

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

describe("persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Basic functionality", () => {
    it("hydrates state from storage", async () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const stored = JSON.stringify({ state: { count: 42 }, version: 0 });
      storage.getItem.mockReturnValueOnce(stored);

      const persistent = persist(store, { name: "test-key", storage });
      persistent.hydrate();

      expect(store.get()).toEqual({ count: 42 });
    });

    it("persists state with debounce", async () => {
      vi.useFakeTimers();

      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, {
        name: "test-key",
        debounceTime: 100,
        storage,
      });

      store.set({ count: 1 });
      store.set({ count: 2 });

      vi.advanceTimersByTime(1000);

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
        state: { count: 2 },
      });
    });

    it("clears the persisted state", async () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, { name: "test-key", storage });
      await persistent.clear();
      expect(storage.removeItem).toHaveBeenCalledWith("test-key");
    });

    it("disposes subscription and clears timer", () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, { name: "test-key", storage });
      store.set({ count: 1 });

      persistent.dispose();

      vi.advanceTimersByTime(200);
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("Configuration options", () => {
    it("skips hydration when configured", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, {
        name: "skip-key",
        storage,
        skipHydrate: true,
      });

      store.set({ count: 999 });
      expect(store.get()).toEqual({ count: 999 });
      expect(storage.getItem).not.toHaveBeenCalled();
    });

    it("uses custom debounce time", async () => {
      vi.useFakeTimers();

      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, {
        name: "test-key",
        debounceTime: 500,
        storage,
      });
      store.get();

      store.set({ count: 1 });
      vi.advanceTimersByTime(400);
      expect(storage.setItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it("uses custom serialize/deserialize functions", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const customSerialize = vi.fn((data) => `custom:${JSON.stringify(data)}`);
      const customDeserialize = vi.fn((data: string) =>
        JSON.parse(data.replace("custom:", ""))
      );

      storage.getItem.mockReturnValueOnce(
        'custom:{"state":{"count":42},"version":0}'
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
        serialize: customSerialize as any,
        deserialize: customDeserialize as any,
      });

      persistent.hydrate();

      expect(customDeserialize).toHaveBeenCalled();
      expect(store.get()).toEqual({ count: 42 });
    });

    it("uses custom version and migration", () => {
      const storage = fakeStorage();
      const store = create({ count: 0, newField: "default" });

      const migrate = vi.fn((state, persistedVersion) => {
        if (persistedVersion === 0) {
          return { ...state, newField: "migrated" };
        }
        return persistedVersion === 1 ? state : null;
      });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith({ count: 42 }, 0);
      expect(store.get()).toEqual({ count: 42, newField: "migrated" });
    });

    it("uses partial function to persist subset of state", async () => {
      vi.useFakeTimers();

      const storage = fakeStorage();
      const store = create({ count: 0, secret: "hidden" });

      persist(store, {
        name: "test-key",
        storage,
        partial: (state) => ({ count: state.count }),
      });
      store.get();
      store.set({ count: 1, secret: "should-not-persist" });
      vi.advanceTimersByTime(100);

      expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
        state: { count: 1 },
      });
    });

    it("uses custom merge function", () => {
      const storage = fakeStorage();
      const store = create({ count: 0, name: "initial" });

      const customMerge = vi.fn((initial, persisted) => ({
        ...initial,
        ...persisted,
        merged: true,
      }));

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42, name: "persisted" },
          version: 0,
        })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
        merge: customMerge,
      });

      persistent.hydrate();

      expect(customMerge).toHaveBeenCalled();
      expect(store.get()).toEqual({
        count: 42,
        name: "persisted",
        merged: true,
      });
    });

    it("handles non-object merge scenarios", () => {
      const storage = fakeStorage();
      const store = create("initial");

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: "persisted",
          version: 0,
        })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      persistent.hydrate();
      expect(store.get()).toBe("persisted");
    });
  });

  describe("Storage handling", () => {
    it("uses function-based storage", () => {
      const storage = fakeStorage();
      const storageFactory = vi.fn(() => storage);
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage: storageFactory,
      });

      persistent.hydrate();
      expect(storageFactory).toHaveBeenCalled();
    });

    it("falls back to localStorage when no storage provided", () => {
      const store = create({ count: 0 });

      // Mock localStorage
      const mockLocalStorage = fakeStorage();
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
        writable: true,
      });

      const persistent = persist(store, { name: "test-key" });
      persistent.hydrate();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("test-key");
    });

    it("uses fallback storage on storage error", () => {
      const store = create({ count: 0 });
      const onError = vi.fn();

      const badStorage = () => {
        throw new Error("Storage access denied");
      };

      const persistent = persist(store, {
        name: "fallback",
        storage: badStorage,
        onError,
      });

      persistent.clear();
      expect(onError).toHaveBeenCalledWith("storage", expect.any(Error));
    });

    it("handles async storage", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      storage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const persistent = persist(store, { name: "test-key", storage });
      await persistent.hydrate();

      expect(store.get()).toEqual({ count: 42 });
    });

    it("prevents multiple hydrations", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      storage.getItem.mockResolvedValue(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const persistent = persist(store, { name: "test-key", storage });

      const hydration1 = persistent.hydrate();
      const hydration2 = persistent.hydrate();

      expect(hydration1).toBe(hydration2);
      await hydration1;
      expect(storage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("handles storage errors with custom onError", () => {
      const onError = vi.fn();
      const store = create({ count: 0 });

      const badStorage = {
        getItem: vi.fn(() => {
          throw new Error("Storage error");
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };

      const persistent = persist(store, {
        name: "test-key",
        storage: badStorage,
        onError,
      });

      persistent.hydrate();
      expect(onError).toHaveBeenCalledWith("storage", expect.any(Error));
    });

    it("handles persistence errors", async () => {
      vi.useFakeTimers();
      const onError = vi.fn();
      const store = create({ count: 0 });

      const badStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error("Write error");
        }),
        removeItem: vi.fn(),
      };

      persist(store, {
        name: "test-key",
        storage: badStorage,
        onError,
      });

      store.get();

      store.set({ count: 1 });
      vi.advanceTimersByTime(100);

      expect(onError).toHaveBeenCalledWith("persistence", expect.any(Error));
    });

    it("handles migration errors", () => {
      const onError = vi.fn();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce("invalid-json");

      const persistent = persist(store, {
        name: "test-key",
        storage,
        onError,
      });

      persistent.hydrate();
      expect(onError).toHaveBeenCalledWith("migration", expect.any(Error));
    });

    it("handles clear errors", async () => {
      const onError = vi.fn();
      const store = create({ count: 0 });

      const badStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(() => {
          throw new Error("Remove error");
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
  });

  describe("Store integration", () => {
    it("initializes on first get call", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      persist(store, { name: "test-key", storage });

      // Should not hydrate until first get
      expect(storage.getItem).toHaveBeenCalled();

      const result = store.get();
      expect(storage.getItem).toHaveBeenCalledWith("test-key");
      expect(result).toEqual({ count: 42 });
    });

    it("only initializes once", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, { name: "test-key", storage });

      store.get();
      store.get();
      store.get();

      expect(storage.getItem).toHaveBeenCalledTimes(1);
    });

    it("clears pending timer when new changes occur", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, { name: "test-key", storage, debounceTime: 100 });

      store.set({ count: 1 });
      vi.advanceTimersByTime(50);

      store.set({ count: 2 });
      vi.advanceTimersByTime(50);

      // Should not have persisted yet
      expect(storage.setItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it("handles null migration result", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const migrate = vi.fn(() => null);

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
        migrate: migrate as any,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalled();
      expect(store.get()).toEqual({ count: 0 }); // Should remain initial state
    });

    it("handles empty storage", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(null);

      const persistent = persist(store, { name: "test-key", storage });
      persistent.hydrate();

      expect(store.get()).toEqual({ count: 0 });
    });

    it("disposes properly on multiple calls", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, { name: "test-key", storage });

      // Multiple dispose calls should not error
      persistent.dispose();
      persistent.dispose();
      persistent.dispose();

      expect(() => persistent.dispose()).not.toThrow();
    });
  });

  describe("Async operations", () => {
    it("handles async setItem", async () => {
      vi.useFakeTimers();
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      const persistStore = persist(store, { name: "test-key", storage });

      await persistStore.hydrate();
      store.set({ count: 1 });
      vi.advanceTimersByTime(1000);

      expect(storage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify({ state: { count: 1 }, version: 0 })
      );
    });

    it("handles async removeItem", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, { name: "test-key", storage });
      await persistent.clear();

      expect(storage.removeItem).toHaveBeenCalledWith("test-key");
    });
  });
});
