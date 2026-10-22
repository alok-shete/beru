import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "../../src";
import { devtoolsImpl } from "../../src/middleware/devtools";

describe("DevTools subscriptions", () => {
  afterEach(() => {
    delete window.__REDUX_DEVTOOLS_EXTENSION__;
    vi.restoreAllMocks();
  });

  it("unsubscribes each listener exactly once when cleanup is repeated", () => {
    const connectionUnsubscribe = vi.fn();
    const send = vi.fn();
    Object.defineProperty(window, "__REDUX_DEVTOOLS_EXTENSION__", {
      configurable: true,
      value: {
        connect: () => ({
          init: vi.fn(),
          send,
          subscribe: () => connectionUnsubscribe,
        }),
      },
    });

    const store = create({ count: 0 });
    const storeUnsubscribe = vi.fn();
    const subscribe = store.subscribe.bind(store);
    vi.spyOn(store, "subscribe").mockImplementation((listener) => {
      const unsubscribe = subscribe(listener);
      return () => {
        storeUnsubscribe();
        unsubscribe();
      };
    });

    const cleanup = devtoolsImpl(store).__devtoolsUnsubscribe;

    store.set({ count: 1 });
    expect(send).toHaveBeenCalledTimes(1);

    cleanup();
    cleanup();
    expect(connectionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(storeUnsubscribe).toHaveBeenCalledTimes(1);

    store.set({ count: 2 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("removes the store listener when DevTools cleanup throws", () => {
    const connectionUnsubscribe = vi.fn(() => {
      throw new Error("DevTools cleanup failed");
    });
    const send = vi.fn();
    Object.defineProperty(window, "__REDUX_DEVTOOLS_EXTENSION__", {
      configurable: true,
      value: {
        connect: () => ({
          init: vi.fn(),
          send,
          subscribe: () => connectionUnsubscribe,
        }),
      },
    });

    const store = create({ count: 0 });
    const storeUnsubscribe = vi.fn();
    const subscribe = store.subscribe.bind(store);
    vi.spyOn(store, "subscribe").mockImplementation((listener) => {
      const unsubscribe = subscribe(listener);
      return () => {
        storeUnsubscribe();
        unsubscribe();
      };
    });

    const cleanup = devtoolsImpl(store).__devtoolsUnsubscribe;

    expect(cleanup).toThrow("DevTools cleanup failed");
    expect(connectionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(storeUnsubscribe).toHaveBeenCalledTimes(1);

    cleanup();
    store.set({ count: 1 });
    expect(connectionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(storeUnsubscribe).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});
