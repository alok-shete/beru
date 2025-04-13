import { AnyRecord } from "dns";
import {
  Listener,
  Selector,
  Updater,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  ANY,
} from "./utils/types";
import { create } from "./core/store";
import { useSelect } from "./core/useSelect";
import { useState } from "./core/useState";

/**
 * Beru library main object containing all exported functionalities.
 */
const Beru = { useSelect, create, useState } as const;

// Named exports for individual components and functions
export { useSelect, create, useState };

// Type exports
export type {
  Listener,
  Selector,
  Updater,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
  ANY,
};

// Default export
export default Beru;
