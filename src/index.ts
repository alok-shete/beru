import {
  Listener,
  Selector,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
  StoreActions,
  StoreSnapshot,
  StoreState,
} from "./utils/types";
import { create } from "./core/store";
import { useSelect, useState } from "./core/hooks";

const Beru = { useSelect, create, useState } as const;

export { useSelect, create, useState };

export type {
  Listener,
  Selector,
  BaseStore,
  StoreHook,
  StoreWithActions,
  Store,
  AnyRecord,
  StoreActions,
  StoreSnapshot,
  StoreState,
};

export default Beru;
