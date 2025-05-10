import {
  PersistConfig,
  PersistentStore,
  StorageInterface,
} from "../../utils/types";
import { persist } from "./core/persist";
import { setupHydrator } from "./core/setupHydrator";

const PersistCore = { setupHydrator, persist } as const;

export type { PersistConfig, PersistentStore, StorageInterface };

export { setupHydrator, persist };

export default PersistCore;
