import { runImmediately } from "../../utils/common";
import { persist } from "./persist";

/**
 * Creates a hydration function that ensures all provided persistence instances are hydrated.
 *
 * This function accepts an array of `persist`-enhanced store instances and creates a function
 * that, when called, will attempt to hydrate each store from its respective storage.
 * Hydration is asynchronous, and this function ensures all hydration tasks are completed
 * before proceeding.
 *
 * @param {ReturnType<typeof persist>[]} persistenceInstances - An array of persistence instances that need to be hydrated.
 * @returns {(() => void | Promise<void>)} A function that hydrates all provided persistence instances.
 *    This function either returns nothing if no hydration is needed or a promise that resolves once all hydration is completed.
 *
 */
export const setupHydrator = (
  persistenceInstances: ReturnType<typeof persist>[]
): (() => void | Promise<void>) => {
  return () => {
    const asyncHydrationTasks: Promise<void>[] = [];

    for (const instance of persistenceInstances) {
      const hydrationTask = instance.hydrate();
      if (hydrationTask instanceof Promise) {
        asyncHydrationTasks.push(hydrationTask);
      }
    }

    if (asyncHydrationTasks.length === 0) return;

    return runImmediately(async () => {
      await Promise.all(asyncHydrationTasks);
    });
  };
};
