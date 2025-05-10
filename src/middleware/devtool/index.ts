import { BaseStore } from "../../utils/types";

interface DevtoolConfig { 
  // Define devtool configuration options here
}

type PersistentStore<S> = S & {
  // TODO - Extend with devtool-related methods if needed
};

export function devtool<T, S extends BaseStore<T>>(
  store: S,
  config: DevtoolConfig
): PersistentStore<S> {

  console.log("[Devtool] Initialized with config:", config);
  console.log("[Devtool] Store snapshot:", store);

  return Object.assign({}, store);
}