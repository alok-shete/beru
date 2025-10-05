import { describe, it, expect, vi, beforeEach } from "vitest";
import { persist } from "../../src/middleware/persistence";
import { create } from "../../src";

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

describe("Migration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Version Upgrade Paths", () => {
    it("should migrate from version 0 to version 1", () => {
      const storage = fakeStorage();
      const store = create({ count: 0, newField: "default" });

      // Simulate old data structure
      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const migrate = vi.fn((state, persistedVersion) => {
        if (persistedVersion === 0) {
          return { ...state, newField: "migrated" };
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith({ count: 42 }, 0);
      expect(store.get()).toEqual({ count: 42, newField: "migrated" });
    });

    it("should migrate through multiple versions (0 -> 1 -> 2)", () => {
      const storage = fakeStorage();
      const store = create({ count: 0, name: "default", category: "none" });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const migrate = vi.fn((state, persistedVersion) => {
        let migratedState = { ...state };

        // Version 0 -> 1: Add name field
        if (persistedVersion === 0) {
          migratedState = { ...migratedState, name: "migrated_v1" };
        }

        // Version 1 -> 2: Add category field
        if (persistedVersion <= 1) {
          migratedState = { ...migratedState, category: "migrated_v2" };
        }

        return migratedState;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 2,
        migrate,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith({ count: 42 }, 0);
      expect(store.get()).toEqual({
        count: 42,
        name: "migrated_v1",
        category: "migrated_v2",
      });
    });

    it("should handle migration from future version (downgrade)", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42, futureField: "should-be-removed" },
          version: 5, // Future version
        })
      );

      const migrate = vi.fn((state, persistedVersion) => {
        if (persistedVersion > 1) {
          // Downgrade: remove future fields
          const { futureField, ...downgraded } = state as any;
          return downgraded;
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith(
        { count: 42, futureField: "should-be-removed" },
        5
      );
      expect(store.get()).toEqual({ count: 42 });
    });

    it("should skip migration when versions match", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 1,
        })
      );

      const migrate = vi.fn((state, persistedVersion) => {
        if (persistedVersion === 1) {
          return state; // No migration needed
        }
        return null;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith({ count: 42 }, 1);
      expect(store.get()).toEqual({ count: 42 });
    });

    it("should handle migration returning null (incompatible data)", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { incompatibleData: "old-format" },
          version: 0,
        })
      );

      const migrate = vi.fn((state, persistedVersion) => {
        if (persistedVersion === 0) {
          // Data is incompatible, return null to use initial state
          return null;
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith(
        { incompatibleData: "old-format" },
        0
      );
      expect(store.get()).toEqual({ count: 0 }); // Should use initial state
    });
  });

  describe("Complex Migration Scenarios", () => {
    it("should handle data structure transformation", () => {
      const storage = fakeStorage();
      const store = create({
        users: [] as Array<{ id: string; name: string; email: string }>,
      });

      // Old format: users as object with IDs as keys
      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: {
            users: {
              "1": { name: "John", email: "john@example.com" },
              "2": { name: "Jane", email: "jane@example.com" },
            },
          },
          version: 0,
        })
      );

      const migrate = vi.fn((state: any, persistedVersion) => {
        if (persistedVersion === 0) {
          // Transform object to array
          const usersArray = Object.entries(state.users).map(
            ([id, user]: [string, any]) => ({
              id,
              ...user,
            })
          );
          return { users: usersArray };
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(store.get().users).toEqual([
        { id: "1", name: "John", email: "john@example.com" },
        { id: "2", name: "Jane", email: "jane@example.com" },
      ]);
    });

    it("should handle field renaming migration", () => {
      const storage = fakeStorage();
      const store = create({ userName: "", userEmail: "" });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { name: "John", email: "john@example.com" },
          version: 0,
        })
      );

      const migrate = vi.fn((state: any, persistedVersion) => {
        if (persistedVersion === 0) {
          return {
            userName: state.name,
            userEmail: state.email,
          };
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(store.get()).toEqual({
        userName: "John",
        userEmail: "john@example.com",
      });
    });

    it("should handle type conversion migration", () => {
      const storage = fakeStorage();
      const store = create({
        settings: { theme: "light", notifications: true },
      });

      // Old format: settings as flat structure
      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { theme: "dark", notifications: "enabled" },
          version: 0,
        })
      );

      const migrate = vi.fn((state: any, persistedVersion) => {
        if (persistedVersion === 0) {
          return {
            settings: {
              theme: state.theme,
              notifications: state.notifications === "enabled",
            },
          };
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(store.get()).toEqual({
        settings: { theme: "dark", notifications: true },
      });
    });

    it("should handle migration with validation", () => {
      const storage = fakeStorage();
      const store = create({ count: 0, status: "active" });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: "invalid", status: "unknown" },
          version: 0,
        })
      );

      const migrate = vi.fn((state: any, persistedVersion) => {
        if (persistedVersion === 0) {
          return {
            count: typeof state.count === "number" ? state.count : 0,
            status: ["active", "inactive"].includes(state.status)
              ? state.status
              : "active",
          };
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
      });

      persistent.hydrate();

      expect(store.get()).toEqual({ count: 0, status: "active" });
    });
  });

  describe("Migration Error Handling", () => {
    it("should handle migration function throwing errors", () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      const migrate = vi.fn(() => {
        throw new Error("Migration failed");
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
        onError,
      });

      persistent.hydrate();

      expect(onError).toHaveBeenCalledWith("migration", expect.any(Error));
      expect(store.get()).toEqual({ count: 0 }); // Should remain initial state
    });

    it("should handle async migration errors", async () => {
      const storage = fakeStorage();
      const store = create({ count: 0 });
      const onError = vi.fn();

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42 },
          version: 0,
        })
      );

      // Migration that throws during execution
      const migrate = vi.fn((state: any) => {
        // Simulate complex migration that might fail
        if (state.count > 40) {
          throw new Error("Migration validation failed");
        }
        return state;
      });

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
        onError,
      });

      persistent.hydrate();

      expect(onError).toHaveBeenCalledWith("migration", expect.any(Error));
    });
  });

  describe("Migration with Custom Merge", () => {
    it("should apply migration before custom merge", () => {
      const storage = fakeStorage();
      const store = create({ count: 0, name: "initial", version: "v1" });

      storage.getItem.mockReturnValueOnce(
        JSON.stringify({
          state: { count: 42, name: "persisted" },
          version: 0,
        })
      );

      const migrate = vi.fn((state: any, persistedVersion) => {
        if (persistedVersion === 0) {
          return { ...state, version: "v1-migrated" };
        }
        return state;
      });

      const merge = vi.fn((initial, persisted) => ({
        ...initial,
        ...persisted,
        merged: true,
      }));

      const persistent = persist(store, {
        name: "test-key",
        storage,
        version: 1,
        migrate,
        merge,
      });

      persistent.hydrate();

      expect(migrate).toHaveBeenCalledWith({ count: 42, name: "persisted" }, 0);
      expect(merge).toHaveBeenCalledWith(
        { count: 0, name: "initial", version: "v1" },
        { count: 42, name: "persisted", version: "v1-migrated" }
      );
      expect(store.get()).toEqual({
        count: 42,
        name: "persisted",
        version: "v1-migrated",
        merged: true,
      });
    });
  });
});
