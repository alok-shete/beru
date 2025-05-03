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
