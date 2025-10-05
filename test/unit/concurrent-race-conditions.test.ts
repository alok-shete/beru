import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { create } from "../../src";
import { persist } from "../../src/middleware/persistence";

const fakeAsyncStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => {
      // Simulate async delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      return map.get(key) ?? null;
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      map.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      map.delete(key);
    }),
  };
};

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

describe("Concurrent Operations and Race Conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Concurrent Store Updates", () => {
    it("should handle rapid concurrent updates", () => {
      const store = create({ count: 0 });
      const listener = vi.fn();
      store.subscribe(listener);

      // Simulate rapid concurrent updates
      for (let i = 0; i < 100; i++) {
        store.set((prev) => ({ count: prev.count + 1 }));
      }

      expect(store.get().count).toBe(100);
      expect(listener).toHaveBeenCalledTimes(101); // Initial + 100 updates
    });

    it("should handle concurrent updates from multiple sources", async () => {
      const store = create({ count: 0 });

      const updatePromises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(() => {
          store.set((prev) => ({ count: prev.count + 1 }));
        })
      );

      await Promise.all(updatePromises);
      expect(store.get().count).toBe(50);
    });

    it("should maintain consistency with complex state updates", () => {
      const store = create({
        items: [] as number[],
        total: 0,
        processed: 0,
      });

      // Concurrent operations that depend on each other
      const operations = Array.from({ length: 20 }, (_, i) => () => {
        store.set((prev) => ({
          items: [...prev.items, i],
          total: prev.total + i,
          processed: prev.processed + 1,
        }));
      });

      operations.forEach((op) => op());

      const finalState = store.get();
      expect(finalState.items).toHaveLength(20);
      expect(finalState.processed).toBe(20);
      expect(finalState.total).toBe(190); // Sum of 0-19
    });

    it("should handle concurrent updates with actions", () => {
      const store = create({ count: 0, operations: 0 }).withActions((s) => ({
        increment: () =>
          s.set((prev) => ({
            count: prev.count + 1,
            operations: prev.operations + 1,
          })),
        decrement: () =>
          s.set((prev) => ({
            count: prev.count - 1,
            operations: prev.operations + 1,
          })),
      }));

      const actions = store.getActions();

      // Concurrent increment/decrement operations
      for (let i = 0; i < 50; i++) {
        actions.increment();
        actions.decrement();
      }

      const finalState = store.get();
      expect(finalState.count).toBe(0); // Should cancel out
      expect(finalState.operations).toBe(100); // All operations counted
    });
  });

  describe("Concurrent Persistence Operations", () => {
    it("should handle concurrent hydration attempts", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      storage.getItem.mockResolvedValue(
        JSON.stringify({ state: { count: 42 }, version: 0 })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      // Start multiple hydration attempts concurrently
      const hydrationPromises = Array.from({ length: 5 }, () =>
        persistent.hydrate()
      );

      const results = await Promise.all(hydrationPromises);

      // All should return the same promise (deduplication)
      expect(results.every((result) => result === results[0])).toBe(true);
      expect(storage.getItem).toHaveBeenCalledTimes(1);
      expect(store.get().count).toBe(42);
    });

    it("should handle concurrent persistence writes", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, {
        name: "test-key",
        storage,
        debounceTime: 100,
      });

      // Rapid updates that should be debounced
      for (let i = 1; i <= 10; i++) {
        store.set({ count: i });
      }

      vi.advanceTimersByTime(150);

      // Should only persist the final state
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
        state: { count: 10 },
      });
    });

    it("should handle concurrent clear and persist operations", async () => {
      vi.useFakeTimers();
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        debounceTime: 100,
      });

      // Start persistence
      store.set({ count: 1 });

      // Immediately clear
      const clearPromise = persistent.clear();

      vi.advanceTimersByTime(150);
      await clearPromise;

      expect(storage.removeItem).toHaveBeenCalledWith("test-key");
    });

    it("should handle concurrent flush operations", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      store.set({ count: 1 });
      store.set({ count: 2 });

      // Multiple concurrent flush calls
      const flushPromises = Array.from({ length: 3 }, () => persistent.flush());

      await Promise.all(flushPromises);

      // Should handle gracefully without duplicate writes
      expect(storage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify({ state: { count: 2 }, version: 0 })
      );
    });
  });

  describe("Race Conditions with Subscriptions", () => {
    it("should handle subscription during rapid state changes", () => {
      const store = create({ count: 0 });
      const listeners = [] as Array<() => void>;

      // Start rapid updates
      const updateInterval = setInterval(() => {
        store.set((prev) => ({ count: prev.count + 1 }));
      }, 1);

      // Add/remove subscribers concurrently
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const unsubscribe = store.subscribe(() => {});
          listeners.push(unsubscribe);
        }, i * 5);
      }

      // Clean up after some time
      setTimeout(() => {
        clearInterval(updateInterval);
        listeners.forEach((unsubscribe) => unsubscribe());
      }, 100);

      return new Promise((resolve) => setTimeout(resolve, 150));
    });

    it("should handle unsubscription during notification", () => {
      const store = create({ count: 0 });
      let unsubscribe1: (() => void) | null = null;
      let unsubscribe2: (() => void) | null = null;

      const listener1 = vi.fn(() => {
        // Unsubscribe during notification
        if (unsubscribe2) {
          unsubscribe2();
          unsubscribe2 = null;
        }
      });

      const listener2 = vi.fn();

      unsubscribe1 = store.subscribe(listener1);
      unsubscribe2 = store.subscribe(listener2);

      store.set({ count: 1 });

      expect(listener1).toHaveBeenCalled();
      // listener2 might or might not be called depending on timing

      // Clean up
      if (unsubscribe1) unsubscribe1();
    });

    it("should handle subscription modification during iteration", () => {
      const store = create({ count: 0 });
      const unsubscribers = [] as Array<() => void>;

      // Add initial subscribers
      for (let i = 0; i < 5; i++) {
        const unsubscribe = store.subscribe(() => {
          // Add more subscribers during notification
          if (unsubscribers.length < 10) {
            const newUnsubscribe = store.subscribe(() => {});
            unsubscribers.push(newUnsubscribe);
          }
        });
        unsubscribers.push(unsubscribe);
      }

      store.set({ count: 1 });

      // Clean up all subscribers
      unsubscribers.forEach((unsubscribe) => unsubscribe());

      expect(unsubscribers.length).toBeGreaterThan(5);
    });
  });

  describe("Memory Consistency Under Concurrency", () => {
    it("should maintain state consistency with concurrent reads and writes", () => {
      const store = create({ counter: 0, history: [] as number[] });

      // Concurrent readers and writers
      const operations: (() => void)[] = [];

      // Writers
      for (let i = 0; i < 50; i++) {
        operations.push(() => {
          store.set((prev) => ({
            counter: prev.counter + 1,
            history: [...prev.history, prev.counter + 1],
          }));
        });
      }

      // Readers
      for (let i = 0; i < 50; i++) {
        operations.push(() => {
          const state = store.get();
          expect(state.history).toHaveLength(state.counter);
        });
      }

      // Shuffle and execute
      operations.sort(() => Math.random() - 0.5);
      operations.forEach((op) => op());

      const finalState = store.get();
      expect(finalState.history).toHaveLength(finalState.counter);
    });

    it("should handle concurrent access to store with actions", () => {
      const store = create({
        items: [] as string[],
        processing: false,
      }).withActions((s) => ({
        addItem: (item: string) =>
          s.set((prev) => ({
            ...prev,
            items: [...prev.items, item],
          })),
        startProcessing: () => s.set((prev) => ({ ...prev, processing: true })),
        stopProcessing: () => s.set((prev) => ({ ...prev, processing: false })),
      }));

      const actions = store.getActions();

      // Concurrent operations
      const promises = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve().then(() => {
          actions.addItem(`item-${i}`);
          if (i % 5 === 0) {
            actions.startProcessing();
            actions.stopProcessing();
          }
        })
      );

      return Promise.all(promises).then(() => {
        const finalState = store.get();
        expect(finalState.items).toHaveLength(20);
        expect(finalState.processing).toBe(false);
      });
    });
  });

  describe("Error Handling in Concurrent Scenarios", () => {
    it("should handle errors in concurrent persistence operations", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      // Make setItem fail consistently
      storage.setItem.mockRejectedValue(new Error("Storage error"));

      persist(store, {
        name: "test-key",
        storage,
        onError,
        debounceTime: 10, // Reduce debounce time for faster testing
      });

      // Rapid updates
      const updatePromises = Array.from({ length: 5 }, (_, i) =>
        Promise.resolve().then(() => {
          store.set({ count: i });
        })
      );

      await Promise.all(updatePromises);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Some operations should have failed
      expect(onError).toHaveBeenCalled();
    });

    it("should handle concurrent operations when storage becomes unavailable", async () => {
      const storage = fakeAsyncStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      // Make storage operations fail from the start
      storage.getItem.mockRejectedValue(new Error("Storage unavailable"));
      storage.setItem.mockRejectedValue(new Error("Storage unavailable"));
      storage.removeItem.mockRejectedValue(new Error("Storage unavailable"));

      const persistent = persist(store, {
        name: "test-key",
        storage,
        onError,
      });

      // Start operations that should fail
      const operations = [
        persistent.hydrate(),
        persistent.clear(),
        persistent.flush(),
      ];

      // Also trigger a state change that should fail to persist
      store.set({ count: 1 });

      await Promise.allSettled(operations);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should handle errors gracefully
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("Performance Under Concurrency", () => {
    it("should maintain performance with many concurrent subscribers", () => {
      const store = create({ count: 0 });
      const subscribers: (() => void)[] = [];

      // Add many subscribers
      for (let i = 0; i < 1000; i++) {
        const unsubscribe = store.subscribe(() => {});
        subscribers.push(unsubscribe);
      }

      const startTime = performance.now();

      // Update state
      store.set({ count: 1 });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(100);

      // Clean up
      subscribers.forEach((unsubscribe) => unsubscribe());
    });

    it("should handle concurrent persistence with minimal overhead", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      persist(store, {
        name: "test-key",
        storage,
        debounceTime: 50,
      });

      const startTime = Date.now();

      // Many rapid updates
      for (let i = 0; i < 1000; i++) {
        store.set({ count: i });
      }

      vi.advanceTimersByTime(100);

      // Should debounce effectively
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
        state: { count: 999 },
      });
    });
  });
});
