import { StorageInterface } from "./types";

const wrap = <T>(fn: T) =>
  process.env.NODE_ENV !== "production" ? fn : () => {};

export const LOG = {
  warn: wrap(console.warn),
  error: console.error,
  info: wrap(console.info),
};

export const runImmediately = <T>(callback: () => T): T => callback();

export const createFallbackStorage = (): StorageInterface => {
  const warn =
    <A>(operation: string, defaultReturn: A) =>
    () => {
      LOG.warn(`Uninitialized storage: ${operation}`);
      return defaultReturn;
    };

  return {
    getItem: warn("getItem", null),
    setItem: warn("setItem", undefined),
    removeItem: warn("removeItem", undefined),
  };
};

/**
 * Performs a shallow equality comparison between two values.
 * Returns true if the values are equal at the first level.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are shallowly equal, false otherwise
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  // Same reference or both are strictly equal (handles primitives, null, undefined)
  if (a === b) {
    return true;
  }

  // If either is null/undefined and they're not equal, return false
  if (a == null || b == null) {
    return false;
  }

  // If types are different, return false
  if (typeof a !== typeof b) {
    return false;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;
  }

  // Handle objects
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Different number of keys
    if (keysA.length !== keysB.length) {
      return false;
    }

    // Check if all keys and values are equal
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) {
        return false;
      }

      if ((a as any)[key] !== (b as any)[key]) {
        return false;
      }
    }

    return true;
  }

  // For all other cases (functions, symbols, etc.)
  return false;
}

/**
 * A more strict shallow equal that also checks for Date objects
 */
export function shallowEqualStrict<T>(a: T, b: T): boolean {
  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle RegExp objects
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  // Fall back to regular shallow equal
  return shallowEqual(a, b);
}

/**
 * Creates a shallow equal function that ignores specific keys
 */
export function createShallowEqualIgnoring<T extends Record<string, any>>(
  ignoreKeys: (keyof T)[]
): (a: T, b: T) => boolean {
  return (a: T, b: T): boolean => {
    if (a === b) {
      return true;
    }

    if (a == null || b == null) {
      return false;
    }

    const keysA = Object.keys(a).filter((key) => !ignoreKeys.includes(key));
    const keysB = Object.keys(b).filter((key) => !ignoreKeys.includes(key));

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) {
        return false;
      }

      if (a[key] !== b[key]) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Creates a shallow equal function that only compares specific keys
 */
export function createShallowEqualPick<T extends Record<string, any>>(
  pickKeys: (keyof T)[]
): (a: T, b: T) => boolean {
  return (a: T, b: T): boolean => {
    if (a === b) {
      return true;
    }

    if (a == null || b == null) {
      return false;
    }

    for (const key of pickKeys) {
      if (a[key] !== b[key]) {
        return false;
      }
    }

    return true;
  };
}
