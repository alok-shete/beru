import { describe, it, expect, vi } from "vitest";
import { create } from "../../src/index";

import * as useStateModule from "../../src/core/useState";
import * as useSelectModule from "../../src/core/useSelect";
import { renderHook } from "@testing-library/react";

describe("create store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with the correct state", () => {
    const store = create({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
  });

  it("should update state using set", () => {
    const store = create({ count: 0 });
    store.set((prev) => ({ count: prev.count + 1 }));
    expect(store.get().count).toBe(1);
  });

  it("should notify subscribers on set", () => {
    const store = create({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set((prev) => ({ count: prev.count + 1 }));
    expect(listener).toHaveBeenCalledTimes(2); // one on subscribe, one on update
  });

  it("should return selected state using select", () => {
    const store = create({ count: 42, name: "test" });
    const name = store.get().name;
    expect(name).toBe("test");
  });

  it("should extend store with custom actions using withActions", () => {
    const store = create({ count: 0 }).withActions((s) => ({
      increment: () => s.set((prev) => ({ count: prev.count + 1 })),
      decrement: () => s.set((prev) => ({ count: prev.count - 1 })),
    }));

    store.getActions().increment();
    expect(store.get().count).toBe(1);

    store.getActions().decrement();
    expect(store.get().count).toBe(0);
  });

  it.only("should select from extended store including actions", () => {
    const store = create({ count: 1 }).withActions((s) => ({
      double: () => s.set((prev) => ({ count: prev.count * 2 })),
    }));

    const selected = store.get();
    expect(selected.count).toBe(1);

    store.getActions().double();
    expect(store.get().count).toBe(2);
  });

  it("should call useState when store is initialized", () => {
    const mockUseState = vi.spyOn(useStateModule, "useState");

    const useName = create("Alok");

    const { result } = renderHook(() => useName());

    expect(result.current[0]).toBe("Alok");
    expect(typeof result.current[1]).toBe("function");

    expect(mockUseState).toHaveBeenCalledOnce();
  });

  it("should call useSelect when extendedStore is used", () => {
    const mockUseSelect = vi.spyOn(useSelectModule, "useSelect");

    const useCount = create({ count: 10 }).withActions((s) => ({
      add: () => s.set((prev) => ({ count: prev.count + 1 })),
    }));

    const { result } = renderHook(() => useCount((state) => state.count));

    expect(result.current).toBe(10);

    expect(mockUseSelect).toHaveBeenCalledOnce();
  });

  it("should return the initial state using getInitialState()", () => {
    const initial = { count: 100 };
    const store = create(initial);

    // Mutate state
    store.set({ count: 999 });

    // Check getInitialState still returns the original
    expect(store.getInitialState()).toEqual(initial);
  });
});
