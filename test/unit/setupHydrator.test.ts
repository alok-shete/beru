import { describe, it, expect, vi } from "vitest";
import { setupHydrator } from "../../src/middleware/persistence";

describe("setupHydrator", () => {
  it("should return a function", () => {
    const hydrator = setupHydrator([]);
    expect(typeof hydrator).toBe("function");
  });

  it("should return undefined if all instances return non-promises", () => {
    const mockPersist1 = { hydrate: vi.fn(() => undefined) };
    const mockPersist2 = { hydrate: vi.fn(() => undefined) };

    const hydrator = setupHydrator([mockPersist1 as any, mockPersist2]);
    const result = hydrator();

    expect(result).toBeUndefined();
    expect(mockPersist1.hydrate).toHaveBeenCalled();
    expect(mockPersist2.hydrate).toHaveBeenCalled();
  });

  it("should hydrate all persistence instances and return a promise if any return a promise", async () => {
    const promise1 = Promise.resolve();
    const promise2 = Promise.resolve();

    const mockPersist1 = { hydrate: vi.fn(() => promise1) };
    const mockPersist2 = { hydrate: vi.fn(() => promise2) };

    const hydrator = setupHydrator([mockPersist1 as any, mockPersist2]);
    const result = hydrator();

    expect(result).toBeInstanceOf(Promise);

    await expect(result).resolves.toBeUndefined();
    expect(mockPersist1.hydrate).toHaveBeenCalled();
    expect(mockPersist2.hydrate).toHaveBeenCalled();
  });

  it("should handle a mix of promise and non -promise hydrations", async () => {
    const promise = Promise.resolve();
    const mockPersist1 = { hydrate: vi.fn(() => promise) };
    const mockPersist2 = { hydrate: vi.fn(() => undefined) };

    const hydrator = setupHydrator([mockPersist1 as any, mockPersist2]);
    const result = hydrator();

    expect(result).toBeInstanceOf(Promise);

    await expect(result).resolves.toBeUndefined();
    expect(mockPersist1.hydrate).toHaveBeenCalled();
    expect(mockPersist2.hydrate).toHaveBeenCalled();
  });
});
