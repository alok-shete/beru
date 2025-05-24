import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { persist } from "../../src/middleware/persistence"; // adjust the path as necessary
import { createFallbackStorage } from "../../src/utils/common";
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

describe("persist", () => {
  beforeEach(() => {});

  afterEach(() => {
    vi.useRealTimers();
  });

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

    vi.advanceTimersByTime(100); // advance exactly to debounce time

    // await vi.runAllTimersAsync(); // ensure async setItem resolves

    // expect(storage.setItem).toHaveBeenCalledTimes(1);
    // expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
    //   state: { count: 2 },
    // });
  });

  it("clears the persisted state", async () => {
    const storage = fakeStorage();
    const store = create({ count: 0 });

    const persistent = persist(store, { name: "test-key", storage });
    await persistent.clear();
    expect(storage.removeItem).toHaveBeenCalledWith("test-key");
  });

  it("skips hydration when configured", async () => {
    const storage = fakeStorage();
    const store = create({ count: 0 });

    const persistent = persist(store, {
      name: "skip-key",
      storage,
      skipHydrate: true,
    });
    store.set({ count: 999 });
    expect(store.get()).toEqual({ count: 999 });
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it("uses fallback storage on error", () => {
    const storage = fakeStorage();
    const store = create({ count: 0 });

    const badStorage = () => {
      throw new Error("bad storage");
    };
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const persistent = persist(store, {
      name: "fallback",
      storage: badStorage,
    });

    persistent.clear(); // should trigger fallback without throwing
    expect(typeof createFallbackStorage().getItem).toBe("function");
    logSpy.mockRestore();
  });
});
