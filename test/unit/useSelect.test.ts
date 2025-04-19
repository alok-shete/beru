import { describe, it, expect, vi } from "vitest";

import { renderHook, act } from "@testing-library/react";
import { create, useSelect } from "../../src";

describe("useSelect hook", () => {
  it("should return full state by default", () => {
    const store = create({ count: 10 });
    const { result } = renderHook(() => useSelect(store));
    expect(result.current).toEqual({ count: 10 });
  });

  it("should return selected slice of state", () => {
    const store = create({ count: 5, name: "Alok" });
    const { result } = renderHook(() => useSelect(store, (s) => s.count));
    expect(result.current).toBe(5);
  });

  it("should update when relevant state changes", () => {
    const store = create({ count: 0 });
    const { result, rerender } = renderHook(() =>
      useSelect(store, (s) => s.count)
    );

    expect(result.current).toBe(0);

    act(() => {
      store.set((prev) => ({ count: prev.count + 1 }));
    });

    rerender();
    expect(result.current).toBe(1);
  });

  it("should work with store having actions", () => {
    const store = create({ count: 2 }).withActions((s) => ({
      inc: () => s.set((p) => ({ count: p.count + 1 })),
    }));

    const { result } = renderHook(() =>
      useSelect(store, (s) => {

        console.log(s)
        return ({
          count: s.count,
          inc: s.inc,
        })
      })
    );

    expect(result.current.count).toBe(2);
    expect(typeof result.current.inc).toBe("function");

    act(() => {
      result.current.inc();
    });

    expect(store.get().count).toBe(3);
  });
});
