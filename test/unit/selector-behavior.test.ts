import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { create, useSelect } from "../../src";

describe("Selector Behavior Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Subscription Management", () => {
    it("should subscribe to store changes", () => {
      const store = create({ count: 0, name: "test" });
      const subscribeSpy = vi.spyOn(store, "subscribe");

      const { result } = renderHook(() => useSelect(store, (s) => s.count));

      expect(subscribeSpy).toHaveBeenCalled();
      expect(result.current).toBe(0);
    });

    it("should unsubscribe when component unmounts", () => {
      const store = create({ count: 0 });
      const unsubscribeSpy = vi.fn();

      vi.spyOn(store, "subscribe").mockReturnValue(unsubscribeSpy);

      const { unmount } = renderHook(() => useSelect(store, (s) => s.count));

      unmount();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it("should handle multiple subscribers to same store", () => {
      const store = create({ count: 0, name: "test" });

      const { result: result1 } = renderHook(() =>
        useSelect(store, (s) => s.count)
      );
      const { result: result2 } = renderHook(() =>
        useSelect(store, (s) => s.name)
      );
      const { result: result3 } = renderHook(() => useSelect(store));

      expect(result1.current).toBe(0);
      expect(result2.current).toBe("test");
      expect(result3.current).toEqual({ count: 0, name: "test" });

      act(() => {
        store.set({ count: 1, name: "updated" });
      });

      expect(result1.current).toBe(1);
      expect(result2.current).toBe("updated");
      expect(result3.current).toEqual({ count: 1, name: "updated" });
    });

    it("should handle subscription changes when selector changes", () => {
      const store = create({ count: 0, name: "test" });

      // Test that different hook instances with different selectors work correctly
      const { result: result1 } = renderHook(() =>
        useSelect(store, (s) => s.count)
      );
      const { result: result2 } = renderHook(() =>
        useSelect(store, (s) => s.name)
      );

      expect(result1.current).toBe(0);
      expect(result2.current).toBe("test");

      // Update the store and verify both selectors work
      act(() => {
        store.set({ count: 5, name: "updated" });
      });

      expect(result1.current).toBe(5);
      expect(result2.current).toBe("updated");
    });
  });

  describe("Custom Equality Functions", () => {
    it("should use custom equality function to prevent unnecessary re-renders", () => {
      const store = create({ items: [1, 2, 3], metadata: { version: 1 } });
      const renderCount = vi.fn();

      const customEqual = (a: number[], b: number[]) => {
        return (
          a.length === b.length && a.every((item, index) => item === b[index])
        );
      };

      const { result } = renderHook(() => {
        renderCount();
        return useSelect(store, (s) => s.items, customEqual);
      });

      expect(renderCount).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual([1, 2, 3]);

      // Update metadata (should not trigger re-render due to custom equality)
      act(() => {
        store.set((prev) => ({ ...prev, metadata: { version: 2 } }));
      });

      expect(renderCount).toHaveBeenCalledTimes(1); // Should not re-render

      // Update items (should trigger re-render)
      act(() => {
        store.set((prev) => ({ ...prev, items: [1, 2, 3, 4] }));
      });

      expect(renderCount).toHaveBeenCalledTimes(2);
      expect(result.current).toEqual([1, 2, 3, 4]);
    });

    it("should use shallow equality by default for objects", () => {
      const store = create({ user: { id: 1, name: "John" }, count: 0 });
      const renderCount = vi.fn();

      const { result } = renderHook(() => {
        renderCount();
        return useSelect(store, (s) => s.user);
      });

      expect(renderCount).toHaveBeenCalledTimes(1);

      // Update user object (should trigger re-render due to new object reference)
      act(() => {
        store.set((prev) => ({
          ...prev,
          user: { ...prev.user, name: "Jane" },
        }));
      });

      expect(renderCount).toHaveBeenCalledTimes(2); // Will re-render due to new object reference
    });

    it("should handle deep equality comparison", () => {
      const store = create({
        config: { theme: "dark", settings: { notifications: true } },
        counter: 0,
      });

      const deepEqual = (a: any, b: any): boolean => {
        return JSON.stringify(a) === JSON.stringify(b);
      };

      const renderCount = vi.fn();

      const { result } = renderHook(() => {
        renderCount();
        return useSelect(store, (s) => s.config, deepEqual);
      });

      expect(renderCount).toHaveBeenCalledTimes(1);

      // Update counter (config remains the same)
      act(() => {
        store.set((prev) => ({ ...prev, counter: 1 }));
      });

      expect(renderCount).toHaveBeenCalledTimes(1); // Should not re-render

      // Update config
      act(() => {
        store.set((prev) => ({
          ...prev,
          config: { ...prev.config, theme: "light" },
        }));
      });

      expect(renderCount).toHaveBeenCalledTimes(2);
    });
  });

  describe("Selector Performance", () => {
    it("should memoize selector results", () => {
      const store = create({ items: [1, 2, 3], filter: "all" });
      const expensiveSelector = vi.fn((state) => {
        // Simulate expensive computation
        return state.items.filter((item) => item > 1);
      });

      const { result, rerender } = renderHook(() =>
        useSelect(store, expensiveSelector)
      );

      expect(expensiveSelector).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual([2, 3]);

      // Re-render without state change
      rerender();
      expect(expensiveSelector).toHaveBeenCalledTimes(1); // Should not call again

      // Update unrelated field
      act(() => {
        store.set((prev) => ({ ...prev, filter: "active" }));
      });

      expect(expensiveSelector).toHaveBeenCalledTimes(2); // Should call again
    });

    it("should handle selector that returns new objects", () => {
      const store = create({ items: [1, 2, 3] });
      const renderCount = vi.fn();

      const { result } = renderHook(() => {
        renderCount();
        // This selector always returns a new object
        return useSelect(store, (s) => ({
          filtered: s.items.filter((x) => x > 1),
        }));
      });

      expect(renderCount).toHaveBeenCalledTimes(1);

      // Update items
      act(() => {
        store.set({ items: [1, 2, 3, 4] });
      });

      expect(renderCount).toHaveBeenCalledTimes(2);
      expect(result.current).toEqual({ filtered: [2, 3, 4] });
    });

    it("should handle complex nested selectors", () => {
      const store = create({
        users: [
          { id: 1, name: "John", active: true },
          { id: 2, name: "Jane", active: false },
          { id: 3, name: "Bob", active: true },
        ],
        filter: { active: true, search: "" },
      });

      const { result } = renderHook(() =>
        useSelect(store, (state) => {
          return state.users
            .filter((user) => !state.filter.active || user.active)
            .filter((user) =>
              user.name
                .toLowerCase()
                .includes(state.filter.search.toLowerCase())
            )
            .map((user) => ({ id: user.id, name: user.name }));
        })
      );

      expect(result.current).toEqual([
        { id: 1, name: "John" },
        { id: 3, name: "Bob" },
      ]);

      // Update filter
      act(() => {
        store.set((prev) => ({
          ...prev,
          filter: { ...prev.filter, search: "jo" },
        }));
      });

      expect(result.current).toEqual([{ id: 1, name: "John" }]);
    });
  });

  describe("Selector Edge Cases", () => {
    it("should handle selector that throws errors", () => {
      const store = create({ count: 0 });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const badSelector = (state: any) => {
        if (state.count > 5) {
          throw new Error("Selector error");
        }
        return state.count;
      };

      const { result } = renderHook(() => useSelect(store, badSelector));

      expect(result.current).toBe(0);

      // This should throw an error when the selector fails
      expect(() => {
        act(() => {
          store.set({ count: 10 });
        });
      }).toThrow("Selector error");

      consoleSpy.mockRestore();
    });

    it("should handle selector returning undefined", () => {
      const store = create({ data: null as any });

      const { result } = renderHook(() =>
        useSelect(store, (s) => s.data?.value)
      );

      expect(result.current).toBeUndefined();

      act(() => {
        store.set({ data: { value: "test" } });
      });

      expect(result.current).toBe("test");
    });

    it("should handle rapidly changing selectors", () => {
      const store = create({ count: 0 });
      let selectorType = "count";

      const { result, rerender } = renderHook(() => {
        const selector =
          selectorType === "count"
            ? (s: any) => s.count
            : (s: any) => s.count * 2;
        return useSelect(store, selector);
      });

      expect(result.current).toBe(0);

      // Change selector multiple times rapidly
      selectorType = "double";
      rerender();
      expect(result.current).toBe(0);

      selectorType = "count";
      rerender();
      expect(result.current).toBe(0);

      act(() => {
        store.set({ count: 5 });
      });

      expect(result.current).toBe(5);
    });
  });

  describe("Store with Actions Integration", () => {
    it("should select both state and actions", () => {
      const store = create({ count: 0 }).withActions((s) => ({
        increment: () => s.set((prev) => ({ count: prev.count + 1 })),
        decrement: () => s.set((prev) => ({ count: prev.count - 1 })),
      }));

      const { result } = renderHook(() =>
        useSelect(store, (state) => ({
          count: state.count,
          increment: state.increment,
          decrement: state.decrement,
        }))
      );

      expect(result.current.count).toBe(0);
      expect(typeof result.current.increment).toBe("function");
      expect(typeof result.current.decrement).toBe("function");

      act(() => {
        result.current.increment();
      });

      expect(result.current.count).toBe(1);
    });

    it("should handle action-only selectors", () => {
      const store = create({ count: 0 }).withActions((s) => ({
        increment: () => s.set((prev) => ({ count: prev.count + 1 })),
        reset: () => s.set({ count: 0 }),
      }));

      const { result } = renderHook(() =>
        useSelect(store, (state) => ({
          increment: state.increment,
          reset: state.reset,
        }))
      );

      expect(typeof result.current.increment).toBe("function");
      expect(typeof result.current.reset).toBe("function");

      // Actions should work
      act(() => {
        result.current.increment();
      });

      expect(store.get().count).toBe(1);

      act(() => {
        result.current.reset();
      });

      expect(store.get().count).toBe(0);
    });
  });
});
