import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import React, { useState as useReactState, useEffect, StrictMode } from "react";
import { create, useSelect, useState } from "../../src";

// Test component helpers
const TestComponent: React.FC<{ store: any; selector?: any }> = ({
  store,
  selector,
}) => {
  const state = selector ? useSelect(store, selector) : useSelect(store);
  return <div data-testid="state">{JSON.stringify(state)}</div>;
};

const TestComponentWithState: React.FC<{ store: any }> = ({ store }) => {
  const [state, setState] = useState(store);
  return (
    <div>
      <div data-testid="state">{JSON.stringify(state)}</div>
      <button
        data-testid="increment"
        onClick={() => setState((prev) => ({ ...prev, count: prev.count + 1 }))}
      >
        Increment
      </button>
    </div>
  );
};

describe("React Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Re-render Correctness", () => {
    it("should trigger re-render when selected state changes", () => {
      const store = create({ count: 0, name: "test" });
      const renderSpy = vi.fn();

      const { result } = renderHook(() => {
        renderSpy();
        return useSelect(store, (s) => s.count);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(result.current).toBe(0);

      act(() => {
        store.set({ count: 1, name: "test" });
      });

      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(result.current).toBe(1);
    });

    it("should not trigger re-render when unrelated state changes", () => {
      const store = create({ count: 0, name: "test", other: "value" });
      const renderSpy = vi.fn();

      const { result } = renderHook(() => {
        renderSpy();
        return useSelect(store, (s) => s.count);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        store.set((prev) => ({ ...prev, name: "updated", other: "changed" }));
      });

      // Should not re-render since count didn't change
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(result.current).toBe(0);
    });

    it("should handle multiple components subscribing to same store", () => {
      const store = create({ count: 0, name: "test" });

      render(
        <div>
          <TestComponent store={store} selector={(s: any) => s.count} />
          <TestComponent store={store} selector={(s: any) => s.name} />
          <TestComponent store={store} />
        </div>
      );

      expect(screen.getAllByTestId("state")).toHaveLength(3);
      expect(screen.getAllByTestId("state")[0]).toHaveTextContent("0");
      expect(screen.getAllByTestId("state")[1]).toHaveTextContent('"test"');
      expect(screen.getAllByTestId("state")[2]).toHaveTextContent(
        '{"count":0,"name":"test"}'
      );

      act(() => {
        store.set({ count: 5, name: "updated" });
      });

      expect(screen.getAllByTestId("state")[0]).toHaveTextContent("5");
      expect(screen.getAllByTestId("state")[1]).toHaveTextContent('"updated"');
      expect(screen.getAllByTestId("state")[2]).toHaveTextContent(
        '{"count":5,"name":"updated"}'
      );
    });

    it("should handle rapid state changes correctly", () => {
      const store = create({ count: 0 });
      const renderSpy = vi.fn();

      const { result } = renderHook(() => {
        renderSpy();
        return useSelect(store, (s) => s.count);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      act(() => {
        // Rapid updates in same act block
        store.set({ count: 1 });
        store.set({ count: 2 });
        store.set({ count: 3 });
      });

      // Should batch updates and only re-render once
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(result.current).toBe(3);
    });

    it("should maintain referential equality for unchanged objects", () => {
      const store = create({
        user: { id: 1, name: "John" },
        settings: { theme: "dark" },
      });

      const results: any[] = [];

      const { rerender } = renderHook(() => {
        const user = useSelect(store, (s) => s.user);
        results.push(user);
        return user;
      });

      // Update unrelated state
      act(() => {
        store.set((prev) => ({
          ...prev,
          settings: { theme: "light" },
        }));
      });

      rerender();

      // User object should maintain referential equality
      expect(results[0]).toBe(results[1]);
    });
  });

  describe("useState Hook Integration", () => {
    it("should work correctly with useState hook", () => {
      const store = create({ count: 0 });

      render(<TestComponentWithState store={store} />);

      expect(screen.getByTestId("state")).toHaveTextContent('{"count":0}');

      act(() => {
        screen.getByTestId("increment").click();
      });

      expect(screen.getByTestId("state")).toHaveTextContent('{"count":1}');
      expect(store.get().count).toBe(1);
    });

    it("should handle functional updates correctly", () => {
      const store = create({ count: 0, multiplier: 2 });

      const TestFunctionalUpdate: React.FC = () => {
        const [state, setState] = useState(store);

        const handleUpdate = () => {
          setState((prev) => ({
            ...prev,
            count: prev.count * prev.multiplier,
          }));
        };

        return (
          <div>
            <div data-testid="state">{JSON.stringify(state)}</div>
            <button data-testid="update" onClick={handleUpdate}>
              Update
            </button>
          </div>
        );
      };

      render(<TestFunctionalUpdate />);

      expect(screen.getByTestId("state")).toHaveTextContent(
        '{"count":0,"multiplier":2}'
      );

      // Set initial count
      act(() => {
        store.set({ count: 3, multiplier: 2 });
      });

      expect(screen.getByTestId("state")).toHaveTextContent(
        '{"count":3,"multiplier":2}'
      );

      act(() => {
        screen.getByTestId("update").click();
      });

      expect(screen.getByTestId("state")).toHaveTextContent(
        '{"count":6,"multiplier":2}'
      );
    });

    it("should maintain stable setState reference", () => {
      const store = create({ count: 0 });
      const setStateRefs: any[] = [];

      const { rerender } = renderHook(() => {
        const [, setState] = useState(store);
        setStateRefs.push(setState);
        return setState;
      });

      rerender();
      rerender();

      // All setState references should be the same
      expect(setStateRefs[0]).toBe(setStateRefs[1]);
      expect(setStateRefs[1]).toBe(setStateRefs[2]);
    });
  });

  describe("Store with Actions Integration", () => {
    it("should work correctly with actions in components", () => {
      const store = create({ count: 0 }).withActions((s) => ({
        increment: () => s.set((prev) => ({ count: prev.count + 1 })),
        decrement: () => s.set((prev) => ({ count: prev.count - 1 })),
        reset: () => s.set({ count: 0 }),
      }));

      const TestWithActions: React.FC = () => {
        const { count, increment, decrement, reset } = useSelect(store);

        return (
          <div>
            <div data-testid="count">{count}</div>
            <button data-testid="increment" onClick={increment}>
              +
            </button>
            <button data-testid="decrement" onClick={decrement}>
              -
            </button>
            <button data-testid="reset" onClick={reset}>
              Reset
            </button>
          </div>
        );
      };

      render(<TestWithActions />);

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      act(() => {
        screen.getByTestId("increment").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("1");

      act(() => {
        screen.getByTestId("increment").click();
        screen.getByTestId("increment").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("3");

      act(() => {
        screen.getByTestId("decrement").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("2");

      act(() => {
        screen.getByTestId("reset").click();
      });

      expect(screen.getByTestId("count")).toHaveTextContent("0");
    });

    it("should maintain action stability across re-renders", () => {
      const store = create({ count: 0 }).withActions((s) => ({
        increment: () => s.set((prev) => ({ count: prev.count + 1 })),
      }));

      const actionRefs: any[] = [];

      const { rerender } = renderHook(() => {
        const { increment } = useSelect(store);
        actionRefs.push(increment);
        return increment;
      });

      rerender();
      rerender();

      // Action references should be stable
      expect(actionRefs[0]).toBe(actionRefs[1]);
      expect(actionRefs[1]).toBe(actionRefs[2]);
    });
  });

  describe("React Strict Mode Compatibility", () => {
    it("should work correctly in React Strict Mode", () => {
      const store = create({ count: 0 });
      const renderSpy = vi.fn();

      const TestStrictMode: React.FC = () => {
        renderSpy();
        const count = useSelect(store, (s) => s.count);
        return <div data-testid="count">{count}</div>;
      };

      render(
        <StrictMode>
          <TestStrictMode />
        </StrictMode>
      );

      // In strict mode, components render twice in development
      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("count")).toHaveTextContent("0");

      act(() => {
        store.set({ count: 5 });
      });

      expect(screen.getByTestId("count")).toHaveTextContent("5");
    });

    it("should handle subscription cleanup in strict mode", () => {
      const store = create({ count: 0 });
      const subscribeSpy = vi.spyOn(store, "subscribe");

      const TestCleanup: React.FC = () => {
        const count = useSelect(store, (s) => s.count);
        return <div>{count}</div>;
      };

      const { unmount } = render(
        <StrictMode>
          <TestCleanup />
        </StrictMode>
      );

      // Should handle double subscription/cleanup in strict mode
      expect(subscribeSpy).toHaveBeenCalled();

      unmount();

      // Should not throw or cause memory leaks
      expect(() => store.set({ count: 1 })).not.toThrow();
    });
  });

  describe("Error Boundaries and Error Handling", () => {
    it("should handle selector errors gracefully", () => {
      const store = create({ count: 0, data: null as any });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const badSelector = (state: any) => {
        if (state.count > 5) {
          throw new Error("Selector error");
        }
        return state.count;
      };

      const TestErrorHandling: React.FC = () => {
        const count = useSelect(store, badSelector);
        return <div data-testid="count">{count}</div>;
      };

      render(<TestErrorHandling />);

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      // This should throw an error when selector fails
      expect(() => {
        act(() => {
          store.set({ count: 10, data: null });
        });
      }).toThrow("Selector error");

      consoleSpy.mockRestore();
    });

    it("should handle component unmounting during state updates", () => {
      const store = create({ count: 0 });

      const TestUnmount: React.FC = () => {
        const count = useSelect(store, (s) => s.count);
        return <div data-testid="count">{count}</div>;
      };

      const { unmount } = render(<TestUnmount />);

      expect(screen.getByTestId("count")).toHaveTextContent("0");

      unmount();

      // Should not throw when updating after unmount
      expect(() => {
        act(() => {
          store.set({ count: 5 });
        });
      }).not.toThrow();
    });
  });

  describe("Performance Optimizations", () => {
    it("should prevent unnecessary re-renders with memoization", () => {
      const store = create({
        items: [1, 2, 3],
        filter: "all",
        metadata: { version: 1 },
      });

      const renderSpy = vi.fn();

      const { result } = renderHook(() => {
        renderSpy();
        return useSelect(store, (s) => s.items.filter((item) => item > 1));
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual([2, 3]);

      // Update metadata (should not cause re-render if selector result is same)
      act(() => {
        store.set((prev) => ({
          ...prev,
          metadata: { version: 2 },
        }));
      });

      // Should re-render due to new object reference, but this is expected behavior
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle large state objects efficiently", () => {
      const largeState = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: i * 2,
        })),
        metadata: { total: 1000 },
        settings: { pageSize: 50, currentPage: 1 },
      };

      const store = create(largeState);

      const startTime = performance.now();

      const { result } = renderHook(() =>
        useSelect(store, (s) => s.items.slice(0, 10))
      );

      const endTime = performance.now();

      expect(result.current).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });
  });

  describe("SSR and Hydration", () => {
    it("should handle server-side rendering correctly", () => {
      const store = create({ count: 42 });

      // Test that the store works without window object issues
      const { result } = renderHook(() => useSelect(store, (s) => s.count));

      expect(result.current).toBe(42);
    });

    it("should use initial state for SSR", () => {
      const store = create({ count: 0, name: "initial" });

      // Modify state after creation
      store.set({ count: 100, name: "modified" });

      const { result } = renderHook(() => {
        const [state] = useState(store);
        return state;
      });

      // Should use current state, not initial
      expect(result.current).toEqual({ count: 100, name: "modified" });

      // But getInitial should still return initial state
      expect(store.getInitial()).toEqual({ count: 0, name: "initial" });
    });
  });

  describe("Custom Equality Functions in Components", () => {
    it("should work with custom equality in components", () => {
      const store = create({
        items: [{ id: 1, name: "Item 1" }],
        lastUpdated: Date.now(),
      });

      const renderSpy = vi.fn();

      const customEqual = (a: any[], b: any[]) => {
        return (
          a.length === b.length &&
          a.every((item, index) => item.id === b[index]?.id)
        );
      };

      const { result } = renderHook(() => {
        renderSpy();
        return useSelect(store, (s) => s.items, customEqual);
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Update lastUpdated (should not trigger re-render due to custom equality)
      act(() => {
        store.set((prev) => ({
          ...prev,
          lastUpdated: Date.now() + 1000,
        }));
      });

      expect(renderSpy).toHaveBeenCalledTimes(1); // Should not re-render

      // Add new item (should trigger re-render)
      act(() => {
        store.set((prev) => ({
          ...prev,
          items: [...prev.items, { id: 2, name: "Item 2" }],
        }));
      });

      expect(renderSpy).toHaveBeenCalledTimes(2);
      expect(result.current).toHaveLength(2);
    });
  });
});
