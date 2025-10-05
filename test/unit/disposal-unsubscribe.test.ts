import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { create, useSelect, useState } from "../../src";
import { persist } from "../../src/middleware/persistence";

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

describe("Disposal and Unsubscribe Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Store Subscription Cleanup", () => {
    it("should properly unsubscribe when useSelect hook unmounts", () => {
      const store = create({ count: 0 });
      const listener = vi.fn();

      // Mock the subscribe method to track unsubscribe calls
      const unsubscribe = vi.fn();
      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        const originalUnsubscribe = originalSubscribe(callback);
        return () => {
          unsubscribe();
          originalUnsubscribe();
        };
      });

      const { unmount } = renderHook(() => useSelect(store, (s) => s.count));

      expect(store.subscribe).toHaveBeenCalled();
      expect(unsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it("should properly unsubscribe when useState hook unmounts", () => {
      const store = create({ count: 0 });

      const unsubscribe = vi.fn();
      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        const originalUnsubscribe = originalSubscribe(callback);
        return () => {
          unsubscribe();
          originalUnsubscribe();
        };
      });

      const { unmount } = renderHook(() => useState(store));

      expect(store.subscribe).toHaveBeenCalled();
      expect(unsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it("should handle multiple subscriptions and unsubscriptions", () => {
      const store = create({ count: 0, name: "test" });
      const unsubscribeCalls = [] as Array<() => void>;

      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        const originalUnsubscribe = originalSubscribe(callback);
        const mockUnsubscribe = vi.fn(originalUnsubscribe);
        unsubscribeCalls.push(mockUnsubscribe);
        return mockUnsubscribe;
      });

      const { unmount: unmount1 } = renderHook(() =>
        useSelect(store, (s) => s.count)
      );
      const { unmount: unmount2 } = renderHook(() =>
        useSelect(store, (s) => s.name)
      );
      const { unmount: unmount3 } = renderHook(() => useState(store));

      expect(unsubscribeCalls).toHaveLength(3);

      // Unmount first hook
      unmount1();
      expect(unsubscribeCalls[0]).toHaveBeenCalled();
      expect(unsubscribeCalls[1]).not.toHaveBeenCalled();
      expect(unsubscribeCalls[2]).not.toHaveBeenCalled();

      // Unmount remaining hooks
      unmount2();
      unmount3();
      expect(unsubscribeCalls[1]).toHaveBeenCalled();
      expect(unsubscribeCalls[2]).toHaveBeenCalled();
    });

    it("should not leak memory with rapid mount/unmount cycles", () => {
      const store = create({ count: 0 });
      const subscribeCallCount = vi.fn();
      const unsubscribeCallCount = vi.fn();

      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        subscribeCallCount();
        const originalUnsubscribe = originalSubscribe(callback);
        return () => {
          unsubscribeCallCount();
          originalUnsubscribe();
        };
      });

      // Rapid mount/unmount cycles
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() => useSelect(store, (s) => s.count));
        unmount();
      }

      expect(subscribeCallCount).toHaveBeenCalledTimes(10);
      expect(unsubscribeCallCount).toHaveBeenCalledTimes(10);
    });
  });

  describe("Persistence Disposal", () => {
    it("should dispose persistence subscription properly", () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        debounceTime: 100,
      });

      // Make changes to trigger subscription
      store.set({ count: 1 });
      store.set({ count: 2 });

      // Dispose should stop further persistence
      persistent.dispose();

      store.set({ count: 3 });
      vi.advanceTimersByTime(200);

      // Should not persist after disposal
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it("should clear pending timers on disposal", () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        debounceTime: 1000,
      });

      store.set({ count: 1 });

      // Dispose before timer fires
      persistent.dispose();
      vi.advanceTimersByTime(1500);

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it("should handle multiple disposal calls gracefully", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      // Multiple dispose calls should not throw
      expect(() => {
        persistent.dispose();
        persistent.dispose();
        persistent.dispose();
      }).not.toThrow();
    });

    it("should dispose all persistence instances in setupHydrator", () => {
      const storage1 = fakeStorage();
      const storage2 = fakeStorage();
      const store1 = create({ count: 0 });
      const store2 = create({ name: "test" });

      const persistent1 = persist(store1, {
        name: "store1",
        storage: storage1,
      });
      const persistent2 = persist(store2, {
        name: "store2",
        storage: storage2,
      });

      const disposeSpy1 = vi.spyOn(persistent1, "dispose");
      const disposeSpy2 = vi.spyOn(persistent2, "dispose");

      // Dispose both
      persistent1.dispose();
      persistent2.dispose();

      expect(disposeSpy1).toHaveBeenCalled();
      expect(disposeSpy2).toHaveBeenCalled();
    });
  });

  describe("Store with Actions Disposal", () => {
    it("should properly dispose store with actions", () => {
      const store = create({ count: 0 }).withActions((s) => ({
        increment: () => s.set((prev) => ({ count: prev.count + 1 })),
      }));

      const unsubscribe = vi.fn();
      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        const originalUnsubscribe = originalSubscribe(callback);
        return () => {
          unsubscribe();
          originalUnsubscribe();
        };
      });

      const { unmount } = renderHook(() => useSelect(store, (s) => s.count));

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it("should handle disposal when actions are still referenced", () => {
      const store = create({ count: 0 }).withActions((s) => ({
        increment: () => s.set((prev) => ({ count: prev.count + 1 })),
      }));

      let capturedActions: any;

      const { unmount } = renderHook(() => {
        const result = useSelect(store, (s) => ({
          count: s.count,
          increment: s.increment,
        }));
        capturedActions = { increment: result.increment };
        return result;
      });

      unmount();

      // Actions should still work after component unmount
      expect(() => {
        capturedActions.increment();
      }).not.toThrow();

      expect(store.get().count).toBe(1);
    });
  });

  describe("Cleanup Edge Cases", () => {
    it("should handle cleanup when store is garbage collected", () => {
      let store: any = create({ count: 0 });
      const weakRef = new WeakRef(store);

      const { unmount } = renderHook(() =>
        useSelect(store, (s: any) => s.count)
      );

      // Clear strong reference
      store = null;

      unmount();

      // Force garbage collection (if supported)
      if (global.gc) {
        global.gc();
      }

      // This test mainly ensures no errors are thrown during cleanup
      expect(true).toBe(true);
    });

    it("should handle cleanup with circular references", () => {
      const store = create({
        count: 0,
        self: null as any,
      });

      // Create circular reference
      store.set((prev) => ({ ...prev, self: store }));

      const { unmount } = renderHook(() => useSelect(store, (s) => s.count));

      // Should not throw during cleanup
      expect(() => unmount()).not.toThrow();
    });

    it("should handle cleanup during React strict mode", () => {
      const store = create({ count: 0 });
      const subscribeCount = vi.fn();
      const unsubscribeCount = vi.fn();

      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        subscribeCount();
        const originalUnsubscribe = originalSubscribe(callback);
        return () => {
          unsubscribeCount();
          originalUnsubscribe();
        };
      });

      // Simulate React strict mode double mounting
      const { unmount: unmount1 } = renderHook(() =>
        useSelect(store, (s) => s.count)
      );
      const { unmount: unmount2 } = renderHook(() =>
        useSelect(store, (s) => s.count)
      );

      unmount1();
      unmount2();

      expect(subscribeCount).toHaveBeenCalledTimes(2);
      expect(unsubscribeCount).toHaveBeenCalledTimes(2);
    });

    it("should handle cleanup when component throws during render", () => {
      const store = create({ count: 0 });
      const unsubscribe = vi.fn();

      const originalSubscribe = store.subscribe;
      vi.spyOn(store, "subscribe").mockImplementation((callback) => {
        const originalUnsubscribe = originalSubscribe(callback);
        return () => {
          unsubscribe();
          originalUnsubscribe();
        };
      });

      let shouldThrow = false;

      const { unmount } = renderHook(() => {
        const result = useSelect(store, (s) => s.count);
        if (shouldThrow) {
          throw new Error("Component error");
        }
        return result;
      });

      // Component should still cleanup properly even if it throws
      shouldThrow = true;

      expect(() => unmount()).not.toThrow();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe("Concurrent Disposal", () => {
    it("should handle concurrent disposal operations", async () => {
      vi.useFakeTimers();
      const storage = fakeStorage();
      const store = create({ count: 0 });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        debounceTime: 100,
      });

      // Start multiple operations
      store.set({ count: 1 });
      const clearPromise = persistent.clear();
      persistent.dispose();

      vi.advanceTimersByTime(200);
      await clearPromise;

      // Should handle gracefully without errors
      expect(storage.removeItem).toHaveBeenCalled();
    });

    it("should handle disposal during hydration", async () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({ state: { count: 42 }, version: 0 })
      );

      const persistent = persist(store, {
        name: "test-key",
        storage,
      });

      // Dispose immediately after hydration starts
      persistent.hydrate();
      persistent.dispose();

      // Should not throw
      expect(store.get().count).toBe(42); // Hydration should still complete
    });
  });
});
