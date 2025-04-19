import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { create, useState } from "../../src";

describe("useState (custom hook)", () => {
  it("should return the initial state", () => {
    const store = create({ count: 0 });
    const { result } = renderHook(() => useState(store));

    const [state] = result.current;
    expect(state).toEqual({ count: 0 });
  });

  it("should update state correctly", () => {
    const store = create({ count: 1 });
    const { result } = renderHook(() => useState(store));

    act(() => {
      const [, setState] = result.current;
      setState((prev) => ({ count: prev.count + 1 }));
    });

    const [state] = result.current;
    expect(state).toEqual({ count: 2 });
  });

  it("should respect getInitialState fallback (SSR)", () => {
    const store = create({ count: 42 });

    const { result } = renderHook(() => useState(store));

    const [state] = result.current;
    expect(state).toEqual({ count: 42 });
    expect(store.getInitialState()).toEqual({ count: 42 });
  });

  it("should provide a stable setState reference", () => {
    const store = create({ count: 5 });
    const { result, rerender } = renderHook(() => useState(store));

    const [, set1] = result.current;
    rerender();
    const [, set2] = result.current;

    expect(set1).toBe(set2); // useCallback memoization
  });
});
