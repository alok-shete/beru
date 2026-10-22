// @vitest-environment node

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { create, useSelect } from "../../src";

describe("React Native-compatible subscriptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates every subscriber without a browser DOM and unsubscribes on unmount", () => {
    expect(typeof window).toBe("undefined");

    const store = create({ count: 0, label: "initial" });
    const firstRender = vi.fn();
    const secondRender = vi.fn();

    const FirstSubscriber = () => {
      const count = useSelect(store, (state) => state.count);
      firstRender(count);
      return React.createElement("value", null, count);
    };

    const SecondSubscriber = () => {
      const label = useSelect(store, (state) => state.label);
      secondRender(label);
      return React.createElement("value", null, label);
    };

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(FirstSubscriber),
          React.createElement(SecondSubscriber)
        )
      );
    });

    expect(firstRender).toHaveBeenLastCalledWith(0);
    expect(secondRender).toHaveBeenLastCalledWith("initial");

    act(() => {
      store.set({ count: 1, label: "updated" });
    });

    expect(firstRender).toHaveBeenLastCalledWith(1);
    expect(secondRender).toHaveBeenLastCalledWith("updated");

    const firstRenderCount = firstRender.mock.calls.length;
    const secondRenderCount = secondRender.mock.calls.length;

    act(() => {
      renderer!.unmount();
      store.set({ count: 2, label: "after unmount" });
    });

    expect(firstRender).toHaveBeenCalledTimes(firstRenderCount);
    expect(secondRender).toHaveBeenCalledTimes(secondRenderCount);
  });
});
