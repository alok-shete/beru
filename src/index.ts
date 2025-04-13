import {
  Listener,
  Selector,
  Updater,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
} from "./utils/types";
import { create } from "./core/store";
import { useSelect } from "./core/useSelect";
import { useState } from "./core/useState";

const Beru = { useSelect, create, useState } as const;

export { useSelect, create, useState };

export type {
  Listener,
  Selector,
  Updater,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
};

export default Beru;
